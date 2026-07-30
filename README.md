# NodeKeeper

Aplicación web para la gestión centralizada del mantenimiento de nodos y equipos del Departamento de Mantenimiento de Coopelesca.

## Problema que resuelve

El seguimiento de mantenimientos preventivos y correctivos de nodos, equipos y proveedores de soporte se hacía de forma manual y dispersa. NodeKeeper centraliza esa información: quién hizo qué mantenimiento, cuándo, con qué checklist y con qué evidencia, y quién puede hacer qué según su rol.

## Funcionalidades principales

- Autenticación con JWT y control de acceso por rol, validado en el backend (no solo oculto en la interfaz).
- Gestión de usuarios, nodos, equipos y proveedores de soporte.
- Mantenimientos preventivos (asociados a un nodo) y correctivos (asociados a un equipo), con checklist obligatorio antes del cierre.
- Carga de evidencias reales (JPG, PNG, PDF, DOCX) con validación del contenido real del archivo, no solo su extensión o tipo declarado.
- Dashboard, calendario, mapa de nodos y reportes exportables a CSV, todos sobre datos reales de la API.

## Roles

- **ADMIN**: gestiona usuarios, nodos, equipos, proveedores y mantenimientos; siempre debe existir al menos un ADMIN activo en el sistema (regla aplicada de forma atómica en el backend).
- **OPERATOR**: consulta la información general y opera dentro del flujo de mantenimiento (iniciar, marcar checklist, adjuntar evidencias, crear correctivos), sin acceso a la administración de usuarios ni catálogos.

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | React 18, Vite, React Router, Tailwind CSS |
| Backend | Node.js, Express, Prisma ORM, PostgreSQL, JWT, bcrypt, Multer, Zod |
| Pruebas | Vitest + Supertest (backend), Vitest + React Testing Library (frontend) |

## Arquitectura general

Cliente-servidor clásico: el frontend (SPA) consume exclusivamente la API REST del backend; nunca se conecta directamente a PostgreSQL. Las reglas de negocio críticas (permisos por rol, regla de cierre del checklist, invariante del último ADMIN activo, validación real del tipo de archivo) viven en el backend. Detalle completo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Estructura del repositorio

```
NodeKeeper/
├─ frontend/    # SPA React + Vite + Tailwind
├─ backend/     # API Node.js + Express + Prisma
├─ docs/        # Documentación técnica y de alcance
├─ .github/     # Integración continua (GitHub Actions)
├─ CLAUDE.md    # Guía de trabajo para Claude Code en este repositorio
└─ README.md
```

## Requisitos previos

- Node.js 24 (versión validada localmente y en CI; ver `engines` en cada `package.json`)
- npm 10 o superior
- PostgreSQL 14 o superior en ejecución (local o vía Docker, ver abajo)

## Instalación rápida

```bash
git clone <url-del-repositorio>
cd NodeKeeper
npm run install:all
```

Guía paso a paso completa (PostgreSQL, migraciones, seed, arranque en dos terminales, errores comunes) en [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Configuración

Cada proyecto define sus propias variables de entorno a partir de un archivo `.env.example`:

- `backend/.env.example` → copiar a `backend/.env`
- `frontend/.env.example` → copiar a `frontend/.env`

Ninguno de los dos contiene credenciales reales; todos los valores son ficticios y deben reemplazarse localmente.

## Base de datos

PostgreSQL, gestionado con Prisma (esquema, migraciones y seed). Existe un `docker-compose.local.yml` opcional para levantar solo PostgreSQL en un contenedor si no se quiere instalar localmente; la ejecución sin Docker (PostgreSQL instalado directamente) sigue siendo la vía principal documentada. Detalle en [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Ejecución backend

```bash
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

API disponible en `http://localhost:4000`.

## Ejecución frontend

```bash
cd frontend
npm install
npm run dev
```

SPA disponible en `http://localhost:5173`.

## Pruebas

```bash
npm run test:backend    # Vitest + Supertest, 230 pruebas
npm run test:frontend   # Vitest + React Testing Library, 123 pruebas
```

Estrategia, fixtures y comandos detallados en [docs/TESTING.md](docs/TESTING.md).

## Cobertura

```bash
npm run test:coverage
```

Umbrales mínimos configurados en el frontend: 55% statements/functions/lines, 45% branches. Ver [docs/TESTING.md](docs/TESTING.md).

## Build

```bash
cd frontend && npm run build
```

Genera `frontend/dist/`, listo para servirse como sitio estático detrás de un backend/proxy independiente.

## Seguridad

JWT + bcrypt, autorización por rol validada en cada endpoint, validación de entrada con Zod, verificación del tipo real de archivo (no solo extensión/MIME declarado) para evidencias, y protección atómica del último administrador activo. Detalle completo en [docs/SECURITY.md](docs/SECURITY.md).

## Limitaciones conocidas

- Sin despliegue público todavía: este bloque prepara CI y documentación, no publica el sistema en internet (ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).
- El mapa de nodos es una proyección ilustrativa de coordenadas reales, no un mapa de terceros (Leaflet/Mapbox) integrado.
- Fuera del alcance del MVP: notificaciones por correo/SMS, integraciones externas, tiempo real con WebSockets (ver [docs/requirements/MVP_SCOPE.md](docs/requirements/MVP_SCOPE.md)).

## Documentación

- [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — contexto y objetivo del proyecto.
- [docs/requirements/MVP_SCOPE.md](docs/requirements/MVP_SCOPE.md) — alcance del MVP.
- [docs/architecture/TECH_STACK.md](docs/architecture/TECH_STACK.md) — stack técnico aprobado.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura, módulos y flujos.
- [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) — instalación local paso a paso.
- [docs/API.md](docs/API.md) — referencia de endpoints por módulo.
- [docs/TESTING.md](docs/TESTING.md) — estrategia y comandos de pruebas.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — preparación de despliegue (conceptual, sin publicar aún).
- [docs/SECURITY.md](docs/SECURITY.md) — modelo de seguridad.
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — procedimientos operativos: arranque, backup/restore, health/readiness, diagnóstico y recuperación.

## Estado del proyecto

MVP local funcional: autenticación, roles, catálogos, mantenimientos con checklist y evidencias, vistas operativas (dashboard, calendario, mapa, reportes) y gestión de usuarios están implementados y probados (230 pruebas backend, 123 pruebas frontend). El historial de mantenimiento está protegido ante eliminación de nodos/equipos, y la API aplica rate limiting general y estricto en el login. El despliegue público queda fuera de este alcance.

## Autor

Esteban Soto
