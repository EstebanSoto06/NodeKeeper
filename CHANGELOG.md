# Changelog

Todos los cambios importantes de NodeKeeper se documentaran en este archivo.

## [No publicado]

### Agregado

- Plantillas de checklist (listas de tareas reutilizables): modelos `ChecklistTemplate` y `ChecklistTemplateItem`, migracion aditiva `add_checklist_templates`.
- API `/api/checklist-templates` (CRUD completo, ADMIN-only incluida la lectura).
- `POST /api/maintenances/:id/checklist-tasks/apply-template`: copia las tareas de una plantilla al checklist de un mantenimiento SCHEDULED, en una transaccion Serializable.
- Campo opcional `checklistTemplateId` en `POST /api/maintenances`: crea la orden y copia sus tareas en una sola transaccion.
- Pantalla de administracion "Plantillas de checklist" en `/plantillas` (ADMIN-only) y su enlace en la seccion Administracion del Sidebar.
- Selector "Lista de tareas" en el formulario de creacion de mantenimiento, con "Sin lista de tareas" por defecto.
- Opcion "Cargar lista predeterminada" en el checklist del detalle de mantenimiento, con vista previa y advertencia de nombres duplicados.
- Plantillas de ejemplo en el seed.

### Cambiado

- El boton "Agregar tarea" del checklist pasa a "Agregar tareas" y despliega dos opciones: tarea manual (sin cambios) y cargar lista predeterminada.
- `createMaintenance` pasa a ejecutarse dentro de una transaccion; `prepareMaintenanceData` recibe el cliente Prisma como primer argumento.

## [0.3.0] - 2026-07-12

### Agregado

- Estructura profesional del repositorio con carpetas frontend, backend y docs.
- Prototipo frontend aprobado dentro de frontend.
- Documentacion inicial del proyecto.
- Configuracion base de VS Code.
- Configuracion base de Claude Code.
- Archivo .gitignore raiz.
- Archivo .gitattributes.
- Carpeta local para evidencias en backend/uploads/evidences.
- Campo Correo de contacto en proveedores de soporte.

### Validado

- Frontend validado con npm.cmd ci.
- Frontend validado con npm.cmd run build.
- Proyecto listo para iniciar implementacion del backend.
