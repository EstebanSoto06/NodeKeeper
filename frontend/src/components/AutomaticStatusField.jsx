/* Campo "Estado" de un recurso (nodo o equipo) que esta bajo el estado
   AUTOMATICO: MAINTENANCE, escrito por el backend al iniciar un mantenimiento
   y retirado al completarlo (ver backend maintenance.service.js).

   No es un Select porque no hay nada que elegir: MAINTENANCE no es asignable
   a mano, y AVAILABLE/OPERATIONAL estan prohibidos mientras la orden siga en
   ejecucion (PUT /network-nodes/:id y PUT /equipment/:id responden 409). La
   UNICA transicion manual admitida en ese momento es OUT_OF_SERVICE, que
   tiene prioridad sobre MAINTENANCE y que el backend si acepta: por eso se
   ofrece como una accion explicita en lugar de como una opcion mas de una
   lista.

   La accion no escribe por su cuenta: marca la intencion y el formulario la
   envia en su unico PUT al guardar, junto con el resto de campos editados.
   Asi el modal conserva un solo camino de escritura y un solo manejo de
   errores. Es reversible mientras no se guarde.

   Se usa un <div className="nk-field"> y no el componente Field porque este
   ultimo renderiza un <label>, y un boton dentro de un label tiene
   comportamiento de activacion ambiguo. Las clases son las mismas, asi que
   el campo se ve identico al resto del formulario. */
import { Button } from './Button.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const HINT_STYLE = {
  fontSize: 11,
  color: 'var(--fg-3)',
  marginTop: 2,
  display: 'block',
};

const ROW_STYLE = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };

/**
 * @param {object} props
 * @param {'node'|'equipment'} props.kind dominio del enum, para StatusBadge.
 * @param {string} props.resourceLabel "el nodo" / "el equipo", para los textos.
 * @param {boolean} props.markedOutOfService intencion pendiente de guardado.
 * @param {(next: boolean) => void} props.onToggle alterna esa intencion.
 */
export function AutomaticStatusField({ kind, resourceLabel, markedOutOfService, onToggle }) {
  return (
    <div className="nk-field">
      <span className="nk-field-label">Estado</span>

      {markedOutOfService ? (
        <>
          <div style={ROW_STYLE}>
            <StatusBadge kind={kind} value="OUT_OF_SERVICE" />
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>(se aplicará al guardar)</span>
          </div>
          <div style={ROW_STYLE}>
            <Button variant="ghost" size="sm" icon="repeat" onClick={() => onToggle(false)}>
              Mantener estado automático
            </Button>
          </div>
          <span style={HINT_STYLE}>
            Fuera de servicio tiene prioridad: completar el mantenimiento no lo revertirá.
          </span>
        </>
      ) : (
        <>
          <div style={ROW_STYLE}>
            <StatusBadge kind={kind} value="MAINTENANCE" />
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>(Automático)</span>
          </div>
          <div style={ROW_STYLE}>
            <Button variant="ghost" size="sm" icon="alert-circle" onClick={() => onToggle(true)}>
              Marcar fuera de servicio
            </Button>
          </div>
          <span style={HINT_STYLE}>
            {`Estado automático: ${resourceLabel} tiene un mantenimiento en ejecución. Se libera al completarlo.`}
          </span>
        </>
      )}
    </div>
  );
}
