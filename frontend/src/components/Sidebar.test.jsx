import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Sidebar } from './Sidebar.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';

vi.mock('../services/maintenanceService.js', () => ({
  list: vi.fn(() => Promise.resolve({ maintenances: [] })),
}));

/* La sección Administración solo existe para ADMIN. Ocultar el enlace es un
   espejo del permiso real: /plantillas está además protegida por rol en
   AppRoutes y sus cinco endpoints son ADMIN-only en el backend. */
describe('Sidebar · sección Administración', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN ve Usuarios y roles y Plantillas de checklist', () => {
    renderWithProviders(<Sidebar />, { authValue: adminAuthValue() });

    expect(screen.getByText('Administración')).toBeInTheDocument();
    expect(screen.getByText('Usuarios y roles')).toBeInTheDocument();
    expect(screen.getByText('Plantillas de checklist')).toBeInTheDocument();
  });

  it('OPERATOR no ve la sección ni ninguno de sus enlaces', () => {
    renderWithProviders(<Sidebar />, { authValue: operatorAuthValue() });

    expect(screen.queryByText('Administración')).not.toBeInTheDocument();
    expect(screen.queryByText('Usuarios y roles')).not.toBeInTheDocument();
    expect(screen.queryByText('Plantillas de checklist')).not.toBeInTheDocument();
  });

  it('el enlace de plantillas apunta a /plantillas', () => {
    renderWithProviders(<Sidebar />, { authValue: adminAuthValue() });

    expect(screen.getByText('Plantillas de checklist').closest('a')).toHaveAttribute(
      'href',
      '/plantillas',
    );
  });
});
