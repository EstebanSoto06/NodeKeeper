/* Detalle de mantenimiento: checklist con avance %, regla de cierre al 100%,
   evidencias y línea de actividad. El botón "Cerrar mantenimiento" permanece
   bloqueado mientras el checklist no esté al 100% (mensaje de avance visible).
   El Operador puede iniciar, marcar tareas y adjuntar evidencia. */
import { useState } from 'react';
import { DATA, NK } from '../data/mockData.js';
import { Button } from '../components/Button.jsx';
import { Card, ProgressBar } from '../components/Card.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { TypePill, PriorityPill } from '../components/Badge.jsx';
import { Icon } from '../components/Icon.jsx';

function DetRow({ k, v, mono, link, onClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k}</span>
      {link
        ? <a className="nk-link" onClick={onClick} style={{ fontWeight: 600 }}>{v}</a>
        : <span className={mono ? 'nk-mono' : ''} style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' }}>{v}</span>}
    </div>
  );
}

function TLItem({ dot, title, time, by, last }) {
  return (
    <div className={`nk-tl-item ${last ? 'is-last' : ''}`}>
      <span className="nk-tl-dot" style={{ background: dot }}></span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{time} · {by}</div>
      </div>
    </div>
  );
}

export function MaintenanceDetail({ id, go }) {
  const base = DATA.maint.find((m) => m.id === id) || DATA.maint[0];
  const [tasks, setTasks] = useState(base.tasks.map((t) => ({ ...t })));
  const [closed, setClosed] = useState(base.state === 'cerrado');
  const [started, setStarted] = useState(base.state !== 'pendiente');

  const pct = NK.pct(tasks);
  const canClose = pct === 100 && !closed;
  const toggle = (i) => { setStarted(true); setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, done: !t.done } : t))); };
  const evid = DATA.evidence;
  const liveState = closed ? 'cerrado' : (pct > 0 || started ? 'progreso' : 'pendiente');

  return (
    <div>
      <button className="nk-back" onClick={() => go('maintenances')}><Icon name="arrow-left" size={15} />Mantenimientos</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="nk-page-title">{base.node}</h1>
            <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{base.code}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <TypePill type={base.type} /><StatusPill state={liveState} /><PriorityPill p={base.priority} />
            {base.recurring && <span className="nk-pill" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}><Icon name="repeat" size={12} />Recurrente</span>}
          </div>
        </div>
        <div className="nk-pagehead-actions">
          {liveState === 'pendiente' && <Button variant="primary" icon="check-circle-2" onClick={() => setStarted(true)}>Iniciar mantenimiento</Button>}
          <Button variant="secondary" icon="paperclip">Adjuntar evidencia</Button>
          <Button variant="danger" icon="check-circle-2" disabled={!canClose} onClick={() => setClosed(true)}>
            {closed ? 'Cerrado' : 'Cerrar mantenimiento'}
          </Button>
        </div>
      </div>

      {!closed && pct < 100 &&
        <div className="nk-callout"><Icon name="lock" size={15} /><span>No puedes cerrar: el checklist está al <b className="nk-mono">{pct}%</b>. Este mantenimiento solo puede cerrarse cuando esté al <b>100%</b>.</span></div>}
      {closed &&
        <div className="nk-callout is-ok"><Icon name="check-circle-2" size={15} /><span>Mantenimiento cerrado. Checklist completado al 100%.</span></div>}

      <div className="nk-grid" style={{ gridTemplateColumns: '1.5fr 1fr', marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Checklist */}
          <Card pad={false}>
            <div className="nk-card-head">
              <h3 className="nk-section-title">Checklist</h3>
              <span className="nk-mono" style={{ fontSize: 13, fontWeight: 600, color: pct === 100 ? 'var(--green-700)' : 'var(--amber-700)' }}>{pct}%</span>
            </div>
            <div style={{ padding: '0 18px' }}><ProgressBar value={pct} /></div>
            <div className="nk-checklist">
              {tasks.map((t, i) => (
                <button key={i} className={`nk-task ${t.done ? 'is-done' : ''}`} onClick={() => !closed && toggle(i)} disabled={closed}>
                  <span className={`nk-check ${t.done ? 'is-done' : ''}`}>{t.done && <Icon name="check" size={12} />}</span>
                  <span className="nk-task-label">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="nk-card-foot">
              <span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{tasks.filter((t) => t.done).length}/{tasks.length} tareas</span>
              {!closed && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Marca las tareas para actualizar el avance →</span>}
            </div>
          </Card>

          {/* Evidencias */}
          <Card pad={false}>
            <div className="nk-card-head"><h3 className="nk-section-title">Evidencias</h3><span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{evid.length}</span></div>
            <div className="nk-evid-grid">
              <button className="nk-evid-drop"><Icon name="upload-cloud" size={20} /><span>Subir archivo</span><small>Imagen o PDF</small></button>
              {evid.map((v) => (
                <div key={v.id} className="nk-evid">
                  <div className="nk-evid-thumb" style={{ background: v.kind === 'image' ? 'var(--blue-50)' : 'var(--gray-100)' }}>
                    <Icon name={v.kind === 'image' ? 'image' : 'file-text'} size={22} style={{ color: v.kind === 'image' ? 'var(--blue-600)' : 'var(--gray-500)' }} />
                  </div>
                  <div className="nk-evid-meta">
                    <span className="nk-evid-name">{v.name}</span>
                    <span className="nk-evid-sub nk-mono">{v.size} · {v.by}</span>
                  </div>
                  <button className="nk-iconbtn" style={{ width: 28, height: 28 }}><Icon name="download" size={15} /></button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Panel de detalle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card pad>
            <h3 className="nk-section-title" style={{ marginBottom: 14 }}>Detalle</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <DetRow k="Nodo" v={base.node} link onClick={() => go('node-detail', base.nodeId)} />
              <DetRow k="Tipo" v={base.type === 'preventivo' ? 'Preventivo' : 'Correctivo'} />
              {base.type === 'correctivo' && <DetRow k="Equipo" v={base.equip} mono />}
              <DetRow k="Responsable" v={base.resp} />
              <DetRow k="Programado" v={base.date} mono />
              <DetRow k="Ejecución" v={base.exec === 'terceros' ? 'Terceros' : 'Interno'} />
              <DetRow k="Recurrencia" v={base.recurring ? 'Mensual' : 'No aplica'} />
            </div>
          </Card>
          <Card pad>
            <h3 className="nk-section-title" style={{ marginBottom: 14 }}>Actividad</h3>
            <div className="nk-timeline">
              <TLItem dot="var(--blue-600)" title="Mantenimiento creado" time="2026-06-01 08:12" by="A. Vargas" />
              <TLItem dot="var(--amber-500)" title="En ejecución" time="2026-06-04 09:30" by={base.resp} />
              <TLItem dot="var(--green-600)" title="Evidencia adjuntada" time="2026-06-04 10:21" by={base.resp} last />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
