/* Marcador de funcionalidad pendiente de soporte en backend. Se usa para
   rutas que existen visualmente pero cuyo modulo real aun no esta implementado
   (p. ej. /usuarios: el backend todavia no expone CRUD de usuarios). Evita
   fingir que una pantalla mock es funcional. Reutiliza tokens y el boton del
   Design System, sin estilos nuevos.

   Uso:
     <ComingSoon
       title="Usuarios y roles"
       message="La gestion de usuarios estara disponible cuando se agregue el modulo en el backend."
     /> */
import { Icon } from './Icon.jsx';

export function ComingSoon({
  title = 'Proximamente',
  message = 'Esta seccion estara disponible en una proxima entrega.',
  icon = 'wrench',
  action,
}) {
  return (
    <div
      style={{
        minHeight: '55vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--blue-50)',
        }}
      >
        <Icon name={icon} size={26} style={{ color: 'var(--blue-600)' }} />
      </span>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>{title}</h1>
      <p style={{ color: 'var(--fg-2)', maxWidth: 440, margin: 0 }}>{message}</p>
      <span className="nk-pill" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}>
        Requiere modulo backend
      </span>
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
