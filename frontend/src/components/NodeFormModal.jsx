/* Formulario de Nodo de red (crear/editar), conectado a
   POST/PUT /network-nodes (backend/src/modules/network-nodes). El código
   debe ser único (409 si ya existe); se refleja como error de campo. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { AutomaticStatusField } from './AutomaticStatusField.jsx';
import {
  validateRequired,
  fieldErrorsFrom,
  conflictErrorsFrom,
  DUPLICATE_NODE_CODE_MESSAGE,
} from '../utils/formValidation.js';
import * as networkNodeService from '../services/networkNodeService.js';

/* "En mantenimiento" NO esta entre las opciones: es un estado AUTOMATICO que
   escribe el backend al iniciar un mantenimiento y retira al completarlo (ver
   maintenance.service.js). PUT /network-nodes/:id rechaza con 409 cualquier
   intento de asignarlo a mano, asi que ofrecerlo aqui solo produciria un
   error. Los dos estados de abajo son los unicos que decide una persona. */
const NODE_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

const AUTOMATIC_STATUS = 'MAINTENANCE';

const EMPTY = { code: '', name: '', location: '', status: 'AVAILABLE' };

export function NodeFormModal({ node, initialCoords, onClose, onSaved }) {
  const editing = !!node;
  // Flujo de creacion desde el mapa (ver components/map/NodeMap.jsx +
  // pages/Map.jsx): la latitud/longitud ya vienen fijadas por el click y se
  // muestran de solo lectura, en vez de pedirselas de nuevo al usuario.
  const fromMap = !editing && !!initialCoords;
  // El nodo esta bajo el estado automatico: se muestra de solo lectura y el
  // formulario no lo toca (ver el payload y el campo Estado mas abajo).
  const underMaintenance = editing && node.status === AUTOMATIC_STATUS;
  // Unica transicion manual admitida durante una orden activa: el backend
  // acepta OUT_OF_SERVICE (tiene prioridad sobre MAINTENANCE) y rechaza con
  // 409 cualquier vuelta a AVAILABLE. Se guarda como intencion y viaja en el
  // PUT del formulario; `underMaintenance` sigue derivandose del estado
  // PERSISTIDO, para que marcarla nunca haga aparecer el select con
  // "Disponible" entre sus opciones.
  const [markOutOfService, setMarkOutOfService] = useState(false);
  const [v, setV] = useState(node ? { ...EMPTY, ...node } : { ...EMPTY });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    const { isValid, fieldErrors: missingErrors, formError: missingError } = validateRequired([
      { key: 'code', label: 'Código', value: v.code },
      { key: 'name', label: 'Nombre', value: v.name },
    ]);
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
        code: v.code,
        name: v.name,
        location: v.location || null,
        // Con el estado automatico activo el campo `status` NO viaja: el
        // backend lo conserva tal cual, y asi editar el nombre o la ubicacion
        // de un nodo en mantenimiento nunca depende de reenviar un estado que
        // el usuario no controla. La excepcion es haber pedido explicitamente
        // "Marcar fuera de servicio", la unica transicion manual que el
        // backend admite mientras la orden sigue en ejecucion.
        ...(underMaintenance
          ? (markOutOfService ? { status: 'OUT_OF_SERVICE' } : {})
          : { status: v.status }),
        ...(fromMap ? { latitude: initialCoords.latitude, longitude: initialCoords.longitude } : {}),
      };
      let result;
      if (editing) {
        result = await networkNodeService.update(node.id, payload);
      } else {
        result = await networkNodeService.create(payload);
      }
      onSaved && onSaved(result?.networkNode);
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
      } else if (err.status === 409) {
        // Solo la duplicidad de codigo pertenece a un campo. El resto de
        // conflictos (reglas de mantenimiento, concurrencia) son del
        // registro completo y se muestran como error general del modal.
        const conflict = conflictErrorsFrom(err, {
          field: 'code',
          duplicateMessage: DUPLICATE_NODE_CODE_MESSAGE,
        });
        setFieldErrors(conflict.fieldErrors);
        setFormError(conflict.formError);
      } else {
        setFormError(err.message || 'No se pudo guardar el nodo.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar nodo' : fromMap ? 'Crear nodo en esta ubicación' : 'Crear nodo'}
      subtitle={editing ? node.code : fromMap ? `${initialCoords.latitude.toFixed(6)}, ${initialCoords.longitude.toFixed(6)}` : 'Registra un nodo de red'}
      icon="share-2" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : fromMap ? 'Crear nodo aquí' : 'Guardar nodo'}
          </Button>
        </>
      )}
    >
      {formError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <span>{formError}</span>
        </div>
      )}
      {fromMap && (
        <div className="nk-callout" style={{ marginBottom: 12 }}>
          <span>
            Latitud: <span className="nk-mono">{initialCoords.latitude.toFixed(6)}</span>{' · '}
            Longitud: <span className="nk-mono">{initialCoords.longitude.toFixed(6)}</span>
          </span>
        </div>
      )}
      <div className="nk-form-grid">
        <Field label="Código" required error={fieldErrors.code}>
          <TextInput value={v.code} onChange={set('code')} placeholder="NODO-014" error={fieldErrors.code} />
        </Field>
        <Field label="Nombre" required error={fieldErrors.name}>
          <TextInput value={v.name} onChange={set('name')} placeholder="Subestación San Isidro" error={fieldErrors.name} />
        </Field>
        <div className="nk-col-2">
          <Field label="Ubicación" error={fieldErrors.location}>
            <TextInput value={v.location || ''} onChange={set('location')} placeholder="San Isidro de El General" error={fieldErrors.location} />
          </Field>
        </div>
        {underMaintenance ? (
          <AutomaticStatusField
            kind="node"
            resourceLabel="el nodo"
            markedOutOfService={markOutOfService}
            onToggle={setMarkOutOfService}
          />
        ) : (
          <Field label="Estado" error={fieldErrors.status}>
            <Select value={v.status} onChange={set('status')} options={NODE_STATUS_OPTIONS} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
