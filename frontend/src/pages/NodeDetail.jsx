/* Detalle de nodo: datos reales + equipos asociados (derivados filtrando
   GET /equipment por networkNodeId). ADMIN puede editar/eliminar. La sección
   de mantenimientos relacionados no se conecta aquí: el módulo de
   Mantenimientos está fuera de alcance de este bloque. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { NodeFormModal } from '../components/NodeFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import { showToast } from '../store/store.js';

export function NodeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const { data, error, loading, reload } = useAsync(() => networkNodeService.getById(id), [id]);
  const node = data?.networkNode ?? null;

  const { data: equipData, loading: equipLoading } = useAsync(() => equipmentService.list(), []);
  const equip = (equipData?.equipment ?? []).filter((e) => e.networkNodeId === id);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/nodos')}><Icon name="arrow-left" size={15} />Nodos</button>
        <LoadingSkeleton lines={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/nodos')}><Icon name="arrow-left" size={15} />Nodos</button>
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  if (!node) {
    return (
      <div>
        <button type="button" className="nk-back" onClick={() => navigate('/nodos')}><Icon name="arrow-left" size={15} />Nodos</button>
        <EmptyState icon="share-2" title="Nodo no encontrado" subtitle="El nodo pudo haber sido eliminado." />
      </div>
    );
  }

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await networkNodeService.remove(node.id);
      showToast('Nodo eliminado correctamente.');
      navigate('/nodos');
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el nodo.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <button type="button" className="nk-back" onClick={() => navigate('/nodos')}><Icon name="arrow-left" size={15} />Nodos</button>
      <div className="nk-pagehead" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="nk-node-ico"><Icon name="share-2" size={18} /></span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="nk-page-title">{node.name}</h1>
              <span className="nk-mono" style={{ fontSize: 13, color: 'var(--fg-3)' }}>{node.code}</span>
            </div>
            <p className="nk-page-sub">{node.location || 'Sin ubicación registrada'}</p>
          </div>
        </div>
        <div className="nk-pagehead-actions">
          <Button variant="secondary" icon="map-pin" onClick={() => navigate('/mapa')}>Ubicar</Button>
          {isAdmin && <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button>}
          {isAdmin && <Button variant="danger" icon="trash-2" onClick={() => setConfirmingDelete(true)}>Eliminar</Button>}
        </div>
      </div>

      <Card pad style={{ marginBottom: 16 }}>
        <div className="nk-meta-row">
          <div className="nk-meta"><span className="k">Estado</span><span className="v"><StatusBadge kind="node" value={node.status} /></span></div>
          <div className="nk-meta"><span className="k">Equipos</span><span className="v nk-mono">{equip.length}</span></div>
          {node.latitude != null && node.longitude != null && (
            <div className="nk-meta"><span className="k">Coordenadas</span><span className="v nk-mono" style={{ fontSize: 13 }}>{node.latitude}, {node.longitude}</span></div>
          )}
        </div>
      </Card>

      <Card pad={false}>
        <div className="nk-card-head"><h3 className="nk-section-title">Equipos asociados</h3><span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{equip.length}</span></div>
        {equipLoading ? (
          <div style={{ padding: 16 }}><LoadingSkeleton lines={2} /></div>
        ) : (
          <table className="nk-table">
            <thead><tr><th>Equipo</th><th>Categoría</th><th>Proveedor</th><th>Estado</th></tr></thead>
            <tbody>
              {equip.map((e) => (
                <tr key={e.id} onClick={() => navigate(`/equipos/${e.id}`)}>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.category}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.supportProvider?.companyName || 'No asignado'}</td>
                  <td><StatusBadge kind="equipment" value={e.status} /></td>
                </tr>
              ))}
              {equip.length === 0 && (
                <tr><td colSpan="4"><EmptyState icon="server" title="Sin equipos" subtitle="Este nodo no tiene equipos registrados." /></td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {editing && <NodeFormModal node={node} onClose={() => setEditing(false)} onSaved={reload} />}

      <ConfirmDialog
        open={confirmingDelete}
        title="Eliminar nodo"
        message={
          equip.length > 0
            ? `¿Deseas eliminar el nodo "${node.name}" (${node.code})? Tiene ${equip.length} ${equip.length === 1 ? 'equipo asociado que también se eliminará si no tiene historial de mantenimiento propio' : 'equipos asociados que también se eliminarán si no tienen historial de mantenimiento propio'}. La eliminación se rechazará si el nodo, o alguno de sus equipos, tiene mantenimientos registrados. Esta acción no se puede deshacer.`
            : `¿Deseas eliminar el nodo "${node.name}" (${node.code})? La eliminación se rechazará si el nodo tiene mantenimientos registrados. Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar nodo"
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
