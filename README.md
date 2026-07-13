# NodeKeeper

NodeKeeper es una aplicacion web para la gestion centralizada del mantenimiento de nodos, equipos, proveedores de soporte, listas de chequeo, evidencias y reportes operativos.

El proyecto se desarrolla como una solucion academica tipo MVP para el Departamento de Mantenimiento de Coopelesca, utilizando una arquitectura cliente-servidor.

## Estado del proyecto

Estado actual: configuracion inicial del repositorio y prototipo frontend aprobado.

Objetivo de la semana: convertir el prototipo visual en una aplicacion funcional local con frontend, API, base de datos, autenticacion, roles, evidencias reales y pruebas.

## Stack tecnico

Frontend:

- React
- Vite
- Tailwind CSS
- Diseno liquid glass aprobado

Backend:

- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT
- bcrypt
- Multer

Herramientas:

- Visual Studio Code
- Claude Code
- Git y GitHub
- Postman
- PostgreSQL local

## Estructura del repositorio

NodeKeeper/
- frontend/
- backend/
- docs/
- .claude/
- .vscode/
- CLAUDE.md
- README.md
- .gitignore

## Modulos principales

- Autenticacion y roles.
- Usuarios.
- Nodos.
- Equipos.
- Proveedores de soporte.
- Mantenimientos preventivos y correctivos.
- Listas de chequeo.
- Evidencias reales.
- Mapa operativo.
- Calendario.
- Reportes basicos.

## Ejecucion local prevista

Frontend:

1. cd frontend
2. npm.cmd ci
3. npm.cmd run dev

Backend:

1. cd backend
2. npm.cmd install
3. npm.cmd run dev

URLs locales previstas:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Documentacion

La documentacion base del proyecto se encuentra en la carpeta docs:

- docs/PROJECT_CONTEXT.md
- docs/requirements/MVP_SCOPE.md
- docs/architecture/TECH_STACK.md
- docs/testing/TESTING_STRATEGY.md

## Seguridad

Este repositorio no debe incluir:

- Archivos .env.
- Credenciales.
- Tokens.
- Archivos cargados como evidencia.
- node_modules.
- Builds generados.
- Archivos ZIP temporales.

Las variables de entorno deben configurarse localmente a partir de archivos .env.example.

## Autor

Esteban Soto

## Nota

Este proyecto se encuentra en desarrollo activo. La version actual corresponde a la base inicial del MVP.
