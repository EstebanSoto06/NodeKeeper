# Arquitectura de NodeKeeper

Ver también: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [architecture/TECH_STACK.md](architecture/TECH_STACK.md).

## Visión general

Cliente-servidor clásico. El frontend es una SPA que consume exclusivamente la API REST del backend mediante HTTP/JSON; nunca se conecta directamente a PostgreSQL. Toda regla de negocio crítica se valida en el backend, aunque el frontend también la refleje visualmente (ocultar botones no sustituye la validación del servidor).

```
Navegador ── SPA (React/Vite) ── fetch (VITE_API_URL) ──▶ API (Express) ── Prisma ──▶ PostgreSQL
                                                              │
                                                              └──▶ backend/uploads/evidences (archivos)
```

## Frontend

- React 18 + React Router (rutas reales bajo `/`, `/nodos/:id`, `/mantenimientos/:id`, etc.).
- Estado de sesión en `AuthContext` (token + usuario actual), persistido y recuperado vía `GET /auth/me`.
- `apiClient.js` centraliza el cliente HTTP: desempaqueta el envelope `{ success, data }`, normaliza errores como `ApiError` (status + mensaje + `errors[]` de validación), añade el token `Authorization: Bearer`, y escucha un evento global de 401 para forzar logout.
- Un servicio por módulo (`services/*Service.js`) mapea uno a uno con los grupos de endpoints del backend.
- Componentes de página aplican permisos de UI mediante `usePermissions` (rol + estado del recurso), pero la fuente de verdad de autorización es siempre el backend.

## Backend

- Express, organizado por módulos bajo `src/modules/<módulo>/` (routes → controller → service), más `src/middlewares/` (auth, upload, manejo de errores) y `src/utils/`.
- Prisma como ORM y única vía de acceso a PostgreSQL; el esquema vive en `backend/prisma/schema.prisma`.
- Envelope de respuesta consistente: `{ success: true, data: ... }` en éxito, `{ success: false, message, errors? }` en error (ver [API.md](API.md)).

## Base de datos

PostgreSQL. Entidades principales: `User`, `SupportProvider`, `NetworkNode`, `Equipment`, `Maintenance`, `ChecklistTask`, `Evidence`. Relaciones relevantes:

- `Equipment.networkNodeId` obligatorio (un equipo pertenece a un nodo).
- `Equipment.supportProviderId` opcional (`ON DELETE SET NULL`): al eliminar un proveedor, sus equipos quedan como "No asignado", nunca se eliminan.
- `Maintenance` es preventivo (ligado a `NetworkNode`) o correctivo (ligado a `Equipment`), con `ChecklistTask[]` y `Evidence[]` propias.
- `Maintenance.networkNodeId`/`Maintenance.equipmentId` usan `ON DELETE RESTRICT`: el historial de mantenimiento está protegido a nivel de base de datos. Un `NetworkNode` o `Equipment` con al menos un `Maintenance` asociado no puede eliminarse (la eliminación falla con un 409, tanto si la rechaza la comprobación previa del servicio como si la rechaza directamente la restricción de clave foránea ante una carrera concurrente). Un nodo sin historial sigue pudiendo eliminarse junto con sus equipos sin historial, vía el `ON DELETE CASCADE` de `Equipment.networkNodeId` (sin cambios).

## Autenticación

JWT firmado con `JWT_SECRET`, emitido en `POST /auth/login` tras verificar la contraseña con bcrypt. El middleware `authenticate` valida el token, recarga el usuario desde la base (rechaza si está inactivo) y lo adjunta a `req.user`. `GET /auth/me` permite al frontend recuperar la sesión al recargar la página.

## Roles

`authorizeRoles(...roles)` protege cada ruta explícitamente (ver matriz completa en [API.md](API.md)). Resumen:

- **ADMIN**: acceso completo a catálogos (nodos, equipos, proveedores), usuarios, y creación/edición/eliminación de mantenimientos y checklist.
- **OPERATOR**: solo lectura en catálogos y usuarios (sin acceso a usuarios); dentro del flujo de mantenimiento puede iniciar, completar, marcar checklist y gestionar evidencias.

## Módulos

`auth`, `users`, `support-providers`, `network-nodes`, `equipment`, `maintenance`, `checklist-tasks` (anidado bajo `/maintenances/:maintenanceId/checklist-tasks`), `evidences` (anidado bajo `/maintenances/:maintenanceId/evidences`).

## Flujo de Maintenance

1. **SCHEDULED** (creación): preventivo requiere `networkNodeId`; correctivo requiere `equipmentId`. El checklist se define en este estado (solo ADMIN gestiona su estructura).
2. **IN_PROGRESS** (`POST /:id/start`): ADMIN u OPERATOR pueden iniciar. La estructura del checklist queda congelada; ambos roles pueden marcar/desmarcar tareas y adjuntar evidencias.
3. **COMPLETED** (`POST /:id/complete`): solo permitido si el 100% del checklist está completo; el backend rechaza el cierre si queda alguna tarea pendiente, sin importar lo que muestre el frontend. Al completarse, checklist y evidencias quedan de solo lectura.

## Checklist

Tareas (`ChecklistTask`) con `isCompleted`, `completedAt`, `completedById`. `PATCH /:taskId/status` recibe `isCompleted` explícito (no un toggle implícito) para evitar condiciones de carrera de intención. El backend recalcula el avance real desde la base de datos al validar el cierre del mantenimiento, no confía en el porcentaje que envíe el cliente.

## Evidences

Carga vía `multipart/form-data` (Multer) con doble validación: el tipo declarado por el cliente se filtra en el middleware de subida, y una vez el archivo está en disco se detecta su tipo **real** por contenido (firma binaria, no extensión) antes de aceptarlo definitivamente. El nombre físico almacenado es aleatorio (no deriva del nombre original). Ver [SECURITY.md](SECURITY.md) para el detalle de cuarentena y `Content-Disposition` seguro.

## Transacciones Serializable

`runSerializableTransaction` (`backend/src/utils/serializable-transaction.js`) ejecuta una transacción Prisma en nivel de aislamiento `SERIALIZABLE` con reintento automático ante conflictos de serialización (SQLSTATE `40001`). Se usa para la invariante **"siempre debe existir al menos un ADMIN activo"**: al desactivar un usuario o quitarle el rol ADMIN, la comprobación de que sigue quedando otro ADMIN activo y la escritura ocurren en la misma transacción serializable, evitando una condición de carrera entre dos solicitudes concurrentes que dejarían el sistema sin administradores.

## Almacenamiento de archivos

Evidencias en `backend/uploads/evidences` (ruta configurable vía `UPLOAD_DIR`), fuera del control de versiones. Solo se guarda la metadata (nombre original, tipo real detectado, tamaño, quién y cuándo) en PostgreSQL; el archivo binario vive en el sistema de archivos del servidor.
