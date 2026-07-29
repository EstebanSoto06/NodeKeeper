/* Restablecimiento administrativo de contrasena, conectado a
   PATCH /users/:id/password. Operacion separada del formulario de edicion
   (que nunca toca la contrasena) porque el backend la trata como una
   accion distinta: no requiere la contrasena anterior (es un reset por un
   ADMIN, no un cambio por el propio usuario), y nunca se prellena ni se
   registra en ningun lado. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button, IconButton } from './Button.jsx';
import { Field, TextInput } from './Inputs.jsx';
import * as userService from '../services/userService.js';

export function ResetPasswordDialog({ user, onClose, onSaved }) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await userService.resetPassword(user.id, newPassword);
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Restablecer contraseña"
      subtitle={user.email}
      icon="lock" size="sm" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving || newPassword.length < 8}>
            {saving ? 'Guardando…' : 'Restablecer contraseña'}
          </Button>
        </>
      )}
    >
      {error && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <span>{error}</span>
        </div>
      )}
      <Field label="Nueva contraseña" required>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <TextInput value={newPassword} onChange={setNewPassword} type={showPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" />
          </div>
          <IconButton
            name={showPassword ? 'eye' : 'lock'}
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShowPassword((s) => !s)}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4, display: 'block' }}>
          Mínimo 8 caracteres. La persona deberá usarla en su próximo inicio de sesión.
        </span>
      </Field>
    </Modal>
  );
}
