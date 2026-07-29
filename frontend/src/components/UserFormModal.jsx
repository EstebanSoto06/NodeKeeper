/* Formulario de usuario (crear/editar), conectado a POST/PATCH /users.
   La contrasena solo se pide al crear (POST /users); editar nunca incluye
   contrasena -- el cambio posterior se hace con una operacion separada
   (ResetPasswordDialog -> PATCH /users/:id/password). Nunca se prellena ni
   se muestra un valor existente de contrasena, porque el backend nunca la
   expone (solo passwordHash, que tampoco viaja al cliente). */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button, IconButton } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import * as userService from '../services/userService.js';

const ROLE_OPTIONS = [
  { value: 'OPERATOR', label: 'Operador' },
  { value: 'ADMIN', label: 'Administrador' },
];

function emptyForm() {
  return { name: '', email: '', password: '', role: 'OPERATOR' };
}

function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}

export function UserFormModal({ user, isSelf, onClose, onSaved }) {
  const editing = !!user;
  const [v, setV] = useState(() =>
    editing ? { name: user.name, email: user.email, role: user.role, password: '' } : emptyForm(),
  );
  const [showPassword, setShowPassword] = useState(false);
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
        await userService.update(user.id, { name: v.name, email: v.email, role: v.role });
      } else {
        await userService.create({ name: v.name, email: v.email, password: v.password, role: v.role });
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
      } else {
        setFormError(err.message || 'No se pudo guardar el usuario.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar usuario' : 'Crear usuario'}
      subtitle={editing ? user.email : 'Registra una nueva cuenta de acceso'}
      icon="user-plus" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar usuario'}
          </Button>
        </>
      )}
    >
      {formError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <span>{formError}</span>
        </div>
      )}
      {isSelf && (
        <div className="nk-callout" style={{ marginBottom: 12 }}>
          <span>Estás editando tu propia cuenta.</span>
        </div>
      )}
      <div className="nk-form-grid">
        <div className="nk-col-2">
          <Field label="Nombre completo" required error={fieldErrors.name}>
            <TextInput value={v.name} onChange={set('name')} placeholder="Ana Vargas" error={fieldErrors.name} />
          </Field>
        </div>
        <div className="nk-col-2">
          <Field label="Correo institucional" required error={fieldErrors.email}>
            <TextInput value={v.email} onChange={set('email')} type="email" placeholder="ana.vargas@coopelesca.cr" error={fieldErrors.email} />
          </Field>
        </div>
        <Field label="Rol" required error={fieldErrors.role}>
          <Select value={v.role} onChange={set('role')} options={ROLE_OPTIONS} />
        </Field>
        {!editing && (
          <Field label="Contraseña" required error={fieldErrors.password}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <TextInput value={v.password} onChange={set('password')} type={showPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" error={fieldErrors.password} />
              </div>
              <IconButton
                name={showPassword ? 'eye' : 'lock'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((s) => !s)}
              />
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}
