/* Controles de formulario y filtros del Design System. */
import { Icon } from './Icon.jsx';

export function Field({ label, children, required, error }) {
  return (
    <label className="nk-field">
      {label && <span className="nk-field-label">{label}{required && <span style={{ color: 'var(--red-600)' }}> *</span>}</span>}
      {children}
      {error && <span className="nk-field-error">{error}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', error }) {
  return (
    <input className={`nk-input ${error ? 'is-error' : ''}`} type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange && onChange(e.target.value)} />
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', style }) {
  return (
    <div className="nk-search" style={style}>
      <Icon name="search" size={16} style={{ color: 'var(--fg-3)' }} />
      <input value={value} placeholder={placeholder} onChange={(e) => onChange && onChange(e.target.value)} />
    </div>
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select className="nk-input nk-select" value={value} onChange={(e) => onChange && onChange(e.target.value)}>
      {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}

// Chips segmentados (filtros).
export function FilterChips({ options, value, onChange }) {
  return (
    <div className="nk-chips">
      {options.map((o) => (
        <button key={o.value} className={`nk-chip ${value === o.value ? 'is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.dot && <span className="nk-dot" style={{ background: o.dot }}></span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}
