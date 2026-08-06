import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaintenanceFormModal } from './MaintenanceFormModal.jsx';
import {
  fixtureNodeAvailable,
  fixtureNodeMaintenance,
  fixtureEquipmentA,
  fixtureEquipmentB,
  fixtureMaintenanceInProgress,
} from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

async function renderReady({
  maintenance,
  nodesList = [fixtureNodeAvailable],
  equipmentListData = [fixtureEquipmentA],
  onClose = vi.fn(),
  onSaved = vi.fn(),
} = {}) {
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: nodesList });
  equipmentService.list.mockResolvedValueOnce({ equipment: equipmentListData });
  const utils = render(<MaintenanceFormModal maintenance={maintenance} onClose={onClose} onSaved={onSaved} />);
  await waitFor(() => expect(screen.getByPlaceholderText('Mantenimiento preventivo trimestral')).toBeInTheDocument());
  return { ...utils, onClose, onSaved };
}

// <input type="date"> no soporta bien la escritura caracter-por-caracter de
// userEvent.type en jsdom; se fija su valor directamente, como haria el
// selector nativo del navegador.
function setScheduledDate(container, value) {
  fireEvent.change(container.querySelector('input[type="date"]'), { target: { value } });
}

describe('MaintenanceFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PREVENTIVE (tipo por defecto): muestra Nodo y no muestra Equipo', async () => {
    await renderReady();
    expect(screen.getByText('Nodo')).toBeInTheDocument();
    expect(screen.queryByText('Equipo')).not.toBeInTheDocument();
  });

  it('CORRECTIVE: muestra Nodo y Equipo como campos separados', async () => {
    const user = userEvent.setup();
    await renderReady();
    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');
    expect(screen.getByText('Nodo')).toBeInTheDocument();
    expect(screen.getByText('Equipo')).toBeInTheDocument();
  });

  it('CORRECTIVE: el select de Equipo se deshabilita sin nodo y se filtra por el nodo seleccionado', async () => {
    const user = userEvent.setup();
    await renderReady({ nodesList: [fixtureNodeAvailable, fixtureNodeMaintenance], equipmentListData: [fixtureEquipmentA, fixtureEquipmentB] });
    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');

    // Sin nodo: Equipo deshabilitado, con placeholder especifico.
    expect(screen.getByDisplayValue('Primero selecciona un nodo…')).toBeDisabled();

    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
    expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument();
    expect(screen.queryByText(fixtureEquipmentB.name)).not.toBeInTheDocument();
  });

  it('CORRECTIVE: cambiar el nodo limpia el equipo seleccionado y recalcula la lista', async () => {
    const user = userEvent.setup();
    await renderReady({ nodesList: [fixtureNodeAvailable, fixtureNodeMaintenance], equipmentListData: [fixtureEquipmentA, fixtureEquipmentB] });
    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
    await user.selectOptions(screen.getByDisplayValue('Selecciona un equipo…'), fixtureEquipmentA.id);
    expect(screen.getByDisplayValue(fixtureEquipmentA.name)).toBeInTheDocument();

    await user.selectOptions(
      screen.getByDisplayValue(`${fixtureNodeAvailable.name} (${fixtureNodeAvailable.code})`),
      fixtureNodeMaintenance.id,
    );

    expect(screen.getByDisplayValue('Selecciona un equipo…')).toBeInTheDocument();
    expect(screen.getByText(fixtureEquipmentB.name)).toBeInTheDocument();
    expect(screen.queryByText(fixtureEquipmentA.name)).not.toBeInTheDocument();
  });

  it('CORRECTIVE sin nodo ni equipo: muestra el callout general y no llama a create', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Correctivo incompleto');
    setScheduledDate(container, '2026-06-01');

    await user.click(screen.getByText('Guardar mantenimiento'));

    expect(screen.getByText('Faltan datos obligatorios: Nodo, Equipo.')).toBeInTheDocument();
    expect(maintenanceService.create).not.toHaveBeenCalled();
  });

  it('CORRECTIVE con nodo pero sin equipo: muestra error solo de Equipo', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Correctivo sin equipo');
    setScheduledDate(container, '2026-06-01');

    await user.click(screen.getByText('Guardar mantenimiento'));

    expect(screen.getByText('Faltan datos obligatorios: Equipo.')).toBeInTheDocument();
    expect(maintenanceService.create).not.toHaveBeenCalled();
  });

  it('PREVENTIVE sin nodo: muestra error de Nodo y no llama a create', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Preventivo sin nodo');
    setScheduledDate(container, '2026-06-01');

    await user.click(screen.getByText('Guardar mantenimiento'));

    expect(screen.getByText('Faltan datos obligatorios: Nodo.')).toBeInTheDocument();
    expect(maintenanceService.create).not.toHaveBeenCalled();
  });

  it('sin fecha programada: muestra error de Fecha programada y no llama a create', async () => {
    const user = userEvent.setup();
    await renderReady();
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Preventivo sin fecha');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);

    await user.click(screen.getByText('Guardar mantenimiento'));

    expect(screen.getByText('Faltan datos obligatorios: Fecha programada.')).toBeInTheDocument();
    expect(maintenanceService.create).not.toHaveBeenCalled();
  });

  it('CORRECTIVE valido: llama a create con equipmentId y networkNodeId null', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'm2' } });

    await user.selectOptions(screen.getByDisplayValue('Preventivo'), 'CORRECTIVE');
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Correctivo de prueba');
    setScheduledDate(container, '2026-06-01');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
    await user.selectOptions(screen.getByDisplayValue('Selecciona un equipo…'), fixtureEquipmentA.id);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(1));
    const [payload] = maintenanceService.create.mock.calls[0];
    expect(payload.type).toBe('CORRECTIVE');
    expect(payload.equipmentId).toBe(fixtureEquipmentA.id);
    expect(payload.networkNodeId).toBeNull();
    expect(payload.scheduledDate).toBe('2026-06-01');
  });

  it('PREVENTIVE valido: llama a create con networkNodeId y equipmentId null', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'm1' } });

    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Preventivo de prueba');
    setScheduledDate(container, '2026-06-01');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(1));
    const [payload] = maintenanceService.create.mock.calls[0];
    expect(payload.type).toBe('PREVENTIVE');
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
    expect(payload.equipmentId).toBeNull();
  });

  it('edicion correctiva: precarga el nodo derivado desde maintenance.equipment.networkNodeId', async () => {
    await renderReady({
      maintenance: fixtureMaintenanceInProgress,
      nodesList: [fixtureNodeAvailable, fixtureNodeMaintenance],
      equipmentListData: [fixtureEquipmentA, fixtureEquipmentB],
    });

    expect(screen.getByDisplayValue(`${fixtureNodeMaintenance.name} (${fixtureNodeMaintenance.code})`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(fixtureEquipmentB.name)).toBeInTheDocument();
  });
});
