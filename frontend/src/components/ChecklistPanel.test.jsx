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

import * as checklistTaskService from '../services/checklistTaskService.js';

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

    expect(screen.getByText('Agregar tarea')).toBeInTheDocument();
    expect(screen.getAllByTitle('Editar')).toHaveLength(2);
    expect(screen.getAllByTitle('Eliminar')).toHaveLength(2);
  });

  it('OPERATOR en SCHEDULED: NO puede gestionar la estructura', () => {
    renderPanel({ authValue: operatorAuthValue(), status: 'SCHEDULED' });

    expect(screen.queryByText('Agregar tarea')).not.toBeInTheDocument();
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

  it('en IN_PROGRESS no se puede gestionar la estructura (sin Agregar tarea ni editar/eliminar)', () => {
    renderPanel({ authValue: adminAuthValue(), status: 'IN_PROGRESS' });

    expect(screen.queryByText('Agregar tarea')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
  });

  it('en COMPLETED todo es de solo lectura: sin estructura y sin poder marcar', () => {
    renderPanel({ authValue: adminAuthValue(), status: 'COMPLETED' });

    expect(screen.queryByText('Agregar tarea')).not.toBeInTheDocument();
    const checkboxes = screen.getAllByRole('button', { name: /Marcar como/ });
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
  });
});
