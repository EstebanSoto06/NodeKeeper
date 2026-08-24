import { describe, expect, it } from 'vitest';
import {
  normalizeTaskText,
  findDuplicateItemIndexes,
  findOverlappingDescriptions,
} from './checklistTemplates.js';

describe('normalizeTaskText', () => {
  it('aplica trim, minusculas y colapsa espacios', () => {
    expect(normalizeTaskText('   Revisar    BATERÍAS   ')).toBe('revisar baterías');
  });

  it('NO elimina acentos: son palabras distintas en español', () => {
    expect(normalizeTaskText('Revisión')).not.toBe(normalizeTaskText('Revision'));
  });

  it('tolera null y undefined', () => {
    expect(normalizeTaskText(null)).toBe('');
    expect(normalizeTaskText(undefined)).toBe('');
  });
});

describe('findDuplicateItemIndexes', () => {
  it('marca el segundo elemento que repite un texto ya presente', () => {
    const indexes = findDuplicateItemIndexes([
      { description: 'Revisar baterías' },
      { description: 'Limpiar equipo' },
      { description: '  revisar   BATERÍAS ' },
    ]);

    expect(indexes).toEqual([2]);
  });

  it('marca todas las repeticiones posteriores, no solo la primera', () => {
    const indexes = findDuplicateItemIndexes([
      { description: 'A' },
      { description: 'A' },
      { description: 'A' },
    ]);

    expect(indexes).toEqual([1, 2]);
  });

  it('ignora los campos vacios: aun no son un duplicado', () => {
    const indexes = findDuplicateItemIndexes([
      { description: '' },
      { description: '   ' },
      { description: 'Real' },
    ]);

    expect(indexes).toEqual([]);
  });

  it('devuelve vacio cuando no hay repeticiones', () => {
    expect(
      findDuplicateItemIndexes([{ description: 'A' }, { description: 'B' }]),
    ).toEqual([]);
  });
});

describe('findOverlappingDescriptions', () => {
  it('devuelve los textos de la plantilla que ya existen en el checklist', () => {
    const overlapping = findOverlappingDescriptions(
      [{ description: 'Limpiar equipo' }, { description: 'Otra' }],
      [{ description: '  LIMPIAR   equipo ' }, { description: 'Nueva' }],
    );

    expect(overlapping).toEqual(['  LIMPIAR   equipo ']);
  });

  it('devuelve vacio si el checklist esta vacio', () => {
    expect(findOverlappingDescriptions([], [{ description: 'A' }])).toEqual([]);
  });

  it('tolera argumentos ausentes', () => {
    expect(findOverlappingDescriptions(undefined, undefined)).toEqual([]);
  });
});
