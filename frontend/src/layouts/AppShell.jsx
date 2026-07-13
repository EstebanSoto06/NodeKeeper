/* App shell responsive: Sidebar + scrim + Topbar + área de contenido. */
import { useState } from 'react';
import { Sidebar } from '../components/Sidebar.jsx';
import { Topbar } from '../components/Topbar.jsx';

export function AppShell({ view, go, role, onLogout, children }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="nk-app">
      <Sidebar view={view} go={go} role={role} open={menu} onClose={() => setMenu(false)} />
      <div className={`nk-scrim ${menu ? 'is-open' : ''}`} onClick={() => setMenu(false)}></div>
      <div className="nk-main">
        <Topbar onMenu={() => setMenu(true)} role={role} onLogout={onLogout} />
        <main className="nk-content">
          <div className="nk-content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
