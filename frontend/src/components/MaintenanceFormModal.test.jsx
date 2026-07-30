import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaintenanceFormModal } from './MaintenanceFormModal.jsx';
import { fixtureNodeAvailable, fixtureEquipmentA } from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

async function renderReady() {
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
  equipmentService.list.mockResolvedValueOnce({ equipment: [fixtureEquipmentA] });
  render(<MaintenanceFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => expect(screen.getByPlaceholderText('Mantenimiento preventivo trimestral')).toBeInTheDocument());
}

describe('MaintenanceFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PREVENTIVE (tipo por defecto): muestra el select de Nodo y lo envia, con equipmentId null', async () => {
    const user = userEvent.setup();
    await renderReady();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'm1' } });

    expect(screen.getByText('Nodo')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Preventivo de prueba');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(1));
    const [payload] = maintenanceService.create.mock.calls[0];
    expect(payload.type).toBe('PREVENTIVE');
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
    expect(payload.equipmentId).toBeNull();
  });

  it('CORRECTIVE: al cambiar el tipo, muestra el select de Equipo y lo envia, con networkNodeId null', async () => {
    const user = userEvent.setup();
    await renderReady();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'm2' } });

    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');
    expect(screen.getByText('Equipo')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Correctivo de prueba');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un equipo…'), fixtureEquipmentA.id);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(1));
    const [payload] = maintenanceService.create.mock.calls[0];
    expect(payload.type).toBe('CORRECTIVE');
    expect(payload.equipmentId).toBe(fixtureEquipmentA.id);
    expect(payload.networkNodeId).toBeNull();
  });
});
