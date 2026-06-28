# IMPRESORA CORREOS

Aplicación web para gestión de impresión de sellos postales con impresora USB, desarrollada con **Meteor 3.x**, **Vue 3** y un demonio de impresión en **Python 3.12**.

## Stack Tecnológico

| Componente | Versión | Descripción |
|---|---|---|
| Meteor | 3.0 | Framework full-stack (backend + build system) |
| Node.js | 20 LTS | Runtime del servidor Meteor |
| MongoDB | 7.x | Base de datos (colecciones: config, images, orders) |
| Vue 3 | 3.4+ | Framework frontend (Composition API + SFC) |
| Vue Router | 4.3+ | Router SPA |
| Tailwind CSS | 3.4+ | Framework de estilos utilitario |
| Python | 3.12 | Servidor WebSocket de impresión (demonio) |
| websockets | 14.1 | Librería asyncio para WebSocket (puerto 8000) |
| aiohttp | 3.11 | Servidor HTTP para pausar/reanudar (puerto 8001) |
| reportlab | 4.2.5 | Generación de PDFs de sellos y tickets |
| Docker Compose | v2+ | Orquestación de los 3 servicios |

## Requisitos previos

- **Docker** y **Docker Compose** v2+
- (Opcional para desarrollo local) **Node.js 20**, **Meteor 3.0**, **Python 3.12**

## Ejecución con Docker (recomendado)

```bash
# Construir las imágenes
docker build --no-cache -f Dockerfile.meteor -t correos-meteor .
docker build --no-cache -f Dockerfile.demonio -t correos-demonio .

# Arrancar todos los servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Parar servicios
docker compose down
```

La aplicación estará disponible en: **http://localhost:9090**

### Servicios Docker

| Servicio | Puerto | Descripción |
|---|---|---|
| `meteor-app` | 9090 → 3000 | Aplicación web (Vue 3 + Meteor 3.x) |
| `demonio-python` | 8000, 8001 | Servidor WebSocket + HTTP de impresión |
| `mongo` | 27017 | MongoDB 7.x |

## Ejecución en desarrollo local

### Meteor (frontend + backend)

```bash
cd correos-webapp
npm install
MONGO_URL=mongodb://localhost:27017/correos meteor --allow-superuser
```

### Demonio Python (servidor de impresión)

```bash
cd demonio
pip install -r requirements.txt
python servidor_ws_nuevo.py
```

### MongoDB

```bash
docker compose up -d mongo
```

## Ejecutar tests

### Tests Python (PBT + unitarios)

```bash
# Instalar dependencias de test
pip install pytest hypothesis aiohttp

# Ejecutar todos los tests Python
python3 -m pytest tests/ -v

# Tests individuales
python3 -m pytest tests/test_ws_roundtrip.py -v      # Property 1: Round-trip WebSocket
python3 -m pytest tests/test_ws_echo.py -v           # Property 3: Echo integridad
python3 -m pytest tests/test_ws_resilience.py -v     # Property 4: Resiliencia
python3 -m pytest tests/test_pdf_dimensions.py -v    # Property 5: Dimensiones PDF
python3 -m pytest tests/test_servidor_http.py -v     # HTTP endpoints pausar/reanudar
```

### Tests JavaScript/TypeScript (PBT + unitarios)

```bash
cd tests
npm install
npm test

# Tests individuales
npm run test:ws-frontend    # Property 1 (frontend): Round-trip protocolo
npm run test:crud           # CRUD MongoDB (requiere mongo corriendo)
npm run test:mongodb        # Property 2: Round-trip MongoDB
```

### Tests de componentes Vue 3

```bash
cd tests/vue
npm install
npx vitest run
```

### Tests E2E (Playwright)

```bash
cd tests
npx playwright install
npm run test:e2e
```

## Estructura del proyecto

```
├── correos-webapp/                  # Aplicación web (Meteor 3.x + Vue 3)
│   ├── client/
│   │   ├── index.html               # Página principal
│   │   ├── main.js                  # Punto de entrada (monta Vue 3)
│   │   └── main.css                 # Estilos globales (Tailwind CSS)
│   ├── server/
│   │   └── server_methods.js        # Métodos Meteor (async/await)
│   ├── imports/
│   │   ├── api/                     # Lógica de datos (colecciones MongoDB)
│   │   │   ├── config/              # Configuración de la máquina
│   │   │   ├── images/              # Gestión de imágenes de sellos
│   │   │   └── orders/              # Registro de pedidos/ventas
│   │   └── ui/
│   │       ├── App.vue              # Componente raíz Vue 3
│   │       ├── router.ts            # Vue Router (rutas SPA)
│   │       ├── views/               # Vistas principales
│   │       │   ├── HomeView.vue
│   │       │   ├── KioskoView.vue
│   │       │   ├── ImprimirView.vue
│   │       │   ├── MaquinaView.vue
│   │       │   └── SubirImagenView.vue
│   │       ├── components/          # Componentes reutilizables
│   │       │   ├── NavComponent.vue
│   │       │   └── ImageCropDialog.vue
│   │       └── composables/         # Lógica compartida (Composition API)
│   │           ├── useWebSocket.ts
│   │           ├── useConfig.ts
│   │           ├── useOrders.ts
│   │           └── useImages.ts
│   ├── .meteor/                     # Configuración Meteor 3.0
│   └── package.json
│
├── demonio/                         # Demonio Python 3.12 (impresión)
│   ├── servidor_ws_nuevo.py         # Servidor WebSocket asyncio (puerto 8000)
│   ├── servidor_http.py             # Servidor HTTP aiohttp (puerto 8001)
│   ├── report.py                    # Generador de PDFs (reportlab)
│   ├── requirements.txt             # Dependencias Python pinned
│   ├── fonts/                       # Fuentes tipográficas
│   └── images/                      # Imágenes de sellos
│
├── tests/                           # Tests
│   ├── test_ws_roundtrip.py         # PBT Property 1: round-trip mensaje
│   ├── test_ws_echo.py             # PBT Property 3: echo integridad
│   ├── test_ws_resilience.py        # PBT Property 4: resiliencia
│   ├── test_pdf_dimensions.py       # PBT Property 5: dimensiones PDF
│   ├── test_servidor_http.py        # Unit: HTTP endpoints
│   ├── test_mongodb_roundtrip.js    # PBT Property 2: round-trip MongoDB
│   ├── test_mongodb_crud.js         # Unit: CRUD MongoDB
│   ├── test_meteor_methods.js       # Unit: métodos del servidor
│   ├── test_ws_protocol_frontend.ts # PBT Property 1 (JS): protocolo frontend
│   ├── vue/                         # Tests de componentes Vue 3
│   └── e2e/                         # Tests E2E (Playwright)
│
├── docker-compose.yml               # Orquestación de servicios
├── Dockerfile.meteor                # Imagen Meteor 3.x + Node 20
├── Dockerfile.demonio               # Imagen Python 3.12 + websockets
└── README.md
```

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose (correos-net)              │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   meteor-app     │    │  demonio-python  │              │
│  │   (Node 20)      │    │  (Python 3.12)   │              │
│  │                  │    │                  │              │
│  │  Vue 3 + Router  │───▶│  WebSocket:8000  │──▶ CUPS      │
│  │  Tailwind CSS    │    │  HTTP:8001       │              │
│  │  Meteor 3.x      │    │  reportlab PDF   │              │
│  └────────┬─────────┘    └──────────────────┘              │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │    MongoDB 7.x   │                                      │
│  │    (mongo:27017)  │                                      │
│  └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

## Protocolo WebSocket

La webapp envía mensajes al demonio con campos separados por `*¿?*` (31 campos). El demonio responde con un echo del mismo mensaje tras procesar la impresión.

## Configurar impresora

La impresora se configura via variables de entorno en `docker-compose.yml`:

```yaml
environment:
  - PRINTER_1=Brother_QL_820NWB
  - PRINTER_2=Brother_QL_820NWB
  - PRINTER_TICKET=Brother_QL_820NWB
```

Para obtener el nombre de las impresoras disponibles:

```bash
lpstat -p
```

## Tags de versión

| Tag | Descripción |
|---|---|
| `v0.1-backend-modernizado` | MongoDB 7.x + Python 3.12 + websockets |
| `v0.2-meteor-actualizado` | Meteor 3.x + Node 20 + async/await |
| `v0.3-frontend-vue3` | Vue 3 + Router + Tailwind CSS |
| `v1.0-migracion-completa` | Migración completa del stack |

## Historial de migración

La migración se realizó de forma incremental en 4 fases:

1. **Fase 1 — Backend**: MongoDB 4.4→7.x, Python 3.10→3.12, SimpleWebSocketServer→websockets (asyncio)
2. **Fase 2 — Meteor**: Meteor 1.12→3.x, Node 12→20, métodos async/await
3. **Fase 3 — Frontend**: AngularJS→Vue 3, Angular Material→Tailwind CSS, angular-ui-router→Vue Router
4. **Fase 4 — Despliegue**: Dockerfiles actualizados, tests E2E con Playwright
