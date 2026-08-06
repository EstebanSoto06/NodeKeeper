/* Mapa de nodos, conectado a GET /network-nodes/map (solo nodos con
   coordenadas validas) + GET /network-nodes (total, para contabilizar los
   que quedan fuera por no tener coordenadas) + GET /equipment (para derivar
   la cantidad de equipos por nodo, ya que /map no la incluye).

   Mapa real (Leaflet + OpenStreetMap, ver components/map/NodeMap.jsx). Un
   ADMIN puede crear un nodo haciendo click en un punto vacio del mapa: se
   coloca un marcador temporal y se abre NodeFormModal con la latitud/longitud
   ya fijadas. Un OPERATOR puede ver y seleccionar nodos, pero al hacer click
   en el mapa solo recibe un aviso discreto (toast) de que no tiene permiso —
   el backend tambien lo rechazaria (POST /network-nodes es solo ADMIN), esto
   es unicamente para no ofrecer una accion imposible. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { Icon } from '../components/Icon.jsx';
import { NodeMap } from '../components/map/NodeMap.jsx';
import { NodeFormModal } from '../components/NodeFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { showToast } from '../store/store.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import { NODE_STATUS } from '../utils/statusMaps.js';

const STATUS_ORDER = ['AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

export function Map() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusNodeId = searchParams.get('nodeId');
  const { isAdmin } = usePermissions();
  const { data: mapData, error: mapError, loading: mapLoading, reload: reloadMap } = useAsync(() => networkNodeService.map(), []);
  const { data: allNodesData, reload: reloadAllNodes } = useAsync(() => networkNodeService.list(), []);
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

  const [selectedId, setSelectedId] = useState(null);
  const [hidden, setHidden] = useState({});
  const [tempCoords, setTempCoords] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Foco del nodo recien creado desde el mapa: solo coordenadas (lo unico
  // que se conoce de inmediato, antes de que termine el reload de
  // /network-nodes/map), para poder centrar el viewport sin esperar a que
  // el nodo real aparezca en `nodesWithCoords`.
  const [createdFocusNode, setCreatedFocusNode] = useState(null);

  // Llegada desde NodeDetail ("Ubicar"): si el nodo de la URL ya cargo y
  // tiene coordenadas, se selecciona para que el panel lo muestre y
  // NodeMap lo enfoque (ver prop focusNode mas abajo).
  useEffect(() => {
    if (!mapData || !focusNodeId) return;
    const exists = (mapData.networkNodes ?? []).some((n) => n.id === focusNodeId);
    if (exists) setSelectedId(focusNodeId);
  }, [mapData, focusNodeId]);

  // El nodo enfocado por URL o por creacion reciente: primero se busca el
  // nodo REAL (ya cargado, con todos sus campos) por ese id; si el reload
  // aun no lo trae (recien creado, respuesta de /network-nodes/map en
  // vuelo o desactualizada), se usa `createdFocusNode` como respaldo -solo
  // conoce id/lat/lng- unicamente para centrar el viewport de inmediato.
  const effectiveFocusNodeId = focusNodeId || createdFocusNode?.id || null;
  const realFocusNode = effectiveFocusNodeId ? nodesWithCoords.find((n) => n.id === effectiveFocusNodeId) ?? null : null;
  const focusNode = realFocusNode || (createdFocusNode?.id === effectiveFocusNodeId ? createdFocusNode : null);

  // La reintegracion en los nodos visibles (cuando el filtro de la leyenda
  // lo esconde) SOLO aplica al nodo real y completo: el respaldo
  // `createdFocusNode` no tiene status/code/name y generaria un marcador
  // "fantasma" a medio llenar en el mapa.
  const visibleNodes = useMemo(() => {
    const base = nodesWithCoords.filter((n) => !hidden[n.status]);
    if (!realFocusNode || base.some((n) => n.id === realFocusNode.id)) return base;
    return [...base, realFocusNode];
  }, [nodesWithCoords, hidden, realFocusNode]);

  const counts = { AVAILABLE: 0, MAINTENANCE: 0, OUT_OF_SERVICE: 0 };
  nodesWithCoords.forEach((n) => { if (counts[n.status] !== undefined) counts[n.status]++; });
  const selectedNode = nodesWithCoords.find((n) => n.id === selectedId);

  function handleMapClick(lat, lng) {
    if (!isAdmin) {
      showToast('Solo un administrador puede crear nodos desde el mapa.', 'error');
      return;
    }
    setTempCoords({ lat, lng });
    setShowCreateModal(true);
  }

  function handleCreateClosed() {
    setShowCreateModal(false);
    setTempCoords(null);
  }

  function handleCreated(createdNode) {
    handleCreateClosed();

    reloadMap();
    reloadAllNodes();

    if (!createdNode?.id) return;

    setSelectedId(createdNode.id);

    // Si el estado del nodo recien creado estaba oculto por un filtro de la
    // leyenda, se revela: de lo contrario su marcador quedaria invisible en
    // cuanto llegue el reload, justo el nodo que el usuario acaba de crear.
    if (createdNode.status && hidden[createdNode.status]) {
      setHidden((h) => ({ ...h, [createdNode.status]: false }));
    }

    if (createdNode.latitude == null || createdNode.longitude == null) return;

    setCreatedFocusNode({
      id: createdNode.id,
      latitude: Number(createdNode.latitude),
      longitude: Number(createdNode.longitude),
    });

    navigate(`/mapa?nodeId=${createdNode.id}`, { replace: true });
  }

  return (
    <div>
      <PageHeader eyebrow="Geolocalización" title="Mapa de nodos"
        subtitle={`${nodesWithCoords.length} nodos con coordenadas${withoutCoords > 0 ? ` · ${withoutCoords} sin coordenadas` : ''}`}
        actions={<Button variant="secondary" icon="list" onClick={() => navigate('/nodos')}>Ver listado</Button>} />

      {mapLoading && <LoadingSkeleton lines={4} />}
      {!mapLoading && mapError && <ErrorState error={mapError} onRetry={reloadMap} />}

      {!mapLoading && !mapError && (
        <div className="nk-map-wrap">
          <div className="nk-map">
            <NodeMap
              nodes={visibleNodes}
              selectedId={selectedId}
              onSelectNode={setSelectedId}
              onViewDetail={(id) => navigate(`/nodos/${id}`)}
              tempMarker={tempCoords}
              onMapClick={handleMapClick}
              focusNode={focusNode}
            />

            <div className="nk-map-legend">
              {STATUS_ORDER.map((s) => (
                <button key={s} type="button" className={`nk-legend-item ${hidden[s] ? 'is-off' : ''}`} onClick={() => setHidden((h) => ({ ...h, [s]: !h[s] }))}>
                  <span className="nk-dot" style={{ background: NODE_STATUS[s].solid }}></span>
                  <span>{NODE_STATUS[s].label}</span>
                  <span className="nk-legend-count nk-mono">{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>

          <Card pad={false} className="nk-map-panel">
            {selectedNode ? (
              <div>
                <div className="nk-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="nk-dot" style={{ background: (NODE_STATUS[selectedNode.status] || NODE_STATUS.AVAILABLE).solid }}></span>
                    <h3 className="nk-section-title">{selectedNode.name}</h3>
                  </div>
                  <button type="button" className="nk-iconbtn" style={{ width: 28, height: 28 }} onClick={() => setSelectedId(null)}><Icon name="x" size={16} /></button>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div className="nk-meta"><span className="k">Código</span><span className="v nk-mono">{selectedNode.code}</span></div>
                  <div className="nk-meta"><span className="k">Ubicación</span><span className="v">{selectedNode.location || '—'}</span></div>
                  <div className="nk-meta"><span className="k">Estado</span><span className="v"><StatusBadge kind="node" value={selectedNode.status} /></span></div>
                  <div className="nk-meta"><span className="k">Coordenadas</span><span className="v nk-mono" style={{ fontSize: 13 }}>{selectedNode.latitude}, {selectedNode.longitude}</span></div>
                  <div className="nk-meta"><span className="k">Equipos</span><span className="v nk-mono">{equipCountByNode[selectedNode.id] || 0}</span></div>
                  <Button variant="primary" icon="arrow-right" style={{ width: '100%', marginTop: 4 }} onClick={() => navigate(`/nodos/${selectedNode.id}`)}>Ver detalle del nodo</Button>
                </div>
              </div>
            ) : (
              <Empty icon="map-pin" title="Selecciona un nodo"
                sub={isAdmin ? 'Toca un marcador para ver su información, o haz clic en el mapa para crear un nodo nuevo.' : 'Toca un marcador para ver su información.'} />
            )}
          </Card>
        </div>
      )}

      {showCreateModal && tempCoords && (
        <NodeFormModal
          initialCoords={{ latitude: tempCoords.lat, longitude: tempCoords.lng }}
          onClose={handleCreateClosed}
          onSaved={handleCreated}
        />
      )}
    </div>
  );
}
