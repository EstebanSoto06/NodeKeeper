/* Reportes de mantenimientos, conectado a GET /maintenances (incluye
   networkNode, equipment, createdBy, checklistTasks y evidences). El
   backend no expone un campo "responsable" dedicado: se usa createdBy
   (creador) como el campo real mas cercano, etiquetado explicitamente
   "Creado por" para no insinuar un dato que no existe. Exportacion CSV
   sin dependencias (escape manual) y vista imprimible via window.print()
   + CSS @media print (sin generacion de PDF en servidor). */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Field, Select, TextInput } from '../components/Inputs.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import { MAINTENANCE_STATUS, MAINTENANCE_TYPE } from '../utils/statusMaps.js';

function toDateOnly(v) { return v ? String(v).slice(0, 10) : ''; }

function inRange(dateStr, from, to) {
  if (!dateStr) return !from && !to ? true : false;
  const d = toDateOnly(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function progressOf(m) {
  const tasks = m.checklistTasks || [];
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.isCompleted).length / tasks.length) * 100);
}

// Escapa un valor para CSV (RFC 4180): si contiene coma, comilla o salto de
// linea, se envuelve en comillas dobles y cada comilla interna se duplica.
function csvField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows) {
  const header = ['Mantenimiento', 'Tipo', 'Estado', 'Nodo/Equipo', 'Programado', 'Inicio', 'Finalización', 'Creado por', 'Progreso checklist', 'Evidencias', 'Descripción'];
  const lines = [header.map(csvField).join(',')];
  rows.forEach((m) => {
    lines.push([
      m.title,
      MAINTENANCE_TYPE[m.type]?.label || m.type,
      MAINTENANCE_STATUS[m.status]?.label || m.status,
      m.type === 'PREVENTIVE' ? (m.networkNode?.name || '') : (m.equipment?.name || ''),
      toDateOnly(m.scheduledDate),
      toDateOnly(m.startedAt),
      toDateOnly(m.completedAt),
      m.createdBy?.name || '',
      `${progressOf(m)}%`,
      (m.evidences || []).length,
      m.description || '',
    ].map(csvField).join(','));
  });
  return lines.join('\r\n');
}

function downloadCsv(csv) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `reportes-mantenimientos-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EMPTY_FILTERS = { from: '', to: '', status: 'all', type: 'all', nodeId: 'all', equipmentId: 'all' };

export function Reports() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(() => maintenanceService.list(), []);
  const maintenances = data?.maintenances ?? [];

  const { data: nodesData } = useAsync(() => networkNodeService.list(), []);
  const { data: equipData } = useAsync(() => equipmentService.list(), []);
  const nodes = nodesData?.networkNodes ?? [];
  const equipmentList = equipData?.equipment ?? [];

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const set = (k) => (val) => setFilters((f) => ({ ...f, [k]: val }));

  const rows = useMemo(() => maintenances.filter((m) =>
    inRange(m.scheduledDate, filters.from, filters.to) &&
    (filters.status === 'all' || m.status === filters.status) &&
    (filters.type === 'all' || m.type === filters.type) &&
    (filters.nodeId === 'all' || m.networkNodeId === filters.nodeId || m.equipment?.networkNodeId === filters.nodeId) &&
    (filters.equipmentId === 'all' || m.equipmentId === filters.equipmentId)
  ), [maintenances, filters]);

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k]);

  return (
    <div>
      <PageHeader eyebrow="Análisis" title="Reportes"
        subtitle="Mantenimientos filtrados por fecha, estado, tipo, nodo y equipo."
        actions={(
          <div className="no-print" style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon="printer" onClick={() => window.print()}>Vista imprimible</Button>
            <Button variant="primary" icon="download" onClick={() => downloadCsv(buildCsv(rows))} disabled={rows.length === 0}>Exportar CSV</Button>
          </div>
        )} />

      <Card pad style={{ marginBottom: 16 }} className="no-print">
        <div className="nk-report-form">
          <Field label="Desde"><TextInput type="date" value={filters.from} onChange={set('from')} /></Field>
          <Field label="Hasta"><TextInput type="date" value={filters.to} onChange={set('to')} /></Field>
          <Field label="Estado">
            <Select value={filters.status} onChange={set('status')} options={[{ value: 'all', label: 'Todos' }, ...Object.entries(MAINTENANCE_STATUS).map(([v, s]) => ({ value: v, label: s.label }))]} />
          </Field>
          <Field label="Tipo">
            <Select value={filters.type} onChange={set('type')} options={[{ value: 'all', label: 'Todos' }, ...Object.entries(MAINTENANCE_TYPE).map(([v, s]) => ({ value: v, label: s.label }))]} />
          </Field>
          <Field label="Nodo">
            <Select value={filters.nodeId} onChange={set('nodeId')} options={[{ value: 'all', label: 'Todos los nodos' }, ...nodes.map((n) => ({ value: n.id, label: n.name }))]} />
          </Field>
          <Field label="Equipo">
            <Select value={filters.equipmentId} onChange={set('equipmentId')} options={[{ value: 'all', label: 'Todos los equipos' }, ...equipmentList.map((e) => ({ value: e.id, label: e.name }))]} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasActiveFilters} style={{ width: '100%' }}>Limpiar filtros</Button>
          </div>
        </div>
      </Card>

      {loading && <LoadingSkeleton lines={4} />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card pad={false}>
          <div className="nk-card-head">
            <h3 className="nk-section-title">Resultados</h3>
            <span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{rows.length} de {maintenances.length} registros</span>
          </div>
          <table className="nk-table">
            <thead><tr>
              <th>Mantenimiento</th><th>Tipo</th><th>Estado</th><th>Nodo / Equipo</th>
              <th>Programado</th><th>Inicio</th><th>Fin</th><th>Creado por</th>
              <th>Checklist</th><th>Evid.</th>
            </tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} onClick={() => navigate(`/mantenimientos/${m.id}`)}>
                  <td style={{ fontWeight: 600 }}>{m.title}</td>
                  <td><StatusBadge kind="maintenanceType" value={m.type} /></td>
                  <td><StatusBadge kind="maintenance" value={m.status} /></td>
                  <td style={{ color: 'var(--fg-2)' }}>{m.type === 'PREVENTIVE' ? (m.networkNode?.name || '—') : (m.equipment?.name || '—')}</td>
                  <td className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{toDateOnly(m.scheduledDate) || '—'}</td>
                  <td className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{toDateOnly(m.startedAt) || '—'}</td>
                  <td className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{toDateOnly(m.completedAt) || '—'}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{m.createdBy?.name || '—'}</td>
                  <td className="nk-mono" style={{ fontSize: 12 }}>{progressOf(m)}%</td>
                  <td className="nk-mono" style={{ fontSize: 12 }}>{(m.evidences || []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon="search-x" title="Sin registros" subtitle="Ajusta los filtros para ver resultados." />}
        </Card>
      )}
    </div>
  );
}
