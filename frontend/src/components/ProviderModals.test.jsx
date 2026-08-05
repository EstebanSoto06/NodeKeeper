import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderFormModal } from './ProviderModals.jsx';

vi.mock('../services/supportProviderService.js', () => ({ create: vi.fn(), update: vi.fn() }));

import * as supportProviderService from '../services/supportProviderService.js';

describe('ProviderFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin datos obligatorios: muestra el callout con todos los campos faltantes y no llama a create', async () => {
    const user = userEvent.setup();
    render(<ProviderFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Guardar proveedor'));

    expect(screen.getByText(
      'Faltan datos obligatorios: Nombre de empresa, Número de soporte, Correo de soporte, Persona de contacto, Número de contacto, Correo de contacto.',
    )).toBeInTheDocument();
    expect(supportProviderService.create).not.toHaveBeenCalled();
  });

  it('con todos los campos completos, llama a create', async () => {
    const user = userEvent.setup();
    supportProviderService.create.mockResolvedValueOnce({ supportProvider: { id: 'p1' } });
    render(<ProviderFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Soporte Técnico del Norte'), 'Proveedor de prueba');
    await user.type(screen.getByPlaceholderText('800-555-0101'), '800-555-9999');
    await user.type(screen.getByPlaceholderText('soporte@empresa.example'), 'soporte@prueba.test');
    await user.type(screen.getByPlaceholderText('Carlos Rodríguez'), 'Persona Prueba');
    await user.type(screen.getByPlaceholderText('8888-1111'), '8888-2222');
    await user.type(screen.getByPlaceholderText('carlos.rodriguez@empresa.example'), 'contacto@prueba.test');
    await user.click(screen.getByText('Guardar proveedor'));

    await waitFor(() => expect(supportProviderService.create).toHaveBeenCalledTimes(1));
  });
});
