#!/usr/bin/env bash
# Restaura un backup creado por backup.sh (formato "custom" de pg_dump) con
# pg_restore. No hardcodea ninguna credencial: toma la cadena de conexion
# desde DATABASE_URL.
#
# IMPORTANTE: apunta DATABASE_URL a una base de RESTAURACION separada,
# nunca a la base de datos real en uso — esto permite validar el backup
# (conteos, integridad) sin arriesgar los datos activos. --clean --if-exists
# limpia el contenido previo de esa base de restauracion antes de recrearlo.
#
# Uso:
#   DATABASE_URL="postgresql://usuario:clave@host:puerto/base_de_restauracion" ./restore.sh archivo.dump
set -euo pipefail

: "${DATABASE_URL:?Debes definir DATABASE_URL en el entorno antes de ejecutar este script}"
FILE="${1:?Debes indicar el archivo de backup a restaurar}"

if [ ! -f "$FILE" ]; then
  echo "No se encontro el archivo de backup: $FILE" >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$FILE"

echo "Restauracion completa desde: $FILE"
