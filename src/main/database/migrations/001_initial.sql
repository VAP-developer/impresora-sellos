-- Migration 001: Initial schema
-- Creates all base tables for the Stamp Sales Desktop App
-- Migrated from MongoDB collections: config, orders, images

-- Configuracion global (replica del documento unico en Config collection)
-- En el legacy era UN solo documento MongoDB con 4 secciones: ticket, codigo, sello, precios
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data TEXT NOT NULL -- JSON con la estructura completa de configuracion
);

-- Pedidos/ventas (replica de la coleccion Orders)
CREATE TABLE IF NOT EXISTS orders (
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
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT,
    size INTEGER,
    data TEXT NOT NULL, -- Base64 data URI
    created_at TEXT DEFAULT (datetime('now'))
);

-- Cola de impresion (nueva, mejora sobre el legacy que no tenia persistencia)
CREATE TABLE IF NOT EXISTS print_queue (
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
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
    payload TEXT,
    synced INTEGER DEFAULT 0,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
