/* Modales compartidos del módulo Proveedores:
   - ProviderFormModal: crear / editar proveedor (con validaciones visuales).
   - DeleteProviderModal: confirmación de eliminación (indica equipos afectados).
   - ProviderInfoModal: "Información del proveedor" (solo lectura + acciones).
   Todas las acciones son mock (operan sobre el store en memoria). */
import { useState } from 'react';
import { Modal, DataList } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput } from './Inputs.jsx';
import { addProvider, updateProvider, removeProvider, equipmentCountForProvider } from '../store/store.js';

const EMPTY = { companyName: '', supportPhone: '', supportEmail: '', contactName: '', contactPhone: '', contactEmail: '' };
const PHONE_RE = /^[0-9()+\-\s]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v) {
  const e = {};
  if (!v.companyName.trim()) e.companyName = 'Requerido.';
  if (!v.supportPhone.trim()) e.supportPhone = 'Requerido.';
  else if (!PHONE_RE.test(v.supportPhone)) e.supportPhone = 'Solo números y símbolos telefónicos.';
  if (!v.supportEmail.trim()) e.supportEmail = 'Requerido.';
  else if (!EMAIL_RE.test(v.supportEmail)) e.supportEmail = 'Correo no válido.';
  if (!v.contactName.trim()) e.contactName = 'Requerido.';
  if (!v.contactPhone.trim()) e.contactPhone = 'Requerido.';
  else if (!PHONE_RE.test(v.contactPhone)) e.contactPhone = 'Solo números y símbolos telefónicos.';
  if (!v.contactEmail.trim()) e.contactEmail = 'Requerido.';
  else if (!EMAIL_RE.test(v.contactEmail)) e.contactEmail = 'Correo no válido.';
  return e;
}

export function ProviderFormModal({ provider, onClose }) {
  const editing = !!provider;
  const [v, setV] = useState(provider ? { ...provider } : { ...EMPTY });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const submit = () => {
    const e = validate(v);
    setErrors(e); setTouched(true);
    if (Object.keys(e).length) return;
    if (editing) updateProvider(provider.id, v); else addProvider(v);
    onClose();
  };
  const err = (k) => (touched ? errors[k] : undefined);

  return (
    <Modal
      title={editing ? 'Editar proveedor' : 'Crear proveedor'}
      subtitle={editing ? provider.id : 'Registra un proveedor de soporte'}
      icon="building-2" size="md" onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit}>Guardar proveedor</Button>
        </>
      )}
    >
      <div className="nk-form-grid">
        <div className="nk-col-2">
          <Field label="Nombre de empresa" required error={err('companyName')}>
            <TextInput value={v.companyName} onChange={set('companyName')} placeholder="Soporte Técnico del Norte" error={err('companyName')} />
          </Field>
        </div>
        <Field label="Número de soporte" required error={err('supportPhone')}>
          <TextInput value={v.supportPhone} onChange={set('supportPhone')} placeholder="800-555-0101" error={err('supportPhone')} />
        </Field>
        <Field label="Correo de soporte" required error={err('supportEmail')}>
          <TextInput value={v.supportEmail} onChange={set('supportEmail')} type="email" placeholder="soporte@empresa.example" error={err('supportEmail')} />
        </Field>
        <Field label="Persona de contacto" required error={err('contactName')}>
          <TextInput value={v.contactName} onChange={set('contactName')} placeholder="Carlos Rodríguez" error={err('contactName')} />
        </Field>
        <Field label="Número de contacto" required error={err('contactPhone')}>
          <TextInput value={v.contactPhone} onChange={set('contactPhone')} placeholder="8888-1111" error={err('contactPhone')} />
        </Field>
        <div className="nk-col-2">
          <Field label="Correo de contacto" required error={err('contactEmail')}>
            <TextInput value={v.contactEmail} onChange={set('contactEmail')} type="email" placeholder="carlos.rodriguez@empresa.example" error={err('contactEmail')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function DeleteProviderModal({ provider, onClose, onDeleted }) {
  const count = equipmentCountForProvider(provider.id);
  // onClose: solo cancelar/cerrar (no navega). onDeleted: tras confirmar borrado.
  const confirm = () => { removeProvider(provider.id); (onDeleted || onClose)(); };
  return (
    <Modal
      title="Eliminar proveedor" subtitle={provider.companyName} icon="trash-2" size="sm" onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" icon="trash-2" onClick={confirm}>Eliminar proveedor</Button>
        </>
      )}
    >
      {count > 0 ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--fg-1)' }}>
          Este proveedor está asociado con <b className="nk-mono">{count}</b> {count === 1 ? 'equipo' : 'equipos'}.
          Si lo eliminas, {count === 1 ? 'ese equipo pasará' : 'estos equipos pasarán'} a tener el proveedor de soporte como <b>“No asignado”</b>.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--fg-1)' }}>¿Deseas eliminar este proveedor?</p>
      )}
    </Modal>
  );
}

export function ProviderInfoModal({ provider, onClose, onGoToProvider, onEdit, role }) {
  const count = equipmentCountForProvider(provider.id);
  return (
    <Modal
      title="Información del proveedor" subtitle={provider.id} icon="building-2" size="md" onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {role === 'admin' && onEdit && <Button variant="secondary" icon="pencil" onClick={() => { onClose(); onEdit(provider); }}>Editar proveedor</Button>}
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
        { k: 'Equipos asociados', v: count, mono: true },
      ]} />
    </Modal>
  );
}
