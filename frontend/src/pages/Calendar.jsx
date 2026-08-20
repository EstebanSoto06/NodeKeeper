/* Calendario de mantenimientos, conectado a GET /maintenances (usa
   scheduledDate real).

   Reprogramar arrastrando: no existe un endpoint dedicado, asi que el drop
   usa el mecanismo real de actualizacion (PUT /maintenances/:id via
   maintenanceService.update) reenviando la orden completa con la nueva fecha
   (utils/maintenancePayload.js). Solo ADMIN puede hacerlo -- el backend
   autoriza esa ruta unicamente para ese rol -- y solo sobre ordenes abiertas:
   una COMPLETED o CANCELLED no se arrastra (utils/maintenanceState.js
   #canReschedule). No se toca status, startedAt ni completedAt. */
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
import { buildMaintenanceUpdatePayload } from '../utils/maintenancePayload.js';
import { showToast } from '../store/store.js';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABEL = new Intl.DateTimeFormat('es-CR', { month: 'long', year: 'numeric' });

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
// Offset lunes=0 ... domingo=6 (getDay() nativo es domingo=0).
function mondayOffset(date) { return (date.getDay() + 6) % 7; }
function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }
function pad2(n) { return String(n).padStart(2, '0'); }

/* El backend devuelve scheduledDate como ISO en UTC ("2026-03-01T00:00:00.000Z").
   Pasarlo por new Date() lo interpreta en hora local y en una zona negativa
   (Costa Rica es UTC-6) lo corre al dia anterior, colocando el evento en una
   celda equivocada. El calendario lee siempre la parte de fecha del string,
   que es exactamente el dia que se programo. */
function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function sameYearMonth(dateStr, ref) {
  const parts = dateParts(dateStr);
  if (!parts) return false;
  return parts.year === ref.getFullYear() && parts.month === ref.getMonth() + 1;
}

/** Fecha "YYYY-MM-DD" de una celda del mes visible. */
function cellDate(month, day) {
  return `${month.getFullYear()}-${pad2(month.getMonth() + 1)}-${pad2(day)}`;
}

export function Calendar() {
  const navigate = useNavigate();
  const { isAdmin, canRescheduleMaintenanceFor } = usePermissions();
  const { data, error, loading, reload } = useAsync(() => maintenanceService.list(), []);
  const maintenances = data?.maintenances ?? [];

  const { data: nodesData } = useAsync(() => networkNodeService.list(), []);
  const nodes = nodesData?.networkNodes ?? [];

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [nodeId, setNodeId] = useState('all');
  const [creating, setCreating] = useState(false);

  // Arrastre: id de la orden que se esta moviendo, dia sobre el que se
  // sobrevuela y orden que esta guardando su nueva fecha.
  const [draggingId, setDraggingId] = useState(null);
  const [dropDay, setDropDay] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [rescheduleError, setRescheduleError] = useState('');

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
      const day = dateParts(m.scheduledDate)?.day;
      if (!day) return;
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

  const canDrag = (m) => canRescheduleMaintenanceFor(m.status) && savingId === null;

  const handleDragStart = (e, m) => {
    // text/plain es el unico tipo garantizado en todos los navegadores; el id
    // tambien se guarda en estado porque durante dragover no puede leerse.
    e.dataTransfer.setData('text/plain', m.id);
    e.dataTransfer.effectAllowed = 'move';
    setRescheduleError('');
    setDraggingId(m.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropDay(null);
  };

  const handleDragOver = (e, day) => {
    if (!draggingId) return;
    // preventDefault marca la celda como destino valido: sin el, el navegador
    // rechaza el drop.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropDay !== day) setDropDay(day);
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDropDay(null);
    if (!id) return;

    const target = maintenances.find((m) => m.id === id);
    // Se revalida contra el dato real, no contra el estado del arrastre: la
    // orden pudo cambiar de estado en una recarga mientras se arrastraba.
    if (!target || !canRescheduleMaintenanceFor(target.status)) return;

    const nextDate = cellDate(month, day);
    if (String(target.scheduledDate ?? '').slice(0, 10) === nextDate) return;

    setSavingId(id);
    setRescheduleError('');
    try {
      await maintenanceService.update(id, buildMaintenanceUpdatePayload(target, { scheduledDate: nextDate }));
      showToast(`"${target.title}" se reprogramó para el ${nextDate}.`);
      await reload();
    } catch (err) {
      setRescheduleError(err.message || 'No se pudo reprogramar el mantenimiento.');
    } finally {
      setSavingId(null);
    }
  };

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

      {isAdmin && (
        <p className="nk-cal-hint">
          Arrastra un mantenimiento a otro día para reprogramarlo. Las órdenes completadas o
          canceladas no se pueden mover.
        </p>
      )}

      {rescheduleError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}><span>{rescheduleError}</span></div>
      )}

      {loading && <LoadingSkeleton lines={4} />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card pad={false} className="nk-cal">
          <div className="nk-cal-dow">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="nk-cal-grid">
            {Array.from({ length: offset }).map((_, i) => <div key={`pad-${i}`} className="nk-cal-cell" style={{ visibility: 'hidden' }}></div>)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
              <div
                key={day}
                className={`nk-cal-cell ${isCurrentMonth && day === today.getDate() ? 'is-today' : ''} ${dropDay === day ? 'is-drop-target' : ''}`}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={() => setDropDay((d) => (d === day ? null : d))}
                onDrop={(e) => handleDrop(e, day)}
              >
                <span className="nk-cal-day">{day}</span>
                <div className="nk-cal-events">
                  {(byDay[day] || []).slice(0, 3).map((m) => {
                    const s = resolveStatus('maintenance', m.status);
                    const draggable = canDrag(m);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`nk-cal-ev ${draggable ? 'is-draggable' : ''} ${draggingId === m.id ? 'is-dragging' : ''}`}
                        style={{ background: s.bg, color: s.fg, opacity: savingId === m.id ? 0.5 : 1 }}
                        draggable={draggable}
                        title={draggable ? `${m.title} — arrastra para reprogramar` : m.title}
                        onDragStart={draggable ? (e) => handleDragStart(e, m) : undefined}
                        onDragEnd={draggable ? handleDragEnd : undefined}
                        onClick={() => navigate(`/mantenimientos/${m.id}`)}
                      >
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
