import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistTemplateFormModal } from './ChecklistTemplateFormModal.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { adminAuthValue, makeApiError } from '../test/test-utils.jsx';
import { fixtureTemplateUps } from '../test/fixtures.js';

vi.mock('../services/checklistTemplateService.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
}));

import * as checklistTemplateService from '../services/checklistTemplateService.js';

function renderModal({ template = null, onSaved = vi.fn(), onClose = vi.fn() } = {}) {
  const utils = render(
    <AuthContext.Provider value={adminAuthValue()}>
      <ChecklistTemplateFormModal template={template} onClose={onClose} onSaved={onSaved} />
    </AuthContext.Provider>,
  );
  return { ...utils, onSaved, onClose };
}

function taskInputs() {
  return screen.getAllByPlaceholderText('Descripción de la tarea');
}

describe('ChecklistTemplateFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('creacion', () => {
    it('arranca con un campo de tarea vacio', () => {
      renderModal();

      expect(screen.getByText('Nueva lista de tareas')).toBeInTheDocument();
      expect(taskInputs()).toHaveLength(1);
    });

    it('crea la lista con nombre y tareas, derivando el orden del array', async () => {
      const user = userEvent.setup();
      checklistTemplateService.create.mockResolvedValueOnce({ checklistTemplate: fixtureTemplateUps });

      const { onSaved, onClose } = renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), 'Rutina UPS');
      await user.type(taskInputs()[0], 'Revisar voltaje');
      await user.click(screen.getByText('Agregar tarea'));
      await user.type(taskInputs()[1], 'Revisar baterías');
      await user.click(screen.getByText('Guardar lista'));

      await waitFor(() =>
        expect(checklistTemplateService.create).toHaveBeenCalledWith({
          name: 'Rutina UPS',
          description: null,
          items: [{ description: 'Revisar voltaje' }, { description: 'Revisar baterías' }],
        }),
      );
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('aplica trim al nombre y a las tareas antes de enviar', async () => {
      const user = userEvent.setup();
      checklistTemplateService.create.mockResolvedValueOnce({ checklistTemplate: fixtureTemplateUps });

      renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), '   Rutina   ');
      await user.type(taskInputs()[0], '   Revisar baterías   ');
      await user.click(screen.getByText('Guardar lista'));

      await waitFor(() =>
        expect(checklistTemplateService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Rutina',
            items: [{ description: 'Revisar baterías' }],
          }),
        ),
      );
    });
  });

  describe('edicion', () => {
    it('precarga nombre, descripcion y tareas existentes', () => {
      renderModal({ template: fixtureTemplateUps });

      expect(screen.getByText('Editar lista de tareas')).toBeInTheDocument();
      expect(screen.getByDisplayValue(fixtureTemplateUps.name)).toBeInTheDocument();
      expect(screen.getByDisplayValue(fixtureTemplateUps.description)).toBeInTheDocument();
      expect(taskInputs()).toHaveLength(3);
      expect(taskInputs()[0]).toHaveValue('Revisar voltaje de entrada');
    });

    it('envia el conjunto COMPLETO de tareas (PUT declarativo)', async () => {
      const user = userEvent.setup();
      checklistTemplateService.update.mockResolvedValueOnce({ checklistTemplate: fixtureTemplateUps });

      renderModal({ template: fixtureTemplateUps });

      // Se elimina la primera tarea: el payload debe llevar solo las dos restantes.
      await user.click(screen.getAllByTitle('Eliminar tarea')[0]);
      await user.click(screen.getByText('Guardar lista'));

      await waitFor(() =>
        expect(checklistTemplateService.update).toHaveBeenCalledWith(
          fixtureTemplateUps.id,
          expect.objectContaining({
            items: [
              { description: 'Revisar baterías' },
              { description: 'Tarea ficticia pendiente' },
            ],
          }),
        ),
      );
    });
  });

  describe('orden de las tareas', () => {
    it('subir intercambia la tarea con la anterior', async () => {
      const user = userEvent.setup();
      checklistTemplateService.update.mockResolvedValueOnce({ checklistTemplate: fixtureTemplateUps });

      renderModal({ template: fixtureTemplateUps });

      await user.click(screen.getAllByTitle('Subir')[1]);

      expect(taskInputs()[0]).toHaveValue('Revisar baterías');
      expect(taskInputs()[1]).toHaveValue('Revisar voltaje de entrada');

      await user.click(screen.getByText('Guardar lista'));

      await waitFor(() =>
        expect(checklistTemplateService.update).toHaveBeenCalledWith(
          fixtureTemplateUps.id,
          expect.objectContaining({
            items: [
              { description: 'Revisar baterías' },
              { description: 'Revisar voltaje de entrada' },
              { description: 'Tarea ficticia pendiente' },
            ],
          }),
        ),
      );
    });

    it('bajar intercambia la tarea con la siguiente', async () => {
      const user = userEvent.setup();
      renderModal({ template: fixtureTemplateUps });

      await user.click(screen.getAllByTitle('Bajar')[0]);

      expect(taskInputs()[0]).toHaveValue('Revisar baterías');
      expect(taskInputs()[1]).toHaveValue('Revisar voltaje de entrada');
    });

    it('subir en la primera posicion y bajar en la ultima no hacen nada', async () => {
      const user = userEvent.setup();
      renderModal({ template: fixtureTemplateUps });

      await user.click(screen.getAllByTitle('Subir')[0]);
      await user.click(screen.getAllByTitle('Bajar')[2]);

      expect(taskInputs()[0]).toHaveValue('Revisar voltaje de entrada');
      expect(taskInputs()[2]).toHaveValue('Tarea ficticia pendiente');
    });
  });

  describe('validacion', () => {
    it('no envia si el nombre esta vacio', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.type(taskInputs()[0], 'Una tarea');
      await user.click(screen.getByText('Guardar lista'));

      expect(await screen.findByText(/Faltan datos obligatorios/i)).toBeInTheDocument();
      expect(checklistTemplateService.create).not.toHaveBeenCalled();
    });

    it('no envia una lista sin ninguna tarea', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), 'Lista vacía');
      await user.click(screen.getByText('Guardar lista'));

      expect(
        await screen.findByText('La lista debe tener al menos una tarea.'),
      ).toBeInTheDocument();
      expect(checklistTemplateService.create).not.toHaveBeenCalled();
    });

    it('marca las tareas repetidas dentro de la lista y no envia', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), 'Lista');
      await user.type(taskInputs()[0], 'Revisar baterías');
      await user.click(screen.getByText('Agregar tarea'));
      // Mismo texto con espacios y mayusculas distintas: duplicado.
      await user.type(taskInputs()[1], '  REVISAR   baterías  ');

      expect(screen.getByText('Esta tarea ya está en la lista.')).toBeInTheDocument();

      await user.click(screen.getByText('Guardar lista'));

      expect(
        await screen.findByText(/Hay tareas repetidas en la lista/i),
      ).toBeInTheDocument();
      expect(checklistTemplateService.create).not.toHaveBeenCalled();
    });

    it('los acentos distinguen: «revisión» y «revision» no son duplicados', async () => {
      const user = userEvent.setup();
      checklistTemplateService.create.mockResolvedValueOnce({ checklistTemplate: fixtureTemplateUps });

      renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), 'Lista');
      await user.type(taskInputs()[0], 'Revisión general');
      await user.click(screen.getByText('Agregar tarea'));
      await user.type(taskInputs()[1], 'Revision general');

      expect(screen.queryByText('Esta tarea ya está en la lista.')).not.toBeInTheDocument();

      await user.click(screen.getByText('Guardar lista'));

      await waitFor(() => expect(checklistTemplateService.create).toHaveBeenCalled());
    });
  });

  describe('errores del backend', () => {
    it('muestra el 409 de nombre duplicado sin cerrar el modal', async () => {
      const user = userEvent.setup();
      checklistTemplateService.create.mockRejectedValueOnce(
        makeApiError('A checklist template with this name already exists', { status: 409 }),
      );

      const { onClose, onSaved } = renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), 'Duplicada');
      await user.type(taskInputs()[0], 'Una tarea');
      await user.click(screen.getByText('Guardar lista'));

      expect(
        await screen.findByText('A checklist template with this name already exists'),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('mapea los errores 400 por campo del backend', async () => {
      const user = userEvent.setup();
      checklistTemplateService.create.mockRejectedValueOnce(
        makeApiError('Validation failed', {
          status: 400,
          errors: [{ path: 'items.0.description', message: 'Description is required' }],
        }),
      );

      renderModal();

      await user.type(screen.getByPlaceholderText('Mantenimiento preventivo UPS'), 'Lista');
      await user.type(taskInputs()[0], 'Una tarea');
      await user.click(screen.getByText('Guardar lista'));

      expect(await screen.findByText('Description is required')).toBeInTheDocument();
    });
  });
});
