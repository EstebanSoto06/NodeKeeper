/* Usuarios y roles: sección administrativa (solo Administrador). Tabla de
   usuarios con nombre, email, rol, estado y acciones. Para el Operador se
   muestra un aviso de acceso restringido. */
import { DATA } from '../data/mockData.js';
import { PageHeader } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Avatar } from '../components/Misc.jsx';
import { RolePill } from '../components/Badge.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { Icon } from '../components/Icon.jsx';

export function Users({ role }) {
  if (role !== 'admin') {
    return (
      <div>
        <PageHeader eyebrow="Administración" title="Usuarios y roles" />
        <Card pad>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px' }}>
            <span className="nk-node-ico" style={{ background: 'var(--gray-100)' }}><Icon name="lock" size={20} style={{ color: 'var(--fg-3)' }} /></span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Acceso restringido</div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>La administración de usuarios está disponible solo para el rol Administrador.</div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Administración" title="Usuarios y roles"
        subtitle={`${DATA.users.length} usuarios · ${DATA.users.filter((u) => u.role === 'Administrador').length} administradores`}
        actions={<Button variant="primary" icon="user-plus">Invitar usuario</Button>} />

      <Card pad style={{ marginBottom: 16, background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--blue-700)', fontSize: 13 }}>
          <Icon name="shield" size={16} />
          <span>Sección administrativa. Los cambios afectan permisos y acceso al sistema.</span>
        </div>
      </Card>

      <Card pad={false}>
        <table className="nk-table">
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Última actividad</th><th></th></tr></thead>
          <tbody>
            {DATA.users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={u.initials} color={u.color} size={32} />
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                  </div>
                </td>
                <td className="nk-mono" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{u.email}</td>
                <td><RolePill role={u.role} /></td>
                <td>
                  <StatusPill state={u.status === 'activo'
                    ? { fg: 'var(--green-700)', bg: 'var(--green-50)', solid: 'var(--green-600)', label: 'Activo' }
                    : { fg: 'var(--gray-600)', bg: 'var(--gray-100)', solid: 'var(--gray-400)', label: 'Inactivo' }} />
                </td>
                <td style={{ color: 'var(--fg-3)', fontSize: 12 }}>{u.last}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <IconButton name="pencil" title="Editar" style={{ width: 30, height: 30 }} />
                    <IconButton name="lock" title="Bloquear" style={{ width: 30, height: 30 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
