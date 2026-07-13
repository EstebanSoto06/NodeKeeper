/* Listado de mantenimientos: búsqueda + filtros por tipo y estado. Diferencia
   preventivo/correctivo y muestra avance del checklist. Acciones según rol:
   el Administrador crea cualquier orden; el Operador crea correctivos. */
import { useState } from 'react';
import { DATA, NK } from '../data/mockData.js';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card, ProgressBar } from '../components/Card.jsx';
import { SearchInput, FilterChips } from '../components/Inputs.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { TypePill, PriorityPill } from '../components/Badge.jsx';

export function Maintenances({ go, role }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [type, setType] = useState('all');

  const rows = DATA.maint.filter((m) =>
    (state === 'all' || m.state === state) &&
    (type === 'all' || m.type === type) &&
    (q === '' || (m.node + m.code + m.resp).toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="Órdenes de trabajo" title="Mantenimientos"
        subtitle={`${DATA.maint.length} órdenes · ${DATA.maint.filter((m) => m.state === 'pendiente').length} pendientes`}
        actions={role === 'admin'
          ? <Button variant="primary" icon="plus">Nuevo mantenimiento</Button>
          : <Button variant="primary" icon="wrench">Crear correctivo</Button>} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar código, nodo o responsable…" style={{ flex: 1, minWidth: 220 }} />
        <FilterChips value={type} onChange={setType} options={[
          { value: 'all', label: 'Todo tipo' },
          { value: 'preventivo', label: 'Preventivo', dot: 'var(--blue-600)' },
          { value: 'correctivo', label: 'Correctivo', dot: 'var(--navy-600)' }]} />
        <FilterChips value={state} onChange={setState} options={[
          { value: 'all', label: 'Todos' },
          { value: 'pendiente', label: 'Pendiente', dot: 'var(--red-600)' },
          { value: 'progreso', label: 'En progreso', dot: 'var(--amber-500)' },
          { value: 'cerrado', label: 'Cerrado', dot: 'var(--green-600)' }]} />
      </div>

      <Card pad={false}>
        <table className="nk-table">
          <thead><tr><th>Código</th><th>Nodo</th><th>Tipo</th><th>Prioridad</th><th>Responsable</th><th>Fecha</th><th>Avance</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} onClick={() => go('maint-detail', m.id)}>
                <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{m.code}</td>
                <td style={{ fontWeight: 600 }}>{m.node}</td>
                <td><TypePill type={m.type} /></td>
                <td><PriorityPill p={m.priority} /></td>
                <td style={{ color: 'var(--fg-2)' }}>{m.resp}</td>
                <td className="nk-mono" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{m.date}</td>
                <td style={{ width: 120 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ProgressBar value={NK.pct(m.tasks)} /><span className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)', width: 28 }}>{NK.pct(m.tasks)}%</span></div></td>
                <td><StatusPill state={m.state} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="search-x" title="Sin resultados" sub="Ajusta la búsqueda o los filtros." />}
      </Card>
    </div>
  );
}
