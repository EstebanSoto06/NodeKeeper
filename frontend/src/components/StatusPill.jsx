/* Estado por color (semáforo). StatusPill acepta una clave de estado
   ('pendiente'|'progreso'|'cerrado') o un objeto {fg,bg,solid,label}. */
import { NK } from '../data/mockData.js';

export function StatusPill({ state, label, solid = false }) {
  const s = typeof state === 'object' ? state : NK.state[state];
  if (!s) return null;
  const text = label || s.label;
  if (solid) return <span className="nk-pill" style={{ background: s.solid, color: '#fff' }}>{text}</span>;
  return (
    <span className="nk-pill" style={{ background: s.bg, color: s.fg }}>
      <span className="nk-dot" style={{ background: s.solid }}></span>{text}
    </span>
  );
}

export function HealthDot({ health, size = 9 }) {
  const s = NK.health[health];
  return <span className="nk-dot" style={{ background: s.solid, width: size, height: size }}></span>;
}
