#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate-mongo.sh
#
# Migra los datos de MongoDB 4.4 a MongoDB 7.x utilizando mongodump/mongorestore.
#
# Uso:
#   ./scripts/migrate-mongo.sh
#
# Requisitos:
#   - Docker y docker compose instalados
#   - El servicio mongo (4.4) debe estar corriendo antes de ejecutar el dump
#   - mongodump y mongorestore disponibles (se ejecutan dentro del contenedor)
#
# Pasos que realiza:
#   1. Exporta los datos del contenedor MongoDB 4.4 con mongodump
#   2. Para los servicios
#   3. Elimina el volumen antiguo de datos
#   4. Arranca MongoDB 7.x (nuevo volumen vacío)
#   5. Restaura los datos con mongorestore
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DUMP_DIR="./mongo-dump-backup"
MONGO_SERVICE="mongo"
DB_NAME="correos"

echo "══════════════════════════════════════════════════════════════"
echo " Migración MongoDB 4.4 → 7.x"
echo "══════════════════════════════════════════════════════════════"

# ── Paso 1: Verificar que el contenedor MongoDB 4.4 está corriendo ──────────
echo ""
echo "▶ Paso 1: Verificando que el servicio MongoDB está corriendo..."

if ! docker compose -f "$COMPOSE_FILE" ps "$MONGO_SERVICE" --status running 2>/dev/null | grep -q "$MONGO_SERVICE"; then
  echo "  ⚠ El servicio $MONGO_SERVICE no está corriendo. Arrancándolo..."
  docker compose -f "$COMPOSE_FILE" up -d "$MONGO_SERVICE"
  echo "  Esperando 5 segundos a que MongoDB esté listo..."
  sleep 5
fi

# ── Paso 2: Dump de los datos ───────────────────────────────────────────────
echo ""
echo "▶ Paso 2: Exportando datos con mongodump..."

rm -rf "$DUMP_DIR"
mkdir -p "$DUMP_DIR"

docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" \
  mongodump --db "$DB_NAME" --archive \
  > "$DUMP_DIR/correos-backup.archive"

DUMP_SIZE=$(du -sh "$DUMP_DIR/correos-backup.archive" 2>/dev/null | cut -f1)
echo "  ✓ Dump completado: $DUMP_DIR/correos-backup.archive ($DUMP_SIZE)"

# ── Paso 3: Parar servicios y eliminar volumen antiguo ──────────────────────
echo ""
echo "▶ Paso 3: Parando servicios y recreando volumen..."

docker compose -f "$COMPOSE_FILE" down

# Obtener nombre real del volumen (prefijo del proyecto + nombre)
VOLUME_NAME=$(docker volume ls --filter "name=mongo-data" --format '{{.Name}}' | head -1)

if [ -n "$VOLUME_NAME" ]; then
  echo "  Eliminando volumen: $VOLUME_NAME"
  docker volume rm "$VOLUME_NAME"
else
  echo "  ⚠ No se encontró volumen mongo-data (puede ser la primera ejecución)"
fi

# ── Paso 4: Arrancar MongoDB 7.x ───────────────────────────────────────────
echo ""
echo "▶ Paso 4: Arrancando MongoDB 7.x..."

docker compose -f "$COMPOSE_FILE" up -d "$MONGO_SERVICE"

echo "  Esperando 10 segundos a que MongoDB 7.x esté listo..."
sleep 10

# Verificar que MongoDB responde
docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" \
  mongosh --eval "db.adminCommand('ping')" --quiet \
  && echo "  ✓ MongoDB 7.x responde correctamente" \
  || { echo "  ✗ Error: MongoDB 7.x no responde"; exit 1; }

# ── Paso 5: Restaurar datos ────────────────────────────────────────────────
echo ""
echo "▶ Paso 5: Restaurando datos con mongorestore..."

docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" \
  mongorestore --db "$DB_NAME" --archive \
  < "$DUMP_DIR/correos-backup.archive"

echo "  ✓ Datos restaurados correctamente"

# ── Paso 6: Verificación ───────────────────────────────────────────────────
echo ""
echo "▶ Paso 6: Verificando colecciones..."

docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" \
  mongosh "$DB_NAME" --quiet --eval "
    const collections = db.getCollectionNames();
    print('  Colecciones encontradas: ' + collections.join(', '));
    collections.forEach(c => {
      const count = db.getCollection(c).countDocuments();
      print('    - ' + c + ': ' + count + ' documentos');
    });
  "

# ── Limpieza opcional ──────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo " ✓ Migración completada exitosamente"
echo ""
echo " El backup se conserva en: $DUMP_DIR/"
echo " Para eliminarlo: rm -rf $DUMP_DIR"
echo ""
echo " Para arrancar todos los servicios:"
echo "   docker compose up -d"
echo "══════════════════════════════════════════════════════════════"
