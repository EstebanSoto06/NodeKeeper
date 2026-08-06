import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeFormModal } from './NodeFormModal.jsx';
import { makeApiError } from '../test/test-utils.jsx';

vi.mock('../services/networkNodeService.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
}));

import * as networkNodeService from '../services/networkNodeService.js';

describe('NodeFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
