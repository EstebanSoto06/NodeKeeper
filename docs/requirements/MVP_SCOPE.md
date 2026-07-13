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
- Docker.
- App móvil nativa.
- Funcionamiento offline.
- Notificaciones por correo, SMS o WhatsApp.
- Integraciones con sistemas externos.
- Reportes avanzados en PDF.
- Tiempo real con WebSockets.
