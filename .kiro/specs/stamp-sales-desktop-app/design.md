# Technical Design: Stamp Sales Desktop App

## 1. Overview

Aplicacion de escritorio offline-first para la venta de sellos (etiquetas postales ATM) en ferias filatelicas, sustituyendo las maquinas ATM actuales por un kit portatil (portatil + impresoras + software). Dirigida a vendedores no tecnicos que necesitan una solucion plug-and-play.

La aplicacion actual usa Meteor + Vue 3 + MongoDB + Python (demonio de impresion via WebSocket). La nueva version migra a Electron con todo integrado en un solo proceso, eliminando la dependencia de Meteor y del servidor WebSocket externo.

## 2. High-Level Design

### 2.1 System Architecture

```
+-------------------------------------------------------------+
|                    RENDERER PROCESS (React)                  |
|                                                             |
|  +----------+  +----------+  +----------+  +-----------+   |
|  | Kiosko   |  | Maquina  |  | Imprimir |  | Home      |   |
|  | (Ventas) |  | (Config) |  | (Config) |  | (Menu)    |   |
|  +----+-----+  +----+-----+  +----+-----+  +-----+-----+  |
|       +-----------------------------------------------+     |
|                          | IPC via contextBridge            |
+--------------------------------------------------------------+
                           |
+--------------------------------------------------------------+
|                    MAIN PROCESS (Node.js)                    |
|                          |                                  |
|  +-------------------------------------------------------+  |
|  |              IPC Handlers Layer                        |  |
|  +--+--------+--------+--------+--------+---------------+  |
|     |        |        |        |        |                   |
|  +--v--+ +---v---+ +--v---+ +-v----+ +-v--------+         |
|  |Config| |Orders | |Print | |PDF   | |Sync      |         |
|  |Store | |Store  | |Queue | |Gen.  | |Engine    |         |
|  +--+---+ +---+---+ +--+--+ +--+---+ +----+-----+         |
|     |         |         |       |          |                |
|  +--v---------v---------v-------v----------v-----------+    |
|  |                    SQLite DB                        |    |
|  +-----------------------------------------------------+    |
|                    |                |                        |
+--------------------|----|-----------|------------------------+
                     |    |           |
              +------v-+  |    +------v------+
              |Impresora|  |    |  Cloud API  |
              |Sellos x2|  |    |  (opcional) |
              +---------+  |    +-------------+
                    +------v------+
                    |Impresora    |
                    |Tickets      |
                    +-------------+
```

### 2.2 Legacy vs New Architecture Mapping

| Legacy Component | New Component | Notes |
|---|---|---|
| Meteor Server + MongoDB | Electron Main Process + SQLite | Sin servidor externo |
| Vue 3 (renderer) | React 18 + TypeScript (renderer) | Misma estructura de vistas |
| Python daemon (WebSocket) | Node.js module (main process) | Integrado, sin WS |
| WebSocket protocol (*z?*) | IPC channels (typed) | Tipado, sin parsing manual |
| reportlab (Python PDF) | pdfkit / @pdfme/generator (Node.js) | PDF generation in-process |
| CUPS/IPP (printer_backend.py) | Node.js native printing (electron print API + IPP) | Misma logica, integrada |
| Meteor.subscribe (reactivity) | Zustand stores + IPC events | Reactivo via eventos |

### 2.3 Views (Matching Legacy Navigation)

La app replica las 5 vistas del sistema antiguo:

| Ruta | Vista | Descripcion |
|---|---|---|
| `/home` | HomeView | Menu principal con accesos a configuracion y maquina |
| `/kiosko` | KioskoView | **Vista principal de venta**: tabla de tarifas, carrito, impresion |
| `/maquina` | MaquinaView | Config de codigo etiqueta, ticket, rollos |
| `/imprimir` | ImprimirView | Config de perfil, eventos, tarifas |
| `/subir-imagen` | SubirImagenView | Subida de imagenes de fondo para sellos |

### 2.4 Components

| Componente | Tecnologia | Responsabilidad |
|---|---|---|
| Desktop Shell | Electron 30+ | Ventana principal, ciclo de vida, acceso a sistema |
| Frontend UI | React 18 + TypeScript | Interfaz de usuario, navegacion, estado de UI |
| Styling | Tailwind CSS + shadcn/ui | Componentes visuales (mantiene aspecto del legacy) |
| State Management | Zustand | Estado global del frontend |
| Database | better-sqlite3 | Persistencia local, offline-first |
| PDF Generation | @pdfme/generator o pdfkit | Generacion de etiquetas y tickets en PDF |
| Printer Integration | Node.js (main process) | IPP/CUPS print commands |
| Sync Engine | Custom (main process) | Sincronizacion con cloud opcional |
| Build/Package | electron-builder | Empaquetado como instalador .exe |


### 2.5 Data Model (SQLite - migrado de MongoDB)

La base de datos legacy tiene 3 colecciones MongoDB: `config`, `orders`, `images`. Se migran a tablas SQLite:

```sql
-- Configuracion global (replica del documento unico en Config collection)
-- En el legacy era UN solo documento MongoDB con 4 secciones: ticket, codigo, sello, precios
CREATE TABLE config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT NOT NULL -- JSON con la estructura completa de configuracion
);

-- Ejemplo de estructura JSON en config.data:
-- {
--   "ticket": {
--     "feria": "XLIX Feria Nacional Sello",
--     "lugar": "Plaza Mayor - Madrid",
--     "fecha": "auto",
--     "hora": "auto",
--     "titulo": "Factura Simplificada",
--     "tituloCopia": "COPIA Factura Simplificada",
--     "rollo1": 1500,
--     "rollo2": 1500,
--     "tickets": 450,
--     "limiteTickets": 450,
--     "limiteImporte": 399.99,
--     "NUEVOlimiteImporte": 399.99,
--     "empresa": "S.E. Correos y Telegrafos S.A., S.M.E.",
--     "cif": "A83052407",
--     "cp": "28042 Madrid",
--     "l1": "Exento de impuestos",
--     "l2": "Objeto de coleccionismo",
--     "l3": "No se admiten devoluciones",
--     "T1especial": 0,
--     "T2especial": 0,
--     "T3especial": 0,
--     "TEmod1": "N",
--     "TEmod2": "N",
--     "ImprimeCopiaTicket": "S",
--     "ImprimeMasterTicket": "N",
--     "bloqueado": "DESBLOQUEADO"
--   },
--   "codigo": {
--     "modo": "P",
--     "mes": 0,
--     "annio": "auto",
--     "pais": "ES",
--     "maquina": "CH17",
--     "cliente": 1,
--     "producto": 1
--   },
--   "sello": {
--     "elperfil": 6,
--     "elnperfil": "FERIA",
--     "elevento": 0,
--     "elnevento": "Feria Madrid 2025",
--     "feria": "XLIX Feria Nacional Sello",
--     "lugar": "Plaza Mayor Madrid",
--     "nperfil1": "Filatelia",
--     "nperfil2": "Esporadicos",
--     "nperfil3": "SPDE",
--     "nperfil4": "",
--     "nperfil5": "Abono/Envio",
--     "nperfil6": "FERIA",
--     "nevento0": "Feria Madrid", "nferia0": "...", "nlugar0": "...",
--     "motivoi0": "NombreModeloIzq", "motivod0": "NombreModeloDer",
--     "fecha0": "21-24 abril 2025", "localidad0": "Madrid",
--     ... (hasta evento7)
--   },
--   "precios": {
--     "tarifaA": 0.50,
--     "tarifaA2": 0.60,
--     "tarifaB": 1.25,
--     "tarifaC": 1.35,
--     "tarifaTA": 2.00,
--     "tarifaT4": 3.70
--   }
-- }

-- Pedidos/ventas (replica de la coleccion Orders)
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    venue TEXT,
    machine TEXT,
    vend_type TEXT NOT NULL,
    product_name TEXT,
    transaction_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_set INTEGER NOT NULL,
    total_stamps INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    value REAL NOT NULL,
    payment_status TEXT,
    sesion_id INTEGER,
    etiquetas_rollo1 INTEGER,
    etiquetas_rollo2 INTEGER,
    etiqueta_mes TEXT,
    titulo_evento TEXT,
    feria TEXT,
    lugar TEXT,
    fecha TEXT,
    mes TEXT,
    annio TEXT,
    documento TEXT,
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Imagenes de fondo para sellos (replica de la coleccion Images)
CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT,
    size INTEGER,
    data TEXT NOT NULL, -- Base64 data URI
    created_at TEXT DEFAULT (datetime('now'))
);

-- Cola de impresion (nueva, mejora sobre el legacy que no tenia persistencia)
CREATE TABLE print_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    printer_target TEXT NOT NULL CHECK(printer_target IN ('printer1', 'printer2', 'ticket')),
    pdf_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'printing', 'completed', 'error')),
    file_path TEXT,
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Log de sincronizacion
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
    payload TEXT,
    synced INTEGER DEFAULT 0,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 2.6 Communication Flow (IPC)

```
Renderer (React)  --contextBridge-->  Preload  --ipcRenderer-->  Main Process
                                                                       |
                                                                       v
                                                              IPC Handler Router
                                                                       |
                                                    +------------------+------------------+
                                                    v                  v                  v
                                              Config Repo      Print Service       Sync Engine
                                              Orders Repo      PDF Generator
                                              Images Repo
```

Channels IPC principales:
- `config:get` / `config:update` -- Leer/actualizar configuracion global
- `config:updateMaquina` -- Actualizar seccion maquina (codigo + ticket)
- `config:updateImprimir` -- Actualizar seccion imprimir (sello + precios)
- `config:updateSesion` -- Incrementar ID cliente
- `config:updateRollos` -- Decrementar rollos tras venta
- `orders:insert` -- Insertar lineas de pedido
- `orders:downloadCSV` -- Exportar pedidos como CSV
- `images:upload` -- Subir imagen base64
- `images:remove` -- Eliminar imagen
- `printer:status` -- Estado de impresoras conectadas
- `printer:print` -- Ejecutar impresion (genera PDFs + envia)
- `printer:pause` -- Pausar impresora
- `printer:resume` -- Reanudar impresora
- `sync:status` -- Estado de conectividad
- `sync:trigger` -- Forzar sincronizacion


## 3. Low-Level Design

### 3.1 Project Structure

```
stamp-sales-app/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── index.ts                    # Entry point Electron
│   │   ├── database/
│   │   │   ├── connection.ts           # Inicializacion SQLite
│   │   │   ├── migrations/
│   │   │   │   └── 001_initial.sql     # Schema inicial
│   │   │   └── repositories/
│   │   │       ├── config.repository.ts
│   │   │       ├── orders.repository.ts
│   │   │       ├── images.repository.ts
│   │   │       └── print-queue.repository.ts
│   │   ├── printing/
│   │   │   ├── printer-manager.ts      # Deteccion y gestion (IPP/CUPS)
│   │   │   ├── pdf-generator.ts        # Generacion de PDFs (sellos + tickets)
│   │   │   ├── stamp-renderer.ts       # Layout de etiqueta 55x25mm
│   │   │   ├── ticket-renderer.ts      # Layout de ticket 78xVARmm
│   │   │   └── print-queue.service.ts  # Procesamiento de cola
│   │   ├── sync/
│   │   │   ├── sync-engine.ts
│   │   │   ├── connectivity.ts
│   │   │   └── conflict-resolver.ts
│   │   └── ipc/
│   │       ├── handlers.ts             # Registro de handlers
│   │       ├── config.handlers.ts
│   │       ├── orders.handlers.ts
│   │       ├── images.handlers.ts
│   │       ├── printer.handlers.ts
│   │       └── sync.handlers.ts
│   ├── preload/
│   │   └── index.ts                    # contextBridge API
│   └── renderer/
│       ├── index.html
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── router.tsx              # Rutas: home, kiosko, maquina, imprimir, subir-imagen
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── NavComponent.tsx
│       │   │   │   └── MainLayout.tsx
│       │   │   ├── kiosko/             # Vista principal de venta
│       │   │   │   ├── StampModels.tsx      # Imagenes modelo1/modelo2
│       │   │   │   ├── CartControls.tsx     # Cesta, total, acciones
│       │   │   │   ├── TariffTable.tsx      # Tabla de tarifas (A, A2, B, C, Tiras)
│       │   │   │   ├── TariffRow.tsx        # Fila individual de tarifa
│       │   │   │   └── RollCounters.tsx     # Contadores de rollos al pie
│       │   │   ├── maquina/            # Configuracion maquina
│       │   │   │   ├── CodigoSection.tsx    # Codigo etiqueta
│       │   │   │   ├── TicketSection.tsx    # Config ticket
│       │   │   │   ├── RollosSection.tsx    # Gestion de rollos
│       │   │   │   └── TirasSection.tsx     # Tiras especiales
│       │   │   ├── imprimir/           # Configuracion impresion
│       │   │   │   ├── PerfilSection.tsx    # Perfil/modo de venta
│       │   │   │   ├── EventoSection.tsx    # Gestion de eventos (0-7)
│       │   │   │   ├── TarifaSection.tsx    # Precios de tarifas
│       │   │   │   └── PerfilesSection.tsx  # Edicion de perfiles
│       │   │   ├── home/
│       │   │   │   └── HomeMenu.tsx
│       │   │   ├── images/
│       │   │   │   └── ImageUpload.tsx
│       │   │   └── ui/                 # shadcn/ui components
│       │   ├── stores/
│       │   │   ├── config.store.ts     # Estado de configuracion reactivo
│       │   │   ├── kiosko.store.ts     # Cantidades del carrito de venta
│       │   │   ├── orders.store.ts     # Historial de pedidos
│       │   │   └── printer.store.ts    # Estado de impresoras
│       │   ├── hooks/
│       │   │   ├── useConfig.ts
│       │   │   ├── usePrinter.ts
│       │   │   └── useKiosko.ts
│       │   ├── types/
│       │   │   ├── config.ts           # Tipos para ConfigDocument
│       │   │   ├── order.ts            # Tipos para OrderLine
│       │   │   └── printer.ts
│       │   └── lib/
│       │       ├── ipc-client.ts       # Wrapper tipado sobre IPC
│       │       ├── tariff-calc.ts      # Calculos de limites y totales
│       │       └── code-formatter.ts   # Formateo codigo etiqueta
│       └── styles/
│           └── globals.css
├── resources/
│   ├── fonts/                          # Franklin Gothic (migrado del legacy)
│   │   ├── franklin_gothic.ttf
│   │   ├── franklin_gothic_bold.ttf
│   │   └── franklin_gothic_condensed.ttf
│   ├── images/                         # Fondos etiquetas y tickets
│   │   ├── fondoetiqueta-nada.png
│   │   ├── fondoticketori.png
│   │   ├── fondoticketcop.png
│   │   ├── image2.jpg                  # Logo Correos para tickets
│   │   └── ... (motivos de sellos)
│   └── icon.ico
└── build/
    └── installer.nsh
```

### 3.2 Key Interfaces (TypeScript)

```typescript
// === Config Types (replican la estructura MongoDB del legacy) ===

interface TicketConfig {
  feria: string;
  lugar: string;
  fecha: string; // "auto" | fecha manual
  hora: string;  // "auto" | hora manual
  titulo: string;
  tituloCopia: string;
  eltitulo?: string;
  rollo1: number;
  rollo2: number;
  tickets: number;
  limiteTickets: number;
  limiteImporte: number;
  NUEVOlimiteImporte?: number;
  empresa: string;
  cif: string;
  cp: string;
  l1: string;
  l2: string;
  l3: string;
  T1especial?: number;
  T2especial?: number;
  T3especial?: number;
  TEmod1?: string; // "S" | "N"
  TEmod2?: string;
  ImprimeCopiaTicket?: string; // "S" | "N"
  ImprimeMasterTicket?: string;
  bloqueado?: string; // "BLOQUEADO" | "DESBLOQUEADO"
}

interface CodigoConfig {
  modo: string;      // "P", "F", etc.
  mes: number;       // 0 = auto, 1-12 = manual
  annio: string;     // "auto" | year string
  pais: string;      // "ES", "AD", etc.
  maquina: string;   // "CH17", "FI01", etc.
  cliente: number;   // Auto-incrementing session ID
  producto: number;
}

interface EventoData {
  nevento: string;    // Nombre del evento
  nferia: string;     // Nombre feria para ticket
  nlugar: string;     // Lugar para ticket
  motivoi: string;    // Nombre imagen motivo izquierdo
  motivod: string;    // Nombre imagen motivo derecho
  fecha: string;      // Fecha para la etiqueta
  localidad: string;  // Localidad para la etiqueta
}

interface SelloConfig {
  elperfil: number;     // 1-6 (perfil activo)
  elnperfil: string;    // Nombre del perfil activo
  elevento: number;     // 0-7 (evento activo)
  elnevento: string;    // Nombre del evento activo
  feria: string;
  lugar: string;
  modelo1: string;
  modelo2: string;
  modo: number;
  nperfil1: string;     // "Filatelia"
  nperfil2: string;     // "Esporadicos"
  nperfil3: string;     // "SPDE"
  nperfil4: string;     // Editable
  nperfil5: string;     // "Abono/Envio"
  nperfil6: string;     // "FERIA"
  eventos: EventoData[]; // Array de 8 eventos (0-7)
  // Legacy flat fields (motivoi0..motivoi7 etc) se normalizan al array
}

interface PreciosConfig {
  tarifaA: number;
  tarifaA2: number;
  tarifaB: number;
  tarifaC: number;
  tarifaTA?: number;  // Tira tarifa A
  tarifaT4?: number;  // Tira 4 tarifas
}

interface AppConfig {
  ticket: TicketConfig;
  codigo: CodigoConfig;
  sello: SelloConfig;
  precios: PreciosConfig;
}

// === Order Types (replican OrderLine del legacy) ===

interface OrderLine {
  id?: number;
  event: string;
  venue: string;
  machine: string;
  vendType: string;       // "Tarifa A Tira 4" | "Tira de 4 Tarifas" | "Etiqueta individual"
  productName: string;
  transactionDate: string;
  quantity: number;
  quantitySet: number;    // 1 para simple, 4 para tiras
  totalStamps: number;    // quantity * quantitySet
  currency: string;
  value: number;
  paymentStatus: string;  // Modo de impresion/perfil
  sesionId: number;
  etiquetasRollo1: number;
  etiquetasRollo2: number;
  etiquetaMes: string;
  tituloEvento: string;
  feria: string;
  lugar: string;
  fecha: string;
  mes: number | string;
  annio: string;
  documento: string;
}

// === Kiosko State (cantidades en la vista de venta) ===

interface KioskoQuantities {
  // Modelo 1 (izquierdo / printer1)
  tarifaAS1: number;    // Tarifa A simple
  tarifaA2S1: number;   // Tarifa A2 simple
  tarifaBS1: number;    // Tarifa B simple
  tarifaCS1: number;    // Tarifa C simple
  tarifaAT1: number;    // Tira tarifa A
  tarifa4T1: number;    // Tira 4 tarifas
  // Modelo 2 (derecho / printer2)
  tarifaAS2: number;
  tarifaA2S2: number;
  tarifaBS2: number;
  tarifaCS2: number;
  tarifaAT2: number;
  tarifa4T2: number;
}

// === Printer Types ===

interface PrinterInfo {
  id: string;
  name: string;
  target: 'printer1' | 'printer2' | 'ticket';
  status: 'ready' | 'busy' | 'error' | 'disconnected' | 'paused';
  uri: string;
}

interface PrintJob {
  id: number;
  orderId?: number;
  printerTarget: 'printer1' | 'printer2' | 'ticket';
  pdfType: string;
  status: 'pending' | 'printing' | 'completed' | 'error';
  filePath?: string;
  attempts: number;
  errorMessage?: string;
}

// === Preload API (exposed to renderer) ===

interface ElectronAPI {
  config: {
    get(): Promise<AppConfig>;
    updateMaquina(data: { ticket: Partial<TicketConfig>; codigo: Partial<CodigoConfig> }): Promise<void>;
    updateImprimir(data: { sello: Partial<SelloConfig>; precios: PreciosConfig }): Promise<void>;
    updateSesion(): Promise<void>;
    updateSesionError(): Promise<void>;
    updateRollos(sellos1: number, sellos2: number, tickets: number): Promise<void>;
    updateRollosRevert(sellos1: number, sellos2: number, tickets: number): Promise<void>;
    initConfig(): Promise<void>;
    onChange(callback: (config: AppConfig) => void): () => void;
  };
  orders: {
    insert(orders: OrderLine[]): Promise<void>;
    downloadCSV(): Promise<string>;
  };
  images: {
    upload(name: string, dataUri: string, type: string, size: number): Promise<void>;
    remove(name: string): Promise<void>;
    getByName(name: string): Promise<{ name: string; url: string } | null>;
  };
  printer: {
    getStatus(): Promise<PrinterInfo[]>;
    print(config: AppConfig, quantities: KioskoQuantities, profile: string): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    getQueue(): Promise<PrintJob[]>;
  };
  sync: {
    getStatus(): Promise<{ connected: boolean; lastSync: string | null; pending: number }>;
    triggerSync(): Promise<void>;
  };
}
```

### 3.3 Key Algorithms

#### Sale Process (Kiosko - replicando logica del legacy)

```
1. Vendedor selecciona cantidades por tarifa en la tabla (ambos modelos)
2. La app calcula total y limites en tiempo real (misma logica que KioskoView.vue)
3. Vendedor pulsa "Imprimir Normal" (carrito icon)
4. Renderer llama a electronAPI.printer.print(config, quantities, 'normal')
5. Main process:
   a. Incrementa config.codigo.cliente (updateSesion)
   b. Decrementa rollos segun cantidades (updateRollos)
   c. Genera registros de OrderLine y los inserta en orders table
   d. Genera PDFs:
      - Para cada tarifa con cantidad > 0 en modelo1: stamp_simple_1_X.pdf
      - Para cada tarifa con cantidad > 0 en modelo2: stamp_simple_2_X.pdf
      - Si hay tiras: stamp_tira_1.pdf, stamp_tira_2.pdf
      - Si tiras especiales activas: stamp_tira_X_especial.pdf
      - Ticket principal: ticket.pdf (tamano variable segun items)
      - Si ImprimeCopiaTicket="S": ticket con fondo copia
      - Si ImprimeMasterTicket="S": ticket master set
   e. Envia PDFs a impresoras:
      - stamp_*_1_* -> PRINTER_1 (options: media=DC55x25, orientation=6)
      - stamp_*_2_* -> PRINTER_2
      - ticket* -> PRINTER_TICKET (options: media=Custom.78xVARmm)
   f. Registra en sync_log
6. Renderer recibe confirmacion y resetea cantidades a 0

Perfiles especiales (Filatelia, Protocolo, SPDE):
- Modifican el titulo del ticket
- Se disparan desde botones dedicados en KioskoView
```

#### Limit Calculation (replicando logica legacy exacta)

```typescript
// Limite por tarifa = MIN(
//   floor((limiteImporte - totalActual) / precioTarifa),
//   stockRolloCorrespondiente - usadoDelRollo
//   [para tiras: tambien min con tickets disponibles]
// )

function calcLimiteSimple(
  limite: number, total: number, precio: number, rolloDisponible: number
): number {
  return Math.min(
    Math.floor((limite - total) / precio),
    rolloDisponible
  );
}

function calcLimiteTira(
  limite: number, total: number, precio: number,
  rolloDisponible: number, ticketsDisponibles: number
): number {
  return Math.min(
    Math.floor((limite - total) / precio),
    ticketsDisponibles,
    Math.floor(rolloDisponible / 4)
  );
}
```

#### PDF Generation (stamp label 55x25mm)

```
Etiqueta con fondo de imagen:
1. Canvas 55mm x 25mm
2. Dibujar fondo: fondoetiqueta1.png / fondoetiqueta2.png / fondoetiqueta-nada.png
3. Texto tarifa (Franklin Gothic 12pt) en (2mm, 19.5mm)
4. Texto evento (Franklin Gothic 9pt) alineado derecha en (53mm, 19mm)
5. Texto fecha (Franklin Gothic 9pt) alineado derecha en (53mm, 15mm)
6. Texto codigo (Franklin Gothic 6pt) en (2mm, 15mm)
   Formato codigo: {modo}{mes}{pais}{annio} {maquina}-{cliente4digitos}-{producto3digitos}

Variaciones:
- genStampI/genStampD: con fondo de imagen del motivo (normal)
- genStampImdcc/genStampDmdcc: sin fondo (para codigos MD/FI que no imprimen logo)
- genStampE1/E2: tiras especiales con fondo TiraEspecial1-4.png
```

#### Error Recovery (Anular Venta)

```
1. Vendedor pulsa "Error impresion" (carrito-error icon)
2. Decrementa config.codigo.cliente (updateSesionError)
3. Revierte rollos: updateRollosRevert con las cantidades de la ultima venta
4. Inserta OrderLine con event="ERROR IMPRESION" para auditoria
```

### 3.4 Technology Decisions

| Decision | Eleccion | Alternativas | Justificacion |
|---|---|---|---|
| Framework desktop | Electron | Tauri | Ecosistema maduro, mejor soporte Node.js nativo para impresion |
| Frontend | React 18 + TS | Vue 3 (como el legacy) | Mayor pool de devs, shadcn ecosystem. La estructura de componentes se mapea 1:1 |
| Build tool | electron-vite | Webpack | Rapido, HMR, configuracion simple |
| DB | better-sqlite3 | MongoDB embedded | Sincrono, sin overhead, schema fijo para integridad |
| PDF | pdfkit (Node.js) | reportlab port | Node nativo, mismas capacidades que reportlab, integrado en main process |
| State | Zustand | Redux | Minimo boilerplate, suficiente para esta app |
| UI | Tailwind + shadcn | MUI | El legacy ya usaba Tailwind, consistencia |
| Printing | IPP directo + CUPS fallback | Electron print API | Replica la logica del legacy printer_backend.py. CUPS en Ubuntu (dev), IPP en Windows (prod). Epson para testing |
| IDs | Auto-increment SQLite | nanoid | Mas simple, los IDs no necesitan ser globalmente unicos |
| Config storage | JSON en SQLite | Separate tables | La config es un documento flexible (como MongoDB), JSON preserva estructura |

### 3.5 Development & Testing Environment

| Aspecto | Entorno |
|---|---|
| **Desarrollo** | Ubuntu (Linux) |
| **Testing / Produccion** | Windows 10/11 (64-bit) |
| **Impresora de test** | Epson (modelo a confirmar) |
| **Impresoras produccion** | Brother QL/TD series (etiquetas) + impresora tickets |

**Implicaciones para el desarrollo:**

1. **Cross-platform build**: electron-builder debe configurarse para generar:
   - Paquetes `.deb`/AppImage para desarrollo local en Ubuntu
   - Instalador `.exe` (NSIS) para Windows (target de produccion)
   - Build: `npm run build:linux` (dev) y `npm run build:win` (release)

2. **Printer abstraction layer**: El modulo de impresion debe soportar:
   - **CUPS** (Ubuntu, desarrollo) — comandos `lp`, `cupsdisable`, `cupsenable`
   - **IPP directo** (Windows, produccion) — protocolo IPP sobre HTTP
   - **Epson drivers** (testing) — Epson usa ESC/P o IPP segun modelo
   - Auto-deteccion del backend segun SO (como hace el legacy `printer_backend.py`)

3. **Testing strategy**:
   - Unit tests y property-based tests corren en Ubuntu (CI/desarrollo)
   - Integration tests con impresora Epson se ejecutan en la maquina Windows
   - E2E tests con Playwright/Spectron en ambos entornos
   - Mock de impresora para tests automatizados (genera PDF sin enviar)

4. **Path handling**: Usar `path.join()` y `app.getPath()` de Electron siempre. Nunca hardcodear separadores `/` o `\`.

5. **Font loading**: Las fuentes Franklin Gothic deben cargarse con rutas relativas a `resources/` usando `__dirname` o `app.getAppPath()`.

### 3.6 Non-Functional Requirements

- **Arranque**: < 3 segundos hasta vista Kiosko operativa
- **Impresion**: < 2 segundos desde click hasta envio a impresora (excluyendo generacion PDF compleja)
- **Offline**: 100% funcional sin conexion a internet
- **Instalacion**: Un solo .exe para Windows, sin dependencias externas, sin Java/Python
- **Auto-arranque**: Opcion de iniciar con Windows al encender portatil
- **Tamano etiqueta**: 55mm x 25mm exactos (critico para calibracion de impresora)
- **Tamano ticket**: 78mm ancho x altura variable (segun items vendidos)
- **Fuentes**: Franklin Gothic (3 variantes) embebidas en la app
- **Impresoras soportadas**: Epson (test), Brother QL/TD series (produccion), cualquier IPP-compatible
- **Plataforma target**: Windows 10/11 (64-bit). Desarrollo en Ubuntu Linux
- **Almacenamiento**: SQLite soporta hasta 100k+ ordenes sin degradacion
- **Compatibilidad impresora**: Capa de abstraccion que soporte CUPS (Linux) e IPP (Windows/red)

## 4. Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones válidas del sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre especificaciones legibles por humanos y garantías de corrección verificables por máquina.*

### Property 1: Cálculo correcto del total de la cesta

*Para cualquier* conjunto de cantidades (0 o más por cada tarifa y modelo) y cualquier conjunto de precios positivos, el total de la cesta debe ser igual a la suma de (cantidad × precio) para cada combinación tarifa/modelo, y una venta se acepta si y solo si el total ≤ Límite_Importe.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Cálculo correcto de límites por tarifa

*Para cualquier* estado de la cesta (cantidades parciales), precios positivos, stock de rollos y límite de importe, el límite de una tarifa simple debe ser min(floor((límite - total) / precio), stockRollo), y el límite de una tira debe ser min(floor((límite - total) / precio), ticketsDisponibles, floor(stockRollo / 4)).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Formato correcto del Código de Etiqueta

*Para cualquier* configuración válida de código (modo, mes 1-12, país, año, máquina, cliente 0-9999, producto), el código formateado debe cumplir el patrón `{modo}{mesFormateado}{país}{año2dígitos} {máquina}-{cliente4dígitos}-{producto3dígitos}`, donde los meses 10/11/12 se representan como O/N/D y el cliente lleva padding de ceros a 4 dígitos.

**Validates: Requirements 3.1, 3.4, 3.7**

### Property 4: Round-trip de venta y anulación (integridad de sesión y rollos)

*Para cualquier* venta válida (cantidades que no excedan stock ni límite), ejecutar la venta seguida de una anulación debe restaurar el estado exacto anterior: `cliente` vuelve al valor original, rollo1/rollo2/tickets vuelven a sus valores previos.

**Validates: Requirements 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 10.2, 10.3**

### Property 5: Decremento correcto de rollos

*Para cualquier* conjunto de cantidades por tarifa y modelo, el decremento de rollo debe ser: rollo_N -= (simples_modelo_N + 4 × tiras_modelo_N), y tickets -= (total_tiras + 2). Un intento de vender más etiquetas que el stock disponible debe ser rechazado.

**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

### Property 6: Bloqueo de evento por estado de rollos

*Para cualquier* configuración donde ambos rollos estén instalados (rollo1 ≠ -1 Y rollo2 ≠ -1), cambiar el evento activo debe ser rechazado. *Para cualquier* configuración donde ambos rollos estén quitados (rollo1 = -1 Y rollo2 = -1), cambiar el evento debe ser permitido.

**Validates: Requirements 5.1, 5.2**

### Property 7: Generación correcta de PDFs por venta

*Para cualquier* conjunto de cantidades válidas, el sistema debe generar exactamente un PDF de etiqueta por cada combinación tarifa/modelo con cantidad > 0, cada PDF con dimensiones 55x25mm. Las tiras generan exactamente 4 etiquetas por trabajo. El número total de trabajos de impresión es determinista dado las cantidades.

**Validates: Requirements 6.1, 6.5, 6.6**

### Property 8: Título del ticket según perfil activo

*Para cualquier* título base y perfil activo, el título del ticket debe ser: "Filatelia de: {base}" si perfil=Filatelia, "Protocolo de: {base}" si perfil=Protocolo, "SPDE de: {base}" si perfil=SPDE, y "{base}" para el resto.

**Validates: Requirements 7.3, 7.4, 7.5**

### Property 9: Enrutamiento determinista de impresión

*Para cualquier* trabajo de impresión generado, las etiquetas del modelo1 deben enrutarse exclusivamente a PRINTER_1, las del modelo2 a PRINTER_2, y todos los tickets a PRINTER_TICKET. Las opciones de media deben ser DC55x25 para etiquetas y Custom.78x{altura}mm para tickets.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 10: Atomicidad de transacciones de venta

*Para cualquier* venta donde se inyecte un fallo en cualquier punto del proceso (después de incrementar sesión, después de decrementar rollos, o durante inserción de órdenes), todos los cambios previos deben ser revertidos y no deben generarse PDFs.

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 11: Round-trip de persistencia de configuración

*Para cualquier* configuración válida de código, ticket, sello o precios, escribirla en la base de datos y leerla de vuelta debe producir un objeto equivalente al original.

**Validates: Requirements 12.1, 12.2**

### Property 12: Round-trip de exportación CSV

*Para cualquier* conjunto de órdenes insertadas en la base de datos, la exportación CSV con separador punto y coma debe contener exactamente todas las órdenes con todos sus campos, de forma que parsear el CSV de vuelta produzca los mismos registros.

**Validates: Requirements 15.1, 15.2**

### Property 13: Idempotencia de sincronización

*Para cualquier* conjunto de registros pendientes de sincronizar, ejecutar la sincronización N veces (N ≥ 1) debe producir el mismo resultado que ejecutarla una sola vez, sin duplicar registros en el destino.

**Validates: Requirement 16.4**

### Property 14: Límite según perfil activo

*Para cualquier* perfil activo, si el perfil es 6 (FERIA) el límite de importe debe ser `limiteImporte`, y para cualquier otro perfil debe ser `NUEVOlimiteImporte` (o `limiteImporte` si no está definido).

**Validates: Requirement 13.4**

### Property 15: Round-trip de imágenes

*Para cualquier* imagen válida (nombre único + data URI base64), subirla al sistema y recuperarla por nombre debe devolver los mismos datos. Eliminarla y luego buscarla debe devolver null.

**Validates: Requirements 14.1, 14.2**
