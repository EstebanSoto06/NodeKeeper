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

## Serializable (transacciones)

Las operaciones que dependen de un invariante compartido entre filas (ver más abajo) se ejecutan con `runSerializableTransaction`, que usa el nivel de aislamiento `SERIALIZABLE` de PostgreSQL y reintenta automáticamente ante conflictos de serialización, en vez de aceptar una condición de carrera silenciosa entre solicitudes concurrentes.

## Protección del último ADMIN

Regla de negocio crítica: el sistema nunca debe quedar sin ningún usuario ADMIN activo. Se aplica de forma atómica (no solo con una comprobación previa separada de la escritura) al degradar el rol de un ADMIN o al desactivar un ADMIN: si la operación dejaría cero administradores activos, se rechaza con `409` — incluso bajo dos solicitudes concurrentes que individualmente parecerían válidas (ver los casos de concurrencia en [TESTING.md](TESTING.md#pruebas-concurrentes)).

## Secretos y entorno

- Ningún secreto vive en el código fuente ni en los `.env.example` (solo placeholders explícitamente ficticios).
- `.env` real está excluido de git (`.gitignore` raíz); solo `.env.example` se versiona.
- El código falla rápido y explícitamente si falta una variable de entorno requerida (`DATABASE_URL`, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `SEED_OPERATOR_PASSWORD`) en vez de usar un valor por defecto inseguro.
- En CI, las credenciales usadas (contraseñas seed, credenciales de PostgreSQL del servicio) son valores ficticios definidos en el propio workflow, nunca secretos reales del repositorio (ver `.github/workflows/ci.yml`).
