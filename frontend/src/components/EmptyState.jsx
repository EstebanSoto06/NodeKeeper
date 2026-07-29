/* Estado vacio para listados sin resultados. Reutiliza las clases .nk-empty /
   .nk-empty-title / .nk-empty-sub ya definidas en global.css, y admite una
   accion opcional (p. ej. "Crear el primero") y un icono.

   Uso:
     <EmptyState
       title="Sin proveedores"
       subtitle="Aun no hay proveedores registrados."
       icon="building-2"
       action={<Button onClick={openCreate}>Nuevo proveedor</Button>}
     /> */
import { Icon } from './Icon.jsx';

export function EmptyState({ title = 'Sin resultados', subtitle, icon = 'search-x', action }) {
  return (
    <div className="nk-empty">
      {icon && (
        <Icon name={icon} size={28} style={{ color: 'var(--fg-3)' }} />
      )}
      <div className="nk-empty-title">{title}</div>
      {subtitle && <div className="nk-empty-sub">{subtitle}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
