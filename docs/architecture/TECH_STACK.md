# NodeKeeper - Stack Técnico

Stack realmente instalado y en uso (verificado contra `frontend/package.json` y `backend/package.json`). Ver también [../ARCHITECTURE.md](../ARCHITECTURE.md) y [../LOCAL_SETUP.md](../LOCAL_SETUP.md).

## Frontend

Aplicación web funcional (SPA) que consume la API real; ya no queda ninguna pantalla operativa con datos mock.

| Tecnología | Uso |
|---|---|
| React 18 | Biblioteca de interfaz |
| Vite | Servidor de desarrollo y build de producción |
| React Router | Enrutamiento de la SPA |
| Tailwind CSS | Utilidades de estilo sobre el Design System NodeKeeper (liquid glass aprobado) |
| Leaflet | Motor de mapa |
| React-Leaflet | Enlace de Leaflet con React (mapa real de nodos) |
| lucide-react | Iconografía |
| Vitest | Ejecutor de pruebas |
| React Testing Library | Pruebas de componentes y páginas (con `jsdom`) |

El mapa usa teselas públicas de OpenStreetMap con su atribución visible.

Comandos principales del frontend:

- `cd frontend`
- `npm ci`
- `npm run dev`
- `npm run build`
- `npm test`

## Backend

| Tecnología | Uso |
|---|---|
| Node.js 24 | Entorno de ejecución (`engines: >=24 <25`) |
| Express | Framework HTTP |
| Prisma ORM | Acceso a datos, esquema y migraciones |
| PostgreSQL | Base de datos relacional |
| JWT (`jsonwebtoken`) | Autenticación por token |
| bcryptjs | Hash de contraseñas |
| Multer | Recepción de archivos de evidencia (`multipart/form-data`) |
| Zod | Validación de payloads de entrada |
| Helmet | Cabeceras de seguridad HTTP |
| express-rate-limit | Límite de solicitudes (general y estricto en login) |
| file-type | Detección del tipo **real** del archivo por firma binaria |
| cors | Control de origen permitido (`FRONTEND_URL`) |
| morgan | Registro de solicitudes |
| Vitest | Ejecutor de pruebas |
| Supertest | Pruebas de integración HTTP contra la API real |

## Base de datos

- PostgreSQL local (puerto predeterminado 5432).
- Las credenciales reales viven solo en `backend/.env`, nunca en el repositorio.
- La base guarda metadata del archivo de evidencia, no el binario.

## Archivos

Las evidencias se almacenan localmente en `backend/uploads/evidences` (ruta configurable con `UPLOAD_DIR`), fuera del control de versiones.

## Infraestructura y herramientas

| Tecnología | Estado |
|---|---|
| Git | En uso |
| GitHub Actions | Integración continua en uso (`.github/workflows/ci.yml`) |
| `pg_dump` / `pg_restore` | Backup y restauración validados localmente (ver [../RUNBOOK.md](../RUNBOOK.md)) |
| Nginx | **Previsto** como servidor/proxy de despliegue; todavía no implementado ni desplegado (ver [../DEPLOYMENT.md](../DEPLOYMENT.md)) |
| Docker | Solo `docker-compose.local.yml` opcional para levantar PostgreSQL en desarrollo. La aplicación completa **no** está contenerizada |

## URLs locales

- Frontend: `http://localhost:5173` (puerto predeterminado de Vite; puede caer a 5174 u otro si está ocupado — ver [../LOCAL_SETUP.md](../LOCAL_SETUP.md)).
- Backend: `http://localhost:4000`.

## Reglas de arquitectura

- No conectar el frontend directamente a PostgreSQL.
- El frontend se comunica únicamente con la API.
- La API valida permisos; ocultar botones en el frontend no es control de acceso.
- Las reglas críticas viven en el backend.
- Prisma maneja relaciones y migraciones.
