/* Barra superior: hamburguesa (responsive), buscador, acción rápida, rol y salir.
   Fase 2: el rol y el logout provienen de la sesión real (AuthContext).

   El botón "Nuevo" es un atajo global para crear una orden de mantenimiento:
   abre el MISMO MaintenanceFormModal que usan Mantenimientos y Calendario
   (POST /maintenances real, sin formulario paralelo). Solo se muestra a ADMIN
   porque POST /maintenances está autorizado únicamente para ese rol
   (backend/src/modules/maintenance/maintenance.routes.js); ocultarlo es un
   espejo del permiso real, que el backend sigue validando por su cuenta.

   Tras guardar navega a /mantenimientos pasando un sello de tiempo en el
   state del router: la lista lo usa como dependencia de su carga para
   refrescarse incluso si el usuario ya estaba en esa misma ruta (navegar a la
   ruta actual no remonta el componente).

   El modal se monta en document.body con un portal, no aquí dentro: esta
   barra usa backdrop-filter y eso la convierte en bloque contenedor de sus
   descendientes `position: fixed`, de modo que el scrim del modal quedaría
   recortado dentro de la franja de 60px del topbar en vez de cubrir la
   ventana. Es el único punto de la app donde un modal cuelga de un elemento
   con filtro, por eso el portal se aplica aquí y no dentro de Modal.jsx. */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { IconButton } from './Button.jsx';
import { MaintenanceFormModal } from './MaintenanceFormModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePermissions } from '../hooks/usePermissions.js';

export function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const { canManageMaintenances } = usePermissions();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const [creating, setCreating] = useState(false);

  return (
    <header className="nk-topbar">
      <button className="nk-iconbtn nk-hamburger" onClick={onMenu}><Icon name="menu" size={20} /></button>
      <div className="nk-search" style={{ flex: 1, maxWidth: 420 }}>
        <Icon name="search" size={16} style={{ color: 'var(--fg-3)' }} />
        <input placeholder="Buscar nodo, equipo o código…" />
      </div>
      <div style={{ flex: 1 }}></div>
      {canManageMaintenances && (
        <button
          type="button"
          className="nk-btn nk-btn-secondary nk-btn-sm"
          title="Nueva orden de mantenimiento"
          onClick={() => setCreating(true)}
        >
          <Icon name="plus" size={15} /><span>Nuevo</span>
        </button>
      )}
      <IconButton name="bell" title="Notificaciones" />
      <span className="nk-pill" style={{ background: isAdmin ? 'var(--blue-50)' : 'var(--gray-100)', color: isAdmin ? 'var(--blue-700)' : 'var(--gray-600)' }}>
        {isAdmin ? 'Administrador' : 'Operador'}
      </span>
      <IconButton name="log-out" title="Salir" onClick={logout} />

      {creating && createPortal(
        <MaintenanceFormModal
          onClose={() => setCreating(false)}
          onSaved={() => navigate('/mantenimientos', { state: { maintenancesRefreshedAt: Date.now() } })}
        />,
        document.body,
      )}
    </header>
  );
}
