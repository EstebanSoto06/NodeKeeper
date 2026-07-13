/* Login institucional con campos de cuenta + contraseña, estado de error y
   acceso demo por rol. El rol se deriva de la cuenta. Visual, sin backend. */
import { useState } from 'react';
import { Logo, Mark, Icon } from '../components/Icon.jsx';
import { Field, TextInput } from '../components/Inputs.jsx';
import { Button } from '../components/Button.jsx';

// Credenciales demo (ficticias).
const CREDENTIALS = {
  'a.vargas@coopelesca.cr':   { pw: 'demo1234', role: 'admin' },
  'm.solis@coopelesca.cr':    { pw: 'demo1234', role: 'admin' },
  'j.alvarado@coopelesca.cr': { pw: 'demo1234', role: 'operator' },
  'k.mendez@coopelesca.cr':   { pw: 'demo1234', role: 'operator' },
};

export function Login({ onLogin }) {
  const [email, setEmail] = useState('a.vargas@coopelesca.cr');
  const [pw, setPw] = useState('demo1234');
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const acc = CREDENTIALS[email.trim().toLowerCase()];
    if (acc && acc.pw === pw) { setError(false); onLogin(acc.role); }
    else setError(true);
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
                <TextInput value={email} onChange={(v) => { setEmail(v); setError(false); }} placeholder="nombre@coopelesca.cr" error={error} />
              </Field>
              <Field label="Contraseña" error={error ? ' ' : undefined}>
                <TextInput value={pw} onChange={(v) => { setPw(v); setError(false); }} type="password" error={error} />
              </Field>

              {error && (
                <div className="nk-callout" role="alert" style={{ marginTop: 2 }}>
                  <Icon name="alert-circle" size={16} style={{ color: 'var(--red-600)' }} />
                  <span>Credenciales incorrectas. Verifica tu correo y contraseña.</span>
                </div>
              )}

              <div className="nk-login-row">
                <label className="nk-check-inline"><input type="checkbox" defaultChecked /> Recordarme</label>
                <a className="nk-link" href="#" onClick={(e) => e.preventDefault()}>¿Olvidaste tu contraseña?</a>
              </div>
              <Button variant="primary" size="lg" type="submit" iconRight="arrow-right" style={{ width: '100%', marginTop: 4 }}>Entrar</Button>
            </div>
          </form>
          <div className="nk-login-demo">
            <span>Entrar como demo:</span>
            <button className="nk-btn nk-btn-secondary nk-btn-sm" type="button" onClick={() => onLogin('admin')}><Icon name="shield" size={14} />Administrador</button>
            <button className="nk-btn nk-btn-secondary nk-btn-sm" type="button" onClick={() => onLogin('operator')}><Icon name="hard-hat" size={14} />Operador</button>
          </div>
        </div>
      </div>
    </div>
  );
}
