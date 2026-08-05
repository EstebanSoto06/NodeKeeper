import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NodeMap } from './NodeMap.jsx';
import { fixtureNodeAvailable } from '../../test/fixtures.js';

// Mock controlado de react-leaflet: expone setView/fitBounds como spies
// compartidos (misma instancia en cada useMap()) para poder verificar hacia
// donde se movio el mapa. No se mockea 'leaflet' (L.divIcon no toca el DOM).
const setViewMock = vi.fn();
const fitBoundsMock = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({ setView: setViewMock, fitBounds: fitBoundsMock }),
  useMapEvents: () => null,
}));

const noop = () => {};

describe('NodeMap — focusNodeId', () => {
  beforeEach(() => {
    setViewMock.mockClear();
    fitBoundsMock.mockClear();
  });

  it('con un focusNodeId valido, centra el mapa en sus coordenadas con zoom 16', () => {
    render(
      <NodeMap
        nodes={[fixtureNodeAvailable]}
        selectedId={null}
        onSelectNode={noop}
        onViewDetail={noop}
        tempMarker={null}
        onMapClick={noop}
        focusNodeId={fixtureNodeAvailable.id}
      />,
    );

    expect(setViewMock).toHaveBeenCalledWith(
      [fixtureNodeAvailable.latitude, fixtureNodeAvailable.longitude],
      16,
    );
  });

  it('con un focusNodeId que no existe entre los nodos recibidos, no rompe y no fuerza el centrado de foco', () => {
    expect(() =>
      render(
        <NodeMap
          nodes={[fixtureNodeAvailable]}
          selectedId={null}
          onSelectNode={noop}
          onViewDetail={noop}
          tempMarker={null}
          onMapClick={noop}
          focusNodeId="nodo-inexistente"
        />,
      ),
    ).not.toThrow();

    // FitBounds si centra en el unico nodo cargado (zoom 13); lo que importa
    // aqui es que NUNCA se dispare el zoom de foco (16), es decir que
    // <FocusNode> nunca se monta para un id que no existe en `nodes`.
    expect(setViewMock).not.toHaveBeenCalledWith(expect.anything(), 16);
  });

  it('sin focusNodeId, conserva el comportamiento de encuadre automatico (fitBounds/fallback)', () => {
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
    expect(setViewMock).not.toHaveBeenCalledWith(expect.anything(), 16);
  });
});
