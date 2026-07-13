# NodeKeeper - Stack Tecnico

## Frontend

- React.
- Vite.
- Tailwind CSS.
- Diseño liquid glass aprobado.
- El frontend vive en la carpeta frontend.

Comandos principales del frontend:

- cd frontend
- npm.cmd ci
- npm.cmd run build
- npm.cmd run dev

## Backend

- Node.js.
- Express.
- Prisma ORM.
- PostgreSQL.
- JWT para autenticacion.
- bcrypt para contraseñas.
- Multer para evidencias.
- El backend vive en la carpeta backend.

## Base de datos

- PostgreSQL local.
- Puerto local: 5432.
- Las credenciales reales deben vivir solo en backend/.env.
- No subir archivos .env al repositorio.

## Archivos

Las evidencias se almacenan localmente en:

backend/uploads/evidences

La base de datos debe guardar metadata del archivo, no el archivo binario directamente.

## URLs locales previstas

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Reglas de arquitectura

- No conectar el frontend directamente a PostgreSQL.
- El frontend debe comunicarse unicamente con la API.
- La API debe validar permisos, no solo ocultar botones en el frontend.
- Las reglas criticas deben vivir en el backend.
- Prisma debe manejar relaciones y migraciones.
- Los datos mock deben reemplazarse gradualmente por servicios HTTP.
