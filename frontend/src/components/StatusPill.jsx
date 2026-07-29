/* Estado por color, usando exclusivamente los enums y tonos reales de
   utils/statusMaps.js (antes dependia de NK.state/NK.health, mock). Acepta
   una pareja {kind,value} como StatusBadge, o directamente un objeto
   {fg,bg,solid,label} ya resuelto para casos que no correspondan a un enum
   real del backend. HealthDot se retiro: su concepto de "salud" en
   semaforo (verde/ambar/rojo por pendientes) no tiene equivalente real y
   no le quedaban consumidores. */
import { resolveStatus } from '../utils/statusMaps.js';

export function StatusPill({ kind, value, state, label, solid = false }) {
  const s = state && typeof state === 'object' ? state : resolveStatus(kind, value);
  if (!s) return null;
  const text = label || s.label;
  if (solid) return <span className="nk-pill" style={{ background: s.solid, color: '#fff' }}>{text}</span>;
  return (
    <span className="nk-pill" style={{ background: s.bg, color: s.fg }}>
      <span className="nk-dot" style={{ background: s.solid }}></span>{text}
    </span>
  );
}
