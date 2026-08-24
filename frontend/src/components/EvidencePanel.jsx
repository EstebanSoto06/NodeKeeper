/* Panel de evidencias embebido en MaintenanceDetail. Conectado a
   /maintenances/:maintenanceId/evidences (backend/src/modules/evidences).

   Reglas reales del backend:
   - Listar/descargar: ADMIN u OPERATOR, en cualquier estado.
   - Subir: ADMIN u OPERATOR, solo con el mantenimiento IN_PROGRESS.
   - Eliminar: solo ADMIN, solo con el mantenimiento IN_PROGRESS.
   Tipos aceptados por el backend (evidence-file.js#ALLOWED_EVIDENCE_TYPES):
   JPG, PNG, PDF, DOCX. El limite de tamano (env.maxFileSizeMb) no se expone
   a la API, por lo que aqui solo se muestra un mensaje generico; el error
   real de "excede el tamano" siempre lo valida y devuelve el backend. */
import { useRef, useState } from 'react';
import { Card } from './Card.jsx';
import { IconButton } from './Button.jsx';
import { Icon } from './Icon.jsx';
import { EmptyState } from './EmptyState.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { ErrorState } from './ErrorState.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import { useAsync } from '../hooks/useAsync.js';
import { formatSize, iconForMimeType, isImageMimeType, triggerBlobDownload } from '../utils/evidenceFormat.js';
import * as evidenceService from '../services/evidenceService.js';

const ACCEPT = '.jpg,.jpeg,.png,.pdf,.docx,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function EvidencePanel({ maintenanceId, status, isCompleted }) {
  const perms = usePermissions();
  const canUpload = perms.canUploadEvidenceFor(status);
  const canDelete = perms.canDeleteEvidenceFor(status);

  const { data, error, loading, reload } = useAsync(() => evidenceService.list(maintenanceId), [maintenanceId]);
  const evidences = data?.evidences ?? [];

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  const [deletingEvidence, setDeletingEvidence] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      await evidenceService.upload(maintenanceId, file);
      reload();
    } catch (err) {
      setUploadError(err.message || 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (evidence) => {
    if (downloadingId) return;
    setDownloadingId(evidence.id);
    setDownloadError('');
    try {
      const { blob, filename } = await evidenceService.download(maintenanceId, evidence.id);
      triggerBlobDownload(blob, filename || evidence.originalName);
    } catch (err) {
      setDownloadError(err.message || 'No se pudo descargar el archivo.');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await evidenceService.remove(maintenanceId, deletingEvidence.id);
      setDeletingEvidence(null);
      reload();
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar la evidencia.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card pad={false}>
      <div className="nk-card-head">
        <h3 className="nk-section-title">Evidencias</h3>
        <span className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{evidences.length}</span>
      </div>

      {uploadError && <div className="nk-callout" role="alert" style={{ margin: '0 18px 10px' }}><span>{uploadError}</span></div>}
      {downloadError && <div className="nk-callout" role="alert" style={{ margin: '0 18px 10px' }}><span>{downloadError}</span></div>}

      {loading ? (
        <div style={{ padding: 18 }}><LoadingSkeleton lines={3} /></div>
      ) : error ? (
        <div style={{ padding: 18 }}><ErrorState error={error} onRetry={reload} /></div>
      ) : (
        <div className="nk-evid-grid">
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                onChange={handleFileChange}
                disabled={uploading}
                style={{ display: 'none' }}
                id="evidence-file-input"
              />
              <label htmlFor="evidence-file-input" className="nk-evid-drop" style={{ cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                <Icon name="upload-cloud" size={20} />
                <span>{uploading ? 'Subiendo…' : 'Subir archivo'}</span>
                <small>JPG, PNG, PDF o DOCX</small>
              </label>
            </>
          )}
          {evidences.map((v) => (
            <div key={v.id} className="nk-evid">
              <div className="nk-evid-thumb" style={{ background: isImageMimeType(v.mimeType) ? 'var(--blue-50)' : 'var(--gray-100)' }}>
                <Icon name={iconForMimeType(v.mimeType)} size={22} style={{ color: isImageMimeType(v.mimeType) ? 'var(--blue-600)' : 'var(--gray-500)' }} />
              </div>
              <div className="nk-evid-meta">
                <span className="nk-evid-name">{v.originalName}</span>
                <span className="nk-evid-sub nk-mono">{formatSize(v.sizeBytes)} · {v.uploadedBy?.name || '—'} · {String(v.createdAt).slice(0, 10)}</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <IconButton
                  name="download"
                  title={downloadingId === v.id ? 'Descargando…' : 'Descargar'}
                  onClick={() => handleDownload(v)}
                  style={{ width: 28, height: 28, opacity: downloadingId === v.id ? 0.5 : 1 }}
                />
                {canDelete && (
                  <IconButton name="trash-2" title="Eliminar" onClick={() => setDeletingEvidence(v)} style={{ width: 28, height: 28 }} />
                )}
              </div>
            </div>
          ))}
          {evidences.length === 0 && !canUpload && (
            <EmptyState icon="image" title="Sin evidencias" subtitle={isCompleted ? 'Este mantenimiento no tiene evidencias adjuntas.' : 'Las evidencias solo pueden subirse mientras el mantenimiento está en progreso.'} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingEvidence}
        title="Eliminar evidencia"
        message={deletingEvidence ? `¿Deseas eliminar "${deletingEvidence.originalName}"?` : ''}
        confirmLabel="Eliminar evidencia"
        danger
        busy={deleting}
        icon="trash-2"
        onConfirm={confirmDelete}
        onClose={() => { setDeletingEvidence(null); setDeleteError(''); }}
      >
        {deleteError && <div className="nk-callout" role="alert" style={{ marginTop: 10 }}><span>{deleteError}</span></div>}
      </ConfirmDialog>
    </Card>
  );
}
