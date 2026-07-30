/* Fixtures puramente ficticios para pruebas de frontend. Ningun dato aqui
   corresponde a una cuenta, credencial o registro real; los ids, correos y
   nombres son inventados a proposito para que nunca puedan confundirse con
   datos de un entorno real. Las formas (shapes) siguen exactamente lo que
   devuelven los endpoints reales (ver backend/src/modules/*), confirmado
   por inspeccion directa en bloques anteriores de este proyecto. */

export const fixtureAdminUser = {
  id: 'user-admin-fixture-1',
  name: 'Admin de Prueba',
  email: 'admin.fixture@example.test',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

export const fixtureOperatorUser = {
  id: 'user-operator-fixture-1',
  name: 'Operador de Prueba',
  email: 'operador.fixture@example.test',
  role: 'OPERATOR',
  isActive: true,
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

export const fixtureInactiveUser = {
  id: 'user-inactive-fixture-1',
  name: 'Usuario Inactivo',
  email: 'inactivo.fixture@example.test',
  role: 'OPERATOR',
  isActive: false,
  createdAt: '2026-01-01T08:00:00.000Z',
  updatedAt: '2026-01-01T08:00:00.000Z',
};

export const fixtureUsers = [fixtureAdminUser, fixtureOperatorUser, fixtureInactiveUser];

export const fixtureProviderA = {
  id: 'provider-fixture-1',
  companyName: 'Soporte Ficticio del Norte',
  supportPhone: '800-555-0100',
  supportEmail: 'soporte@ficticio-norte.test',
  contactName: 'Persona Ficticia Uno',
  contactPhone: '8888-0001',
  contactEmail: 'contacto1@ficticio-norte.test',
};

export const fixtureProviderB = {
  id: 'provider-fixture-2',
  companyName: 'Soporte Ficticio del Sur',
  supportPhone: '800-555-0200',
  supportEmail: 'soporte@ficticio-sur.test',
  contactName: 'Persona Ficticia Dos',
  contactPhone: '8888-0002',
  contactEmail: 'contacto2@ficticio-sur.test',
};

export const fixtureProviders = [fixtureProviderA, fixtureProviderB];

export const fixtureNodeAvailable = {
  id: 'node-fixture-1',
  code: 'NODO-F01',
  name: 'Nodo Ficticio Disponible',
  location: 'Localidad Ficticia A',
  latitude: 10.31,
  longitude: -84.43,
  status: 'AVAILABLE',
};

export const fixtureNodeMaintenance = {
  id: 'node-fixture-2',
  code: 'NODO-F02',
  name: 'Nodo Ficticio En Mantenimiento',
  location: 'Localidad Ficticia B',
  latitude: null,
  longitude: null,
  status: 'MAINTENANCE',
};

export const fixtureNodes = [fixtureNodeAvailable, fixtureNodeMaintenance];

export const fixtureEquipmentA = {
  id: 'equipment-fixture-1',
  name: 'Switch Ficticio Core',
  category: 'Red',
  serialNumber: 'SER-FICT-0001',
  status: 'OPERATIONAL',
  networkNodeId: fixtureNodeAvailable.id,
  supportProviderId: fixtureProviderA.id,
  networkNode: fixtureNodeAvailable,
  supportProvider: fixtureProviderA,
};

export const fixtureEquipmentB = {
  id: 'equipment-fixture-2',
  name: 'UPS Ficticio Respaldo',
  category: 'Energía',
  serialNumber: null,
  status: 'MAINTENANCE',
  networkNodeId: fixtureNodeMaintenance.id,
  supportProviderId: null,
  networkNode: fixtureNodeMaintenance,
  supportProvider: null,
};

export const fixtureEquipment = [fixtureEquipmentA, fixtureEquipmentB];

export const fixtureChecklistPending = {
  id: 'checklist-fixture-1',
  maintenanceId: 'maintenance-fixture-progress',
  description: 'Tarea ficticia pendiente',
  isCompleted: false,
  completedAt: null,
  completedById: null,
  sortOrder: 0,
  completedBy: null,
};

export const fixtureChecklistDone = {
  id: 'checklist-fixture-2',
  maintenanceId: 'maintenance-fixture-progress',
  description: 'Tarea ficticia completada',
  isCompleted: true,
  completedAt: '2026-02-01T10:00:00.000Z',
  completedById: fixtureOperatorUser.id,
  sortOrder: 1,
  completedBy: { id: fixtureOperatorUser.id, name: fixtureOperatorUser.name, email: fixtureOperatorUser.email, role: 'OPERATOR' },
};

export const fixtureEvidenceImage = {
  id: 'evidence-fixture-1',
  maintenanceId: 'maintenance-fixture-progress',
  originalName: 'foto-ficticia.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 204800,
  createdAt: '2026-02-01T10:05:00.000Z',
  uploadedBy: { id: fixtureOperatorUser.id, name: fixtureOperatorUser.name, email: fixtureOperatorUser.email, role: 'OPERATOR' },
};

export const fixtureEvidences = [fixtureEvidenceImage];

export const fixtureMaintenanceScheduled = {
  id: 'maintenance-fixture-scheduled',
  title: 'Mantenimiento ficticio programado',
  description: 'Descripción ficticia',
  type: 'PREVENTIVE',
  status: 'SCHEDULED',
  scheduledDate: '2026-03-01T00:00:00.000Z',
  startedAt: null,
  completedAt: null,
  networkNodeId: fixtureNodeAvailable.id,
  equipmentId: null,
  networkNode: fixtureNodeAvailable,
  equipment: null,
  createdBy: { id: fixtureAdminUser.id, name: fixtureAdminUser.name, email: fixtureAdminUser.email, role: 'ADMIN' },
  startedBy: null,
  closedBy: null,
  createdAt: '2026-01-15T08:00:00.000Z',
  checklistTasks: [],
  evidences: [],
};

export const fixtureMaintenanceInProgress = {
  id: 'maintenance-fixture-progress',
  title: 'Mantenimiento ficticio en progreso',
  description: null,
  type: 'CORRECTIVE',
  status: 'IN_PROGRESS',
  scheduledDate: '2026-02-01T00:00:00.000Z',
  startedAt: '2026-02-01T09:00:00.000Z',
  completedAt: null,
  networkNodeId: null,
  equipmentId: fixtureEquipmentB.id,
  networkNode: null,
  equipment: fixtureEquipmentB,
  createdBy: { id: fixtureAdminUser.id, name: fixtureAdminUser.name, email: fixtureAdminUser.email, role: 'ADMIN' },
  startedBy: { id: fixtureOperatorUser.id, name: fixtureOperatorUser.name, email: fixtureOperatorUser.email, role: 'OPERATOR' },
  closedBy: null,
  createdAt: '2026-01-20T08:00:00.000Z',
  checklistTasks: [fixtureChecklistPending, fixtureChecklistDone],
  evidences: fixtureEvidences,
};

export const fixtureMaintenanceCompleted = {
  id: 'maintenance-fixture-completed',
  title: 'Mantenimiento ficticio completado',
  description: null,
  type: 'PREVENTIVE',
  status: 'COMPLETED',
  scheduledDate: '2026-01-10T00:00:00.000Z',
  startedAt: '2026-01-10T09:00:00.000Z',
  completedAt: '2026-01-10T12:00:00.000Z',
  networkNodeId: fixtureNodeAvailable.id,
  equipmentId: null,
  networkNode: fixtureNodeAvailable,
  equipment: null,
  createdBy: { id: fixtureAdminUser.id, name: fixtureAdminUser.name, email: fixtureAdminUser.email, role: 'ADMIN' },
  startedBy: { id: fixtureAdminUser.id, name: fixtureAdminUser.name, email: fixtureAdminUser.email, role: 'ADMIN' },
  closedBy: { id: fixtureAdminUser.id, name: fixtureAdminUser.name, email: fixtureAdminUser.email, role: 'ADMIN' },
  createdAt: '2026-01-05T08:00:00.000Z',
  checklistTasks: [{ ...fixtureChecklistDone, id: 'checklist-fixture-3', maintenanceId: 'maintenance-fixture-completed' }],
  evidences: [],
};

export const fixtureMaintenances = [
  fixtureMaintenanceScheduled,
  fixtureMaintenanceInProgress,
  fixtureMaintenanceCompleted,
];
