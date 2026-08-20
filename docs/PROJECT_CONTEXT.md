# NodeKeeper - Contexto del Proyecto

> **Documento histórico de planificación inicial.** Para el estado actual consultar [../README.md](../README.md), [ARCHITECTURE.md](ARCHITECTURE.md) y [TESTING.md](TESTING.md). Se conserva porque documenta el punto de partida, el cliente y las decisiones originales; la sección "Estado actual" al final refleja dónde está realmente el proyecto.

NodeKeeper es una aplicación web para la gestión centralizada del mantenimiento de nodos y equipos del Departamento de Mantenimiento de Coopelesca.

El objetivo de aquella etapa inicial era convertir el prototipo visual aprobado en una aplicación funcional tipo MVP, ejecutada localmente, con frontend React, API Node.js/Express, Prisma y PostgreSQL. Ese objetivo ya se cumplió (ver "Estado actual").

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

Puede consultar información general y ejecutar acciones dentro del flujo de un mantenimiento ya existente: iniciarlo, completarlo, marcar tareas del checklist y adjuntar o descargar evidencias, según el estado del mantenimiento. No crea, edita ni elimina mantenimientos ni catálogos, y no tiene acceso al módulo de usuarios.

## Decisiones iniciales

- Ejecución local.
- Base de datos PostgreSQL local.
- Backend en Node.js + Express.
- ORM Prisma.
- Frontend React + Vite + Tailwind.
- Evidencias almacenadas como archivos reales en backend/uploads/evidences.
- Repositorio único con carpetas frontend, backend y docs.

Todas estas decisiones se mantienen vigentes.

## Estado actual

- **MVP local consolidado**: autenticación, roles, catálogos (nodos, equipos, proveedores), mantenimientos con checklist y evidencias, calendario, reportes y gestión de usuarios están implementados y cubiertos por pruebas automatizadas contra la API y la base de datos reales.
- **Mapa real implementado**: la vista de mapa ya no es un lienzo ilustrativo; usa Leaflet sobre teselas de OpenStreetMap, con marcadores por coordenadas reales, creación de nodos por ADMIN haciendo clic en el mapa y enfoque de un nodo puntual desde su detalle.
- **Frontend conectado a la API real**: no quedan datos mock en las pantallas funcionales; cada pantalla consume su servicio HTTP correspondiente.
- **Backup/restore validado localmente** (ver [RUNBOOK.md](RUNBOOK.md)).

Etapa actual del proyecto:

1. Auditoría funcional del sistema completo.
2. Mejoras funcionales pendientes (entre ellas, una galería global de evidencias, todavía no implementada).
3. Despliegue piloto, aún no confirmado ([DEPLOYMENT.md](DEPLOYMENT.md)).
4. Documentación académica del proyecto.
