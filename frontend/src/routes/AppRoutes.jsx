/* Arbol de rutas reales de la aplicacion. Todas las pantallas de negocio
   (Proveedores, Nodos, Equipos, Mantenimientos, Dashboard, Calendario, Mapa
   y Reportes) estan conectadas a la API real; ninguna depende ya de
   mockData.js ni de legacyNav.js (retirado: sin consumidores).

   Dos rutas se apartan a proposito del mock para no fingir funcionalidad que
   el backend no tiene:
   - /usuarios: ADMIN-only y marcada como "Requiere modulo backend" (no hay
     CRUD de usuarios en el backend). Un OPERATOR que entre por URL ve
     AccessDenied (via ProtectedRoute roles).
   - /evidencias: no existe galeria global en el backend; muestra una pantalla
     informativa que enlaza a Mantenimientos (donde viven las evidencias). */
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { Login } from '../pages/Login.jsx';
import { NotFound } from '../pages/NotFound.jsx';
import { Dashboard } from '../pages/Dashboard.jsx';
import { Nodes } from '../pages/Nodes.jsx';
import { NodeDetail } from '../pages/NodeDetail.jsx';
import { Equipment } from '../pages/Equipment.jsx';
import { EquipmentDetail } from '../pages/EquipmentDetail.jsx';
import { Providers } from '../pages/Providers.jsx';
import { ProviderDetail } from '../pages/ProviderDetail.jsx';
import { Maintenances } from '../pages/Maintenances.jsx';
import { MaintenanceDetail } from '../pages/MaintenanceDetail.jsx';
import { Calendar } from '../pages/Calendar.jsx';
import { Map } from '../pages/Map.jsx';
import { Reports } from '../pages/Reports.jsx';
import { EvidencesInfo } from '../pages/EvidencesInfo.jsx';
import { ComingSoon } from '../components/ComingSoon.jsx';

function UsersRoute() {
  return (
    <ComingSoon
      title="Usuarios y roles"
      message="La gestion de usuarios y roles estara disponible cuando se agregue el modulo correspondiente en el backend. Por ahora esta seccion no administra datos reales."
      icon="users"
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/nodos" element={<Nodes />} />
          <Route path="/nodos/:id" element={<NodeDetail />} />
          <Route path="/equipos" element={<Equipment />} />
          <Route path="/equipos/:id" element={<EquipmentDetail />} />
          <Route path="/proveedores" element={<Providers />} />
          <Route path="/proveedores/:id" element={<ProviderDetail />} />
          <Route path="/mantenimientos" element={<Maintenances />} />
          <Route path="/mantenimientos/:id" element={<MaintenanceDetail />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/mapa" element={<Map />} />
          <Route path="/evidencias" element={<EvidencesInfo />} />
          <Route path="/reportes" element={<Reports />} />

          {/* /usuarios: solo ADMIN; OPERATOR (o navegacion directa por URL) ve
              AccessDenied gracias a la guarda de rol. */}
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/usuarios" element={<UsersRoute />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
