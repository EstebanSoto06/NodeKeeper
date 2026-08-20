/* Calculo de fechas para programar una SERIE de mantenimientos.

   IMPORTANTE (limitacion real, no simulada): el backend NO tiene ningun campo
   de recurrencia (ver backend/prisma/schema.prisma#Maintenance: title,
   description, type, status, scheduledDate, networkNodeId, equipmentId...).
   Por eso una "serie recurrente" aqui NO es una entidad nueva: es unicamente
   una ayuda del formulario que calcula N fechas y crea N ordenes normales e
   INDEPENDIENTES via POST /maintenances. Una vez creadas, no queda ningun
   vinculo entre ellas: editar o eliminar una no afecta a las demas.

   Todo el calculo se hace sobre los componentes (year, month, day) de una
   fecha "YYYY-MM-DD" y nunca sobre Date en UTC, para que un mantenimiento
   programado el dia 1 no se corra al dia anterior por la zona horaria. */

export const MAX_RECURRENCE_COUNT = 12;
export const MIN_RECURRENCE_COUNT = 2;

/** Frecuencias ofrecidas. `days` y `months` son excluyentes entre si. */
export const RECURRENCE_OPTIONS = [
  { value: 'WEEKLY', label: 'Cada semana', days: 7 },
  { value: 'BIWEEKLY', label: 'Cada 2 semanas', days: 14 },
  { value: 'MONTHLY', label: 'Cada mes', months: 1 },
  { value: 'QUARTERLY', label: 'Cada 3 meses', months: 3 },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Dias que tiene un mes concreto (month en base 1). */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** "2026-03-01T00:00:00.000Z" o "2026-03-01" -> { year, month, day } | null */
function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').slice(0, 10));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Rechaza fechas imposibles ("2026-02-31") en vez de dejarlas desbordar.
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

function formatDateOnly({ year, month, day }) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays({ year, month, day }, amount) {
  const d = new Date(year, month - 1, day + amount);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** Suma meses conservando el dia cuando existe. El 31 de enero + 1 mes cae en
    el 28/29 de febrero (el ultimo dia real), nunca en el 2 o 3 de marzo. */
function addMonths({ year, month, day }, amount) {
  const totalMonths = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return { year: nextYear, month: nextMonth, day: Math.min(day, daysInMonth(nextYear, nextMonth)) };
}

/**
 * Genera las fechas de una serie: la primera es siempre `startDate` y cada
 * siguiente aplica el paso de la frecuencia N veces sobre la fecha ORIGINAL.
 *
 * El paso se calcula desde el inicio y no encadenando sobre la fecha anterior
 * a proposito: encadenando, una serie mensual que arranca el 31 de enero se
 * ajustaria al 28 de febrero y a partir de ahi arrastraria ese dia (28 de
 * marzo, 28 de abril...), corriendo toda la programacion. Desde el origen,
 * cada fecha vuelve al dia 31 cuando el mes lo permite.
 *
 * @param {string} startDate fecha inicial ("YYYY-MM-DD" o ISO completo)
 * @param {string} frequency valor de RECURRENCE_OPTIONS
 * @param {number} count cantidad total de ordenes (incluida la primera)
 * @returns {string[]} fechas "YYYY-MM-DD"; [] si los argumentos no son validos
 */
export function buildRecurrenceDates(startDate, frequency, count) {
  const start = parseDateOnly(startDate);
  const option = RECURRENCE_OPTIONS.find((o) => o.value === frequency);
  const total = Number(count);

  if (!start || !option) return [];
  if (!Number.isInteger(total) || total < 1 || total > MAX_RECURRENCE_COUNT) return [];

  return Array.from({ length: total }, (_, i) => {
    const next = option.days ? addDays(start, option.days * i) : addMonths(start, option.months * i);
    return formatDateOnly(next);
  });
}

/**
 * Titulo de cada orden de la serie. Se numera "(2/6)" porque las ordenes son
 * independientes y sin el sufijo quedarian N filas identicas en la lista de
 * Mantenimientos, imposibles de distinguir salvo por la fecha.
 */
export function buildSeriesTitle(title, index, total) {
  return `${title} (${index + 1}/${total})`;
}
