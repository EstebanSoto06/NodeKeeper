/* Usuarios y roles, conectado a GET/POST/PATCH /users (backend/src/modules/users).
   Exclusivo de ADMIN: esta pantalla solo se monta bajo una ProtectedRoute
   con roles={['ADMIN']} (ver AppRoutes.jsx); un OPERATOR que intente entrar
   por URL directa ve AccessDenied antes de llegar aqui. No existe DELETE:
   el modelo prefiere activar/desactivar sobre el borrado fisico. */
import { useState } from 'react';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { PageHeader, Avatar, initialsFromName } from '../components/Misc.jsx';
import { SearchInput, FilterChips } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Icon } from '../components/Icon.jsx';
import { UserFormModal } from '../components/UserFormModal.jsx';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import * as userService from '../services/userService.js';
import { roleLabel } from '../utils/roleLabels.js';
import { showToast } from '../store/store.js';

const ROLE_FILTERS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'ADMIN', label: 'Administrador', dot: 'var(--blue-600)' },
  { value: 'OPERATOR', label: 'Operador', dot: 'var(--gray-400)' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos', dot: 'var(--green-500)' },
  { value: 'inactive', label: 'Inactivos', dot: 'var(--gray-400)' },
];

export function Users() {
  const { user: currentUser } = useAuth();
  const { data, error, loading, reload } = useAsync(() => userService.list(), []);
  const users = data?.users ?? [];

  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [formUser, setFormUser] = useState(undefined); // undefined=cerrado, null=crear, obj=editar
  const [resettingUser, setResettingUser] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null); // { user, nextActive }
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');

  const rows = users.filter((u) =>
    (role === 'all' || u.role === role) &&
    (status === 'all' || (status === 'active' ? u.isActive : !u.isActive)) &&
    (q === '' || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase())));

  const admins = users.filter((u) => u.role === 'ADMIN' && u.isActive).length;

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setStatusBusy(true);
    setStatusError('');
    try {
      await userService.setActive(statusTarget.user.id, statusTarget.nextActive);
      showToast(statusTarget.nextActive ? 'Usuario activado correctamente.' : 'Usuario desactivado correctamente.');
      setStatusTarget(null);
      reload();
    } catch (err) {
      setStatusError(err.message || 'No se pudo actualizar el estado del usuario.');
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Administración" title="Usuarios y roles"
        subtitle={`${users.length} usuarios · ${admins} administradores activos`}
        actions={<Button variant="primary" icon="user-plus" onClick={() => setFormUser(null)}>Crear usuario</Button>} />

      <Card pad style={{ marginBottom: 16, background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--blue-700)', fontSize: 13 }}>
          <Icon name="shield" size={16} />
          <span>Sección administrativa. Los cambios afectan permisos y acceso al sistema.</span>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o correo…" style={{ flex: 1, minWidth: 220 }} />
        <FilterChips value={role} onChange={setRole} options={ROLE_FILTERS} />
        <FilterChips value={status} onChange={setStatus} options={STATUS_FILTERS} />
      </div>

      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <table className="nk-table">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initials={initialsFromName(u.name)} size={32} />
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                        {isSelf && <span className="nk-pill" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', fontSize: 11 }}>Tú</span>}
                      </div>
                    </td>
                    <td className="nk-mono" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{u.email}</td>
                    <td>
                      <span className="nk-pill" style={{ background: u.role === 'ADMIN' ? 'var(--blue-50)' : 'var(--gray-100)', color: u.role === 'ADMIN' ? 'var(--blue-700)' : 'var(--gray-600)' }}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      <span className="nk-pill" style={{ background: u.isActive ? 'var(--green-50)' : 'var(--gray-100)', color: u.isActive ? 'var(--green-700)' : 'var(--gray-600)' }}>
                        <span className="nk-dot" style={{ background: u.isActive ? 'var(--green-500)' : 'var(--gray-400)' }}></span>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <IconButton name="pencil" title="Editar" onClick={() => setFormUser(u)} style={{ width: 30, height: 30 }} />
                        <IconButton name="lock" title="Restablecer contraseña" onClick={() => setResettingUser(u)} style={{ width: 30, height: 30 }} />
                        <IconButton
                          name={u.isActive ? 'x' : 'check-circle-2'}
                          title={isSelf ? 'No puedes desactivar tu propia cuenta' : (u.isActive ? 'Desactivar' : 'Activar')}
                          onClick={() => !isSelf || !u.isActive ? setStatusTarget({ user: u, nextActive: !u.isActive }) : undefined}
                          style={{ width: 30, height: 30, opacity: isSelf && u.isActive ? 0.4 : 1, cursor: isSelf && u.isActive ? 'not-allowed' : 'pointer' }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState icon="users" title="Sin usuarios" subtitle="No hay usuarios que coincidan con la búsqueda." />
        )}
      </Card>

      {formUser !== undefined && (
        <UserFormModal
          user={formUser}
          isSelf={!!formUser && formUser.id === currentUser?.id}
          onClose={() => setFormUser(undefined)}
          onSaved={reload}
        />
      )}

      {resettingUser && (
        <ResetPasswordDialog
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSaved={() => showToast('Contraseña restablecida correctamente.')}
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.nextActive ? 'Activar usuario' : 'Desactivar usuario'}
        message={statusTarget ? `¿Deseas ${statusTarget.nextActive ? 'activar' : 'desactivar'} la cuenta de "${statusTarget.user.name}"?${!statusTarget.nextActive ? ' No podrá iniciar sesión mientras esté inactiva.' : ''}` : ''}
        confirmLabel={statusTarget?.nextActive ? 'Activar' : 'Desactivar'}
        danger={!statusTarget?.nextActive}
        busy={statusBusy}
        icon={statusTarget?.nextActive ? 'check-circle-2' : 'lock'}
        onConfirm={confirmStatusChange}
        onClose={() => { setStatusTarget(null); setStatusError(''); }}
      >
        {statusError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{statusError}</span></div>}
      </ConfirmDialog>
    </div>
  );
}
