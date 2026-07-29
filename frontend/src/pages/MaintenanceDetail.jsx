/* Detalle de mantenimiento, conectado a GET/PUT/DELETE /maintenances/:id +
   start/complete. Compone ChecklistPanel y EvidencePanel, que manejan sus
   propias reglas de permiso/estado contra el backend real. La edicion de
   estructura (tipo/nodo/equipo) se restringe en la UI a SCHEDULED: el
   backend no impone esa restriccion en PUT, pero permitir reestructurar un
   mantenimiento ya iniciado o cerrado no tiene sentido de negocio; sigue
   siendo el backend quien valida en ultima instancia cualquier otra regla. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ChecklistPanel } from '../components/ChecklistPanel.jsx';
import { EvidencePanel } from '../components/EvidencePanel.jsx';
import { MaintenanceFormModal } from '../components/MaintenanceFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as maintenanceService from '../services/maintenanceService.js';
import { availableActions } from '../utils/maintenanceState.js';
import { showToast } from '../store/store.js';

function DetRow({ k, v, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k}</span>
      <span className={mono ? 'nk-mono' : ''} style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function TLItem({ dot, title, time, by, last }) {
  return (
    <div className={`nk-tl-item ${last ? 'is-last' : ''}`}>
      <span className="nk-tl-dot" style={{ background: dot }}></span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{time}{by ? ` · ${by}` : ''}</div>
      </div>
    </div>
  );
}

const ACTION_ICON = { start: 'check-circle-2', complete: 'check-circle-2' };
const ACTION_CONFIRM_MESSAGE = {
  start: '¿Deseas iniciar este mantenimiento? Pasará a estado "En progreso".',
  complete: '¿Deseas completar este mantenimiento? Esta acción cierra el checklist y las evidencias.',
};

export function MaintenanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const perms = usePermissions();

  const { data, error, loading, reload } = useAsync(() => maintenanceService.getById(id), [id]);
  const maintenance = data?.maintenance ?? null;

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [confirmingAction, setConfirmingAction] = useState(null); // 'start' | 'complete' | null
  const [runningAction, setRunningAction] = useState(false);
  const [actionError, setActionError] = useState('');

  if (loading) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/mantenimientos')}><Icon name="arrow-left" size={15} />Mantenimientos</button>
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/mantenimientos')}><Icon name="arrow-left" size={15} />Mantenimientos</button>
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  if (!maintenance) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/mantenimientos')}><Icon name="arrow-left" size={15} />Mantenimientos</button>
        <EmptyState icon="wrench" title="Mantenimiento no encontrado" subtitle="El mantenimiento pudo haber sido eliminado." />
      </div>
    );
  }

  const tasks = maintenance.checklistTasks || [];
  const pendingCount = tasks.filter((t) => !t.isCompleted).length;
  const canEditStructure = perms.canManageMaintenances && maintenance.status === 'SCHEDULED';
  const canDelete = perms.canManageMaintenances;
  const actions = availableActions(maintenance.status);

  const confirmDeleteMaintenance = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await maintenanceService.remove(maintenance.id);
      showToast('Mantenimiento eliminado correctamente.');
      navigate('/mantenimientos');
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el mantenimiento.');
    } finally {
      setDeleting(false);
    }
  };

  const runAction = async () => {
    setRunningAction(true);
    setActionError('');
    try {
      if (confirmingAction === 'start') {
        await maintenanceService.start(maintenance.id);
        showToast('Mantenimiento iniciado.');
      } else if (confirmingAction === 'complete') {
        await maintenanceService.complete(maintenance.id);
        showToast('Mantenimiento completado.');
      }
      setConfirmingAction(null);
      reload();
    } catch (err) {
      setActionError(err.message || 'No se pudo ejecutar la acción.');
    } finally {
      setRunningAction(false);
    }
  };

  return (
    <div>
      <button type="button" className="nk-back" onClick={() => navigate('/mantenimientos')}><Icon name="arrow-left" size={15} />Mantenimientos</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="nk-page-title">{maintenance.title}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <StatusBadge kind="maintenanceType" value={maintenance.type} />
            <StatusBadge kind="maintenance" value={maintenance.status} />
          </div>
        </div>
        <div className="nk-pagehead-actions">
          {canEditStructure && <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button>}
          {canDelete && <Button variant="danger" icon="trash-2" onClick={() => setConfirmingDelete(true)}>Eliminar</Button>}
          {actions.map((a) => (
            <Button
              key={a.key}
              variant={a.key === 'complete' ? 'primary' : 'primary'}
              icon={ACTION_ICON[a.key]}
              disabled={a.key === 'complete' && pendingCount > 0}
              title={a.key === 'complete' && pendingCount > 0 ? `Quedan ${pendingCount} tareas pendientes` : undefined}
              onClick={() => setConfirmingAction(a.key)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}><Icon name="alert-circle" size={15} /><span>{actionError}</span></div>
      )}
      {maintenance.status === 'IN_PROGRESS' && pendingCount > 0 && (
        <div className="nk-callout"><Icon name="lock" size={15} /><span>No puedes completar: quedan <b className="nk-mono">{pendingCount}</b> {pendingCount === 1 ? 'tarea pendiente' : 'tareas pendientes'} en el checklist.</span></div>
      )}
      {maintenance.status === 'COMPLETED' && (
        <div className="nk-callout is-ok"><Icon name="check-circle-2" size={15} /><span>Mantenimiento completado. Checklist y evidencias en modo solo lectura.</span></div>
      )}

      <div className="nk-grid" style={{ gridTemplateColumns: '1.5fr 1fr', marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ChecklistPanel
            maintenanceId={maintenance.id}
            status={maintenance.status}
            tasks={tasks}
            loading={false}
            onChanged={reload}
          />
          <EvidencePanel
            maintenanceId={maintenance.id}
            status={maintenance.status}
            isCompleted={maintenance.status === 'COMPLETED'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card pad>
            <h3 className="nk-section-title" style={{ marginBottom: 14 }}>Detalle</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {maintenance.type === 'PREVENTIVE'
                ? <DetRow k="Nodo" v={maintenance.networkNode?.name || '—'} />
                : <DetRow k="Equipo" v={maintenance.equipment?.name || '—'} />}
              <DetRow k="Programado" v={maintenance.scheduledDate ? String(maintenance.scheduledDate).slice(0, 10) : '—'} mono />
              {maintenance.description && <DetRow k="Descripción" v={maintenance.description} />}
              <DetRow k="Creado por" v={maintenance.createdBy?.name || '—'} />
              {maintenance.startedBy && <DetRow k="Iniciado por" v={maintenance.startedBy.name} />}
              {maintenance.closedBy && <DetRow k="Cerrado por" v={maintenance.closedBy.name} />}
            </div>
          </Card>
          <Card pad>
            <h3 className="nk-section-title" style={{ marginBottom: 14 }}>Actividad</h3>
            <div className="nk-timeline">
              <TLItem dot="var(--blue-600)" title="Mantenimiento creado" time={String(maintenance.createdAt).slice(0, 16).replace('T', ' ')} by={maintenance.createdBy?.name} last={!maintenance.startedAt} />
              {maintenance.startedAt && (
                <TLItem dot="var(--amber-500)" title="En ejecución" time={String(maintenance.startedAt).slice(0, 16).replace('T', ' ')} by={maintenance.startedBy?.name} last={!maintenance.completedAt} />
              )}
              {maintenance.completedAt && (
                <TLItem dot="var(--green-600)" title="Completado" time={String(maintenance.completedAt).slice(0, 16).replace('T', ' ')} by={maintenance.closedBy?.name} last />
              )}
            </div>
          </Card>
        </div>
      </div>

      {editing && <MaintenanceFormModal maintenance={maintenance} onClose={() => setEditing(false)} onSaved={reload} />}

      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar mantenimiento"
        message={`¿Deseas eliminar "${maintenance.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar mantenimiento"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDeleteMaintenance}
        onClose={() => { setConfirmingDelete(false); setDeleteError(''); }}
      >
        {deleteError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirmingAction}
        title={confirmingAction === 'start' ? 'Iniciar mantenimiento' : 'Completar mantenimiento'}
        message={confirmingAction ? ACTION_CONFIRM_MESSAGE[confirmingAction] : ''}
        confirmLabel={confirmingAction === 'start' ? 'Iniciar' : 'Completar'}
        busy={runningAction}
        icon="check-circle-2"
        onConfirm={runAction}
        onClose={() => { setConfirmingAction(null); setActionError(''); }}
      />
    </div>
  );
}
