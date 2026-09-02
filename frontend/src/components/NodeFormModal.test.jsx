import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeFormModal } from './NodeFormModal.jsx';
import { makeApiError } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureNodeMaintenance } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
}));

import * as networkNodeService from '../services/networkNodeService.js';

describe('NodeFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin codigo ni nombre: muestra el callout con los campos faltantes y no llama a create', async () => {
    const user = userEvent.setup();
    render(<NodeFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Guardar nodo'));

    expect(screen.getByText('Faltan datos obligatorios: Código, Nombre.')).toBeInTheDocument();
    expect(networkNodeService.create).not.toHaveBeenCalled();
  });

  it('un codigo duplicado (409) se muestra como error en el campo Codigo', async () => {
    const user = userEvent.setup();
    networkNodeService.create.mockRejectedValueOnce(
      makeApiError('Network node code already exists', { status: 409 }),
    );

    render(<NodeFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('NODO-014'), 'NODO-DUP');
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), 'Nodo repetido');
    await user.click(screen.getByText('Guardar nodo'));

    await waitFor(() => expect(screen.getByText('Network node code already exists')).toBeInTheDocument());
    expect(networkNodeService.create).toHaveBeenCalledTimes(1);
  });

  it('al guardar con exito, llama onSaved y onClose', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    networkNodeService.create.mockResolvedValueOnce({ networkNode: { id: 'n1' } });

    render(<NodeFormModal onClose={onClose} onSaved={onSaved} />);

    await user.type(screen.getByPlaceholderText('NODO-014'), 'NODO-001');
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), 'Nodo nuevo');
    await user.click(screen.getByText('Guardar nodo'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('con initialCoords (creacion desde el mapa), prellena latitud/longitud de solo lectura y las incluye en el payload', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const createdNode = { id: 'n2', latitude: 10.5, longitude: -84.5 };
    networkNodeService.create.mockResolvedValueOnce({ networkNode: createdNode });

    render(
      <NodeFormModal
        initialCoords={{ latitude: 10.5, longitude: -84.5 }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByText('Crear nodo en esta ubicación')).toBeInTheDocument();
    expect(screen.getByText('10.500000')).toBeInTheDocument();
    expect(screen.getByText('-84.500000')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('NODO-014'), 'NODO-MAPA-01');
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), 'Nodo desde mapa');
    await user.click(screen.getByText('Crear nodo aquí'));

    await waitFor(() => expect(networkNodeService.create).toHaveBeenCalledWith({
      code: 'NODO-MAPA-01',
      name: 'Nodo desde mapa',
      location: null,
      status: 'AVAILABLE',
      latitude: 10.5,
      longitude: -84.5,
    }));
    expect(onSaved).toHaveBeenCalledWith(createdNode);
  });
});

describe('NodeFormModal — MAINTENANCE es un estado automatico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el select de Estado ofrece solo los estados manuales, sin "En mantenimiento"', () => {
    render(<NodeFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    // Lo asigna el backend al iniciar un mantenimiento; ofrecerlo aqui solo
    // produciria un 409.
    expect(screen.queryByText('En mantenimiento')).not.toBeInTheDocument();
  });

  it('editando un nodo en mantenimiento lo muestra de solo lectura, sin select de Estado', () => {
    render(<NodeFormModal node={fixtureNodeMaintenance} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('En mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('(Automático)')).toBeInTheDocument();
    expect(
      screen.getByText(/Estado automático: el nodo tiene un mantenimiento en ejecución/),
    ).toBeInTheDocument();
    // Ya no hay opciones seleccionables de estado.
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
    expect(screen.queryByText('Fuera de servicio')).not.toBeInTheDocument();
  });

  it('editar otros campos de un nodo en mantenimiento NO envia el campo status', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockResolvedValueOnce({ networkNode: fixtureNodeMaintenance });

    render(<NodeFormModal node={fixtureNodeMaintenance} onClose={vi.fn()} onSaved={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('Subestación San Isidro');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nodo renombrado en mantenimiento');
    await user.click(screen.getByText('Guardar nodo'));

    await waitFor(() =>
      expect(networkNodeService.update).toHaveBeenCalledWith(fixtureNodeMaintenance.id, {
        code: fixtureNodeMaintenance.code,
        name: 'Nodo renombrado en mantenimiento',
        location: fixtureNodeMaintenance.location,
      }),
    );
  });

  it('editando un nodo con estado manual el select sigue disponible y el status viaja', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });

    render(<NodeFormModal node={fixtureNodeAvailable} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.selectOptions(screen.getByDisplayValue('Disponible'), 'OUT_OF_SERVICE');
    await user.click(screen.getByText('Guardar nodo'));

    await waitFor(() =>
      expect(networkNodeService.update).toHaveBeenCalledWith(fixtureNodeAvailable.id, {
        code: fixtureNodeAvailable.code,
        name: fixtureNodeAvailable.name,
        location: fixtureNodeAvailable.location,
        status: 'OUT_OF_SERVICE',
      }),
    );
  });
});

describe('NodeFormModal — marcar fuera de servicio durante un mantenimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ofrece la accion "Marcar fuera de servicio" sobre un nodo en mantenimiento', () => {
    render(<NodeFormModal node={fixtureNodeMaintenance} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('Marcar fuera de servicio')).toBeInTheDocument();
  });

  it('al usarla muestra el estado pendiente y sigue sin ofrecer "Disponible"', async () => {
    const user = userEvent.setup();
    render(<NodeFormModal node={fixtureNodeMaintenance} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Marcar fuera de servicio'));

    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.getByText('(se aplicará al guardar)')).toBeInTheDocument();
    // La regla no se relaja por haber marcado el recurso: volver a
    // AVAILABLE sigue sin existir como opcion mientras la orden este activa.
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('guardar despues de marcarlo envia status OUT_OF_SERVICE', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockResolvedValueOnce({ networkNode: fixtureNodeMaintenance });

    render(<NodeFormModal node={fixtureNodeMaintenance} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Marcar fuera de servicio'));
    await user.click(screen.getByText('Guardar nodo'));

    await waitFor(() =>
      expect(networkNodeService.update).toHaveBeenCalledWith(fixtureNodeMaintenance.id, {
        code: fixtureNodeMaintenance.code,
        name: fixtureNodeMaintenance.name,
        location: fixtureNodeMaintenance.location,
        status: 'OUT_OF_SERVICE',
      }),
    );
  });

  it('la accion es reversible mientras no se guarde: vuelve a omitir status', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockResolvedValueOnce({ networkNode: fixtureNodeMaintenance });

    render(<NodeFormModal node={fixtureNodeMaintenance} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Marcar fuera de servicio'));
    await user.click(screen.getByText('Mantener estado automático'));

    expect(screen.getByText('En mantenimiento')).toBeInTheDocument();

    await user.click(screen.getByText('Guardar nodo'));

    await waitFor(() =>
      expect(networkNodeService.update).toHaveBeenCalledWith(fixtureNodeMaintenance.id, {
        code: fixtureNodeMaintenance.code,
        name: fixtureNodeMaintenance.name,
        location: fixtureNodeMaintenance.location,
      }),
    );
  });
});

describe('NodeFormModal — reparto de los conflictos 409', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ACTIVE_MAINTENANCE_MESSAGE =
    'No se puede marcar el nodo como Disponible mientras tiene un mantenimiento en ejecución.';

  it('un 409 de codigo duplicado se pinta bajo el campo Codigo, sin callout general', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockRejectedValueOnce(
      makeApiError('Network node code already exists', { status: 409 }),
    );

    render(<NodeFormModal node={fixtureNodeAvailable} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByText('Guardar nodo'));

    const message = await screen.findByText('Network node code already exists');
    // El error de campo es un <span class="nk-field-error"> dentro del Field;
    // el general es el callout con role="alert". Comprobar solo el texto no
    // distinguiria uno de otro.
    expect(message).toHaveClass('nk-field-error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un 409 de regla de mantenimiento se pinta como error general, NO bajo Codigo', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockRejectedValueOnce(
      makeApiError(ACTIVE_MAINTENANCE_MESSAGE, { status: 409 }),
    );

    const { container } = render(
      <NodeFormModal node={fixtureNodeAvailable} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await user.click(screen.getByText('Guardar nodo'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(ACTIVE_MAINTENANCE_MESSAGE);
    expect(container.querySelector('.nk-field-error')).toBeNull();
  });

  it('un conflicto de concurrencia tampoco se atribuye al campo Codigo', async () => {
    const user = userEvent.setup();
    networkNodeService.update.mockRejectedValueOnce(
      makeApiError('Concurrent modification detected, please retry', { status: 409 }),
    );

    const { container } = render(
      <NodeFormModal node={fixtureNodeAvailable} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await user.click(screen.getByText('Guardar nodo'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Concurrent modification detected, please retry');
    expect(container.querySelector('.nk-field-error')).toBeNull();
  });
});
