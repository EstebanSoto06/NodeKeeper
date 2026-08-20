import { describe, expect, it } from 'vitest';
import {
  RECURRENCE_OPTIONS,
  MAX_RECURRENCE_COUNT,
  buildRecurrenceDates,
  buildSeriesTitle,
} from './recurrence.js';

describe('buildRecurrenceDates', () => {
  it('la primera fecha es siempre la fecha inicial', () => {
    expect(buildRecurrenceDates('2026-03-10', 'WEEKLY', 3)[0]).toBe('2026-03-10');
  });

  it('semanal y quincenal avanzan en dias, cruzando el cambio de mes', () => {
    expect(buildRecurrenceDates('2026-03-25', 'WEEKLY', 3)).toEqual(['2026-03-25', '2026-04-01', '2026-04-08']);
    expect(buildRecurrenceDates('2026-03-25', 'BIWEEKLY', 3)).toEqual(['2026-03-25', '2026-04-08', '2026-04-22']);
  });

  it('mensual y trimestral avanzan en meses, cruzando el cambio de año', () => {
    expect(buildRecurrenceDates('2026-11-15', 'MONTHLY', 3)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15']);
    expect(buildRecurrenceDates('2026-11-15', 'QUARTERLY', 3)).toEqual(['2026-11-15', '2027-02-15', '2027-05-15']);
  });

  it('mensual desde un dia 31 cae en el ultimo dia real del mes, sin desbordar', () => {
    // 31 de enero + 1 mes NO debe convertirse en el 2 o 3 de marzo.
    expect(buildRecurrenceDates('2026-01-31', 'MONTHLY', 4)).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });

  it('respeta el año bisiesto al ajustar el dia', () => {
    expect(buildRecurrenceDates('2028-01-31', 'MONTHLY', 2)).toEqual(['2028-01-31', '2028-02-29']);
  });

  it('acepta un ISO completo y devuelve solo la parte de fecha', () => {
    expect(buildRecurrenceDates('2026-03-10T00:00:00.000Z', 'WEEKLY', 2)).toEqual(['2026-03-10', '2026-03-17']);
  });

  it('devuelve una lista vacia ante entradas invalidas', () => {
    expect(buildRecurrenceDates('', 'WEEKLY', 3)).toEqual([]);
    expect(buildRecurrenceDates('fecha-invalida', 'WEEKLY', 3)).toEqual([]);
    expect(buildRecurrenceDates('2026-02-31', 'WEEKLY', 3)).toEqual([]);
    expect(buildRecurrenceDates('2026-03-10', 'CADA_LUNA_LLENA', 3)).toEqual([]);
    expect(buildRecurrenceDates('2026-03-10', 'WEEKLY', 0)).toEqual([]);
    expect(buildRecurrenceDates('2026-03-10', 'WEEKLY', MAX_RECURRENCE_COUNT + 1)).toEqual([]);
  });

  it('genera exactamente `count` fechas sin repetirlas', () => {
    const dates = buildRecurrenceDates('2026-03-10', 'MONTHLY', MAX_RECURRENCE_COUNT);
    expect(dates).toHaveLength(MAX_RECURRENCE_COUNT);
    expect(new Set(dates).size).toBe(MAX_RECURRENCE_COUNT);
  });

  it('todas las frecuencias ofrecidas producen fechas validas', () => {
    RECURRENCE_OPTIONS.forEach((option) => {
      const dates = buildRecurrenceDates('2026-03-10', option.value, 4);
      expect(dates).toHaveLength(4);
      dates.forEach((d) => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    });
  });
});

describe('buildSeriesTitle', () => {
  it('numera cada orden sobre el total, en base 1', () => {
    expect(buildSeriesTitle('Revisión trimestral', 0, 4)).toBe('Revisión trimestral (1/4)');
    expect(buildSeriesTitle('Revisión trimestral', 3, 4)).toBe('Revisión trimestral (4/4)');
  });
});
