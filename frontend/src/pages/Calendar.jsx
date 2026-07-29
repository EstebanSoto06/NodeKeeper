/* Calendario de mantenimientos, conectado a GET /maintenances (usa
   scheduledDate real). No hay endpoint de reprogramacion por
   arrastrar-y-soltar en el backend, por lo que esta vista es de solo
   consulta y navegacion: no se simula esa funcionalidad. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { FilterChips, Select } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import { MaintenanceFormModal } from '../components/MaintenanceFormModal.jsx';
import { resolveStatus } from '../utils/statusMaps.js';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABEL = new Intl.DateTimeFormat('es-CR', { month: 'long', year: 'numeric' });

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
// Offset lunes=0 ... domingo=6 (getDay() nativo es domingo=0).
function mondayOffset(date) { return (date.getDay() + 6) % 7; }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }
function sameYearMonth(dateStr, ref) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function Calendar() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data, error, loading, reload } = useAsync(() => maintenanceService.list(), []);
  const maintenances = data?.maintenances ?? [];

  const { data: nodesData } = useAsync(() => networkNodeService.list(), []);
  const nodes = nodesData?.networkNodes ?? [];

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [nodeId, setNodeId] = useState('all');
  const [creating, setCreating] = useState(false);

  const withoutDate = maintenances.filter((m) => !m.scheduledDate).length;

  const filtered = useMemo(() => maintenances.filter((m) =>
    (type === 'all' || m.type === type) &&
    (status === 'all' || m.status === status) &&
    (nodeId === 'all' || m.networkNodeId === nodeId || m.equipment?.networkNodeId === nodeId) &&
    sameYearMonth(m.scheduledDate, month)
  ), [maintenances, type, status, nodeId, month]);

  const byDay = useMemo(() => {
    const map = {};
    filtered.forEach((m) => {
      const day = new Date(m.scheduledDate).getDate();
      (map[day] = map[day] || []).push(m);
    });
    return map;
  }, [filtered]);

  const offset = mondayOffset(month);
  const totalDays = daysInMonth(month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();

  const goPrevMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNextMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => setMonth(startOfMonth(new Date()));

  const monthLabel = MONTH_LABEL.format(month);

  return (
    <div>
      <PageHeader eyebrow="Programación" title="Calendario de mantenimientos"
        subtitle={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        actions={(
          <>
            <Button variant="secondary" icon="chevron-left" size="sm" onClick={goPrevMonth}></Button>
            <Button variant="secondary" size="sm" onClick={goToday}>Hoy</Button>
            <Button variant="secondary" icon="chevron-right" size="sm" onClick={goNextMonth}></Button>
            {isAdmin && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Programar</Button>}
          </>
        )} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterChips value={type} onChange={setType} options={[
          { value: 'all', label: 'Todo tipo' },
          { value: 'PREVENTIVE', label: 'Preventivo', dot: 'var(--blue-600)' },
          { value: 'CORRECTIVE', label: 'Correctivo', dot: 'var(--navy-600)' }]} />
        <FilterChips value={status} onChange={setStatus} options={[
          { value: 'all', label: 'Todo estado' },
          { value: 'SCHEDULED', label: 'Programado', dot: 'var(--gray-400)' },
          { value: 'IN_PROGRESS', label: 'En progreso', dot: 'var(--blue-500)' },
          { value: 'COMPLETED', label: 'Completado', dot: 'var(--green-500)' },
          { value: 'CANCELLED', label: 'Cancelado', dot: 'var(--red-500)' }]} />
        <Select value={nodeId} onChange={setNodeId} options={[{ value: 'all', label: 'Todos los nodos' }, ...nodes.map((n) => ({ value: n.id, label: n.name }))]} />
      </div>

      {withoutDate > 0 && (
        <div className="nk-callout" style={{ marginBottom: 12 }}>
          <span><b className="nk-mono">{withoutDate}</b> {withoutDate === 1 ? 'mantenimiento no tiene' : 'mantenimientos no tienen'} fecha programada y no {withoutDate === 1 ? 'aparece' : 'aparecen'} en el calendario.</span>
        </div>
      )}

      {loading && <LoadingSkeleton lines={4} />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card pad={false} className="nk-cal">
          <div className="nk-cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="nk-cal-grid">
            {Array.from({ length: offset }).map((_, i) => <div key={`pad-${i}`} className="nk-cal-cell" style={{ visibility: 'hidden' }}></div>)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
              <div key={day} className={`nk-cal-cell ${isCurrentMonth && day === today.getDate() ? 'is-today' : ''}`}>
                <span className="nk-cal-day">{day}</span>
                <div className="nk-cal-events">
                  {(byDay[day] || []).slice(0, 3).map((m) => {
                    const s = resolveStatus('maintenance', m.status);
                    return (
                      <button key={m.id} type="button" className="nk-cal-ev" style={{ background: s.bg, color: s.fg }} onClick={() => navigate(`/mantenimientos/${m.id}`)}>
                        <span className="nk-dot" style={{ background: s.solid }}></span>
                        <span className="nk-cal-ev-txt">{m.title}</span>
                      </button>
                    );
                  })}
                  {(byDay[day] || []).length > 3 && <span className="nk-cal-more">+{byDay[day].length - 3} más</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {creating && <MaintenanceFormModal onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
}
