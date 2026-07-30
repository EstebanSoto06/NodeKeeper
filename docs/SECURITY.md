# Seguridad

Ver también: [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md).

## JWT

`POST /auth/login` verifica la contraseña y emite un JWT firmado con `JWT_SECRET`, con vigencia configurable (`JWT_EXPIRES_IN`, por defecto 8h). Cada solicitud protegida debe enviar `Authorization: Bearer <token>`. El middleware `authenticate` verifica la firma, recarga el usuario desde la base de datos en cada solicitud (no confía solo en el contenido del token) y rechaza si el usuario ya no existe o está inactivo.

## bcrypt

Las contraseñas nunca se almacenan en texto plano: se guardan como `passwordHash` (bcrypt, costo 10). Ni el seed ni la API exponen jamás el hash ni la contraseña en texto plano en una respuesta; la edición de un usuario no reenvía ni prellena la contraseña, y su restablecimiento (`PATCH /users/:id/password`) recibe únicamente la nueva contraseña.

## Roles

`authorizeRoles(...roles)` protege cada endpoint explícitamente en la capa de rutas (ver la matriz completa en [API.md](API.md)); el frontend oculta acciones no permitidas solo como conveniencia de UX, nunca como control de acceso real.

## Validación (Zod)

Cada payload de entrada se valida con esquemas Zod antes de tocar la base de datos. Los errores de validación se traducen a `400` con la lista de campos afectados (`errors: [{ path, message }]`), sin exponer detalles internos.

## passwordHash

Campo interno del modelo `User`; no forma parte de ninguna respuesta serializada hacia el frontend (los `select`/mapeos de Prisma en los servicios de usuario lo excluyen explícitamente).

## Uploads

La subida de evidencias (`POST /maintenances/:id/evidences`) usa Multer con:

- Límite de un archivo por solicitud y tamaño máximo configurable (`MAX_FILE_SIZE_MB`).
- Filtro de tipo declarado (`Content-Type` del cliente) contra una lista blanca antes de aceptar la subida.
- Nombre físico temporal aleatorio (no derivado del nombre original ni adivinable).

## Validación de contenido real

El tipo declarado por el cliente **no es de confianza**. Una vez el archivo está en disco, `detectRealFileType` (librería `file-type`) inspecciona la firma binaria real y solo entonces se acepta definitivamente el archivo, con una extensión física controlada por ese tipo real detectado — nunca por la extensión que haya enviado el cliente. Un ejecutable renombrado como `.jpg`, por ejemplo, es rechazado en esta segunda verificación aunque haya superado el filtro de `Content-Type` declarado.

## Cuarentena

Si el archivo pasa la subida pero falla la verificación de contenido real (u otro paso posterior falla), se mueve a un directorio de cuarentena (`backend/uploads/evidences/.quarantine`) mediante una operación atómica de sistema de archivos (`rename`), en vez de eliminarse directamente o quedar mezclado con evidencias válidas. Existen rutinas simétricas para restaurar o eliminar definitivamente un archivo en cuarentena, usadas por la lógica de compensación si una operación posterior falla.

## Rate limiting

Dos limitadores basados en `express-rate-limit` (MemoryStore, un proceso), configurables por variables de entorno:

- **General** (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`, por defecto 15 min / 300 solicitudes por IP): aplicado a todas las rutas bajo `/api`, montado después de `/api/health` para que los health checks nunca lo atraviesen.
- **Login estricto** (`AUTH_RATE_LIMIT_WINDOW_MS`/`AUTH_RATE_LIMIT_MAX`, por defecto 15 min / 10 intentos), solo en `POST /api/auth/login`, con `skipSuccessfulRequests: true`: un login válido nunca consume el cupo; solo cuentan las respuestas de credenciales inválidas. `GET /auth/me` no lleva este límite estricto (sí el general).

Al superar cualquiera de los dos, la API responde `429` con el envelope estándar (`{ success: false, message }`) y un mensaje genérico en español que nunca revela si la cuenta existe, sin stack ni detalles internos. `standardHeaders: true` expone los headers `RateLimit-*`; `Retry-After` se envía en la respuesta bloqueada.

**MemoryStore y múltiples instancias:** el conteo vive en memoria del propio proceso — adecuado para desarrollo, demo y un MVP de una sola instancia. Un despliegue con más de una instancia del backend detrás de un balanceador necesitaría un store compartido (Redis u otro), no contemplado en este bloque.

**`trust proxy`:** no se activa en ningún valor por defecto. Sin un proxy inverso conocido delante, confiar en `X-Forwarded-For` permitiría a un cliente falsificar su IP y evadir el límite. Si se despliega detrás de un proxy propio, `app.set("trust proxy", ...)` debe configurarse con el valor específico de ese proxy (ver [DEPLOYMENT.md](DEPLOYMENT.md)), nunca `true` a ciegas.

## Serializable (transacciones)

Las operaciones que dependen de un invariante compartido entre filas (ver más abajo) se ejecutan con `runSerializableTransaction`, que usa el nivel de aislamiento `SERIALIZABLE` de PostgreSQL y reintenta automáticamente ante conflictos de serialización, en vez de aceptar una condición de carrera silenciosa entre solicitudes concurrentes.

## Protección del último ADMIN

Regla de negocio crítica: el sistema nunca debe quedar sin ningún usuario ADMIN activo. Se aplica de forma atómica (no solo con una comprobación previa separada de la escritura) al degradar el rol de un ADMIN o al desactivar un ADMIN: si la operación dejaría cero administradores activos, se rechaza con `409` — incluso bajo dos solicitudes concurrentes que individualmente parecerían válidas (ver los casos de concurrencia en [TESTING.md](TESTING.md#pruebas-concurrentes)).

## Integridad referencial y preservación de evidencias

Eliminar un `NetworkNode` o `Equipment` con historial de mantenimiento asociado se rechaza con `409`, tanto por una comprobación previa en el servicio (mensaje claro) como, de forma definitiva, por la propia restricción de clave foránea (`ON DELETE RESTRICT`) ante una carrera concurrente entre una eliminación y la creación de un mantenimiento. Esto evita que la eliminación de un catálogo destruya en cascada `Maintenance`/`ChecklistTask`/`Evidence` y deje archivos de evidencia huérfanos en disco sin ningún registro que los referencie. Un nodo o equipo sin historial de mantenimiento sigue pudiendo eliminarse normalmente.

## Deuda técnica aceptada: advisory de react-router-dom

`npm audit` reporta un advisory HIGH para `react-router`/`react-router-dom` (GHSA-qwww-vcr4-c8h2, "RSC Mode CSRF Bypass Allows Action Execution Before 400 Response", rango afectado `>=7.12.0 <8.3.0`; versión instalada `7.18.1`). El vector requiere el modo RSC/framework de React Router (acciones de servidor). NodeKeeper usa `react-router-dom` únicamente como enrutador de cliente con `<BrowserRouter>` (confirmado en `frontend/src/main.jsx`), sin `@react-router/*`, sin SSR ni acciones de servidor — el vector no es alcanzable en este uso. La corrección real de `npm audit` exige un salto de versión mayor (v7 → v8; el propio `fixAvailable` de `npm audit` sugiere una *reversión* a `7.11.0`, anterior al rango vulnerable, no una actualización), por lo que no se aplicó a ciegas en este bloque. Se acepta como riesgo temporal: reevaluar al planear una migración deliberada a React Router v8, con su propia validación de rutas/tests.

## Secretos y entorno

- Ningún secreto vive en el código fuente ni en los `.env.example` (solo placeholders explícitamente ficticios).
- `.env` real está excluido de git (`.gitignore` raíz); solo `.env.example` se versiona.
- El código falla rápido y explícitamente si falta una variable de entorno requerida (`DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `SEED_OPERATOR_PASSWORD`) en vez de usar un valor por defecto inseguro.
- En CI, las credenciales usadas (contraseñas seed, credenciales de PostgreSQL del servicio) son valores ficticios definidos en el propio workflow, nunca secretos reales del repositorio (ver `.github/workflows/ci.yml`).
