/* Calendario de mantenimientos (junio 2026). Eventos coloreados por estado,
   con filtros por tipo, estado y nodo. Click en un evento → mantenimientos. */
import { useState } from 'react';
import { DATA, NK } from '../data/mockData.js';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { FilterChips, Select } from '../components/Inputs.jsx';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function Calendar({ go }) {
  const [type, setType] = useState('all');
  const [state, setState] = useState('all');
  const events = DATA.calendar.filter((e) => (type === 'all' || e.type === type) && (state === 'all' || e.state === state));
  const byDay = {};
  events.forEach((e) => { (byDay[e.day] = byDay[e.day] || []).push(e); });
  const cells = [];
  for (let i = 0; i < 30; i++) cells.push(i + 1); // junio empieza lunes → sin huecos iniciales
  const today = 4;

  return (
    <div>
      <PageHeader eyebrow="Programación" title="Calendario de mantenimientos"
        subtitle="Junio 2026"
        actions={(
          <>
            <Button variant="secondary" icon="chevron-left" size="sm"></Button>
            <Button variant="secondary" size="sm">Hoy</Button>
            <Button variant="secondary" icon="chevron-right" size="sm"></Button>
            <Button variant="primary" icon="plus">Programar</Button>
          </>
        )} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <FilterChips value={type} onChange={setType} options={[
          { value: 'all', label: 'Todo tipo' },
          { value: 'preventivo', label: 'Preventivo', dot: 'var(--blue-600)' },
          { value: 'correctivo', label: 'Correctivo', dot: 'var(--navy-600)' }]} />
        <FilterChips value={state} onChange={setState} options={[
          { value: 'all', label: 'Todo estado' },
          { value: 'pendiente', label: 'Pendiente', dot: 'var(--red-600)' },
          { value: 'progreso', label: 'En progreso', dot: 'var(--amber-500)' },
          { value: 'cerrado', label: 'Cerrado', dot: 'var(--green-600)' }]} />
        <Select value="all" onChange={() => {}} options={[{ value: 'all', label: 'Todos los nodos' }, ...DATA.nodes.map((n) => ({ value: n.id, label: n.name }))]} />
      </div>

      <Card pad={false} className="nk-cal">
        <div className="nk-cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="nk-cal-grid">
          {cells.map((day) => (
            <div key={day} className={`nk-cal-cell ${day === today ? 'is-today' : ''}`}>
              <span className="nk-cal-day">{day}</span>
              <div className="nk-cal-events">
                {(byDay[day] || []).slice(0, 3).map((e) => {
                  const s = NK.state[e.state];
                  return (
                    <button key={e.code} className="nk-cal-ev" style={{ background: s.bg, color: s.fg }} onClick={() => go('maintenances')}>
                      <span className="nk-dot" style={{ background: s.solid }}></span>
                      <span className="nk-cal-ev-txt">{e.node}</span>
                    </button>
                  );
                })}
                {(byDay[day] || []).length > 3 && <span className="nk-cal-more">+{byDay[day].length - 3} más</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
