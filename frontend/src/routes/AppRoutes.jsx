/* Arbol de rutas reales de la aplicacion. Las pantallas de negocio del
   prototipo se montan tal cual (siguen mostrando su contenido mock en esta
   fase, se conectan modulo a modulo despues); lo nuevo es que ahora son
   alcanzables por URL, con proteccion de sesion y de rol, y soporte de
   recarga/back-forward del navegador.

   Dos rutas se apartan a proposito del mock para no fingir funcionalidad que
   el backend no tiene:
   - /usuarios: ADMIN-only y marcada como "Requiere modulo backend" (no hay
     CRUD de usuarios en el backend). Un OPERATOR que entre por URL ve
     AccessDenied (via ProtectedRoute roles).
   - /evidencias: no existe galeria global en el backend; muestra una pantalla
     informativa que enlaza a Mantenimientos (donde viven las evidencias). */
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { useLegacyGo, useLegacyRole } from './legacyNav.js';
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

function DashboardRoute() {
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <Dashboard go={go} role={role} />;
}

function NodesRoute() {
  const go = useLegacyGo();
  return <Nodes go={go} />;
}

function NodeDetailRoute() {
  const { id } = useParams();
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <NodeDetail id={id} go={go} role={role} />;
}

function EquipmentRoute() {
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <Equipment go={go} role={role} />;
}

function EquipmentDetailRoute() {
  const { id } = useParams();
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <EquipmentDetail id={id} go={go} role={role} />;
}

function ProvidersRoute() {
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <Providers go={go} role={role} />;
}

function ProviderDetailRoute() {
  const { id } = useParams();
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <ProviderDetail id={id} go={go} role={role} />;
}

function MaintenancesRoute() {
  const go = useLegacyGo();
  const role = useLegacyRole();
  return <Maintenances go={go} role={role} />;
}

function MaintenanceDetailRoute() {
  const { id } = useParams();
  const go = useLegacyGo();
  return <MaintenanceDetail id={id} go={go} />;
}

function CalendarRoute() {
  const go = useLegacyGo();
  return <Calendar go={go} />;
}

function MapRoute() {
  const go = useLegacyGo();
  return <Map go={go} />;
}

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
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/nodos" element={<NodesRoute />} />
          <Route path="/nodos/:id" element={<NodeDetailRoute />} />
          <Route path="/equipos" element={<EquipmentRoute />} />
          <Route path="/equipos/:id" element={<EquipmentDetailRoute />} />
          <Route path="/proveedores" element={<ProvidersRoute />} />
          <Route path="/proveedores/:id" element={<ProviderDetailRoute />} />
          <Route path="/mantenimientos" element={<MaintenancesRoute />} />
          <Route path="/mantenimientos/:id" element={<MaintenanceDetailRoute />} />
          <Route path="/calendario" element={<CalendarRoute />} />
          <Route path="/mapa" element={<MapRoute />} />
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
