/* Mapeo visual UNICO de los enums reales del backend (ver
   backend/prisma/schema.prisma). Cada entrada define etiqueta en espanol y
   colores tomados exclusivamente de las variables de --tokens.css (sin
   colores arbitrarios). Se consumen desde StatusBadge y las pantallas.

   Enums cubiertos:
   - NodeStatus:        AVAILABLE | MAINTENANCE | OUT_OF_SERVICE
   - EquipmentStatus:   OPERATIONAL | MAINTENANCE | OUT_OF_SERVICE
   - MaintenanceStatus: SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
   - MaintenanceType:   PREVENTIVE | CORRECTIVE */

// Paletas reutilizables (fondo suave / texto / punto solido).
const TONE = {
  green: { bg: 'var(--green-50)', fg: 'var(--green-700)', solid: 'var(--green-500)' },
  blue: { bg: 'var(--blue-50)', fg: 'var(--blue-700)', solid: 'var(--blue-500)' },
  amber: { bg: 'var(--amber-50)', fg: 'var(--amber-700)', solid: 'var(--amber-500)' },
  red: { bg: 'var(--red-50)', fg: 'var(--red-700)', solid: 'var(--red-500)' },
  gray: { bg: 'var(--gray-100)', fg: 'var(--gray-600)', solid: 'var(--gray-400)' },
};

export const NODE_STATUS = {
  AVAILABLE: { label: 'Disponible', ...TONE.green },
  MAINTENANCE: { label: 'En mantenimiento', ...TONE.amber },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', ...TONE.red },
};

export const EQUIPMENT_STATUS = {
  OPERATIONAL: { label: 'Operativo', ...TONE.green },
  MAINTENANCE: { label: 'En mantenimiento', ...TONE.amber },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', ...TONE.red },
};

export const MAINTENANCE_STATUS = {
  SCHEDULED: { label: 'Programado', ...TONE.gray },
  IN_PROGRESS: { label: 'En progreso', ...TONE.blue },
  COMPLETED: { label: 'Completado', ...TONE.green },
  CANCELLED: { label: 'Cancelado', ...TONE.red },
};

export const MAINTENANCE_TYPE = {
  PREVENTIVE: { label: 'Preventivo', ...TONE.blue },
  CORRECTIVE: { label: 'Correctivo', ...TONE.gray },
};

// Indice por "dominio" para que StatusBadge pueda resolver un valor dado su
// tipo sin que cada pantalla importe el mapa concreto.
export const STATUS_MAPS = {
  node: NODE_STATUS,
  equipment: EQUIPMENT_STATUS,
  maintenance: MAINTENANCE_STATUS,
  maintenanceType: MAINTENANCE_TYPE,
};

/** Resuelve la config visual de un estado. Devuelve una entrada neutra (con
    el valor crudo como etiqueta) si el enum es desconocido, para nunca
    romper el render. */
export function resolveStatus(kind, value) {
  const map = STATUS_MAPS[kind];
  return map?.[value] || { label: value ?? '—', ...TONE.gray };
}
