import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Map } from './Map.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureNodeMaintenance, fixtureEquipment } from '../test/fixtures.js';

vi.mock('../services/networkNodeService.js', () => ({ map: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

// react-leaflet necesita medidas reales del DOM (getBoundingClientRect, etc.)
// que jsdom no provee; se mockea solo la capa de renderizado del mapa
// (MapContainer/TileLayer/Marker/Popup/useMap/useMapEvents), NO 'leaflet' en
// si (L.divIcon/L.latLngBounds no tocan el DOM y corren igual que en real).
// El click "vacio" del mapa se simula clickeando el propio contenedor
// mockeado; useMapEvents guarda el handler real de NodeMap.jsx para poder
// dispararlo con una coordenada fija y predecible.
// setView/fitBounds/invalidateSize son instancias COMPARTIDAS (no una nueva
// por llamada a useMap()) para poder verificar hacia donde se movio el mapa
// desde las pruebas; whenReady se resuelve sincronicamente.
const setViewMock = vi.fn();
const fitBoundsMock = vi.fn();
const invalidateSizeMock = vi.fn();

vi.mock('react-leaflet', () => {
  let clickHandler = null;
  return {
    MapContainer: ({ children }) => (
      <div
        data-testid="map-container"
        onClick={() => clickHandler && clickHandler({ latlng: { lat: 10.5, lng: -84.5 } })}
      >
        {children}
      </div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ eventHandlers, children, title }) => (
      <div
        data-testid="marker"
        title={title}
        onClick={(e) => { e.stopPropagation(); eventHandlers?.click?.(e); }}
      >
        {children}
      </div>
    ),
    Popup: ({ children }) => <div>{children}</div>,
    useMap: () => ({
      setView: setViewMock,
      fitBounds: fitBoundsMock,
      invalidateSize: invalidateSizeMock,
      whenReady: (cb) => cb(),
    }),
    useMapEvents: (handlers) => { clickHandler = handlers.click; return null; },
  };
});

import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import { showToast } from '../store/store.js';

const nodoSinCoordenadas = { ...fixtureNodeMaintenance, id: 'node-sin-coords', name: 'Nodo sin coordenadas', latitude: null, longitude: null };

function mockLoad({ nodes = [fixtureNodeAvailable], allNodes = nodes, equip = fixtureEquipment } = {}) {
  networkNodeService.map.mockResolvedValueOnce({ networkNodes: nodes });
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: allNodes });
  equipmentService.list.mockResolvedValueOnce({ equipment: equip });
}

// Expone la ruta actual (pathname + query) junto al mapa, para poder
// verificar que la creacion de un nodo actualiza la URL a ?nodeId=<id>.
function MapWithLocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-probe">{location.pathname}{location.search}</div>
      <Map />
    </>
  );
}

describe('Map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El foco puntual programa el setView un frame despues (ver
    // MapViewportController en NodeMap.jsx); se resuelve sincronicamente
    // para no depender de temporizadores reales en las pruebas.
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 0; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renderiza el mapa real (Leaflet) con los nodos cargados como marcadores', async () => {
    mockLoad();
    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
    expect(screen.getByTitle(fixtureNodeAvailable.name)).toBeInTheDocument();
  });

  it('muestra el contador de nodos con y sin coordenadas', async () => {
    mockLoad({ nodes: [fixtureNodeAvailable], allNodes: [fixtureNodeAvailable, nodoSinCoordenadas], equip: [] });
    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByTitle(fixtureNodeAvailable.name)).toBeInTheDocument());
    expect(screen.queryByTitle(nodoSinCoordenadas.name)).not.toBeInTheDocument();
    expect(screen.getByText(/1 nodos con coordenadas/)).toBeInTheDocument();
    expect(screen.getByText(/1 sin coordenadas/)).toBeInTheDocument();
  });

  it('al seleccionar un marcador existente, muestra su informacion y permite ir al detalle', async () => {
    const user = userEvent.setup();
    mockLoad();
    renderWithProviders(
      <Routes>
        <Route path="/mapa" element={<Map />} />
        <Route path="/nodos/:id" element={<div>Detalle del nodo real</div>} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: ['/mapa'] },
    );

    await user.click(await screen.findByTitle(fixtureNodeAvailable.name));

    expect(screen.getAllByText(fixtureNodeAvailable.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fixtureNodeAvailable.code).length).toBeGreaterThan(0);

    await user.click(screen.getAllByText('Ver detalle del nodo')[0]);
    expect(screen.getByText('Detalle del nodo real')).toBeInTheDocument();
  });

  it('al llegar con ?nodeId=<id> (boton "Ubicar" de NodeDetail) centra el mapa en el nodo y lo selecciona', async () => {
    mockLoad();
    renderWithProviders(<Map />, {
      authValue: adminAuthValue(),
      initialEntries: [`/mapa?nodeId=${fixtureNodeAvailable.id}`],
    });

    await waitFor(() => expect(screen.getAllByText(fixtureNodeAvailable.name).length).toBeGreaterThan(0));
    expect(screen.getAllByText(fixtureNodeAvailable.code).length).toBeGreaterThan(0);

    // El foco debe centrar y hacer zoom (16) sobre las coordenadas reales del
    // nodo, no solo actualizar el panel lateral — esto es justamente lo que
    // fallaba en el navegador real antes de este fix.
    await waitFor(() => expect(setViewMock).toHaveBeenCalledWith(
      [fixtureNodeAvailable.latitude, fixtureNodeAvailable.longitude],
      16,
      { animate: true, duration: 0.4 },
    ));
  });

  it('si el ?nodeId de la URL no existe entre los nodos con coordenadas, no rompe el mapa ni selecciona/centra nada', async () => {
    mockLoad();
    renderWithProviders(<Map />, {
      authValue: adminAuthValue(),
      initialEntries: ['/mapa?nodeId=nodo-inexistente'],
    });

    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText('Selecciona un nodo')).toBeInTheDocument();
    expect(setViewMock).not.toHaveBeenCalledWith(expect.anything(), 16, expect.anything());
  });

  it('ADMIN: al hacer click en un punto vacio del mapa, abre el formulario de creacion con lat/lng prellenadas', async () => {
    const user = userEvent.setup();
    mockLoad();
    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await screen.findByTestId('map-container');
    await user.click(screen.getByTestId('map-container'));

    expect(await screen.findByText('Crear nodo en esta ubicación')).toBeInTheDocument();
    expect(screen.getByText('10.500000')).toBeInTheDocument();
    expect(screen.getByText('-84.500000')).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('ADMIN: al guardar el formulario del mapa, llama a create con el payload correcto, cierra el modal, limpia el marcador temporal, actualiza la URL y centra el nodo recien creado', async () => {
    const user = userEvent.setup();
    mockLoad();
    const created = { ...fixtureNodeAvailable, id: 'node-nuevo', latitude: 10.5, longitude: -84.5 };
    networkNodeService.create.mockResolvedValueOnce({ networkNode: created });
    // El reload de /network-nodes/map termina, pero (por ejemplo, eventual
    // consistency) TODAVIA no incluye al nodo recien creado: el centrado
    // debe depender de createdFocusNode, no de los datos recargados.
    networkNodeService.map.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });

    renderWithProviders(<MapWithLocationProbe />, { authValue: adminAuthValue(), initialEntries: ['/mapa'] });

    await screen.findByTestId('map-container');
    await user.click(screen.getByTestId('map-container'));
    await screen.findByText('Crear nodo en esta ubicación');
    expect(screen.getAllByTestId('marker')).toHaveLength(2); // nodo existente + marcador temporal

    await user.type(screen.getByPlaceholderText('NODO-014'), 'NODO-MAPA-01');
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), 'Nodo creado desde el mapa');
    await user.click(screen.getByText('Crear nodo aquí'));

    await waitFor(() => expect(networkNodeService.create).toHaveBeenCalledTimes(1));
    expect(networkNodeService.create).toHaveBeenCalledWith({
      code: 'NODO-MAPA-01',
      name: 'Nodo creado desde el mapa',
      location: null,
      status: 'AVAILABLE',
      latitude: 10.5,
      longitude: -84.5,
    });

    // Modal cerrado y marcador temporal limpiado; una vez el reload
    // termina (con datos que aun no incluyen al nodo nuevo), solo queda el
    // marcador del nodo existente.
    await waitFor(() => expect(screen.queryByText('Crear nodo en esta ubicación')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId('marker')).toHaveLength(1));

    // URL actualizada al nodo recien creado.
    await waitFor(() => expect(screen.getByTestId('location-probe')).toHaveTextContent(`/mapa?nodeId=${created.id}`));

    // Centrado/zoom (16) sobre el nodo recien creado via createdFocusNode.
    await waitFor(() => expect(setViewMock).toHaveBeenCalledWith(
      [created.latitude, created.longitude],
      16,
      { animate: true, duration: 0.4 },
    ));
  });

  it('ADMIN: una vez el reload trae al nodo recien creado, el panel lateral y su marcador lo muestran', async () => {
    const user = userEvent.setup();
    mockLoad();
    const created = { ...fixtureNodeAvailable, id: 'node-nuevo', name: 'Nodo Nuevo Desde Mapa', code: 'NODO-MAPA-01', latitude: 10.5, longitude: -84.5 };
    networkNodeService.create.mockResolvedValueOnce({ networkNode: created });
    networkNodeService.map.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, created] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, created] });

    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await screen.findByTestId('map-container');
    await user.click(screen.getByTestId('map-container'));
    await screen.findByText('Crear nodo en esta ubicación');
    await user.type(screen.getByPlaceholderText('NODO-014'), created.code);
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), created.name);
    await user.click(screen.getByText('Crear nodo aquí'));

    await waitFor(() => expect(screen.getByTitle(created.name)).toBeInTheDocument());
    expect(screen.getAllByText(created.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(created.code).length).toBeGreaterThan(0);
  });

  it('si el estado del nodo recien creado estaba oculto por un filtro de la leyenda, se revela automaticamente', async () => {
    const user = userEvent.setup();
    mockLoad();
    const created = { ...fixtureNodeAvailable, id: 'node-nuevo', status: 'OUT_OF_SERVICE', latitude: 10.5, longitude: -84.5 };
    networkNodeService.create.mockResolvedValueOnce({ networkNode: created });
    networkNodeService.map.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, created] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable, created] });

    const { container } = renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await screen.findByTitle(fixtureNodeAvailable.name);
    // Acotado a la leyenda: una vez creado el nodo OUT_OF_SERVICE, su Popup
    // tambien muestra el texto "Fuera de servicio" (StatusBadge), asi que
    // buscarlo en toda la pagina seria ambiguo. Se re-consulta en vivo (no
    // se cachea el nodo) porque el reload dispara un mapLoading intermedio
    // que reemplaza el subarbol del mapa (incluida la leyenda) por uno
    // nuevo: una referencia capturada antes quedaria apuntando al nodo
    // DOM viejo, ya desmontado.
    const legendToggle = () => within(container.querySelector('.nk-map-legend')).getByText('Fuera de servicio').closest('button');

    // Oculta "Fuera de servicio" en la leyenda ANTES de crear el nodo.
    await user.click(legendToggle());
    expect(legendToggle()).toHaveClass('is-off');

    await user.click(screen.getByTestId('map-container'));
    await screen.findByText('Crear nodo en esta ubicación');
    await user.type(screen.getByPlaceholderText('NODO-014'), 'NODO-MAPA-03');
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), 'Nodo fuera de servicio');
    await user.click(screen.getByText('Crear nodo aquí'));

    await waitFor(() => expect(networkNodeService.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(legendToggle()).not.toHaveClass('is-off'));
  });

  it('OPERATOR: al hacer click en el mapa, no abre el formulario de creacion y muestra un aviso de solo lectura', async () => {
    const user = userEvent.setup();
    mockLoad();
    renderWithProviders(<Map />, { authValue: operatorAuthValue() });

    await screen.findByTestId('map-container');
    await user.click(screen.getByTestId('map-container'));

    expect(screen.queryByText('Crear nodo en esta ubicación')).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Solo un administrador puede crear nodos desde el mapa.', 'error');
    expect(networkNodeService.create).not.toHaveBeenCalled();
  });

  it('OPERATOR: puede ver el mapa y seleccionar marcadores existentes', async () => {
    const user = userEvent.setup();
    mockLoad();
    renderWithProviders(<Map />, { authValue: operatorAuthValue() });

    await user.click(await screen.findByTitle(fixtureNodeAvailable.name));
    expect(screen.getAllByText(fixtureNodeAvailable.name).length).toBeGreaterThan(0);
  });

  it('maneja el error del backend al crear un nodo desde el mapa (p. ej. codigo duplicado)', async () => {
    const user = userEvent.setup();
    mockLoad();
    networkNodeService.create.mockRejectedValueOnce(makeApiError('Network node code already exists', { status: 409 }));

    renderWithProviders(<Map />, { authValue: adminAuthValue() });

    await screen.findByTestId('map-container');
    await user.click(screen.getByTestId('map-container'));
    await screen.findByText('Crear nodo en esta ubicación');

    await user.type(screen.getByPlaceholderText('NODO-014'), 'NODO-DUP');
    await user.type(screen.getByPlaceholderText('Subestación San Isidro'), 'Nodo repetido');
    await user.click(screen.getByText('Crear nodo aquí'));

    await waitFor(() => expect(screen.getByText('Network node code already exists')).toBeInTheDocument());
    expect(screen.getByText('Crear nodo en esta ubicación')).toBeInTheDocument();
  });
});
