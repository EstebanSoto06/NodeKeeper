import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EquipmentFormModal } from './EquipmentFormModal.jsx';
import { makeApiError } from '../test/test-utils.jsx';
import { fixtureNodeAvailable, fixtureProviderA } from '../test/fixtures.js';

vi.mock('../services/equipmentService.js', () => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('../services/networkNodeService.js', () => ({ list: vi.fn() }));
vi.mock('../services/supportProviderService.js', () => ({ list: vi.fn() }));

import * as equipmentService from '../services/equipmentService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as supportProviderService from '../services/supportProviderService.js';

async function renderReady() {
  networkNodeService.list.mockResolvedValueOnce({ networkNodes: [fixtureNodeAvailable] });
  supportProviderService.list.mockResolvedValueOnce({ supportProviders: [fixtureProviderA] });
  const utils = render(<EquipmentFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => expect(screen.getByPlaceholderText('Switch core')).toBeInTheDocument());
  return utils;
}

describe('EquipmentFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el select de Nodo se puebla con nodos reales y preselecciona el primero (nodo obligatorio)', async () => {
    await renderReady();
    const nodeSelect = screen.getByDisplayValue(`${fixtureNodeAvailable.name} (${fixtureNodeAvailable.code})`);
    expect(nodeSelect).toBeInTheDocument();
  });

  it('el select de Proveedor incluye "No asignado" como opcion (proveedor opcional)', async () => {
    await renderReady();
    expect(screen.getByText('No asignado')).toBeInTheDocument();
    expect(screen.getByText(fixtureProviderA.companyName)).toBeInTheDocument();
  });

  it('un numero de serie duplicado (409) se muestra como error en el campo correspondiente', async () => {
    const user = userEvent.setup();
    await renderReady();
    equipmentService.create.mockRejectedValueOnce(
      makeApiError('Equipment serial number already exists', { status: 409 }),
    );

    await user.type(screen.getByPlaceholderText('Switch core'), 'Equipo de prueba');
    await user.type(screen.getByPlaceholderText('Red'), 'Red');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() =>
      expect(screen.getByText('Equipment serial number already exists')).toBeInTheDocument(),
    );
  });

  it('al guardar, envia supportProviderId null cuando se deja "No asignado"', async () => {
    const user = userEvent.setup();
    await renderReady();
    equipmentService.create.mockResolvedValueOnce({ equipment: { id: 'e1' } });

    await user.type(screen.getByPlaceholderText('Switch core'), 'Equipo de prueba');
    await user.type(screen.getByPlaceholderText('Red'), 'Red');
    await user.click(screen.getByText('Guardar equipo'));

    await waitFor(() => expect(equipmentService.create).toHaveBeenCalledTimes(1));
    const [payload] = equipmentService.create.mock.calls[0];
    expect(payload.supportProviderId).toBeNull();
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
  });
});
