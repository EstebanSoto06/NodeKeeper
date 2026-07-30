import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from './Providers.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureProviders } from '../test/fixtures.js';

vi.mock('../services/supportProviderService.js', () => ({
  list: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as supportProviderService from '../services/supportProviderService.js';

describe('Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra el listado real', async () => {
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: fixtureProviders });
    renderWithProviders(<Providers />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureProviders[0].companyName)).toBeInTheDocument());
    expect(screen.getByText(fixtureProviders[1].companyName)).toBeInTheDocument();
  });

  it('muestra ErrorState con reintento si la carga falla', async () => {
    supportProviderService.list.mockRejectedValueOnce(makeApiError('Fallo de red', { status: 0 }));
    renderWithProviders(<Providers />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('muestra EmptyState cuando no hay proveedores', async () => {
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: [] });
    renderWithProviders(<Providers />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText('Sin proveedores')).toBeInTheDocument());
  });

  it('ADMIN ve "Crear proveedor" y puede abrir el formulario', async () => {
    const user = userEvent.setup();
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: fixtureProviders });
    renderWithProviders(<Providers />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureProviders[0].companyName)).toBeInTheDocument());

    const createButton = screen.getByText('Crear proveedor');
    await user.click(createButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('OPERATOR no ve acciones de escritura, solo la insignia "Solo lectura"', async () => {
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: fixtureProviders });
    renderWithProviders(<Providers />, { authValue: operatorAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureProviders[0].companyName)).toBeInTheDocument());

    expect(screen.queryByText('Crear proveedor')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
  });

  it('ADMIN elimina un proveedor con ConfirmDialog y refresca el listado', async () => {
    const user = userEvent.setup();
    supportProviderService.list
      .mockResolvedValueOnce({ supportProviders: fixtureProviders })
      .mockResolvedValueOnce({ supportProviders: [fixtureProviders[1]] });
    supportProviderService.remove.mockResolvedValueOnce(null);

    renderWithProviders(<Providers />, { authValue: adminAuthValue() });
    await waitFor(() => expect(screen.getByText(fixtureProviders[0].companyName)).toBeInTheDocument());

    const deleteButtons = screen.getAllByTitle('Eliminar');
    await user.click(deleteButtons[0]);

    expect(screen.getByRole('heading', { name: 'Eliminar proveedor' })).toBeInTheDocument();
    expect(screen.getByText(/No asignado/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar proveedor' }));

    await waitFor(() => expect(supportProviderService.remove).toHaveBeenCalledWith(fixtureProviders[0].id));
    await waitFor(() => expect(supportProviderService.list).toHaveBeenCalledTimes(2));
  });
});
