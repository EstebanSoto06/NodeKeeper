/* Estado de error para lecturas fallidas de la API. Muestra un mensaje claro
   (nunca un stack ni detalles tecnicos) y, opcionalmente, un boton de
   reintento. Reutiliza .nk-callout y el boton del Design System.

   Uso:
     <ErrorState error={error} onRetry={reload} /> */
import { Icon } from './Icon.jsx';
import { Button } from './Button.jsx';

export function ErrorState({
  error,
  title = 'No se pudo cargar la informacion',
  onRetry,
  retryLabel = 'Reintentar',
}) {
  // Se prefiere el mensaje amigable del ApiError; si no hay, un texto generico.
  const message =
    (error && typeof error.message === 'string' && error.message) ||
    'Ocurrio un error inesperado. Intenta de nuevo.';

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '32px 16px',
        textAlign: 'center',
      }}
    >
      <span
        className="nk-callout"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <Icon name="alert-circle" size={18} style={{ color: 'var(--red-600)' }} />
        <span>
          <strong style={{ color: 'var(--fg-1)' }}>{title}.</strong> {message}
        </span>
      </span>
      {onRetry && (
        <Button variant="secondary" icon="repeat" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
