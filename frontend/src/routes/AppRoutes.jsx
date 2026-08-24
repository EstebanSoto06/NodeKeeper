/* Arbol de rutas reales de la aplicacion. Todas las pantallas de negocio
   (Usuarios, Proveedores, Nodos, Equipos, Mantenimientos, Dashboard,
   Calendario, Mapa y Reportes) estan conectadas a la API real; ninguna
   depende ya de mockData.js ni de legacyNav.js (retirado: sin consumidores).

   /usuarios es ADMIN-only: OPERATOR (o navegacion directa por URL) ve
   AccessDenied gracias a la guarda de rol, y el Sidebar ya oculta el enlace
   para ese rol.
   /evidencias consolida en una tabla las evidencias reales de todas las
   ordenes: el backend no tiene un endpoint de galeria global, pero
   GET /maintenances ya incluye la metadata de cada evidencia y la descarga
   usa el endpoint real por evidencia. Subir/eliminar sigue estando dentro de
   cada orden (ver pages/EvidencesInfo.jsx). */
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
import { Users } from '../pages/Users.jsx';
import { EvidencesInfo } from '../pages/EvidencesInfo.jsx';
import { ChecklistTemplates } from '../pages/ChecklistTemplates.jsx';

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

          {/* /usuarios y /plantillas: solo ADMIN; OPERATOR (o navegacion
              directa por URL) ve AccessDenied gracias a la guarda de rol.
              /plantillas ademas consume endpoints que el backend restringe a
              ADMIN incluso para leer (checklist-template.routes.js). */}
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/usuarios" element={<Users />} />
            <Route path="/plantillas" element={<ChecklistTemplates />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
