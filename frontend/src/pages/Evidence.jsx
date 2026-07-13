/* Evidencias: galería de archivos adjuntos (JPG, PNG, PDF, DOCX) con área de
   subida, autor y fecha, y acciones Ver / Descargar. Visual, sin backend. */
import { DATA } from '../data/mockData.js';
import { PageHeader } from '../components/Misc.jsx';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { Icon } from '../components/Icon.jsx';

const KINDS = {
  jpg: { tag: 'JPG', icon: 'image', bg: 'var(--blue-50)', fg: 'var(--blue-600)' },
  png: { tag: 'PNG', icon: 'image', bg: 'var(--blue-50)', fg: 'var(--blue-600)' },
  pdf: { tag: 'PDF', icon: 'file-text', bg: 'var(--red-50)', fg: 'var(--red-600)' },
  docx: { tag: 'DOCX', icon: 'file-text', bg: 'var(--blue-50)', fg: 'var(--blue-700)' },
};

// Galería ampliada (incluye más tipos para mostrar el soporte de formatos).
const FILES = [
  { name: 'gabinete-frontal.jpg', ext: 'jpg', size: '2.4 MB', date: '2026-06-04 09:32', by: 'A. Vargas', node: 'NODE-001' },
  { name: 'medicion-voltaje.png', ext: 'png', size: '1.8 MB', date: '2026-06-04 10:05', by: 'A. Vargas', node: 'NODE-001' },
  { name: 'reporte-ups.pdf', ext: 'pdf', size: '320 KB', date: '2026-06-04 10:21', by: 'A. Vargas', node: 'NODE-001' },
  { name: 'acta-cierre.docx', ext: 'docx', size: '88 KB', date: '2026-05-28 16:40', by: 'K. Méndez', node: 'NODE-027' },
  { name: 'filtros-limpieza.jpg', ext: 'jpg', size: '2.1 MB', date: '2026-06-04 09:48', by: 'J. Alvarado', node: 'NODE-001' },
  { name: 'falla-generador.jpg', ext: 'jpg', size: '3.0 MB', date: '2026-06-05 11:02', by: 'J. Alvarado', node: 'NODE-008' },
  { name: 'informe-tecnico.pdf', ext: 'pdf', size: '512 KB', date: '2026-05-22 14:15', by: 'A. Vargas', node: 'NODE-019' },
  { name: 'rack-posterior.png', ext: 'png', size: '1.5 MB', date: '2026-06-06 08:20', by: 'J. Alvarado', node: 'NODE-014' },
];

export function Evidence() {
  return (
    <div>
      <PageHeader eyebrow="Adjuntos" title="Evidencias"
        subtitle={`${FILES.length} archivos · JPG, PNG, PDF y DOCX`}
        actions={<Button variant="primary" icon="upload-cloud">Subir archivo</Button>} />

      <Card pad style={{ marginBottom: 16, borderStyle: 'dashed', borderColor: 'var(--border-2)', background: 'var(--bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', padding: '6px 0', color: 'var(--fg-2)' }}>
          <Icon name="upload-cloud" size={22} style={{ color: 'var(--blue-600)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Arrastra archivos aquí o haz clic para subir</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Formatos: JPG, PNG, PDF, DOCX · hasta 10 MB</div>
          </div>
        </div>
      </Card>

      <div className="nk-gallery">
        {FILES.map((f) => {
          const k = KINDS[f.ext];
          return (
            <Card key={f.name} pad={false} className="nk-gal-card">
              <div className="nk-gal-thumb" style={{ background: k.bg }}>
                <span className="nk-gal-kind">{k.tag}</span>
                <Icon name={k.icon} size={30} style={{ color: k.fg }} />
              </div>
              <div className="nk-gal-meta">
                <div className="nk-gal-name">{f.name}</div>
                <div className="nk-gal-sub nk-mono">{f.size} · {f.node}</div>
                <div className="nk-gal-sub">{f.by} · {f.date.split(' ')[0]}</div>
                <div className="nk-gal-foot">
                  <button className="nk-btn nk-btn-subtle nk-btn-sm"><Icon name="eye" size={14} />Ver</button>
                  <button className="nk-btn nk-btn-subtle nk-btn-sm"><Icon name="download" size={14} />Descargar</button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
