# Runbook operativo

Procedimientos operativos de NodeKeeper: arranque, parada, migraciones, backups, diagnóstico y recuperación. Complementa (no repite) [LOCAL_SETUP.md](LOCAL_SETUP.md) (instalación paso a paso), [DEPLOYMENT.md](DEPLOYMENT.md) (preparación de despliegue) y [SECURITY.md](SECURITY.md) (rate limiting, secretos).

## Arranque

```bash
# PostgreSQL local (opción con Docker, ver docker-compose.local.yml) o instalado directamente
docker compose -f docker-compose.local.yml up -d   # opcional

cd backend && npm run dev     # http://localhost:4000
cd frontend && npm run dev    # http://localhost:5173
```

## Parada

```bash
# Backend/frontend: Ctrl+C en cada terminal.
docker compose -f docker-compose.local.yml down    # detiene el contenedor; el volumen persiste
docker compose -f docker-compose.local.yml down -v # además borra el volumen (pierde los datos locales)
```

## Migraciones

```bash
cd backend
npx prisma migrate deploy   # aplica migraciones pendientes (producción/CI)
npx prisma migrate dev      # aplica y, si hay cambios de schema.prisma, genera una nueva (desarrollo)
npx prisma migrate status   # ver el estado sin aplicar nada
```

## Seed inicial

```bash
cd backend
npm run db:seed
```

Requiere `SEED_ADMIN_PASSWORD` y `SEED_OPERATOR_PASSWORD` definidas en `backend/.env` (sin valor por defecto, ver [LOCAL_SETUP.md](LOCAL_SETUP.md)). Es idempotente (usa `upsert`): puede volver a ejecutarse sin duplicar usuarios/catálogos base.

## Backup

```bash
cd ops/backup-restore
DATABASE_URL="postgresql://usuario:clave@host:puerto/base" ./backup.sh
```

Genera un archivo `.dump` (formato `custom` de `pg_dump`) en `ops/backup-restore/backups/` (ignorado por git — nunca se sube al repositorio). Ver [backup.sh](../ops/backup-restore/backup.sh).

## Restore

```bash
cd ops/backup-restore
DATABASE_URL="postgresql://usuario:clave@host:puerto/base_de_restauracion" ./restore.sh backups/nombre-del-archivo.dump
```

**Siempre contra una base de restauración separada**, nunca directamente sobre la base activa — permite validar el backup (conteos de filas, integridad) antes de promoverlo. Ver [restore.sh](../ops/backup-restore/restore.sh).

> Nota de esta sesión: el procedimiento de backup/restore quedó diseñado y con la sintaxis de los scripts validada (`bash -n`), pero **no pudo ejecutarse de punta a punta** por el mismo bloqueo de PostgreSQL local documentado más abajo (sin conexión de base de datos funcional disponible, y sin Docker en este entorno). Verificar en la primera oportunidad con una base real.

## Health

```bash
curl http://localhost:4000/api/health
```

Liveness pura: siempre `200` si el proceso Node está corriendo, sin tocar la base de datos.

## Readiness

```bash
curl http://localhost:4000/api/ready
```

`200` (`{"success":true,"status":"ready"}`) si PostgreSQL responde; `503` (`{"success":false,"status":"not_ready"}`) si no. Nunca expone host, usuario, contraseña ni el error real del driver — apto para que un orquestador decida si debe enviar tráfico a esta instancia.

## Logs

Cada solicitud se registra con: id de correlación (`X-Request-Id`, propio o generado), método, ruta, status y duración (ver `backend/src/app.js` y `backend/src/middlewares/request-id.middleware.js`). Los errores 5xx además se registran en el log del servidor con ese mismo id (`backend/src/middlewares/error.middleware.js`). Nunca se registra el body de la solicitud, el header `Authorization`, contraseñas ni archivos completos.

## Rotación

No implementada dentro de la aplicación (Node escribe a stdout/stderr vía `morgan`/`console.error`). En producción, delega la rotación al orquestador o al recolector de logs (por ejemplo, un driver de logging de contenedores, o `logrotate` si se ejecuta como proceso systemd) — no se agregó ninguna dependencia de rotación de archivos en este bloque.

## Recuperación

1. Confirmar el alcance: ¿falla el proceso Node, la base de datos, o ambos? `/api/health` y `/api/ready` distinguen esto rápidamente.
2. Si falla la base de datos: ver "Diagnóstico de PostgreSQL" más abajo.
3. Si falla el proceso Node: revisar el último log de error (con su `X-Request-Id`) y reiniciar el proceso (`npm start` en producción, o el orquestador correspondiente).
4. Si hay pérdida de datos: restaurar desde el backup más reciente (ver "Restore"), primero contra una base de restauración para validar.

## Rollback

Sin despliegue automatizado en este bloque (ver [DEPLOYMENT.md](DEPLOYMENT.md#rollback-conceptual)): un rollback consiste en volver a desplegar la versión anterior del build/proceso, y solo aplicar una migración `down` si es reversible sin pérdida de datos — evaluar caso por caso, nunca asumirlo.

## Evidencias

Los archivos de evidencia viven en `UPLOAD_DIR` (por defecto `backend/uploads/evidences`), fuera de git. Un backup completo de la aplicación debe incluir tanto el backup de PostgreSQL (metadata) como una copia de ese directorio (los archivos binarios); no están acoplados en un único procedimiento en este bloque.

## Diagnóstico de PostgreSQL

Ante un error de conexión, distinguir por el código:

| Síntoma | Código Prisma | Significado | Acción |
|---|---|---|---|
| `P1000: Authentication failed` | P1000 | El servidor respondió, pero rechazó usuario/contraseña | Verificar que la contraseña en `backend/.env` coincida con la configurada para ese rol en PostgreSQL (ver detalle abajo) |
| `P1001: Can't reach database server` | P1001 | El servidor no es alcanzable (apagado, puerto o host equivocado) | Verificar que el servicio de PostgreSQL esté corriendo y el puerto en `DATABASE_URL` sea el correcto |
| `password authentication failed for user "..."` (código Postgres `28P01`) | — (viene del log del backend, no de Prisma CLI) | El rol existe, pero la contraseña no coincide | Igual que P1000: alinear la contraseña, no recrear el rol |

**Nunca se debe**: modificar `backend/.env` de forma automática, imprimir la contraseña o la cadena `DATABASE_URL` completa en ningún log o reporte.

**Pasos seguros para el usuario** (no ejecutados por Claude Code en este bloque, por no tener acceso a `.env` real ni a credenciales de superusuario):

```bash
# Conectarse como superusuario local para verificar/alinear el rol:
psql -U postgres -h localhost -p 5432

# Dentro de psql:
\du nodekeeper                                  -- confirma si el rol existe
ALTER ROLE nodekeeper WITH PASSWORD 'la-misma-clave-que-hay-en-backend/.env';
\l                                               -- confirma que la base exista
```

O, como alternativa aislada sin tocar el PostgreSQL nativo, usar `docker-compose.local.yml` (ver [LOCAL_SETUP.md](LOCAL_SETUP.md)) y apuntar `DATABASE_URL` a ese contenedor en vez de al servicio nativo.

## Problemas frecuentes

Ver tabla completa en [LOCAL_SETUP.md](LOCAL_SETUP.md#resolución-de-errores-frecuentes) (variables faltantes, seed sin contraseñas, CORS, `database-seed.test.js`). Este runbook añade únicamente el diagnóstico de conexión de PostgreSQL (arriba), que no estaba cubierto ahí.

## Escalamiento

- **Backend con múltiples instancias:** el rate limiting (ver [SECURITY.md](SECURITY.md#rate-limiting)) usa `MemoryStore`, aislado por proceso — no es consistente entre instancias sin un store compartido (Redis u otro), no implementado en este bloque.
- **Base de datos:** fuera de alcance de este bloque; PostgreSQL gestionado con réplicas/failover es una decisión de infraestructura posterior, no del código de la aplicación.
