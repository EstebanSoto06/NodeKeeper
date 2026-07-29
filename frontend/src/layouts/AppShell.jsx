/* App shell responsive: Sidebar + scrim + Topbar + área de contenido.
   Se monta como layout de ruta (react-router-dom): Sidebar y Topbar ya
   obtienen el usuario/rol reales de AuthContext internamente, y el contenido
   de cada pantalla se renderiza vía <Outlet/> en vez de recibirse por props. */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar.jsx';
import { Topbar } from '../components/Topbar.jsx';
import { ToastHost } from '../components/Modal.jsx';

export function AppShell() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="nk-app">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <div className={`nk-scrim ${menu ? 'is-open' : ''}`} onClick={() => setMenu(false)}></div>
      <div className="nk-main">
        <Topbar onMenu={() => setMenu(true)} />
        <main className="nk-content">
          <div className="nk-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
