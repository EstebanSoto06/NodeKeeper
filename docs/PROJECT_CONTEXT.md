# NodeKeeper - Contexto del Proyecto

NodeKeeper es una aplicación web para la gestión centralizada del mantenimiento de nodos y equipos del Departamento de Mantenimiento de Coopelesca.

El objetivo de esta etapa es convertir el prototipo visual aprobado en una aplicación funcional tipo MVP, ejecutada localmente, con frontend React, API Node.js/Express, Prisma y PostgreSQL.

## Cliente

- Organización: Coopelesca R.L.
- Área: Departamento de Mantenimiento
- Contacto de referencia: Jefatura del departamento

## Objetivo del MVP

Construir una versión funcional local que permita:

- Autenticación de usuarios.
- Gestión de usuarios y roles.
- Gestión de nodos.
- Gestión de equipos.
- Gestión de proveedores de soporte.
- Gestión de mantenimientos preventivos y correctivos.
- Gestión de listas de chequeo.
- Carga de evidencias reales.
- Visualización de mapa.
- Visualización de calendario.
- Reportes básicos.
- Validación de permisos por rol.

## Roles

### Administrador

Puede crear, consultar, editar y eliminar la información principal del sistema.

### Operador

Puede consultar información general y ejecutar acciones dentro del flujo de mantenimiento, como completar tareas, adjuntar evidencias y crear mantenimientos correctivos cuando corresponda.

## Decisiones actuales

- Ejecución local.
- Base de datos PostgreSQL local.
- Backend en Node.js + Express.
- ORM Prisma.
- Frontend React + Vite + Tailwind.
- Evidencias almacenadas como archivos reales en backend/uploads/evidences.
- Repositorio único con carpetas frontend, backend y docs.
