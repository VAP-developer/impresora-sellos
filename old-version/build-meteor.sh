#!/bin/bash
# =============================================================
# Script para construir la imagen Docker de Meteor con progreso
# =============================================================

set -e

IMAGE_NAME="correos-meteor"
DOCKERFILE="Dockerfile.meteor"
LOG_FILE="build-meteor.log"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # Sin color
BOLD='\033[1m'

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  🚀 Construyendo imagen Docker para Meteor                  ${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Imagen:${NC}     $IMAGE_NAME"
echo -e "${BLUE}Dockerfile:${NC} $DOCKERFILE"
echo -e "${BLUE}Log:${NC}        $LOG_FILE"
echo ""
echo -e "${YELLOW}⚠️  La primera build puede tardar 10-15 min (descarga de paquetes).${NC}"
echo -e "${YELLOW}   Las siguientes serán mucho más rápidas gracias a la caché de Docker.${NC}"
echo ""

# Función para mostrar progreso con spinner
spinner() {
    local pid=$1
    local delay=1
    local elapsed=0
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf "\r  ${BLUE}%c${NC} Construyendo... ${YELLOW}[%d:%02d]${NC} " "$spinstr" $((elapsed/60)) $((elapsed%60))
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        elapsed=$((elapsed + 1))
    done
    printf "\r"
}

# Mostrar progreso con timestamps
show_progress() {
    local start_time=$(date +%s)
    local step=""

    while IFS= read -r line; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        local mins=$((elapsed / 60))
        local secs=$((elapsed % 60))
        local timestamp=$(printf "[%02d:%02d]" $mins $secs)

        # Detectar etapas del build
        if echo "$line" | grep -q "STEP\|Step\|#[0-9]"; then
            echo -e "  ${BLUE}${timestamp}${NC} ${BOLD}$line${NC}"
        elif echo "$line" | grep -q "📦\|🔨\|✅"; then
            echo -e "  ${BLUE}${timestamp}${NC} $line"
        elif echo "$line" | grep -q "error\|Error\|ERROR"; then
            echo -e "  ${BLUE}${timestamp}${NC} ${RED}$line${NC}"
        elif echo "$line" | grep -q "→"; then
            echo -e "  ${BLUE}${timestamp}${NC} ${YELLOW}$line${NC}"
        fi
    done
}

# Ejecutar build con progreso
echo -e "${GREEN}▶ Iniciando build...${NC}"
echo ""

BUILD_START=$(date +%s)

# Ejecutar docker build con --progress=plain para ver los pasos
docker build \
    --progress=plain \
    --no-cache \
    -f "$DOCKERFILE" \
    -t "$IMAGE_NAME" \
    . 2>&1 | tee "$LOG_FILE" | show_progress

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
BUILD_MINS=$((BUILD_TIME / 60))
BUILD_SECS=$((BUILD_TIME % 60))

# Verificar si la build fue exitosa
if [ $? -eq 0 ] && docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ Build completada en ${BUILD_MINS}m ${BUILD_SECS}s${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BLUE}Tamaño de la imagen:${NC}"
    docker images "$IMAGE_NAME" --format "    {{.Repository}}:{{.Tag}} — {{.Size}}"
    echo ""
    echo -e "  ${BLUE}Para arrancar:${NC}"
    echo "    docker-compose up -d"
    echo ""
    echo -e "  ${BLUE}Para ver logs:${NC}"
    echo "    docker-compose logs -f meteor-app"
    echo ""
else
    echo ""
    echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ Error en la build${NC}"
    echo -e "${RED}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Revisa el log completo: ${YELLOW}$LOG_FILE${NC}"
    echo "  Últimas líneas del error:"
    tail -20 "$LOG_FILE"
    exit 1
fi
