/* Formulario de mantenimiento (crear/editar), conectado a POST/PUT
   /maintenances. El backend exige exclusividad segun el tipo real
   (maintenance.service.js#prepareMaintenanceData):
   - PREVENTIVE requiere networkNodeId (equipmentId se envia null).
   - CORRECTIVE requiere equipmentId (networkNodeId se envia null).
   Solo existen los campos reales del schema: title, description, type,
   scheduledDate, networkNodeId, equipmentId. No hay prioridad, responsable,
   recurrencia ni ejecucion interna/terceros en el backend real.

   El Nodo se muestra SIEMPRE (para ambos tipos), no solo en preventivo: en
   correctivo funciona ademas como filtro del select de Equipo, para poder
   cambiar de nodo sin cerrar el modal. El payload sigue enviando
   equipmentId como referencia principal en correctivo (networkNodeId null),
   tal como lo exige el backend.

   La validacion de campos obligatorios (title, scheduledDate, networkNodeId,
   y equipmentId solo si es correctivo) se hace en frontend ANTES de llamar
   la API: el backend valida title via Zod (con errors[] por campo), pero
   scheduledDate es opcional en su schema y el chequeo de red/equipo
   (prepareMaintenanceData) lanza un 400 plano sin errors[] -- sin esta
   validacion previa, un select o fecha vacios solo mostraban un mensaje
   generico en ingles, nunca marcados en el campo. Ver utils/formValidation.js.

   LISTA DE TAREAS (solo al crear): el campo opcional "Lista de tareas" envia
   checklistTemplateId en el POST. El backend crea la orden y COPIA las tareas
   de esa plantilla en UNA sola transaccion, asi que no puede quedar un
   mantenimiento a medio poblar. Sin seleccion ("Sin lista de tareas", el
   valor por defecto) el payload es identico al anterior a esta funcionalidad.
   Editar una orden NO ofrece el selector: aplicar una lista a un checklist ya
   existente se hace desde su detalle (ver ApplyTemplateDialog).

   PROGRAMACION RECURRENTE (solo al crear): el backend no tiene campo de
   recurrencia, asi que la opcion "serie recurrente" NO crea una entidad
   nueva: calcula N fechas (utils/recurrence.js) y hace N POST /maintenances
   normales, produciendo N ordenes INDEPENDIENTES. La UI lo dice de forma
   explicita. Las creaciones son secuenciales para poder informar con
   exactitud cuantas se alcanzaron a crear si una falla a mitad de camino. */
import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { validateRequired } from '../utils/formValidation.js';
import {
  RECURRENCE_OPTIONS,
  MAX_RECURRENCE_COUNT,
  MIN_RECURRENCE_COUNT,
  buildRecurrenceDates,
  buildSeriesTitle,
} from '../utils/recurrence.js';
import { showToast } from '../store/store.js';
import * as maintenanceService from '../services/maintenanceService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as equipmentService from '../services/equipmentService.js';
import * as checklistTemplateService from '../services/checklistTemplateService.js';

const TYPE_OPTIONS = [
  { value: 'PREVENTIVE', label: 'Preventivo' },
  { value: 'CORRECTIVE', label: 'Correctivo' },
];

const COUNT_OPTIONS = Array.from(
  { length: MAX_RECURRENCE_COUNT - MIN_RECURRENCE_COUNT + 1 },
  (_, i) => {
    const n = MIN_RECURRENCE_COUNT + i;
    return { value: String(n), label: `${n} órdenes` };
  },
);

/* Crea la serie orden por orden. Devuelve cuantas se crearon y el error que
   detuvo el proceso (si lo hubo), en vez de lanzar: las ordenes ya creadas
   son reales y persisten en el backend, asi que el llamador debe poder
   informarlas aunque la serie no se complete. */
async function createSeries(basePayload, dates, onProgress) {
  let created = 0;

  for (let i = 0; i < dates.length; i += 1) {
    onProgress(i);
    try {
      // eslint-disable-next-line no-await-in-loop
      await maintenanceService.create({
        ...basePayload,
        title: buildSeriesTitle(basePayload.title, i, dates.length),
        scheduledDate: dates[i],
      });
      created += 1;
    } catch (error) {
      return { created, error };
    }
  }

  return { created, error: null };
}

function emptyForm() {
  return { title: '', description: '', type: 'PREVENTIVE', scheduledDate: '', networkNodeId: '', equipmentId: '' };
}

function toDateInputValue(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}

export function MaintenanceFormModal({ maintenance, onClose, onSaved }) {
  const editing = !!maintenance;

  const { data: nodesData, loading: nodesLoading } = useAsync(() => networkNodeService.list(), []);
  const { data: equipData, loading: equipLoading } = useAsync(() => equipmentService.list(), []);
  // Las plantillas solo se cargan al CREAR: en edicion no se ofrecen (aplicar
  // una lista a una orden existente se hace desde su checklist). El error se
  // ignora a proposito -- si GET /checklist-templates falla, el selector se
  // degrada a "Sin lista de tareas" y el formulario sigue siendo utilizable;
  // la creacion de mantenimientos nunca debe quedar bloqueada por esto.
  const { data: templatesData, loading: templatesLoading } = useAsync(
    () => (editing ? Promise.resolve(null) : checklistTemplateService.list()),
    [editing],
  );
  const nodes = nodesData?.networkNodes ?? [];
  const equipmentList = equipData?.equipment ?? [];
  const templates = templatesData?.checklistTemplates ?? [];
  const optionsLoading = nodesLoading || equipLoading || templatesLoading;

  const [v, setV] = useState(() =>
    maintenance
      ? {
          title: maintenance.title,
          description: maintenance.description || '',
          type: maintenance.type,
          scheduledDate: toDateInputValue(maintenance.scheduledDate),
          // Preventivo: el nodo es el propio maintenance.networkNodeId.
          // Correctivo: el backend no guarda networkNodeId (viaja null); se
          // deriva del equipo incluido en la respuesta (maintenance.equipment
          // .networkNodeId). Si por algun motivo no vino incluido, el efecto
          // de abajo lo busca en equipmentList una vez cargue.
          networkNodeId: maintenance.type === 'PREVENTIVE'
            ? (maintenance.networkNodeId || '')
            : (maintenance.equipment?.networkNodeId || ''),
          equipmentId: maintenance.equipmentId || '',
        }
      : emptyForm(),
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  // Lista de tareas: solo al crear. '' = "Sin lista de tareas" (por defecto),
  // que reproduce EXACTAMENTE el comportamiento anterior a esta funcionalidad
  // (el payload no lleva checklistTemplateId y la orden nace sin tareas).
  const [checklistTemplateId, setChecklistTemplateId] = useState('');
  const selectedTemplate = templates.find((t) => t.id === checklistTemplateId) ?? null;

  // Serie recurrente: solo disponible al crear (editar afecta a UNA orden).
  const [isSeries, setIsSeries] = useState(false);
  const [frequency, setFrequency] = useState(RECURRENCE_OPTIONS[0].value);
  const [seriesCount, setSeriesCount] = useState(String(MIN_RECURRENCE_COUNT + 1));
  const [seriesProgress, setSeriesProgress] = useState(0);

  const seriesEnabled = !editing && isSeries;
  const seriesDates = seriesEnabled ? buildRecurrenceDates(v.scheduledDate, frequency, Number(seriesCount)) : [];

  // Respaldo de la derivacion de networkNodeId en edicion correctiva: solo
  // actua si maintenance.equipment no vino incluido (no deberia pasar dado
  // el include real del backend, pero se cubre por robustez).
  useEffect(() => {
    if (!editing || maintenance.type !== 'CORRECTIVE' || v.networkNodeId) return;
    const eq = equipmentList.find((e) => e.id === maintenance.equipmentId);
    if (eq?.networkNodeId) setV((s) => ({ ...s, networkNodeId: eq.networkNodeId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentList.length]);

  // Cambiar el nodo limpia el equipo seleccionado (podria no pertenecer al
  // nodo nuevo) y recalcula la lista filtrada de abajo.
  function handleNodeChange(nodeId) {
    setV((s) => ({ ...s, networkNodeId: nodeId, equipmentId: '' }));
  }

  const equipmentForNode = v.networkNodeId ? equipmentList.filter((e) => e.networkNodeId === v.networkNodeId) : [];

  const submit = async () => {
    const required = [
      { key: 'title', label: 'Título', value: v.title },
      { key: 'scheduledDate', label: 'Fecha programada', value: v.scheduledDate },
      { key: 'networkNodeId', label: 'Nodo', value: v.networkNodeId },
      ...(v.type === 'CORRECTIVE' ? [{ key: 'equipmentId', label: 'Equipo', value: v.equipmentId }] : []),
    ];
    const { isValid, fieldErrors: missingErrors, formError: missingError } = validateRequired(required);
    if (!isValid) {
      setFieldErrors(missingErrors);
      setFormError(missingError);
      return;
    }

    if (seriesEnabled && seriesDates.length === 0) {
      setFieldErrors({ scheduledDate: 'Fecha no válida para calcular la serie.' });
      setFormError('No se pudieron calcular las fechas de la serie.');
      return;
    }

    setSaving(true);
    setFormError('');
    setFieldErrors({});
    setSeriesProgress(0);
    try {
      const payload = {
        title: v.title,
        description: v.description ? v.description : null,
        type: v.type,
        scheduledDate: v.scheduledDate,
        networkNodeId: v.type === 'PREVENTIVE' ? v.networkNodeId : null,
        equipmentId: v.type === 'CORRECTIVE' ? v.equipmentId : null,
        // Solo se incluye si el usuario eligio una lista: sin seleccion el
        // payload es identico al de antes de esta funcionalidad. El backend
        // lo acepta unicamente en POST (createMaintenanceSchema), nunca en
        // PUT, y crea la orden + copia las tareas en UNA transaccion.
        ...(!editing && checklistTemplateId ? { checklistTemplateId } : {}),
      };
      if (editing) {
        await maintenanceService.update(maintenance.id, payload);
      } else if (seriesEnabled) {
        const { created, error } = await createSeries(payload, seriesDates, setSeriesProgress);
        if (error) {
          // Las ordenes ya creadas son reales: se recarga la vista para que se
          // vean, y el modal permanece abierto con el detalle de lo ocurrido.
          if (created > 0) onSaved && onSaved();
          setFormError(
            created === 0
              ? (error.message || 'No se pudo crear la serie de mantenimientos.')
              : `Se crearon ${created} de ${seriesDates.length} órdenes y se conservan. La orden ${created + 1} falló: ${error.message || 'error desconocido'}.`,
          );
          return;
        }
        showToast(`Se crearon ${created} órdenes de mantenimiento independientes.`);
      } else {
        await maintenanceService.create(payload);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
      } else {
        setFormError(err.message || 'No se pudo guardar el mantenimiento.');
      }
    } finally {
      setSaving(false);
    }
  };

  const nodeOptions = nodes.map((n) => ({ value: n.id, label: `${n.name} (${n.code})` }));
  const equipmentOptions = equipmentForNode.map((e) => ({ value: e.id, label: e.name }));

  return (
    <Modal
      title={editing ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}
      subtitle={editing ? maintenance.title : 'Registra una orden de mantenimiento'}
      icon="wrench" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving || optionsLoading}>
            {saving && seriesEnabled
              ? `Creando ${Math.min(seriesProgress + 1, seriesDates.length)} de ${seriesDates.length}…`
              : saving ? 'Guardando…' : seriesEnabled ? `Crear ${seriesDates.length || seriesCount} órdenes` : 'Guardar mantenimiento'}
          </Button>
        </>
      )}
    >
      {formError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <span>{formError}</span>
        </div>
      )}
      {optionsLoading ? (
        <LoadingSkeleton lines={4} />
      ) : (
        <div className="nk-form-grid">
          <div className="nk-col-2">
            <Field label="Título" required error={fieldErrors.title}>
              <TextInput value={v.title} onChange={set('title')} placeholder="Mantenimiento preventivo trimestral" error={fieldErrors.title} />
            </Field>
          </div>
          <Field label="Tipo" required error={fieldErrors.type}>
            <Select value={v.type} onChange={set('type')} options={TYPE_OPTIONS} />
          </Field>
          <Field label="Fecha programada" required error={fieldErrors.scheduledDate}>
            <TextInput type="date" value={v.scheduledDate} onChange={set('scheduledDate')} error={fieldErrors.scheduledDate} />
          </Field>
          <div className="nk-col-2">
            <Field label="Nodo" required error={fieldErrors.networkNodeId}>
              <Select
                value={v.networkNodeId}
                onChange={handleNodeChange}
                error={fieldErrors.networkNodeId}
                options={[{ value: '', label: 'Selecciona un nodo…' }, ...nodeOptions]}
              />
            </Field>
          </div>
          {v.type === 'CORRECTIVE' && (
            <div className="nk-col-2">
              <Field label="Equipo" required error={fieldErrors.equipmentId}>
                <Select
                  value={v.equipmentId}
                  onChange={set('equipmentId')}
                  disabled={!v.networkNodeId}
                  error={fieldErrors.equipmentId}
                  options={[
                    { value: '', label: v.networkNodeId ? 'Selecciona un equipo…' : 'Primero selecciona un nodo…' },
                    ...equipmentOptions,
                  ]}
                />
                {v.networkNodeId && equipmentForNode.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'block' }}>
                    Este nodo no tiene equipos registrados.
                  </span>
                )}
              </Field>
            </div>
          )}
          <div className="nk-col-2">
            <Field label="Descripción" error={fieldErrors.description}>
              <TextInput value={v.description} onChange={set('description')} placeholder="Opcional" error={fieldErrors.description} />
            </Field>
          </div>

          {!editing && (
            <div className="nk-col-2">
              <Field label="Lista de tareas" error={fieldErrors.checklistTemplateId}>
                <Select
                  value={checklistTemplateId}
                  onChange={setChecklistTemplateId}
                  error={fieldErrors.checklistTemplateId}
                  options={[
                    { value: '', label: 'Sin lista de tareas' },
                    ...templates.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.items?.length ?? 0} ${(t.items?.length ?? 0) === 1 ? 'tarea' : 'tareas'})`,
                    })),
                  ]}
                />
                {selectedTemplate && (
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'block' }}>
                    Se copiarán {selectedTemplate.items?.length ?? 0} tareas al checklist.
                    Editar la lista después no cambiará este mantenimiento.
                  </span>
                )}
              </Field>
            </div>
          )}

          {!editing && (
            <div className="nk-col-2 nk-series">
              <label className="nk-check-inline">
                <input
                  type="checkbox"
                  checked={isSeries}
                  disabled={saving}
                  onChange={(e) => setIsSeries(e.target.checked)}
                />
                Programar como serie recurrente
              </label>

              {isSeries && (
                <div className="nk-series-body">
                  <div className="nk-form-grid">
                    <Field label="Frecuencia">
                      <Select value={frequency} onChange={setFrequency} options={RECURRENCE_OPTIONS} />
                    </Field>
                    <Field label="Cantidad">
                      <Select value={seriesCount} onChange={setSeriesCount} options={COUNT_OPTIONS} />
                    </Field>
                  </div>

                  <div className="nk-callout" style={{ marginTop: 12 }}>
                    <span>
                      Se crearán <b className="nk-mono">{seriesDates.length || seriesCount}</b> órdenes
                      {' '}<b>independientes</b>, numeradas «1/{seriesCount}», «2/{seriesCount}»…
                      El sistema no guarda la recurrencia: cada orden se edita, inicia y cierra por separado.
                      {selectedTemplate && ' Cada orden recibe su propia copia de la lista de tareas.'}
                    </span>
                  </div>

                  {seriesDates.length > 0 ? (
                    <div className="nk-series-dates nk-mono">
                      {seriesDates.map((d, i) => (
                        <span key={d} className="nk-series-date">{i + 1}. {d}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="nk-series-hint">Selecciona una fecha programada válida para calcular las fechas de la serie.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
