/* Guarda de rutas anidadas con dos niveles de proteccion:

   1) Autenticacion (sin prop `roles`): si no hay sesion, redirige a /login
      recordando la ruta original (state.from) para volver despues del login.
      Mientras se revalida la sesion contra GET /auth/me tras un F5, muestra un
      estado neutro minimo.

   2) Autorizacion por rol (con prop `roles={['ADMIN']}`): si hay sesion pero
      el rol no esta en la lista permitida, renderiza <AccessDenied/> en vez
      del contenido. Esto asegura que la restriccion no dependa solo de ocultar
      enlaces en el Sidebar: entrar por URL directa tambien queda bloqueado.
      (La autorizacion definitiva la impone el backend; esto es su contraparte
      visual.)

   Se usa como layout route: <Route element={<ProtectedRoute roles={[...]} />}>. */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AccessDenied } from '../components/AccessDenied.jsx';

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-2)',
          fontSize: 14,
        }}
      >
        Cargando sesion…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user?.role)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
