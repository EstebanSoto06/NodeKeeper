/* Botones del Design System. Variantes: primary · secondary · ghost · danger · subtle. */
import { Icon } from './Icon.jsx';

export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, onClick, type = 'button', disabled, style }) {
  return (
    <button type={type} className={`nk-btn nk-btn-${variant} nk-btn-${size}`} onClick={onClick} disabled={disabled} style={style}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 16} />}
    </button>
  );
}

export function IconButton({ name, onClick, title, active, style }) {
  return (
    <button type="button" className={`nk-iconbtn ${active ? 'is-active' : ''}`} onClick={onClick} title={title} style={style}>
      <Icon name={name} size={17} />
    </button>
  );
}
