/* Formulario de Nodo de red (crear/editar), conectado a
   POST/PUT /network-nodes (backend/src/modules/network-nodes). El código
   debe ser único (409 si ya existe); se refleja como error de campo. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
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

export function NodeFormModal({ node, onClose, onSaved }) {
  const editing = !!node;
  const [v, setV] = useState(node ? { ...EMPTY, ...node } : { ...EMPTY });
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
        code: v.code,
        name: v.name,
        location: v.location || null,
        status: v.status,
      };
      if (editing) {
        await networkNodeService.update(node.id, payload);
      } else {
        await networkNodeService.create(payload);
      }
      onSaved && onSaved();
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
      title={editing ? 'Editar nodo' : 'Crear nodo'}
      subtitle={editing ? node.code : 'Registra un nodo de red'}
      icon="share-2" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar nodo'}
          </Button>
        </>
      )}
    >
      {formError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <span>{formError}</span>
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
