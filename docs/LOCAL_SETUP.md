# Instalación local

Ver también: [../README.md](../README.md) (resumen rápido), [ARCHITECTURE.md](ARCHITECTURE.md).

## Requisitos

- Node.js 24 (versión validada localmente y en CI), npm 10 o superior.
- PostgreSQL 14+ en ejecución, local o vía el `docker-compose.local.yml` opcional del repositorio (ver más abajo). Esto **no** contradice la decisión de "sin Docker" del [alcance del MVP](requirements/MVP_SCOPE.md): ese archivo solo levanta PostgreSQL como herramienta de desarrollo, no empaqueta ni despliega la aplicación; instalar PostgreSQL directamente en el sistema sigue siendo igual de válido y es lo que se documenta como vía principal.

## PostgreSQL

**Opción A — instalación local directa:** instalar PostgreSQL 14+, crear una base de datos vacía (por ejemplo `nodekeeper_dev`) y un usuario con permisos sobre ella.

**Opción B — `docker-compose.local.yml` (opcional):**

```bash
docker compose -f docker-compose.local.yml up -d
```

Levanta solo PostgreSQL (con healthcheck y volumen persistente), en el puerto que definas por variable de entorno. No incluye backend ni frontend.

## Instalación de dependencias

Desde la raíz del repositorio:

```bash
npm run install:all
```

Equivalente manual (dos terminales, sin orquestador raíz):

```bash
cd backend && npm install
cd frontend && npm install
```

## Variables de entorno

Copia los archivos de ejemplo y completa los valores localmente (nunca subas el resultado):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Detalle de cada variable: comentarios dentro de los propios `.env.example`. Las variables `SEED_ADMIN_PASSWORD` y `SEED_OPERATOR_PASSWORD` son obligatorias para poder ejecutar el seed — sin ellas, `db:seed` falla intencionalmente en vez de usar una contraseña por defecto.

## Migraciones

```bash
cd backend
npx prisma migrate dev
```

Crea/actualiza el esquema en la base de datos apuntada por `DATABASE_URL`. Validar el esquema sin aplicar cambios: `npm run db:validate` (alias de `prisma validate`).

## Seed

```bash
cd backend
npm run db:seed
```

Crea (o actualiza) dos usuarios de prueba —un ADMIN y un OPERATOR, con los correos fijos `admin@nodekeeper.local` y `operador@nodekeeper.local`— junto con proveedores, nodos, equipos y mantenimientos de ejemplo. Las contraseñas de esos usuarios son las que hayas definido en `SEED_ADMIN_PASSWORD`/`SEED_OPERATOR_PASSWORD`; el propio script las imprime como "configured in <variable>", nunca en texto plano.

## Terminal backend

```bash
cd backend
npm run dev
```

API en `http://localhost:4000`. Verificación rápida: `curl http://localhost:4000/api/health`.

## Terminal frontend

```bash
cd frontend
npm run dev
```

SPA en `http://localhost:5173`, apuntando a `VITE_API_URL` (por defecto `http://localhost:4000/api`).

> **Sobre el puerto:** 5173 es el puerto predeterminado de Vite, no una garantía. Si ya está ocupado (por ejemplo, por otra instancia del frontend que quedó corriendo), Vite arranca automáticamente en el siguiente libre —5174, 5175…— y muestra la URL real en la consola. Dos consecuencias prácticas:
>
> - `FRONTEND_URL` en `backend/.env` debe coincidir **exactamente** con el origen que el navegador está usando; si no, las respuestas se bloquean por CORS aunque la API funcione.
> - Conviene trabajar con **una sola instancia** del frontend activa durante las pruebas: varias instancias en puertos distintos hacen que solo una coincida con `FRONTEND_URL` y el resto falle de forma confusa.

## Validación

```bash
npm run verify
```

Ejecuta, desde la raíz: validación de Prisma, pruebas backend, pruebas frontend y build de frontend. Ver [TESTING.md](TESTING.md) para el detalle de cada suite.

## Resolución de errores frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Missing required environment variable: DATABASE_URL` / `JWT_SECRET` | Falta `backend/.env` | Copiar `backend/.env.example` a `.env` y completar valores |
| El seed falla con `Missing required environment variable: SEED_ADMIN_PASSWORD` | No se definieron las contraseñas seed | Agregar `SEED_ADMIN_PASSWORD`/`SEED_OPERATOR_PASSWORD` en `backend/.env` |
| El backend no conecta a PostgreSQL | El servicio no está corriendo, o el puerto/usuario en `DATABASE_URL` no coincide | Verificar `docker compose ps` o el servicio local; revisar `DATABASE_URL` |
| Las pruebas backend de seed fallan (`database-seed.test.js`) | Falta ejecutar `prisma migrate dev` y `npm run db:seed` antes de correr `npm test` | Aplicar migraciones y seed sobre la base de datos usada por `DATABASE_URL` antes de probar |
| El frontend muestra errores de red al llamar a la API | `VITE_API_URL` no coincide con el backend real, o el backend no está corriendo | Revisar `frontend/.env` y que el backend esté arriba en el puerto esperado |
| CORS bloqueado en el navegador | `FRONTEND_URL` del backend no coincide con el origen real del frontend | Ajustar `FRONTEND_URL` en `backend/.env` |
