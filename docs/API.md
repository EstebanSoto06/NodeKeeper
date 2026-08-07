# API — Referencia por módulo

Base: `http://localhost:4000/api` (configurable en el frontend vía `VITE_API_URL`, que ya incluye el sufijo `/api`).

Ver también: [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md).

## Envelope de respuesta

Éxito:

```json
{ "success": true, "data": { "...": "..." } }
```

Error:

```json
{ "success": false, "message": "Descripción del error", "errors": [ { "path": "campo", "message": "detalle" } ] }
```

`errors` solo aparece en fallos de validación (Zod). Los errores devuelven además el `statusCode` HTTP correspondiente.

## Códigos de error comunes

| Código | Significado |
|---|---|
| 400 | Validación fallida (payload incorrecto) o carga de archivo inválida |
| 401 | Sin token, token inválido/expirado, o usuario inactivo |
| 403 | Autenticado pero sin el rol requerido |
| 404 | Recurso no encontrado |
| 409 | Conflicto (p. ej. código/serie duplicados, o violación de la regla del último ADMIN activo) |
| 500 | Error interno no esperado |

## auth — `/api/auth`

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| POST | `/login` | público | Autentica con email/contraseña, devuelve JWT + datos del usuario |
| GET | `/me` | autenticado | Recupera la sesión actual a partir del token (usado al recargar la SPA) |

## users — `/api/users` (solo ADMIN)

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/` | Listar usuarios (filtros por rol/estado en query) |
| GET | `/:id` | Detalle de un usuario |
| POST | `/` | Crear usuario (nombre, correo, contraseña, rol) |
| PATCH | `/:id` | Editar datos del usuario (nunca reenvía ni prellena contraseña) |
| PATCH | `/:id/status` | Activar/desactivar; rechaza (409) si dejaría el sistema sin ningún ADMIN activo |
| PATCH | `/:id/password` | Restablecer contraseña (recibe solo la nueva) |

## support-providers — `/api/support-providers`

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| GET | `/`, `/:id` | ADMIN, OPERATOR | Listar / detalle |
| POST | `/` | ADMIN | Crear (empresa, contactos, teléfonos, correos) |
| PUT | `/:id` | ADMIN | Editar |
| DELETE | `/:id` | ADMIN | Eliminar; los equipos asociados quedan como "No asignado" |

## network-nodes — `/api/network-nodes`

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| GET | `/`, `/:id` | ADMIN, OPERATOR | Listar / detalle |
| GET | `/map` | ADMIN, OPERATOR | Nodos con coordenadas válidas, para el mapa |
| POST | `/` | ADMIN | Crear (código único, nombre, ubicación, coordenadas, estado) |
| PUT | `/:id` | ADMIN | Editar; código duplicado responde 409 |
| DELETE | `/:id` | ADMIN | Eliminar; responde 409 si el nodo tiene mantenimientos directos o si alguno de sus equipos los tiene (historial preservado, ver ARCHITECTURE.md) |

## equipment — `/api/equipment`

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| GET | `/`, `/:id` | ADMIN, OPERATOR | Listar / detalle |
| POST | `/` | ADMIN | Crear (nodo obligatorio, proveedor opcional, serie única) |
| PUT | `/:id` | ADMIN | Editar; serie duplicada responde 409 |
| DELETE | `/:id` | ADMIN | Eliminar; responde 409 si el equipo tiene historial de mantenimiento (historial preservado, ver ARCHITECTURE.md) |

## maintenances — `/api/maintenances`

| Método | Ruta | Rol | Propósito |
|---|---|---|---|
| GET | `/`, `/:id` | ADMIN, OPERATOR | Listar / detalle (incluye checklist y evidencias) |
| POST | `/` | ADMIN | Crear preventivo (`networkNodeId`) o correctivo (`equipmentId`) |
| PUT | `/:id` | ADMIN | Editar datos generales |
| DELETE | `/:id` | ADMIN | Eliminar |
| POST | `/:id/start` | ADMIN, OPERATOR | SCHEDULED → IN_PROGRESS |
| POST | `/:id/complete` | ADMIN, OPERATOR | IN_PROGRESS → COMPLETED; 409/400 si el checklist no está al 100% |

## checklist-tasks — `/api/maintenances/:maintenanceId/checklist-tasks`

La autorización combina **rol** y **estado del mantenimiento**: ambos se validan en el backend, y un rol correcto en el estado equivocado se rechaza con `409`.

| Método | Ruta | Rol | Estado requerido | Propósito |
|---|---|---|---|---|
| GET | `/` | ADMIN, OPERATOR | cualquiera | Listar tareas del mantenimiento |
| POST | `/` | ADMIN | SCHEDULED | Crear tarea |
| PUT | `/:taskId` | ADMIN | SCHEDULED | Editar descripción/orden de una tarea |
| DELETE | `/:taskId` | ADMIN | SCHEDULED | Eliminar tarea |
| PATCH | `/:taskId/status` | ADMIN, OPERATOR | IN_PROGRESS | Marcar/desmarcar (`isCompleted` explícito en el payload) |

En resumen: la **estructura** del checklist (crear/editar/eliminar tareas) solo la gestiona un ADMIN mientras el mantenimiento está `SCHEDULED`; una vez iniciado queda congelada. **Marcar o desmarcar** tareas lo hacen ADMIN u OPERATOR, y solo mientras el mantenimiento está `IN_PROGRESS`.

## evidences — `/api/maintenances/:maintenanceId/evidences`

Igual que el checklist, la autorización combina **rol** y **estado del mantenimiento**.

| Método | Ruta | Rol | Estado requerido | Propósito |
|---|---|---|---|---|
| GET | `/` | ADMIN, OPERATOR | cualquiera | Listar evidencias (metadata) |
| GET | `/:evidenceId/file` | ADMIN, OPERATOR | cualquiera | Descargar/ver el archivo (responde binario + `Content-Disposition`) |
| POST | `/` | ADMIN, OPERATOR | IN_PROGRESS | Subir archivo (`multipart/form-data`, campo `file`) |
| DELETE | `/:evidenceId` | ADMIN | IN_PROGRESS | Eliminar evidencia (archivo + metadata) |

Consultar y descargar evidencias funciona en cualquier estado, incluido `COMPLETED` (el historial permanece accesible). Subir y eliminar solo es posible mientras el mantenimiento está `IN_PROGRESS`: al cerrarlo, sus evidencias quedan de solo lectura.

> **No implementado todavía:** no existe una API global de evidencias (`GET /api/evidences`). Las evidencias se consultan siempre dentro de su mantenimiento. Una galería global es una mejora funcional pendiente; ver [../README.md](../README.md#limitaciones-conocidas).

### Multipart y descargas

- La carga acepta un único archivo por solicitud (`JPG`, `PNG`, `PDF`, `DOCX`); el tipo se valida dos veces (declarado en la subida, real por contenido al finalizar) — ver [SECURITY.md](SECURITY.md).
- La descarga responde el binario con `Content-Disposition` (`inline` para imágenes/PDF, `attachment` para DOCX) construido de forma segura a partir del nombre original, y soporta nombre UTF-8 con respaldo ASCII.
- Ni la carga ni la descarga pasan por el envelope JSON estándar (son binarios), a diferencia del resto de la API.
