import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistTemplates } from './ChecklistTemplates.jsx';
import { AppRoutes } from '../routes/AppRoutes.jsx';
import {
  renderWithProviders,
  operatorAuthValue,
  makeApiError,
} from '../test/test-utils.jsx';
import { fixtureChecklistTemplates, fixtureTemplateUps } from '../test/fixtures.js';

vi.mock('../services/checklistTemplateService.js', () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  applyToMaintenance: vi.fn(),
}));

import * as checklistTemplateService from '../services/checklistTemplateService.js';

describe('ChecklistTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checklistTemplateService.list.mockResolvedValue({
      checklistTemplates: fixtureChecklistTemplates,
    });
  });

  it('muestra el esqueleto de carga antes de resolver la peticion', () => {
    renderWithProviders(<ChecklistTemplates />);

    expect(screen.queryByText(fixtureTemplateUps.name)).not.toBeInTheDocument();
  });

  it('lista las plantillas con su numero de tareas', async () => {
    renderWithProviders(<ChecklistTemplates />);

    expect(await screen.findByText(fixtureTemplateUps.name)).toBeInTheDocument();
    expect(screen.getByText('Revisión trimestral de nodo')).toBeInTheDocument();

    const row = screen.getByText(fixtureTemplateUps.name).closest('tr');
    expect(within(row).getByText('3')).toBeInTheDocument();
  });

  it('muestra el aviso de que aplicar una lista COPIA las tareas', async () => {
    renderWithProviders(<ChecklistTemplates />);

    await screen.findByText(fixtureTemplateUps.name);
    expect(
      screen.getByText(/sus tareas se copian/i),
    ).toBeInTheDocument();
  });

  it('filtra por el buscador', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChecklistTemplates />);

    await screen.findByText(fixtureTemplateUps.name);
    await user.type(screen.getByPlaceholderText('Buscar lista…'), 'nodo');

    expect(screen.queryByText(fixtureTemplateUps.name)).not.toBeInTheDocument();
    expect(screen.getByText('Revisión trimestral de nodo')).toBeInTheDocument();
  });

  it('muestra el estado de error con reintento', async () => {
    checklistTemplateService.list.mockRejectedValueOnce(
      makeApiError('Fallo de red', { status: 500 }),
    );
    renderWithProviders(<ChecklistTemplates />);

    expect(await screen.findByText('Fallo de red')).toBeInTheDocument();
  });

  it('muestra el estado vacio cuando no hay plantillas', async () => {
    checklistTemplateService.list.mockResolvedValueOnce({ checklistTemplates: [] });
    renderWithProviders(<ChecklistTemplates />);

    expect(await screen.findByText('Sin listas de tareas')).toBeInTheDocument();
  });

  it('"Nueva lista" abre el modal de creacion', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChecklistTemplates />);

    await screen.findByText(fixtureTemplateUps.name);
    await user.click(screen.getByText('Nueva lista'));

    expect(await screen.findByText('Nueva lista de tareas')).toBeInTheDocument();
  });

  it('el boton de editar abre el modal con la plantilla precargada', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChecklistTemplates />);

    await screen.findByText(fixtureTemplateUps.name);
    const row = screen.getByText(fixtureTemplateUps.name).closest('tr');
    await user.click(within(row).getByTitle('Editar'));

    expect(await screen.findByText('Editar lista de tareas')).toBeInTheDocument();
    expect(screen.getByDisplayValue(fixtureTemplateUps.name)).toBeInTheDocument();
  });

  describe('eliminacion', () => {
    it('pide confirmacion y avisa de que los mantenimientos no se ven afectados', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ChecklistTemplates />);

      await screen.findByText(fixtureTemplateUps.name);
      const row = screen.getByText(fixtureTemplateUps.name).closest('tr');
      await user.click(within(row).getByTitle('Eliminar'));

      expect(await screen.findByText(/conservan sus tareas/i)).toBeInTheDocument();
      expect(checklistTemplateService.remove).not.toHaveBeenCalled();
    });

    it('elimina al confirmar y recarga la lista', async () => {
      const user = userEvent.setup();
      checklistTemplateService.remove.mockResolvedValueOnce(null);

      renderWithProviders(<ChecklistTemplates />);

      await screen.findByText(fixtureTemplateUps.name);
      const row = screen.getByText(fixtureTemplateUps.name).closest('tr');
      await user.click(within(row).getByTitle('Eliminar'));
      await user.click(await screen.findByText('Eliminar lista'));

      await waitFor(() =>
        expect(checklistTemplateService.remove).toHaveBeenCalledWith(fixtureTemplateUps.id),
      );
      // Una recarga tras el borrado, ademas de la carga inicial.
      await waitFor(() => expect(checklistTemplateService.list).toHaveBeenCalledTimes(2));
    });

    it('muestra el error del backend sin cerrar el dialogo', async () => {
      const user = userEvent.setup();
      checklistTemplateService.remove.mockRejectedValueOnce(
        makeApiError('No se pudo eliminar', { status: 500 }),
      );

      renderWithProviders(<ChecklistTemplates />);

      await screen.findByText(fixtureTemplateUps.name);
      const row = screen.getByText(fixtureTemplateUps.name).closest('tr');
      await user.click(within(row).getByTitle('Eliminar'));
      await user.click(await screen.findByText('Eliminar lista'));

      expect(await screen.findByText('No se pudo eliminar')).toBeInTheDocument();
    });
  });
});

/* La restriccion de rol no depende de ocultar botones: /plantillas se monta
   bajo <ProtectedRoute roles={['ADMIN']}> y el backend rechaza con 403 las
   CINCO rutas del modulo, incluidas las de lectura. */
describe('ChecklistTemplates · permisos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checklistTemplateService.list.mockResolvedValue({
      checklistTemplates: fixtureChecklistTemplates,
    });
  });

  it('un OPERATOR que navega a /plantillas por URL ve AccessDenied', async () => {
    renderWithProviders(<AppRoutes />, {
      initialEntries: ['/plantillas'],
      authValue: operatorAuthValue(),
    });

    expect(await screen.findByText(/no tienes permisos|acceso denegado/i)).toBeInTheDocument();
    expect(screen.queryByText('Plantillas de checklist')).not.toBeInTheDocument();
    // Nunca se llega a pedir la lista para ese rol.
    expect(checklistTemplateService.list).not.toHaveBeenCalled();
  });
});
