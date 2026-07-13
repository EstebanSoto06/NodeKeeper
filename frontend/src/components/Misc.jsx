/* Primitivas auxiliares: Avatar, PageHeader y Empty (estado vacío). */
import { Icon } from './Icon.jsx';

export function Avatar({ initials, color = 'var(--blue-600)', size = 34 }) {
  return (
    <span className="nk-avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="nk-pagehead">
      <div>
        {eyebrow && <div className="nk-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <h1 className="nk-page-title">{title}</h1>
        {subtitle && <p className="nk-page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="nk-pagehead-actions">{actions}</div>}
    </div>
  );
}

export function Empty({ icon = 'inbox', title, sub }) {
  return (
    <div className="nk-empty">
      <Icon name={icon} size={26} style={{ color: 'var(--fg-4)' }} />
      <div className="nk-empty-title">{title}</div>
      {sub && <div className="nk-empty-sub">{sub}</div>}
    </div>
  );
}
