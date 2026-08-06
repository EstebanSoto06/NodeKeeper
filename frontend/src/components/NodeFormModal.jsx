/* Formulario de Nodo de red (crear/editar), conectado a
   POST/PUT /network-nodes (backend/src/modules/network-nodes). El código
   debe ser único (409 si ya existe); se refleja como error de campo. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { validateRequired } from '../utils/formValidation.js';
import * as networkNodeService from '../services/networkNodeService.js';

const NODE_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

const EMPTY = { code: '', name: '', location: '', status: 'AVAILABLE' };

function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}

export function NodeFormModal({ node, initialCoords, onClose, onSaved }) {
  const editing = !!node;
  // Flujo de creacion desde el mapa (ver components/map/NodeMap.jsx +
  // pages/Map.jsx): la latitud/longitud ya vienen fijadas por el click y se
  // muestran de solo lectura, en vez de pedirselas de nuevo al usuario.
  const fromMap = !editing && !!initialCoords;
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
        status: v.status,
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
        setFieldErrors({ code: err.message });
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
        <Field label="Estado" error={fieldErrors.status}>
          <Select value={v.status} onChange={set('status')} options={NODE_STATUS_OPTIONS} />
        </Field>
      </div>
    </Modal>
  );
}
