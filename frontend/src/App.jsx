/* NodeKeeper · Coopelesca — App raíz
   Enrutamiento visual por estado (sin librería de routing: prototipo) + sesión
   demo con rol. Tras login se entra al Dashboard. La navegación entre pantallas
   se hace con go(view, id). Sin backend.

   Flujos cubiertos:
     Login → Dashboard
     Dashboard → Detalle de mantenimiento
     Mantenimientos → Detalle de mantenimiento → Checklist/Evidencias
     Nodos → Detalle de nodo → Mapa
     Mapa → Detalle de nodo
     Calendario → Mantenimientos
     Reportes con filtros visuales
*/
import { useState } from 'react';
import { AppShell } from './layouts/AppShell.jsx';
import { Login } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Nodes } from './pages/Nodes.jsx';
import { NodeDetail } from './pages/NodeDetail.jsx';
import { Equipment } from './pages/Equipment.jsx';
import { EquipmentDetail } from './pages/EquipmentDetail.jsx';
import { Providers } from './pages/Providers.jsx';
import { ProviderDetail } from './pages/ProviderDetail.jsx';
import { Maintenances } from './pages/Maintenances.jsx';
import { MaintenanceDetail } from './pages/MaintenanceDetail.jsx';
import { Calendar } from './pages/Calendar.jsx';
import { Map } from './pages/Map.jsx';
import { Evidence } from './pages/Evidence.jsx';
import { Reports } from './pages/Reports.jsx';
import { Users } from './pages/Users.jsx';
import { ToastHost } from './components/Modal.jsx';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState('admin');
  const [view, setView] = useState('dashboard');
  const [selId, setSelId] = useState(null);

  const go = (v, id) => {
    setView(v);
    if (id !== undefined) setSelId(id);
    const c = document.querySelector('.nk-content');
    if (c) c.scrollTop = 0;
  };

  if (!authed) {
    return <Login onLogin={(r) => { setRole(r); setAuthed(true); setView('dashboard'); }} />;
  }

  let screen;
  switch (view) {
    case 'dashboard':    screen = <Dashboard go={go} role={role} />; break;
    case 'nodes':        screen = <Nodes go={go} />; break;
    case 'node-detail':  screen = <NodeDetail id={selId} go={go} role={role} />; break;
    case 'equipment':    screen = <Equipment go={go} role={role} />; break;
    case 'equipment-detail': screen = <EquipmentDetail id={selId} go={go} role={role} />; break;
    case 'providers':    screen = <Providers go={go} role={role} />; break;
    case 'provider-detail': screen = <ProviderDetail id={selId} go={go} role={role} />; break;
    case 'maintenances': screen = <Maintenances go={go} role={role} />; break;
    case 'maint-detail': screen = <MaintenanceDetail id={selId} go={go} role={role} />; break;
    case 'calendar':     screen = <Calendar go={go} />; break;
    case 'map':          screen = <Map go={go} />; break;
    case 'evidence':     screen = <Evidence />; break;
    case 'reports':      screen = <Reports />; break;
    case 'users':        screen = <Users role={role} />; break;
    default:             screen = <Dashboard go={go} role={role} />;
  }

  return (
    <AppShell view={view} go={go} role={role} onLogout={() => setAuthed(false)}>
      {screen}
      <ToastHost />
    </AppShell>
  );
}
