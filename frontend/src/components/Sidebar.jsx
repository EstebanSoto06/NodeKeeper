/* Barra lateral navy. Navegación principal + secciones por permiso de rol.
   El Operador no ve la sección Administración (Usuarios y roles). */
import { Icon, Logo } from './Icon.jsx';
import { Avatar } from './Misc.jsx';
import { DATA } from '../data/mockData.js';

const NAV_MAIN = [
  { key: 'dashboard',    label: 'Dashboard',      icon: 'layout-dashboard' },
  { key: 'nodes',        label: 'Nodos',          icon: 'share-2' },
  { key: 'equipment',    label: 'Equipos',        icon: 'server' },
  { key: 'providers',    label: 'Proveedores',    icon: 'building-2' },
  { key: 'maintenances', label: 'Mantenimientos', icon: 'wrench', badge: true },
  { key: 'calendar',     label: 'Calendario',     icon: 'calendar-days' },
  { key: 'map',          label: 'Mapa',           icon: 'map' },
];
const NAV_DATA = [
  { key: 'evidence', label: 'Evidencias', icon: 'image' },
  { key: 'reports',  label: 'Reportes',   icon: 'bar-chart-3' },
];
const NAV_ADMIN = [
  { key: 'users', label: 'Usuarios y roles', icon: 'users' },
];

export function Sidebar({ view, go, role, open, onClose }) {
  const pendientes = DATA.maint.filter((m) => m.state === 'pendiente').length;
  const me = role === 'admin'
    ? DATA.users.find((u) => u.role === 'Administrador')
    : DATA.users.find((u) => u.role === 'Operador');

  const item = (n) => {
    const active = view === n.key
      || (view === 'node-detail' && n.key === 'nodes')
      || (view === 'equipment-detail' && n.key === 'equipment')
      || (view === 'provider-detail' && n.key === 'providers')
      || (view === 'maint-detail' && n.key === 'maintenances');
    return (
      <button key={n.key} className={`nk-navitem ${active ? 'is-active' : ''}`}
        onClick={() => { go(n.key); onClose && onClose(); }}>
        <Icon name={n.icon} size={17} />
        <span>{n.label}</span>
        {n.badge && pendientes > 0 && <span className="nk-badge">{pendientes}</span>}
      </button>
    );
  };

  return (
    <aside className={`nk-sidebar ${open ? 'is-open' : ''}`}>
      <div className="nk-side-brand"><Logo height={26} variant="dark" /></div>
      <div className="nk-side-section">Operación</div>
      <nav className="nk-nav">
        {NAV_MAIN.map(item)}
        <div className="nk-side-section">Datos</div>
        {NAV_DATA.map(item)}
        {role === 'admin' && (
          <>
            <div className="nk-side-section">Administración</div>
            {NAV_ADMIN.map(item)}
          </>
        )}
      </nav>
      <div className="nk-side-user">
        <Avatar initials={me.initials} color={me.color} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">{me.name}</div>
          <div className="rl">{role === 'admin' ? 'Administrador' : 'Operador'}</div>
        </div>
        <Icon name="settings" size={16} style={{ color: 'var(--fg-on-dark-2)' }} />
      </div>
    </aside>
  );
}
