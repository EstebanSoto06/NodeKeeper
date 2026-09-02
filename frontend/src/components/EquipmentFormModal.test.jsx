import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EquipmentFormModal } from './EquipmentFormModal.jsx';
import { makeApiError } from '../test/test-utils.jsx';
import {
  fixtureEquipmentA,
  fixtureEquipmentB,
  fixtureNodeAvailable,
  fixtureNodes,
  fixtureProviderA,
} from '../test/fixtures.js';

vi.mock('../services/equipmentService.js', () => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/supportProviderService.js', () => ({ list: vi.fn() }));

import * as equipmentService from '../services/equipmentService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as supportProviderService from '../services/supportProviderService.js';

async function renderReady() {
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
  supportProviderService.list.mockResolvedValueOnce({ supportProviders: [fixtureProviderA] });
  const utils = render(<EquipmentFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => expect(screen.getByPlaceholderText('Switch core')).toBeInTheDocument());
  return utils;
}

describe('EquipmentFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el select de Nodo se puebla con nodos reales y preselecciona el primero (nodo obligatorio)', async () => {
    await renderReady();
    const nodeSelect = screen.getByDisplayValue(`${fixtureNodeAvailable.name} (${fixtureNodeAvailable.code})`);
    expect(nodeSelect).toBeInTheDocument();
  });

  it('el select de Proveedor incluye "No asignado" como opcion (proveedor opcional)', async () => {
    await renderReady();
    expect(screen.getByText('No asignado')).toBeInTheDocument();
    expect(screen.getByText(fixtureProviderA.companyName)).toBeInTheDocument();
  });

  it('sin nombre ni categoria: muestra el callout con los campos faltantes y no llama a create', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByText('Guardar equipo'));

    expect(screen.getByText('Faltan datos obligatorios: Nombre del equipo, Categoría.')).toBeInTheDocument();
    expect(equipmentService.create).not.toHaveBeenCalled();
  });

  it('sin nodos disponibles para elegir: muestra tambien el error de Nodo', async () => {
    const user = userEvent.setup();
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [] });
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: [] });
    render(<EquipmentFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText('Switch core')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Switch core'), 'Equipo sin nodo');
    await user.type(screen.getByPlaceholderText('Red'), 'Red');
    await user.click(screen.getByText('Guardar equipo'));

    expect(screen.getByText('Faltan datos obligatorios: Nodo.')).toBeInTheDocument();
    expect(equipmentService.create).not.toHaveBeenCalled();
  });

  it('un numero de serie duplicado (409) se muestra como error en el campo correspondiente', async () => {
    const user = userEvent.setup();
    await renderReady();
    equipmentService.create.mockRejectedValueOnce(
      makeApiError('Equipment serial number already exists', { status: 409 }),
    );

    await user.type(screen.getByPlaceholderText('Switch core'), 'Equipo de prueba');
    await user.type(screen.getByPlaceholderText('Red'), 'Red');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() =>
      expect(screen.getByText('Equipment serial number already exists')).toBeInTheDocument(),
    );
  });

  it('al guardar, envia supportProviderId null cuando se deja "No asignado"', async () => {
    const user = userEvent.setup();
    await renderReady();
    equipmentService.create.mockResolvedValueOnce({ equipment: { id: 'e1' } });

    await user.type(screen.getByPlaceholderText('Switch core'), 'Equipo de prueba');
    await user.type(screen.getByPlaceholderText('Red'), 'Red');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() => expect(equipmentService.create).toHaveBeenCalledTimes(1));
    const [payload] = equipmentService.create.mock.calls[0];
    expect(payload.supportProviderId).toBeNull();
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
  });
});

describe('EquipmentFormModal — MAINTENANCE es un estado automatico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderEditing(equipment) {
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: fixtureNodes });
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: [fixtureProviderA] });
    const utils = render(
      <EquipmentFormModal equipment={equipment} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByPlaceholderText('Switch core')).toBeInTheDocument());
    return utils;
  }

  it('el select de Estado ofrece solo los estados manuales, sin "En mantenimiento"', async () => {
    await renderReady();

    expect(screen.getByText('Operativo')).toBeInTheDocument();
    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.queryByText('En mantenimiento')).not.toBeInTheDocument();
  });

  it('editando un equipo en mantenimiento lo muestra de solo lectura, sin select de Estado', async () => {
    await renderEditing(fixtureEquipmentB);

    expect(screen.getByText('En mantenimiento')).toBeInTheDocument();
    expect(screen.getByText('(Automático)')).toBeInTheDocument();
    expect(
      screen.getByText(/Estado automático: el equipo tiene un mantenimiento en ejecución/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Operativo')).not.toBeInTheDocument();
  });

  it('editar otros campos de un equipo en mantenimiento NO envia el campo status', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockResolvedValueOnce({ equipment: fixtureEquipmentB });

    await renderEditing(fixtureEquipmentB);

    const categoryInput = screen.getByPlaceholderText('Red');
    await user.clear(categoryInput);
    await user.type(categoryInput, 'Energía crítica');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() =>
      expect(equipmentService.update).toHaveBeenCalledWith(fixtureEquipmentB.id, {
        name: fixtureEquipmentB.name,
        category: 'Energía crítica',
        serialNumber: null,
        networkNodeId: fixtureEquipmentB.networkNodeId,
        supportProviderId: null,
      }),
    );
  });

  it('editando un equipo con estado manual el select sigue disponible y el status viaja', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockResolvedValueOnce({ equipment: fixtureEquipmentA });

    await renderEditing(fixtureEquipmentA);

    await user.selectOptions(screen.getByDisplayValue('Operativo'), 'OUT_OF_SERVICE');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() =>
      expect(equipmentService.update).toHaveBeenCalledWith(fixtureEquipmentA.id, {
        name: fixtureEquipmentA.name,
        category: fixtureEquipmentA.category,
        serialNumber: fixtureEquipmentA.serialNumber,
        status: 'OUT_OF_SERVICE',
        networkNodeId: fixtureEquipmentA.networkNodeId,
        supportProviderId: fixtureEquipmentA.supportProviderId,
      }),
    );
  });
});

describe('EquipmentFormModal — marcar fuera de servicio durante un mantenimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderMaintenanceEquipment() {
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: fixtureNodes });
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: [fixtureProviderA] });
    render(<EquipmentFormModal equipment={fixtureEquipmentB} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText('Switch core')).toBeInTheDocument());
  }

  it('ofrece la accion "Marcar fuera de servicio" sobre un equipo en mantenimiento', async () => {
    await renderMaintenanceEquipment();

    expect(screen.getByText('Marcar fuera de servicio')).toBeInTheDocument();
  });

  it('al usarla muestra el estado pendiente y sigue sin ofrecer "Operativo"', async () => {
    const user = userEvent.setup();
    await renderMaintenanceEquipment();

    await user.click(screen.getByText('Marcar fuera de servicio'));

    expect(screen.getByText('Fuera de servicio')).toBeInTheDocument();
    expect(screen.getByText('(se aplicará al guardar)')).toBeInTheDocument();
    expect(screen.queryByText('Operativo')).not.toBeInTheDocument();
  });

  it('guardar despues de marcarlo envia status OUT_OF_SERVICE', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockResolvedValueOnce({ equipment: fixtureEquipmentB });

    await renderMaintenanceEquipment();

    await user.click(screen.getByText('Marcar fuera de servicio'));
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() =>
      expect(equipmentService.update).toHaveBeenCalledWith(fixtureEquipmentB.id, {
        name: fixtureEquipmentB.name,
        category: fixtureEquipmentB.category,
        serialNumber: null,
        status: 'OUT_OF_SERVICE',
        networkNodeId: fixtureEquipmentB.networkNodeId,
        supportProviderId: null,
      }),
    );
  });

  it('la accion es reversible mientras no se guarde: vuelve a omitir status', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockResolvedValueOnce({ equipment: fixtureEquipmentB });

    await renderMaintenanceEquipment();

    await user.click(screen.getByText('Marcar fuera de servicio'));
    await user.click(screen.getByText('Mantener estado automático'));

    expect(screen.getByText('En mantenimiento')).toBeInTheDocument();

    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() =>
      expect(equipmentService.update).toHaveBeenCalledWith(fixtureEquipmentB.id, {
        name: fixtureEquipmentB.name,
        category: fixtureEquipmentB.category,
        serialNumber: null,
        networkNodeId: fixtureEquipmentB.networkNodeId,
        supportProviderId: null,
      }),
    );
  });
});

describe('EquipmentFormModal — reparto de los conflictos 409', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const NODE_CHANGE_MESSAGE =
    'No se puede cambiar el equipo de nodo mientras tiene un mantenimiento en ejecución.';
  const ACTIVE_MAINTENANCE_MESSAGE =
    'No se puede marcar el equipo como Operativo mientras tiene un mantenimiento en ejecución.';

  async function renderEditingEquipmentA() {
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: fixtureNodes });
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: [fixtureProviderA] });
    const utils = render(
      <EquipmentFormModal equipment={fixtureEquipmentA} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByPlaceholderText('Switch core')).toBeInTheDocument());
    return utils;
  }

  it('un 409 de serie duplicada se pinta bajo el campo Numero de serie, sin callout general', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockRejectedValueOnce(
      makeApiError('Equipment serial number already exists', { status: 409 }),
    );

    await renderEditingEquipmentA();
    await user.click(screen.getByText('Guardar equipo'));

    const message = await screen.findByText('Equipment serial number already exists');
    expect(message).toHaveClass('nk-field-error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el 409 por cambio de nodo durante un mantenimiento va al error general', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockRejectedValueOnce(
      makeApiError(NODE_CHANGE_MESSAGE, { status: 409 }),
    );

    const { container } = await renderEditingEquipmentA();
    await user.click(screen.getByText('Guardar equipo'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NODE_CHANGE_MESSAGE);
    expect(container.querySelector('.nk-field-error')).toBeNull();
  });

  it('el 409 por volver a Operativo con mantenimiento activo va al error general', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockRejectedValueOnce(
      makeApiError(ACTIVE_MAINTENANCE_MESSAGE, { status: 409 }),
    );

    const { container } = await renderEditingEquipmentA();
    await user.click(screen.getByText('Guardar equipo'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(ACTIVE_MAINTENANCE_MESSAGE);
    expect(container.querySelector('.nk-field-error')).toBeNull();
  });

  it('el 409 por MAINTENANCE manual tampoco se atribuye al numero de serie', async () => {
    const user = userEvent.setup();
    equipmentService.update.mockRejectedValueOnce(
      makeApiError(
        'El estado En mantenimiento lo asigna el sistema al iniciar un mantenimiento y no puede establecerse manualmente.',
        { status: 409 },
      ),
    );

    const { container } = await renderEditingEquipmentA();
    await user.click(screen.getByText('Guardar equipo'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(container.querySelector('.nk-field-error')).toBeNull();
  });
});
