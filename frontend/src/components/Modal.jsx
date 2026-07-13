/* Modal liquid glass reutilizable + Toast.
   Respeta el estilo del sistema: scrim navy translúcido, panel de vidrio con
   blur, bordes luminosos, sombras suaves y animación de entrada corta. */
import { useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { useStore, dismissToast } from '../store/store.js';

export function Modal({ title, subtitle, onClose, children, footer, size = 'md', icon }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="nk-modal-scrim" onClick={onClose}>
      <div className={`nk-modal nk-modal-${size}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="nk-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            {icon && <span className="nk-modal-ico"><Icon name={icon} size={18} /></span>}
            <div style={{ minWidth: 0 }}>
              <h2 className="nk-modal-title">{title}</h2>
              {subtitle && <p className="nk-modal-sub">{subtitle}</p>}
            </div>
          </div>
          <button className="nk-iconbtn" onClick={onClose} title="Cerrar" aria-label="Cerrar"><Icon name="x" size={18} /></button>
        </div>
        <div className="nk-modal-body">{children}</div>
        {footer && <div className="nk-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* Lista de definición para mostrar datos de un proveedor de forma legible. */
export function DataList({ items }) {
  return (
    <dl className="nk-dl">
      {items.map((it) => (
        <div className="nk-dl-row" key={it.k}>
          <dt>{it.k}</dt>
          <dd className={it.mono ? 'nk-mono' : ''}>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ToastHost() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="nk-toast" role="status" key={toast.id}>
      <Icon name={toast.kind === 'success' ? 'check-circle-2' : 'alert-circle'} size={17} />
      <span>{toast.message}</span>
      <button className="nk-iconbtn" onClick={dismissToast} title="Cerrar" style={{ width: 28, height: 28 }}><Icon name="x" size={15} /></button>
    </div>
  );
}
