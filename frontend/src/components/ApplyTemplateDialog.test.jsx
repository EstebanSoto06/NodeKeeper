import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplyTemplateDialog } from './ApplyTemplateDialog.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { adminAuthValue, makeApiError } from '../test/test-utils.jsx';
import {
  fixtureChecklistTemplates,
  fixtureTemplateUps,
  fixtureChecklistPending,
} from '../test/fixtures.js';

vi.mock('../services/checklistTemplateService.js', () => ({
  list: vi.fn(),
  applyToMaintenance: vi.fn(),
}));

import * as checklistTemplateService from '../services/checklistTemplateService.js';

function renderDialog({ existingTasks = [], onApplied = vi.fn(), onClose = vi.fn() } = {}) {
  const utils = render(
    <AuthContext.Provider value={adminAuthValue()}>
      <ApplyTemplateDialog
        maintenanceId="m1"
        existingTasks={existingTasks}
        onClose={onClose}
        onApplied={onApplied}
      />
    </AuthContext.Provider>,
  );
  return { ...utils, onApplied, onClose };
}

async function selectTemplate(user, name) {
  const select = await screen.findByRole('combobox');
  await user.selectOptions(select, name);
}

describe('ApplyTemplateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checklistTemplateService.list.mockResolvedValue({
      checklistTemplates: fixtureChecklistTemplates,
    });
  });

  it('lista las plantillas disponibles con su numero de tareas', async () => {
    renderDialog();

    expect(
      await screen.findByRole('option', { name: 'Mantenimiento preventivo UPS (3 tareas)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Revisión trimestral de nodo (1 tarea)' }),
    ).toBeInTheDocument();
  });

  it('muestra la vista previa de las tareas al seleccionar una plantilla', async () => {
    const user = userEvent.setup();
    renderDialog();

    await selectTemplate(user, fixtureTemplateUps.id);

    expect(screen.getByText('Se agregarán 3 tareas:')).toBeInTheDocument();
    expect(screen.getByText('Revisar voltaje de entrada')).toBeInTheDocument();
    expect(screen.getByText('Revisar baterías')).toBeInTheDocument();
  });

  it('advierte de que las tareas se AGREGAN cuando el checklist ya tiene tareas', async () => {
    const user = userEvent.setup();
    renderDialog({ existingTasks: [{ id: 't1', description: 'Otra tarea' }] });

    await selectTemplate(user, fixtureTemplateUps.id);

    expect(screen.getByText(/ninguna tarea existente se reemplaza/i)).toBeInTheDocument();
  });

  it('advierte de los nombres duplicados SIN bloquear la operacion', async () => {
    const user = userEvent.setup();
    renderDialog({ existingTasks: [fixtureChecklistPending] });

    await selectTemplate(user, fixtureTemplateUps.id);

    // fixtureChecklistPending.description coincide con el tercer item.
    // El conteo va en su propio <b>, asi que se compara el textContent
    // completo del aviso en vez del texto de un unico nodo.
    const warning = screen.getByRole('status');
    expect(warning.textContent).toMatch(/1\s+tarea con un nombre que ya existe/i);
    expect(warning.textContent).toContain('«Tarea ficticia pendiente»');
    expect(warning.textContent).toMatch(/también serán agregadas/i);

    // El boton de confirmacion sigue habilitado: la advertencia es informativa.
    const confirmButton = screen.getByRole('button', { name: /Agregar 3 tareas/ });
    expect(confirmButton).not.toBeDisabled();
  });

  it('no muestra advertencia de duplicados cuando no hay coincidencias', async () => {
    const user = userEvent.setup();
    renderDialog({ existingTasks: [{ id: 't1', description: 'Nada que ver' }] });

    await selectTemplate(user, fixtureTemplateUps.id);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('aplica la plantilla, avisa al padre y cierra', async () => {
    const user = userEvent.setup();
    checklistTemplateService.applyToMaintenance.mockResolvedValueOnce({ checklistTasks: [] });

    const { onApplied, onClose } = renderDialog();

    await selectTemplate(user, fixtureTemplateUps.id);
    await user.click(screen.getByRole('button', { name: /Agregar 3 tareas/ }));

    await waitFor(() =>
      expect(checklistTemplateService.applyToMaintenance).toHaveBeenCalledWith(
        'm1',
        fixtureTemplateUps.id,
      ),
    );
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('el boton de confirmacion esta deshabilitado mientras no haya seleccion', async () => {
    renderDialog();

    await screen.findByRole('combobox');
    expect(screen.getByRole('button', { name: /Agregar tareas/ })).toBeDisabled();
  });

  it('muestra el error del backend sin cerrar el dialogo ni perder la seleccion', async () => {
    const user = userEvent.setup();
    checklistTemplateService.applyToMaintenance.mockRejectedValueOnce(
      makeApiError('Checklist tasks can only be created while the maintenance is scheduled', {
        status: 409,
      }),
    );

    const { onClose, onApplied } = renderDialog();

    await selectTemplate(user, fixtureTemplateUps.id);
    await user.click(screen.getByRole('button', { name: /Agregar 3 tareas/ }));

    expect(
      await screen.findByText(/can only be created while the maintenance is scheduled/i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
    // La vista previa sigue visible: no se perdio la seleccion.
    expect(screen.getByText('Se agregarán 3 tareas:')).toBeInTheDocument();
  });

  it('muestra un estado vacio cuando no hay plantillas', async () => {
    checklistTemplateService.list.mockResolvedValueOnce({ checklistTemplates: [] });
    renderDialog();

    expect(await screen.findByText('Sin listas de tareas')).toBeInTheDocument();
  });

  it('muestra el error si la carga de plantillas falla', async () => {
    checklistTemplateService.list.mockRejectedValueOnce(
      makeApiError('No autorizado', { status: 403 }),
    );
    renderDialog();

    expect(await screen.findByText('No autorizado')).toBeInTheDocument();
  });
});
