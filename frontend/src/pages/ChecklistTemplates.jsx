/* Plantillas de checklist (listas de tareas reutilizables), conectado a
   GET/POST/PUT/DELETE /checklist-templates.

   Exclusivo de ADMIN: esta pantalla solo se monta bajo una ProtectedRoute con
   roles={['ADMIN']} (ver AppRoutes.jsx) y el Sidebar solo muestra el enlace en
   la sección Administración, que ya está condicionada a ese rol. El backend
   además rechaza con 403 las CINCO rutas del módulo, incluidas las de
   lectura, así que la restricción no depende de ocultar controles.

   Una plantilla no tiene ninguna relación con los mantenimientos: aplicarla
   COPIA sus tareas. Por eso eliminarla nunca afecta a órdenes existentes, y
   la interfaz lo dice de forma explícita antes de confirmar. */
import { useState } from 'react';
import { PageHeader } from '../components/Misc.jsx';
import { Button, IconButton } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { SearchInput } from '../components/Inputs.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Icon } from '../components/Icon.jsx';
import { ChecklistTemplateFormModal } from '../components/ChecklistTemplateFormModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as checklistTemplateService from '../services/checklistTemplateService.js';
import { showToast } from '../store/store.js';

export function ChecklistTemplates() {
  const { data, error, loading, reload } = useAsync(() => checklistTemplateService.list(), []);
  const templates = data?.checklistTemplates ?? [];

  const [q, setQ] = useState('');
  // undefined = cerrado, null = crear, objeto = editar (mismo patrón que Users.jsx)
  const [formTemplate, setFormTemplate] = useState(undefined);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const rows = templates.filter(
    (template) =>
      q === '' ||
      `${template.name} ${template.description ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  );

  const totalTasks = templates.reduce(
    (sum, template) => sum + (template.items?.length ?? 0),
    0,
  );

  const confirmDelete = async () => {
    if (!deletingTemplate) return;

    setDeleting(true);
    setDeleteError('');
    try {
      await checklistTemplateService.remove(deletingTemplate.id);
      showToast('Lista de tareas eliminada correctamente.');
      setDeletingTemplate(null);
      reload();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar la lista de tareas.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Plantillas de checklist"
        subtitle={`${templates.length} ${templates.length === 1 ? 'lista' : 'listas'} · ${totalTasks} tareas definidas`}
        actions={(
          <Button variant="primary" icon="plus" onClick={() => setFormTemplate(null)}>
            Nueva lista
          </Button>
        )}
      />

      <Card pad style={{ marginBottom: 16, background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--blue-700)', fontSize: 13 }}>
          <Icon name="list" size={16} />
          <span>
            Al aplicar una lista a un mantenimiento sus tareas se copian. Editar o
            eliminar la lista después no modifica los mantenimientos ya creados.
          </span>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar lista…" style={{ flex: 1, minWidth: 220 }} />
      </div>

      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && (
          <table className="nk-table">
            <thead>
              <tr>
                <th>Lista</th>
                <th>Tareas</th>
                <th>Actualizada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((template) => (
                <tr key={template.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    {template.description && (
                      <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{template.description}</div>
                    )}
                  </td>
                  <td className="nk-mono" style={{ fontSize: 13 }}>
                    {template.items?.length ?? 0}
                  </td>
                  <td className="nk-mono" style={{ color: 'var(--fg-2)', fontSize: 12 }}>
                    {String(template.updatedAt).slice(0, 10)}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <IconButton
                        name="pencil"
                        title="Editar"
                        onClick={() => setFormTemplate(template)}
                        style={{ width: 30, height: 30 }}
                      />
                      <IconButton
                        name="trash-2"
                        title="Eliminar"
                        onClick={() => setDeletingTemplate(template)}
                        style={{ width: 30, height: 30 }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon="list"
            title="Sin listas de tareas"
            subtitle={
              templates.length === 0
                ? 'Crea una lista reutilizable para aplicarla a los mantenimientos.'
                : 'No hay listas que coincidan con la búsqueda.'
            }
          />
        )}
      </Card>

      {formTemplate !== undefined && (
        <ChecklistTemplateFormModal
          template={formTemplate}
          onClose={() => setFormTemplate(undefined)}
          onSaved={reload}
        />
      )}

      <ConfirmDialog
        open={!!deletingTemplate}
        title="Eliminar lista de tareas"
        message={
          deletingTemplate
            ? `¿Deseas eliminar la lista "${deletingTemplate.name}"? Los mantenimientos que ya la aplicaron conservan sus tareas: no se verán afectados.`
            : ''
        }
        confirmLabel="Eliminar lista"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDelete}
        onClose={() => { setDeletingTemplate(null); setDeleteError(''); }}
      >
        {deleteError && (
          <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>
        )}
      </ConfirmDialog>
    </div>
  );
}
