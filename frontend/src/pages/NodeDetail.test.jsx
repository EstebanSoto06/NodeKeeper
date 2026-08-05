import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { NodeDetail } from './NodeDetail.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureNodeMaintenance, fixtureEquipmentA } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({
  getById: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
}));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn(), create: vi.fn() }));
vi.mock('../services/supportProviderService.js', () => ({ list: vi.fn() }));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import * as supportProviderService from '../services/supportProviderService.js';
import { showToast } from '../store/store.js';

// Ruta de destino "/mapa" de prueba: solo expone el query param recibido,
// sin montar el mapa real (eso ya se prueba en Map.test.jsx).
function MapaProbe() {
  const [params] = useSearchParams();
  return <div>Mapa con nodeId:{params.get('nodeId') || 'ninguno'}</div>;
}

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

  it('ADMIN ve el boton "Agregar equipo" en Equipos asociados', async () => {
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(<Routes><Route path="/nodos/:id" element={<NodeDetail />} /></Routes>, {
      authValue: adminAuthValue(),
      initialEntries: [`/nodos/${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    expect(screen.getByText('Agregar equipo')).toBeInTheDocument();
  });

  it('OPERATOR no ve el boton "Agregar equipo"', async () => {
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(<Routes><Route path="/nodos/:id" element={<NodeDetail />} /></Routes>, {
      authValue: operatorAuthValue(),
      initialEntries: [`/nodos/${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    expect(screen.queryByText('Agregar equipo')).not.toBeInTheDocument();
  });

  it('al presionar "Agregar equipo" abre el formulario con el nodo actual preseleccionado, y al guardar recarga la lista de equipos', async () => {
    const user = userEvent.setup();
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] }); // carga inicial del detalle
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] }); // select del modal
    supportProviderService.list.mockResolvedValueOnce({ supportProviders: [] });

    renderWithProviders(<Routes><Route path="/nodos/:id" element={<NodeDetail />} /></Routes>, {
      authValue: adminAuthValue(),
      initialEntries: [`/nodos/${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByText('Agregar equipo'));

    await waitFor(() =>
      expect(screen.getByDisplayValue(`${fixtureNodeAvailable.name} (${fixtureNodeAvailable.code})`)).toBeInTheDocument(),
    );

    equipmentService.create.mockResolvedValueOnce({ equipment: { id: 'equip-nuevo' } });
    equipmentService.list.mockResolvedValueOnce({ equipment: [{ ...fixtureEquipmentA, networkNodeId: fixtureNodeAvailable.id }] }); // recarga tras guardar

    await user.type(screen.getByPlaceholderText('Switch core'), 'Switch nuevo');
    await user.type(screen.getByPlaceholderText('Red'), 'Red');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() => expect(equipmentService.create).toHaveBeenCalledTimes(1));
    const [payload] = equipmentService.create.mock.calls[0];
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);

    await waitFor(() => expect(equipmentService.list).toHaveBeenCalledTimes(2));
  });

  it('el boton "Ubicar" navega a /mapa?nodeId=<id> cuando el nodo tiene coordenadas', async () => {
    const user = userEvent.setup();
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeAvailable });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(
      <Routes>
        <Route path="/nodos/:id" element={<NodeDetail />} />
        <Route path="/mapa" element={<MapaProbe />} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: [`/nodos/${fixtureNodeAvailable.id}`] },
    );

    await waitFor(() => expect(screen.getByText(fixtureNodeAvailable.name)).toBeInTheDocument());
    await user.click(screen.getByText('Ubicar'));

    expect(await screen.findByText(`Mapa con nodeId:${fixtureNodeAvailable.id}`)).toBeInTheDocument();
  });

  it('el boton "Ubicar" muestra un aviso y no navega si el nodo no tiene coordenadas', async () => {
    const user = userEvent.setup();
    networkNodeService.getById.mockResolvedValueOnce({ networkNode: fixtureNodeMaintenance });
    equipmentService.list.mockResolvedValueOnce({ equipment: [] });

    renderWithProviders(
      <Routes>
        <Route path="/nodos/:id" element={<NodeDetail />} />
        <Route path="/mapa" element={<MapaProbe />} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: [`/nodos/${fixtureNodeMaintenance.id}`] },
    );

    await waitFor(() => expect(screen.getByText(fixtureNodeMaintenance.name)).toBeInTheDocument());
    await user.click(screen.getByText('Ubicar'));

    expect(showToast).toHaveBeenCalledWith('Este nodo no tiene coordenadas registradas.', 'error');
    expect(screen.queryByText(/^Mapa con nodeId:/)).not.toBeInTheDocument();
  });
});
