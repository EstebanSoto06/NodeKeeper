import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Topbar } from './Topbar.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureEquipmentA } from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

function renderTopbar(authValue) {
  networkNodeService.list.mockResolvedValue({ networkNodes: [fixtureNodeAvailable] });
  equipmentService.list.mockResolvedValue({ equipment: [fixtureEquipmentA] });

  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<Topbar onMenu={vi.fn()} />} />
      <Route path="/mantenimientos" element={<div>Listado de mantenimientos</div>} />
    </Routes>,
    { authValue, initialEntries: ['/dashboard'] },
  );
}

// <input type="date"> no soporta bien la escritura caracter-por-caracter de
// userEvent.type en jsdom; se fija su valor directamente, como haria el
// selector nativo del navegador. Se busca en document y no en el container
// del render porque el Topbar monta el modal en document.body con un portal.
function setScheduledDate(value) {
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value } });
}

describe('Topbar · botón global "Nuevo"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN ve el botón y abre el formulario real de mantenimiento', async () => {
    const user = userEvent.setup();
    renderTopbar(adminAuthValue());

    await user.click(screen.getByText('Nuevo'));

    expect(await screen.findByText('Nuevo mantenimiento')).toBeInTheDocument();
    // Es el mismo formulario que usan Mantenimientos y Calendario.
    expect(await screen.findByPlaceholderText('Mantenimiento preventivo trimestral')).toBeInTheDocument();
  });

  it('OPERATOR no ve el botón: POST /maintenances es solo ADMIN', () => {
    renderTopbar(operatorAuthValue());

    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('al guardar, crea vía la API real y navega al listado de mantenimientos', async () => {
    const user = userEvent.setup();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'nuevo-1' } });
    renderTopbar(adminAuthValue());

    await user.click(screen.getByText('Nuevo'));
    await screen.findByPlaceholderText('Mantenimiento preventivo trimestral');

    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Orden desde el Topbar');
    setScheduledDate('2026-06-01');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);

    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(1));
    const [payload] = maintenanceService.create.mock.calls[0];
    expect(payload.title).toBe('Orden desde el Topbar');
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
    expect(await screen.findByText('Listado de mantenimientos')).toBeInTheDocument();
  });

  it('cancelar cierra el formulario sin crear nada', async () => {
    const user = userEvent.setup();
    renderTopbar(adminAuthValue());

    await user.click(screen.getByText('Nuevo'));
    await screen.findByPlaceholderText('Mantenimiento preventivo trimestral');
    await user.click(screen.getByText('Cancelar'));

    await waitFor(() => expect(screen.queryByText('Nuevo mantenimiento')).not.toBeInTheDocument());
    expect(maintenanceService.create).not.toHaveBeenCalled();
  });
});
