import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Map } from './Map.jsx';
import { renderWithProviders, adminAuthValue } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureNodeMaintenance, fixtureEquipment } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({ map: vi.fn(), list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));

import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

const nodoSinCoordenadas = { ...fixtureNodeMaintenance, id: 'node-sin-coords', name: 'Nodo sin coordenadas', latitude: null, longitude: null };

describe('Map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra un nodo con coordenadas como marcador y permite ver su detalle al seleccionarlo', async () => {
    const user = userEvent.setup();
    networkNodeService.map.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    equipmentService.list.mockResolvedValueOnce({ equipment: fixtureEquipment });

    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByTitle(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByTitle(fixtureNodeAvailable.name));

    expect(screen.getAllByText(fixtureNodeAvailable.name).length).toBeGreaterThan(0);
    expect(screen.getByText('Ver detalle del nodo')).toBeInTheDocument();
  });

  it('un nodo sin coordenadas no aparece como marcador y se contabiliza aparte', async () => {
    networkNodeService.map.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, nodoSinCoordenadas] });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByTitle(fixtureNodeAvailable.name)).toBeInTheDocument());
    expect(screen.queryByTitle(nodoSinCoordenadas.name)).not.toBeInTheDocument();
    expect(screen.getByText(/1 sin coordenadas/)).toBeInTheDocument();
  });

  it('navega al detalle real del nodo seleccionado', async () => {
    const user = userEvent.setup();
    networkNodeService.map.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(
      <Routes>
        <Route path="/mapa" element={<Map />} />
        <Route path="/nodos/:id" element={<div>Detalle del nodo real</div>} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: ['/mapa'] },
    );

    await waitFor(() => expect(screen.getByTitle(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByTitle(fixtureNodeAvailable.name));
    await user.click(screen.getByText('Ver detalle del nodo'));

    expect(screen.getByText('Detalle del nodo real')).toBeInTheDocument();
  });
});
