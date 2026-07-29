/* Modales de Proveedores conectados a la API real (backend/src/modules/support-providers).
   ProviderFormModal: crear/editar via POST /support-providers y PUT /support-providers/:id.
   ProviderInfoModal: popup de solo lectura reutilizado desde EquipmentDetail. */
import { useState } from 'react';
import { Modal, DataList } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput } from './Inputs.jsx';
import * as supportProviderService from '../services/supportProviderService.js';

const EMPTY = { companyName: '', supportPhone: '', supportEmail: '', contactName: '', contactPhone: '', contactEmail: '' };

// Mapea ApiError.errors ([{path,message}]) a un objeto {campo: mensaje} para
// mostrarlo bajo cada Field del formulario.
function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}

export function ProviderFormModal({ provider, onClose, onSaved }) {
  const editing = !!provider;
  const [v, setV] = useState(provider ? { ...EMPTY, ...provider } : { ...EMPTY });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      if (editing) {
        await supportProviderService.update(provider.id, v);
      } else {
        await supportProviderService.create(v);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
      } else {
        setFormError(err.message || 'No se pudo guardar el proveedor.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar proveedor' : 'Crear proveedor'}
      subtitle={editing ? provider.id : 'Registra un proveedor de soporte'}
      icon="building-2" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar proveedor'}
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
        <div className="nk-col-2">
          <Field label="Nombre de empresa" required error={fieldErrors.companyName}>
            <TextInput value={v.companyName} onChange={set('companyName')} placeholder="Soporte Técnico del Norte" error={fieldErrors.companyName} />
          </Field>
        </div>
        <Field label="Número de soporte" required error={fieldErrors.supportPhone}>
          <TextInput value={v.supportPhone} onChange={set('supportPhone')} placeholder="800-555-0101" error={fieldErrors.supportPhone} />
        </Field>
        <Field label="Correo de soporte" required error={fieldErrors.supportEmail}>
          <TextInput value={v.supportEmail} onChange={set('supportEmail')} type="email" placeholder="soporte@empresa.example" error={fieldErrors.supportEmail} />
        </Field>
        <Field label="Persona de contacto" required error={fieldErrors.contactName}>
          <TextInput value={v.contactName} onChange={set('contactName')} placeholder="Carlos Rodríguez" error={fieldErrors.contactName} />
        </Field>
        <Field label="Número de contacto" required error={fieldErrors.contactPhone}>
          <TextInput value={v.contactPhone} onChange={set('contactPhone')} placeholder="8888-1111" error={fieldErrors.contactPhone} />
        </Field>
        <div className="nk-col-2">
          <Field label="Correo de contacto" required error={fieldErrors.contactEmail}>
            <TextInput value={v.contactEmail} onChange={set('contactEmail')} type="email" placeholder="carlos.rodriguez@empresa.example" error={fieldErrors.contactEmail} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* Popup de solo lectura. Se reutiliza desde EquipmentDetail ("Ver proveedor"). */
export function ProviderInfoModal({ provider, onClose, onGoToProvider, onEdit, isAdmin }) {
  return (
    <Modal
      title="Información del proveedor" subtitle={provider.id} icon="building-2" size="md" onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {isAdmin && onEdit && <Button variant="secondary" icon="pencil" onClick={() => { onClose(); onEdit(provider); }}>Editar proveedor</Button>}
          {onGoToProvider && <Button variant="primary" icon="arrow-right" onClick={() => { onClose(); onGoToProvider(provider.id); }}>Ir al proveedor</Button>}
        </>
      )}
    >
      <DataList items={[
        { k: 'Empresa', v: provider.companyName },
        { k: 'Número de soporte', v: provider.supportPhone, mono: true },
        { k: 'Correo de soporte', v: provider.supportEmail },
        { k: 'Persona de contacto', v: provider.contactName },
        { k: 'Número de contacto', v: provider.contactPhone, mono: true },
        { k: 'Correo de contacto', v: provider.contactEmail },
      ]} />
    </Modal>
  );
}
