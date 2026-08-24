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
| POST | `/` | ADMIN | Crear preventivo (`networkNodeId`) o correctivo (`equipmentId`); acepta `checklistTemplateId` opcional |
| PUT | `/:id` | ADMIN | Editar datos generales (**no** acepta `checklistTemplateId`) |
| DELETE | `/:id` | ADMIN | Eliminar |
| POST | `/:id/start` | ADMIN, OPERATOR | SCHEDULED → IN_PROGRESS |
| POST | `/:id/complete` | ADMIN, OPERATOR | IN_PROGRESS → COMPLETED; 409/400 si el checklist no está al 100% |

### Crear con una lista de tareas predefinida

`POST /maintenances` acepta un campo **opcional** `checklistTemplateId`. Si se envía, la orden se crea **y** las tareas de esa plantilla se copian a su checklist dentro de **una sola transacción**: si algo falla, no queda ni el mantenimiento ni un checklist a medias. La respuesta ya incluye `checklistTasks` poblado.

Si el campo se omite o llega como `null`, el comportamiento es exactamente el de siempre (orden sin tareas). Si el `checklistTemplateId` no existe, la respuesta es `404` y **no se crea el mantenimiento**.

`PUT /maintenances/:id` **no** contempla este campo: aplicar una lista a una orden ya creada se hace con `apply-template` (ver abajo). Como el schema del PUT no es estricto, un `checklistTemplateId` enviado ahí se ignora en silencio, igual que cualquier otro campo desconocido en esa ruta.

## checklist-tasks — `/api/maintenances/:maintenanceId/checklist-tasks`

La autorización combina **rol** y **estado del mantenimiento**: ambos se validan en el backend, y un rol correcto en el estado equivocado se rechaza con `409`.

| Método | Ruta | Rol | Estado requerido | Propósito |
|---|---|---|---|---|
| GET | `/` | ADMIN, OPERATOR | cualquiera | Listar tareas del mantenimiento |
| POST | `/` | ADMIN | SCHEDULED | Crear tarea |
| PUT | `/:taskId` | ADMIN | SCHEDULED | Editar descripción/orden de una tarea |
| DELETE | `/:taskId` | ADMIN | SCHEDULED | Eliminar tarea |
| PATCH | `/:taskId/status` | ADMIN, OPERATOR | IN_PROGRESS | Marcar/desmarcar (`isCompleted` explícito en el payload) |
| POST | `/apply-template` | ADMIN | SCHEDULED | Copiar al checklist las tareas de una plantilla (`{ "templateId": "..." }`) |

En resumen: la **estructura** del checklist (crear/editar/eliminar tareas) solo la gestiona un ADMIN mientras el mantenimiento está `SCHEDULED`; una vez iniciado queda congelada. **Marcar o desmarcar** tareas lo hacen ADMIN u OPERATOR, y solo mientras el mantenimiento está `IN_PROGRESS`.

`apply-template` es una modificación estructural más, con **las mismas reglas exactas que crear una tarea**: solo ADMIN, solo en `SCHEDULED`, y el mismo mensaje de `409` fuera de ese estado. Corre en una transacción `Serializable` y devuelve el checklist **completo** ya ordenado, no solo las tareas nuevas.

- Las tareas de la plantilla se **agregan al final**; ninguna tarea existente se elimina ni se reemplaza.
- Los **duplicados están permitidos** en este escenario: si el checklist ya tiene una tarea con el mismo texto, la de la plantilla también se agrega. El frontend lo advierte antes de confirmar, pero no lo bloquea.
- `404` si no existe el mantenimiento (`Maintenance not found`) o la plantilla (`Checklist template not found`); en ambos casos el checklist queda intacto.

## checklist-templates — `/api/checklist-templates` (solo ADMIN)

Listas de tareas reutilizables. **Todas** las rutas son ADMIN-only, **incluidas las de lectura**: a diferencia de los catálogos (nodos, equipos, proveedores), una plantilla solo se usa desde flujos que ya requieren ADMIN, así que un OPERATOR recibe `403` en las cinco.

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/` | Listar plantillas (ordenadas por nombre, con sus items) |
| GET | `/:id` | Detalle de una plantilla |
| POST | `/` | Crear plantilla **con sus tareas** en una sola llamada |
| PUT | `/:id` | Editar nombre, descripción y **el conjunto completo** de tareas |
| DELETE | `/:id` | Eliminar plantilla y sus items; **no afecta a tareas ya copiadas** |

Payload de `POST` y `PUT`:

```json
{ "name": "Mantenimiento preventivo UPS", "description": "Opcional", "items": [ { "description": "Revisar voltaje de entrada" } ] }
```

Reglas de validación (`400` salvo donde se indique):

- `name` obligatorio, con trim, no vacío y **único ignorando mayúsculas/minúsculas** (`409`): «Mantenimiento UPS» y «mantenimiento ups» colisionan.
- `items` con **al menos una** tarea: no se puede guardar ni dejar una plantilla vacía.
- Cada `description` obligatoria, con trim y no vacía.
- **Sin tareas repetidas dentro de la misma plantilla** tras normalizar (minúsculas + espacios colapsados): «Revisar baterías» y « revisar  BATERÍAS » son duplicados. Los **acentos sí distinguen**: «revisión» y «revision» son tareas diferentes.
- El `sortOrder` lo **deriva el servidor** del orden del array; no se acepta en el payload.

El `PUT` es **declarativo**: el array `items` enviado es el estado final de la plantilla, no un diff.

### Relación con los mantenimientos: ninguna

Aplicar una plantilla **copia** sus tareas al checklist. No existe ninguna foreign key entre `ChecklistTemplate`/`ChecklistTemplateItem` y `Maintenance`/`ChecklistTask`, en ninguna dirección. Por tanto:

- editar una plantilla **no** modifica los mantenimientos que ya la aplicaron;
- eliminar una plantilla **no** elimina tareas ya copiadas;
- cada tarea copiada es una `ChecklistTask` normal, indistinguible de una creada a mano.

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
