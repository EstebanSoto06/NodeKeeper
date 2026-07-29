/* Formulario de mantenimiento (crear/editar), conectado a POST/PUT
   /maintenances. El backend exige exclusividad segun el tipo real
   (maintenance.service.js#prepareMaintenanceData):
   - PREVENTIVE requiere networkNodeId (equipmentId se envia null).
   - CORRECTIVE requiere equipmentId (networkNodeId se envia null).
   Solo existen los campos reales del schema: title, description, type,
   scheduledDate, networkNodeId, equipmentId. No hay prioridad, responsable,
   recurrencia ni ejecucion interna/terceros en el backend real. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

const TYPE_OPTIONS = [
  { value: 'PREVENTIVE', label: 'Preventivo' },
  { value: 'CORRECTIVE', label: 'Correctivo' },
];

function emptyForm() {
  return { title: '', description: '', type: 'PREVENTIVE', scheduledDate: '', networkNodeId: '', equipmentId: '' };
}

function toDateInputValue(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}

export function MaintenanceFormModal({ maintenance, onClose, onSaved }) {
  const editing = !!maintenance;

  const { data: nodesData, loading: nodesLoading } = useAsync(() => networkNodeService.list(), []);
  const { data: equipData, loading: equipLoading } = useAsync(() => equipmentService.list(), []);
  const nodes = nodesData?.networkNodes ?? [];
  const equipmentList = equipData?.equipment ?? [];
  const optionsLoading = nodesLoading || equipLoading;

  const [v, setV] = useState(() =>
    maintenance
      ? {
          title: maintenance.title,
          description: maintenance.description || '',
          type: maintenance.type,
          scheduledDate: toDateInputValue(maintenance.scheduledDate),
          networkNodeId: maintenance.networkNodeId || '',
          equipmentId: maintenance.equipmentId || '',
        }
      : emptyForm(),
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      const payload = {
        title: v.title,
        description: v.description ? v.description : null,
        type: v.type,
        scheduledDate: v.scheduledDate ? v.scheduledDate : null,
        networkNodeId: v.type === 'PREVENTIVE' ? (v.networkNodeId || null) : null,
        equipmentId: v.type === 'CORRECTIVE' ? (v.equipmentId || null) : null,
      };
      if (editing) {
        await maintenanceService.update(maintenance.id, payload);
      } else {
        await maintenanceService.create(payload);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
      } else {
        setFormError(err.message || 'No se pudo guardar el mantenimiento.');
      }
    } finally {
      setSaving(false);
    }
  };

  const nodeOptions = nodes.map((n) => ({ value: n.id, label: `${n.name} (${n.code})` }));
  const equipmentOptions = equipmentList.map((e) => ({ value: e.id, label: e.name }));

  return (
    <Modal
      title={editing ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}
      subtitle={editing ? maintenance.title : 'Registra una orden de mantenimiento'}
      icon="wrench" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving || optionsLoading}>
            {saving ? 'Guardando…' : 'Guardar mantenimiento'}
          </Button>
        </>
      )}
    >
      {formError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <span>{formError}</span>
        </div>
      )}
      {optionsLoading ? (
        <LoadingSkeleton lines={4} />
      ) : (
        <div className="nk-form-grid">
          <div className="nk-col-2">
            <Field label="Título" required error={fieldErrors.title}>
              <TextInput value={v.title} onChange={set('title')} placeholder="Mantenimiento preventivo trimestral" error={fieldErrors.title} />
            </Field>
          </div>
          <Field label="Tipo" required error={fieldErrors.type}>
            <Select value={v.type} onChange={set('type')} options={TYPE_OPTIONS} />
          </Field>
          <Field label="Fecha programada" error={fieldErrors.scheduledDate}>
            <TextInput type="date" value={v.scheduledDate} onChange={set('scheduledDate')} error={fieldErrors.scheduledDate} />
          </Field>
          {v.type === 'PREVENTIVE' ? (
            <div className="nk-col-2">
              <Field label="Nodo" required error={fieldErrors.networkNodeId}>
                <Select value={v.networkNodeId} onChange={set('networkNodeId')} options={[{ value: '', label: 'Selecciona un nodo…' }, ...nodeOptions]} />
              </Field>
            </div>
          ) : (
            <div className="nk-col-2">
              <Field label="Equipo" required error={fieldErrors.equipmentId}>
                <Select value={v.equipmentId} onChange={set('equipmentId')} options={[{ value: '', label: 'Selecciona un equipo…' }, ...equipmentOptions]} />
              </Field>
            </div>
          )}
          <div className="nk-col-2">
            <Field label="Descripción" error={fieldErrors.description}>
              <TextInput value={v.description} onChange={set('description')} placeholder="Opcional" error={fieldErrors.description} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
