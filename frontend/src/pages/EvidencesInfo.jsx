/* Ruta /evidencias. El backend NO expone una galeria global de evidencias:
   las evidencias existen SIEMPRE dentro de un mantenimiento
   (/maintenances/:id/evidences). Para no fingir una galeria global mock como
   si fuera funcional, esta pantalla explica brevemente donde viven las
   evidencias y ofrece acceso directo a Mantenimientos. La galeria real se
   integrara mas adelante dentro de /mantenimientos/:id. */
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { Button } from '../components/Button.jsx';

export function EvidencesInfo() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="nk-pagehead">
        <div>
          <h1 className="nk-page-title">Evidencias</h1>
          <p className="nk-page-sub">Gestion de evidencias de mantenimiento</p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          textAlign: 'center',
          padding: '40px 24px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--blue-50)',
          }}
        >
          <Icon name="image" size={26} style={{ color: 'var(--blue-600)' }} />
        </span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
          Las evidencias se gestionan dentro de cada mantenimiento
        </h2>
        <p style={{ color: 'var(--fg-2)', maxWidth: 460, margin: 0 }}>
          Cada evidencia (foto, PDF o documento) pertenece a un mantenimiento en
          progreso. Abre un mantenimiento para ver, subir o descargar sus
          evidencias.
        </p>
        <Button variant="primary" icon="wrench" onClick={() => navigate('/mantenimientos')}>
          Ir a Mantenimientos
        </Button>
      </div>
    </div>
  );
}
