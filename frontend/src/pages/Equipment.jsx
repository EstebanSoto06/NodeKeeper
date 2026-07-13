/* Equipos: inventario por nodo, filtros por nodo y estado operativo, columna de
   proveedor de soporte y acción para crear mantenimiento correctivo.
   Cada fila abre el detalle del equipo. */
import { useState } from 'react';
import { DATA, NK } from '../data/mockData.js';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { SearchInput, Select, FilterChips } from '../components/Inputs.jsx';
import { EquipmentFormModal } from '../components/EquipmentFormModal.jsx';
import { useStore, providerOfEquipment } from '../store/store.js';

export function Equipment({ go, role }) {
  useStore(); // re-render ante cambios de asignación de proveedor
  const [q, setQ] = useState('');
  const [node, setNode] = useState('all');
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);

  const rows = DATA.equipment
    .map((e) => ({ ...e, node: DATA.nodes.find((n) => n.id === e.nodeId)?.name || '—', provider: providerOfEquipment(e.id) }))
    .filter((e) =>
      (node === 'all' || e.nodeId === node) &&
      (status === 'all' || e.status === status) &&
      (q === '' || (e.name + e.code + e.node).toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="Inventario" title="Equipos"
        subtitle={`${DATA.equipment.length} equipos en ${DATA.nodes.length} nodos`}
        actions={(
          <>
            <Button variant="secondary" icon="wrench" onClick={() => go('maintenances')}>Crear correctivo</Button>
            {role === 'admin' && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Registrar equipo</Button>}
          </>
        )} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar equipo, código o nodo…" style={{ flex: 1, minWidth: 220 }} />
        <Select value={node} onChange={setNode} options={[{ value: 'all', label: 'Todos los nodos' }, ...DATA.nodes.map((n) => ({ value: n.id, label: n.name }))]} />
        <FilterChips value={status} onChange={setStatus} options={[
          { value: 'all', label: 'Todos' },
          { value: 'operativo', label: 'Operativo', dot: 'var(--green-600)' },
          { value: 'alerta', label: 'Alerta', dot: 'var(--amber-500)' },
          { value: 'falla', label: 'Falla', dot: 'var(--red-600)' }]} />
      </div>

      <Card pad={false}>
        <table className="nk-table">
          <thead><tr><th>Código</th><th>Equipo</th><th>Tipo</th><th>Nodo</th><th>Proveedor de soporte</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((e) => { const s = NK.equipStatus[e.status]; return (
              <tr key={e.id} onClick={() => go('equipment-detail', e.id)}>
                <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{e.code}</td>
                <td style={{ fontWeight: 600 }}>{e.name}</td>
                <td style={{ color: 'var(--fg-2)' }}>{e.type}</td>
                <td style={{ color: 'var(--fg-2)' }}>{e.node}</td>
                <td>{e.provider
                  ? <span className="nk-provtag"><Icon name="building-2" size={13} />{e.provider.companyName}</span>
                  : <span className="nk-prov-none">No asignado</span>}</td>
                <td><span className="nk-pill" style={{ background: s.bg, color: s.fg }}><span className="nk-dot" style={{ background: s.solid }}></span>{s.label}</span></td>
                <td style={{ textAlign: 'right' }} onClick={(ev) => { ev.stopPropagation(); go('maintenances'); }}>
                  <IconButton name="wrench" title="Crear correctivo" style={{ width: 30, height: 30 }} />
                </td>
              </tr>); })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="search-x" title="Sin resultados" sub="Ajusta la búsqueda o los filtros." />}
      </Card>

      {creating && <EquipmentFormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
