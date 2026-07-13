/* Reportes: filtros visuales (nodo + rango de fechas), tabla de mantenimientos
   realizados con estado, responsable, fecha de cierre y observaciones, y
   botón de exportación. Visual, sin backend. */
import { useState } from 'react';
import { DATA } from '../data/mockData.js';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Field, Select, TextInput } from '../components/Inputs.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { TypePill } from '../components/Badge.jsx';

const ROWS = [
  { code: 'MNT-2033', node: 'Repetidora Cerro Chato', nodeId: 'n3', type: 'preventivo', state: 'cerrado', resp: 'Karla Méndez', close: '2026-05-28', obs: 'Sin novedades. Firmware actualizado.' },
  { code: 'MNT-2025', node: 'Subestación Pital', nodeId: 'n5', type: 'correctivo', state: 'cerrado', resp: 'Adriana Vargas', close: '2026-05-22', obs: 'Batería UPS reemplazada.' },
  { code: 'MNT-2041', node: 'Subestación Ciudad Quesada', nodeId: 'n1', type: 'preventivo', state: 'progreso', resp: 'Adriana Vargas', close: '—', obs: 'En ejecución (50%).' },
  { code: 'MNT-2038', node: 'Nodo Industrial Florencia', nodeId: 'n4', type: 'correctivo', state: 'pendiente', resp: 'José Alvarado', close: '—', obs: 'Espera repuesto de generador.' },
  { code: 'MNT-2044', node: 'Repetidora Muelle', nodeId: 'n7', type: 'preventivo', state: 'cerrado', resp: 'Greivin Salas', close: '2026-06-12', obs: 'Inspección completa.' },
];

export function Reports() {
  const [node, setNode] = useState('all');
  const [from, setFrom] = useState('2026-05-01');
  const [to, setTo] = useState('2026-06-30');
  const rows = ROWS.filter((r) => node === 'all' || r.nodeId === node);

  return (
    <div>
      <PageHeader eyebrow="Análisis" title="Reportes"
        subtitle="Mantenimientos realizados por nodo y rango de fechas."
        actions={<Button variant="primary" icon="printer">Exportar</Button>} />

      <Card pad style={{ marginBottom: 16 }}>
        <div className="nk-report-form">
          <Field label="Nodo">
            <Select value={node} onChange={setNode} options={[{ value: 'all', label: 'Todos los nodos' }, ...DATA.nodes.map((n) => ({ value: n.id, label: n.name }))]} />
          </Field>
          <Field label="Desde"><TextInput type="date" value={from} onChange={setFrom} /></Field>
          <Field label="Hasta"><TextInput type="date" value={to} onChange={setTo} /></Field>
          <Field label="Estado">
            <Select value="all" onChange={() => {}} options={[{ value: 'all', label: 'Todos' }, { value: 'cerrado', label: 'Cerrado' }, { value: 'progreso', label: 'En progreso' }, { value: 'pendiente', label: 'Pendiente' }]} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button variant="secondary" icon="bar-chart-3" style={{ width: '100%' }}>Generar</Button>
          </div>
        </div>
      </Card>

      <Card pad={false}>
        <div className="nk-card-head">
          <h3 className="nk-section-title">Resultados</h3>
          <span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{rows.length} registros · {from} → {to}</span>
        </div>
        <table className="nk-table">
          <thead><tr><th>Código</th><th>Nodo</th><th>Tipo</th><th>Responsable</th><th>Cierre</th><th>Estado</th><th>Observaciones</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{r.code}</td>
                <td style={{ fontWeight: 600 }}>{r.node}</td>
                <td><TypePill type={r.type} /></td>
                <td style={{ color: 'var(--fg-2)' }}>{r.resp}</td>
                <td className="nk-mono" style={{ color: 'var(--fg-3)', fontSize: 12 }}>{r.close}</td>
                <td><StatusPill state={r.state} /></td>
                <td style={{ color: 'var(--fg-2)', maxWidth: 220 }}>{r.obs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="search-x" title="Sin registros" sub="Ajusta el nodo o el rango de fechas." />}
      </Card>
    </div>
  );
}
