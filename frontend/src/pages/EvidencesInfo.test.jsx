import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { EvidencesInfo } from './EvidencesInfo.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue, makeApiError } from '../test/test-utils.jsx';
import {
  fixtureMaintenanceInProgress,
  fixtureMaintenanceCompleted,
  fixtureMaintenanceScheduled,
  fixtureEvidenceImage,
  fixtureOperatorUser,
} from '../test/fixtures.js';

vi.mock('../services/maintenanceService.js', () => ({ list: vi.fn() }));
vi.mock('../services/evidenceService.js', () => ({ download: vi.fn() }));

import * as maintenanceService from '../services/maintenanceService.js';
import * as evidenceService from '../services/evidenceService.js';

// Segunda evidencia real (PDF) colgando de otra orden, para poder comprobar
// que la pantalla aplana evidencias de VARIOS mantenimientos.
const evidenciaPdf = {
  id: 'evidence-fixture-2',
  maintenanceId: fixtureMaintenanceCompleted.id,
  originalName: 'informe-ficticio.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 51200,
  createdAt: '2026-01-10T11:00:00.000Z',
  uploadedBy: { id: fixtureOperatorUser.id, name: fixtureOperatorUser.name, email: fixtureOperatorUser.email, role: 'OPERATOR' },
};

const completadoConPdf = { ...fixtureMaintenanceCompleted, evidences: [evidenciaPdf] };

async function renderReady(maintenances = [fixtureMaintenanceInProgress, completadoConPdf, fixtureMaintenanceScheduled], authValue) {
  maintenanceService.list.mockResolvedValueOnce({ maintenances });
  const utils = renderWithProviders(<EvidencesInfo />, { authValue: authValue ?? adminAuthValue() });
  await waitFor(() => expect(maintenanceService.list).toHaveBeenCalled());
  return utils;
}

describe('EvidencesInfo (/evidencias)', () => {
  let createObjectURLSpy;
  let anchorClickSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURLSpy = vi.fn(() => 'blob:mock');
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: vi.fn() });
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    anchorClickSpy.mockRestore();
  });

  it('lista las evidencias reales de todas las órdenes, con su mantenimiento', async () => {
    await renderReady();

    expect(await screen.findByText(fixtureEvidenceImage.originalName)).toBeInTheDocument();
    expect(screen.getByText(evidenciaPdf.originalName)).toBeInTheDocument();
    // Cada evidencia muestra la orden a la que pertenece (dato de la misma
    // respuesta). Se busca dentro de la tabla: los titulos aparecen tambien
    // como opciones del filtro por orden.
    const tabla = within(screen.getByRole('table'));
    expect(tabla.getByText(fixtureMaintenanceInProgress.title)).toBeInTheDocument();
    expect(tabla.getByText(fixtureMaintenanceCompleted.title)).toBeInTheDocument();
  });

  it('el subtítulo cuenta archivos y órdenes reales, sin inventar registros', async () => {
    await renderReady();

    // 2 evidencias en 2 órdenes; la tercera orden no tiene ninguna.
    expect(await screen.findByText('2 archivos adjuntos en 2 órdenes de mantenimiento')).toBeInTheDocument();
  });

  it('el filtro por formato separa imágenes de documentos', async () => {
    const user = userEvent.setup();
    await renderReady();
    await screen.findByText(fixtureEvidenceImage.originalName);

    await user.click(screen.getByText('Documentos'));
    expect(screen.getByText(evidenciaPdf.originalName)).toBeInTheDocument();
    expect(screen.queryByText(fixtureEvidenceImage.originalName)).not.toBeInTheDocument();

    await user.click(screen.getByText('Imágenes'));
    expect(screen.getByText(fixtureEvidenceImage.originalName)).toBeInTheDocument();
    expect(screen.queryByText(evidenciaPdf.originalName)).not.toBeInTheDocument();
  });

  it('el buscador filtra por nombre de archivo', async () => {
    const user = userEvent.setup();
    await renderReady();
    await screen.findByText(fixtureEvidenceImage.originalName);

    await user.type(screen.getByPlaceholderText('Buscar por archivo, orden o responsable…'), 'informe');

    expect(screen.getByText(evidenciaPdf.originalName)).toBeInTheDocument();
    expect(screen.queryByText(fixtureEvidenceImage.originalName)).not.toBeInTheDocument();
  });

  it('descargar usa el endpoint real de la evidencia, con su maintenanceId', async () => {
    const user = userEvent.setup();
    evidenceService.download.mockResolvedValueOnce({ blob: new Blob(['x']), filename: evidenciaPdf.originalName });
    await renderReady();
    await screen.findByText(evidenciaPdf.originalName);

    await user.click(screen.getByTitle(`Descargar ${evidenciaPdf.originalName}`));

    await waitFor(() => expect(evidenceService.download).toHaveBeenCalledWith(
      fixtureMaintenanceCompleted.id,
      evidenciaPdf.id,
    ));
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('un fallo de descarga se muestra sin romper la pantalla', async () => {
    const user = userEvent.setup();
    evidenceService.download.mockRejectedValueOnce(makeApiError('El archivo ya no está disponible.', { status: 404 }));
    await renderReady();
    await screen.findByText(evidenciaPdf.originalName);

    await user.click(screen.getByTitle(`Descargar ${evidenciaPdf.originalName}`));

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo ya no está disponible.');
    expect(screen.getByText(evidenciaPdf.originalName)).toBeInTheDocument();
  });

  it('sin evidencias en ninguna orden, muestra el estado vacío real', async () => {
    await renderReady([fixtureMaintenanceScheduled]);

    expect(await screen.findByText('Sin evidencias registradas')).toBeInTheDocument();
  });

  it('no ofrece subir ni eliminar: esas acciones viven dentro de cada orden', async () => {
    await renderReady();
    await screen.findByText(fixtureEvidenceImage.originalName);

    expect(screen.queryByText('Subir archivo')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });

  it('OPERATOR también consulta y descarga (el backend se lo permite)', async () => {
    await renderReady(undefined, operatorAuthValue());

    expect(await screen.findByText(fixtureEvidenceImage.originalName)).toBeInTheDocument();
    expect(screen.getByTitle(`Descargar ${evidenciaPdf.originalName}`)).toBeInTheDocument();
  });

  it('al hacer click en una fila navega al mantenimiento dueño de la evidencia', async () => {
    const user = userEvent.setup();
    maintenanceService.list.mockResolvedValueOnce({ maintenances: [completadoConPdf] });

    renderWithProviders(
      <Routes>
        <Route path="/evidencias" element={<EvidencesInfo />} />
        <Route path="/mantenimientos/:id" element={<div>Detalle de la orden</div>} />
      </Routes>,
      { authValue: adminAuthValue(), initialEntries: ['/evidencias'] },
    );

    await user.click(await screen.findByText(evidenciaPdf.originalName));

    expect(await screen.findByText('Detalle de la orden')).toBeInTheDocument();
  });
});
