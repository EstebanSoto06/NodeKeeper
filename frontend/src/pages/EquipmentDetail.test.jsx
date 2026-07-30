import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { EquipmentDetail } from './EquipmentDetail.jsx';
import { renderWithProviders, adminAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureEquipmentA } from '../test/fixtures.js';

vi.mock('../services/equipmentService.js', () => ({
  getById: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as equipmentService from '../services/equipmentService.js';

function renderDetail(entries = [`/equipos/${fixtureEquipmentA.id}`]) {
  return renderWithProviders(
    <Routes><Route path="/equipos/:id" element={<EquipmentDetail />} /></Routes>,
    { authValue: adminAuthValue(), initialEntries: entries },
  );
}

describe('EquipmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advierte que la eliminacion se rechazara si el equipo tiene historial de mantenimiento', async () => {
    const user = userEvent.setup();
    equipmentService.getById.mockResolvedValueOnce({ equipment: fixtureEquipmentA });

    renderDetail();

    await waitFor(() => expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument());
    await user.click(screen.getByText('Eliminar'));

    expect(screen.getByText(/se rechazará si el equipo tiene historial de mantenimiento/)).toBeInTheDocument();
  });

  it('ante un 409 del backend, muestra el mensaje real, no navega y conserva la vista', async () => {
    const user = userEvent.setup();
    equipmentService.getById.mockResolvedValueOnce({ equipment: fixtureEquipmentA });
    equipmentService.remove.mockRejectedValueOnce(
      makeApiError('No se puede eliminar el equipo porque posee historial de mantenimiento.', { status: 409 }),
    );

    renderDetail();

    await waitFor(() => expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument());
    await user.click(screen.getByText('Eliminar'));
    await user.click(screen.getByRole('button', { name: 'Eliminar equipo' }));

    await waitFor(() =>
      expect(
        screen.getByText('No se puede eliminar el equipo porque posee historial de mantenimiento.'),
      ).toBeInTheDocument(),
    );

    // La vista actual se conserva: el equipo sigue mostrandose, sin
    // navegacion optimista hacia el listado.
    expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument();
    expect(equipmentService.remove).toHaveBeenCalledTimes(1);
  });

  it('elimina correctamente cuando el backend acepta la operacion', async () => {
    const user = userEvent.setup();
    equipmentService.getById.mockResolvedValueOnce({ equipment: fixtureEquipmentA });
    equipmentService.remove.mockResolvedValueOnce(null);

    renderDetail();

    await waitFor(() => expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument());
    await user.click(screen.getByText('Eliminar'));
    await user.click(screen.getByRole('button', { name: 'Eliminar equipo' }));

    await waitFor(() => expect(equipmentService.remove).toHaveBeenCalledWith(fixtureEquipmentA.id));
  });
});
