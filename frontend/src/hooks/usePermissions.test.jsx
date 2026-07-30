import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePermissions } from './usePermissions.js';
import { AuthContext } from '../context/AuthContext.jsx';
import { adminAuthValue, operatorAuthValue, buildAuthValue } from '../test/test-utils.jsx';

function Probe() {
  const p = usePermissions();
  return (
    <div>
      <span data-testid="isAdmin">{String(p.isAdmin)}</span>
      <span data-testid="isOperator">{String(p.isOperator)}</span>
      <span data-testid="canManageProviders">{String(p.canManageProviders)}</span>
      <span data-testid="canManageMaintenances">{String(p.canManageMaintenances)}</span>
      <span data-testid="uploadInProgress">{String(p.canUploadEvidenceFor('IN_PROGRESS'))}</span>
      <span data-testid="uploadCompleted">{String(p.canUploadEvidenceFor('COMPLETED'))}</span>
      <span data-testid="deleteEvidenceInProgress">{String(p.canDeleteEvidenceFor('IN_PROGRESS'))}</span>
      <span data-testid="structureScheduled">{String(p.canManageChecklistStructureFor('SCHEDULED'))}</span>
      <span data-testid="structureInProgress">{String(p.canManageChecklistStructureFor('IN_PROGRESS'))}</span>
      <span data-testid="toggleInProgress">{String(p.canToggleChecklistFor('IN_PROGRESS'))}</span>
      <span data-testid="toggleScheduled">{String(p.canToggleChecklistFor('SCHEDULED'))}</span>
    </div>
  );
}

function renderAs(authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <Probe />
    </AuthContext.Provider>,
  );
}

describe('usePermissions', () => {
  it('ADMIN: gestiona catalogos, sube y elimina evidencias en IN_PROGRESS, gestiona estructura solo en SCHEDULED', () => {
    renderAs(adminAuthValue());

    expect(screen.getByTestId('isAdmin')).toHaveTextContent('true');
    expect(screen.getByTestId('canManageProviders')).toHaveTextContent('true');
    expect(screen.getByTestId('canManageMaintenances')).toHaveTextContent('true');
    expect(screen.getByTestId('uploadInProgress')).toHaveTextContent('true');
    expect(screen.getByTestId('deleteEvidenceInProgress')).toHaveTextContent('true');
    expect(screen.getByTestId('structureScheduled')).toHaveTextContent('true');
    expect(screen.getByTestId('structureInProgress')).toHaveTextContent('false');
    expect(screen.getByTestId('toggleInProgress')).toHaveTextContent('true');
  });

  it('OPERATOR: consulta pero no gestiona catalogos ni elimina evidencias ni la estructura del checklist', () => {
    renderAs(operatorAuthValue());

    expect(screen.getByTestId('isOperator')).toHaveTextContent('true');
    expect(screen.getByTestId('canManageProviders')).toHaveTextContent('false');
    expect(screen.getByTestId('canManageMaintenances')).toHaveTextContent('false');
    expect(screen.getByTestId('uploadInProgress')).toHaveTextContent('true');
    expect(screen.getByTestId('deleteEvidenceInProgress')).toHaveTextContent('false');
    expect(screen.getByTestId('structureScheduled')).toHaveTextContent('false');
    expect(screen.getByTestId('toggleInProgress')).toHaveTextContent('true');
  });

  it('las reglas dependientes de estado se respetan para ambos roles (COMPLETED/SCHEDULED bloquean subir/marcar)', () => {
    renderAs(adminAuthValue());
    expect(screen.getByTestId('uploadCompleted')).toHaveTextContent('false');
    expect(screen.getByTestId('toggleScheduled')).toHaveTextContent('false');
  });

  it('sin sesion (usuario null), ningun permiso se concede', () => {
    renderAs(buildAuthValue({ user: null }));

    expect(screen.getByTestId('isAdmin')).toHaveTextContent('false');
    expect(screen.getByTestId('isOperator')).toHaveTextContent('false');
    expect(screen.getByTestId('uploadInProgress')).toHaveTextContent('false');
  });
});
