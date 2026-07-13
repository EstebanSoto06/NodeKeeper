/* Listado de nodos: búsqueda, filtros por estado (semáforo) y acceso al detalle. */
import { useState } from 'react';
import { DATA, NK } from '../data/mockData.js';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { SearchInput, FilterChips } from '../components/Inputs.jsx';
import { StatusPill, HealthDot } from '../components/StatusPill.jsx';
import { Icon } from '../components/Icon.jsx';

export function Nodes({ go }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const filters = [
    { value: 'all', label: 'Todos' },
    { value: 'red', label: 'Pendientes', dot: 'var(--red-600)' },
    { value: 'amber', label: 'Incompletos', dot: 'var(--amber-500)' },
    { value: 'green', label: 'Al día', dot: 'var(--green-600)' },
  ];
  const rows = DATA.nodes.filter((n) =>
    (filter === 'all' || n.health === filter) &&
    (q === '' || (n.name + n.code + n.city + n.locality).toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="Infraestructura" title="Nodos"
        subtitle={`${DATA.nodes.length} nodos · ${DATA.nodes.filter((n) => n.health === 'red').length} con pendientes`}
        actions={(
          <>
            <Button variant="secondary" icon="map" onClick={() => go('map')}>Ver en mapa</Button>
            <Button variant="primary" icon="plus">Crear nodo</Button>
          </>
        )} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar nodo, código o localidad…" style={{ flex: 1, minWidth: 240 }} />
        <FilterChips options={filters} value={filter} onChange={setFilter} />
        <Button variant="secondary" icon="sliders-horizontal" size="md">Filtros</Button>
      </div>
      <Card pad={false}>
        <table className="nk-table">
          <thead><tr><th></th><th>Código</th><th>Nodo</th><th>Localidad</th><th>Equipos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} onClick={() => go('node-detail', n.id)}>
                <td style={{ width: 8, paddingRight: 0 }}><HealthDot health={n.health} size={10} /></td>
                <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{n.code}</td>
                <td style={{ fontWeight: 600 }}>{n.name}</td>
                <td style={{ color: 'var(--fg-2)' }}>{n.city} · {n.locality}</td>
                <td className="nk-mono" style={{ color: 'var(--fg-3)' }}>{n.equip}</td>
                <td>
                  {n.health === 'red'
                    ? <StatusPill state={{ ...NK.health.red, label: `${n.pending} pendientes` }} />
                    : <StatusPill state={NK.health[n.health]} />}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--fg-3)' }}><Icon name="chevron-right" size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="search-x" title="Sin resultados" sub="Ajusta la búsqueda o los filtros." />}
      </Card>
    </div>
  );
}
