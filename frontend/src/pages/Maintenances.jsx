/* Listado de mantenimientos, conectado a GET/POST/PUT/DELETE /maintenances.
   Solo ADMIN crea/edita/elimina (autorizado asi en el backend); ADMIN y
   OPERATOR consultan, inician y completan.

   El boton global "Nuevo" del Topbar navega aqui con
   state.maintenancesRefreshedAt tras crear una orden. Ese sello de tiempo es
   una dependencia de la carga para que la lista se refresque tambien cuando
   el usuario YA estaba en /mantenimientos (navegar a la ruta actual no
   remonta el componente y, sin esto, la orden recien creada no aparecia). */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card, ProgressBar } from '../components/Card.jsx';
import { SearchInput, FilterChips } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { MaintenanceFormModal } from '../components/MaintenanceFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as maintenanceService from '../services/maintenanceService.js';
import { showToast } from '../store/store.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'SCHEDULED', label: 'Programado', dot: 'var(--gray-400)' },
  { value: 'IN_PROGRESS', label: 'En progreso', dot: 'var(--blue-500)' },
  { value: 'COMPLETED', label: 'Completado', dot: 'var(--green-500)' },
  { value: 'CANCELLED', label: 'Cancelado', dot: 'var(--red-500)' },
];

const TYPE_FILTERS = [
  { value: 'all', label: 'Todo tipo' },
  { value: 'PREVENTIVE', label: 'Preventivo', dot: 'var(--blue-600)' },
  { value: 'CORRECTIVE', label: 'Correctivo', dot: 'var(--navy-600)' },
];

function progressOf(m) {
  const tasks = m.checklistTasks || [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.isCompleted).length;
  return Math.round((done / tasks.length) * 100);
}

function subjectOf(m) {
  return m.type === 'PREVENTIVE' ? (m.networkNode?.name || '—') : (m.equipment?.name || '—');
}

export function Maintenances() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const refreshedAt = state?.maintenancesRefreshedAt ?? null;
  const { isAdmin } = usePermissions();
  const { data, error, loading, reload } = useAsync(() => maintenanceService.list(), [refreshedAt]);
  const maintenances = data?.maintenances ?? [];

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [creating, setCreating] = useState(false);
  const [delMaintenance, setDelMaintenance] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const rows = maintenances.filter((m) =>
    (status === 'all' || m.status === status) &&
    (type === 'all' || m.type === type) &&
    (q === '' || (m.title + subjectOf(m)).toLowerCase().includes(q.toLowerCase())));

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await maintenanceService.remove(delMaintenance.id);
      setDelMaintenance(null);
      showToast('Mantenimiento eliminado correctamente.');
      reload();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el mantenimiento.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Órdenes de trabajo" title="Mantenimientos"
        subtitle={`${maintenances.length} órdenes registradas`}
        actions={isAdmin && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Nuevo mantenimiento</Button>} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por título, nodo o equipo…" style={{ flex: 1, minWidth: 220 }} />
        <FilterChips value={type} onChange={setType} options={TYPE_FILTERS} />
        <FilterChips value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>

      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <table className="nk-table">
            <thead><tr><th>Título</th><th>Tipo</th><th>Nodo / Equipo</th><th>Fecha</th><th>Avance</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((m) => {
                const pct = progressOf(m);
                return (
                  <tr key={m.id} onClick={() => navigate(`/mantenimientos/${m.id}`)}>
                    <td style={{ fontWeight: 600 }}>{m.title}</td>
                    <td><StatusBadge kind="maintenanceType" value={m.type} /></td>
                    <td style={{ color: 'var(--fg-2)' }}>{subjectOf(m)}</td>
                    <td className="nk-mono" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{m.scheduledDate ? String(m.scheduledDate).slice(0, 10) : '—'}</td>
                    <td style={{ width: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ProgressBar value={pct} />
                        <span className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)', width: 28 }}>{pct}%</span>
                      </div>
                    </td>
                    <td><StatusBadge kind="maintenance" value={m.status} /></td>
                    <td style={{ textAlign: 'right' }} onClick={(ev) => ev.stopPropagation()}>
                      {isAdmin && <IconButton name="trash-2" title="Eliminar" onClick={() => setDelMaintenance(m)} style={{ width: 30, height: 30 }} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState icon="search-x" title="Sin resultados" subtitle="Ajusta la búsqueda o los filtros." />
        )}
      </Card>

      {creating && <MaintenanceFormModal onClose={() => setCreating(false)} onSaved={reload} />}

      <ConfirmDialog
        open={!!delMaintenance}
        title="Eliminar mantenimiento"
        message={delMaintenance ? `¿Deseas eliminar "${delMaintenance.title}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar mantenimiento"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDelete}
        onClose={() => { setDelMaintenance(null); setDeleteError(''); }}
      >
        {deleteError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>}
      </ConfirmDialog>
    </div>
  );
}
