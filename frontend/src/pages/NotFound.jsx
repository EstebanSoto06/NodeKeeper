/* Pagina 404. Reutiliza unicamente tokens y el boton del Design System; no
   introduce clases nuevas ni altera ningun componente existente. */
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button.jsx';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--fg-1)' }}>404</h1>
      <p style={{ color: 'var(--fg-2)' }}>La pagina que buscas no existe.</p>
      <Button variant="primary" onClick={() => navigate('/dashboard')}>Volver al inicio</Button>
    </div>
  );
}
