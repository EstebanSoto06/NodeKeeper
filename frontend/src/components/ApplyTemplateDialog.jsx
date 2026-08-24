/* Diálogo para cargar una lista de tareas predeterminada en el checklist de
   un mantenimiento. Conectado a
   POST /maintenances/:id/checklist-tasks/apply-template.

   Reglas reales del backend (checklist-task.service.js#applyChecklistTemplate),
   que este diálogo refleja pero NO sustituye:
   - solo ADMIN;
   - solo con el mantenimiento SCHEDULED (mismo 409 que crear una tarea);
   - las tareas de la plantilla se AGREGAN al final: ninguna tarea existente
     se elimina ni se reemplaza;
   - los duplicados CONTRA el checklist existente están permitidos. Aquí solo
     se advierten, nunca se bloquean: un checklist es una lista de pasos, no
     un conjunto, y una misma tarea puede repetirse a propósito.

   La lista de plantillas se carga al abrir. Como GET /checklist-templates es
   ADMIN-only, este componente solo debe montarse para ese rol. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, Select } from './Inputs.jsx';
import { Icon } from './Icon.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { EmptyState } from './EmptyState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { findOverlappingDescriptions } from '../utils/checklistTemplates.js';
import * as checklistTemplateService from '../services/checklistTemplateService.js';
import { showToast } from '../store/store.js';

export function ApplyTemplateDialog({ maintenanceId, existingTasks = [], onClose, onApplied }) {
  const { data, error, loading } = useAsync(() => checklistTemplateService.list(), []);
  const templates = data?.checklistTemplates ?? [];

  const [selectedId, setSelectedId] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const selected = templates.find((template) => template.id === selectedId) ?? null;
  const items = selected?.items ?? [];
  const overlapping = selected ? findOverlappingDescriptions(existingTasks, items) : [];

  const confirm = async () => {
    if (!selected) return;

    setApplying(true);
    setApplyError('');
    try {
      await checklistTemplateService.applyToMaintenance(maintenanceId, selected.id);
      showToast(
        items.length === 1
          ? 'Se agregó 1 tarea al checklist.'
          : `Se agregaron ${items.length} tareas al checklist.`,
      );
      onApplied && onApplied();
      onClose();
    } catch (err) {
      // El 409 (estado ya no es SCHEDULED) y el 404 (plantilla eliminada
      // entre la carga y la confirmación) se muestran sin cerrar el diálogo.
      setApplyError(err.message || 'No se pudo aplicar la lista de tareas.');
    } finally {
      setApplying(false);
    }
  };

  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: `${template.name} (${template.items?.length ?? 0} ${
      (template.items?.length ?? 0) === 1 ? 'tarea' : 'tareas'
    })`,
  }));

  return (
    <Modal
      title="Cargar lista predeterminada"
      subtitle="Las tareas de la lista se copian al checklist de este mantenimiento"
      icon="list"
      size="md"
      onClose={applying ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={applying}>Cancelar</Button>
          <Button
            variant="primary"
            icon="plus"
            onClick={confirm}
            disabled={applying || !selected || items.length === 0}
          >
            {applying
              ? 'Agregando…'
              : items.length > 0
                ? `Agregar ${items.length} ${items.length === 1 ? 'tarea' : 'tareas'}`
                : 'Agregar tareas'}
          </Button>
        </>
      )}
    >
      {applyError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <Icon name="alert-circle" size={15} /><span>{applyError}</span>
        </div>
      )}

      {loading && <LoadingSkeleton lines={3} />}

      {!loading && error && (
        <div className="nk-callout" role="alert">
          <Icon name="alert-circle" size={15} />
          <span>{error.message || 'No se pudieron cargar las listas de tareas.'}</span>
        </div>
      )}

      {!loading && !error && templates.length === 0 && (
        <EmptyState
          icon="list"
          title="Sin listas de tareas"
          subtitle="Aún no hay listas predeterminadas. Puedes crearlas en Administración › Plantillas de checklist."
        />
      )}

      {!loading && !error && templates.length > 0 && (
        <>
          <Field label="Lista de tareas">
            <Select
              value={selectedId}
              onChange={setSelectedId}
              options={[{ value: '', label: 'Selecciona una lista…' }, ...templateOptions]}
            />
          </Field>

          {selected && (
            <div style={{ marginTop: 14 }}>
              <span className="nk-field-label" style={{ display: 'block', marginBottom: 8 }}>
                Se agregarán {items.length} {items.length === 1 ? 'tarea' : 'tareas'}:
              </span>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((item) => (
                  <li key={item.id} style={{ fontSize: 13 }}>{item.description}</li>
                ))}
              </ul>

              {existingTasks.length > 0 && (
                <div className="nk-callout" style={{ marginTop: 12 }}>
                  <span>
                    El checklist ya tiene <b className="nk-mono">{existingTasks.length}</b>{' '}
                    {existingTasks.length === 1 ? 'tarea' : 'tareas'}. Las nuevas se{' '}
                    <b>agregan</b>: ninguna tarea existente se reemplaza ni se elimina.
                  </span>
                </div>
              )}

              {overlapping.length > 0 && (
                <div className="nk-callout" role="status" style={{ marginTop: 12 }}>
                  <Icon name="alert-circle" size={15} />
                  <span>
                    Esta lista contiene <b className="nk-mono">{overlapping.length}</b>{' '}
                    {overlapping.length === 1
                      ? 'tarea con un nombre que ya existe'
                      : 'tareas con nombres que ya existen'}{' '}
                    en el mantenimiento ({overlapping.map((text) => `«${text}»`).join(', ')}).
                    Si continúas, también serán agregadas.
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
