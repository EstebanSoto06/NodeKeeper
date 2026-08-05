/* Formulario de mantenimiento (crear/editar), conectado a POST/PUT
   /maintenances. El backend exige exclusividad segun el tipo real
   (maintenance.service.js#prepareMaintenanceData):
   - PREVENTIVE requiere networkNodeId (equipmentId se envia null).
   - CORRECTIVE requiere equipmentId (networkNodeId se envia null).
   Solo existen los campos reales del schema: title, description, type,
   scheduledDate, networkNodeId, equipmentId. No hay prioridad, responsable,
   recurrencia ni ejecucion interna/terceros en el backend real.

   El Nodo se muestra SIEMPRE (para ambos tipos), no solo en preventivo: en
   correctivo funciona ademas como filtro del select de Equipo, para poder
   cambiar de nodo sin cerrar el modal. El payload sigue enviando
   equipmentId como referencia principal en correctivo (networkNodeId null),
   tal como lo exige el backend.

   La validacion de campos obligatorios (title, scheduledDate, networkNodeId,
   y equipmentId solo si es correctivo) se hace en frontend ANTES de llamar
   la API: el backend valida title via Zod (con errors[] por campo), pero
   scheduledDate es opcional en su schema y el chequeo de red/equipo
   (prepareMaintenanceData) lanza un 400 plano sin errors[] -- sin esta
   validacion previa, un select o fecha vacios solo mostraban un mensaje
   generico en ingles, nunca marcados en el campo. Ver utils/formValidation.js. */
import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { validateRequired } from '../utils/formValidation.js';
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
          // Preventivo: el nodo es el propio maintenance.networkNodeId.
          // Correctivo: el backend no guarda networkNodeId (viaja null); se
          // deriva del equipo incluido en la respuesta (maintenance.equipment
          // .networkNodeId). Si por algun motivo no vino incluido, el efecto
          // de abajo lo busca en equipmentList una vez cargue.
          networkNodeId: maintenance.type === 'PREVENTIVE'
            ? (maintenance.networkNodeId || '')
            : (maintenance.equipment?.networkNodeId || ''),
          equipmentId: maintenance.equipmentId || '',
        }
      : emptyForm(),
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  // Respaldo de la derivacion de networkNodeId en edicion correctiva: solo
  // actua si maintenance.equipment no vino incluido (no deberia pasar dado
  // el include real del backend, pero se cubre por robustez).
  useEffect(() => {
    if (!editing || maintenance.type !== 'CORRECTIVE' || v.networkNodeId) return;
    const eq = equipmentList.find((e) => e.id === maintenance.equipmentId);
    if (eq?.networkNodeId) setV((s) => ({ ...s, networkNodeId: eq.networkNodeId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentList.length]);

  // Cambiar el nodo limpia el equipo seleccionado (podria no pertenecer al
  // nodo nuevo) y recalcula la lista filtrada de abajo.
  function handleNodeChange(nodeId) {
    setV((s) => ({ ...s, networkNodeId: nodeId, equipmentId: '' }));
  }

  const equipmentForNode = v.networkNodeId ? equipmentList.filter((e) => e.networkNodeId === v.networkNodeId) : [];

  const submit = async () => {
    const required = [
      { key: 'title', label: 'Título', value: v.title },
      { key: 'scheduledDate', label: 'Fecha programada', value: v.scheduledDate },
      { key: 'networkNodeId', label: 'Nodo', value: v.networkNodeId },
      ...(v.type === 'CORRECTIVE' ? [{ key: 'equipmentId', label: 'Equipo', value: v.equipmentId }] : []),
    ];
    const { isValid, fieldErrors: missingErrors, formError: missingError } = validateRequired(required);
    if (!isValid) {
      setFieldErrors(missingErrors);
      setFormError(missingError);
      return;
    }

    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      const payload = {
        title: v.title,
        description: v.description ? v.description : null,
        type: v.type,
        scheduledDate: v.scheduledDate,
        networkNodeId: v.type === 'PREVENTIVE' ? v.networkNodeId : null,
        equipmentId: v.type === 'CORRECTIVE' ? v.equipmentId : null,
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
  const equipmentOptions = equipmentForNode.map((e) => ({ value: e.id, label: e.name }));

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
          <Field label="Fecha programada" required error={fieldErrors.scheduledDate}>
            <TextInput type="date" value={v.scheduledDate} onChange={set('scheduledDate')} error={fieldErrors.scheduledDate} />
          </Field>
          <div className="nk-col-2">
            <Field label="Nodo" required error={fieldErrors.networkNodeId}>
              <Select
                value={v.networkNodeId}
                onChange={handleNodeChange}
                error={fieldErrors.networkNodeId}
                options={[{ value: '', label: 'Selecciona un nodo…' }, ...nodeOptions]}
              />
            </Field>
          </div>
          {v.type === 'CORRECTIVE' && (
            <div className="nk-col-2">
              <Field label="Equipo" required error={fieldErrors.equipmentId}>
                <Select
                  value={v.equipmentId}
                  onChange={set('equipmentId')}
                  disabled={!v.networkNodeId}
                  error={fieldErrors.equipmentId}
                  options={[
                    { value: '', label: v.networkNodeId ? 'Selecciona un equipo…' : 'Primero selecciona un nodo…' },
                    ...equipmentOptions,
                  ]}
                />
                {v.networkNodeId && equipmentForNode.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'block' }}>
                    Este nodo no tiene equipos registrados.
                  </span>
                )}
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
