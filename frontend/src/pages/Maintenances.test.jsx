import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Maintenances } from './Maintenances.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';
import { fixtureMaintenanceScheduled, fixtureMaintenanceInProgress } from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ list: vi.fn(), remove: vi.fn() }));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';

describe('Maintenances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra el listado real', async () => {
    maintenanceService.list.mockResolvedValueOnce({
      maintenances: [fixtureMaintenanceScheduled, fixtureMaintenanceInProgress],
    });
    renderWithProviders(<Maintenances />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument());
    expect(screen.getByText(fixtureMaintenanceInProgress.title)).toBeInTheDocument();
  });

  it('filtra por tipo (Preventivo / Correctivo)', async () => {
    const user = userEvent.setup();
    maintenanceService.list.mockResolvedValueOnce({
      maintenances: [fixtureMaintenanceScheduled, fixtureMaintenanceInProgress],
    });
    renderWithProviders(<Maintenances />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Preventivo' }));

    expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument();
    expect(screen.queryByText(fixtureMaintenanceInProgress.title)).not.toBeInTheDocument();
  });

  it('ADMIN ve "Nuevo mantenimiento" y el boton eliminar; OPERATOR no ve ninguno', async () => {
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [fixtureMaintenanceScheduled] });
    renderWithProviders(<Maintenances />, { authValue: adminAuthValue() });
    await waitFor(() => expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument());
    expect(screen.getByText('Nuevo mantenimiento')).toBeInTheDocument();
    expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
  });

  it('OPERATOR no ve acciones de escritura en el listado', async () => {
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [fixtureMaintenanceScheduled] });
    renderWithProviders(<Maintenances />, { authValue: operatorAuthValue() });
    await waitFor(() => expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument());
    expect(screen.queryByText('Nuevo mantenimiento')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });
});
