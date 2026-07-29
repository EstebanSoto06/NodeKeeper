/* Detalle de proveedor: datos reales + equipos asociados (derivados filtrando
   GET /equipment por supportProviderId, ya que el backend no expone un
   endpoint dedicado equipos-por-proveedor). ADMIN ve editar/eliminar. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { DataList } from '../components/Modal.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { ProviderFormModal } from '../components/ProviderModals.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as supportProviderService from '../services/supportProviderService.js';
import * as equipmentService from '../services/equipmentService.js';
import { showToast } from '../store/store.js';

export function ProviderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const { data, error, loading, reload } = useAsync(() => supportProviderService.getById(id), [id]);
  const provider = data?.supportProvider ?? null;

  const { data: equipData, loading: equipLoading } = useAsync(() => equipmentService.list(), []);
  const equip = (equipData?.equipment ?? []).filter((e) => e.supportProviderId === id);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/proveedores')}><Icon name="arrow-left" size={15} />Proveedores</button>
        <LoadingSkeleton lines={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/proveedores')}><Icon name="arrow-left" size={15} />Proveedores</button>
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  if (!provider) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/proveedores')}><Icon name="arrow-left" size={15} />Proveedores</button>
        <EmptyState icon="building-2" title="Proveedor no encontrado" subtitle="El proveedor pudo haber sido eliminado." />
      </div>
    );
  }

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await supportProviderService.remove(provider.id);
      showToast('Proveedor eliminado. Los equipos asociados quedaron como "No asignado".');
      navigate('/proveedores');
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el proveedor.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <button type="button" className="nk-back" onClick={() => navigate('/proveedores')}><Icon name="arrow-left" size={15} />Proveedores</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="nk-modal-ico" style={{ width: 44, height: 44 }}><Icon name="building-2" size={20} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="nk-page-title">{provider.companyName}</h1>
              <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{provider.id}</span>
            </div>
            <p className="nk-page-sub">{equip.length} {equip.length === 1 ? 'equipo asociado' : 'equipos asociados'}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="nk-pagehead-actions">
            <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="danger" icon="trash-2" onClick={() => setConfirmingDelete(true)}>Eliminar</Button>
          </div>
        )}
      </div>

      <div className="nk-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <Card pad>
          <h3 className="nk-section-title" style={{ marginBottom: 12 }}>Datos del proveedor</h3>
          <DataList items={[
            { k: 'Empresa', v: provider.companyName },
            { k: 'Número de soporte', v: provider.supportPhone, mono: true },
            { k: 'Correo de soporte', v: provider.supportEmail },
            { k: 'Persona de contacto', v: provider.contactName },
            { k: 'Número de contacto', v: provider.contactPhone, mono: true },
            { k: 'Correo de contacto', v: provider.contactEmail },
          ]} />
        </Card>

        <Card pad={false}>
          <div className="nk-card-head"><h3 className="nk-section-title">Equipos asociados</h3><span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{equip.length}</span></div>
          {equipLoading ? (
            <div style={{ padding: 16 }}><LoadingSkeleton lines={2} /></div>
          ) : (
            <table className="nk-table">
              <thead><tr><th>Equipo</th><th>Categoría</th><th>Nodo</th><th>Estado</th></tr></thead>
              <tbody>
                {equip.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/equipos/${e.id}`)}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td style={{ color: 'var(--fg-2)' }}>{e.category}</td>
                    <td style={{ color: 'var(--fg-2)' }}>{e.networkNode?.name || '—'}</td>
                    <td><StatusBadge kind="equipment" value={e.status} /></td>
                  </tr>
                ))}
                {equip.length === 0 && (
                  <tr><td colSpan="4"><EmptyState icon="server" title="Sin equipos" subtitle="Ningún equipo usa este proveedor." /></td></tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {editing && <ProviderFormModal provider={provider} onClose={() => setEditing(false)} onSaved={reload} />}

      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar proveedor"
        message={`¿Deseas eliminar "${provider.companyName}"? Los equipos que tenga asociados quedarán como "No asignado".`}
        confirmLabel="Eliminar proveedor"
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
