/* Card (superficie blanca con borde hairline) y ProgressBar (avance del checklist). */

export function Card({ children, className = '', style, pad = true }) {
  return <div className={`nk-card ${pad ? 'nk-card-pad' : ''} ${className}`} style={style}>{children}</div>;
}

export function ProgressBar({ value, color }) {
  const c = color || (value >= 100 ? 'var(--green-600)' : value > 0 ? 'var(--amber-500)' : 'var(--gray-300)');
  return (
    <div className="nk-track"><div className="nk-fill" style={{ width: value + '%', background: c }}></div></div>
  );
}
