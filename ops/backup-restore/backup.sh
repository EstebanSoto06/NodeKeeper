#!/usr/bin/env bash
# Crea un backup de PostgreSQL usando pg_dump, en formato "custom" (apto para
# pg_restore selectivo). No hardcodea ninguna credencial: toma la cadena de
# conexion desde la variable de entorno DATABASE_URL (la misma que usa el
# backend, ver backend/.env.example) o desde las variables PG* estandar de
# libpq si prefieres usarlas en su lugar.
#
# Uso:
#   DATABASE_URL="postgresql://usuario:clave@host:puerto/base" ./backup.sh [archivo_salida]
#
# El archivo de salida por defecto se guarda en ops/backup-restore/backups/
# (ignorado por git, ver .gitignore) y nunca debe subirse al repositorio.
set -euo pipefail

: "${DATABASE_URL:?Debes definir DATABASE_URL en el entorno antes de ejecutar este script}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
mkdir -p "$BACKUP_DIR"

OUTPUT="${1:-$BACKUP_DIR/nodekeeper-$(date +%Y%m%d%H%M%S).dump}"

pg_dump --format=custom --file="$OUTPUT" "$DATABASE_URL"

echo "Backup creado: $OUTPUT"
