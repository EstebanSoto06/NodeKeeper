# NodeKeeper - Alcance MVP

## Incluido en el MVP

### Autenticación

- Login real.
- JWT.
- Contraseñas cifradas con bcrypt.
- Roles Administrador y Operador.
- Rutas protegidas.

### Usuarios

- Crear usuarios.
- Editar usuarios.
- Bloquear o activar usuarios.
- Asignar rol.

### Nodos

- CRUD de nodos.
- Estado operativo.
- Ubicación para mapa.
- Asociación con equipos.

### Equipos

- CRUD de equipos.
- Asociación obligatoria con nodo.
- Asociación opcional con proveedor de soporte.
- Si no tiene proveedor, debe mostrarse como "No asignado".

### Proveedores de soporte

Campos obligatorios:

1. Empresa.
2. Número de soporte.
3. Correo de soporte.
4. Persona de contacto.
5. Número de contacto.
6. Correo de contacto.

Reglas:

- Un proveedor puede estar asociado a muchos equipos.
- Un equipo puede tener cero o un proveedor.
- Si se elimina un proveedor, los equipos asociados quedan como "No asignado".
- Administrador puede gestionar proveedores.
- Operador solo puede consultar.

### Mantenimientos

- Preventivos asociados con nodos.
- Correctivos asociados con equipos.
- Estados de mantenimiento.
- Inicio, seguimiento y cierre.
- Registro de usuario, fecha y hora.

### Checklists

- Tareas asociadas a mantenimientos.
- Cálculo de avance.
- Un mantenimiento no puede cerrarse si su checklist no está completo.

### Plantillas de checklist (listas de tareas predefinidas)

Ampliación del alcance aprobada durante el desarrollo.

- Administración de listas de tareas reutilizables (crear, editar, ordenar, eliminar), exclusiva del Administrador.
- Aplicar una lista al crear un mantenimiento (opcional; por defecto "Sin lista de tareas").
- Aplicar una lista a un mantenimiento ya creado, desde su checklist.
- Las tareas se **copian**: no existe relación viva entre la plantilla y el mantenimiento. Editar o eliminar una lista no afecta a los mantenimientos que ya la aplicaron.

Fuera de esta ampliación: versionado de plantillas, plantillas por nodo/equipo/tipo, sincronización automática e importación/exportación.

### Evidencias

- Carga de archivos reales.
- Archivos permitidos: JPG, PNG, PDF y DOCX.
- Almacenamiento local en backend/uploads/evidences.
- Registro de metadata en base de datos.

### Mapa

- Visualización de nodos reales.
- Alertas cromáticas según estado operativo.

### Calendario

- Visualización de mantenimientos reales.

### Reportes básicos

- Filtros por nodo, estado y rango de fechas.
- Resumen de mantenimientos.

## Fuera del MVP

- Publicación en internet.
- Dockerización y despliegue contenerizado de la aplicación completa.
- App móvil nativa.
- Funcionamiento offline.
- Notificaciones por correo, SMS o WhatsApp.
- Integraciones con sistemas externos.
- Reportes avanzados en PDF.
- Tiempo real con WebSockets.
- Galería global de evidencias (las evidencias se gestionan dentro de cada mantenimiento).

> Sobre Docker: lo que queda fuera del MVP es **contenerizar y desplegar la aplicación completa**. El repositorio sí incluye un `docker-compose.local.yml` **opcional** que levanta únicamente PostgreSQL como herramienta de desarrollo; usarlo o instalar PostgreSQL directamente son alternativas igualmente válidas (ver [../LOCAL_SETUP.md](../LOCAL_SETUP.md)).
