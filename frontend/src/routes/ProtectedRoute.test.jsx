import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { buildAuthValue, adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';

function LoginProbe() {
  const location = useLocation();
  return <span data-testid="from">{location.state?.from?.pathname ?? ''}</span>;
}

function renderProtected({ authValue, roles, initialEntries = ['/protegida'] }) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute roles={roles} />}>
            <Route path="/protegida" element={<div>Contenido protegido</div>} />
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('un invitado (sin sesion) es redirigido a /login', () => {
    renderProtected({ authValue: buildAuthValue({ isLoading: false }) });

    expect(screen.getByTestId('from')).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('conserva la ruta original en state.from para volver tras el login', () => {
    renderProtected({ authValue: buildAuthValue({ isLoading: false }), initialEntries: ['/protegida'] });

    expect(screen.getByTestId('from')).toHaveTextContent('/protegida');
  });

  it('un usuario autenticado sin restriccion de rol entra normalmente', () => {
    renderProtected({ authValue: operatorAuthValue() });

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('OPERATOR no entra a una ruta ADMIN-only: ve AccessDenied', () => {
    renderProtected({ authValue: operatorAuthValue(), roles: ['ADMIN'] });

    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
  });

  it('ADMIN si entra a una ruta ADMIN-only', () => {
    renderProtected({ authValue: adminAuthValue(), roles: ['ADMIN'] });

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
  });

  it('mientras isLoading es true, no redirige ni muestra el contenido protegido', () => {
    renderProtected({ authValue: buildAuthValue({ isLoading: true }) });

    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.queryByTestId('from')).not.toBeInTheDocument();
  });
});
