/* Dashboard: KPIs, tendencia 8 semanas, salud de nodos y mantenimientos recientes. */
import { DATA, NK } from '../data/mockData.js';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { StatusPill, HealthDot } from '../components/StatusPill.jsx';
import { TypePill } from '../components/Badge.jsx';

function KPIRow() {
  return (
    <div className="nk-kpis">
      {DATA.kpis.map((k) => (
        <KpiCard key={k.key} label={k.label} value={k.value} accent={k.accent} fg={k.fg} delta={k.delta} deltaColor={k.deltaColor} />
      ))}
    </div>
  );
}

function TrendChart() {
  const data = DATA.trend;
  const max = Math.max(...data.map((d) => d.prev + d.corr));
  return (
    <Card pad>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="nk-section-title">Mantenimientos cerrados · 8 semanas</h3>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--fg-2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="nk-dot" style={{ background: 'var(--blue-600)' }}></span>Preventivo</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="nk-dot" style={{ background: 'var(--navy-600)' }}></span>Correctivo</span>
        </div>
      </div>
      <div className="nk-chart">
        {data.map((d) => (
          <div className="nk-bar-col" key={d.w}>
            <div className="nk-bar-stack" style={{ height: '100%' }}>
              <div className="nk-bar" style={{ height: (d.corr / max * 100) + '%', background: 'var(--navy-600)' }} title={`Correctivo: ${d.corr}`}></div>
              <div className="nk-bar" style={{ height: (d.prev / max * 100) + '%', background: 'var(--blue-500)', borderRadius: '3px 3px 0 0' }} title={`Preventivo: ${d.prev}`}></div>
            </div>
            <span className="nk-bar-lab">{d.w}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HealthSummary({ go }) {
  const nodes = DATA.nodes;
  const counts = { green: 0, amber: 0, red: 0 };
  nodes.forEach((n) => counts[n.health]++);
  const total = nodes.length;
  const order = ['red', 'amber', 'green'];
  return (
    <Card pad>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 className="nk-section-title">Estado de nodos</h3>
        <a className="nk-link" onClick={() => go('map')}>Ver mapa</a>
      </div>
      <div className="nk-healthbar">
        {order.map((h) => counts[h] > 0 && <div key={h} style={{ flex: counts[h], background: NK.health[h].solid }}></div>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {order.map((h) => (
          <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HealthDot health={h} size={10} />
            <span style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{NK.health[h].label}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: NK.health[h].fg }}>{counts[h]}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)', width: 38, textAlign: 'right' }}>{Math.round(counts[h] / total * 100)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentMaint({ go }) {
  const rows = DATA.maint.slice(0, 5);
  return (
    <Card pad={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px' }}>
        <h3 className="nk-section-title">Mantenimientos recientes</h3>
        <a className="nk-link" onClick={() => go('maintenances')}>Ver todos</a>
      </div>
      <table className="nk-table">
        <thead><tr><th>Código</th><th>Nodo</th><th>Tipo</th><th>Responsable</th><th>Estado</th></tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} onClick={() => go('maint-detail', m.id)}>
              <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{m.code}</td>
              <td style={{ fontWeight: 600 }}>{m.node}</td>
              <td><TypePill type={m.type} /></td>
              <td style={{ color: 'var(--fg-2)' }}>{m.resp}</td>
              <td><StatusPill state={m.state} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function Dashboard({ go, role }) {
  return (
    <div>
      <PageHeader eyebrow="Resumen operativo" title="Dashboard"
        subtitle="Indicadores de mantenimiento en tiempo real."
        actions={(
          <>
            <Button variant="secondary" icon="download">Exportar</Button>
            {role === 'admin' && <Button variant="primary" icon="plus">Nuevo mantenimiento</Button>}
          </>
        )} />
      <KPIRow />
      <div className="nk-grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginTop: 16 }}>
        <TrendChart />
        <HealthSummary go={go} />
      </div>
      <div style={{ marginTop: 16 }}><RecentMaint go={go} /></div>
    </div>
  );
}
