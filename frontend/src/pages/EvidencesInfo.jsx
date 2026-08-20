/* Ruta /evidencias: listado consolidado de las evidencias reales del sistema.

   El backend NO expone un endpoint de galeria global: las evidencias viven
   siempre dentro de un mantenimiento (/maintenances/:id/evidences). Pero
   GET /maintenances ya incluye la metadata publica de cada evidencia
   (backend/src/modules/maintenance/maintenance.service.js#evidencesInclude:
   id, maintenanceId, originalName, mimeType, sizeBytes, createdAt,
   uploadedBy). Esta pantalla REUTILIZA esa respuesta real y la aplana en una
   sola tabla; no inventa registros ni consulta un endpoint inexistente.

   La descarga sí usa el endpoint real por evidencia
   (GET /maintenances/:maintenanceId/evidences/:evidenceId/file, via
   evidenceService.download), que devuelve el archivo como blob autenticado.
   Nunca se exponen rutas fisicas del servidor (storedName/relativePath no
   viajan al cliente).

   Limitacion consciente: subir y eliminar evidencias sigue haciendose dentro
   del mantenimiento correspondiente (el backend solo lo permite con la orden
   IN_PROGRESS), por lo que aqui no se ofrecen esas acciones. */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Misc.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';
import { IconButton } from '../components/Button.jsx';
import { SearchInput, FilterChips, Select } from '../components/Inputs.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { LoadingSkeleton } from '../components/LoadingSkeleton.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { formatSize, iconForMimeType, isImageMimeType, fileKindLabel } from '../utils/evidenceFormat.js';
import * as maintenanceService from '../services/maintenanceService.js';
import * as evidenceService from '../services/evidenceService.js';

const KIND_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'image', label: 'Imágenes', dot: 'var(--blue-500)' },
  { value: 'document', label: 'Documentos', dot: 'var(--gray-400)' },
];

// Dispara la descarga de un blob ya obtenido, sin exponer una URL publica
// permanente: se crea un object URL, se usa una unica vez y se libera.
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'evidencia';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Aplana maintenances[].evidences[] en una sola lista, adjuntando a cada
   evidencia los datos de SU mantenimiento (titulo y estado), que ya vienen en
   la misma respuesta. Se ordena por fecha de carga descendente: lo ultimo
   subido es lo que interesa ver primero. */
function flattenEvidences(maintenances) {
  const rows = [];

  maintenances.forEach((m) => {
    (m.evidences || []).forEach((e) => {
      rows.push({
        ...e,
        maintenanceId: e.maintenanceId || m.id,
        maintenanceTitle: m.title,
        maintenanceStatus: m.status,
      });
    });
  });

  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function EvidencesInfo() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(() => maintenanceService.list(), []);
  const maintenances = data?.maintenances ?? [];

  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [maintenanceId, setMaintenanceId] = useState('all');
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  const allEvidences = useMemo(() => flattenEvidences(maintenances), [maintenances]);

  const rows = useMemo(() => allEvidences.filter((e) => {
    const isImage = isImageMimeType(e.mimeType);
    if (kind === 'image' && !isImage) return false;
    if (kind === 'document' && isImage) return false;
    if (maintenanceId !== 'all' && e.maintenanceId !== maintenanceId) return false;
    if (q === '') return true;
    return `${e.originalName} ${e.maintenanceTitle} ${e.uploadedBy?.name || ''}`
      .toLowerCase()
      .includes(q.toLowerCase());
  }), [allEvidences, kind, maintenanceId, q]);

  // Solo los mantenimientos que realmente tienen evidencias: filtrar por uno
  // sin archivos no aporta nada.
  const maintenancesWithEvidences = useMemo(
    () => maintenances.filter((m) => (m.evidences || []).length > 0),
    [maintenances],
  );

  const handleDownload = async (evidence) => {
    if (downloadingId) return;
    setDownloadingId(evidence.id);
    setDownloadError('');
    try {
      const { blob, filename } = await evidenceService.download(evidence.maintenanceId, evidence.id);
      triggerBlobDownload(blob, filename || evidence.originalName);
    } catch (err) {
      setDownloadError(err.message || 'No se pudo descargar el archivo.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Documentación"
        title="Evidencias"
        subtitle={`${allEvidences.length} ${allEvidences.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'} en ${maintenancesWithEvidences.length} ${maintenancesWithEvidences.length === 1 ? 'orden' : 'órdenes'} de mantenimiento`}
      />

      <div className="nk-callout" style={{ marginTop: 0, marginBottom: 14 }}>
        <Icon name="alert-circle" size={16} />
        <span>
          Las evidencias pertenecen siempre a una orden de mantenimiento. Aquí se consultan y
          descargan todas juntas; para <b>subir o eliminar</b> archivos abre la orden
          correspondiente (el sistema solo lo permite mientras está en progreso).
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por archivo, orden o responsable…" style={{ flex: 1, minWidth: 220 }} />
        <FilterChips value={kind} onChange={setKind} options={KIND_FILTERS} />
        <Select
          value={maintenanceId}
          onChange={setMaintenanceId}
          options={[
            { value: 'all', label: 'Todas las órdenes' },
            ...maintenancesWithEvidences.map((m) => ({ value: m.id, label: m.title })),
          ]}
        />
      </div>

      {downloadError && <div className="nk-callout" role="alert" style={{ marginTop: 0, marginBottom: 14 }}><span>{downloadError}</span></div>}

      <Card pad={false}>
        {loading && <div style={{ padding: 20 }}><LoadingSkeleton lines={4} /></div>}
        {!loading && error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && rows.length > 0 && (
          <table className="nk-table">
            <thead><tr>
              <th>Archivo</th><th>Formato</th><th>Tamaño</th><th>Orden de mantenimiento</th>
              <th>Estado</th><th>Subido por</th><th>Fecha</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => navigate(`/mantenimientos/${e.maintenanceId}`)}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <Icon
                        name={iconForMimeType(e.mimeType)}
                        size={16}
                        style={{ color: isImageMimeType(e.mimeType) ? 'var(--blue-600)' : 'var(--gray-500)' }}
                      />
                      {e.originalName}
                    </span>
                  </td>
                  <td style={{ color: 'var(--fg-2)' }}>{fileKindLabel(e.mimeType)}</td>
                  <td className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{formatSize(e.sizeBytes)}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.maintenanceTitle}</td>
                  <td><StatusBadge kind="maintenance" value={e.maintenanceStatus} /></td>
                  <td style={{ color: 'var(--fg-2)' }}>{e.uploadedBy?.name || '—'}</td>
                  <td className="nk-mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{String(e.createdAt).slice(0, 10)}</td>
                  <td style={{ textAlign: 'right' }} onClick={(ev) => ev.stopPropagation()}>
                    <IconButton
                      name="download"
                      title={downloadingId === e.id ? 'Descargando…' : `Descargar ${e.originalName}`}
                      onClick={() => handleDownload(e)}
                      style={{ width: 30, height: 30, opacity: downloadingId === e.id ? 0.5 : 1 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !error && rows.length === 0 && (
          <EmptyState
            icon="image"
            title={allEvidences.length === 0 ? 'Sin evidencias registradas' : 'Sin resultados'}
            subtitle={allEvidences.length === 0
              ? 'Todavía no se ha adjuntado ningún archivo a una orden de mantenimiento.'
              : 'Ajusta la búsqueda o los filtros.'}
          />
        )}
      </Card>
    </div>
  );
}
