import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserFormModal } from './UserFormModal.jsx';
import { fixtureAdminUser } from '../test/fixtures.js';

vi.mock('../services/userService.js', () => ({ create: vi.fn(), update: vi.fn() }));

import * as userService from '../services/userService.js';

describe('UserFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crear sin datos: muestra el callout con los campos faltantes (incluida Contraseña) y no llama a create', async () => {
    const user = userEvent.setup();
    render(<UserFormModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Guardar usuario'));

    expect(screen.getByText('Faltan datos obligatorios: Nombre completo, Correo institucional, Contraseña.')).toBeInTheDocument();
    expect(userService.create).not.toHaveBeenCalled();
  });

  it('editar sin tocar nada: no exige Contraseña (opcional al editar) y llama a update', async () => {
    const user = userEvent.setup();
    userService.update.mockResolvedValueOnce({ user: fixtureAdminUser });
    render(<UserFormModal user={fixtureAdminUser} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText('Guardar usuario'));

    await waitFor(() => expect(userService.update).toHaveBeenCalledTimes(1));
  });
});
