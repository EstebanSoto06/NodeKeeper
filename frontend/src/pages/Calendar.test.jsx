import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Calendar } from './Calendar.jsx';
import { renderWithProviders, adminAuthValue } from '../test/test-utils.jsx';
import { fixtureMaintenanceScheduled } from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ list: vi.fn() }));
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
});
