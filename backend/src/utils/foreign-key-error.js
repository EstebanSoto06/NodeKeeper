// Clasifica un error como violacion de integridad referencial (llave
// foranea ON DELETE RESTRICT), sin importar la forma exacta en la que
// llegue. Mismo motivo que isPostgresSerializationConflict en
// serializable-transaction.js: este proyecto usa el driver adapter
// @prisma/adapter-pg (ver src/config/prisma.js), y con ese adapter algunos
// errores de PostgreSQL NO llegan como PrismaClientKnownRequestError con su
// codigo Prisma (P2003), sino como un DriverAdapterError cuyo
// `cause.originalCode`/`cause.code` es el SQLSTATE real de Postgres.
//
// Confirmado empiricamente contra las restricciones RESTRICT agregadas en
// Maintenance.networkNodeId/equipmentId: el mismo rechazo de PostgreSQL
// ("update or delete ... violates RESTRICT setting of foreign key
// constraint") puede llegar como SQLSTATE 23001 (restrict_violation) o,
// segun la ruta interna del driver, como el 23503 (foreign_key_violation)
// generico. Sin este chequeo, cualquiera de las dos formas escapaba sin
// transformar como un 500, en vez de traducirse al 409 de negocio esperado.
const FOREIGN_KEY_VIOLATION_SQLSTATES = new Set(["23001", "23503"]);

export function isForeignKeyConstraintError(error) {
  if (!error) {
    return false;
  }

  // Forma clasica del motor de Prisma. P2003 es un codigo de Prisma, no un
  // SQLSTATE: se compara aparte, nunca contra FOREIGN_KEY_VIOLATION_SQLSTATES.
  if (error.code === "P2003") {
    return true;
  }

  // Forma real observada con @prisma/adapter-pg: el SQLSTATE viaja en
  // `cause.originalCode` (nombre que usa el adapter) o `cause.code`
  // (nombre estandar de node-postgres), segun la version/ruta interna.
  if (
    error.cause &&
    (FOREIGN_KEY_VIOLATION_SQLSTATES.has(error.cause.originalCode) ||
      FOREIGN_KEY_VIOLATION_SQLSTATES.has(error.cause.code))
  ) {
    return true;
  }

  // Por si algun wrapper expone el SQLSTATE directamente en el error (sin
  // `cause`), en vez de anidado.
  if (
    FOREIGN_KEY_VIOLATION_SQLSTATES.has(error.originalCode) ||
    FOREIGN_KEY_VIOLATION_SQLSTATES.has(error.code)
  ) {
    return true;
  }

  return false;
}
