/* Formulario de equipo (crear / editar) — modal liquid glass.
   Incluye el selector "Proveedor de soporte" (opcional): solo permite elegir
   entre proveedores ya registrados, con la opción "No asignado". No incluye
   creación rápida de proveedores ni campos de contacto del proveedor.
   La edición de equipo es mock: solo se persiste la asignación de proveedor
   (el resto del inventario es de solo demostración). */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Field, TextInput, Select } from './Inputs.jsx';
import { DATA } from '../data/mockData.js';
import { useStore, setEquipmentProvider, providerOfEquipment, showToast } from '../store/store.js';

export function EquipmentFormModal({ equipment, onClose }) {
  const editing = !!equipment;
  useStore();
  const current = editing ? (providerOfEquipment(equipment.id)?.id || '') : '';
  const { providers } = useStore();

  const [name, setName] = useState(equipment?.name || '');
  const [type, setType] = useState(equipment?.type || 'Red');
  const [nodeId, setNodeId] = useState(equipment?.nodeId || DATA.nodes[0].id);
  const [providerId, setProviderId] = useState(current);

  const providerOptions = [
    { value: '', label: 'No asignado' },
    ...providers.map((p) => ({ value: p.id, label: p.companyName })),
  ];

  const submit = () => {
    if (editing) {
      setEquipmentProvider(equipment.id, providerId || null);
      showToast('Equipo actualizado correctamente.');
    } else {
      // Crear equipo es mock: en este prototipo no se agrega al inventario.
      showToast('Equipo registrado (demostración).');
    }
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Editar equipo' : 'Registrar equipo'}
      subtitle={editing ? equipment.code : 'Nuevo equipo en un nodo'}
      icon="server" size="md" onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit}>Guardar equipo</Button>
        </>
      )}
    >
      <div className="nk-form-grid">
        <div className="nk-col-2">
          <Field label="Nombre del equipo">
            <TextInput value={name} onChange={setName} placeholder="Switch core" />
          </Field>
        </div>
        <Field label="Tipo">
          <Select value={type} onChange={setType} options={['Red', 'Energía', 'Clima', 'Estructura'].map((t) => ({ value: t, label: t }))} />
        </Field>
        <Field label="Nodo">
          <Select value={nodeId} onChange={setNodeId} options={DATA.nodes.map((n) => ({ value: n.id, label: n.name }))} />
        </Field>
        <div className="nk-col-2">
          <Field label="Proveedor de soporte">
            <Select value={providerId} onChange={setProviderId} options={providerOptions} />
            <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Opcional. Solo proveedores ya registrados.</span>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
