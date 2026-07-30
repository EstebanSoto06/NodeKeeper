/* Dialogo de confirmacion reutilizable. Se apoya en el Modal del Design
   System (que ya trae scrim de vidrio, role="dialog", aria-modal y cierre con
   Escape) y agrega un par de acciones Cancelar / Confirmar. Pensado para
   acciones destructivas o irreversibles (eliminar, completar, etc.).

   Accesibilidad:
   - Escape cierra (heredado de Modal).
   - Foco inicial: en acciones `danger` va a "Cancelar"; en el resto, a
     "Confirmar" (comportamiento previo).
   - Al cerrarse, el foco vuelve a quien abrio el dialogo si sigue en el DOM.
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
  const cancelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Foco inicial: en acciones destructivas va a "Cancelar" para que un
    // Enter accidental justo al abrir no dispare la accion; en el resto de
    // casos se conserva el foco en "Confirmar" (comportamiento previo).
    triggerRef.current = document.activeElement;
    const initialFocusTarget = danger ? cancelRef.current : confirmRef.current;
    initialFocusTarget?.focus();

    return () => {
      // Restaura el foco a quien abrio el dialogo, si sigue en el DOM.
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus();
      }
    };
  }, [open, danger]);

  if (!open) return null;

  return (
    <Modal
      title={title}
      icon={icon}
      size="sm"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            className="nk-btn nk-btn-ghost nk-btn-md"
            onClick={onClose}
            disabled={busy}
          >
            <span>{cancelLabel}</span>
          </button>
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
