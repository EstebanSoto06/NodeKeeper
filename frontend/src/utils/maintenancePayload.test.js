import { describe, expect, it } from 'vitest';
import { buildMaintenanceUpdatePayload } from './maintenancePayload.js';
import {
  fixtureMaintenanceScheduled,
  fixtureMaintenanceInProgress,
  fixtureNodeAvailable,
  fixtureEquipmentB,
} from '../test/fixtures.js';

describe('buildMaintenanceUpdatePayload', () => {
  it('preventivo: conserva titulo, descripcion, tipo y nodo, y anula equipmentId', () => {
    const payload = buildMaintenanceUpdatePayload(fixtureMaintenanceScheduled);

    expect(payload.title).toBe(fixtureMaintenanceScheduled.title);
    expect(payload.description).toBe(fixtureMaintenanceScheduled.description);
    expect(payload.type).toBe('PREVENTIVE');
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
    expect(payload.equipmentId).toBeNull();
  });

  it('correctivo: conserva el equipo y anula networkNodeId, como exige el backend', () => {
    const payload = buildMaintenanceUpdatePayload(fixtureMaintenanceInProgress);

    expect(payload.type).toBe('CORRECTIVE');
    expect(payload.equipmentId).toBe(fixtureEquipmentB.id);
    expect(payload.networkNodeId).toBeNull();
  });

  it('normaliza scheduledDate ISO a YYYY-MM-DD', () => {
    expect(buildMaintenanceUpdatePayload(fixtureMaintenanceScheduled).scheduledDate).toBe('2026-03-01');
  });

  it('description ausente viaja como null, no como undefined', () => {
    const payload = buildMaintenanceUpdatePayload(fixtureMaintenanceInProgress);
    expect(payload.description).toBeNull();
    expect('description' in payload).toBe(true);
  });

  it('los overrides reemplazan solo el campo indicado', () => {
    const payload = buildMaintenanceUpdatePayload(fixtureMaintenanceScheduled, { scheduledDate: '2026-05-20' });

    expect(payload.scheduledDate).toBe('2026-05-20');
    expect(payload.title).toBe(fixtureMaintenanceScheduled.title);
    expect(payload.networkNodeId).toBe(fixtureNodeAvailable.id);
  });

  it('nunca incluye campos que el endpoint de actualizacion no acepta', () => {
    const payload = buildMaintenanceUpdatePayload(fixtureMaintenanceInProgress, { scheduledDate: '2026-05-20' });

    ['status', 'startedAt', 'completedAt', 'createdById', 'startedById', 'closedById', 'id'].forEach((key) => {
      expect(payload).not.toHaveProperty(key);
    });
  });

  it('deriva el nodo desde la relacion incluida si falta el id plano', () => {
    const sinIdPlano = { ...fixtureMaintenanceScheduled, networkNodeId: null };
    expect(buildMaintenanceUpdatePayload(sinIdPlano).networkNodeId).toBe(fixtureNodeAvailable.id);
  });

  it('scheduledDate nula se mantiene nula', () => {
    const sinFecha = { ...fixtureMaintenanceScheduled, scheduledDate: null };
    expect(buildMaintenanceUpdatePayload(sinFecha).scheduledDate).toBeNull();
  });
});
