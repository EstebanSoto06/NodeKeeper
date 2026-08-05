/* Mapa real (Leaflet + OpenStreetMap) de nodos de red. Renderiza marcadores
   por latitud/longitud real, coloreados segun estado, y notifica al
   componente padre los clicks de marcador (seleccion) y los clicks en un
   punto vacio del mapa (creacion) — este archivo no conoce roles ni rutas,
   esa logica vive en pages/Map.jsx. */
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '../Button.jsx';
import { StatusBadge } from '../StatusBadge.jsx';
import { resolveStatus } from '../../utils/statusMaps.js';

const FALLBACK_CENTER = [10.327, -84.427];
const FALLBACK_ZOOM = 10;
const SINGLE_POINT_ZOOM = 13;
const FOCUS_ZOOM = 16;

function statusIcon(status, isActive) {
  const cfg = resolveStatus('node', status);
  return L.divIcon({
    className: 'nk-leaflet-marker',
    html: `<span class="nk-leaflet-pin${isActive ? ' is-active' : ''}" style="background:${cfg.solid}"><span class="nk-leaflet-pin-dot"></span></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

const TEMP_ICON = L.divIcon({
  className: 'nk-leaflet-marker',
  html: '<span class="nk-leaflet-pin nk-leaflet-pin--temp"><span class="nk-leaflet-pin-dot"></span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});

// Controlador unico del viewport (reemplaza los antiguos FitBounds +
// FocusNode separados: dos efectos independientes compitiendo por
// map.setView en el mismo commit resultaba fragil en el navegador real —
// las pruebas con react-leaflet mockeado no lo detectaban porque el mock no
// reproduce los tiempos reales de Leaflet). Un unico efecto decide, en
// orden de prioridad, que vista aplicar:
//   1. foco puntual (?nodeId= desde NodeDetail "Ubicar"), si hay uno;
//   2. si no, el encuadre normal (fallback / punto unico / fitBounds).
// map.whenReady() asegura que el mapa ya tiene tamano/posicion calculados
// antes de tocar la vista; invalidateSize() lo fuerza a releer su
// contenedor (util si el layout cambio despues del primer render); el
// requestAnimationFrame adicional del foco le da un frame de margen a
// Leaflet antes de saltar a un zoom alto puntual.
function MapViewportController({ points, focusNode }) {
  const map = useMap();

  const pointsKey = points.map((p) => p.join(',')).join('|');
  const focusKey = focusNode ? `${focusNode.id}:${focusNode.latitude}:${focusNode.longitude}` : '';

  useEffect(() => {
    map.whenReady(() => {
      map.invalidateSize();

      if (focusNode) {
        const target = [Number(focusNode.latitude), Number(focusNode.longitude)];
        requestAnimationFrame(() => {
          map.setView(target, FOCUS_ZOOM, { animate: true, duration: 0.4 });
        });
        return;
      }

      if (points.length === 0) {
        map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
      } else if (points.length === 1) {
        map.setView(points[0], SINGLE_POINT_ZOOM);
      } else {
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointsKey, focusKey]);

  return null;
}

// Captura clicks en un punto vacio del mapa (sin tocar un marcador) y los
// reporta al padre; no renderiza nada visible.
function ClickCapture({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (!onMapClick) return;
      // La longitud de Leaflet puede salir de +-180 si el mapa se arrastro
      // "dando la vuelta al mundo"; se normaliza antes de reportarla, ya que
      // el backend valida ese rango (ver network-node.schema.js).
      const lat = Math.max(-90, Math.min(90, e.latlng.lat));
      const lng = ((e.latlng.lng + 180) % 360 + 360) % 360 - 180;
      onMapClick(lat, lng);
    },
  });
  return null;
}

export function NodeMap({ nodes, selectedId, onSelectNode, onViewDetail, tempMarker, onMapClick, focusNode }) {
  const points = useMemo(() => {
    const nodePoints = nodes.map((n) => [n.latitude, n.longitude]);
    return tempMarker ? [...nodePoints, [tempMarker.lat, tempMarker.lng]] : nodePoints;
  }, [nodes, tempMarker]);

  return (
    <MapContainer center={FALLBACK_CENTER} zoom={FALLBACK_ZOOM} className="nk-leaflet-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewportController points={points} focusNode={focusNode} />
      <ClickCapture onMapClick={onMapClick} />

      {nodes.map((n) => (
        <Marker
          key={n.id}
          position={[n.latitude, n.longitude]}
          icon={statusIcon(n.status, n.id === selectedId)}
          title={n.name}
          eventHandlers={{ click: () => onSelectNode(n.id) }}
        >
          <Popup>
            <div className="nk-leaflet-popup">
              <strong>{n.name}</strong>
              <div className="nk-mono" style={{ fontSize: 12 }}>{n.code}</div>
              <div style={{ fontSize: 13 }}>{n.location || 'Sin ubicación registrada'}</div>
              <div style={{ margin: '6px 0' }}><StatusBadge kind="node" value={n.status} /></div>
              <div className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                {n.latitude.toFixed(6)}, {n.longitude.toFixed(6)}
              </div>
              <Button variant="secondary" size="sm" icon="arrow-right" style={{ width: '100%', marginTop: 8 }} onClick={() => onViewDetail(n.id)}>
                Ver detalle del nodo
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}

      {tempMarker && (
        <Marker position={[tempMarker.lat, tempMarker.lng]} icon={TEMP_ICON}>
          <Popup>
            <div className="nk-leaflet-popup">
              <strong>Nueva ubicación</strong>
              <div className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                {tempMarker.lat.toFixed(6)}, {tempMarker.lng.toFixed(6)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
