# NodeKeeper · Coopelesca — Prototipo visual (React + Vite + Tailwind)

Prototipo **visual y navegable** del sistema de gestión de mantenimientos de nodos,
localidades y equipos institucionales de **Coopelesca** (Zona Norte, cantón de San Carlos,
Costa Rica). Construido estrictamente sobre el **Design System NodeKeeper**: paleta
navy/azul, semáforo de estados (verde/ámbar/rojo), tipografía Nunito + Homepage Baukasten
+ IBM Plex Mono, UI en español y *sentence case*.

> Es un prototipo **sin backend**. Toda la información proviene de datos *mock* en
> `src/data/mockData.js`. Está pensado como base de implementación frontend.

---

## Módulo: Proveedores de soporte

Módulo independiente para gestionar **proveedores de soporte** y asociarlos opcionalmente a
equipos. Aparece como **"Proveedores"** en la barra lateral (icono `Building2`).

**Campos de un proveedor** (únicos; no se agregan otros):

| Campo | Significado |
|---|---|
| Nombre de empresa | Nombre de la empresa proveedora de soporte |
| Número de soporte | Número general de soporte o mesa de ayuda |
| Correo de soporte | Correo general de soporte de la empresa |
| Persona de contacto | Nombre de la persona de contacto |
| Número de contacto | Teléfono directo de la persona de contacto |
| Correo de contacto | Correo directo de la persona de contacto |

**Relación proveedor ↔ equipos:**
- Cada equipo tiene **como máximo un** proveedor (`supportProviderId`), y es **opcional**.
- Un mismo proveedor puede estar asociado a **varios** equipos.
- Si un equipo no tiene proveedor, la UI muestra **"No asignado"**.
- En el formulario de equipo solo se eligen proveedores **ya registrados** (sin creación rápida).

**Permisos del Administrador:** crea, consulta, edita y elimina proveedores; asigna proveedor a
un equipo; ve las acciones de editar/eliminar en lista y detalle.

**Permisos del Operador:** consulta el listado, el detalle y el popup de un proveedor (incluido
desde el detalle de un equipo) en **solo lectura**; no ve botones de crear, editar ni eliminar.

**Al eliminar un proveedor** (solo Administrador): se pide confirmación. Si tiene equipos
asociados, el modal indica *"Este proveedor está asociado con X equipos…"*; al confirmar, el
proveedor se elimina de los datos *mock* en memoria, **los equipos asociados pasan a "No
asignado"** (no se eliminan equipos) y se muestra el mensaje *"Proveedor eliminado. Los equipos
asociados quedaron sin proveedor asignado."*

**Pantallas / piezas del módulo:**
- `pages/Providers.jsx` — listado con empresa, número de soporte, correo de soporte, persona de contacto, número de contacto, correo de contacto, equipos y acciones.
- `pages/ProviderDetail.jsx` — datos completos + equipos asociados (cada uno abre su detalle) +
  editar/eliminar (admin).
- `pages/EquipmentDetail.jsx` — sección **"Soporte del equipo"** con los datos del proveedor o el
  mensaje de "No asignado", y botón **"Ver proveedor"** (abre el popup).
- `components/ProviderModals.jsx` — crear/editar (con validación: requeridos, correo válido,
  teléfonos sin texto), confirmación de eliminación e **"Información del proveedor"** (popup).
- `components/EquipmentFormModal.jsx` — formulario de equipo con el selector **"Proveedor de
  soporte"** (opcional; "No asignado" + proveedores registrados).
- `store/store.js` — store en memoria (proveedores + asignación equipo→proveedor) con
  `useSyncExternalStore`; mutaciones *mock* y *toasts*.

> Las acciones del módulo siguen siendo **mock**: operan sobre un store en memoria y **no
> persisten** (se reinician al recargar). La relación deberá implementarse después en **Prisma,
> una API y PostgreSQL** (ver "Qué debe implementar Claude Code después").

---

## Capa visual: Liquid glass

Sobre el Design System base se aplicó una **capa visual tipo *liquid glass*** (glassmorphism
institucional), manteniendo intacta la identidad de NodeKeeper: misma paleta navy/azul,
mismo semáforo verde/ámbar/rojo, misma estructura y alcance funcional.

Qué cambia, solo a nivel de estilo (v2 — *liquid glass* profundo, estilo Apple):
- **Lienzo luminoso:** fondo con degradado de tintes azules claros + **halos azules en movimiento**
  (deriva lenta) que dan vida y profundidad, sin imágenes.
- **Tarjetas / KPIs:** vidrio muy translúcido (`backdrop-filter: blur(34px)` + doble luz interior
  vía `inset` + borde luminoso) con **brillo especular y refracción diagonal**, **entrada fade+scale**
  y **lift al hover**; conservan la barra de acento de estado y los números en IBM Plex Mono.
- **Botón primario:** ya no es plano — **vidrio azul con degradado, luz interior, halo y barrido
  especular (*sheen*) al hover**.
- **Sidebar:** navy translúcido con degradado y **halo de luz interior**; el ítem activo es una
  píldora de vidrio con **glow azul** y barra de acento.
- **Topbar:** translúcido con blur fuerte y línea de luz superior.
- **Badges / pills:** el contador del nav y las píldoras pasan a **vidrio** (fondo translúcido,
  borde e *inner highlight*) en lugar de rellenos sólidos duros.
- **Formularios:** inputs translúcidos con luz interior y *focus ring* azul con glow.
- **Login premium:** panel lateral convertido en **vidrio navy con brillo en movimiento**; card
  central muy translúcida con halo azul.
- **Mapa y calendario:** leyenda y panel de nodo en vidrio; los marcadores conservan verde/ámbar/rojo.
- **Animaciones propias del liquid glass:** deriva de halos (canvas y login), *sheen* del botón
  primario, refracción en cards, entrada fade+scale, lift al hover y fade+blur del scrim.
  Discretas (120–260 ms / derivas 18–28 s) y **todas desactivadas con `prefers-reduced-motion: reduce`**.
- **Accesibilidad / rendimiento:** texto siempre opaco sobre vidrio; en móvil se reduce el desenfoque
  y hay *fallback* (`@supports`) con superficies opacas (incl. botón primario y badges) para
  navegadores sin `backdrop-filter`.

Los tokens *liquid glass* viven en `src/styles/tokens.css` (`--liquid-*` y aliases `--glass-*`,
`--chrome-glass`, `--topbar-glass`) y la aplicación de estilos en `src/styles/global.css`. **No se
introdujeron colores nuevos** (todo deriva de la paleta navy/blue/semáforo a baja opacidad), **ni
librerías nuevas, ni cambios de estructura o de alcance.**

**Archivos modificados para la capa glass:**
- `src/styles/tokens.css` — bloque de tokens `--liquid-*` (superficies, bordes, sombras con luz
  interior, *glow*) + aliases `--glass-*` para compatibilidad.
- `src/styles/global.css` — lienzo luminoso + halos animados; vidrio real en `.nk-card`/KPI,
  `.nk-sidebar`, `.nk-topbar`, `.nk-btn-primary`/`.nk-btn-danger`, `.nk-navitem.is-active`,
  `.nk-navitem .nk-badge`, `.nk-pill`, inputs/buscador/chips, encabezados de tabla, login
  (panel + card), leyenda y panel del mapa; *keyframes* `nk-halo-drift` / `nk-aside-drift` /
  `nk-sheen-sweep` / `nk-glass-in` / `nk-fade-in`; *fallbacks* móvil, `@supports` y
  `prefers-reduced-motion`.

Como el estilo se concentra en las clases `.nk-*` y los tokens, los componentes
(`Card`, `KpiCard`, `Sidebar`, `Topbar`, `Badge`, `Table`, `Button`, etc.) lo heredan sin
cambios en su lógica.

---

## Requisitos

- Node.js 18 o superior
- npm 9 o superior

## Ejecutar

```bash
npm install
npm run dev
```

Vite abrirá el prototipo en `http://localhost:5173`.

Otros comandos:

```bash
npm run build     # build de producción a /dist
npm run preview   # sirve el build de producción
```

### Acceso demo

La pantalla de Login es solo visual. Puedes entrar de tres formas:

- Botón **Administrador** o **Operador** (acceso directo por rol).
- Credenciales demo (ficticias): `a.vargas@coopelesca.cr` / `demo1234` (admin),
  `j.alvarado@coopelesca.cr` / `demo1234` (operador).
- Cualquier credencial incorrecta muestra el **estado de error**.

---

## Estructura

```
nodekeeper-react/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js        # tokens del Design System mapeados a Tailwind
├─ postcss.config.js
├─ public/
│  ├─ favicon.svg
│  └─ fonts/                 # Nunito + Homepage Baukasten (IBM Plex Mono vía CDN)
└─ src/
   ├─ main.jsx
   ├─ App.jsx                # enrutamiento visual por estado + sesión/rol demo
   ├─ data/
   │  └─ mockData.js         # DATOS ficticios de Coopelesca + helpers de estado (NK) + proveedores
   ├─ store/
   │  └─ store.js            # store en memoria de proveedores + asignación equipo→proveedor (mock)
   ├─ layouts/
   │  └─ AppShell.jsx        # sidebar + topbar + responsive
   ├─ pages/
   │  ├─ Login.jsx           Dashboard.jsx     Nodes.jsx        NodeDetail.jsx
   │  ├─ Equipment.jsx       EquipmentDetail.jsx
   │  ├─ Providers.jsx       ProviderDetail.jsx
   │  ├─ Maintenances.jsx    MaintenanceDetail.jsx
   │  ├─ Calendar.jsx        Map.jsx           Evidence.jsx     Reports.jsx   Users.jsx
   ├─ components/
   │  ├─ Button.jsx  Badge.jsx  Card.jsx  Table.jsx  StatusPill.jsx  KpiCard.jsx
   │  ├─ Sidebar.jsx  Topbar.jsx  Icon.jsx  Inputs.jsx  Misc.jsx
   │  ├─ Modal.jsx           # modal liquid glass + DataList + ToastHost
   │  ├─ ProviderModals.jsx  # crear/editar, eliminar (confirmación) e info de proveedor
   │  └─ EquipmentFormModal.jsx  # formulario de equipo con selector de proveedor
   └─ styles/
      ├─ tokens.css          # tokens del Design System (color, tipografía, espacio…)
      └─ global.css          # Tailwind + clases .nk-* (componentes, shell, pantallas)
```

### Notas técnicas

- **Sin React por CDN, sin Babel en navegador, sin dependencias del bundle cerrado.**
  Todo es código fuente abierto y editable.
- **Iconos: `lucide-react`** (trazo 2px), importados de forma explícita (tree-shakeable)
  en `src/components/Icon.jsx`, mapeados a los nombres usados por el sistema.
- **Tokens primero.** Los colores y la tipografía viven en `src/styles/tokens.css` como
  variables CSS y, en paralelo, en `tailwind.config.js` (`theme.extend`) para usar
  utilidades de Tailwind. Las pantallas usan las clases `.nk-*` de `global.css`.
- **El color siempre se deriva de los datos** (helpers `NK.health`, `NK.state`,
  `NK.equipStatus` en `mockData.js`). No hay colores hardcodeados fuera del sistema.

---

## Pantallas incluidas

| # | Pantalla | Archivo |
|---|---|---|
| 1 | Login (con estado de error) | `pages/Login.jsx` |
| 2 | Layout (sidebar navy + topbar + responsive) | `layouts/AppShell.jsx` |
| 3 | Dashboard (KPIs, tendencia, salud de nodos, recientes) | `pages/Dashboard.jsx` |
| 4 | Listado de nodos (búsqueda + filtros por estado) | `pages/Nodes.jsx` |
| 5 | Detalle de nodo (equipos, mantenimientos, coordenadas) | `pages/NodeDetail.jsx` |
| 6 | Equipos (filtros por nodo y estado, proveedor, crear correctivo) | `pages/Equipment.jsx` |
| 6b | Detalle de equipo (sección "Soporte del equipo" + ver proveedor) | `pages/EquipmentDetail.jsx` |
| 6c | Proveedores de soporte (listado + búsqueda + CRUD admin) | `pages/Providers.jsx` |
| 6d | Detalle de proveedor (datos + equipos asociados) | `pages/ProviderDetail.jsx` |
| 7 | Mantenimientos (filtros por tipo/estado, avance) | `pages/Maintenances.jsx` |
| 8 | Detalle de mantenimiento (checklist, evidencias, cierre) | `pages/MaintenanceDetail.jsx` |
| 9 | Checklist (avance %, regla de cierre al 100%) | dentro de `MaintenanceDetail.jsx` |
| 10 | Evidencias (galería JPG/PNG/PDF/DOCX, subir, ver/descargar) | `pages/Evidence.jsx` |
| 11 | Calendario (junio 2026, color por estado, filtros) | `pages/Calendar.jsx` |
| 12 | Mapa de nodos (marcadores, leyenda, panel de nodo) | `pages/Map.jsx` |
| 13 | Reportes (filtros por nodo y fechas, exportar) | `pages/Reports.jsx` |
| 14 | Usuarios y roles (sección administrativa) | `pages/Users.jsx` |

### Flujos navegables

Login → Dashboard · Dashboard → Detalle de mantenimiento · Mantenimientos → Detalle →
Checklist/Evidencias · Nodos → Detalle de nodo → Mapa · Mapa → Detalle de nodo ·
Calendario → Mantenimientos · Reportes con filtros visuales.

---

## Reglas de negocio representadas visualmente

- **Estados de mantenimiento por color:** Pendiente = **rojo**, En progreso = **ámbar**,
  Cerrado = **verde**.
- **Salud del nodo:** verde = sin pendientes · ámbar = tareas incompletas · rojo = con
  mantenimientos pendientes (el conteo aparece en el marcador del mapa).
- **Cierre bloqueado:** un mantenimiento **solo puede cerrarse cuando el checklist está al
  100%**. Mientras tanto, el botón "Cerrar mantenimiento" se muestra deshabilitado y aparece
  el mensaje *"No puedes cerrar: el checklist está al N%."* (interactivo: marca/desmarca
  tareas y el avance + el bloqueo se actualizan).
- **Preventivo vs. correctivo:** los preventivos pueden ser **recurrentes**; los correctivos
  se asocian a un **equipo específico**.
- **Roles:** el **Operador** no ve la sección Administración (Usuarios y roles) y sus acciones
  de modificación se limitan a mantenimientos (iniciar, marcar tareas, adjuntar evidencia,
  crear correctivo). El **Administrador** tiene acceso visual completo.
- **Proveedores de soporte:** cada equipo tiene **máximo un** proveedor (opcional) y un proveedor
  puede dar soporte a **varios** equipos; sin proveedor se muestra **"No asignado"** (en color
  neutro azul/navy, nunca verde/ámbar/rojo, que están reservados a estados). Solo el
  **Administrador** crea/edita/elimina proveedores; el **Operador** solo consulta. Al eliminar un
  proveedor, sus equipos pasan a "No asignado".

---

## Qué sigue siendo *mock* (no real)

- **Sin backend ni base de datos.** Los datos viven en `src/data/mockData.js` y los cambios
  no persisten (se reinician al recargar).
- **Autenticación simulada:** el login no valida contra un servidor; el rol se elige en la
  pantalla de acceso.
- **Mapa ilustrativo:** es un *placeholder* estilizado del Design System, no un mapa real.
- **Acciones visuales:** botones como *Exportar*, *Subir archivo*, *Crear*, *Editar*,
  *Descargar* no ejecutan lógica; representan la intención de UI.
- **Buscadores y filtros** funcionan sobre los datos *mock* en memoria.

---

## Qué debe implementar Claude Code después

1. **Capa de datos / API:** reemplazar `mockData.js` y `store/store.js` por servicios reales
   (REST/GraphQL), con estados de carga, error y vacío ya previstos por la UI. La relación
   **proveedor ↔ equipo** (`supportProviderId`) debe implementarse en **Prisma + API + PostgreSQL**
   (proveedor `1—N` equipos; `supportProviderId` opcional con `ON DELETE SET NULL` para reflejar el
   paso a "No asignado" al eliminar un proveedor).
2. **Autenticación y autorización reales** (login, sesión, roles/permisos por endpoint).
   La UI ya distingue Administrador / Operador.
3. **Routing real** con `react-router-dom` (las vistas hoy se conmutan por estado en `App.jsx`;
   migrar a rutas `/dashboard`, `/nodos/:id`, `/mantenimientos/:id`, etc.).
4. **CRUD** de nodos, equipos, usuarios, mantenimientos y **proveedores** (crear/editar/eliminar/
   bloquear), con validación de formularios. El módulo de **Proveedores** ya define el formulario
   con validaciones (requeridos, correo válido, teléfonos sin texto), el selector de proveedor en
   el equipo y la confirmación de borrado con reasignación a "No asignado".
5. **Checklist y evidencias funcionales:** persistir el avance, subida real de archivos
   (JPG/PNG/PDF/DOCX) y la **regla de cierre al 100%** en el servidor.
6. **Calendario y mapa reales:** integrar un calendario con reprogramación (drag) y un mapa
   real (Leaflet/Mapbox) con coordenadas verdaderas.
7. **Reportes y exportación** (PDF/CSV) con filtros por nodo y rango de fechas.
8. **Recurrencia de preventivos** y generación automática de órdenes.

---

© 2026 NodeKeeper · Coopelesca — Prototipo visual. Datos ficticios, sin información sensible.
