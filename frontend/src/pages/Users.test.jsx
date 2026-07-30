import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Users } from './Users.jsx';
import { renderWithProviders, adminAuthValue } from '../test/test-utils.jsx';
import { fixtureAdminUser, fixtureOperatorUser, fixtureInactiveUser } from '../test/fixtures.js';

vi.mock('../services/userService.js', () => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setActive: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as userService from '../services/userService.js';

// El propio usuario en sesion (para probar "Tu" y la auto-desactivacion
// bloqueada) coincide a proposito con fixtureAdminUser: usePermissions/
// AuthContext usan el mismo id que aparece en el listado.
const selfAuthValue = () => adminAuthValue();

async function renderReady(users = [fixtureAdminUser, fixtureOperatorUser, fixtureInactiveUser]) {
  userService.list.mockResolvedValueOnce({ users });
  renderWithProviders(<Users />, { authValue: selfAuthValue() });
  await waitFor(() => expect(screen.getByText(fixtureAdminUser.name)).toBeInTheDocument());
}

describe('Users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra el listado real, con etiquetas de rol y estado', async () => {
    await renderReady();
    expect(screen.getByText(fixtureOperatorUser.name)).toBeInTheDocument();
    expect(screen.getByText(fixtureInactiveUser.name)).toBeInTheDocument();
    expect(screen.getAllByText('Administrador').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Operador').length).toBeGreaterThan(0);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('filtra por rol', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole('button', { name: 'Operador' }));

    expect(screen.queryByText(fixtureAdminUser.name)).not.toBeInTheDocument();
    expect(screen.getByText(fixtureOperatorUser.name)).toBeInTheDocument();
  });

  it('filtra por estado (activos/inactivos)', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole('button', { name: 'Inactivos' }));

    expect(screen.getByText(fixtureInactiveUser.name)).toBeInTheDocument();
    expect(screen.queryByText(fixtureAdminUser.name)).not.toBeInTheDocument();
  });

  it('crea un usuario nuevo', async () => {
    const user = userEvent.setup();
    await renderReady();
    userService.create.mockResolvedValueOnce({ user: { id: 'nuevo' } });

    await user.click(screen.getByText('Crear usuario'));
    await user.type(screen.getByPlaceholderText('Ana Vargas'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('ana.vargas@coopelesca.cr'), 'nuevo@example.test');
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123!');
    await user.click(screen.getByText('Guardar usuario'));

    await waitFor(() => expect(userService.create).toHaveBeenCalledTimes(1));
  });

  it('al editar, el formulario NO muestra ni prellena ningun campo de contraseña', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getAllByTitle('Editar')[0]);

    expect(screen.getByText('Editar usuario')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Mínimo 8 caracteres')).not.toBeInTheDocument();
  });

  it('activa/desactiva un usuario con confirmacion', async () => {
    const user = userEvent.setup();
    await renderReady();
    userService.setActive.mockResolvedValueOnce({ user: { ...fixtureOperatorUser, isActive: false } });

    const rows = screen.getAllByTitle('Desactivar');
    await user.click(rows[0]);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    await waitFor(() => expect(userService.setActive).toHaveBeenCalled());
  });

  it('la propia cuenta activa no puede desactivarse (bloqueo visual, sin abrir el dialogo)', async () => {
    const user = userEvent.setup();
    await renderReady();

    const selfBlockedButton = screen.getByTitle('No puedes desactivar tu propia cuenta');
    await user.click(selfBlockedButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(userService.setActive).not.toHaveBeenCalled();
  });

  it('restablece la contraseña de un usuario', async () => {
    const user = userEvent.setup();
    await renderReady();
    userService.resetPassword.mockResolvedValueOnce(null);

    await user.click(screen.getAllByTitle('Restablecer contraseña')[0]);
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'NuevaPassword123!');
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Restablecer contraseña' }));

    await waitFor(() => expect(userService.resetPassword).toHaveBeenCalled());
    // El servicio nunca recibe la contraseña anterior/hash, solo la nueva.
    expect(userService.resetPassword.mock.calls[0][1]).toBe('NuevaPassword123!');
  });
});
