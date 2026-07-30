import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { Nodes } from './Nodes.jsx';
import { renderWithProviders, adminAuthValue } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureNodeMaintenance } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

import * as networkNodeService from '../services/networkNodeService.js';

describe('Nodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra el listado real de nodos', async () => {
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, fixtureNodeMaintenance] });
    renderWithProviders(<Nodes />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    expect(screen.getByText(fixtureNodeMaintenance.name)).toBeInTheDocument();
  });

  it('filtra por estado usando los chips reales del enum', async () => {
    const user = userEvent.setup();
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, fixtureNodeMaintenance] });
    renderWithProviders(<Nodes />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'En mantenimiento' }));

    expect(screen.queryByText(fixtureNodeAvailable.name)).not.toBeInTheDocument();
    expect(screen.getByText(fixtureNodeMaintenance.name)).toBeInTheDocument();
  });

  it('navega al detalle real al hacer click en una fila', async () => {
    const user = userEvent.setup();
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });

    renderWithProviders(
      <Routes>
        <Route path="/nodos" element={<Nodes />} />
        <Route path="/nodos/:id" element={<div>Detalle de {fixtureNodeAvailable.name}</div>} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: ['/nodos'] },
    );

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByText(fixtureNodeAvailable.name));

    expect(screen.getByText(`Detalle de ${fixtureNodeAvailable.name}`)).toBeInTheDocument();
  });

  it('muestra EmptyState cuando el filtro no coincide con ningun nodo', async () => {
    const user = userEvent.setup();
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    renderWithProviders(<Nodes />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Fuera de servicio' }));

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });
});
