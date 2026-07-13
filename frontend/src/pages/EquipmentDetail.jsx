/* Detalle de equipo: información general + sección "Soporte del equipo".
   Cuando hay proveedor, muestra sus datos y el botón "Ver proveedor" (abre el
   popup). Cuando no, muestra el mensaje de "No asignado". El Administrador
   puede editar el equipo (incl. su proveedor) y crear un correctivo. */
import { useState } from 'react';
import { Empty } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { DataList } from '../components/Modal.jsx';
import { Icon } from '../components/Icon.jsx';
import { DATA, NK } from '../data/mockData.js';
import { ProviderInfoModal, ProviderFormModal } from '../components/ProviderModals.jsx';
import { EquipmentFormModal } from '../components/EquipmentFormModal.jsx';
import { useStore, providerOfEquipment } from '../store/store.js';

export function EquipmentDetail({ id, go, role }) {
  useStore(); // re-render ante cambios de asignación
  const [showProvider, setShowProvider] = useState(false);
  const [editing, setEditing] = useState(false);          // edición del EQUIPO
  const [editingProvider, setEditingProvider] = useState(false); // edición del PROVEEDOR
  const isAdmin = role === 'admin';

  const e = DATA.equipment.find((x) => x.id === id) || DATA.equipment[0];
  const node = DATA.nodes.find((n) => n.id === e.nodeId);
  const provider = providerOfEquipment(e.id);
  const s = NK.equipStatus[e.status];

  return (
    <div>
      <button className="nk-back" onClick={() => go('equipment')}><Icon name="arrow-left" size={15} />Equipos</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="nk-modal-ico" style={{ width: 44, height: 44 }}><Icon name="server" size={20} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="nk-page-title">{e.name}</h1>
              <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{e.code}</span>
            </div>
            <p className="nk-page-sub">{e.type} · {node?.name}</p>
          </div>
        </div>
        <div className="nk-pagehead-actions">
          <Button variant="secondary" icon="wrench" onClick={() => go('maintenances')}>Crear correctivo</Button>
          {isAdmin && <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button>}
        </div>
      </div>

      <Card pad style={{ marginBottom: 16 }}>
        <div className="nk-meta-row">
          <div className="nk-meta"><span className="k">Código</span><span className="v nk-mono">{e.code}</span></div>
          <div className="nk-meta"><span className="k">Tipo</span><span className="v">{e.type}</span></div>
          <div className="nk-meta"><span className="k">Nodo</span><span className="v">{node?.name}</span></div>
          <div className="nk-meta"><span className="k">Estado</span><span className="v"><span className="nk-pill" style={{ background: s.bg, color: s.fg }}><span className="nk-dot" style={{ background: s.solid }}></span>{s.label}</span></span></div>
        </div>
      </Card>

      <Card pad style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: provider ? 12 : 0 }}>
          <h3 className="nk-section-title">Soporte del equipo</h3>
          {provider && <Button variant="secondary" size="sm" icon="building-2" onClick={() => setShowProvider(true)}>Ver proveedor</Button>}
        </div>
        {provider ? (
          <DataList items={[
            { k: 'Empresa', v: provider.companyName },
            { k: 'Número de soporte', v: provider.supportPhone, mono: true },
            { k: 'Correo de soporte', v: provider.supportEmail },
            { k: 'Persona de contacto', v: provider.contactName },
            { k: 'Número de contacto', v: provider.contactPhone, mono: true },
            { k: 'Correo de contacto', v: provider.contactEmail },
          ]} />
        ) : (
          <div className="nk-support-empty">
            <Icon name="building-2" size={18} />
            No hay un proveedor de soporte asignado a este equipo.
          </div>
        )}
      </Card>

      {showProvider && provider && (
        <ProviderInfoModal provider={provider} role={role}
          onClose={() => setShowProvider(false)}
          onGoToProvider={(pid) => go('provider-detail', pid)}
          onEdit={isAdmin ? () => setEditingProvider(true) : undefined} />
      )}
      {editing && <EquipmentFormModal equipment={e} onClose={() => setEditing(false)} />}
      {editingProvider && provider && (
        <ProviderFormModal provider={provider} onClose={() => setEditingProvider(false)} />
      )}
    </div>
  );
}
