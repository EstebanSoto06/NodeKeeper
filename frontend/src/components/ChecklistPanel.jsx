/* Panel de checklist embebido en MaintenanceDetail. Conectado a
   /maintenances/:maintenanceId/checklist-tasks (backend/src/modules/checklist-tasks).

   Reglas reales del backend (ver checklist-task.service.js):
   - Estructura (crear/editar/eliminar tarea): solo ADMIN, solo con el
     mantenimiento SCHEDULED (409 en otro estado).
   - Marcar/desmarcar (PATCH .../status con { isCompleted }): ADMIN u
     OPERATOR, solo con el mantenimiento IN_PROGRESS (409 en otro estado).
   - COMPLETED: todo de solo lectura.
   El progreso se recalcula localmente tras cada cambio via onChanged (que
   dispara un reload del detalle completo en el padre). */
import { useState } from 'react';
import { Card, ProgressBar } from './Card.jsx';
import { Button, IconButton } from './Button.jsx';
import { Field, TextInput } from './Inputs.jsx';
import { Icon } from './Icon.jsx';
import { EmptyState } from './EmptyState.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import * as checklistTaskService from '../services/checklistTaskService.js';

function pctOf(tasks) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.isCompleted).length / tasks.length) * 100);
}

export function ChecklistPanel({ maintenanceId, status, tasks, loading, onChanged }) {
  const perms = usePermissions();
  const canStructure = perms.canManageChecklistStructureFor(status);
  const canToggle = perms.canToggleChecklistFor(status);

  const [creating, setCreating] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingTask, setDeletingTask] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [togglingId, setTogglingId] = useState(null);
  const [toggleError, setToggleError] = useState('');

  const pct = pctOf(tasks);

  const submitCreate = async () => {
    if (!newDescription.trim()) return;
    setSavingNew(true);
    setCreateError('');
    try {
      await checklistTaskService.create(maintenanceId, { description: newDescription.trim(), sortOrder: tasks.length });
      setNewDescription('');
      setCreating(false);
      onChanged();
    } catch (err) {
      setCreateError(err.message || 'No se pudo crear la tarea.');
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditDescription(task.description);
    setEditError('');
  };

  const submitEdit = async (task) => {
    if (!editDescription.trim()) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await checklistTaskService.update(maintenanceId, task.id, { description: editDescription.trim(), sortOrder: task.sortOrder });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setEditError(err.message || 'No se pudo editar la tarea.');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await checklistTaskService.remove(maintenanceId, deletingTask.id);
      setDeletingTask(null);
      onChanged();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar la tarea.');
    } finally {
      setDeleting(false);
    }
  };

  const toggle = async (task) => {
    setTogglingId(task.id);
    setToggleError('');
    try {
      await checklistTaskService.setStatus(maintenanceId, task.id, { isCompleted: !task.isCompleted });
      onChanged();
    } catch (err) {
      setToggleError(err.message || 'No se pudo actualizar la tarea.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Card pad={false}>
      <div className="nk-card-head">
        <h3 className="nk-section-title">Checklist</h3>
        <span className="nk-mono" style={{ fontSize: 13, fontWeight: 600, color: pct === 100 ? 'var(--green-700)' : 'var(--amber-700)' }}>{pct}%</span>
      </div>
      <div style={{ padding: '0 18px' }}><ProgressBar value={pct} /></div>

      {loading ? (
        <div style={{ padding: 18 }}><LoadingSkeleton lines={3} /></div>
      ) : (
        <div className="nk-checklist">
          {toggleError && <div className="nk-callout" role="alert" style={{ margin: '0 18px 10px' }}><span>{toggleError}</span></div>}
          {tasks.map((t) => (
            <div key={t.id} className={`nk-task ${t.isCompleted ? 'is-done' : ''}`} style={{ cursor: 'default' }}>
              {editingId === t.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '6px 0' }}>
                  <TextInput value={editDescription} onChange={setEditDescription} />
                  <IconButton name="check" title="Guardar" onClick={() => submitEdit(t)} style={{ width: 30, height: 30 }} />
                  <IconButton name="x" title="Cancelar" onClick={() => setEditingId(null)} style={{ width: 30, height: 30 }} />
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`nk-check ${t.isCompleted ? 'is-done' : ''}`}
                    onClick={() => canToggle && toggle(t)}
                    disabled={!canToggle || togglingId === t.id}
                    aria-label={t.isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
                    style={{ cursor: canToggle ? 'pointer' : 'default', background: t.isCompleted ? undefined : 'transparent', padding: 0 }}
                  >
                    {t.isCompleted && <Icon name="check" size={12} />}
                  </button>
                  <span className="nk-task-label" style={{ flex: 1 }}>{t.description}</span>
                  {t.isCompleted && t.completedBy && (
                    <span className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginRight: 8 }}>
                      {t.completedBy.name}{t.completedAt ? ` · ${String(t.completedAt).slice(0, 10)}` : ''}
                    </span>
                  )}
                  {canStructure && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconButton name="pencil" title="Editar" onClick={() => startEdit(t)} style={{ width: 28, height: 28 }} />
                      <IconButton name="trash-2" title="Eliminar" onClick={() => setDeletingTask(t)} style={{ width: 28, height: 28 }} />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {editError && <div className="nk-callout" role="alert" style={{ margin: '0 18px 10px' }}><span>{editError}</span></div>}
          {tasks.length === 0 && <EmptyState icon="check-circle-2" title="Sin tareas" subtitle="Este mantenimiento no tiene tareas de checklist." />}
        </div>
      )}

      {canStructure && (
        <div style={{ padding: '10px 18px 18px' }}>
          {creating ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Field error={createError}>
                  <TextInput value={newDescription} onChange={setNewDescription} placeholder="Descripción de la tarea" error={createError} />
                </Field>
              </div>
              <Button variant="primary" size="sm" icon="check" onClick={submitCreate} disabled={savingNew}>Agregar</Button>
              <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setNewDescription(''); setCreateError(''); }} disabled={savingNew}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" icon="plus" onClick={() => setCreating(true)}>Agregar tarea</Button>
          )}
        </div>
      )}

      <div className="nk-card-foot">
        <span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tasks.filter((t) => t.isCompleted).length}/{tasks.length} tareas</span>
      </div>

      <ConfirmDialog
        open={!!deletingTask}
        title="Eliminar tarea"
        message={deletingTask ? `¿Deseas eliminar la tarea "${deletingTask.description}"?` : ''}
        confirmLabel="Eliminar tarea"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDelete}
        onClose={() => { setDeletingTask(null); setDeleteError(''); }}
      >
        {deleteError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>}
      </ConfirmDialog>
    </Card>
  );
}
