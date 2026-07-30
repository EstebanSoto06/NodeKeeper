import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidencePanel } from './EvidencePanel.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';
import { fixtureEvidenceImage } from '../test/fixtures.js';

vi.mock('../services/evidenceService.js', () => ({
  list: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));

import * as evidenceService from '../services/evidenceService.js';

function renderPanel({ authValue, status, isCompleted = false }) {
  return render(
    <AuthContext.Provider value={authValue}>
      <EvidencePanel maintenanceId="m1" status={status} isCompleted={isCompleted} />
    </AuthContext.Provider>,
  );
}

describe('EvidencePanel', () => {
  let anchorClickSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
    // El componente crea un <a> con href blob: y llama a click() para disparar
    // la descarga. jsdom no implementa esa navegación y emite una advertencia
    // de consola no fatal; se espía click() para evitarla sin cambiar el
    // comportamiento real de descarga (que sigue viviendo en el componente).
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    anchorClickSpy.mockRestore();
  });

  it('carga y muestra el listado real de evidencias', async () => {
    evidenceService.list.mockResolvedValueOnce({ evidences: [fixtureEvidenceImage] });
    renderPanel({ authValue: adminAuthValue(), status: 'IN_PROGRESS' });

    await waitFor(() => expect(screen.getByText(fixtureEvidenceImage.originalName)).toBeInTheDocument());
  });

  it('IN_PROGRESS: el input de carga acepta JPG, PNG, PDF y DOCX', async () => {
    evidenceService.list.mockResolvedValueOnce({ evidences: [] });
    const { container } = renderPanel({ authValue: adminAuthValue(), status: 'IN_PROGRESS' });

    await waitFor(() => expect(screen.getByText('Subir archivo')).toBeInTheDocument());
    const input = container.querySelector('input[type="file"]');
    expect(input.accept).toContain('.jpg');
    expect(input.accept).toContain('.png');
    expect(input.accept).toContain('.pdf');
    expect(input.accept).toContain('.docx');
  });

  it('sube un archivo real como FormData con el campo file', async () => {
    const user = userEvent.setup();
    evidenceService.list.mockResolvedValueOnce({ evidences: [] }).mockResolvedValueOnce({ evidences: [fixtureEvidenceImage] });
    evidenceService.upload.mockResolvedValueOnce({ evidence: fixtureEvidenceImage });

    const { container } = renderPanel({ authValue: adminAuthValue(), status: 'IN_PROGRESS' });
    await waitFor(() => expect(screen.getByText('Subir archivo')).toBeInTheDocument());

    const file = new File(['contenido'], 'evidencia.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    await user.upload(input, file);

    await waitFor(() => expect(evidenceService.upload).toHaveBeenCalledWith('m1', file));
  });

  it('descarga una evidencia via blob autenticado', async () => {
    const user = userEvent.setup();
    evidenceService.list.mockResolvedValueOnce({ evidences: [fixtureEvidenceImage] });
    evidenceService.download.mockResolvedValueOnce({ blob: new Blob(['x']), filename: 'foto-ficticia.jpg' });

    renderPanel({ authValue: operatorAuthValue(), status: 'COMPLETED', isCompleted: true });
    await waitFor(() => expect(screen.getByText(fixtureEvidenceImage.originalName)).toBeInTheDocument());

    await user.click(screen.getByTitle('Descargar'));

    await waitFor(() => expect(evidenceService.download).toHaveBeenCalledWith('m1', fixtureEvidenceImage.id));
  });

  it('ADMIN elimina una evidencia en IN_PROGRESS, con confirmacion', async () => {
    const user = userEvent.setup();
    evidenceService.list.mockResolvedValueOnce({ evidences: [fixtureEvidenceImage] });
    evidenceService.remove.mockResolvedValueOnce(null);

    renderPanel({ authValue: adminAuthValue(), status: 'IN_PROGRESS' });
    await waitFor(() => expect(screen.getByText(fixtureEvidenceImage.originalName)).toBeInTheDocument());

    await user.click(screen.getByTitle('Eliminar'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar evidencia' }));

    await waitFor(() => expect(evidenceService.remove).toHaveBeenCalledWith('m1', fixtureEvidenceImage.id));
  });

  it('OPERATOR no ve boton de eliminar en IN_PROGRESS', async () => {
    evidenceService.list.mockResolvedValueOnce({ evidences: [fixtureEvidenceImage] });
    renderPanel({ authValue: operatorAuthValue(), status: 'IN_PROGRESS' });

    await waitFor(() => expect(screen.getByText(fixtureEvidenceImage.originalName)).toBeInTheDocument());
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
  });

  it('COMPLETED: ni ADMIN puede subir ni eliminar, solo listar/descargar', async () => {
    evidenceService.list.mockResolvedValueOnce({ evidences: [fixtureEvidenceImage] });
    const { container } = renderPanel({ authValue: adminAuthValue(), status: 'COMPLETED', isCompleted: true });

    await waitFor(() => expect(screen.getByText(fixtureEvidenceImage.originalName)).toBeInTheDocument());
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
    expect(screen.getByTitle('Descargar')).toBeInTheDocument();
  });
});
