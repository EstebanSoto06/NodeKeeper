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

// Sincroniza el encuadre del mapa con el conjunto de puntos visibles (nodos +
// marcador temporal). Vive dentro de <MapContainer> porque necesita la
// instancia real del mapa via useMap().
function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');

  useEffect(() => {
    if (points.length === 0) {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
    } else if (points.length === 1) {
      map.setView(points[0], SINGLE_POINT_ZOOM);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

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

export function NodeMap({ nodes, selectedId, onSelectNode, onViewDetail, tempMarker, onMapClick }) {
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
      <FitBounds points={points} />
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
