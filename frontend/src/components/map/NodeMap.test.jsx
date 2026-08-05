import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NodeMap } from './NodeMap.jsx';
import { fixtureNodeAvailable } from '../../test/fixtures.js';

// Mock controlado de react-leaflet: expone setView/fitBounds/invalidateSize
// como spies compartidos (misma instancia en cada useMap()) para poder
// verificar hacia donde se movio el mapa; whenReady se resuelve
// sincronicamente (como si el mapa ya estuviera listo). No se mockea
// 'leaflet' (L.divIcon no toca el DOM).
const setViewMock = vi.fn();
const fitBoundsMock = vi.fn();
const invalidateSizeMock = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    setView: setViewMock,
    fitBounds: fitBoundsMock,
    invalidateSize: invalidateSizeMock,
    whenReady: (cb) => cb(),
  }),
  useMapEvents: () => null,
}));

const noop = () => {};
const otroNodo = { ...fixtureNodeAvailable, id: 'node-fixture-otro', latitude: 9.9, longitude: -83.9 };

describe('NodeMap — MapViewportController (foco/encuadre)', () => {
  beforeEach(() => {
    setViewMock.mockClear();
    fitBoundsMock.mockClear();
    invalidateSizeMock.mockClear();
    // El foco puntual programa el setView un frame despues; se resuelve
    // sincronicamente para no depender de temporizadores reales.
    vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 0; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con un focusNode valido, invalida el tamano y centra el mapa en sus coordenadas con zoom 16', () => {
    render(
      <NodeMap
        nodes={[fixtureNodeAvailable]}
        selectedId={null}
        onSelectNode={noop}
        onViewDetail={noop}
        tempMarker={null}
        onMapClick={noop}
        focusNode={fixtureNodeAvailable}
      />,
    );

    expect(invalidateSizeMock).toHaveBeenCalled();
    expect(setViewMock).toHaveBeenCalledWith(
      [fixtureNodeAvailable.latitude, fixtureNodeAvailable.longitude],
      16,
      { animate: true, duration: 0.4 },
    );
  });

  it('el foco prevalece sobre fitBounds cuando hay mas de un nodo cargado', () => {
    render(
      <NodeMap
        nodes={[fixtureNodeAvailable, otroNodo]}
        selectedId={null}
        onSelectNode={noop}
        onViewDetail={noop}
        tempMarker={null}
        onMapClick={noop}
        focusNode={fixtureNodeAvailable}
      />,
    );

    expect(fitBoundsMock).not.toHaveBeenCalled();
    expect(setViewMock).toHaveBeenCalledWith(
      [fixtureNodeAvailable.latitude, fixtureNodeAvailable.longitude],
      16,
      { animate: true, duration: 0.4 },
    );
  });

  it('sin focusNode, conserva el encuadre automatico normal (fitBounds con 2+ nodos)', () => {
    render(
      <NodeMap
        nodes={[fixtureNodeAvailable, otroNodo]}
        selectedId={null}
        onSelectNode={noop}
        onViewDetail={noop}
        tempMarker={null}
        onMapClick={noop}
      />,
    );

    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
    expect(setViewMock).not.toHaveBeenCalledWith(expect.anything(), 16, expect.anything());
  });

  it('con focusNode explicitamente null, no rompe y aplica el encuadre normal (no el zoom de foco)', () => {
    expect(() =>
      render(
        <NodeMap
          nodes={[fixtureNodeAvailable]}
          selectedId={null}
          onSelectNode={noop}
          onViewDetail={noop}
          tempMarker={null}
          onMapClick={noop}
          focusNode={null}
        />,
      ),
    ).not.toThrow();

    // Un solo nodo cargado y sin foco -> se centra en el, pero con el zoom
    // de "punto unico" (13), nunca con el zoom de foco (16).
    expect(setViewMock).toHaveBeenCalledWith([fixtureNodeAvailable.latitude, fixtureNodeAvailable.longitude], 13);
    expect(setViewMock).not.toHaveBeenCalledWith(expect.anything(), 16, expect.anything());
  });

  it('sin focusNode y sin nodos, usa el fallback de Costa Rica', () => {
    render(
      <NodeMap
        nodes={[]}
        selectedId={null}
        onSelectNode={noop}
        onViewDetail={noop}
        tempMarker={null}
        onMapClick={noop}
      />,
    );

    expect(setViewMock).toHaveBeenCalledWith([10.327, -84.427], 10);
  });
});
