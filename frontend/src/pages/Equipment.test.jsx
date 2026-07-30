import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Equipment } from './Equipment.jsx';
import { renderWithProviders, adminAuthValue, operatorAuthValue } from '../test/test-utils.jsx';
import { fixtureEquipmentA, fixtureEquipmentB, fixtureNodeAvailable } from '../test/fixtures.js';

vi.mock('../services/equipmentService.js', () => ({ list: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));

import * as equipmentService from '../services/equipmentService.js';
import * as networkNodeService from '../services/networkNodeService.js';

function mockLists() {
  equipmentService.list.mockResolvedValueOnce({ equipment: [fixtureEquipmentA, fixtureEquipmentB] });
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
}

describe('Equipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra "No asignado" para el equipo sin proveedor de soporte', async () => {
    mockLists();
    renderWithProviders(<Equipment />, { authValue: adminAuthValue() });

    await waitFor(() => expect(screen.getByText(fixtureEquipmentB.name)).toBeInTheDocument());
    expect(screen.getByText('No asignado')).toBeInTheDocument();
  });

  it('ADMIN ve "Registrar equipo"', async () => {
    mockLists();
    renderWithProviders(<Equipment />, { authValue: adminAuthValue() });
    await waitFor(() => expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument());
    expect(screen.getByText('Registrar equipo')).toBeInTheDocument();
  });

  it('OPERATOR no ve "Registrar equipo"', async () => {
    mockLists();
    renderWithProviders(<Equipment />, { authValue: operatorAuthValue() });
    await waitFor(() => expect(screen.getByText(fixtureEquipmentA.name)).toBeInTheDocument());
    expect(screen.queryByText('Registrar equipo')).not.toBeInTheDocument();
  });
});
