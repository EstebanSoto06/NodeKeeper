/* Login institucional con campos de cuenta + contraseña, estado de error y
   envío real a POST /api/auth/login vía AuthContext. Visualmente idéntico al
   prototipo aprobado; solo cambia el origen de la autenticación (antes:
   mapa de credenciales fijo en el código; ahora: backend real). */
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Logo, Mark, Icon } from '../components/Icon.jsx';
import { Field, TextInput } from '../components/Inputs.jsx';
import { Button } from '../components/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Cuentas de prueba conocidas del seed del backend (ver backend/prisma/seed.js).
// Solo se prellena el correo -- nunca una contraseña -- para no incluir
// credenciales en el código fuente.
const DEMO_ACCOUNTS = [
  { email: 'admin@nodekeeper.local', label: 'Administrador', icon: 'shield' },
  { email: 'operador@nodekeeper.local', label: 'Operador', icon: 'hard-hat' },
];

export function Login() {
  const { login, isAuthenticated, isLoading: isSessionLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isSessionLoading && isAuthenticated) {
    const redirectTo = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, pw);
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nk-login">
      <div className="nk-login-aside">
        <div className="nk-login-aside-top">
          <Logo height={30} variant="dark" />
        </div>
        <div className="nk-login-aside-mid">
          <h2>Mantenimiento de nodos, bajo control.</h2>
          <p>Consulta nodos, equipos y mantenimientos. Ejecuta checklists, adjunta evidencia y mantén cada localidad en verde.</p>
          <div className="nk-login-legend">
            <span><span className="nk-dot" style={{ background: 'var(--green-500)' }}></span>Sin pendientes</span>
            <span><span className="nk-dot" style={{ background: 'var(--amber-500)' }}></span>Tareas incompletas</span>
            <span><span className="nk-dot" style={{ background: 'var(--red-500)' }}></span>Pendientes</span>
          </div>
        </div>
        <div className="nk-login-aside-foot">© 2026 NodeKeeper · Coopelesca · Sistema de gestión de mantenimientos</div>
      </div>

      <div className="nk-login-main">
        <div className="nk-login-card">
          <div className="nk-login-mark"><Mark size={44} /></div>
          <h1>Iniciar sesión</h1>
          <p className="nk-login-sub">Ingresa con tu cuenta institucional.</p>
          <form onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
              <Field label="Correo institucional" error={error ? ' ' : undefined}>
                <TextInput value={email} onChange={(v) => { setEmail(v); setError(''); }} placeholder="nombre@coopelesca.cr" error={!!error} />
              </Field>
              <Field label="Contraseña" error={error ? ' ' : undefined}>
                <TextInput value={pw} onChange={(v) => { setPw(v); setError(''); }} type="password" error={!!error} />
              </Field>

              {error && (
                <div className="nk-callout" role="alert" style={{ marginTop: 2 }}>
                  <Icon name="alert-circle" size={16} style={{ color: 'var(--red-600)' }} />
                  <span>{error}</span>
                </div>
              )}

              <div className="nk-login-row">
                <label className="nk-check-inline"><input type="checkbox" defaultChecked /> Recordarme</label>
                <a className="nk-link" href="#" onClick={(e) => e.preventDefault()}>¿Olvidaste tu contraseña?</a>
              </div>
              <Button variant="primary" size="lg" type="submit" iconRight="arrow-right" disabled={submitting} style={{ width: '100%', marginTop: 4 }}>
                {submitting ? 'Ingresando…' : 'Entrar'}
              </Button>
            </div>
          </form>
          <div className="nk-login-demo">
            <span>Cuentas de prueba:</span>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                className="nk-btn nk-btn-secondary nk-btn-sm"
                type="button"
                onClick={() => { setEmail(acc.email); setPw(''); setError(''); }}
              >
                <Icon name={acc.icon} size={14} />{acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
