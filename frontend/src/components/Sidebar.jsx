/* Barra lateral navy. Navegación principal + secciones por permiso de rol.
   El Operador no ve la sección Administración (Usuarios y roles, Plantillas
   de checklist).
   Los items usan NavLink (URL real, resaltado automático de la ruta activa)
   y el usuario/rol provienen de la sesión real (AuthContext). El badge de
   mantenimientos pendientes es real (GET /maintenances, conteo de
   SCHEDULED), ya sin depender de mockData.js. */
import { NavLink } from 'react-router-dom';
import { Icon, Logo } from './Icon.jsx';
import { Avatar, initialsFromName } from './Misc.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as maintenanceService from '../services/maintenanceService.js';

const NAV_MAIN = [
  { to: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { to: '/nodos', label: 'Nodos', icon: 'share-2' },
  { to: '/equipos', label: 'Equipos', icon: 'server' },
  { to: '/proveedores', label: 'Proveedores', icon: 'building-2' },
  { to: '/mantenimientos', label: 'Mantenimientos', icon: 'wrench', badge: true },
  { to: '/calendario', label: 'Calendario', icon: 'calendar-days' },
  { to: '/mapa', label: 'Mapa', icon: 'map' },
];
const NAV_DATA = [
  { to: '/evidencias', label: 'Evidencias', icon: 'image' },
  { to: '/reportes', label: 'Reportes', icon: 'bar-chart-3' },
];
const NAV_ADMIN = [
  { to: '/usuarios', label: 'Usuarios y roles', icon: 'users' },
  { to: '/plantillas', label: 'Plantillas de checklist', icon: 'list' },
];

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data } = useAsync(() => maintenanceService.list(), []);
  const pendientes = (data?.maintenances ?? []).filter((m) => m.status === 'SCHEDULED').length;

  const item = (n) => (
    <NavLink
      key={n.to}
      to={n.to}
      className={({ isActive }) => `nk-navitem ${isActive ? 'is-active' : ''}`}
      style={{ textDecoration: 'none' }}
      onClick={() => onClose && onClose()}
    >
      <Icon name={n.icon} size={17} />
      <span>{n.label}</span>
      {n.badge && pendientes > 0 && <span className="nk-badge">{pendientes}</span>}
    </NavLink>
  );

  return (
    <aside className={`nk-sidebar ${open ? 'is-open' : ''}`}>
      <div className="nk-side-brand"><Logo height={26} variant="dark" /></div>
      <div className="nk-side-section">Operación</div>
      <nav className="nk-nav">
        {NAV_MAIN.map(item)}
        <div className="nk-side-section">Datos</div>
        {NAV_DATA.map(item)}
        {isAdmin && (
          <>
            <div className="nk-side-section">Administración</div>
            {NAV_ADMIN.map(item)}
          </>
        )}
      </nav>
      <div className="nk-side-user">
        <Avatar initials={initialsFromName(user?.name)} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">{user?.name}</div>
          <div className="rl">{isAdmin ? 'Administrador' : 'Operador'}</div>
        </div>
        <Icon name="settings" size={16} style={{ color: 'var(--fg-on-dark-2)' }} />
      </div>
    </aside>
  );
}
