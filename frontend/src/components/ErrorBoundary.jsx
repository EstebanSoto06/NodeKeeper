/* Limite de errores de React. No es una pantalla del Design System (no existe
   un patron visual definido para esto en el prototipo aprobado): usa unicamente
   variables de --tokens.css y la clase nk-btn ya existente, sin introducir
   nuevas clases globales ni alterar el estilo actual de ningun componente. */
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado en la interfaz', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)' }}>Ocurrio un error inesperado</h1>
          <p style={{ color: 'var(--fg-2)', maxWidth: 420 }}>
            Intenta recargar la pagina. Si el problema persiste, contacta al equipo de soporte.
          </p>
          <button type="button" className="nk-btn nk-btn-primary nk-btn-md" onClick={() => window.location.reload()}>
            <span>Recargar</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
