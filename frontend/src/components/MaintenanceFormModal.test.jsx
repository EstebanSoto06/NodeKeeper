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
  fixtureChecklistTemplates,
  fixtureTemplateUps,
} from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));
vi.mock('../services/checklistTemplateService.js', () => ({ list: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import * as checklistTemplateService from '../services/checklistTemplateService.js';

async function renderReady({
  maintenance,
  nodesList = [fixtureNodeAvailable],
  equipmentListData = [fixtureEquipmentA],
  templatesList = fixtureChecklistTemplates,
  onClose = vi.fn(),
  onSaved = vi.fn(),
} = {}) {
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: nodesList });
  equipmentService.list.mockResolvedValueOnce({ equipment: equipmentListData });
  checklistTemplateService.list.mockResolvedValue({ checklistTemplates: templatesList });
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

/* ---------- Serie recurrente: N ordenes independientes, no una entidad ---------- */

describe('MaintenanceFormModal · serie recurrente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Rellena los campos obligatorios de un preventivo valido. */
  async function fillPreventive(user, container, title = 'Revisión periódica') {
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), title);
    setScheduledDate(container, '2026-01-31');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
  }

  async function enableSeries(user) {
    await user.click(screen.getByLabelText(/Programar como serie recurrente/));
  }

  it('la opcion no aparece al editar: editar afecta a UNA orden', async () => {
    await renderReady({
      maintenance: fixtureMaintenanceInProgress,
      nodesList: [fixtureNodeAvailable, fixtureNodeMaintenance],
      equipmentListData: [fixtureEquipmentA, fixtureEquipmentB],
    });

    expect(screen.queryByText(/Programar como serie recurrente/)).not.toBeInTheDocument();
  });

  it('al activarla, advierte que las ordenes son independientes y lista las fechas', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    await fillPreventive(user, container);
    await enableSeries(user);

    expect(screen.getByText('independientes')).toBeInTheDocument();
    expect(screen.getByText(/no guarda la recurrencia/, { selector: 'span' })).toBeInTheDocument();
    // Semanal por defecto, 3 ordenes: se muestran las 3 fechas calculadas.
    expect(screen.getByText('1. 2026-01-31')).toBeInTheDocument();
    expect(screen.getByText('2. 2026-02-07')).toBeInTheDocument();
    expect(screen.getByText('3. 2026-02-14')).toBeInTheDocument();
  });

  it('crea una orden real por cada fecha, numerada y con el resto de datos igual', async () => {
    const user = userEvent.setup();
    maintenanceService.create.mockResolvedValue({ maintenance: { id: 'serie' } });
    const { container, onSaved, onClose } = await renderReady();

    await fillPreventive(user, container);
    await enableSeries(user);
    await user.selectOptions(screen.getByDisplayValue('Cada semana'), 'MONTHLY');

    await user.click(screen.getByText('Crear 3 órdenes'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(3));
    const payloads = maintenanceService.create.mock.calls.map(([p]) => p);

    expect(payloads.map((p) => p.title)).toEqual([
      'Revisión periódica (1/3)',
      'Revisión periódica (2/3)',
      'Revisión periódica (3/3)',
    ]);
    // 31 de enero + 1 mes cae en el ultimo dia real de febrero, y vuelve al 31.
    expect(payloads.map((p) => p.scheduledDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    payloads.forEach((p) => {
      expect(p.type).toBe('PREVENTIVE');
      expect(p.networkNodeId).toBe(fixtureNodeAvailable.id);
      expect(p.equipmentId).toBeNull();
    });

    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sin activarla, sigue creando una sola orden con el titulo tal cual', async () => {
    const user = userEvent.setup();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'unica' } });
    const { container } = await renderReady();

    await fillPreventive(user, container, 'Orden única');
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(1));
    expect(maintenanceService.create.mock.calls[0][0].title).toBe('Orden única');
  });

  it('si una orden falla a mitad, informa cuantas se crearon y no cierra el modal', async () => {
    const user = userEvent.setup();
    maintenanceService.create
      .mockResolvedValueOnce({ maintenance: { id: 'serie-1' } })
      .mockRejectedValueOnce(Object.assign(new Error('El servidor rechazó la solicitud.'), { status: 500 }));
    const { container, onSaved, onClose } = await renderReady();

    await fillPreventive(user, container);
    await enableSeries(user);
    await user.click(screen.getByText('Crear 3 órdenes'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Se crearon 1 de 3 órdenes y se conservan. La orden 2 falló: El servidor rechazó la solicitud.',
    );
    expect(maintenanceService.create).toHaveBeenCalledTimes(2);
    // La orden ya creada es real: se refresca la vista, pero el modal sigue abierto.
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('la validacion de campos obligatorios se aplica igual en modo serie', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Sin fecha ni nodo');
    await enableSeries(user);
    await user.click(screen.getByText(/Crear 3 órdenes/));

    expect(screen.getByText('Faltan datos obligatorios: Fecha programada, Nodo.')).toBeInTheDocument();
    expect(maintenanceService.create).not.toHaveBeenCalled();
  });
});

/* Selector "Lista de tareas". El valor por defecto ("Sin lista de tareas")
   debe reproducir EXACTAMENTE el comportamiento anterior a esta
   funcionalidad: sin checklistTemplateId en el payload. */
describe('MaintenanceFormModal · lista de tareas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillRequired(user, container) {
    await user.type(screen.getByPlaceholderText('Mantenimiento preventivo trimestral'), 'Orden con lista');
    setScheduledDate(container, '2026-09-01');
    await user.selectOptions(screen.getByDisplayValue('Selecciona un nodo…'), fixtureNodeAvailable.id);
  }

  function templateSelect() {
    return screen.getByDisplayValue('Sin lista de tareas');
  }

  it('ofrece "Sin lista de tareas" como valor por defecto', async () => {
    await renderReady();

    expect(screen.getByText('Lista de tareas')).toBeInTheDocument();
    expect(templateSelect()).toBeInTheDocument();
  });

  it('lista las plantillas disponibles con su numero de tareas', async () => {
    await renderReady();

    expect(
      screen.getByRole('option', { name: 'Mantenimiento preventivo UPS (3 tareas)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Revisión trimestral de nodo (1 tarea)' }),
    ).toBeInTheDocument();
  });

  it('sin seleccionar lista, el payload NO incluye checklistTemplateId', async () => {
    const user = userEvent.setup();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'nuevo' } });

    const { container } = await renderReady();
    await fillRequired(user, container);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalled());
    const payload = maintenanceService.create.mock.calls[0][0];
    expect(payload).not.toHaveProperty('checklistTemplateId');
  });

  it('al seleccionar una lista, el payload incluye su id', async () => {
    const user = userEvent.setup();
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'nuevo' } });

    const { container } = await renderReady();
    await fillRequired(user, container);
    await user.selectOptions(templateSelect(), fixtureTemplateUps.id);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() =>
      expect(maintenanceService.create).toHaveBeenCalledWith(
        expect.objectContaining({ checklistTemplateId: fixtureTemplateUps.id }),
      ),
    );
  });

  it('anuncia cuantas tareas se copiaran al elegir una lista', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.selectOptions(templateSelect(), fixtureTemplateUps.id);

    expect(screen.getByText(/Se copiarán 3 tareas al checklist/)).toBeInTheDocument();
  });

  it('NO ofrece el selector al editar una orden existente', async () => {
    await renderReady({ maintenance: fixtureMaintenanceInProgress });

    expect(screen.queryByText('Lista de tareas')).not.toBeInTheDocument();
    expect(checklistTemplateService.list).not.toHaveBeenCalled();
  });

  it('si la carga de plantillas falla, el formulario sigue siendo utilizable', async () => {
    const user = userEvent.setup();
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
    equipmentService.list.mockResolvedValueOnce({ equipment: [fixtureEquipmentA] });
    checklistTemplateService.list.mockRejectedValue(new Error('403'));
    maintenanceService.create.mockResolvedValueOnce({ maintenance: { id: 'nuevo' } });

    const { container } = render(
      <MaintenanceFormModal onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Mantenimiento preventivo trimestral')).toBeInTheDocument(),
    );

    // El selector se degrada a la unica opcion segura.
    expect(screen.getByDisplayValue('Sin lista de tareas')).toBeInTheDocument();

    await fillRequired(user, container);
    await user.click(screen.getByText('Guardar mantenimiento'));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalled());
    expect(maintenanceService.create.mock.calls[0][0]).not.toHaveProperty('checklistTemplateId');
  });

  it('serie recurrente + lista: las N ordenes llevan el mismo checklistTemplateId', async () => {
    const user = userEvent.setup();
    maintenanceService.create.mockResolvedValue({ maintenance: { id: 'nuevo' } });

    const { container } = await renderReady();
    await fillRequired(user, container);
    await user.selectOptions(templateSelect(), fixtureTemplateUps.id);
    await user.click(screen.getByLabelText(/Programar como serie recurrente/i));
    await user.click(screen.getByText(/Crear 3 órdenes/));

    await waitFor(() => expect(maintenanceService.create).toHaveBeenCalledTimes(3));
    maintenanceService.create.mock.calls.forEach(([payload]) => {
      expect(payload.checklistTemplateId).toBe(fixtureTemplateUps.id);
    });
  });
});
