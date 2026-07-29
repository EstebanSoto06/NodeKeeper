/* NodeKeeper · Coopelesca — App raiz.
   Fase 1+2: ruteo real con react-router-dom y sesion real via AuthContext.
   Las 14 pantallas siguen mostrando su contenido mock por ahora (se conectan
   modulo a modulo en fases posteriores); lo que cambia aqui es exclusivamente
   infraestructura: URLs reales, proteccion de rutas y autenticacion. */
import { AuthProvider } from './context/AuthContext.jsx';
import { AppRoutes } from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
