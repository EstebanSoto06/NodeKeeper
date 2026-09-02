/* Reparto de los errores 409 entre "error de campo" y "error general".

   Es la regla que decide si un conflicto se pinta debajo de Codigo/Numero de
   serie o como callout del formulario. Se prueba aqui, aislada de los
   modales, porque el criterio tiene que ser CONSERVADOR: cualquier mensaje
   que no sea exactamente el de duplicidad conocida debe terminar visible como
   error general, nunca escondido bajo un campo que no le corresponde. */
import { describe, expect, it } from 'vitest';
import {
  conflictErrorsFrom,
  DUPLICATE_EQUIPMENT_SERIAL_MESSAGE,
  DUPLICATE_NODE_CODE_MESSAGE,
} from './formValidation.js';

const nodeOptions = {
  field: 'code',
  duplicateMessage: DUPLICATE_NODE_CODE_MESSAGE,
};

const equipmentOptions = {
  field: 'serialNumber',
  duplicateMessage: DUPLICATE_EQUIPMENT_SERIAL_MESSAGE,
};

describe('conflictErrorsFrom', () => {
  it('atribuye al campo el 409 de codigo de nodo duplicado', () => {
    const result = conflictErrorsFrom(
      { message: DUPLICATE_NODE_CODE_MESSAGE },
      nodeOptions,
    );

    expect(result.fieldErrors).toEqual({ code: DUPLICATE_NODE_CODE_MESSAGE });
    expect(result.formError).toBe('');
  });

  it('atribuye al campo el 409 de numero de serie duplicado', () => {
    const result = conflictErrorsFrom(
      { message: DUPLICATE_EQUIPMENT_SERIAL_MESSAGE },
      equipmentOptions,
    );

    expect(result.fieldErrors).toEqual({
      serialNumber: DUPLICATE_EQUIPMENT_SERIAL_MESSAGE,
    });
    expect(result.formError).toBe('');
  });

  // Mensajes REALES de backend/src/modules/{network-nodes,equipment} y de
  // runSerializableTransaction: ninguno pertenece a un campo del formulario.
  it.each([
    'El estado En mantenimiento lo asigna el sistema al iniciar un mantenimiento y no puede establecerse manualmente.',
    'No se puede marcar el nodo como Disponible mientras tiene un mantenimiento en ejecución.',
    'No se puede marcar el equipo como Operativo mientras tiene un mantenimiento en ejecución.',
    'No se puede cambiar el equipo de nodo mientras tiene un mantenimiento en ejecución.',
    'Concurrent modification detected, please retry',
  ])('manda al error general el conflicto de negocio: %s', (message) => {
    const nodeResult = conflictErrorsFrom({ message }, nodeOptions);
    const equipmentResult = conflictErrorsFrom({ message }, equipmentOptions);

    expect(nodeResult.fieldErrors).toEqual({});
    expect(nodeResult.formError).toBe(message);
    expect(equipmentResult.fieldErrors).toEqual({});
    expect(equipmentResult.formError).toBe(message);
  });

  it('un mensaje desconocido tambien va al error general, nunca a un campo', () => {
    // Si el backend agrega un 409 nuevo, el peor resultado posible debe ser
    // un mensaje generico visible, no uno atribuido al campo equivocado.
    const result = conflictErrorsFrom({ message: 'Regla futura no prevista' }, nodeOptions);

    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe('Regla futura no prevista');
  });

  it('sin mensaje utilizable devuelve un texto generico en el error general', () => {
    const result = conflictErrorsFrom({}, nodeOptions);

    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe(
      'No se pudo guardar por un conflicto con el estado actual del registro.',
    );
  });

  it('no confunde un mensaje que solo CONTIENE el de duplicidad', () => {
    // La comparacion es exacta, no una busqueda de subcadena.
    const result = conflictErrorsFrom(
      { message: `${DUPLICATE_NODE_CODE_MESSAGE} en otro nodo de la red` },
      nodeOptions,
    );

    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe(`${DUPLICATE_NODE_CODE_MESSAGE} en otro nodo de la red`);
  });
});
