/* Barra superior: hamburguesa (responsive), buscador, acción rápida, rol y salir.
   Fase 2: el rol y el logout provienen de la sesión real (AuthContext). */
import { Icon } from './Icon.jsx';
import { IconButton } from './Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

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
      <span className="nk-pill" style={{ background: isAdmin ? 'var(--blue-50)' : 'var(--gray-100)', color: isAdmin ? 'var(--blue-700)' : 'var(--gray-600)' }}>
        {isAdmin ? 'Administrador' : 'Operador'}
      </span>
      <IconButton name="log-out" title="Salir" onClick={logout} />
    </header>
  );
}
