/* Detalle de proveedor: datos completos + equipos asociados (cada uno abre su
   detalle). Administrador ve acciones de editar/eliminar; Operador solo consulta. */
import { useState } from 'react';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { DataList } from '../components/Modal.jsx';
import { Icon } from '../components/Icon.jsx';
import { DATA, NK } from '../data/mockData.js';
import { ProviderFormModal, DeleteProviderModal } from '../components/ProviderModals.jsx';
import { useStore, providerById, equipmentIdsForProvider } from '../store/store.js';

export function ProviderDetail({ id, go, role }) {
  useStore(); // re-render ante cambios del store
  const p = providerById(id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isAdmin = role === 'admin';

  if (!p) {
    return (
      <div>
        <button className="nk-back" onClick={() => go('providers')}><Icon name="arrow-left" size={15} />Proveedores</button>
        <Empty icon="building-2" title="Proveedor no encontrado" sub="El proveedor pudo haber sido eliminado." />
      </div>
    );
  }

  const eqIds = equipmentIdsForProvider(p.id);
  const equip = DATA.equipment.filter((e) => eqIds.includes(e.id))
    .map((e) => ({ ...e, node: DATA.nodes.find((n) => n.id === e.nodeId)?.name || '—' }));

  return (
    <div>
      <button className="nk-back" onClick={() => go('providers')}><Icon name="arrow-left" size={15} />Proveedores</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="nk-modal-ico" style={{ width: 44, height: 44 }}><Icon name="building-2" size={20} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="nk-page-title">{p.companyName}</h1>
              <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{p.id}</span>
            </div>
            <p className="nk-page-sub">{equip.length} {equip.length === 1 ? 'equipo asociado' : 'equipos asociados'}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="nk-pagehead-actions">
            <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="danger" icon="trash-2" onClick={() => setDeleting(true)}>Eliminar</Button>
          </div>
        )}
      </div>

      <div className="nk-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <Card pad>
          <h3 className="nk-section-title" style={{ marginBottom: 12 }}>Datos del proveedor</h3>
          <DataList items={[
            { k: 'Empresa', v: p.companyName },
            { k: 'Número de soporte', v: p.supportPhone, mono: true },
            { k: 'Correo de soporte', v: p.supportEmail },
            { k: 'Persona de contacto', v: p.contactName },
            { k: 'Número de contacto', v: p.contactPhone, mono: true },
            { k: 'Correo de contacto', v: p.contactEmail },
          ]} />
        </Card>

        <Card pad={false}>
          <div className="nk-card-head"><h3 className="nk-section-title">Equipos asociados</h3><span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{equip.length}</span></div>
          <table className="nk-table">
            <thead><tr><th>Código</th><th>Equipo</th><th>Nodo</th><th>Estado</th></tr></thead>
            <tbody>
              {equip.map((e) => { const s = NK.equipStatus[e.status]; return (
                <tr key={e.id} onClick={() => go('equipment-detail', e.id)}>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{e.code}</td>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.node}</td>
                  <td><span className="nk-pill" style={{ background: s.bg, color: s.fg }}><span className="nk-dot" style={{ background: s.solid }}></span>{s.label}</span></td>
                </tr>); })}
              {equip.length === 0 && <tr><td colSpan="4"><Empty icon="server" title="Sin equipos" sub="Ningún equipo usa este proveedor." /></td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {editing && <ProviderFormModal provider={p} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteProviderModal
          provider={p}
          onClose={() => setDeleting(false)}
          onDeleted={() => { setDeleting(false); go('providers'); }} />
      )}
    </div>
  );
}
