/* Detalle de equipo, conectado a GET/PUT/DELETE /equipment/:id (ya incluye
   networkNode y supportProvider). ADMIN puede editar y eliminar; el popup de
   proveedor reutiliza ProviderInfoModal/ProviderFormModal. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { DataList } from '../components/Modal.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ProviderInfoModal, ProviderFormModal } from '../components/ProviderModals.jsx';
import { EquipmentFormModal } from '../components/EquipmentFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as equipmentService from '../services/equipmentService.js';
import { showToast } from '../store/store.js';

export function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const { data, error, loading, reload } = useAsync(() => equipmentService.getById(id), [id]);
  const equipment = data?.equipment ?? null;

  const [showProvider, setShowProvider] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/equipos')}><Icon name="arrow-left" size={15} />Equipos</button>
        <LoadingSkeleton lines={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/equipos')}><Icon name="arrow-left" size={15} />Equipos</button>
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/equipos')}><Icon name="arrow-left" size={15} />Equipos</button>
        <EmptyState icon="server" title="Equipo no encontrado" subtitle="El equipo pudo haber sido eliminado." />
      </div>
    );
  }

  const provider = equipment.supportProvider;

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await equipmentService.remove(equipment.id);
      showToast('Equipo eliminado correctamente.');
      navigate('/equipos');
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el equipo.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <button type="button" className="nk-back" onClick={() => navigate('/equipos')}><Icon name="arrow-left" size={15} />Equipos</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="nk-modal-ico" style={{ width: 44, height: 44 }}><Icon name="server" size={20} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="nk-page-title">{equipment.name}</h1>
              {equipment.serialNumber && <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{equipment.serialNumber}</span>}
            </div>
            <p className="nk-page-sub">{equipment.category} · {equipment.networkNode?.name || '—'}</p>
          </div>
        </div>
        <div className="nk-pagehead-actions">
          {isAdmin && <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button>}
          {isAdmin && <Button variant="danger" icon="trash-2" onClick={() => setConfirmingDelete(true)}>Eliminar</Button>}
        </div>
      </div>

      <Card pad style={{ marginBottom: 16 }}>
        <div className="nk-meta-row">
          <div className="nk-meta"><span className="k">Categoría</span><span className="v">{equipment.category}</span></div>
          <div className="nk-meta"><span className="k">Nodo</span><span className="v">{equipment.networkNode?.name || '—'}</span></div>
          <div className="nk-meta"><span className="k">Número de serie</span><span className="v nk-mono">{equipment.serialNumber || '—'}</span></div>
          <div className="nk-meta"><span className="k">Estado</span><span className="v"><StatusBadge kind="equipment" value={equipment.status} /></span></div>
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
        <ProviderInfoModal
          provider={provider}
          isAdmin={isAdmin}
          onClose={() => setShowProvider(false)}
          onGoToProvider={(pid) => navigate(`/proveedores/${pid}`)}
          onEdit={isAdmin ? () => setEditingProvider(true) : undefined}
        />
      )}
      {editing && <EquipmentFormModal equipment={equipment} onClose={() => setEditing(false)} onSaved={reload} />}
      {editingProvider && provider && (
        <ProviderFormModal provider={provider} onClose={() => setEditingProvider(false)} onSaved={reload} />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar equipo"
        message={`¿Deseas eliminar "${equipment.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar equipo"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDelete}
        onClose={() => { setConfirmingDelete(false); setDeleteError(''); }}
      >
        {deleteError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>}
      </ConfirmDialog>
    </div>
  );
}
