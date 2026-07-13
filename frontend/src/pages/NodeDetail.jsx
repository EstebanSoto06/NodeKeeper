/* Detalle de nodo: info general, coordenadas, equipos asociados y mantenimientos
   relacionados. Accesos rápidos a mapa y a crear mantenimiento. */
import { DATA, NK } from '../data/mockData.js';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card, ProgressBar } from '../components/Card.jsx';
import { StatusPill, HealthDot } from '../components/StatusPill.jsx';
import { TypePill } from '../components/Badge.jsx';
import { Icon } from '../components/Icon.jsx';

export function NodeDetail({ id, go, role }) {
  const n = DATA.nodes.find((x) => x.id === id) || DATA.nodes[0];
  const equip = DATA.equipment.filter((e) => e.nodeId === n.id);
  const rel = DATA.maint.filter((m) => m.nodeId === n.id);

  return (
    <div>
      <button className="nk-back" onClick={() => go('nodes')}><Icon name="arrow-left" size={15} />Nodos</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="nk-node-ico" style={{ background: NK.health[n.health].bg }}><HealthDot health={n.health} size={14} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="nk-page-title">{n.name}</h1>
              <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{n.code}</span>
            </div>
            <p className="nk-page-sub">{n.city} · {n.locality}</p>
          </div>
        </div>
        <div className="nk-pagehead-actions">
          <Button variant="secondary" icon="map-pin" onClick={() => go('map')}>Ubicar</Button>
          {role === 'admin' && <Button variant="secondary" icon="pencil">Editar</Button>}
          <Button variant="primary" icon="plus">Nuevo mantenimiento</Button>
        </div>
      </div>

      <Card pad style={{ marginBottom: 16 }}>
        <div className="nk-meta-row">
          <div className="nk-meta"><span className="k">Estado</span><span className="v">{NK.health[n.health].label}</span></div>
          <div className="nk-meta"><span className="k">Pendientes</span><span className="v nk-mono">{n.pending}</span></div>
          <div className="nk-meta"><span className="k">Equipos</span><span className="v nk-mono">{n.equip}</span></div>
          <div className="nk-meta"><span className="k">Coordenadas</span><span className="v nk-mono" style={{ fontSize: 13 }}>10.3{n.x}, -84.4{n.y}</span></div>
          <div className="nk-meta"><span className="k">Último mantenimiento</span><span className="v">2026-05-28</span></div>
        </div>
      </Card>

      <div className="nk-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card pad={false}>
          <div className="nk-card-head"><h3 className="nk-section-title">Equipos asociados</h3><span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{equip.length}</span></div>
          <table className="nk-table">
            <thead><tr><th>Código</th><th>Equipo</th><th>Tipo</th><th>Estado</th></tr></thead>
            <tbody>
              {equip.map((e) => { const s = NK.equipStatus[e.status]; return (
                <tr key={e.id}>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{e.code}</td>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.type}</td>
                  <td><span className="nk-pill" style={{ background: s.bg, color: s.fg }}><span className="nk-dot" style={{ background: s.solid }}></span>{s.label}</span></td>
                </tr>); })}
              {equip.length === 0 && <tr><td colSpan="4"><Empty icon="server" title="Sin equipos" sub="Este nodo no tiene equipos registrados." /></td></tr>}
            </tbody>
          </table>
        </Card>

        <Card pad={false}>
          <div className="nk-card-head"><h3 className="nk-section-title">Mantenimientos relacionados</h3><a className="nk-link" onClick={() => go('maintenances')}>Ver todos</a></div>
          <table className="nk-table">
            <thead><tr><th>Código</th><th>Tipo</th><th>Avance</th><th>Estado</th></tr></thead>
            <tbody>
              {rel.map((m) => (
                <tr key={m.id} onClick={() => go('maint-detail', m.id)}>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{m.code}</td>
                  <td><TypePill type={m.type} /></td>
                  <td style={{ width: 130 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ProgressBar value={NK.pct(m.tasks)} /><span className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)', width: 30 }}>{NK.pct(m.tasks)}%</span></div></td>
                  <td><StatusPill state={m.state} /></td>
                </tr>
              ))}
              {rel.length === 0 && <tr><td colSpan="4"><Empty icon="check-circle-2" title="Sin mantenimientos" sub="Este nodo no tiene mantenimientos." /></td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
