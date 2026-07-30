/* Utilidades compartidas de testing. renderWithProviders envuelve el
   componente bajo prueba en MemoryRouter (rutas iniciales configurables) y
   en AuthContext.Provider con un valor de sesion totalmente controlado por
   la prueba (sin red, sin localStorage, sin mockear modulos) -- ver la
   exportacion adicional de AuthContext en ../context/AuthContext.jsx. */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { fixtureAdminUser, fixtureOperatorUser } from './fixtures.js';

/** Construye un valor de AuthContext controlado, con overrides puntuales.
    Los callbacks son vi.fn() por defecto para poder aserir sobre ellos. */
export function buildAuthValue(overrides = {}) {
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    ...overrides,
  };
}

export const adminAuthValue = () =>
  buildAuthValue({ user: fixtureAdminUser, token: 'fixture-token-admin', isAuthenticated: true });

export const operatorAuthValue = () =>
  buildAuthValue({ user: fixtureOperatorUser, token: 'fixture-token-operator', isAuthenticated: true });

export const loggedOutAuthValue = () => buildAuthValue({ isLoading: false });

export const loadingAuthValue = () => buildAuthValue({ isLoading: true });

/**
 * Renderiza `ui` dentro de MemoryRouter + AuthContext controlado.
 *
 * @param {React.ReactElement} ui
 * @param {object} options
 * @param {string[]} [options.initialEntries] rutas iniciales del router (default ['/'])
 * @param {object} [options.authValue] valor de AuthContext (default: sesion ADMIN)
 * @returns resultado de @testing-library/react `render`, mas `authValue` usado
 */
export function renderWithProviders(ui, { initialEntries = ['/'], authValue } = {}) {
  const resolvedAuthValue = authValue ?? adminAuthValue();

  const utils = render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={resolvedAuthValue}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );

  return { ...utils, authValue: resolvedAuthValue };
}

/** Crea un ApiError con la misma forma que produce services/apiClient.js,
    para pruebas que simulan respuestas de error de servicios mockeados. */
export function makeApiError(message, { status = 400, errors = [] } = {}) {
  const error = new Error(message);
  error.name = 'ApiError';
  error.status = status;
  error.errors = errors;
  return error;
}
