import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Dashboard } from './Dashboard.jsx';
import { renderWithProviders, adminAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureNodeMaintenance, fixtureEquipment, fixtureMaintenances } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));
vi.mock('../services/maintenanceService.js', () => ({ list: vi.fn() }));

import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import * as maintenanceService from '../services/maintenanceService.js';

function kpiValue(label) {
  const labelEl = screen.getByText(label);
  const card = labelEl.closest('.nk-kpi');
  return card.querySelector('.num').textContent;
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula los KPIs a partir de los datos reales (fixtures)', async () => {
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, fixtureNodeMaintenance] });
    equipmentService.list.mockResolvedValueOnce({ equipment: fixtureEquipment });
    maintenanceService.list.mockResolvedValueOnce({ maintenances: fixtureMaintenances });

    renderWithProviders(<Dashboard />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText('Total de nodos')).toBeInTheDocument());

    expect(kpiValue('Total de nodos')).toBe('2');
    expect(kpiValue('Nodos disponibles')).toBe('1');
    expect(kpiValue('Nodos en mantenimiento')).toBe('1');
    expect(kpiValue('Total de equipos')).toBe(String(fixtureEquipment.length));
    expect(kpiValue('Mantenimientos programados')).toBe('1');
    expect(kpiValue('Mantenimientos en progreso')).toBe('1');
    expect(kpiValue('Mantenimientos completados')).toBe('1');
  });

  it('si una de las tres fuentes falla, las otras dos se muestran igual (respuesta parcial)', async () => {
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    equipmentService.list.mockRejectedValueOnce(makeApiError('Fallo equipos', { status: 500 }));
    maintenanceService.list.mockResolvedValueOnce({ maintenances: fixtureMaintenances });

    renderWithProviders(<Dashboard />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText('Total de nodos')).toBeInTheDocument());
    expect(kpiValue('Total de nodos')).toBe('1');
    expect(kpiValue('Mantenimientos programados')).toBe('1');
    expect(screen.getByText(/no se pudo/i)).toBeInTheDocument();
  });

  it('el enlace "Ver mapa" navega a /mapa', async () => {
    const user = userEvent.setup();
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [] });

    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mapa" element={<div>Pagina de mapa</div>} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: ['/dashboard'] },
    );

    await waitFor(() => expect(screen.getByText('Ver mapa')).toBeInTheDocument());
    await user.click(screen.getByText('Ver mapa'));

    expect(screen.getByText('Pagina de mapa')).toBeInTheDocument();
  });
});
