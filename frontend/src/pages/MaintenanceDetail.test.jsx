import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { MaintenanceDetail } from './MaintenanceDetail.jsx';
import { renderWithProviders, adminAuthValue } from '../test/test-utils.jsx';
import {
  fixtureMaintenanceScheduled,
  fixtureMaintenanceInProgress,
  fixtureChecklistDone,
} from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({
  getById: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));
vi.mock('../services/checklistTaskService.js', () => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setStatus: vi.fn(),
}));
vi.mock('../services/evidenceService.js', () => ({
  list: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../store/store.js', () => ({ showToast: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as evidenceService from '../services/evidenceService.js';

function renderDetail(maintenance) {
  maintenanceService.getById.mockResolvedValueOnce({ maintenance });
  evidenceService.list.mockResolvedValue({ evidences: [] });
  return renderWithProviders(
    <Routes><Route path="/mantenimientos/:id" element={<MaintenanceDetail />} /></Routes>,
    { authValue: adminAuthValue(), initialEntries: [`/mantenimientos/${maintenance.id}`] },
  );
}

describe('MaintenanceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SCHEDULED: permite iniciar el mantenimiento', async () => {
    const user = userEvent.setup();
    maintenanceService.start.mockResolvedValueOnce({ maintenance: { ...fixtureMaintenanceScheduled, status: 'IN_PROGRESS' } });
    renderDetail(fixtureMaintenanceScheduled);

    await waitFor(() => expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument());
    await user.click(screen.getByText('Iniciar mantenimiento'));
    await user.click(screen.getByRole('button', { name: 'Iniciar' }));

    await waitFor(() => expect(maintenanceService.start).toHaveBeenCalledWith(fixtureMaintenanceScheduled.id));
  });

  it('IN_PROGRESS con tareas pendientes: el boton Completar esta deshabilitado y se muestra el aviso', async () => {
    renderDetail(fixtureMaintenanceInProgress);

    await waitFor(() => expect(screen.getByText(fixtureMaintenanceInProgress.title)).toBeInTheDocument());

    const completeButton = screen.getByText('Completar mantenimiento').closest('button');
    expect(completeButton).toBeDisabled();
    expect(screen.getByText(/No puedes completar/)).toBeInTheDocument();
  });

  it('IN_PROGRESS con checklist 100% completo: permite completar el mantenimiento', async () => {
    const user = userEvent.setup();
    const allDone = {
      ...fixtureMaintenanceInProgress,
      checklistTasks: [fixtureChecklistDone, { ...fixtureChecklistDone, id: 'checklist-fixture-extra' }],
    };
    maintenanceService.complete.mockResolvedValueOnce({ maintenance: { ...allDone, status: 'COMPLETED' } });
    renderDetail(allDone);

    await waitFor(() => expect(screen.getByText(allDone.title)).toBeInTheDocument());

    const completeButton = screen.getByText('Completar mantenimiento').closest('button');
    expect(completeButton).not.toBeDisabled();

    await user.click(completeButton);
    await user.click(screen.getByRole('button', { name: 'Completar' }));

    await waitFor(() => expect(maintenanceService.complete).toHaveBeenCalledWith(allDone.id));
  });
});
