/* Badge genérico (texto + colores opcionales). Lo consume StatusBadge.jsx.

   Aquí vivían además TypePill, PriorityPill y RolePill, heredados del
   prototipo visual: se retiraron por no tener consumidores y estar
   reemplazados por el modelo real — el tipo de mantenimiento lo pinta
   <StatusBadge kind="maintenanceType">, el rol lo traduce roleLabel() de
   utils/roleLabels.js, y "prioridad" no existe en el backend. */

export function Badge({ children, bg = 'var(--gray-100)', fg = 'var(--gray-600)', dot }) {
  return (
    <span className="nk-pill" style={{ background: bg, color: fg }}>
      {dot && <span className="nk-dot" style={{ background: dot }}></span>}
      {children}
    </span>
  );
}
