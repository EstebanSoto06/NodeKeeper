/* Proveedores de soporte: tabla con empresa, números de soporte, correos de soporte, contacto, números de contacto, correos de contacto y equipos asociados.
   Admin puede crear, editar y eliminar. Operador solo consulta en modo solo lectura. */
import { useState } from 'react';
import { PageHeader, Empty } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { SearchInput } from '../components/Inputs.jsx';
import { ProviderFormModal, DeleteProviderModal } from '../components/ProviderModals.jsx';
import { useStore, equipmentCountForProvider } from '../store/store.js';

export function Providers({ go, role }) {
  const { providers } = useStore();
  const [q, setQ] = useState('');
  const [formProvider, setFormProvider] = useState(undefined); // undefined=cerrado, null=crear, obj=editar
  const [delProvider, setDelProvider] = useState(null);
  const isAdmin = role === 'admin';

  const rows = providers.filter((p) =>
    q === '' || (p.companyName + ' ' + p.contactName).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Catálogo" title="Proveedores de soporte"
        subtitle={`${providers.length} proveedores registrados`}
        actions={isAdmin
          ? <Button variant="primary" icon="plus" onClick={() => setFormProvider(null)}>Crear proveedor</Button>
          : <span className="nk-provtag"><span className="ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>Solo lectura</span>} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por empresa o persona de contacto…" style={{ flex: 1, minWidth: 240 }} />
      </div>

      <Card pad={false}>
        <table className="nk-table">
          <thead><tr>
            <th>Empresa</th><th>N.º de soporte</th><th>Correo de soporte</th><th>Contacto</th><th>N.º de contacto</th><th>Correo de contacto</th><th>Equipos</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((p) => {
              const count = equipmentCountForProvider(p.id);
              return (
                <tr key={p.id} onClick={() => go('provider-detail', p.id)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.companyName}</div>
                    <div className="nk-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.id}</div>
                  </td>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{p.supportPhone}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{p.supportEmail}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{p.contactName}</td>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{p.contactPhone}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{p.contactEmail}</td>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)' }}>{count}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(ev) => ev.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <IconButton name="eye" title="Ver" onClick={() => go('provider-detail', p.id)} style={{ width: 30, height: 30 }} />
                      {isAdmin && <IconButton name="pencil" title="Editar" onClick={() => setFormProvider(p)} style={{ width: 30, height: 30 }} />}
                      {isAdmin && <IconButton name="trash-2" title="Eliminar" onClick={() => setDelProvider(p)} style={{ width: 30, height: 30 }} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="building-2" title="Sin proveedores" sub="No hay proveedores que coincidan con la búsqueda." />}
      </Card>

      {formProvider !== undefined && <ProviderFormModal provider={formProvider} onClose={() => setFormProvider(undefined)} />}
      {delProvider && <DeleteProviderModal provider={delProvider} onClose={() => setDelProvider(null)} />}
    </div>
  );
}
