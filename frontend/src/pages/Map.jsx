/* Mapa de nodos, conectado a GET /network-nodes/map (solo nodos con
   coordenadas validas) + GET /network-nodes (total, para contabilizar los
   que quedan fuera por no tener coordenadas) + GET /equipment (para derivar
   la cantidad de equipos por nodo, ya que /map no la incluye).

   No hay Leaflet ni ninguna libreria de mapas instalada: se conserva el
   lienzo decorativo del Design System, pero los marcadores ahora se
   posicionan proyectando las coordenadas REALES (lat/lng) de cada nodo a un
   rango 0-100% dentro del lienzo (normalizacion lineal por los limites del
   propio conjunto de nodos cargado), en vez de usar valores x/y inventados. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { Icon } from '../components/Icon.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import { NODE_STATUS } from '../utils/statusMaps.js';

const STATUS_ORDER = ['AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

// Proyecta lat/lng reales a un porcentaje 0-100 dentro del lienzo, con un
// margen del 10% para que ningun marcador quede pegado al borde. Si todos
// los nodos comparten la misma coordenada (o solo hay uno), se centran.
function projectNodes(nodes) {
  if (nodes.length === 0) return [];
  const lats = nodes.map((n) => n.latitude);
  const lngs = nodes.map((n) => n.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const PAD = 12;
  const SPAN = 100 - PAD * 2;

  return nodes.map((n) => ({
    ...n,
    left: PAD + ((n.longitude - minLng) / lngRange) * SPAN,
    // Latitud mayor = mas al norte = mas arriba (top% menor).
    top: PAD + (1 - (n.latitude - minLat) / latRange) * SPAN,
  }));
}

export function Map() {
  const navigate = useNavigate();
  const { data: mapData, error: mapError, loading: mapLoading, reload: reloadMap } = useAsync(() => networkNodeService.map(), []);
  const { data: allNodesData } = useAsync(() => networkNodeService.list(), []);
  const { data: equipData } = useAsync(() => equipmentService.list(), []);

  const nodesWithCoords = mapData?.networkNodes ?? [];
  const allNodes = allNodesData?.networkNodes ?? [];
  const equipment = equipData?.equipment ?? [];
  const withoutCoords = Math.max(0, allNodes.length - nodesWithCoords.length);

  const equipCountByNode = useMemo(() => {
    const map = {};
    equipment.forEach((e) => { map[e.networkNodeId] = (map[e.networkNodeId] || 0) + 1; });
    return map;
  }, [equipment]);

  const [sel, setSel] = useState(null);
  const [hidden, setHidden] = useState({});

  const projected = useMemo(() => projectNodes(nodesWithCoords), [nodesWithCoords]);
  const counts = { AVAILABLE: 0, MAINTENANCE: 0, OUT_OF_SERVICE: 0 };
  nodesWithCoords.forEach((n) => { if (counts[n.status] !== undefined) counts[n.status]++; });
  const selNode = projected.find((n) => n.id === sel);

  return (
    <div>
      <PageHeader eyebrow="Geolocalización" title="Mapa de nodos"
        subtitle={`${nodesWithCoords.length} nodos con coordenadas${withoutCoords > 0 ? ` · ${withoutCoords} sin coordenadas` : ''}`}
        actions={<Button variant="secondary" icon="list" onClick={() => navigate('/nodos')}>Ver listado</Button>} />

      {mapLoading && <LoadingSkeleton lines={4} />}
      {!mapLoading && mapError && <ErrorState error={mapError} onRetry={reloadMap} />}

      {!mapLoading && !mapError && nodesWithCoords.length === 0 && (
        <Card pad>
          <Empty icon="map-pin" title="Sin nodos con coordenadas" sub={withoutCoords > 0 ? `Hay ${withoutCoords} nodos registrados, pero ninguno tiene latitud/longitud.` : 'Aún no hay nodos con coordenadas registradas.'} />
        </Card>
      )}

      {!mapLoading && !mapError && nodesWithCoords.length > 0 && (
        <div className="nk-map-wrap">
          <div className="nk-map">
            <div className="nk-map-canvas"></div>
            <div className="nk-map-grid"></div>

            {projected.filter((n) => !hidden[n.status]).map((n) => {
              const s = NODE_STATUS[n.status] || NODE_STATUS.AVAILABLE;
              return (
                <button key={n.id} type="button" className={`nk-marker ${sel === n.id ? 'is-active' : ''}`} style={{ left: n.left + '%', top: n.top + '%' }} onClick={() => setSel(n.id)} title={n.name}>
                  <span className="nk-marker-pin" style={{ background: s.solid }}>
                    <span className="nk-marker-inner"></span>
                  </span>
                </button>
              );
            })}

            <div className="nk-map-legend">
              {STATUS_ORDER.map((s) => (
                <button key={s} type="button" className={`nk-legend-item ${hidden[s] ? 'is-off' : ''}`} onClick={() => setHidden((h) => ({ ...h, [s]: !h[s] }))}>
                  <span className="nk-dot" style={{ background: NODE_STATUS[s].solid }}></span>
                  <span>{NODE_STATUS[s].label}</span>
                  <span className="nk-legend-count nk-mono">{counts[s]}</span>
                </button>
              ))}
            </div>
            <div className="nk-map-placeholder-note">Mapa ilustrativo (posiciones proyectadas desde coordenadas reales) · sustituir por Leaflet / Mapbox</div>
          </div>

          <Card pad={false} className="nk-map-panel">
            {selNode ? (
              <div>
                <div className="nk-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="nk-dot" style={{ background: (NODE_STATUS[selNode.status] || NODE_STATUS.AVAILABLE).solid }}></span>
                    <h3 className="nk-section-title">{selNode.name}</h3>
                  </div>
                  <button type="button" className="nk-iconbtn" style={{ width: 28, height: 28 }} onClick={() => setSel(null)}><Icon name="x" size={16} /></button>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div className="nk-meta"><span className="k">Código</span><span className="v nk-mono">{selNode.code}</span></div>
                  <div className="nk-meta"><span className="k">Ubicación</span><span className="v">{selNode.location || '—'}</span></div>
                  <div className="nk-meta"><span className="k">Estado</span><span className="v"><StatusBadge kind="node" value={selNode.status} /></span></div>
                  <div className="nk-meta"><span className="k">Coordenadas</span><span className="v nk-mono" style={{ fontSize: 13 }}>{selNode.latitude}, {selNode.longitude}</span></div>
                  <div className="nk-meta"><span className="k">Equipos</span><span className="v nk-mono">{equipCountByNode[selNode.id] || 0}</span></div>
                  <Button variant="primary" icon="arrow-right" style={{ width: '100%', marginTop: 4 }} onClick={() => navigate(`/nodos/${selNode.id}`)}>Ver detalle del nodo</Button>
                </div>
              </div>
            ) : (
              <Empty icon="map-pin" title="Selecciona un nodo" sub="Toca un marcador para ver su información." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
