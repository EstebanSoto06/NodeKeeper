/* Badge de estado alineado con los enums REALES del backend (NodeStatus,
   EquipmentStatus, MaintenanceStatus, MaintenanceType). Se apoya en
   utils/statusMaps y reutiliza la clase .nk-pill del Design System, sin
   introducir estilos nuevos. A diferencia de StatusPill (que mapea estados
   mock en espanol del prototipo), este componente recibe el valor de enum
   crudo del backend.

   Uso:
     <StatusBadge kind="maintenance" value={m.status} />
     <StatusBadge kind="node" value={node.status} /> */
import { resolveStatus } from '../utils/statusMaps.js';

export function StatusBadge({ kind, value, dot = true }) {
  const s = resolveStatus(kind, value);
  return (
    <span className="nk-pill" style={{ background: s.bg, color: s.fg }}>
      {dot && <span className="nk-dot" style={{ background: s.solid }}></span>}
      {s.label}
    </span>
  );
}
