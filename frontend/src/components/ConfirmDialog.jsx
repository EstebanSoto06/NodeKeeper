/* Dialogo de confirmacion reutilizable. Se apoya en el Modal del Design
   System (que ya trae scrim de vidrio, role="dialog", aria-modal y cierre con
   Escape) y agrega un par de acciones Cancelar / Confirmar. Pensado para
   acciones destructivas o irreversibles (eliminar, completar, etc.).

   Accesibilidad:
   - Escape cierra (heredado de Modal).
   - El boton de confirmacion recibe el foco al abrir.
   - Ambos botones declaran type="button".
   - Mientras `busy` esta activo, los botones se deshabilitan para evitar
     doble envio, y el texto de confirmar refleja el estado de carga.

   Uso:
     <ConfirmDialog
       open={open}
       title="Eliminar proveedor"
       message="Esta accion no se puede deshacer."
       confirmLabel="Eliminar"
       danger
       busy={deleting}
       onConfirm={handleDelete}
       onClose={() => setOpen(false)}
     /> */
import { useEffect, useRef } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

export function ConfirmDialog({
  open,
  title = 'Confirmar accion',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  icon,
  onConfirm,
  onClose,
  children,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      title={title}
      icon={icon}
      size="sm"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <button
            ref={confirmRef}
            type="button"
            className={`nk-btn ${danger ? 'nk-btn-danger' : 'nk-btn-primary'} nk-btn-md`}
            onClick={onConfirm}
            disabled={busy}
          >
            <span>{busy ? 'Procesando…' : confirmLabel}</span>
          </button>
        </>
      }
    >
      {message && <p style={{ color: 'var(--fg-2)', margin: 0 }}>{message}</p>}
      {children}
    </Modal>
  );
}
