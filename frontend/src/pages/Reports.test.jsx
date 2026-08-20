import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reports } from './Reports.jsx';
import { renderWithProviders, adminAuthValue } from '../test/test-utils.jsx';
import { fixtureMaintenanceScheduled, fixtureMaintenanceCompleted, fixtureNodes, fixtureEquipment } from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ list: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';

const mantenimientoConCaracteresEspeciales = {
  ...fixtureMaintenanceCompleted,
  id: 'm-especial',
  title: 'Revisión, "urgente" niño',
  description: 'Línea 1\nLínea 2, con comas y "comillas"',
};

async function renderReady(maintenances = [fixtureMaintenanceScheduled, mantenimientoConCaracteresEspeciales]) {
  maintenanceService.list.mockResolvedValueOnce({ maintenances });
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: fixtureNodes });
  equipmentService.list.mockResolvedValueOnce({ equipment: fixtureEquipment });
  renderWithProviders(<Reports />, { authValue: adminAuthValue() });
  await waitFor(() => expect(screen.getByText(fixtureMaintenanceScheduled.title)).toBeInTheDocument());
}

describe('Reports', () => {
  let createObjectURLSpy;
  let printSpy;
  let anchorClickSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURLSpy = vi.fn(() => 'blob:mock');
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: vi.fn() });
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    // downloadCsv crea un <a> con href blob: y llama a click(); jsdom no
    // implementa esa navegación y emite una advertencia no fatal. Se espía
    // click() para evitarla sin cambiar el comportamiento real de descarga.
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    printSpy.mockRestore();
    anchorClickSpy.mockRestore();
  });

  it('muestra el contador de resultados filtrados sobre el total', async () => {
    await renderReady();
    expect(screen.getByText(`2 de 2 registros`)).toBeInTheDocument();
  });

  it('el filtro de estado reduce el contador y la tabla', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.selectOptions(screen.getByLabelText('Estado'), 'COMPLETED');

    expect(screen.getByText('1 de 2 registros')).toBeInTheDocument();
    expect(screen.queryByText(fixtureMaintenanceScheduled.title)).not.toBeInTheDocument();
    expect(screen.getByText(mantenimientoConCaracteresEspeciales.title)).toBeInTheDocument();
  });

  it('"Vista imprimible" invoca window.print', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByText('Vista imprimible'));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('el CSV exportado escapa comas, comillas, saltos de linea y acentos, y solo incluye los resultados filtrados', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.selectOptions(screen.getByLabelText('Estado'), 'COMPLETED');
    await waitFor(() => expect(screen.getByText('1 de 2 registros')).toBeInTheDocument());

    await user.click(screen.getByText('Exportar CSV'));

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0];
    const csv = (await blob.text()).replace(/^﻿/, '');

    expect(csv).not.toContain(fixtureMaintenanceScheduled.title);
    expect(csv).toContain('"Revisión, ""urgente"" niño"');
    expect(csv).toContain('"Línea 1\nLínea 2, con comas y ""comillas"""');
  });

  it('con cero resultados filtrados, "Exportar CSV" queda deshabilitado', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.selectOptions(screen.getByLabelText('Estado'), 'IN_PROGRESS');

    await waitFor(() => expect(screen.getByText('0 de 2 registros')).toBeInTheDocument());
    expect(screen.getByText('Exportar CSV').closest('button')).toBeDisabled();
  });

  /* ---------- Encabezado de la hoja impresa / del PDF ---------- */

  it('la hoja impresa lleva titulo propio y el conteo de registros', async () => {
    await renderReady();

    expect(screen.getByText('NodeKeeper · Reporte de mantenimientos')).toBeInTheDocument();
    expect(screen.getByText(/Generado el .* · 2 de 2 registros/)).toBeInTheDocument();
  });

  it('sin filtros, la hoja lo indica explicitamente', async () => {
    await renderReady();

    expect(screen.getByText('Sin filtros aplicados: se incluyen todos los mantenimientos registrados.')).toBeInTheDocument();
  });

  it('con filtros activos, la hoja los describe para que el papel se entienda solo', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.selectOptions(screen.getByLabelText('Estado'), 'COMPLETED');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'PREVENTIVE');

    expect(screen.getByText('Filtros aplicados: Estado: Completado · Tipo: Preventivo')).toBeInTheDocument();
    // El conteo del encabezado sigue al filtro.
    expect(screen.getByText(/Generado el .* · 1 de 2 registros/)).toBeInTheDocument();
  });

  it('la tabla conserva un thead propio (base de la repeticion por pagina en @media print)', async () => {
    await renderReady();

    const thead = screen.getByRole('table').querySelector('thead');
    expect(thead).toBeInTheDocument();
    expect(within(thead).getByText('Mantenimiento')).toBeInTheDocument();
    expect(within(thead).getByText('Estado')).toBeInTheDocument();
  });
});
