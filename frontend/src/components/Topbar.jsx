/* Barra superior: hamburguesa (responsive), buscador, acción rápida, rol y salir. */
import { Icon } from './Icon.jsx';
import { IconButton } from './Button.jsx';

export function Topbar({ onMenu, role, onLogout }) {
  return (
    <header className="nk-topbar">
      <button className="nk-iconbtn nk-hamburger" onClick={onMenu}><Icon name="menu" size={20} /></button>
      <div className="nk-search" style={{ flex: 1, maxWidth: 420 }}>
        <Icon name="search" size={16} style={{ color: 'var(--fg-3)' }} />
        <input placeholder="Buscar nodo, equipo o código…" />
      </div>
      <div style={{ flex: 1 }}></div>
      <button className="nk-btn nk-btn-secondary nk-btn-sm"><Icon name="plus" size={15} /><span>Nuevo</span></button>
      <IconButton name="bell" title="Notificaciones" />
      <span className="nk-pill" style={{ background: role === 'admin' ? 'var(--blue-50)' : 'var(--gray-100)', color: role === 'admin' ? 'var(--blue-700)' : 'var(--gray-600)' }}>
        {role === 'admin' ? 'Administrador' : 'Operador'}
      </span>
      <IconButton name="log-out" title="Salir" onClick={onLogout} />
    </header>
  );
}
