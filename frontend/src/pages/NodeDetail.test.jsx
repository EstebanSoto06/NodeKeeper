import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { NodeDetail } from './NodeDetail.jsx';
import { renderWithProviders, adminAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureEquipmentA } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({
  getById: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

describe('NodeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advierte que los equipos asociados tambien se eliminaran al borrar el nodo', async () => {
    const user = userEvent.setup();
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [fixtureEquipmentA] });

    renderWithProviders(<Routes><Route path="/nodos/:id" element={<NodeDetail />} /></Routes>, {
      authValue: adminAuthValue(),
      initialEntries: [`/nodos/${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByText('Eliminar'));

    expect(screen.getByText(/1 equipo asociado que también se eliminará/)).toBeInTheDocument();
  });

  it('sin equipos asociados, el mensaje de eliminacion no menciona equipos', async () => {
    const user = userEvent.setup();
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(<Routes><Route path="/nodos/:id" element={<NodeDetail />} /></Routes>, {
      authValue: adminAuthValue(),
      initialEntries: [`/nodos/${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByText('Eliminar'));

    expect(screen.queryByText(/equipo asociado/)).not.toBeInTheDocument();
    expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeInTheDocument();
  });

  it('ante un 409 por historial de mantenimiento, muestra el mensaje real, no navega y conserva la vista', async () => {
    const user = userEvent.setup();
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });
    networkNodeService.remove.mockRejectedValueOnce(
      makeApiError(
        'No se puede eliminar el nodo porque posee historial de mantenimiento directo o mediante sus equipos.',
        { status: 409 },
      ),
    );

    renderWithProviders(<Routes><Route path="/nodos/:id" element={<NodeDetail />} /></Routes>, {
      authValue: adminAuthValue(),
      initialEntries: [`/nodos/${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByText('Eliminar'));
    await user.click(screen.getByRole('button', { name: 'Eliminar nodo' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se puede eliminar el nodo porque posee historial de mantenimiento directo o mediante sus equipos.',
        ),
      ).toBeInTheDocument(),
    );

    // Sin navegacion optimista: el nodo sigue mostrandose en la misma vista.
    expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument();
    expect(networkNodeService.remove).toHaveBeenCalledTimes(1);
  });
});
