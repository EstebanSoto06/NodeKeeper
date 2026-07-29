/* Placeholder de carga (skeleton). Es infraestructura, no una pantalla del
   Design System aprobado: para NO tocar los estilos globales existentes,
   inyecta su propio keyframe una sola vez en <head> y usa exclusivamente
   variables de --tokens.css para el color. Marca aria-busy en el contenedor y
   oculta las barras decorativas de lectores de pantalla.

   Uso:
     <LoadingSkeleton lines={3} />
     <LoadingSkeleton lines={1} height={180} />  // bloque grande */
import { useEffect } from 'react';

const STYLE_ID = 'nk-skeleton-style';
const KEYFRAME = `
@keyframes nk-skel-pulse {
  0% { opacity: 0.55; }
  50% { opacity: 1; }
  100% { opacity: 0.55; }
}`;

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = KEYFRAME;
  document.head.appendChild(style);
}

export function LoadingSkeleton({ lines = 3, height = 14, gap = 10, width = '100%' }) {
  useEffect(() => {
    ensureKeyframes();
  }, []);

  const rows = Array.from({ length: Math.max(1, lines) });

  return (
    <div aria-busy="true" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap }}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Cargando…
      </span>
      {rows.map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            height,
            // La ultima barra un poco mas corta, como en un parrafo real.
            width: i === rows.length - 1 && rows.length > 1 ? '70%' : width,
            borderRadius: 6,
            background: 'var(--gray-200)',
            animation: 'nk-skel-pulse 1.4s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}
