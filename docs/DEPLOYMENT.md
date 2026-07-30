# Despliegue (preparación conceptual)

Este documento describe cómo se desplegaría NodeKeeper. **No se ha desplegado nada públicamente todavía**; este bloque solo deja la preparación conceptual y de reproducibilidad local/CI, en línea con el alcance del MVP ([requirements/MVP_SCOPE.md](requirements/MVP_SCOPE.md): "Publicación en internet" está explícitamente fuera de este MVP).

## Build del frontend

```bash
cd frontend
npm run build
```

Genera un sitio estático en `frontend/dist/`. No requiere Node.js en el servidor final: puede servirse desde cualquier servidor de archivos estáticos (Nginx, Apache, un CDN) o detrás del propio backend.

## Backend en producción

```bash
cd backend
npm ci --omit=dev
npx prisma migrate deploy
npm start
```

`npm start` ejecuta `node src/server.js` directamente (sin `nodemon`). `NODE_ENV=production` desactiva el log detallado de `morgan` en modo "dev" y evita exponer el `stack` de errores en las respuestas (ver `errorHandler` en [ARCHITECTURE.md](ARCHITECTURE.md)).

## PostgreSQL

Instancia gestionada o autoadministrada, separada del proceso de la aplicación. `DATABASE_URL` debe apuntar a esa instancia; no reutilizar la base de datos de desarrollo.

## Variables necesarias

Las mismas que en desarrollo (ver `backend/.env.example`, `frontend/.env.example` y [LOCAL_SETUP.md](LOCAL_SETUP.md)), con valores propios del entorno: `DATABASE_URL` de producción, un `JWT_SECRET` distinto y robusto, `FRONTEND_URL` apuntando al dominio real del frontend, y `VITE_API_URL` (en el build del frontend) apuntando al dominio real de la API.

## Almacenamiento persistente de evidencias

`UPLOAD_DIR` debe apuntar a almacenamiento persistente entre despliegues (un volumen, no el sistema de archivos efímero del contenedor/proceso). Si el backend corre en múltiples instancias, ese almacenamiento debe ser compartido entre todas (por ejemplo, un volumen de red), porque hoy el acceso a archivos es directo al sistema de archivos local (ver `evidence-file.js`).

## Proxy / CORS

En producción, lo habitual es un proxy inverso (Nginx u otro) delante del backend, terminando TLS y enrutando `/api` hacia el proceso Node. `FRONTEND_URL` (usado por `cors()` en `app.js`) debe coincidir exactamente con el origen público real del frontend.

Si se despliega detrás de un proxy conocido, `app.set("trust proxy", ...)` debe configurarse explícitamente con el valor específico de ese proxy (nunca `true` a ciegas) para que el rate limiting (ver [SECURITY.md](SECURITY.md#rate-limiting)) identifique la IP real del cliente en vez de la del propio proxy. Si además se despliega más de una instancia del backend, el rate limiting necesitaría un store compartido (hoy usa memoria del propio proceso).

## HTTPS

No se implementa dentro de la aplicación Node (Express no termina TLS aquí): debe terminarse en el proxy/balanceador. `helmet()` ya está activo para las cabeceras de seguridad HTTP habituales.

## Migraciones

`npx prisma migrate deploy` (no `migrate dev`) es el comando apropiado en producción: aplica migraciones ya generadas sin generar nuevas ni pedir confirmación interactiva.

## Backups

No implementados dentro del repositorio. En producción corresponden a la herramienta de backup propia del proveedor de PostgreSQL (snapshots gestionados o `pg_dump` programado) más, si aplica, backup del volumen de `backend/uploads/evidences`.

## Logs

`morgan` en modo `dev` solo está activo fuera de `NODE_ENV=test`; en producción normalmente se reemplazaría por un formato no interactivo (`combined`) redirigido a un colector de logs, fuera del alcance de este bloque.

## Health checks

`GET /api/health` (liveness, siempre `200` si el proceso responde), `GET /api/ready` (readiness, `200`/`503` según si PostgreSQL responde) y `GET /` (raíz de la API) responden sin autenticación, aptos como *health/readiness check* de un orquestador o balanceador. Ninguno expone host, usuario, contraseña ni la cadena de conexión. Ver [RUNBOOK.md](RUNBOOK.md#health) y [RUNBOOK.md](RUNBOOK.md#readiness).

## Rollback (conceptual)

Al no haber despliegue automatizado todavía, un rollback sería: desplegar la versión anterior del build/imagen del backend y del frontend, y — solo si la migración de base de datos de la versión nueva lo requiere y es reversible — aplicar la migración `down` correspondiente con Prisma. Las migraciones deben revisarse caso por caso antes de asumir que son reversibles sin pérdida de datos.
