import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Calendar } from './Calendar.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureMaintenanceScheduled, fixtureEquipmentB, fixtureNodeAvailable } from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ list: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';

// Fechas relativas al momento real de ejecucion, para no depender de que
// "hoy" caiga en un mes concreto: el calendario arranca siempre en el mes
// actual del sistema.
const now = new Date();
function isoInMonth(monthOffset, day = 10) {
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
  return d.toISOString();
}
function pad2(n) { return String(n).padStart(2, '0'); }
/** Fecha "YYYY-MM-DD" del mes visible (el actual) para un dia dado. */
function dateInCurrentMonth(day) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(day)}`;
}

const eventoEsteMes = { ...fixtureMaintenanceScheduled, id: 'm-este-mes', title: 'Evento de este mes', scheduledDate: isoInMonth(0) };
const eventoOtroMes = { ...fixtureMaintenanceScheduled, id: 'm-otro-mes', title: 'Evento de otro mes', scheduledDate: isoInMonth(1) };
const eventoSinFecha = { ...fixtureMaintenanceScheduled, id: 'm-sin-fecha', title: 'Evento sin fecha', scheduledDate: null };

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra solo los eventos del mes actual (mes dinamico)', async () => {
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [eventoEsteMes, eventoOtroMes] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [] });

    renderWithProviders(<Calendar />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText('Evento de este mes')).toBeInTheDocument());
    expect(screen.queryByText('Evento de otro mes')).not.toBeInTheDocument();
  });

  it('navegar al mes siguiente muestra los eventos programados ahi', async () => {
    const user = userEvent.setup();
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [eventoEsteMes, eventoOtroMes] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [] });

    const { container } = renderWithProviders(<Calendar />, { authValue: adminAuthValue() });
    await waitFor(() => expect(screen.getByText('Evento de este mes')).toBeInTheDocument());

    const nextButton = container.querySelector('.lucide-chevron-right').closest('button');
    await user.click(nextButton);

    expect(screen.queryByText('Evento de este mes')).not.toBeInTheDocument();
    expect(screen.getByText('Evento de otro mes')).toBeInTheDocument();
  });

  it('contabiliza los mantenimientos sin fecha en vez de mostrarlos en el grid', async () => {
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [eventoEsteMes, eventoSinFecha] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [] });

    renderWithProviders(<Calendar />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText('Evento de este mes')).toBeInTheDocument());
    expect(screen.queryByText('Evento sin fecha')).not.toBeInTheDocument();
    expect(screen.getByText(/no tiene(n)? fecha programada/)).toBeInTheDocument();
  });

  it('navega al detalle real al hacer click en un evento', async () => {
    const user = userEvent.setup();
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [eventoEsteMes] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [] });

    renderWithProviders(
      <Routes>
        <Route path="/calendario" element={<Calendar />} />
        <Route path="/mantenimientos/:id" element={<div>Detalle del evento</div>} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: ['/calendario'] },
    );

    await waitFor(() => expect(screen.getByText('Evento de este mes')).toBeInTheDocument());
    await user.click(screen.getByText('Evento de este mes'));

    expect(screen.getByText('Detalle del evento')).toBeInTheDocument();
  });

  it('coloca el evento en el dia que indica scheduledDate, sin desfase de zona horaria', async () => {
    // Un ISO en UTC del dia 1: interpretarlo en hora local lo correria al
    // ultimo dia del mes anterior en zonas negativas (Costa Rica es UTC-6).
    const dia1 = {
      ...fixtureMaintenanceScheduled,
      id: 'm-dia-1',
      title: 'Evento del dia uno',
      scheduledDate: `${dateInCurrentMonth(1)}T00:00:00.000Z`,
    };
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [dia1] });
    networkNodeService.list.mockResolvedValueOnce({ networkNodes: [] });

    renderWithProviders(<Calendar />, { authValue: adminAuthValue() });
    await waitFor(() => expect(screen.getByText('Evento del dia uno')).toBeInTheDocument());

    const celda = screen.getByText('Evento del dia uno').closest('.nk-cal-cell');
    expect(celda.querySelector('.nk-cal-day').textContent).toBe('1');
  });
});

/* ---------- Reprogramar arrastrando (PUT /maintenances/:id real) ---------- */

// jsdom no implementa DataTransfer: se simula el minimo que usa el componente.
function makeDataTransfer() {
  const store = {};
  return {
    setData: (type, value) => { store[type] = String(value); },
    getData: (type) => store[type] || '',
    effectAllowed: '',
    dropEffect: '',
  };
}

function eventButton(title) {
  return screen.getByText(title).closest('button');
}

function cellForDay(container, day) {
  return Array.from(container.querySelectorAll('.nk-cal-cell'))
    .find((c) => c.querySelector('.nk-cal-day')?.textContent === String(day));
}

/** dragStart + dragOver + drop sobre la celda del dia indicado. */
function dragEventToDay(container, title, day) {
  const dataTransfer = makeDataTransfer();
  const target = cellForDay(container, day);
  fireEvent.dragStart(eventButton(title), { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe('Calendar · reprogramar arrastrando', () => {
  const eventoDia10 = { ...eventoEsteMes, scheduledDate: `${dateInCurrentMonth(10)}T00:00:00.000Z` };

  async function renderCalendar({ maintenances = [eventoDia10], authValue = adminAuthValue() } = {}) {
    maintenanceService.list.mockResolvedValue({ maintenances });
    networkNodeService.list.mockResolvedValue({ networkNodes: [] });
    const utils = renderWithProviders(<Calendar />, { authValue });
    await waitFor(() => expect(screen.getByText(maintenances[0].title)).toBeInTheDocument());
    return utils;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN: una orden programada es arrastrable', async () => {
    await renderCalendar();
    expect(eventButton('Evento de este mes')).toHaveAttribute('draggable', 'true');
  });

  it('OPERATOR: ninguna orden es arrastrable (PUT /maintenances es solo ADMIN)', async () => {
    await renderCalendar({ authValue: operatorAuthValue() });
    expect(eventButton('Evento de este mes')).toHaveAttribute('draggable', 'false');
  });

  it('las ordenes completadas o canceladas no se pueden arrastrar', async () => {
    const completado = { ...eventoDia10, id: 'm-completado', title: 'Orden completada', status: 'COMPLETED' };
    const cancelado = { ...eventoDia10, id: 'm-cancelado', title: 'Orden cancelada', status: 'CANCELLED' };
    await renderCalendar({ maintenances: [completado, cancelado] });

    expect(eventButton('Orden completada')).toHaveAttribute('draggable', 'false');
    expect(eventButton('Orden cancelada')).toHaveAttribute('draggable', 'false');
  });

  it('soltar en otro dia actualiza via la API real conservando el resto de la orden', async () => {
    maintenanceService.update.mockResolvedValueOnce({ maintenance: { id: eventoDia10.id } });
    const { container } = await renderCalendar();

    dragEventToDay(container, 'Evento de este mes', 20);

    await waitFor(() => expect(maintenanceService.update).toHaveBeenCalledTimes(1));
    const [id, payload] = maintenanceService.update.mock.calls[0];
    expect(id).toBe(eventoDia10.id);
    expect(payload.scheduledDate).toBe(dateInCurrentMonth(20));
    // El resto de la orden viaja intacto: el PUT no es parcial.
    expect(payload.title).toBe(eventoDia10.title);
    expect(payload.description).toBe(eventoDia10.description);
    expect(payload.type).toBe('PREVENTIVE');
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
    // Nunca se tocan el estado ni la trazabilidad.
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('startedAt');
    expect(payload).not.toHaveProperty('completedAt');
  });

  it('una orden correctiva conserva su equipo al reprogramarse', async () => {
    const correctivo = {
      ...eventoDia10,
      id: 'm-correctivo',
      title: 'Correctivo de este mes',
      type: 'CORRECTIVE',
      networkNodeId: null,
      networkNode: null,
      equipmentId: fixtureEquipmentB.id,
      equipment: fixtureEquipmentB,
    };
    maintenanceService.update.mockResolvedValueOnce({ maintenance: { id: correctivo.id } });
    const { container } = await renderCalendar({ maintenances: [correctivo] });

    dragEventToDay(container, 'Correctivo de este mes', 15);

    await waitFor(() => expect(maintenanceService.update).toHaveBeenCalledTimes(1));
    const [, payload] = maintenanceService.update.mock.calls[0];
    expect(payload.type).toBe('CORRECTIVE');
    expect(payload.equipmentId).toBe(fixtureEquipmentB.id);
    expect(payload.networkNodeId).toBeNull();
  });

  it('soltar en el mismo dia no llama a la API', async () => {
    const { container } = await renderCalendar();

    dragEventToDay(container, 'Evento de este mes', 10);

    await waitFor(() => expect(screen.getByText('Evento de este mes')).toBeInTheDocument());
    expect(maintenanceService.update).not.toHaveBeenCalled();
  });

  it('recarga la lista despues de reprogramar', async () => {
    maintenanceService.update.mockResolvedValueOnce({ maintenance: { id: eventoDia10.id } });
    const { container } = await renderCalendar();
    const cargasIniciales = maintenanceService.list.mock.calls.length;

    dragEventToDay(container, 'Evento de este mes', 20);

    await waitFor(() => expect(maintenanceService.list.mock.calls.length).toBeGreaterThan(cargasIniciales));
  });

  it('un error del backend se muestra y no altera el calendario', async () => {
    maintenanceService.update.mockRejectedValueOnce(makeApiError('No se pudo actualizar el mantenimiento.', { status: 409 }));
    const { container } = await renderCalendar();

    dragEventToDay(container, 'Evento de este mes', 20);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el mantenimiento.');
    expect(screen.getByText('Evento de este mes')).toBeInTheDocument();
  });
});
