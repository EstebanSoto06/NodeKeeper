/* Formulario de equipo (crear/editar), conectado a POST/PUT /equipment.
   Nodo obligatorio (select real desde /network-nodes); proveedor opcional
   (select real desde /support-providers, con "No asignado"). El serial
   duplicado devuelve 409, mostrado como error de campo en serialNumber. */
import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { AutomaticStatusField } from './AutomaticStatusField.jsx';
import { LoadingSkeleton } from './LoadingSkeleton.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { validateRequired, fieldErrorsFrom } from '../utils/formValidation.js';
import * as equipmentService from '../services/equipmentService.js';
import * as networkNodeService from '../services/networkNodeService.js';
import * as supportProviderService from '../services/supportProviderService.js';

/* "En mantenimiento" NO esta entre las opciones: es un estado AUTOMATICO que
   escribe el backend al iniciar un mantenimiento y retira al completarlo (ver
   maintenance.service.js). PUT /equipment/:id rechaza con 409 cualquier
   intento de asignarlo a mano. */
const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'OPERATIONAL', label: 'Operativo' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

const AUTOMATIC_STATUS = 'MAINTENANCE';

function emptyForm(defaultNodeId) {
  return {
    name: '',
    category: '',
    serialNumber: '',
    status: 'OPERATIONAL',
    networkNodeId: defaultNodeId || '',
    supportProviderId: '',
  };
}

export function EquipmentFormModal({ equipment, defaultNodeId, onClose, onSaved }) {
  const editing = !!equipment;
  // El equipo esta bajo el estado automatico: se muestra de solo lectura y el
  // formulario no lo toca (ver el payload y el campo Estado mas abajo).
  const underMaintenance = editing && equipment.status === AUTOMATIC_STATUS;
  // Unica transicion manual admitida durante una orden activa: OUT_OF_SERVICE
  // (ver AutomaticStatusField.jsx). Volver a OPERATIONAL lo rechaza el
  // backend con 409 mientras la orden siga en ejecucion.
  const [markOutOfService, setMarkOutOfService] = useState(false);

  const { data: nodesData, loading: nodesLoading } = useAsync(() => networkNodeService.list(), []);
  const { data: providersData, loading: providersLoading } = useAsync(() => supportProviderService.list(), []);
  const nodes = nodesData?.networkNodes ?? [];
  const providers = providersData?.supportProviders ?? [];
  const optionsLoading = nodesLoading || providersLoading;

  const [v, setV] = useState(() =>
    equipment
      ? {
          name: equipment.name,
          category: equipment.category,
          serialNumber: equipment.serialNumber || '',
          status: equipment.status,
          networkNodeId: equipment.networkNodeId,
          supportProviderId: equipment.supportProviderId || '',
        }
      : emptyForm(defaultNodeId),
  );

  // Si el nodo por defecto llega despues de que carguen los nodos (create sin
  // nodo preseleccionado), se ajusta el valor una vez a un nodo real valido.
  useEffect(() => {
    if (!editing && !v.networkNodeId && nodes.length > 0) {
      setV((s) => ({ ...s, networkNodeId: nodes[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  const submit = async () => {
    const { isValid, fieldErrors: missingErrors, formError: missingError } = validateRequired([
      { key: 'name', label: 'Nombre del equipo', value: v.name },
      { key: 'category', label: 'Categoría', value: v.category },
      { key: 'networkNodeId', label: 'Nodo', value: v.networkNodeId },
    ]);
    if (!isValid) {
      setFieldErrors(missingErrors);
      setFormError(missingError);
      return;
    }

    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      const payload = {
        name: v.name,
        category: v.category,
        serialNumber: v.serialNumber ? v.serialNumber : null,
        // Con el estado automatico activo el campo `status` NO viaja: el
        // backend lo conserva, y editar nombre, categoria o proveedor de un
        // equipo en mantenimiento sigue funcionando con normalidad. La
        // excepcion es "Marcar fuera de servicio", pedido explicitamente.
        ...(underMaintenance
          ? (markOutOfService ? { status: 'OUT_OF_SERVICE' } : {})
          : { status: v.status }),
        networkNodeId: v.networkNodeId,
        supportProviderId: v.supportProviderId || null,
      };
      if (editing) {
        await equipmentService.update(equipment.id, payload);
      } else {
        await equipmentService.create(payload);
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
      } else if (err.status === 409) {
        setFieldErrors({ serialNumber: err.message });
      } else {
        setFormError(err.message || 'No se pudo guardar el equipo.');
      }
    } finally {
      setSaving(false);
    }
  };

  const providerOptions = [
    { value: '', label: 'No asignado' },
    ...providers.map((p) => ({ value: p.id, label: p.companyName })),
  ];
  const nodeOptions = nodes.map((n) => ({ value: n.id, label: `${n.name} (${n.code})` }));

  return (
    <Modal
      title={editing ? 'Editar equipo' : 'Registrar equipo'}
      subtitle={editing ? equipment.name : 'Nuevo equipo en un nodo'}
      icon="server" size="md" onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving || optionsLoading}>
            {saving ? 'Guardando…' : 'Guardar equipo'}
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
            <Field label="Nombre del equipo" required error={fieldErrors.name}>
              <TextInput value={v.name} onChange={set('name')} placeholder="Switch core" error={fieldErrors.name} />
            </Field>
          </div>
          <Field label="Categoría" required error={fieldErrors.category}>
            <TextInput value={v.category} onChange={set('category')} placeholder="Red" error={fieldErrors.category} />
          </Field>
          <Field label="Número de serie" error={fieldErrors.serialNumber}>
            <TextInput value={v.serialNumber} onChange={set('serialNumber')} placeholder="Opcional" error={fieldErrors.serialNumber} />
          </Field>
          <Field label="Nodo" required error={fieldErrors.networkNodeId}>
            <Select value={v.networkNodeId} onChange={set('networkNodeId')} options={nodeOptions} error={fieldErrors.networkNodeId} />
          </Field>
          {underMaintenance ? (
            <AutomaticStatusField
              kind="equipment"
              resourceLabel="el equipo"
              markedOutOfService={markOutOfService}
              onToggle={setMarkOutOfService}
            />
          ) : (
            <Field label="Estado" error={fieldErrors.status}>
              <Select value={v.status} onChange={set('status')} options={EQUIPMENT_STATUS_OPTIONS} />
            </Field>
          )}
          <div className="nk-col-2">
            <Field label="Proveedor de soporte" error={fieldErrors.supportProviderId}>
              <Select value={v.supportProviderId} onChange={set('supportProviderId')} options={providerOptions} />
              <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'block' }}>Opcional. Solo proveedores ya registrados.</span>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
