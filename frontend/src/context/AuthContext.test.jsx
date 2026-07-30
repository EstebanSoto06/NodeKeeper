import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { UNAUTHORIZED_EVENT, getToken, setToken } from '../services/apiClient.js';
import { fixtureAdminUser } from '../test/fixtures.js';

vi.mock('../services/authService.js', () => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser, login as loginRequest } from '../services/authService.js';

// Componente sonda: expone el estado de AuthContext como texto/atributos
// legibles por Testing Library, y botones para disparar cada accion.
function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="isLoading">{String(auth.isLoading)}</span>
      <span data-testid="isAuthenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="userName">{auth.user?.name ?? ''}</span>
      <button type="button" onClick={() => auth.login('admin@example.test', 'x')}>login</button>
      <button type="button" onClick={() => auth.logout()}>logout</button>
      <button type="button" onClick={() => auth.refreshSession()}>refresh</button>
    </div>
  );
}

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('arranca sin token: no autenticado, sin llamar a getCurrentUser', async () => {
    renderAuthProvider();

    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));

    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('con token guardado, recupera la sesion via GET /auth/me', async () => {
    setToken('fixture-token');
    getCurrentUser.mockResolvedValueOnce(fixtureAdminUser);

    renderAuthProvider();

    await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true'));
    expect(screen.getByTestId('userName')).toHaveTextContent(fixtureAdminUser.name);
  });

  it('con token invalido, limpia la sesion y el token persistido', async () => {
    setToken('token-invalido');
    getCurrentUser.mockRejectedValueOnce(new Error('Unauthorized'));

    renderAuthProvider();

    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(getToken()).toBeNull();
  });

  it('login: guarda el token y expone al usuario', async () => {
    const user = userEvent.setup();
    loginRequest.mockResolvedValueOnce({ user: fixtureAdminUser, token: 'nuevo-token' });

    renderAuthProvider();
    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));

    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true'));
    expect(getToken()).toBe('nuevo-token');
  });

  it('logout: limpia el token y el usuario', async () => {
    const user = userEvent.setup();
    setToken('fixture-token');
    getCurrentUser.mockResolvedValueOnce(fixtureAdminUser);

    renderAuthProvider();
    await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true'));

    await user.click(screen.getByText('logout'));

    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(getToken()).toBeNull();
  });

  it('refreshSession: puede volver a validar la sesion bajo demanda', async () => {
    const user = userEvent.setup();
    renderAuthProvider();
    await waitFor(() => expect(screen.getByTestId('isLoading')).toHaveTextContent('false'));
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');

    setToken('token-tardio');
    getCurrentUser.mockResolvedValueOnce(fixtureAdminUser);

    await user.click(screen.getByText('refresh'));

    await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true'));
  });

  it('evento global de 401 fuerza el logout aunque no se llame logout() explicitamente', async () => {
    setToken('fixture-token');
    getCurrentUser.mockResolvedValueOnce(fixtureAdminUser);

    renderAuthProvider();
    await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true'));

    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

    await waitFor(() => expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false'));
  });
});
