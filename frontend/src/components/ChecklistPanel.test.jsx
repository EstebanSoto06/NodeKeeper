import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistPanel } from './ChecklistPanel.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';
import { fixtureChecklistPending, fixtureChecklistDone } from '../test/fixtures.js';

vi.mock('../services/checklistTaskService.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setStatus: vi.fn(),
}));

vi.mock('../services/checklistTemplateService.js', () => ({
  list: vi.fn(() => Promise.resolve({ checklistTemplates: [] })),
  applyToMaintenance: vi.fn(),
}));

import * as checklistTaskService from '../services/checklistTaskService.js';
import * as checklistTemplateService from '../services/checklistTemplateService.js';

function renderPanel({ authValue, status, tasks = [fixtureChecklistPending, fixtureChecklistDone] }) {
  return render(
    <AuthContext.Provider value={authValue}>
      <ChecklistPanel maintenanceId="m1" status={status} tasks={tasks} loading={false} onChanged={vi.fn()} />
    </AuthContext.Provider>,
  );
}

describe('ChecklistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN en SCHEDULED: puede gestionar la estructura (agregar/editar/eliminar tareas)', () => {
    renderPanel({ authValue: adminAuthValue(), status: 'SCHEDULED' });

    expect(screen.getByText('Agregar tareas')).toBeInTheDocument();
    expect(screen.getAllByTitle('Editar')).toHaveLength(2);
    expect(screen.getAllByTitle('Eliminar')).toHaveLength(2);
  });

  it('OPERATOR en SCHEDULED: NO puede gestionar la estructura', () => {
    renderPanel({ authValue: operatorAuthValue(), status: 'SCHEDULED' });

    expect(screen.queryByText('Agregar tareas')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });

  it('ADMIN y OPERATOR pueden marcar tareas en IN_PROGRESS, enviando isCompleted explicito', async () => {
    const user = userEvent.setup();
    checklistTaskService.setStatus.mockResolvedValueOnce({ checklistTask: { ...fixtureChecklistPending, isCompleted: true } });

    renderPanel({ authValue: operatorAuthValue(), status: 'IN_PROGRESS' });

    const checkboxes = screen.getAllByRole('button', { name: /Marcar como/ });
    await user.click(checkboxes[0]);

    await waitFor(() =>
      expect(checklistTaskService.setStatus).toHaveBeenCalledWith('m1', fixtureChecklistPending.id, { isCompleted: true }),
    );
  });

  it('en IN_PROGRESS no se puede gestionar la estructura (sin Agregar tareas ni editar/eliminar)', () => {
    renderPanel({ authValue: adminAuthValue(), status: 'IN_PROGRESS' });

    expect(screen.queryByText('Agregar tareas')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
  });

  it('en COMPLETED todo es de solo lectura: sin estructura y sin poder marcar', () => {
    renderPanel({ authValue: adminAuthValue(), status: 'COMPLETED' });

    expect(screen.queryByText('Agregar tareas')).not.toBeInTheDocument();
    const checkboxes = screen.getAllByRole('button', { name: /Marcar como/ });
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
  });
});

/* "Agregar tareas" despliega dos opciones: la manual (que conserva el flujo
   anterior intacto) y la de cargar una lista predeterminada. Ambas heredan la
   misma condicion que ya tenia "Agregar tarea": ADMIN + SCHEDULED. */
describe('ChecklistPanel · Agregar tareas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ofrece las dos opciones al pulsar el boton', async () => {
    const user = userEvent.setup();
    renderPanel({ authValue: adminAuthValue(), status: 'SCHEDULED' });

    await user.click(screen.getByText('Agregar tareas'));

    expect(screen.getByText('Agregar tarea manual')).toBeInTheDocument();
    expect(screen.getByText('Cargar lista predeterminada')).toBeInTheDocument();
  });

  it('"Agregar tarea manual" conserva el flujo actual de creacion individual', async () => {
    const user = userEvent.setup();
    checklistTaskService.create.mockResolvedValueOnce({ checklistTask: fixtureChecklistPending });

    renderPanel({ authValue: adminAuthValue(), status: 'SCHEDULED' });

    await user.click(screen.getByText('Agregar tareas'));
    await user.click(screen.getByText('Agregar tarea manual'));

    const input = screen.getByPlaceholderText('Descripción de la tarea');
    await user.type(input, 'Revisar UPS');
    await user.click(screen.getByText('Agregar'));

    await waitFor(() =>
      expect(checklistTaskService.create).toHaveBeenCalledWith('m1', {
        description: 'Revisar UPS',
        sortOrder: 2,
      }),
    );
  });

  it('"Cargar lista predeterminada" abre el dialogo de plantillas', async () => {
    const user = userEvent.setup();
    checklistTemplateService.list.mockResolvedValueOnce({ checklistTemplates: [] });

    renderPanel({ authValue: adminAuthValue(), status: 'SCHEDULED' });

    await user.click(screen.getByText('Agregar tareas'));
    await user.click(screen.getByText('Cargar lista predeterminada'));

    expect(await screen.findByText('Cargar lista predeterminada', { selector: '.nk-modal-title' })).toBeInTheDocument();
  });

  it('cancelar el menu no abre ningun flujo', async () => {
    const user = userEvent.setup();
    renderPanel({ authValue: adminAuthValue(), status: 'SCHEDULED' });

    await user.click(screen.getByText('Agregar tareas'));
    await user.click(screen.getByText('Cancelar'));

    expect(screen.getByText('Agregar tareas')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Descripción de la tarea')).not.toBeInTheDocument();
  });
});
