/* Listado de nodos, conectado a GET/POST/PUT/DELETE /network-nodes.
   ADMIN puede crear/editar/eliminar; OPERATOR consulta. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { SearchInput, FilterChips } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { NodeFormModal } from '../components/NodeFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as networkNodeService from '../services/networkNodeService.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'AVAILABLE', label: 'Disponible', dot: 'var(--green-600)' },
  { value: 'MAINTENANCE', label: 'En mantenimiento', dot: 'var(--amber-500)' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio', dot: 'var(--red-600)' },
];

export function Nodes() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data, error, loading, reload } = useAsync(() => networkNodeService.list(), []);
  const nodes = data?.networkNodes ?? [];

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [formNode, setFormNode] = useState(undefined); // undefined=cerrado, null=crear, obj=editar

  const rows = nodes.filter((n) =>
    (status === 'all' || n.status === status) &&
    (q === '' || (n.name + n.code + (n.location || '')).toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="Infraestructura" title="Nodos"
        subtitle={`${nodes.length} nodos registrados`}
        actions={(
          <>
            <Button variant="secondary" icon="map" onClick={() => navigate('/mapa')}>Ver en mapa</Button>
            {isAdmin && <Button variant="primary" icon="plus" onClick={() => setFormNode(null)}>Crear nodo</Button>}
          </>
        )} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar nodo, código o ubicación…" style={{ flex: 1, minWidth: 240 }} />
        <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>
      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <table className="nk-table">
            <thead><tr><th>Código</th><th>Nodo</th><th>Ubicación</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} onClick={() => navigate(`/nodos/${n.id}`)}>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{n.code}</td>
                  <td style={{ fontWeight: 600 }}>{n.name}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{n.location || '—'}</td>
                  <td><StatusBadge kind="node" value={n.status} /></td>
                  <td style={{ textAlign: 'right', color: 'var(--fg-3)' }}><Icon name="chevron-right" size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState icon="search-x" title="Sin resultados" subtitle="Ajusta la búsqueda o los filtros." />
        )}
      </Card>

      {formNode !== undefined && (
        <NodeFormModal node={formNode} onClose={() => setFormNode(undefined)} onSaved={reload} />
      )}
    </div>
  );
}
