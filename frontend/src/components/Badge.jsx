/* Badges / pills no-estado: tipo de mantenimiento, prioridad, rol y un Badge genérico. */

export function TypePill({ type }) {
  const map = {
    preventivo: { bg: 'var(--blue-50)', fg: 'var(--blue-700)', label: 'Preventivo' },
    correctivo: { bg: 'var(--gray-100)', fg: 'var(--gray-600)', label: 'Correctivo' },
  };
  const s = map[type] || map.preventivo;
  return <span className="nk-pill" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

export function PriorityPill({ p }) {
  const map = {
    alta: { bg: 'var(--red-50)', fg: 'var(--red-700)' },
    media: { bg: 'var(--amber-50)', fg: 'var(--amber-700)' },
    baja: { bg: 'var(--gray-100)', fg: 'var(--gray-600)' },
  };
  const s = map[p] || map.media;
  return <span className="nk-pill" style={{ background: s.bg, color: s.fg, textTransform: 'capitalize' }}>{p}</span>;
}

export function RolePill({ role }) {
  const admin = role === 'Administrador' || role === 'admin';
  return (
    <span className="nk-pill" style={{ background: admin ? 'var(--blue-50)' : 'var(--gray-100)', color: admin ? 'var(--blue-700)' : 'var(--gray-600)' }}>
      {role === 'admin' ? 'Administrador' : role === 'operator' ? 'Operador' : role}
    </span>
  );
}

// Badge genérico (texto + colores opcionales).
export function Badge({ children, bg = 'var(--gray-100)', fg = 'var(--gray-600)', dot }) {
  return (
    <span className="nk-pill" style={{ background: bg, color: fg }}>
      {dot && <span className="nk-dot" style={{ background: dot }}></span>}
      {children}
    </span>
  );
}
