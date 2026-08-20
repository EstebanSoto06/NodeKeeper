# NodeKeeper - Estrategia de Pruebas

> **Documento histórico de planificación inicial.** Describe la estrategia de pruebas tal como se planteó al comenzar el proyecto. Para el estado actual —suites realmente implementadas, conteos vigentes, comandos y umbrales de cobertura— consultar [../TESTING.md](../TESTING.md); ver también [../../README.md](../../README.md) y [../ARCHITECTURE.md](../ARCHITECTURE.md).
>
> Nota sobre el alcance real: la creación de mantenimientos (preventivos y correctivos) quedó finalmente restringida a ADMIN; las pruebas implementadas verifican ese permiso real, no la suposición original de este documento.

## Objetivo

Validar que el MVP funcione correctamente, sin errores conocidos en los flujos principales, combinando pruebas automatizadas y pruebas funcionales documentadas.

## Pruebas automatizadas prioritarias

### Autenticacion

- Login correcto.
- Login con contraseña incorrecta.
- Token ausente.
- Token invalido.
- Usuario bloqueado.

### Roles y permisos

- Administrador accede a rutas administrativas.
- Operador no puede ejecutar acciones restringidas.
- La API debe rechazar acciones no autorizadas aunque el frontend oculte botones.

### Proveedores

- Crear proveedor.
- Editar proveedor.
- Eliminar proveedor.
- Al eliminar proveedor, los equipos asociados quedan sin proveedor.

### Equipos

- Crear equipo asociado a nodo.
- Asociar proveedor opcional.
- Mostrar "No asignado" si no hay proveedor.

### Mantenimientos

- Crear mantenimiento preventivo.
- Crear mantenimiento correctivo.
- Iniciar mantenimiento.
- Completar checklist.
- Impedir cierre si el checklist no está completo.
- Permitir cierre si el checklist está completo.

### Evidencias

- Subir archivo permitido.
- Rechazar archivo no permitido.
- Guardar metadata.
- Descargar o visualizar evidencia.

## Pruebas funcionales documentadas

Se documentaran en tablas con:

- ID de prueba.
- Modulo.
- Usuario utilizado.
- Pasos.
- Resultado esperado.
- Resultado obtenido.
- Estado.

## Herramientas sugeridas

- Vitest.
- Supertest.
- Postman.
- Pruebas manuales en navegador.

## Regla diaria

Cada dia de desarrollo debe cerrar con:

- npm.cmd run build

Cuando exista backend:

- npm.cmd test
- npx prisma validate
