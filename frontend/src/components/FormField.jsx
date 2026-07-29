/* Campo de formulario accesible. Formaliza el patron de la clase .nk-field
   del Design System agregando asociacion explicita label/control (htmlFor +
   id), marca de requerido, texto de ayuda y mensaje de error enlazado por
   aria-describedby.

   Para lograr la asociacion sin acoplarse a un control concreto, children es
   una funcion que recibe las props a esparcir en el input/select/textarea:

     <FormField label="Correo" required error={err}>
       {({ id, describedBy, invalid }) => (
         <input id={id} aria-describedby={describedBy} aria-invalid={invalid}
                className={`nk-input ${invalid ? 'is-error' : ''}`} />
       )}
     </FormField>

   Tambien acepta children estatico (sin asociacion automatica) para casos
   simples. */
import { useId } from 'react';

export function FormField({ label, required, error, hint, children }) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = !!error;

  const describedBy = [hint ? hintId : null, invalid ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="nk-field">
      {label && (
        <label className="nk-field-label" htmlFor={id}>
          {label}
          {required && <span style={{ color: 'var(--red-600)' }}> *</span>}
        </label>
      )}

      {typeof children === 'function'
        ? children({ id, describedBy, invalid, required })
        : children}

      {hint && !invalid && (
        <span id={hintId} style={{ color: 'var(--fg-3)', fontSize: 12 }}>
          {hint}
        </span>
      )}

      {invalid && (
        <span id={errorId} className="nk-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
