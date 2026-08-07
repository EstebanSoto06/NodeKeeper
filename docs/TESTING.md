# Pruebas

Ver también: [testing/TESTING_STRATEGY.md](testing/TESTING_STRATEGY.md) (planificación original), [ARCHITECTURE.md](ARCHITECTURE.md).

Este documento describe la suite de pruebas realmente implementada, no la planificación inicial.

## Backend — Vitest + Supertest

- Ubicación: `backend/src/**/*.test.js` (una por módulo, más utilidades en `backend/src/utils/*.test.js` y pruebas de infraestructura en `backend/src/tests/`).
- Corren contra una base de datos PostgreSQL real (la de `DATABASE_URL`), con Prisma; algunas (`database-seed.test.js`) verifican explícitamente el resultado del seed, por lo que **requieren que `prisma migrate dev` y `npm run db:seed` ya se hayan ejecutado** sobre esa base antes de correr `npm test`.
- Cobertura funcional: autenticación, autorización por rol en cada endpoint, CRUD de catálogos con sus reglas (código/serie duplicados, proveedor opcional, cascada a "No asignado"), preservación del historial de mantenimiento al eliminar nodos/equipos (`ON DELETE RESTRICT`, ver [ARCHITECTURE.md](ARCHITECTURE.md)), flujo completo de mantenimiento (crear, iniciar, checklist, bloqueo/permiso de cierre), evidencias (subida, tipo real de archivo, descarga, cuarentena, eliminación), usuarios (incluida la invariante del último ADMIN activo) y rate limiting (`backend/src/middlewares/rate-limit.middleware.test.js`: límite general, límite estricto de login, `skipSuccessfulRequests`, exclusión de `/api/health`, aislamiento entre instancias).

```bash
cd backend
npm run db:validate   # valida el esquema de Prisma
npm test              # 245 pruebas
```

## Frontend — Vitest + React Testing Library

- Ubicación: `frontend/src/**/*.test.jsx` / `*.test.js`, junto al archivo que prueban.
- Entorno `jsdom`; utilidades compartidas en `frontend/src/test/` (`setupTests.js`, `fixtures.js`, `test-utils.jsx`).
- `renderWithProviders` envuelve cada prueba en `MemoryRouter` + un `AuthContext` controlado (sesión ADMIN, OPERATOR o invitado), sin red real: los servicios se mockean por módulo (`vi.mock('../services/xService.js', ...)`).
- Cobertura funcional: cliente HTTP y sesión (`apiClient`, `AuthContext`, `ProtectedRoute`), hooks y componentes transversales (incluida la gestión de foco de `ConfirmDialog`: foco inicial en "Cancelar" para acciones destructivas, restauración de foco al cerrar), catálogos (incluidos los mensajes de bloqueo por historial de mantenimiento en Nodos/Equipos), mantenimientos/checklist/evidencias, usuarios, validación de campos obligatorios en los formularios de creación/edición (nodos, equipos, proveedores, usuarios y mantenimientos, incluido el filtrado de equipos por nodo en un correctivo), y vistas operativas (dashboard, calendario, mapa real con Leaflet, reportes).
- El mapa se prueba con un mock controlado de `react-leaflet` (jsdom no provee las medidas reales del DOM que Leaflet necesita); `leaflet` en sí **no** se mockea, y las aserciones verifican las llamadas reales de encuadre y centrado (`setView`/`fitBounds`), no solo el DOM renderizado.

```bash
cd frontend
npm test               # 159 pruebas
npm run test:coverage  # pruebas + reporte de cobertura
```

## Comandos desde la raíz

```bash
npm run test:backend
npm run test:frontend
npm run test:coverage   # cobertura del frontend
npm run verify          # Prisma validate + ambas suites + build frontend
```

## Cobertura

Umbrales mínimos configurados en `frontend/vite.config.js` (`test.coverage.thresholds`), sin excluir páginas, servicios ni hooks funcionales:

| Métrica | Umbral mínimo |
|---|---|
| Statements | 55% |
| Functions | 55% |
| Lines | 55% |
| Branches | 45% |

El backend no impone un umbral de cobertura configurado; su cobertura funcional se sostiene con 245 pruebas de integración contra una base de datos real.

## Fixtures

- Backend: cada archivo de prueba crea/limpia sus propios datos contra la base de datos real dentro del propio test (sin fixtures compartidas globales), más utilidades puntuales en `backend/src/tests/fixtures/` para casos de archivos.
- Frontend: `frontend/src/test/fixtures.js` centraliza datos ficticios reutilizables (usuarios, proveedores, nodos, equipos, mantenimientos, checklist, evidencias); ningún dato es real ni sensible.

## Pruebas concurrentes

`backend/src/modules/users/user.test.js` incluye tres casos que ejercitan la invariante "siempre debe existir al menos un ADMIN activo" bajo concurrencia real (dos solicitudes simultáneas vía `Promise.all` contra el servidor):

1. Dos degradaciones de rol mutuas y concurrentes: solo una debe tener éxito; nunca deben quedar cero administradores activos.
2. Una degradación de rol concurrente con una desactivación, ambas amenazando la invariante: solo una debe aplicarse, y ninguna debe responder 500 (el conflicto de serialización se traduce en una respuesta de negocio controlada, 409).
3. Dos actualizaciones concurrentes no relacionadas con la invariante: ambas deben poder aplicarse sin bloquearse entre sí.

Estas pruebas validan `runSerializableTransaction` (ver [ARCHITECTURE.md](ARCHITECTURE.md#transacciones-serializable)) de forma end-to-end, no solo en aislamiento.

## Interpretación de resultados

- Un fallo en `database-seed.test.js` casi siempre significa que falta aplicar migraciones/seed sobre la base de datos usada, no un bug de la aplicación (ver [LOCAL_SETUP.md](LOCAL_SETUP.md#resolución-de-errores-frecuentes)).
- Un fallo intermitente en las pruebas de concurrencia de usuarios apunta a un problema real en `runSerializableTransaction` o en la transacción que la usa, no debe silenciarse reintentando.
- La suite frontend no debe tener pruebas omitidas (`skip`) ni watchers colgados en CI; `npm test` usa `vitest run` (modo único, no watch).
