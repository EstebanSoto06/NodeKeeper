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
});
