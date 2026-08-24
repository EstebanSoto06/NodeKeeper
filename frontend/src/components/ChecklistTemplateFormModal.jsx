/* Formulario de plantilla de checklist (crear/editar), conectado a POST/PUT
   /checklist-templates. Solo ADMIN: el backend rechaza con 403 a cualquier
   otro rol en las cinco rutas del módulo.

   El PUT es DECLARATIVO: el array de tareas que se envía es el estado final
   de la plantilla, no un diff. Por eso el editor de abajo trabaja sobre una
   copia local y solo al guardar se manda la lista completa.

   Reglas que el backend impone y este formulario refleja ANTES de enviar
   (checklist-template.schema.js):
   - nombre obligatorio, con trim, no vacío y único sin distinguir
     mayúsculas de minúsculas (el 409 de unicidad solo lo puede dar el
     servidor, que es quien ve las demás plantillas);
   - mínimo una tarea; no se puede guardar una plantilla vacía;
   - cada tarea con texto obligatorio y no vacío;
   - dentro de UNA misma plantilla no puede haber dos tareas con el mismo
     texto tras normalizar (minúsculas + espacios colapsados). Los acentos SÍ
     distinguen: «revisión» y «revision» son tareas diferentes.

   El orden de las tareas se deriva del orden del array (el backend calcula
   sortOrder por índice), así que reordenar aquí es mover elementos en la
   lista local. */
import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Button, IconButton } from './Button.jsx';
import { Field, TextInput } from './Inputs.jsx';
import { Icon } from './Icon.jsx';
import { validateRequired } from '../utils/formValidation.js';
import { findDuplicateItemIndexes } from '../utils/checklistTemplates.js';
import * as checklistTemplateService from '../services/checklistTemplateService.js';
import { showToast } from '../store/store.js';

const MAX_ITEMS = 50;

function fieldErrorsFrom(err) {
  const out = {};
  (err?.errors || []).forEach((e) => {
    if (e.path) out[e.path] = e.message;
  });
  return out;
}

export function ChecklistTemplateFormModal({ template, onClose, onSaved }) {
  const editing = !!template;

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [items, setItems] = useState(() =>
    template?.items?.length
      ? template.items.map((item) => item.description)
      : [''],
  );

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const duplicateIndexes = findDuplicateItemIndexes(
    items.map((description) => ({ description })),
  );

  const setItemAt = (index, value) =>
    setItems((current) => current.map((item, i) => (i === index ? value : item)));

  const addItem = () => setItems((current) => [...current, '']);

  const removeItemAt = (index) =>
    setItems((current) => current.filter((_, i) => i !== index));

  // Reordenar = mover el elemento en el array local; el backend derivará el
  // sortOrder del índice al guardar.
  const moveItem = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;

    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedItems = items.map((item) => item.trim()).filter((item) => item !== '');

    const { isValid, fieldErrors: missingErrors, formError: missingError } =
      validateRequired([{ key: 'name', label: 'Nombre', value: trimmedName }]);

    if (!isValid) {
      setFieldErrors(missingErrors);
      setFormError(missingError);
      return;
    }

    if (trimmedItems.length === 0) {
      setFieldErrors({});
      setFormError('La lista debe tener al menos una tarea.');
      return;
    }

    if (duplicateIndexes.length > 0) {
      setFieldErrors({});
      setFormError('Hay tareas repetidas en la lista. Cada tarea debe ser distinta.');
      return;
    }

    setSaving(true);
    setFormError('');
    setFieldErrors({});

    try {
      const payload = {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        items: trimmedItems.map((item) => ({ description: item })),
      };

      if (editing) {
        await checklistTemplateService.update(template.id, payload);
        showToast('Lista de tareas actualizada correctamente.');
      } else {
        await checklistTemplateService.create(payload);
        showToast('Lista de tareas creada correctamente.');
      }

      onSaved && onSaved();
      onClose();
    } catch (err) {
      if (err.status === 400) {
        setFieldErrors(fieldErrorsFrom(err));
        setFormError('Revisa los datos de la lista.');
      } else {
        // El 409 de nombre duplicado llega por aquí: solo el servidor puede
        // saber que otra plantilla ya usa ese nombre.
        setFormError(err.message || 'No se pudo guardar la lista de tareas.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar lista de tareas' : 'Nueva lista de tareas'}
      subtitle={editing ? template.name : 'Define una lista reutilizable de tareas'}
      icon="list"
      size="md"
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar lista'}
          </Button>
        </>
      )}
    >
      {formError && (
        <div className="nk-callout" role="alert" style={{ marginBottom: 12 }}>
          <Icon name="alert-circle" size={15} /><span>{formError}</span>
        </div>
      )}

      <div className="nk-form-grid">
        <div className="nk-col-2">
          <Field label="Nombre" required error={fieldErrors.name}>
            <TextInput
              value={name}
              onChange={setName}
              placeholder="Mantenimiento preventivo UPS"
              error={fieldErrors.name}
            />
          </Field>
        </div>
        <div className="nk-col-2">
          <Field label="Descripción" error={fieldErrors.description}>
            <TextInput
              value={description}
              onChange={setDescription}
              placeholder="Opcional"
              error={fieldErrors.description}
            />
          </Field>
        </div>

        <div className="nk-col-2">
          <span className="nk-field-label" style={{ display: 'block', marginBottom: 8 }}>
            Tareas <span style={{ color: 'var(--red-600)' }}>*</span>
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, index) => {
              const isDuplicate = duplicateIndexes.includes(index);
              const backendError = fieldErrors[`items.${index}.description`];
              const error = backendError || (isDuplicate ? 'Esta tarea ya está en la lista.' : '');

              return (
                <div key={index}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span
                      className="nk-mono"
                      style={{ fontSize: 12, color: 'var(--fg-3)', width: 20, textAlign: 'right' }}
                    >
                      {index + 1}.
                    </span>
                    <div style={{ flex: 1 }}>
                      <TextInput
                        value={item}
                        onChange={(value) => setItemAt(index, value)}
                        placeholder="Descripción de la tarea"
                        error={error}
                      />
                    </div>
                    <IconButton
                      name="chevron-up"
                      title="Subir"
                      onClick={() => moveItem(index, -1)}
                      style={{ width: 28, height: 28, opacity: index === 0 ? 0.35 : 1 }}
                    />
                    <IconButton
                      name="chevron-down"
                      title="Bajar"
                      onClick={() => moveItem(index, 1)}
                      style={{ width: 28, height: 28, opacity: index === items.length - 1 ? 0.35 : 1 }}
                    />
                    <IconButton
                      name="trash-2"
                      title="Eliminar tarea"
                      onClick={() => removeItemAt(index)}
                      style={{ width: 28, height: 28, opacity: items.length === 1 ? 0.35 : 1 }}
                    />
                  </div>
                  {error && (
                    <span className="nk-field-error" style={{ marginLeft: 26 }}>{error}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10 }}>
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={addItem}
              disabled={items.length >= MAX_ITEMS}
            >
              Agregar tarea
            </Button>
            {items.length >= MAX_ITEMS && (
              <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 10 }}>
                Máximo {MAX_ITEMS} tareas por lista.
              </span>
            )}
          </div>

          <div className="nk-callout" style={{ marginTop: 12 }}>
            <span>
              Al aplicar esta lista a un mantenimiento, sus tareas se <b>copian</b>.
              Editarla o eliminarla después <b>no</b> modifica los mantenimientos
              que ya la usaron.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
