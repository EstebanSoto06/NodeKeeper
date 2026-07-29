/* Inventario de equipos, conectado a GET/POST/PUT/DELETE /equipment.
   El listado ya incluye networkNode y supportProvider (equipmentInclude en
   el backend). ADMIN gestiona; OPERATOR consulta. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { SearchInput, Select, FilterChips } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { EquipmentFormModal } from '../components/EquipmentFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as equipmentService from '../services/equipmentService.js';
import * as networkNodeService from '../services/networkNodeService.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'OPERATIONAL', label: 'Operativo', dot: 'var(--green-600)' },
  { value: 'MAINTENANCE', label: 'En mantenimiento', dot: 'var(--amber-500)' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio', dot: 'var(--red-600)' },
];

export function Equipment() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data, error, loading, reload } = useAsync(() => equipmentService.list(), []);
  const equipment = data?.equipment ?? [];

  const { data: nodesData } = useAsync(() => networkNodeService.list(), []);
  const nodes = nodesData?.networkNodes ?? [];

  const [q, setQ] = useState('');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);

  const rows = equipment.filter((e) =>
    (nodeFilter === 'all' || e.networkNodeId === nodeFilter) &&
    (status === 'all' || e.status === status) &&
    (q === '' || (e.name + e.category + (e.networkNode?.name || '')).toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="Inventario" title="Equipos"
        subtitle={`${equipment.length} equipos en ${nodes.length} nodos`}
        actions={(
          isAdmin && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Registrar equipo</Button>
        )} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar equipo, categoría o nodo…" style={{ flex: 1, minWidth: 220 }} />
        <Select value={nodeFilter} onChange={setNodeFilter} options={[{ value: 'all', label: 'Todos los nodos' }, ...nodes.map((n) => ({ value: n.id, label: n.name }))]} />
        <FilterChips value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>

      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <table className="nk-table">
            <thead><tr><th>Equipo</th><th>Categoría</th><th>Nodo</th><th>Proveedor de soporte</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => navigate(`/equipos/${e.id}`)}>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.category}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.networkNode?.name || '—'}</td>
                  <td>{e.supportProvider
                    ? <span className="nk-provtag"><Icon name="building-2" size={13} />{e.supportProvider.companyName}</span>
                    : <span className="nk-prov-none">No asignado</span>}</td>
                  <td><StatusBadge kind="equipment" value={e.status} /></td>
                  <td style={{ textAlign: 'right' }} onClick={(ev) => ev.stopPropagation()}>
                    <IconButton name="eye" title="Ver" onClick={() => navigate(`/equipos/${e.id}`)} style={{ width: 30, height: 30 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState icon="search-x" title="Sin resultados" subtitle="Ajusta la búsqueda o los filtros." />
        )}
      </Card>

      {creating && <EquipmentFormModal onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
}
