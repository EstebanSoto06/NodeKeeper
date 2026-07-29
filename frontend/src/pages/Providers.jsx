/* Proveedores de soporte, conectado a GET/POST/PUT/DELETE /support-providers.
   ADMIN puede crear, editar y eliminar. OPERATOR consulta en modo solo lectura. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Icon } from '../components/Icon.jsx';
import { Card } from '../components/Card.jsx';
import { SearchInput } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { ProviderFormModal } from '../components/ProviderModals.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { usePermissions } from '../hooks/usePermissions.js';
import * as supportProviderService from '../services/supportProviderService.js';
import { showToast } from '../store/store.js';

export function Providers() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data, error, loading, reload } = useAsync(() => supportProviderService.list(), []);
  const providers = data?.supportProviders ?? [];

  const [q, setQ] = useState('');
  const [formProvider, setFormProvider] = useState(undefined); // undefined=cerrado, null=crear, obj=editar
  const [delProvider, setDelProvider] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const rows = providers.filter((p) =>
    q === '' || (p.companyName + ' ' + p.contactName).toLowerCase().includes(q.toLowerCase()));

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await supportProviderService.remove(delProvider.id);
      setDelProvider(null);
      showToast('Proveedor eliminado. Los equipos asociados quedaron como "No asignado".');
      reload();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el proveedor.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Catálogo" title="Proveedores de soporte"
        subtitle={`${providers.length} proveedores registrados`}
        actions={isAdmin
          ? <Button variant="primary" icon="plus" onClick={() => setFormProvider(null)}>Crear proveedor</Button>
          : <span className="nk-provtag"><Icon name="eye" size={14} />Solo lectura</span>} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por empresa o persona de contacto…" style={{ flex: 1, minWidth: 240 }} />
      </div>

      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <table className="nk-table">
            <thead><tr>
              <th>Empresa</th><th>N.º de soporte</th><th>Correo de soporte</th><th>Contacto</th><th>N.º de contacto</th><th>Correo de contacto</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/proveedores/${p.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.companyName}</div>
                    <div className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.id}</div>
                  </td>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{p.supportPhone}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{p.supportEmail}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{p.contactName}</td>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{p.contactPhone}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{p.contactEmail}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(ev) => ev.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <IconButton name="eye" title="Ver" onClick={() => navigate(`/proveedores/${p.id}`)} style={{ width: 30, height: 30 }} />
                      {isAdmin && <IconButton name="pencil" title="Editar" onClick={() => setFormProvider(p)} style={{ width: 30, height: 30 }} />}
                      {isAdmin && <IconButton name="trash-2" title="Eliminar" onClick={() => setDelProvider(p)} style={{ width: 30, height: 30 }} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState icon="building-2" title="Sin proveedores" subtitle="No hay proveedores que coincidan con la búsqueda." />
        )}
      </Card>

      {formProvider !== undefined && (
        <ProviderFormModal provider={formProvider} onClose={() => setFormProvider(undefined)} onSaved={reload} />
      )}

      <ConfirmDialog
        open={!!delProvider}
        title="Eliminar proveedor"
        message={delProvider ? `¿Deseas eliminar "${delProvider.companyName}"? Los equipos que tenga asociados quedarán como "No asignado".` : ''}
        confirmLabel="Eliminar proveedor"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDelete}
        onClose={() => { setDelProvider(null); setDeleteError(''); }}
      >
        {deleteError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>}
      </ConfirmDialog>
    </div>
  );
}
