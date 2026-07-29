/* Pantalla de acceso restringido. Se muestra cuando un usuario AUTENTICADO
   intenta entrar a una ruta para la que su rol no tiene permiso (p. ej. un
   OPERATOR navegando directamente a una vista ADMIN-only por URL). Refuerza
   que la restriccion no depende solo de ocultar botones en el Sidebar.

   Nota: la autorizacion real vive en el backend; esta pantalla es la
   contraparte visual de ese control. */
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { Button } from './Button.jsx';

export function AccessDenied({
  title = 'Acceso restringido',
  message = 'No tienes permisos para ver esta seccion. Si crees que es un error, contacta a un administrador.',
}) {
  const navigate = useNavigate();

  return (
    <div
      role="alert"
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
          background: 'var(--red-50)',
        }}
      >
        <Icon name="lock" size={26} style={{ color: 'var(--red-600)' }} />
      </span>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>{title}</h1>
      <p style={{ color: 'var(--fg-2)', maxWidth: 420, margin: 0 }}>{message}</p>
      <Button variant="secondary" icon="arrow-left" onClick={() => navigate('/dashboard')}>
        Volver al inicio
      </Button>
    </div>
  );
}
