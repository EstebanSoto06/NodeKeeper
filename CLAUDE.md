# CLAUDE.md - NodeKeeper

## Rol de Claude Code

Claude Code debe actuar como asistente tecnico de desarrollo para NodeKeeper.

Debe trabajar de forma incremental, segura y verificable. No debe intentar construir toda la aplicacion en una sola respuesta.

## Contexto del proyecto

NodeKeeper es una aplicacion web para la gestion centralizada del mantenimiento de nodos y equipos del Departamento de Mantenimiento de Coopelesca.

El prototipo visual aprobado ya existe en la carpeta frontend. El objetivo actual es convertirlo en una aplicacion funcional MVP con API, base de datos y pruebas.

Antes de hacer cambios importantes, Claude debe revisar estos archivos:

- docs/PROJECT_CONTEXT.md
- docs/requirements/MVP_SCOPE.md
- docs/architecture/TECH_STACK.md
- docs/testing/TESTING_STRATEGY.md

## Estructura del repositorio

- frontend: prototipo React + Vite + Tailwind aprobado.
- backend: API Node.js + Express + Prisma + PostgreSQL.
- docs: documentacion tecnica, alcance, arquitectura y pruebas.

## Stack tecnico aprobado

Frontend:

- React.
- Vite.
- Tailwind CSS.

Backend:

- Node.js.
- Express.
- Prisma ORM.
- PostgreSQL.
- JWT.
- bcrypt.
- Multer para carga de evidencias.

## Reglas de trabajo

1. Mantener el alcance MVP definido en docs/requirements/MVP_SCOPE.md.
2. No agregar funcionalidades fuera del alcance sin aprobacion.
3. No redisenar el frontend ni cambiar el estilo liquid glass aprobado.
4. No borrar archivos existentes sin explicar el motivo y pedir aprobacion.
5. No modificar archivos .env reales.
6. No subir ni generar credenciales dentro del codigo.
7. No crear dependencias nuevas sin justificar su uso.
8. No reemplazar el prototipo completo; migrar los datos mock hacia API gradualmente.
9. La API debe validar permisos. No basta con ocultar botones en el frontend.
10. Las reglas criticas deben implementarse en backend.

## Flujo obligatorio antes de modificar codigo

Antes de cambiar archivos, Claude debe:

1. Explicar brevemente el plan.
2. Indicar archivos que va a modificar.
3. Esperar confirmacion cuando el cambio sea grande o riesgoso.
4. Implementar cambios pequenos y verificables.
5. Ejecutar o indicar las pruebas necesarias.
6. Resumir que cambio y que queda pendiente.

## Reglas de seguridad

No incluir en commits:

- .env
- node_modules
- dist
- backend/uploads/evidences/*
- archivos zip
- credenciales
- tokens
- llaves privadas

## Comandos importantes

Frontend:

- cd frontend
- npm.cmd ci
- npm.cmd run build
- npm.cmd run dev

Backend:

- cd backend
- npm.cmd install
- npm.cmd test
- npx prisma validate
- npx prisma migrate dev
- npx prisma studio

## Convenciones

- Usar commits pequenos y descriptivos.
- Mantener nombres de archivos y carpetas claros.
- Separar rutas, controladores, servicios y validaciones en backend.
- Documentar decisiones tecnicas relevantes en docs.
- Priorizar estabilidad sobre cambios visuales.

## Reglas de negocio criticas

- El Administrador puede gestionar usuarios, nodos, equipos, proveedores y mantenimientos.
- El Operador puede consultar informacion general.
- El Operador puede trabajar dentro del flujo de mantenimiento segun el alcance.
- Un equipo puede tener cero o un proveedor de soporte.
- Un proveedor puede estar asociado a muchos equipos.
- Si se elimina un proveedor, sus equipos asociados quedan como No asignado.
- Un mantenimiento no puede cerrarse si su checklist no esta completo.
- Las evidencias deben almacenarse como archivos reales y registrar metadata en base de datos.

## Objetivo de la semana

Terminar un MVP local funcional del domingo 12 al domingo 19.

La aplicacion debe quedar ejecutandose localmente con:

- Frontend en http://localhost:5173
- Backend en http://localhost:4000
- PostgreSQL local
- Evidencias en backend/uploads/evidences

## Prioridad

La prioridad es lograr una aplicacion funcional, estable y demostrable.

Evitar cambios innecesarios, redisenos o agregados que puedan comprometer el cronograma.
