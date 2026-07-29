/* Dashboard: indicadores reales calculados client-side a partir de
   GET /network-nodes, GET /equipment y GET /maintenances (sin agregacion en
   backend: volumen del MVP lo permite). Cada fuente carga en paralelo e
   independiente, para que el fallo de una no bloquee las demas
   (respuestas parciales manejadas por seccion). */
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Card } from '../components/Card.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import * as maintenanceService from '../services/maintenanceService.js';
import { NODE_STATUS } from '../utils/statusMaps.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function withinNextDays(dateStr, days) {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + days * DAY_MS;
}

function withinLastDays(dateStr, days) {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t <= now && t >= now - days * DAY_MS;
}

function Kpis({ nodes, equipment, maintenances }) {
  const nodesByStatus = { AVAILABLE: 0, MAINTENANCE: 0, OUT_OF_SERVICE: 0 };
  nodes.forEach((n) => { if (nodesByStatus[n.status] !== undefined) nodesByStatus[n.status]++; });

  const maintByStatus = { SCHEDULED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };
  const maintByType = { PREVENTIVE: 0, CORRECTIVE: 0 };
  maintenances.forEach((m) => {
    if (maintByStatus[m.status] !== undefined) maintByStatus[m.status]++;
    if (maintByType[m.type] !== undefined) maintByType[m.type]++;
  });
  const upcoming = maintenances.filter((m) => m.status === 'SCHEDULED' && withinNextDays(m.scheduledDate, 7)).length;
  const recent = maintenances.filter((m) => withinLastDays(m.createdAt, 7)).length;

  const cards = [
    { key: 'nodesTotal', label: 'Total de nodos', value: nodes.length, accent: 'var(--blue-600)', fg: 'var(--blue-700)' },
    { key: 'nodesAvailable', label: 'Nodos disponibles', value: nodesByStatus.AVAILABLE, accent: 'var(--green-500)', fg: 'var(--green-700)' },
    { key: 'nodesMaintenance', label: 'Nodos en mantenimiento', value: nodesByStatus.MAINTENANCE, accent: 'var(--amber-500)', fg: 'var(--amber-700)' },
    { key: 'nodesOut', label: 'Nodos fuera de servicio', value: nodesByStatus.OUT_OF_SERVICE, accent: 'var(--red-500)', fg: 'var(--red-700)' },
    { key: 'equipTotal', label: 'Total de equipos', value: equipment.length, accent: 'var(--navy-600)', fg: 'var(--navy-700)' },
    { key: 'maintScheduled', label: 'Mantenimientos programados', value: maintByStatus.SCHEDULED, accent: 'var(--gray-400)', fg: 'var(--gray-700)' },
    { key: 'maintProgress', label: 'Mantenimientos en progreso', value: maintByStatus.IN_PROGRESS, accent: 'var(--blue-500)', fg: 'var(--blue-700)' },
    { key: 'maintDone', label: 'Mantenimientos completados', value: maintByStatus.COMPLETED, accent: 'var(--green-500)', fg: 'var(--green-700)' },
    { key: 'maintPrev', label: 'Mantenimientos preventivos', value: maintByType.PREVENTIVE, accent: 'var(--blue-600)', fg: 'var(--blue-700)' },
    { key: 'maintCorr', label: 'Mantenimientos correctivos', value: maintByType.CORRECTIVE, accent: 'var(--navy-600)', fg: 'var(--navy-700)' },
    { key: 'maintUpcoming', label: 'Próximos (7 días)', value: upcoming, accent: 'var(--amber-500)', fg: 'var(--amber-700)' },
    { key: 'maintRecent', label: 'Recientes (7 días)', value: recent, accent: 'var(--gray-500)', fg: 'var(--gray-700)' },
  ];

  return (
    <div className="nk-kpis">
      {cards.map((k) => <KpiCard key={k.key} label={k.label} value={k.value} accent={k.accent} fg={k.fg} />)}
    </div>
  );
}

function NodeStatusSummary({ nodes }) {
  const navigate = useNavigate();
  const counts = { AVAILABLE: 0, MAINTENANCE: 0, OUT_OF_SERVICE: 0 };
  nodes.forEach((n) => { if (counts[n.status] !== undefined) counts[n.status]++; });
  const total = nodes.length || 1;
  const order = ['OUT_OF_SERVICE', 'MAINTENANCE', 'AVAILABLE'];

  return (
    <Card pad>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 className="nk-section-title">Estado de nodos</h3>
        <a className="nk-link" onClick={() => navigate('/mapa')}>Ver mapa</a>
      </div>
      {nodes.length === 0 ? (
        <EmptyState icon="share-2" title="Sin nodos" subtitle="Aún no hay nodos registrados." />
      ) : (
        <>
          <div className="nk-healthbar">
            {order.map((s) => counts[s] > 0 && <div key={s} style={{ flex: counts[s], background: NODE_STATUS[s].solid }}></div>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {order.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="nk-dot" style={{ background: NODE_STATUS[s].solid }}></span>
                <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{NODE_STATUS[s].label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: NODE_STATUS[s].fg }}>{counts[s]}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)', width: 38, textAlign: 'right' }}>{Math.round((counts[s] / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RecentMaint({ maintenances }) {
  const navigate = useNavigate();
  const rows = [...maintenances]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <Card pad={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px' }}>
        <h3 className="nk-section-title">Mantenimientos recientes</h3>
        <a className="nk-link" onClick={() => navigate('/mantenimientos')}>Ver todos</a>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '0 18px 18px' }}><EmptyState icon="wrench" title="Sin mantenimientos" subtitle="Aún no hay órdenes registradas." /></div>
      ) : (
        <table className="nk-table">
          <thead><tr><th>Título</th><th>Tipo</th><th>Nodo / Equipo</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} onClick={() => navigate(`/mantenimientos/${m.id}`)}>
                <td style={{ fontWeight: 600 }}>{m.title}</td>
                <td><StatusBadge kind="maintenanceType" value={m.type} /></td>
                <td style={{ color: 'var(--fg-2)' }}>{m.type === 'PREVENTIVE' ? (m.networkNode?.name || '—') : (m.equipment?.name || '—')}</td>
                <td><StatusBadge kind="maintenance" value={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function Dashboard() {
  const nodesQ = useAsync(() => networkNodeService.list(), []);
  const equipQ = useAsync(() => equipmentService.list(), []);
  const maintQ = useAsync(() => maintenanceService.list(), []);

  const loading = nodesQ.loading || equipQ.loading || maintQ.loading;
  const nodes = nodesQ.data?.networkNodes ?? [];
  const equipment = equipQ.data?.equipment ?? [];
  const maintenances = maintQ.data?.maintenances ?? [];

  const reloadAll = () => { nodesQ.reload(); equipQ.reload(); maintQ.reload(); };

  return (
    <div>
      <PageHeader eyebrow="Resumen operativo" title="Dashboard" subtitle="Indicadores en tiempo real." />

      {loading && <LoadingSkeleton lines={4} />}

      {!loading && nodesQ.error && maintQ.error && equipQ.error && (
        <ErrorState error={nodesQ.error} title="No se pudieron cargar los indicadores" onRetry={reloadAll} />
      )}

      {!loading && !(nodesQ.error && maintQ.error && equipQ.error) && (
        <>
          <Kpis nodes={nodes} equipment={equipment} maintenances={maintenances} />
          {(nodesQ.error || equipQ.error || maintQ.error) && (
            <div className="nk-callout" role="alert" style={{ marginTop: 12 }}>
              <span>Algunos indicadores pueden estar incompletos: {[nodesQ.error && 'nodos', equipQ.error && 'equipos', maintQ.error && 'mantenimientos'].filter(Boolean).join(', ')} no se pudo(n) cargar. </span>
              <a className="nk-link" onClick={reloadAll}>Reintentar</a>
            </div>
          )}
          <div className="nk-grid" style={{ gridTemplateColumns: '1fr 1.4fr', marginTop: 16 }}>
            <NodeStatusSummary nodes={nodes} />
            <RecentMaint maintenances={maintenances} />
          </div>
        </>
      )}
    </div>
  );
}
