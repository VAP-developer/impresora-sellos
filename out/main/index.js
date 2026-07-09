"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Database = require("better-sqlite3");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const util = require("util");
const promises = require("fs/promises");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
function ensureMigrationsTable(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
function getAppliedMigrations(db2) {
  const rows = db2.prepare("SELECT name FROM _migrations ORDER BY id ASC").all();
  return rows.map((row) => row.name);
}
function getMigrationsPath() {
  const isDev = !electron.app.isPackaged;
  if (isDev) {
    return path.join(electron.app.getAppPath(), "src", "main", "database", "migrations");
  }
  return path.join(process.resourcesPath, "migrations");
}
function discoverMigrationFiles(migrationsPath) {
  try {
    const files = fs.readdirSync(migrationsPath);
    return files.filter((f) => f.endsWith(".sql")).sort((a, b) => a.localeCompare(b, void 0, { numeric: true }));
  } catch {
    return [];
  }
}
function runMigrations(db2, migrationsPath) {
  const resolvedPath = getMigrationsPath();
  ensureMigrationsTable(db2);
  const applied = new Set(getAppliedMigrations(db2));
  const files = discoverMigrationFiles(resolvedPath);
  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    return [];
  }
  const appliedNow = [];
  for (const file of pending) {
    const filePath = path.join(resolvedPath, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    const runMigration = db2.transaction(() => {
      db2.exec(sql);
      db2.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });
    runMigration();
    appliedNow.push(file);
  }
  return appliedNow;
}
let db = null;
function getDatabasePath() {
  const userDataPath = electron.app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, "stamp-sales.db");
}
function initDatabase() {
  if (db) {
    return db;
  }
  const dbPath = getDatabasePath();
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  return db;
}
function getDatabase() {
  if (!db) {
    throw new Error(
      "Database not initialized. Call initDatabase() first during app startup."
    );
  }
  return db;
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
const DEFAULT_CONFIG = {
  ticket: {
    feria: "XLIX Feria Nacional Sello",
    lugar: "Plaza Mayor - Madrid",
    fecha: "auto",
    hora: "auto",
    titulo: "Factura Simplificada",
    tituloCopia: "COPIA Factura Simplificada",
    rollo1: 1500,
    rollo2: 1500,
    tickets: 450,
    limiteTickets: 450,
    limiteImporte: 399.99,
    NUEVOlimiteImporte: 399.99,
    empresa: "S.E. Correos y Telégrafos S.A., S.M.E.",
    cif: "A83052407",
    cp: "28042 Madrid",
    l1: "Exento de impuestos",
    l2: "Objeto de coleccionismo",
    l3: "No se admiten devoluciones",
    T1especial: 0,
    T2especial: 0,
    T3especial: 0,
    TEmod1: "N",
    TEmod2: "N",
    ImprimeCopiaTicket: "S",
    ImprimeMasterTicket: "N",
    bloqueado: "DESBLOQUEADO"
  },
  codigo: {
    modo: "P",
    mes: 0,
    annio: "auto",
    pais: "ES",
    maquina: "CH17",
    cliente: 1,
    producto: 1
  },
  sello: {
    elperfil: 6,
    elnperfil: "FERIA",
    elevento: 0,
    elnevento: "Feria Madrid 2025",
    feria: "XLIX Feria Nacional Sello",
    lugar: "Plaza Mayor Madrid",
    modelo1: "",
    modelo2: "",
    modo: 0,
    nperfil1: "Filatelia",
    nperfil2: "Esporadicos",
    nperfil3: "SPDE",
    nperfil4: "",
    nperfil5: "Abono/Envio",
    nperfil6: "FERIA",
    eventos: [
      { nevento: "Feria Madrid", nferia: "XLIX Feria Nacional Sello", nlugar: "Plaza Mayor Madrid", motivoi: "", motivod: "", fecha: "21-24 abril 2025", localidad: "Madrid" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" },
      { nevento: "", nferia: "", nlugar: "", motivoi: "", motivod: "", fecha: "", localidad: "" }
    ]
  },
  precios: {
    tarifaA: 0.5,
    tarifaA2: 0.6,
    tarifaB: 1.25,
    tarifaC: 1.35,
    tarifaTA: 2,
    tarifaT4: 3.7
  }
};
class ConfigRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Retrieves the current application configuration.
   * Returns null if no config exists yet.
   */
  get() {
    const row = this.db.prepare("SELECT data FROM config WHERE id = 1").get();
    if (!row) {
      return null;
    }
    return JSON.parse(row.data);
  }
  /**
   * Replaces the entire configuration with the given data.
   * Uses INSERT OR REPLACE to handle both initial insert and updates.
   */
  set(config) {
    const data = JSON.stringify(config);
    this.db.prepare("INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)").run(data);
  }
  /**
   * Updates the "maquina" sections (ticket + codigo) of the configuration.
   * Merges partial updates into existing config.
   */
  updateMaquina(updates) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.ticket = { ...config.ticket, ...updates.ticket };
    config.codigo = { ...config.codigo, ...updates.codigo };
    this.set(config);
  }
  /**
   * Updates the "imprimir" sections (sello + precios) of the configuration.
   * Merges partial sello updates; replaces precios entirely.
   */
  updateImprimir(updates) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.sello = { ...config.sello, ...updates.sello };
    config.precios = updates.precios;
    this.set(config);
  }
  /**
   * Increments the session ID (codigo.cliente) by 1.
   */
  updateSesion() {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.codigo.cliente += 1;
    this.set(config);
  }
  /**
   * Decrements the session ID (codigo.cliente) by 1 (for error reversal).
   */
  updateSesionError() {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.codigo.cliente -= 1;
    this.set(config);
  }
  /**
   * Decrements roll counters after a sale.
   * @param sellos1 - Number of labels consumed from rollo1
   * @param sellos2 - Number of labels consumed from rollo2
   * @param tickets - Number of tickets consumed
   */
  updateRollos(sellos1, sellos2, tickets) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.ticket.rollo1 -= sellos1;
    config.ticket.rollo2 -= sellos2;
    config.ticket.tickets -= tickets;
    this.set(config);
  }
  /**
   * Reverts roll counters after an error/cancellation.
   * @param sellos1 - Number of labels to restore to rollo1
   * @param sellos2 - Number of labels to restore to rollo2
   * @param tickets - Number of tickets to restore
   */
  updateRollosRevert(sellos1, sellos2, tickets) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.ticket.rollo1 += sellos1;
    config.ticket.rollo2 += sellos2;
    config.ticket.tickets += tickets;
    this.set(config);
  }
  /**
   * Initializes the configuration with default values if no config exists.
   * Only inserts the default configuration when the config table is empty (id=1 not present).
   * Called at app startup after migrations to ensure configuration is always available.
   * Replicates the legacy Meteor initConfig() behavior.
   */
  initConfig() {
    const existing = this.db.prepare("SELECT id FROM config WHERE id = 1").get();
    if (!existing) {
      this.set(structuredClone(DEFAULT_CONFIG));
    }
  }
  /**
   * Retrieves the imagenes section of the config.
   * Returns defaults ({ printSello: false, activeFair: null }) if not yet set.
   */
  getImagenes() {
    const config = this.get();
    return config?.imagenes ?? { printSello: false, activeFair: null };
  }
  /**
   * Updates only the imagenes section of the config.
   * Creates the section if it doesn't exist yet.
   */
  updateImagenes(imagenes) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.imagenes = imagenes;
    this.set(config);
  }
  /**
   * Resets the configuration to factory defaults.
   * Deletes any existing config and inserts the default.
   * Use this for a full reset (destructive operation).
   */
  resetConfig() {
    this.db.prepare("DELETE FROM config").run();
    this.set(structuredClone(DEFAULT_CONFIG));
  }
}
function registerConfigHandlers() {
  const repo = new ConfigRepository();
  handleIpc("config:get", () => {
    return repo.get();
  });
  handleIpc("config:updateMaquina", (data) => {
    repo.updateMaquina(data);
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:updateImprimir", (data) => {
    repo.updateImprimir(data);
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:updateSesion", () => {
    repo.updateSesion();
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:updateSesionError", () => {
    repo.updateSesionError();
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:updateRollos", (sellos1, sellos2, tickets) => {
    repo.updateRollos(sellos1, sellos2, tickets);
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:updateRollosRevert", (sellos1, sellos2, tickets) => {
    repo.updateRollosRevert(sellos1, sellos2, tickets);
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:initConfig", () => {
    repo.initConfig();
    notifyConfigChanged(repo.get());
  });
  handleIpc("config:getImagenes", () => {
    return repo.getImagenes();
  });
  handleIpc("config:updateImagenes", (data) => {
    repo.updateImagenes(data);
  });
}
class OrdersRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Inserts one or more order lines in a single transaction.
   * Replicates the legacy Meteor `insertOrder` method.
   */
  insert(orders) {
    const stmt = this.db.prepare(`
      INSERT INTO orders (
        event, venue, machine, vend_type, product_name,
        transaction_date, quantity, quantity_set, total_stamps,
        currency, value, payment_status, sesion_id,
        etiquetas_rollo1, etiquetas_rollo2, etiqueta_mes,
        titulo_evento, feria, lugar, fecha, mes, annio, documento
      ) VALUES (
        @event, @venue, @machine, @vendType, @productName,
        @transactionDate, @quantity, @quantitySet, @totalStamps,
        @currency, @value, @paymentStatus, @sesionId,
        @etiquetasRollo1, @etiquetasRollo2, @etiquetaMes,
        @tituloEvento, @feria, @lugar, @fecha, @mes, @annio, @documento
      )
    `);
    const insertMany = this.db.transaction((items) => {
      for (const order of items) {
        stmt.run({
          event: order.event,
          venue: order.venue ?? null,
          machine: order.machine ?? null,
          vendType: order.vendType,
          productName: order.productName ?? null,
          transactionDate: order.transactionDate,
          quantity: order.quantity,
          quantitySet: order.quantitySet,
          totalStamps: order.totalStamps,
          currency: order.currency ?? "EUR",
          value: order.value,
          paymentStatus: order.paymentStatus ?? null,
          sesionId: order.sesionId ?? null,
          etiquetasRollo1: order.etiquetasRollo1 ?? null,
          etiquetasRollo2: order.etiquetasRollo2 ?? null,
          etiquetaMes: order.etiquetaMes ?? null,
          tituloEvento: order.tituloEvento ?? null,
          feria: order.feria ?? null,
          lugar: order.lugar ?? null,
          fecha: order.fecha ?? null,
          mes: order.mes != null ? String(order.mes) : null,
          annio: order.annio ?? null,
          documento: order.documento ?? null
        });
      }
    });
    insertMany(orders);
  }
  /**
   * Returns all orders from the database ordered by creation time.
   */
  getAll() {
    const rows = this.db.prepare("SELECT * FROM orders ORDER BY id ASC").all();
    return rows.map(this.rowToOrderLine);
  }
  /**
   * Exports all orders as a CSV string with semicolon delimiter.
   * Replicates the legacy Meteor `downloadXLS` method.
   * Includes a header row followed by all order records.
   */
  exportCSV() {
    const rows = this.db.prepare("SELECT * FROM orders ORDER BY id ASC").all();
    if (rows.length === 0) {
      return "";
    }
    const delimiter = ";";
    const columns = [
      "id",
      "event",
      "venue",
      "machine",
      "vend_type",
      "product_name",
      "transaction_date",
      "quantity",
      "quantity_set",
      "total_stamps",
      "currency",
      "value",
      "payment_status",
      "sesion_id",
      "etiquetas_rollo1",
      "etiquetas_rollo2",
      "etiqueta_mes",
      "titulo_evento",
      "feria",
      "lugar",
      "fecha",
      "mes",
      "annio",
      "documento",
      "created_at"
    ];
    const lines = [];
    lines.push(columns.join(delimiter));
    for (const row of rows) {
      const values = columns.map((col) => {
        const val = row[col];
        if (val == null) return "";
        const str = String(val);
        if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      lines.push(values.join(delimiter));
    }
    return lines.join("\n");
  }
  /**
   * Returns the count of orders in the database.
   */
  count() {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM orders").get();
    return row.cnt;
  }
  /**
   * Converts a raw database row (snake_case) to an OrderLine (camelCase).
   */
  rowToOrderLine(row) {
    return {
      id: row.id,
      event: row.event,
      venue: row.venue ?? "",
      machine: row.machine ?? "",
      vendType: row.vend_type,
      productName: row.product_name ?? "",
      transactionDate: row.transaction_date,
      quantity: row.quantity,
      quantitySet: row.quantity_set,
      totalStamps: row.total_stamps,
      currency: row.currency,
      value: row.value,
      paymentStatus: row.payment_status ?? "",
      sesionId: row.sesion_id ?? 0,
      etiquetasRollo1: row.etiquetas_rollo1 ?? 0,
      etiquetasRollo2: row.etiquetas_rollo2 ?? 0,
      etiquetaMes: row.etiqueta_mes ?? "",
      tituloEvento: row.titulo_evento ?? "",
      feria: row.feria ?? "",
      lugar: row.lugar ?? "",
      fecha: row.fecha ?? "",
      mes: row.mes ?? "",
      annio: row.annio ?? "",
      documento: row.documento ?? ""
    };
  }
}
function registerOrdersHandlers() {
  const repo = new OrdersRepository();
  handleIpc("orders:insert", (orders) => {
    repo.insert(orders);
  });
  handleIpc("orders:downloadCSV", () => {
    return repo.exportCSV();
  });
}
class ImagesRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Uploads (inserts or replaces) an image in the database.
   * If an image with the same name already exists, it will be replaced.
   *
   * @param name - Unique name/identifier for the image
   * @param dataUri - Base64-encoded data URI string
   * @param type - MIME type of the image (e.g. "image/png")
   * @param size - File size in bytes
   */
  upload(name, dataUri, type, size) {
    this.db.prepare(
      `INSERT OR REPLACE INTO images (name, type, size, data)
         VALUES (@name, @type, @size, @data)`
    ).run({
      name,
      type: type ?? null,
      size: size ?? null,
      data: dataUri
    });
  }
  /**
   * Removes an image from the database by name.
   * No-op if the image does not exist.
   *
   * @param name - Name of the image to remove
   * @returns true if an image was deleted, false if not found
   */
  remove(name) {
    const result = this.db.prepare("DELETE FROM images WHERE name = ?").run(name);
    return result.changes > 0;
  }
  /**
   * Retrieves an image by its unique name.
   * Returns the image record with name and data URI, or null if not found.
   *
   * @param name - Name of the image to retrieve
   */
  getByName(name) {
    const row = this.db.prepare("SELECT * FROM images WHERE name = ?").get(name);
    if (!row) {
      return null;
    }
    return {
      name: row.name,
      url: row.data
    };
  }
  /**
   * Retrieves the full image record by name, including metadata.
   *
   * @param name - Name of the image to retrieve
   */
  getFullByName(name) {
    const row = this.db.prepare("SELECT * FROM images WHERE name = ?").get(name);
    if (!row) {
      return null;
    }
    return this.rowToImageRecord(row);
  }
  /**
   * Returns all images stored in the database.
   */
  getAll() {
    const rows = this.db.prepare("SELECT * FROM images ORDER BY name ASC").all();
    return rows.map(this.rowToImageRecord);
  }
  /**
   * Returns the count of images in the database.
   */
  count() {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM images").get();
    return row.cnt;
  }
  /**
   * Converts a raw database row (snake_case) to an ImageRecord (camelCase).
   */
  rowToImageRecord(row) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      size: row.size,
      data: row.data,
      createdAt: row.created_at
    };
  }
}
class ImageSyncRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Returns all sync records.
   */
  getAll() {
    const rows = this.db.prepare("SELECT * FROM image_sync ORDER BY year DESC, fair_name ASC").all();
    return rows.map(this.rowToRecord);
  }
  /**
   * Retrieves a sync record by its file path.
   * Returns null if no record exists for that path.
   */
  getByFilePath(filePath) {
    const row = this.db.prepare("SELECT * FROM image_sync WHERE file_path = ?").get(filePath);
    if (!row) {
      return null;
    }
    return this.rowToRecord(row);
  }
  /**
   * Inserts or updates a sync record.
   * Uses the UNIQUE(year, fair_name, image_type) constraint for conflict resolution.
   */
  upsert(record) {
    this.db.prepare(
      `INSERT INTO image_sync (year, fair_name, image_type, file_path, mtime, image_name, synced_at)
         VALUES (@year, @fairName, @imageType, @filePath, @mtime, @imageName, datetime('now'))
         ON CONFLICT(year, fair_name, image_type) DO UPDATE SET
           file_path = @filePath,
           mtime = @mtime,
           image_name = @imageName,
           synced_at = datetime('now')`
    ).run({
      year: record.year,
      fairName: record.fairName,
      imageType: record.imageType,
      filePath: record.filePath,
      mtime: record.mtime,
      imageName: record.imageName
    });
  }
  /**
   * Deletes sync records whose file paths are NOT in the provided list.
   * Used to clean up orphan records after a sync scan.
   *
   * @param validPaths - Array of file paths that still exist on disk
   * @returns Number of records deleted
   */
  deleteOrphans(validPaths) {
    if (validPaths.length === 0) {
      const result2 = this.db.prepare("DELETE FROM image_sync").run();
      return result2.changes;
    }
    const placeholders = validPaths.map(() => "?").join(", ");
    const result = this.db.prepare(`DELETE FROM image_sync WHERE file_path NOT IN (${placeholders})`).run(...validPaths);
    return result.changes;
  }
  /**
   * Returns a list of unique fairs (year + name) from the sync records.
   * Ordered by year descending, then fair name ascending.
   */
  getFairList() {
    const rows = this.db.prepare(
      `SELECT DISTINCT year, fair_name
         FROM image_sync
         ORDER BY year DESC, fair_name ASC`
    ).all();
    return rows.map((row) => ({
      year: row.year,
      fairName: row.fair_name
    }));
  }
  /**
   * Returns all sync records for a specific fair.
   */
  getByFair(year, fairName) {
    const rows = this.db.prepare("SELECT * FROM image_sync WHERE year = ? AND fair_name = ?").all(year, fairName);
    return rows.map(this.rowToRecord);
  }
  /**
   * Converts a raw database row (snake_case) to an ImageSyncRecord (camelCase).
   */
  rowToRecord(row) {
    return {
      id: row.id,
      year: row.year,
      fairName: row.fair_name,
      imageType: row.image_type,
      filePath: row.file_path,
      mtime: row.mtime,
      imageName: row.image_name,
      syncedAt: row.synced_at
    };
  }
}
const SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png"]);
function classifyImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return null;
  }
  const baseName = fileName.slice(0, fileName.length - ext.length);
  if (baseName.endsWith("-fondo")) {
    return "fondo";
  }
  if (baseName.endsWith("-sello")) {
    return "sello";
  }
  return null;
}
function buildImageName(year, fairName, imageType) {
  return `${year}/${fairName}-${imageType}`;
}
function fileToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
function scanFairFolders(basePath) {
  const results = [];
  if (!fs.existsSync(basePath)) {
    return results;
  }
  let yearEntries;
  try {
    yearEntries = fs.readdirSync(basePath);
  } catch {
    return results;
  }
  for (const yearEntry of yearEntries) {
    const yearPath = path.join(basePath, yearEntry);
    try {
      if (!fs.statSync(yearPath).isDirectory()) continue;
    } catch {
      continue;
    }
    let fairEntries;
    try {
      fairEntries = fs.readdirSync(yearPath);
    } catch {
      continue;
    }
    for (const fairEntry of fairEntries) {
      const fairPath = path.join(yearPath, fairEntry);
      try {
        if (!fs.statSync(fairPath).isDirectory()) continue;
      } catch {
        continue;
      }
      let fileEntries;
      try {
        fileEntries = fs.readdirSync(fairPath);
      } catch {
        continue;
      }
      for (const fileEntry of fileEntries) {
        const imageType = classifyImageFile(fileEntry);
        if (!imageType) continue;
        const filePath = path.join(fairPath, fileEntry);
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) continue;
          results.push({
            year: yearEntry,
            fairName: fairEntry,
            imageType,
            filePath,
            fileName: fileEntry,
            mtime: stat.mtimeMs
          });
        } catch {
          continue;
        }
      }
    }
  }
  return results;
}
function syncImages(basePath) {
  const syncRepo = new ImageSyncRepository();
  const imagesRepo = new ImagesRepository();
  const result = {
    inserted: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    errors: []
  };
  const scannedFiles = scanFairFolders(basePath);
  const existingRecords = syncRepo.getAll();
  const recordsByPath = new Map(existingRecords.map((r) => [r.filePath, r]));
  const diskPaths = /* @__PURE__ */ new Set();
  for (const file of scannedFiles) {
    diskPaths.add(file.filePath);
    const existingRecord = recordsByPath.get(file.filePath);
    const imageName = buildImageName(file.year, file.fairName, file.imageType);
    if (!existingRecord) {
      try {
        const dataUri = fileToDataUri(file.filePath);
        const ext = path.extname(file.fileName).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        const stat = fs.statSync(file.filePath);
        imagesRepo.upload(imageName, dataUri, mimeType, stat.size);
        syncRepo.upsert({
          year: file.year,
          fairName: file.fairName,
          imageType: file.imageType,
          filePath: file.filePath,
          mtime: file.mtime,
          imageName
        });
        result.inserted++;
      } catch (err) {
        result.errors.push({
          path: file.filePath,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    } else if (file.mtime > existingRecord.mtime) {
      try {
        const dataUri = fileToDataUri(file.filePath);
        const ext = path.extname(file.fileName).toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        const stat = fs.statSync(file.filePath);
        imagesRepo.upload(imageName, dataUri, mimeType, stat.size);
        syncRepo.upsert({
          year: file.year,
          fairName: file.fairName,
          imageType: file.imageType,
          filePath: file.filePath,
          mtime: file.mtime,
          imageName
        });
        result.updated++;
      } catch (err) {
        result.errors.push({
          path: file.filePath,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    } else {
      result.unchanged++;
    }
  }
  const validPaths = Array.from(diskPaths);
  const orphanedRecords = existingRecords.filter((r) => !diskPaths.has(r.filePath));
  for (const orphan of orphanedRecords) {
    try {
      imagesRepo.remove(orphan.imageName);
    } catch {
    }
  }
  if (orphanedRecords.length > 0) {
    const deletedCount = syncRepo.deleteOrphans(validPaths);
    result.deleted = deletedCount;
  }
  return result;
}
let lastSyncResult = null;
function setLastSyncResult(result) {
  lastSyncResult = result;
}
function registerImagesHandlers() {
  const repo = new ImagesRepository();
  const syncRepo = new ImageSyncRepository();
  handleIpc("images:upload", (name, dataUri, type, size) => {
    repo.upload(name, dataUri, type, size);
  });
  handleIpc("images:remove", (name) => {
    repo.remove(name);
  });
  handleIpc("images:getByName", (name) => {
    const imageName = name;
    const directResult = repo.getByName(imageName);
    if (directResult) return directResult;
    const fairs = syncRepo.getFairList();
    const matchedFair = fairs.find(
      (f) => f.fairName.toLowerCase() === imageName.toLowerCase()
    );
    if (matchedFair) {
      const fondoName = buildImageName(matchedFair.year, matchedFair.fairName, "fondo");
      return repo.getByName(fondoName);
    }
    return null;
  });
  handleIpc("images:getFairList", () => {
    return syncRepo.getFairList();
  });
  handleIpc("images:getByFair", (year, fairName) => {
    const y = year;
    const fn = fairName;
    const fondoName = buildImageName(y, fn, "fondo");
    const selloName = buildImageName(y, fn, "sello");
    const fondoRecord = repo.getByName(fondoName);
    const selloRecord = repo.getByName(selloName);
    return {
      fondo: fondoRecord?.url ?? null,
      sello: selloRecord?.url ?? null
    };
  });
  handleIpc("images:getSyncStatus", () => {
    return lastSyncResult;
  });
  handleIpc("images:resync", () => {
    const basePath = path.join(
      electron.app.isPackaged ? path.dirname(electron.app.getPath("exe")) : electron.app.getAppPath(),
      "bbdd-ferias"
    );
    const result = syncImages(basePath);
    lastSyncResult = result;
    return result;
  });
}
const execAsync$1 = util.promisify(child_process.exec);
const defaultDiscoveryExecutor = {
  exec: (command) => execAsync$1(command, { timeout: 1e4 })
};
const defaultHttpProbe = {
  probe(hostname, port, path2, timeoutMs) {
    const http = require("http");
    const printerUri = `ipp://${hostname}:${port}${path2}`;
    const ippRequest = buildMinimalGetAttributesRequest(printerUri);
    return new Promise((resolve) => {
      const options = {
        hostname,
        port,
        path: path2,
        method: "POST",
        headers: {
          "Content-Type": "application/ipp",
          "Content-Length": ippRequest.length
        },
        timeout: timeoutMs
      };
      const req = http.request(
        options,
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              const responseData = Buffer.concat(chunks);
              const name = extractPrinterName(responseData) ?? `IPP@${hostname}`;
              resolve(name);
            } else {
              resolve(null);
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
      req.write(ippRequest);
      req.end();
    });
  }
};
const IPP_V_MAJOR = 1;
const IPP_V_MINOR = 1;
const OP_GET_PRINTER_ATTRIBUTES = 11;
const TAG_OPERATION_ATTRIBUTES = 1;
const TAG_END_OF_ATTRIBUTES = 3;
const TAG_CHARSET = 71;
const TAG_NATURAL_LANGUAGE = 72;
const TAG_URI = 69;
const TAG_KEYWORD = 68;
const TAG_NAME_WITHOUT_LANGUAGE = 66;
function encodeStrAttr(tag, name, value) {
  const nameBytes = Buffer.from(name, "utf-8");
  const valueBytes = Buffer.from(value, "utf-8");
  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + valueBytes.length);
  let offset = 0;
  buf.writeUInt8(tag, offset);
  offset += 1;
  buf.writeUInt16BE(nameBytes.length, offset);
  offset += 2;
  nameBytes.copy(buf, offset);
  offset += nameBytes.length;
  buf.writeUInt16BE(valueBytes.length, offset);
  offset += 2;
  valueBytes.copy(buf, offset);
  return buf;
}
function buildMinimalGetAttributesRequest(printerUri) {
  const parts = [];
  const header = Buffer.alloc(8);
  header.writeUInt8(IPP_V_MAJOR, 0);
  header.writeUInt8(IPP_V_MINOR, 1);
  header.writeUInt16BE(OP_GET_PRINTER_ATTRIBUTES, 2);
  header.writeInt32BE(1, 4);
  parts.push(header);
  parts.push(Buffer.from([TAG_OPERATION_ATTRIBUTES]));
  parts.push(encodeStrAttr(TAG_CHARSET, "attributes-charset", "utf-8"));
  parts.push(encodeStrAttr(TAG_NATURAL_LANGUAGE, "attributes-natural-language", "en"));
  parts.push(encodeStrAttr(TAG_URI, "printer-uri", printerUri));
  parts.push(encodeStrAttr(TAG_NAME_WITHOUT_LANGUAGE, "requesting-user-name", "stamp-sales-app"));
  parts.push(encodeStrAttr(TAG_KEYWORD, "requested-attributes", "printer-name"));
  parts.push(Buffer.from([TAG_END_OF_ATTRIBUTES]));
  return Buffer.concat(parts);
}
function extractPrinterName(data) {
  if (data.length < 8) return null;
  let offset = 8;
  while (offset < data.length) {
    const tag = data.readUInt8(offset);
    offset += 1;
    if (tag === TAG_END_OF_ATTRIBUTES) break;
    if (tag <= 15) continue;
    if (offset + 2 > data.length) break;
    const nameLength = data.readUInt16BE(offset);
    offset += 2;
    if (offset + nameLength > data.length) break;
    const name = data.subarray(offset, offset + nameLength).toString("utf-8");
    offset += nameLength;
    if (offset + 2 > data.length) break;
    const valueLength = data.readUInt16BE(offset);
    offset += 2;
    if (offset + valueLength > data.length) break;
    if (name === "printer-name" && valueLength > 0) {
      return data.subarray(offset, offset + valueLength).toString("utf-8");
    }
    offset += valueLength;
  }
  return null;
}
function parseAvahiBrowse(output) {
  const printers = [];
  const lines = output.split("\n").filter((l) => l.startsWith("="));
  for (const line of lines) {
    const fields = line.split(";");
    if (fields.length < 9) continue;
    const name = fields[3]?.trim();
    const hostname = fields[7]?.trim();
    const portStr = fields[8]?.trim();
    const txtRaw = fields[9]?.trim() ?? "";
    if (!name || !hostname || !portStr) continue;
    const port = parseInt(portStr, 10);
    if (isNaN(port)) continue;
    const txt = parseTxtRecord(txtRaw);
    printers.push({ name, hostname, port, txt });
  }
  const seen = /* @__PURE__ */ new Set();
  return printers.filter((p) => {
    const key = `${p.hostname}:${p.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function parseTxtRecord(raw) {
  const result = {};
  const cleaned = raw.replace(/^"/, "").replace(/"$/, "");
  const parts = cleaned.split('" "');
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1).trim().replace(/"/g, "");
      result[key] = value;
    }
  }
  return result;
}
function avahiToDiscoveredPrinters(avahiPrinters) {
  return avahiPrinters.map((p) => {
    const rp = p.txt["rp"] ?? "ipp/print";
    const path2 = rp.startsWith("/") ? rp : `/${rp}`;
    const uri = `ipp://${p.hostname}:${p.port}${path2}`;
    const model = p.txt["ty"] ?? p.txt["product"] ?? "";
    const info = model ? `${p.name} (${model})` : p.name;
    return {
      name: p.name,
      uri,
      accepting: true,
      // mDNS-advertised printers are generally accepting
      info
    };
  });
}
async function discoverLinuxPrinters(executor = defaultDiscoveryExecutor) {
  const results = [];
  const seenUris = /* @__PURE__ */ new Set();
  try {
    const { stdout } = await executor.exec(
      "avahi-browse -tpr _ipp._tcp 2>/dev/null"
    );
    const avahiPrinters = parseAvahiBrowse(stdout);
    const discovered = avahiToDiscoveredPrinters(avahiPrinters);
    for (const printer of discovered) {
      if (!seenUris.has(printer.uri)) {
        seenUris.add(printer.uri);
        results.push(printer);
      }
    }
  } catch {
  }
  try {
    const { stdout } = await executor.exec(
      "avahi-browse -tpr _ipps._tcp 2>/dev/null"
    );
    const avahiPrinters = parseAvahiBrowse(stdout);
    const discovered = avahiToDiscoveredPrinters(avahiPrinters);
    for (const printer of discovered) {
      const ippsUri = printer.uri.replace("ipp://", "ipps://");
      if (!seenUris.has(ippsUri)) {
        seenUris.add(ippsUri);
        results.push({ ...printer, uri: ippsUri });
      }
    }
  } catch {
  }
  try {
    const { stdout } = await executor.exec("lpstat -a 2>/dev/null");
    const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(accepting|not accepting)\s+requests/);
      if (match) {
        const name = match[1];
        const accepting = match[2] === "accepting";
        const uri = name;
        if (!seenUris.has(uri)) {
          seenUris.add(uri);
          results.push({
            name,
            uri,
            accepting,
            info: line.trim()
          });
        }
      }
    }
  } catch {
  }
  return results;
}
async function discoverWindowsLocalPrinters(executor = defaultDiscoveryExecutor) {
  const results = [];
  try {
    const { stdout } = await executor.exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object Name, PortName, PrinterStatus, Shared, DriverName, Type | ConvertTo-Json -Compress"'
    );
    if (!stdout || stdout.trim().length === 0) {
      return results;
    }
    let printers;
    const parsed = JSON.parse(stdout.trim());
    printers = Array.isArray(parsed) ? parsed : [parsed];
    const VIRTUAL_PRINTER_NAMES = [
      "microsoft print to pdf",
      "microsoft xps document writer",
      "fax",
      "send to onenote",
      "onenote for windows 10",
      "onenote (desktop)"
    ];
    for (const p of printers) {
      if (!p.Name) continue;
      const nameLower = p.Name.toLowerCase();
      if (VIRTUAL_PRINTER_NAMES.some((vp) => nameLower.includes(vp))) continue;
      const uri = `win://${encodeURIComponent(p.Name)}`;
      const portInfo = p.PortName ? ` (${p.PortName})` : "";
      const driverInfo = p.DriverName ? ` - ${p.DriverName}` : "";
      const info = `${p.Name}${portInfo}${driverInfo}`;
      results.push({
        name: p.Name,
        uri,
        accepting: p.PrinterStatus === 0 || p.PrinterStatus === 1,
        // 0=Normal, 1=Paused but exists
        info
      });
    }
  } catch (err) {
    console.warn("[PrinterDiscovery] PowerShell Get-Printer failed:", err);
  }
  return results;
}
const DEFAULT_IPP_PORTS = [631];
const DEFAULT_IPP_PATHS = ["/ipp/print", "/ipp/printer", "/"];
const DEFAULT_PROBE_TIMEOUT = 2e3;
const DEFAULT_CONCURRENCY = 20;
async function getSubnetTargets(executor = defaultDiscoveryExecutor) {
  const targets = [];
  try {
    const { stdout } = await executor.exec("arp -a");
    const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g;
    let match;
    while ((match = ipRegex.exec(stdout)) !== null) {
      const ip = match[1];
      if (!ip.endsWith(".255") && !ip.endsWith(".0") && ip !== "255.255.255.255") {
        targets.push(ip);
      }
    }
  } catch {
  }
  return [...new Set(targets)];
}
async function discoverWindowsPrinters(config = {}, executor = defaultDiscoveryExecutor, probe = defaultHttpProbe) {
  const localPrinters = await discoverWindowsLocalPrinters(executor);
  const networkPrinters = await discoverWindowsNetworkPrinters(config, executor, probe);
  const seenNames = new Set(localPrinters.map((p) => p.name.toLowerCase()));
  const merged = [...localPrinters];
  for (const netPrinter of networkPrinters) {
    if (!seenNames.has(netPrinter.name.toLowerCase())) {
      seenNames.add(netPrinter.name.toLowerCase());
      merged.push(netPrinter);
    }
  }
  return merged;
}
async function discoverWindowsNetworkPrinters(config = {}, executor = defaultDiscoveryExecutor, probe = defaultHttpProbe) {
  const ports = config.ports ?? DEFAULT_IPP_PORTS;
  const paths = config.paths ?? DEFAULT_IPP_PATHS;
  const timeoutMs = config.timeoutMs ?? DEFAULT_PROBE_TIMEOUT;
  const concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
  const targets = config.targets ?? await getSubnetTargets(executor);
  if (targets.length === 0) {
    return [];
  }
  const probes = [];
  for (const host of targets) {
    for (const port of ports) {
      for (const path2 of paths) {
        probes.push({ host, port, path: path2 });
      }
    }
  }
  const hostPortGroups = /* @__PURE__ */ new Map();
  for (const p of probes) {
    const key = `${p.host}:${p.port}`;
    if (!hostPortGroups.has(key)) {
      hostPortGroups.set(key, []);
    }
    hostPortGroups.get(key).push(p);
  }
  const groups = Array.from(hostPortGroups.values());
  const results = [];
  for (let i = 0; i < groups.length; i += concurrency) {
    const batch = groups.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (pathsForHost) => {
        for (const { host, port, path: path2 } of pathsForHost) {
          try {
            const name = await probe.probe(host, port, path2, timeoutMs);
            if (name) {
              return {
                name,
                uri: `ipp://${host}:${port}${path2}`,
                accepting: true,
                info: `IPP printer at ${host}:${port}`
              };
            }
          } catch {
          }
        }
        return null;
      })
    );
    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
  }
  return results;
}
const execAsync = util.promisify(child_process.exec);
const execFileAsync = util.promisify(child_process.execFile);
const defaultExecutor = {
  exec: (command) => execAsync(command),
  execFile: (file, args) => execFileAsync(file, args)
};
const defaultFileIO = {
  writeFile: (path2, data) => promises.writeFile(path2, data),
  unlink: (path2) => promises.unlink(path2),
  createTempFilePath: () => {
    const id = crypto.randomBytes(8).toString("hex");
    return path.join(os.tmpdir(), `stamp-print-${id}.pdf`);
  }
};
function extractQueueName(uri) {
  if (!uri.includes("/") && !uri.includes(":")) {
    return uri;
  }
  const printerMatch = uri.match(/\/printers\/([^/]+)\/?$/);
  if (printerMatch) {
    return printerMatch[1];
  }
  const pathMatch = uri.match(/\/([^/]+)\/?$/);
  if (pathMatch) {
    return pathMatch[1];
  }
  return uri;
}
function parseLpstatStatus(output) {
  const lower = output.toLowerCase();
  if (lower.includes("disabled") || lower.includes("not accepting")) {
    return "paused";
  }
  if (lower.includes("printing")) {
    return "busy";
  }
  if (lower.includes("idle") || lower.includes("enabled")) {
    return "ready";
  }
  if (lower.includes("error") || lower.includes("fault")) {
    return "error";
  }
  return "ready";
}
function parseJobId(output) {
  const match = output.match(/request id is (\S+)/);
  return match ? match[1] : void 0;
}
class CupsBackend {
  cmd;
  io;
  constructor(executor, fileIO) {
    this.cmd = executor ?? defaultExecutor;
    this.io = fileIO ?? defaultFileIO;
  }
  /**
   * Sends a PDF buffer to the specified CUPS printer queue.
   *
   * Workflow:
   * 1. Write PDF buffer to a temp file
   * 2. Execute `lp -d <queue> -o media=<media> -o orientation-requested=<n> -n <copies> -t <jobName> <file>`
   * 3. Parse job ID from output
   * 4. Clean up temp file
   */
  async print(printerUri, pdfBuffer, options) {
    const queue = extractQueueName(printerUri);
    const tempFile = this.io.createTempFilePath();
    try {
      await this.io.writeFile(tempFile, pdfBuffer);
      const args = ["-d", queue];
      if (options.media) {
        args.push("-o", `media=${options.media}`);
      }
      if (options.orientation) {
        args.push("-o", `orientation-requested=${options.orientation}`);
      }
      const copies = options.copies ?? 1;
      if (copies > 1) {
        args.push("-n", String(copies));
      }
      if (options.jobName) {
        args.push("-t", options.jobName);
      }
      args.push(tempFile);
      const { stdout } = await this.cmd.execFile("lp", args);
      const jobId = parseJobId(stdout);
      return {
        success: true,
        jobId
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `CUPS print failed: ${message}`
      };
    } finally {
      try {
        await this.io.unlink(tempFile);
      } catch {
      }
    }
  }
  /**
   * Queries the status of a CUPS printer queue using `lpstat -p <queue>`.
   */
  async getStatus(printerUri) {
    const queue = extractQueueName(printerUri);
    try {
      const { stdout } = await this.cmd.exec(`lpstat -p ${queue}`);
      return parseLpstatStatus(stdout);
    } catch {
      return "disconnected";
    }
  }
  /**
   * Pauses a CUPS printer queue using `cupsdisable <queue>`.
   * This prevents the printer from processing new jobs but preserves the queue.
   */
  async pause(printerUri) {
    const queue = extractQueueName(printerUri);
    try {
      await this.cmd.execFile("cupsdisable", [queue]);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Resumes a previously paused CUPS printer queue using `cupsenable <queue>`.
   * This allows the printer to resume processing queued jobs.
   */
  async resume(printerUri) {
    const queue = extractQueueName(printerUri);
    try {
      await this.cmd.execFile("cupsenable", [queue]);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Discovers available printers using avahi-browse (mDNS/DNS-SD) for network
   * printers and `lpstat -a` for locally configured CUPS printers.
   *
   * Uses the discoverLinuxPrinters function from printer-discovery.ts which:
   * 1. Runs `avahi-browse -tpr _ipp._tcp` for IPP printers on the network
   * 2. Runs `avahi-browse -tpr _ipps._tcp` for IPP-over-TLS printers
   * 3. Falls back to `lpstat -a` for locally configured CUPS queues
   *
   * Results are deduplicated by URI.
   */
  async discover() {
    const discoveryExecutor = {
      exec: (command) => this.cmd.exec(command)
    };
    return discoverLinuxPrinters(discoveryExecutor);
  }
  /**
   * Cancels a specific print job using the `cancel` command.
   *
   * @param _printerUri - Not used for CUPS cancel (job IDs are global)
   * @param jobId - The CUPS job ID (e.g. "MyPrinter-123")
   */
  async cancelJob(_printerUri, jobId) {
    try {
      await this.cmd.execFile("cancel", [jobId]);
      return true;
    } catch {
      return false;
    }
  }
}
const IPP_VERSION_MAJOR = 1;
const IPP_VERSION_MINOR = 1;
const IPP_OPERATIONS = {
  PRINT_JOB: 2,
  GET_PRINTER_ATTRIBUTES: 11,
  CANCEL_JOB: 8,
  PAUSE_PRINTER: 16,
  RESUME_PRINTER: 17
};
const IPP_TAGS = {
  /** Delimiter tags */
  OPERATION_ATTRIBUTES: 1,
  JOB_ATTRIBUTES: 2,
  END_OF_ATTRIBUTES: 3,
  /** Value tags */
  INTEGER: 33,
  ENUM: 35,
  NAME_WITHOUT_LANGUAGE: 66,
  KEYWORD: 68,
  URI: 69,
  CHARSET: 71,
  NATURAL_LANGUAGE: 72,
  MIME_MEDIA_TYPE: 73
};
const IPP_STATUS = {
  SERVER_ERROR_INTERNAL: 1280
};
const IPP_PRINTER_STATE = {
  IDLE: 3,
  PROCESSING: 4,
  STOPPED: 5
};
const defaultHttpTransport = {
  post(hostname, port, path2, body, timeoutMs) {
    const http = require("http");
    return new Promise((resolve, reject) => {
      const options = {
        hostname,
        port,
        path: path2,
        method: "POST",
        headers: {
          "Content-Type": "application/ipp",
          "Content-Length": body.length
        },
        timeout: timeoutMs
      };
      const req = http.request(options, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      });
      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("IPP request timed out"));
      });
      req.write(body);
      req.end();
    });
  }
};
function parseIppUri(uri) {
  if (!uri.includes("://") && !uri.includes("/")) {
    return {
      hostname: uri,
      port: 631,
      path: "/ipp/print",
      printerUri: `ipp://${uri}:631/ipp/print`
    };
  }
  let normalizedUri = uri;
  if (uri.startsWith("ipp://")) {
    normalizedUri = "http://" + uri.slice(6);
  }
  try {
    const parsed = new URL(normalizedUri);
    const hostname = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 631;
    const path2 = parsed.pathname || "/ipp/print";
    const printerUri = `ipp://${hostname}:${port}${path2}`;
    return { hostname, port, path: path2, printerUri };
  } catch {
    return {
      hostname: uri,
      port: 631,
      path: "/ipp/print",
      printerUri: `ipp://${uri}:631/ipp/print`
    };
  }
}
function encodeStringAttribute(tag, name, value) {
  const nameBytes = Buffer.from(name, "utf-8");
  const valueBytes = Buffer.from(value, "utf-8");
  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + valueBytes.length);
  let offset = 0;
  buf.writeUInt8(tag, offset);
  offset += 1;
  buf.writeUInt16BE(nameBytes.length, offset);
  offset += 2;
  nameBytes.copy(buf, offset);
  offset += nameBytes.length;
  buf.writeUInt16BE(valueBytes.length, offset);
  offset += 2;
  valueBytes.copy(buf, offset);
  return buf;
}
function encodeIntegerAttribute(tag, name, value) {
  const nameBytes = Buffer.from(name, "utf-8");
  const buf = Buffer.alloc(1 + 2 + nameBytes.length + 2 + 4);
  let offset = 0;
  buf.writeUInt8(tag, offset);
  offset += 1;
  buf.writeUInt16BE(nameBytes.length, offset);
  offset += 2;
  nameBytes.copy(buf, offset);
  offset += nameBytes.length;
  buf.writeUInt16BE(4, offset);
  offset += 2;
  buf.writeInt32BE(value, offset);
  return buf;
}
function encodeIppHeader(operationId, requestId) {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(IPP_VERSION_MAJOR, 0);
  buf.writeUInt8(IPP_VERSION_MINOR, 1);
  buf.writeUInt16BE(operationId, 2);
  buf.writeInt32BE(requestId, 4);
  return buf;
}
function encodeOperationAttributes(printerUri, jobName) {
  const parts = [];
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]));
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, "attributes-charset", "utf-8"));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, "attributes-natural-language", "en")
  );
  parts.push(encodeStringAttribute(IPP_TAGS.URI, "printer-uri", printerUri));
  if (jobName) {
    parts.push(encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, "job-name", jobName));
  }
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, "requesting-user-name", "stamp-sales-app")
  );
  parts.push(
    encodeStringAttribute(IPP_TAGS.MIME_MEDIA_TYPE, "document-format", "application/pdf")
  );
  return Buffer.concat(parts);
}
function buildPrintJobRequest(printerUri, options, requestId) {
  const parts = [];
  parts.push(encodeIppHeader(IPP_OPERATIONS.PRINT_JOB, requestId));
  parts.push(encodeOperationAttributes(printerUri, options.jobName));
  parts.push(Buffer.from([IPP_TAGS.JOB_ATTRIBUTES]));
  if (options.media) {
    parts.push(encodeStringAttribute(IPP_TAGS.KEYWORD, "media", options.media));
  }
  if (options.orientation) {
    parts.push(encodeIntegerAttribute(IPP_TAGS.ENUM, "orientation-requested", options.orientation));
  }
  const copies = options.copies ?? 1;
  if (copies > 1) {
    parts.push(encodeIntegerAttribute(IPP_TAGS.INTEGER, "copies", copies));
  }
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]));
  return Buffer.concat(parts);
}
function buildGetPrinterAttributesRequest(printerUri, requestId) {
  const parts = [];
  parts.push(encodeIppHeader(IPP_OPERATIONS.GET_PRINTER_ATTRIBUTES, requestId));
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]));
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, "attributes-charset", "utf-8"));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, "attributes-natural-language", "en")
  );
  parts.push(encodeStringAttribute(IPP_TAGS.URI, "printer-uri", printerUri));
  parts.push(
    encodeStringAttribute(IPP_TAGS.KEYWORD, "requested-attributes", "printer-state")
  );
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]));
  return Buffer.concat(parts);
}
function buildPausePrinterRequest(printerUri, requestId) {
  const parts = [];
  parts.push(encodeIppHeader(IPP_OPERATIONS.PAUSE_PRINTER, requestId));
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]));
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, "attributes-charset", "utf-8"));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, "attributes-natural-language", "en")
  );
  parts.push(encodeStringAttribute(IPP_TAGS.URI, "printer-uri", printerUri));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, "requesting-user-name", "stamp-sales-app")
  );
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]));
  return Buffer.concat(parts);
}
function buildResumePrinterRequest(printerUri, requestId) {
  const parts = [];
  parts.push(encodeIppHeader(IPP_OPERATIONS.RESUME_PRINTER, requestId));
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]));
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, "attributes-charset", "utf-8"));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, "attributes-natural-language", "en")
  );
  parts.push(encodeStringAttribute(IPP_TAGS.URI, "printer-uri", printerUri));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, "requesting-user-name", "stamp-sales-app")
  );
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]));
  return Buffer.concat(parts);
}
function buildCancelJobRequest(printerUri, jobId, requestId) {
  const parts = [];
  parts.push(encodeIppHeader(IPP_OPERATIONS.CANCEL_JOB, requestId));
  parts.push(Buffer.from([IPP_TAGS.OPERATION_ATTRIBUTES]));
  parts.push(encodeStringAttribute(IPP_TAGS.CHARSET, "attributes-charset", "utf-8"));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NATURAL_LANGUAGE, "attributes-natural-language", "en")
  );
  parts.push(encodeStringAttribute(IPP_TAGS.URI, "printer-uri", printerUri));
  parts.push(encodeIntegerAttribute(IPP_TAGS.INTEGER, "job-id", jobId));
  parts.push(
    encodeStringAttribute(IPP_TAGS.NAME_WITHOUT_LANGUAGE, "requesting-user-name", "stamp-sales-app")
  );
  parts.push(Buffer.from([IPP_TAGS.END_OF_ATTRIBUTES]));
  return Buffer.concat(parts);
}
function parseIppResponse(data) {
  if (data.length < 8) {
    return {
      versionMajor: 0,
      versionMinor: 0,
      statusCode: IPP_STATUS.SERVER_ERROR_INTERNAL,
      requestId: 0
    };
  }
  const response = {
    versionMajor: data.readUInt8(0),
    versionMinor: data.readUInt8(1),
    statusCode: data.readUInt16BE(2),
    requestId: data.readInt32BE(4)
  };
  let offset = 8;
  while (offset < data.length) {
    const tag = data.readUInt8(offset);
    offset += 1;
    if (tag === IPP_TAGS.END_OF_ATTRIBUTES) {
      break;
    }
    if (tag <= 15) {
      continue;
    }
    if (offset + 2 > data.length) break;
    const nameLength = data.readUInt16BE(offset);
    offset += 2;
    if (offset + nameLength > data.length) break;
    const name = data.subarray(offset, offset + nameLength).toString("utf-8");
    offset += nameLength;
    if (offset + 2 > data.length) break;
    const valueLength = data.readUInt16BE(offset);
    offset += 2;
    if (offset + valueLength > data.length) break;
    if (name === "printer-state" && valueLength === 4) {
      response.printerState = data.readInt32BE(offset);
    } else if (name === "job-id" && valueLength === 4) {
      response.jobId = data.readInt32BE(offset);
    }
    offset += valueLength;
  }
  return response;
}
function mapPrinterState(state) {
  switch (state) {
    case IPP_PRINTER_STATE.IDLE:
      return "ready";
    case IPP_PRINTER_STATE.PROCESSING:
      return "busy";
    case IPP_PRINTER_STATE.STOPPED:
      return "paused";
    default:
      return "disconnected";
  }
}
class IppBackend {
  transport;
  requestId;
  timeoutMs;
  constructor(transport, timeoutMs) {
    this.transport = transport ?? defaultHttpTransport;
    this.requestId = 1;
    this.timeoutMs = timeoutMs ?? 1e4;
  }
  /** Gets the next request ID (incrementing counter) */
  nextRequestId() {
    return this.requestId++;
  }
  /**
   * Checks if a printer URI refers to a local Windows printer (win:// scheme).
   */
  isLocalWindowsPrinter(printerUri) {
    return printerUri.startsWith("win://");
  }
  /**
   * Extracts the printer name from a win:// URI.
   * win://Canon%20PIXMA%20MG3600 → "Canon PIXMA MG3600"
   */
  getWindowsPrinterName(printerUri) {
    const encoded = printerUri.replace("win://", "");
    return decodeURIComponent(encoded);
  }
  /**
   * Prints a PDF to a local Windows printer using pdf-to-printer (SumatraPDF engine).
   *
   * This library bundles SumatraPDF which handles PDF rendering and silent printing
   * directly to the Windows spooler without opening any visible window or requiring
   * any external PDF viewer (Adobe, Edge, etc.).
   *
   * Supports label printers, network printers, and USB printers alike.
   */
  async printViaWindowsSpooler(printerName, pdfBuffer, options) {
    const { writeFileSync, unlinkSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const { tmpdir } = require("os");
    const { print: printPdf } = require("pdf-to-printer");
    const jobName = options.jobName ?? `print_${Date.now()}`;
    const copies = options.copies ?? 1;
    const tempDir = join(tmpdir(), "stamp-sales-print");
    try {
      mkdirSync(tempDir, { recursive: true });
    } catch {
    }
    const tempFile = join(tempDir, `${jobName}_${Date.now()}.pdf`);
    try {
      writeFileSync(tempFile, pdfBuffer);
      await printPdf(tempFile, {
        printer: printerName,
        copies,
        silent: true
      });
      setTimeout(() => {
        try {
          unlinkSync(tempFile);
        } catch {
        }
      }, 1e4);
      return { success: true, jobId: jobName };
    } catch (err) {
      try {
        unlinkSync(tempFile);
      } catch {
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Windows print failed: ${message}` };
    }
  }
  /**
   * Sends a PDF buffer to the specified printer.
   * Routes to either IPP (network printers) or Windows spooler (local/USB printers)
   * based on the URI scheme.
   *
   * Workflow for IPP (ipp:// URIs):
   * 1. Parse the printer URI to get hostname/port/path
   * 2. Build IPP Print-Job request with options (media, orientation, copies)
   * 3. Concatenate IPP request header + PDF document data
   * 4. Send via HTTP POST to the printer
   * 5. Parse response for job ID and status
   *
   * Workflow for local printers (win:// URIs):
   * 1. Extract printer name from URI
   * 2. Write PDF to temp file
   * 3. Print via PowerShell using Windows spooler
   */
  async print(printerUri, pdfBuffer, options) {
    if (this.isLocalWindowsPrinter(printerUri)) {
      const printerName = this.getWindowsPrinterName(printerUri);
      return this.printViaWindowsSpooler(printerName, pdfBuffer, options);
    }
    const uri = parseIppUri(printerUri);
    const reqId = this.nextRequestId();
    try {
      const ippRequest = buildPrintJobRequest(uri.printerUri, options, reqId);
      const body = Buffer.concat([ippRequest, pdfBuffer]);
      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        body,
        this.timeoutMs
      );
      const response = parseIppResponse(responseData);
      if (response.statusCode <= 255) {
        return {
          success: true,
          jobId: response.jobId ? String(response.jobId) : void 0
        };
      } else {
        return {
          success: false,
          error: `IPP error: status code 0x${response.statusCode.toString(16).padStart(4, "0")}`
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `IPP print failed: ${message}`
      };
    }
  }
  /**
   * Queries the current status of a printer.
   * For IPP printers: uses Get-Printer-Attributes.
   * For local Windows printers (win://): uses PowerShell Get-Printer.
   */
  async getStatus(printerUri) {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.getWindowsPrinterStatus(printerUri);
    }
    const uri = parseIppUri(printerUri);
    const reqId = this.nextRequestId();
    try {
      const request = buildGetPrinterAttributesRequest(uri.printerUri, reqId);
      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      );
      const response = parseIppResponse(responseData);
      if (response.statusCode > 255) {
        return "error";
      }
      return mapPrinterState(response.printerState);
    } catch {
      return "disconnected";
    }
  }
  /**
   * Queries a local Windows printer's status via PowerShell.
   */
  async getWindowsPrinterStatus(printerUri) {
    const printerName = this.getWindowsPrinterName(printerUri);
    try {
      const { exec: nodeExec } = require("child_process");
      const { promisify: nodePromisify } = require("util");
      const execAsync2 = nodePromisify(nodeExec);
      const escapedName = printerName.replace(/'/g, "''");
      const { stdout } = await execAsync2(
        `powershell -NoProfile -Command "Get-Printer -Name '${escapedName}' | Select-Object PrinterStatus | ConvertTo-Json -Compress"`,
        { timeout: 5e3 }
      );
      if (!stdout || stdout.trim().length === 0) {
        return "disconnected";
      }
      const result = JSON.parse(stdout.trim());
      switch (result.PrinterStatus) {
        case 0:
          return "ready";
        case 1:
          return "paused";
        case 2:
          return "error";
        default:
          return "disconnected";
      }
    } catch {
      return "disconnected";
    }
  }
  /**
   * Pauses a printer.
   * For IPP printers: uses Pause-Printer operation.
   * For local Windows printers (win://): uses PowerShell Set-Printer.
   */
  async pause(printerUri) {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.pauseWindowsPrinter(printerUri);
    }
    const uri = parseIppUri(printerUri);
    const reqId = this.nextRequestId();
    try {
      const request = buildPausePrinterRequest(uri.printerUri, reqId);
      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      );
      const response = parseIppResponse(responseData);
      return response.statusCode <= 255;
    } catch {
      return false;
    }
  }
  /**
   * Pauses a local Windows printer via PowerShell.
   */
  async pauseWindowsPrinter(printerUri) {
    const printerName = this.getWindowsPrinterName(printerUri);
    try {
      const { exec: nodeExec } = require("child_process");
      const { promisify: nodePromisify } = require("util");
      const execAsync2 = nodePromisify(nodeExec);
      const escapedName = printerName.replace(/'/g, "''");
      await execAsync2(
        `powershell -NoProfile -Command "Stop-Printer -Name '${escapedName}'"`,
        { timeout: 5e3 }
      );
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Resumes a printer.
   * For IPP printers: uses Resume-Printer operation.
   * For local Windows printers (win://): uses PowerShell Restart-Printer.
   */
  async resume(printerUri) {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.resumeWindowsPrinter(printerUri);
    }
    const uri = parseIppUri(printerUri);
    const reqId = this.nextRequestId();
    try {
      const request = buildResumePrinterRequest(uri.printerUri, reqId);
      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      );
      const response = parseIppResponse(responseData);
      return response.statusCode <= 255;
    } catch {
      return false;
    }
  }
  /**
   * Resumes a local Windows printer via PowerShell.
   */
  async resumeWindowsPrinter(printerUri) {
    const printerName = this.getWindowsPrinterName(printerUri);
    try {
      const { exec: nodeExec } = require("child_process");
      const { promisify: nodePromisify } = require("util");
      const execAsync2 = nodePromisify(nodeExec);
      const escapedName = printerName.replace(/'/g, "''");
      await execAsync2(
        `powershell -NoProfile -Command "Restart-Printer -Name '${escapedName}'"`,
        { timeout: 5e3 }
      );
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Discovers printers available on the system using two strategies:
   * 1. Local printers via PowerShell Get-Printer (USB, local network, spooler-registered)
   * 2. Network printers via IPP subnet scan (probes hosts from ARP table)
   *
   * Uses the discoverWindowsPrinters function from printer-discovery.ts which
   * merges both sources and deduplicates.
   */
  async discover() {
    const probe = {
      probe: async (hostname, port, path2, timeoutMs) => {
        try {
          const printerUri = `ipp://${hostname}:${port}${path2}`;
          const request = buildGetPrinterAttributesRequest(printerUri, this.nextRequestId());
          const responseData = await this.transport.post(hostname, port, path2, request, timeoutMs);
          const response = parseIppResponse(responseData);
          if (response.statusCode <= 255) {
            return `IPP@${hostname}`;
          }
          return null;
        } catch {
          return null;
        }
      }
    };
    const executor = {
      exec: (command) => {
        const { exec: nodeExec } = require("child_process");
        const { promisify: nodePromisify } = require("util");
        const execPromise = nodePromisify(nodeExec);
        return execPromise(command, { timeout: 15e3 });
      }
    };
    return discoverWindowsPrinters({}, executor, probe);
  }
  /**
   * Cancels a specific print job.
   * For IPP printers: uses Cancel-Job operation.
   * For local Windows printers (win://): uses PowerShell Remove-PrintJob.
   *
   * @param printerUri - The printer URI where the job is queued
   * @param jobId - The job ID as a string (will be parsed to integer)
   */
  async cancelJob(printerUri, jobId) {
    if (this.isLocalWindowsPrinter(printerUri)) {
      return this.cancelWindowsJob(printerUri, jobId);
    }
    const uri = parseIppUri(printerUri);
    const reqId = this.nextRequestId();
    const numericJobId = parseInt(jobId, 10);
    if (isNaN(numericJobId)) {
      return false;
    }
    try {
      const request = buildCancelJobRequest(uri.printerUri, numericJobId, reqId);
      const responseData = await this.transport.post(
        uri.hostname,
        uri.port,
        uri.path,
        request,
        this.timeoutMs
      );
      const response = parseIppResponse(responseData);
      return response.statusCode <= 255;
    } catch {
      return false;
    }
  }
  /**
   * Cancels a print job on a local Windows printer via PowerShell.
   */
  async cancelWindowsJob(printerUri, jobId) {
    const printerName = this.getWindowsPrinterName(printerUri);
    const numericJobId = parseInt(jobId, 10);
    if (isNaN(numericJobId)) return false;
    try {
      const { exec: nodeExec } = require("child_process");
      const { promisify: nodePromisify } = require("util");
      const execAsync2 = nodePromisify(nodeExec);
      const escapedName = printerName.replace(/'/g, "''");
      await execAsync2(
        `powershell -NoProfile -Command "Remove-PrintJob -PrinterName '${escapedName}' -ID ${numericJobId}"`,
        { timeout: 5e3 }
      );
      return true;
    } catch {
      return false;
    }
  }
}
const STAMP_MEDIA = "DC55x25";
const STAMP_ORIENTATION = 6;
const TICKET_ORIENTATION = 3;
function buildTicketMedia(heightMm) {
  return `Custom.78x${Math.ceil(heightMm)}mm`;
}
class PrinterManager {
  backend;
  assignments;
  paused;
  constructor(backend, assignments) {
    this.backend = backend;
    this.assignments = assignments ?? {};
    this.paused = /* @__PURE__ */ new Set();
  }
  /**
   * Returns the active backend instance.
   */
  getBackend() {
    return this.backend;
  }
  /**
   * Updates the printer assignments (target → URI mapping).
   */
  setAssignments(assignments) {
    this.assignments = { ...this.assignments, ...assignments };
  }
  /**
   * Gets the current printer assignments.
   */
  getAssignments() {
    return { ...this.assignments };
  }
  /**
   * Gets the URI for a given printer target.
   * Returns undefined if not assigned.
   */
  getUriForTarget(target) {
    return this.assignments[target];
  }
  /**
   * Sends a PDF to the printer assigned to the given target.
   *
   * @param target - Which printer role to send to (printer1, printer2, ticket)
   * @param pdfBuffer - The PDF content
   * @param options - Print options (media, orientation, etc.)
   * @returns PrintResult indicating success or failure
   */
  async print(target, pdfBuffer, options) {
    const uri = this.assignments[target];
    if (!uri) {
      return {
        success: false,
        error: `No printer assigned for target "${target}"`
      };
    }
    if (this.paused.has(target)) {
      return {
        success: false,
        error: `Printer "${target}" is paused`
      };
    }
    return this.backend.print(uri, pdfBuffer, options);
  }
  /**
   * Sends a stamp PDF to the appropriate printer.
   * Automatically applies stamp media and orientation settings.
   *
   * @param target - printer1 or printer2
   * @param pdfBuffer - The stamp PDF content
   * @param jobName - Optional job name for identification
   */
  async printStamp(target, pdfBuffer, jobName) {
    return this.print(target, pdfBuffer, {
      media: STAMP_MEDIA,
      orientation: STAMP_ORIENTATION,
      jobName: jobName ?? `stamp_${target}`
    });
  }
  /**
   * Sends a ticket PDF to the ticket printer.
   * Automatically applies ticket media (variable height) and orientation.
   *
   * @param pdfBuffer - The ticket PDF content
   * @param heightMm - Height of the ticket in millimeters
   * @param jobName - Optional job name for identification
   */
  async printTicket(pdfBuffer, heightMm, jobName) {
    return this.print("ticket", pdfBuffer, {
      media: buildTicketMedia(heightMm),
      orientation: TICKET_ORIENTATION,
      jobName: jobName ?? "ticket"
    });
  }
  /**
   * Gets the status of all assigned printers.
   *
   * @returns Array of PrinterInfo for each assigned printer
   */
  async getStatus() {
    const results = [];
    const targets = ["printer1", "printer2", "ticket"];
    for (const target of targets) {
      const uri = this.assignments[target];
      if (!uri) continue;
      let status;
      if (this.paused.has(target)) {
        status = "paused";
      } else {
        try {
          status = await this.backend.getStatus(uri);
        } catch {
          status = "disconnected";
        }
      }
      results.push({
        id: `${target}_${uri}`,
        name: uri,
        target,
        status,
        uri
      });
    }
    return results;
  }
  /**
   * Pauses a printer target, preventing jobs from being sent to it.
   * Also calls the backend pause to stop the physical printer queue.
   *
   * @param target - The printer target to pause
   */
  async pause(target) {
    const uri = this.assignments[target];
    if (!uri) return false;
    const result = await this.backend.pause(uri);
    if (result) {
      this.paused.add(target);
    }
    return result;
  }
  /**
   * Resumes a previously paused printer target.
   * Calls the backend resume to re-enable the physical printer queue.
   *
   * @param target - The printer target to resume
   */
  async resume(target) {
    const uri = this.assignments[target];
    if (!uri) return false;
    const result = await this.backend.resume(uri);
    if (result) {
      this.paused.delete(target);
    }
    return result;
  }
  /**
   * Pauses all assigned printers.
   */
  async pauseAll() {
    const targets = ["printer1", "printer2", "ticket"];
    for (const target of targets) {
      if (this.assignments[target]) {
        await this.pause(target);
      }
    }
  }
  /**
   * Resumes all paused printers.
   */
  async resumeAll() {
    const targets = ["printer1", "printer2", "ticket"];
    for (const target of targets) {
      if (this.paused.has(target)) {
        await this.resume(target);
      }
    }
  }
  /**
   * Checks if a specific target is currently paused.
   */
  isPaused(target) {
    return this.paused.has(target);
  }
  /**
   * Discovers available printers using the backend.
   */
  async discover() {
    return this.backend.discover();
  }
  /**
   * Cancels a print job on the printer assigned to the given target.
   */
  async cancelJob(target, jobId) {
    const uri = this.assignments[target];
    if (!uri) return false;
    return this.backend.cancelJob(uri, jobId);
  }
}
function detectPlatformBackend(platformOverride) {
  const os$1 = os.platform();
  if (os$1 === "linux" || os$1 === "darwin") {
    return "cups";
  }
  return "ipp";
}
function createPlatformBackend(platformOverride) {
  const backendType = detectPlatformBackend();
  if (backendType === "cups") {
    return new CupsBackend();
  }
  return new IppBackend();
}
function createPrinterManager(backendOrAssignments, assignments) {
  let backend;
  let resolvedAssignments;
  if (backendOrAssignments && "print" in backendOrAssignments) {
    backend = backendOrAssignments;
    resolvedAssignments = assignments;
  } else {
    backend = createPlatformBackend();
    resolvedAssignments = backendOrAssignments;
  }
  return new PrinterManager(backend, resolvedAssignments);
}
class PrintQueueRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Inserts a new print job into the queue with status 'pending'.
   * Returns the ID of the newly created job.
   */
  insert(job) {
    const result = this.db.prepare(
      `INSERT INTO print_queue (order_id, printer_target, pdf_type, file_path)
         VALUES (@orderId, @printerTarget, @pdfType, @filePath)`
    ).run({
      orderId: job.orderId ?? null,
      printerTarget: job.printerTarget,
      pdfType: job.pdfType,
      filePath: job.filePath ?? null
    });
    return result.lastInsertRowid;
  }
  /**
   * Inserts multiple print jobs in a single transaction.
   * Returns the IDs of all inserted jobs.
   */
  insertMany(jobs) {
    const ids = [];
    const stmt = this.db.prepare(
      `INSERT INTO print_queue (order_id, printer_target, pdf_type, file_path)
       VALUES (@orderId, @printerTarget, @pdfType, @filePath)`
    );
    const insertAll = this.db.transaction((items) => {
      for (const job of items) {
        const result = stmt.run({
          orderId: job.orderId ?? null,
          printerTarget: job.printerTarget,
          pdfType: job.pdfType,
          filePath: job.filePath ?? null
        });
        ids.push(result.lastInsertRowid);
      }
    });
    insertAll(jobs);
    return ids;
  }
  /**
   * Retrieves a print job by its ID.
   * Returns null if not found.
   */
  getById(id) {
    const row = this.db.prepare("SELECT * FROM print_queue WHERE id = ?").get(id);
    if (!row) {
      return null;
    }
    return this.rowToPrintJob(row);
  }
  /**
   * Returns all print jobs ordered by creation time (oldest first).
   */
  getAll() {
    const rows = this.db.prepare("SELECT * FROM print_queue ORDER BY id ASC").all();
    return rows.map(this.rowToPrintJob);
  }
  /**
   * Returns all pending print jobs (status = 'pending') ordered by creation time.
   * These are the jobs waiting to be sent to a printer.
   */
  getPending() {
    const rows = this.db.prepare("SELECT * FROM print_queue WHERE status = 'pending' ORDER BY id ASC").all();
    return rows.map(this.rowToPrintJob);
  }
  /**
   * Returns all pending jobs for a specific printer target.
   */
  getPendingByTarget(target) {
    const rows = this.db.prepare(
      "SELECT * FROM print_queue WHERE status = 'pending' AND printer_target = ? ORDER BY id ASC"
    ).all(target);
    return rows.map(this.rowToPrintJob);
  }
  /**
   * Returns all jobs for a specific order, useful for tracking print progress of a sale.
   */
  getByOrderId(orderId) {
    const rows = this.db.prepare("SELECT * FROM print_queue WHERE order_id = ? ORDER BY id ASC").all(orderId);
    return rows.map(this.rowToPrintJob);
  }
  /**
   * Updates a job's status to 'printing'.
   * Called when the job is being sent to the printer.
   */
  markPrinting(id) {
    this.db.prepare("UPDATE print_queue SET status = 'printing' WHERE id = ?").run(id);
  }
  /**
   * Updates a job's status to 'completed'.
   * Called when the printer confirms successful printing.
   */
  markCompleted(id) {
    this.db.prepare("UPDATE print_queue SET status = 'completed' WHERE id = ?").run(id);
  }
  /**
   * Updates a job's status to 'error' with an error message and increments attempts.
   * Called when printing fails. The job can be retried later.
   */
  markError(id, errorMessage) {
    this.db.prepare(
      `UPDATE print_queue
         SET status = 'error', error_message = ?, attempts = attempts + 1
         WHERE id = ?`
    ).run(errorMessage, id);
  }
  /**
   * Resets a job back to 'pending' status for retry.
   * Clears the error message but preserves the attempt count.
   */
  retry(id) {
    this.db.prepare(
      `UPDATE print_queue
         SET status = 'pending', error_message = NULL
         WHERE id = ?`
    ).run(id);
  }
  /**
   * Resets all error jobs back to pending for a given printer target.
   * Useful when resuming a paused/errored printer.
   */
  retryAllByTarget(target) {
    this.db.prepare(
      `UPDATE print_queue
         SET status = 'pending', error_message = NULL
         WHERE status = 'error' AND printer_target = ?`
    ).run(target);
  }
  /**
   * Deletes completed jobs older than the given number of days.
   * Helps keep the queue table from growing indefinitely.
   */
  purgeCompleted(olderThanDays = 7) {
    const result = this.db.prepare(
      `DELETE FROM print_queue
         WHERE status = 'completed'
         AND created_at < datetime('now', '-' || ? || ' days')`
    ).run(olderThanDays);
    return result.changes;
  }
  /**
   * Returns the count of jobs grouped by status.
   */
  countByStatus() {
    const rows = this.db.prepare("SELECT status, COUNT(*) as cnt FROM print_queue GROUP BY status").all();
    const counts = {
      pending: 0,
      printing: 0,
      completed: 0,
      error: 0
    };
    for (const row of rows) {
      counts[row.status] = row.cnt;
    }
    return counts;
  }
  /**
   * Returns the total number of jobs in the queue.
   */
  count() {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM print_queue").get();
    return row.cnt;
  }
  /**
   * Converts a raw database row (snake_case) to a PrintJob (camelCase).
   */
  rowToPrintJob(row) {
    return {
      id: row.id,
      orderId: row.order_id,
      printerTarget: row.printer_target,
      pdfType: row.pdf_type,
      status: row.status,
      filePath: row.file_path,
      attempts: row.attempts,
      errorMessage: row.error_message,
      createdAt: row.created_at
    };
  }
}
const DEFAULT_OPTIONS = {
  maxAttempts: 3,
  pollIntervalMs: 1e3,
  retryDelayMs: 2e3,
  defaultTicketHeightMm: 200
};
class PrintQueueService {
  repository;
  printerManager;
  options;
  /** In-memory buffer cache for jobs awaiting printing (jobId → PDF buffer + metadata) */
  bufferCache = /* @__PURE__ */ new Map();
  /** Whether the background processing loop is running */
  running = false;
  /** Timer reference for the polling interval */
  pollTimer = null;
  /** Flag to indicate a processing cycle is in progress (prevents overlap) */
  processing = false;
  constructor(printerManager2, repository, options) {
    this.printerManager = printerManager2;
    this.repository = repository ?? new PrintQueueRepository();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  // ─── Enqueue ──────────────────────────────────────────────────────────────
  /**
   * Enqueues a batch of generated PDFs into the print queue.
   * Persists job metadata to the database and caches PDF buffers in memory.
   *
   * @param pdfs - Array of GeneratedPdf from the pdf-generator
   * @param orderId - Optional order ID to associate with these jobs
   * @returns Array of created job IDs
   */
  enqueue(pdfs, orderId) {
    const jobIds = [];
    for (const pdf of pdfs) {
      const id = this.repository.insert({
        orderId: orderId ?? null,
        printerTarget: pdf.target,
        pdfType: pdf.pdfType,
        filePath: null
      });
      this.bufferCache.set(id, { buffer: pdf.buffer, ticketHeightMm: pdf.ticketHeightMm });
      jobIds.push(id);
    }
    return jobIds;
  }
  // ─── Processing ───────────────────────────────────────────────────────────
  /**
   * Processes all pending jobs in the queue.
   * Sends each job to its target printer via PrinterManager.
   * Jobs for paused printers are skipped until the printer is resumed.
   *
   * @returns Number of jobs successfully processed in this cycle
   */
  async processQueue() {
    if (this.processing) {
      return 0;
    }
    this.processing = true;
    let processed = 0;
    try {
      const pendingJobs = this.repository.getPending();
      for (const job of pendingJobs) {
        if (this.printerManager.isPaused(job.printerTarget)) {
          continue;
        }
        if (job.attempts >= this.options.maxAttempts) {
          continue;
        }
        const success = await this.processJob(job);
        if (success) {
          processed++;
        }
      }
    } finally {
      this.processing = false;
    }
    return processed;
  }
  /**
   * Processes a single print job: sends the PDF buffer to the printer.
   *
   * @param job - The print job to process
   * @returns true if the job completed successfully
   */
  async processJob(job) {
    const cached = this.bufferCache.get(job.id);
    if (!cached) {
      this.repository.markError(job.id, "PDF buffer not found in cache (possible restart)");
      return false;
    }
    const { buffer } = cached;
    this.repository.markPrinting(job.id);
    try {
      const options = this.buildPrintOptions(job);
      const result = await this.printerManager.print(
        job.printerTarget,
        buffer,
        options
      );
      if (result.success) {
        this.repository.markCompleted(job.id);
        this.bufferCache.delete(job.id);
        return true;
      } else {
        this.repository.markError(job.id, result.error ?? "Unknown printer error");
        await this.scheduleRetry(job);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.repository.markError(job.id, errorMessage);
      await this.scheduleRetry(job);
      return false;
    }
  }
  /**
   * Builds the appropriate PrintOptions for a given job based on its type.
   * Stamps use DC55x25 media with landscape orientation.
   * Tickets use variable-height custom media with portrait orientation.
   * The ticket height is taken from the cached PDF metadata (actual generated height),
   * falling back to the configured default if not available.
   */
  buildPrintOptions(job) {
    if (job.printerTarget === "ticket") {
      const cached = this.bufferCache.get(job.id);
      const heightMm = cached?.ticketHeightMm ?? this.options.defaultTicketHeightMm;
      return {
        media: buildTicketMedia(heightMm),
        orientation: TICKET_ORIENTATION,
        jobName: `${job.pdfType}_${job.id}`
      };
    }
    return {
      media: STAMP_MEDIA,
      orientation: STAMP_ORIENTATION,
      jobName: `${job.pdfType}_${job.id}`
    };
  }
  /**
   * Schedules a retry for a failed job if it hasn't exceeded maxAttempts.
   * The retry resets the job to 'pending' after a delay.
   */
  async scheduleRetry(job) {
    const updatedJob = this.repository.getById(job.id);
    if (!updatedJob) return;
    if (updatedJob.attempts < this.options.maxAttempts) {
      await this.delay(this.options.retryDelayMs);
      this.repository.retry(job.id);
    }
  }
  // ─── Background Processing Loop ──────────────────────────────────────────
  /**
   * Starts the background processing loop.
   * The loop polls the queue at regular intervals and processes pending jobs.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.schedulePoll();
  }
  /**
   * Stops the background processing loop.
   * Does not cancel jobs currently being processed.
   */
  stop() {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
  /**
   * Returns whether the service is currently running.
   */
  isRunning() {
    return this.running;
  }
  /**
   * Schedules the next poll cycle.
   */
  schedulePoll() {
    if (!this.running) return;
    this.pollTimer = setTimeout(async () => {
      await this.processQueue();
      this.schedulePoll();
    }, this.options.pollIntervalMs);
  }
  // ─── Queue Management ─────────────────────────────────────────────────────
  /**
   * Retries all error jobs for a specific printer target.
   * Useful when resuming a printer that was offline/paused.
   *
   * @param target - The printer target whose errors to retry
   */
  retryErrorsByTarget(target) {
    this.repository.retryAllByTarget(target);
  }
  /**
   * Returns the current queue status summary.
   */
  getStatus() {
    return this.repository.countByStatus();
  }
  /**
   * Returns all jobs in the queue.
   */
  getQueue() {
    return this.repository.getAll();
  }
  /**
   * Returns pending jobs for a specific printer target.
   */
  getPendingByTarget(target) {
    return this.repository.getPendingByTarget(target);
  }
  /**
   * Purges completed jobs older than the specified number of days.
   * @param olderThanDays - Number of days threshold (default: 7)
   * @returns Number of jobs purged
   */
  purgeCompleted(olderThanDays) {
    return this.repository.purgeCompleted(olderThanDays);
  }
  /**
   * Clears the in-memory buffer cache.
   * Should only be called when stopping the service or during cleanup.
   */
  clearBufferCache() {
    this.bufferCache.clear();
  }
  /**
   * Returns the number of buffers currently cached in memory.
   * Useful for diagnostics and testing.
   */
  getBufferCacheSize() {
    return this.bufferCache.size;
  }
  // ─── Utilities ────────────────────────────────────────────────────────────
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
class PrinterAssignmentsRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Gets all stored assignments as a target → URI map.
   */
  getAll() {
    const rows = this.db.prepare("SELECT target, uri FROM printer_assignments").all();
    const result = {};
    for (const row of rows) {
      result[row.target] = row.uri;
    }
    return result;
  }
  /**
   * Saves or updates a single assignment.
   */
  set(target, uri, name) {
    this.db.prepare(
      `INSERT OR REPLACE INTO printer_assignments (target, uri, name, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
    ).run(target, uri, name ?? null);
  }
  /**
   * Removes an assignment.
   */
  remove(target) {
    this.db.prepare("DELETE FROM printer_assignments WHERE target = ?").run(target);
  }
}
let printerManager = null;
let printQueueService = null;
function getPrinterManager() {
  if (!printerManager) {
    let savedAssignments = {};
    try {
      const assignmentsRepo = new PrinterAssignmentsRepository();
      savedAssignments = assignmentsRepo.getAll();
    } catch (err) {
      console.warn("[Services] Failed to load printer assignments:", err);
    }
    printerManager = createPrinterManager(
      Object.keys(savedAssignments).length > 0 ? savedAssignments : void 0
    );
  }
  return printerManager;
}
function getPrintQueueService() {
  if (!printQueueService) {
    printQueueService = new PrintQueueService(getPrinterManager());
  }
  return printQueueService;
}
function initServices() {
  const queue = getPrintQueueService();
  queue.start();
  console.log("[Services] Print queue background processing started");
}
function shutdownServices() {
  if (printQueueService) {
    printQueueService.stop();
    printQueueService.clearBufferCache();
    console.log("[Services] Print queue stopped");
  }
}
function registerPrinterHandlers() {
  const queueRepo = new PrintQueueRepository();
  handleIpc("printer:getStatus", async () => {
    const printerManager2 = getPrinterManager();
    const statuses = await printerManager2.getStatus();
    return statuses.map((info) => ({
      id: info.id,
      name: info.name,
      target: info.target,
      status: info.status,
      uri: info.uri
    }));
  });
  handleIpc(
    "printer:print",
    (_config, _quantities, _profile) => {
      console.log(
        "[Printer] print called — printing is handled via sale:execute flow"
      );
    }
  );
  handleIpc("printer:pause", async () => {
    const printerManager2 = getPrinterManager();
    await printerManager2.pauseAll();
    console.log("[Printer] All printers paused");
  });
  handleIpc("printer:resume", async () => {
    const printerManager2 = getPrinterManager();
    await printerManager2.resumeAll();
    const queueService = getPrintQueueService();
    const targets = ["printer1", "printer2", "ticket"];
    for (const target of targets) {
      queueService.retryErrorsByTarget(target);
    }
    console.log("[Printer] All printers resumed, error jobs retried");
  });
  handleIpc("printer:getQueue", () => {
    const jobs = queueRepo.getAll();
    return jobs.map((job) => ({
      id: job.id,
      orderId: job.orderId ?? void 0,
      printerTarget: job.printerTarget,
      pdfType: job.pdfType,
      status: job.status,
      filePath: job.filePath ?? void 0,
      attempts: job.attempts,
      errorMessage: job.errorMessage ?? void 0
    }));
  });
  handleIpc("printer:discover", async () => {
    const printerManager2 = getPrinterManager();
    return printerManager2.discover();
  });
  handleIpc(
    "printer:assign",
    async (target, uri) => {
      const typedTarget = target;
      const typedUri = uri;
      if (!["printer1", "printer2", "ticket"].includes(typedTarget)) {
        return { success: false, error: `Invalid target: ${typedTarget}` };
      }
      if (!typedUri || typeof typedUri !== "string") {
        return { success: false, error: "Invalid printer URI" };
      }
      const printerManager2 = getPrinterManager();
      printerManager2.setAssignments({ [typedTarget]: typedUri });
      try {
        const assignmentsRepo = new PrinterAssignmentsRepository();
        assignmentsRepo.set(typedTarget, typedUri);
      } catch (err) {
        console.warn("[Printer] Failed to persist assignment:", err);
      }
      console.log(`[Printer] Reassigned ${typedTarget} → ${typedUri}`);
      return { success: true };
    }
  );
  handleIpc(
    "printer:getAssignments",
    () => {
      const printerManager2 = getPrinterManager();
      return printerManager2.getAssignments();
    }
  );
}
function calcSellos1(q) {
  return q.tarifaAS1 + q.tarifaA2S1 + q.tarifaBS1 + q.tarifaCS1 + q.tarifaAT1 * 4 + q.tarifa4T1 * 4;
}
function calcSellos2(q) {
  return q.tarifaAS2 + q.tarifaA2S2 + q.tarifaBS2 + q.tarifaCS2 + q.tarifaAT2 * 4 + q.tarifa4T2 * 4;
}
function calcTicketsUsed(q) {
  const totalTiras = q.tarifaAT1 + q.tarifa4T1 + q.tarifaAT2 + q.tarifa4T2;
  return totalTiras + 2;
}
function generateOrderLines(config, quantities, profile, sesionId) {
  const orders = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { precios, ticket, codigo, sello } = config;
  const evento = sello.eventos[sello.elevento] ?? sello.eventos[0];
  const eventName = evento?.nevento ?? sello.elnevento ?? "";
  const feria = evento?.nferia ?? sello.feria ?? "";
  const lugar = evento?.nlugar ?? sello.lugar ?? "";
  const fecha = evento?.fecha ?? "";
  const sellos1 = calcSellos1(quantities);
  const sellos2 = calcSellos2(quantities);
  const base = {
    event: eventName,
    venue: lugar,
    machine: codigo.maquina,
    transactionDate: now,
    currency: "EUR",
    paymentStatus: profile,
    sesionId,
    etiquetasRollo1: sellos1,
    etiquetasRollo2: sellos2,
    etiquetaMes: String(codigo.mes),
    tituloEvento: eventName,
    feria,
    lugar,
    fecha,
    mes: codigo.mes,
    annio: codigo.annio,
    documento: ""
  };
  const addLine = (vendType, productName, quantity, quantitySet, price) => {
    if (quantity <= 0) return;
    orders.push({
      ...base,
      vendType,
      productName,
      quantity,
      quantitySet,
      totalStamps: quantity * quantitySet,
      value: quantity * price
    });
  };
  addLine("Tarifa A", "Sello Modelo 1", quantities.tarifaAS1, 1, precios.tarifaA);
  addLine("Tarifa A2", "Sello Modelo 1", quantities.tarifaA2S1, 1, precios.tarifaA2);
  addLine("Tarifa B", "Sello Modelo 1", quantities.tarifaBS1, 1, precios.tarifaB);
  addLine("Tarifa C", "Sello Modelo 1", quantities.tarifaCS1, 1, precios.tarifaC);
  addLine("Tarifa A Tira 4", "Tira Modelo 1", quantities.tarifaAT1, 4, precios.tarifaTA ?? 0);
  addLine("Tira de 4 Tarifas", "Tira Modelo 1", quantities.tarifa4T1, 4, precios.tarifaT4 ?? 0);
  addLine("Tarifa A", "Sello Modelo 2", quantities.tarifaAS2, 1, precios.tarifaA);
  addLine("Tarifa A2", "Sello Modelo 2", quantities.tarifaA2S2, 1, precios.tarifaA2);
  addLine("Tarifa B", "Sello Modelo 2", quantities.tarifaBS2, 1, precios.tarifaB);
  addLine("Tarifa C", "Sello Modelo 2", quantities.tarifaCS2, 1, precios.tarifaC);
  addLine("Tarifa A Tira 4", "Tira Modelo 2", quantities.tarifaAT2, 4, precios.tarifaTA ?? 0);
  addLine("Tira de 4 Tarifas", "Tira Modelo 2", quantities.tarifa4T2, 4, precios.tarifaT4 ?? 0);
  return orders;
}
function executeSale(config, quantities, profile, db2) {
  const database = getDatabase();
  const sellos1 = calcSellos1(quantities);
  const sellos2 = calcSellos2(quantities);
  const ticketsUsed = calcTicketsUsed(quantities);
  if (sellos1 === 0 && sellos2 === 0) {
    return { success: false, error: "La cesta está vacía" };
  }
  if (config.ticket.rollo1 >= 0 && sellos1 > config.ticket.rollo1) {
    return { success: false, error: "No hay suficientes sellos en rollo 1" };
  }
  if (config.ticket.rollo2 >= 0 && sellos2 > config.ticket.rollo2) {
    return { success: false, error: "No hay suficientes sellos en rollo 2" };
  }
  if (ticketsUsed > config.ticket.tickets) {
    return { success: false, error: "No hay suficientes tickets" };
  }
  if (config.codigo.cliente > 9999) {
    return { success: false, error: "Límite de ID Cliente alcanzado (>9999)" };
  }
  const transaction = database.transaction(() => {
    const row = database.prepare("SELECT data FROM config WHERE id = 1").get();
    if (!row) {
      throw new Error("Config not initialized");
    }
    const currentConfig = JSON.parse(row.data);
    const newSesionId = currentConfig.codigo.cliente + 1;
    currentConfig.codigo.cliente = newSesionId;
    currentConfig.ticket.rollo1 -= sellos1;
    currentConfig.ticket.rollo2 -= sellos2;
    currentConfig.ticket.tickets -= ticketsUsed;
    database.prepare("INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)").run(JSON.stringify(currentConfig));
    const orders = generateOrderLines(config, quantities, profile, newSesionId);
    const insertStmt = database.prepare(`
      INSERT INTO orders (
        event, venue, machine, vend_type, product_name,
        transaction_date, quantity, quantity_set, total_stamps,
        currency, value, payment_status, sesion_id,
        etiquetas_rollo1, etiquetas_rollo2, etiqueta_mes,
        titulo_evento, feria, lugar, fecha, mes, annio, documento
      ) VALUES (
        @event, @venue, @machine, @vendType, @productName,
        @transactionDate, @quantity, @quantitySet, @totalStamps,
        @currency, @value, @paymentStatus, @sesionId,
        @etiquetasRollo1, @etiquetasRollo2, @etiquetaMes,
        @tituloEvento, @feria, @lugar, @fecha, @mes, @annio, @documento
      )
    `);
    for (const order of orders) {
      insertStmt.run({
        event: order.event,
        venue: order.venue ?? null,
        machine: order.machine ?? null,
        vendType: order.vendType,
        productName: order.productName ?? null,
        transactionDate: order.transactionDate,
        quantity: order.quantity,
        quantitySet: order.quantitySet,
        totalStamps: order.totalStamps,
        currency: order.currency ?? "EUR",
        value: order.value,
        paymentStatus: order.paymentStatus ?? null,
        sesionId: order.sesionId ?? null,
        etiquetasRollo1: order.etiquetasRollo1 ?? null,
        etiquetasRollo2: order.etiquetasRollo2 ?? null,
        etiquetaMes: order.etiquetaMes ?? null,
        tituloEvento: order.tituloEvento ?? null,
        feria: order.feria ?? null,
        lugar: order.lugar ?? null,
        fecha: order.fecha ?? null,
        mes: order.mes != null ? String(order.mes) : null,
        annio: order.annio ?? null,
        documento: order.documento ?? null
      });
    }
    return { sesionId: newSesionId, orders };
  });
  try {
    const result = transaction();
    return {
      success: true,
      sesionId: result.sesionId,
      sellos1,
      sellos2,
      tickets: ticketsUsed,
      orders: result.orders
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Error en transacción de venta: ${message}` };
  }
}
function cancelSale(input, db2) {
  const database = getDatabase();
  const { sellos1, sellos2, tickets } = input;
  if (sellos1 <= 0 && sellos2 <= 0) {
    return { success: false, error: "No hay venta anterior para anular" };
  }
  const transaction = database.transaction(() => {
    const row = database.prepare("SELECT data FROM config WHERE id = 1").get();
    if (!row) {
      throw new Error("Config not initialized");
    }
    const currentConfig = JSON.parse(row.data);
    const revertedSesionId = currentConfig.codigo.cliente - 1;
    currentConfig.codigo.cliente = revertedSesionId;
    currentConfig.ticket.rollo1 += sellos1;
    currentConfig.ticket.rollo2 += sellos2;
    currentConfig.ticket.tickets += tickets;
    database.prepare("INSERT OR REPLACE INTO config (id, data) VALUES (1, ?)").run(JSON.stringify(currentConfig));
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const insertStmt = database.prepare(`
      INSERT INTO orders (
        event, venue, machine, vend_type, product_name,
        transaction_date, quantity, quantity_set, total_stamps,
        currency, value, payment_status, sesion_id,
        etiquetas_rollo1, etiquetas_rollo2, etiqueta_mes,
        titulo_evento, feria, lugar, fecha, mes, annio, documento
      ) VALUES (
        @event, @venue, @machine, @vendType, @productName,
        @transactionDate, @quantity, @quantitySet, @totalStamps,
        @currency, @value, @paymentStatus, @sesionId,
        @etiquetasRollo1, @etiquetasRollo2, @etiquetaMes,
        @tituloEvento, @feria, @lugar, @fecha, @mes, @annio, @documento
      )
    `);
    insertStmt.run({
      event: "ELIMINAR ANTERIOR",
      venue: " ",
      machine: "error de impresión",
      vendType: " ",
      productName: " ",
      transactionDate: now,
      quantity: 0,
      quantitySet: 0,
      totalStamps: 0,
      currency: " ",
      value: 0,
      paymentStatus: "Error",
      sesionId: revertedSesionId,
      etiquetasRollo1: 0,
      etiquetasRollo2: 0,
      etiquetaMes: " ",
      tituloEvento: "Error",
      feria: " ",
      lugar: " ",
      fecha: "Error",
      mes: "Error",
      annio: "Error",
      documento: "Error"
    });
    return { sesionId: revertedSesionId };
  });
  try {
    const result = transaction();
    return {
      success: true,
      sesionId: result.sesionId
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Error en transacción de anulación: ${message}` };
  }
}
const MM_TO_PT$1 = 72 / 25.4;
const STAMP_WIDTH_MM = 55;
const STAMP_HEIGHT_MM = 25;
const STAMP_WIDTH = STAMP_WIDTH_MM * MM_TO_PT$1;
const STAMP_HEIGHT = STAMP_HEIGHT_MM * MM_TO_PT$1;
const FONTS = {
  regular: "FranklinGothic",
  bold: "FranklinGothicBold",
  condensed: "FranklinGothicCondensed"
};
function getFontsPath() {
  if (utils.is.dev) {
    return path.join(__dirname, "../../resources/fonts");
  }
  return path.join(process.resourcesPath, "fonts");
}
function getImagesPath() {
  if (utils.is.dev) {
    return path.join(__dirname, "../../resources/images");
  }
  return path.join(process.resourcesPath, "images");
}
function registerFonts$1(doc) {
  const fontsPath = getFontsPath();
  const regularPath = path.join(fontsPath, "franklin_gothic.ttf");
  const boldPath = path.join(fontsPath, "franklin_gothic_bold.ttf");
  const condensedPath = path.join(fontsPath, "franklin_gothic_condensed.ttf");
  if (fs.existsSync(regularPath)) {
    doc.registerFont(FONTS.regular, regularPath);
  }
  if (fs.existsSync(boldPath)) {
    doc.registerFont(FONTS.bold, boldPath);
  }
  if (fs.existsSync(condensedPath)) {
    doc.registerFont(FONTS.condensed, condensedPath);
  }
}
function bottomToTop(bottomY_mm, fontSizePt) {
  const bottomYPt = bottomY_mm * MM_TO_PT$1;
  return STAMP_HEIGHT - bottomYPt - fontSizePt;
}
function drawTextRight(doc, text, fontName, fontSize, xRight_mm, yBottom_mm) {
  doc.font(fontName).fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  const x = xRight_mm * MM_TO_PT$1 - textWidth;
  const y = bottomToTop(yBottom_mm, fontSize);
  doc.text(text, x, y, { lineBreak: false });
}
function drawTextLeft(doc, text, fontName, fontSize, x_mm, yBottom_mm) {
  doc.font(fontName).fontSize(fontSize);
  const x = x_mm * MM_TO_PT$1;
  const y = bottomToTop(yBottom_mm, fontSize);
  doc.text(text, x, y, { lineBreak: false });
}
function drawBackground(doc, imageSource) {
  if (!imageSource) return;
  try {
    if (imageSource.startsWith("data:")) {
      const base64Data = imageSource.split(",")[1];
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");
        doc.image(buffer, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT });
      }
    } else if (fs.existsSync(imageSource)) {
      doc.image(imageSource, 0, 0, { width: STAMP_WIDTH, height: STAMP_HEIGHT });
    }
  } catch {
  }
}
function collectPdf$1(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
async function renderStamp(params) {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: "Etiqueta", Author: "Stamp Sales App" }
  });
  const result = collectPdf$1(doc);
  registerFonts$1(doc);
  drawBackground(doc, params.backgroundImage);
  drawBackground(doc, params.overlayImage);
  drawTextLeft(doc, params.tarifa, FONTS.regular, 12, 2, 19.5);
  drawTextRight(doc, params.evento, FONTS.regular, 9, 53, 19);
  drawTextRight(doc, params.fecha, FONTS.regular, 9, 53, 15);
  drawTextLeft(doc, params.codigo, FONTS.regular, 6, 2, 15);
  doc.end();
  return result;
}
async function renderStampMultiPage(stamps) {
  if (stamps.length === 0) {
    throw new Error("No stamps to render");
  }
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: `Tira de ${stamps.length} etiquetas`, Author: "Stamp Sales App" }
  });
  const result = collectPdf$1(doc);
  registerFonts$1(doc);
  stamps.forEach((stamp, index) => {
    if (index > 0) {
      doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 });
    }
    drawBackground(doc, stamp.backgroundImage);
    drawBackground(doc, stamp.overlayImage);
    drawTextLeft(doc, stamp.tarifa, FONTS.regular, 12, 2, 19.5);
    drawTextRight(doc, stamp.evento, FONTS.regular, 9, 53, 19);
    drawTextRight(doc, stamp.fecha, FONTS.regular, 9, 53, 15);
    drawTextLeft(doc, stamp.codigo, FONTS.regular, 6, 2, 15);
  });
  doc.end();
  return result;
}
async function renderStampEspecialStrip(codigos, especial, tarifa) {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    info: { Title: "Tira Especial", Author: "Stamp Sales App" }
  });
  const result = collectPdf$1(doc);
  registerFonts$1(doc);
  const imagesPath = getImagesPath();
  const bg1 = path.join(imagesPath, "TiraEspecial1.png");
  drawBackground(doc, fs.existsSync(bg1) ? bg1 : null);
  drawTextLeft(doc, codigos[0], FONTS.regular, 6, 1.5, 2);
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2);
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 });
  const bg2 = path.join(imagesPath, "TiraEspecial2.png");
  drawBackground(doc, fs.existsSync(bg2) ? bg2 : null);
  drawTextLeft(doc, tarifa, FONTS.regular, 12, 1.5, 19.5);
  drawTextLeft(doc, codigos[1], FONTS.regular, 6, 1.5, 2);
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2);
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 });
  const bg3 = path.join(imagesPath, "TiraEspecial3.png");
  drawBackground(doc, fs.existsSync(bg3) ? bg3 : null);
  drawTextLeft(doc, tarifa, FONTS.regular, 12, 1.5, 19.5);
  drawTextLeft(doc, codigos[2], FONTS.regular, 6, 1.5, 2);
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2);
  doc.addPage({ size: [STAMP_WIDTH, STAMP_HEIGHT], margin: 0 });
  const bg4 = path.join(imagesPath, "TiraEspecial4.png");
  drawBackground(doc, fs.existsSync(bg4) ? bg4 : null);
  drawTextLeft(doc, codigos[3], FONTS.regular, 6, 1.5, 2);
  drawTextLeft(doc, especial, FONTS.regular, 6, 23.3, 2);
  doc.end();
  return result;
}
const MM_TO_PT = 72 / 25.4;
const TICKET_WIDTH_MM = 78;
const TICKET_WIDTH = TICKET_WIDTH_MM * MM_TO_PT;
function registerFonts(doc) {
  const fontsPath = getFontsPath();
  const regularPath = path.join(fontsPath, "franklin_gothic.ttf");
  const boldPath = path.join(fontsPath, "franklin_gothic_bold.ttf");
  const condensedPath = path.join(fontsPath, "franklin_gothic_condensed.ttf");
  if (fs.existsSync(regularPath)) {
    doc.registerFont(FONTS.regular, regularPath);
  }
  if (fs.existsSync(boldPath)) {
    doc.registerFont(FONTS.bold, boldPath);
  }
  if (fs.existsSync(condensedPath)) {
    doc.registerFont(FONTS.condensed, condensedPath);
  }
}
function countActiveItems(items) {
  return items.filter((item) => item.cantidad > 0).length;
}
function formatClientId(id) {
  if (id < 10) return "000" + id;
  if (id < 100) return "00" + id;
  if (id < 1e3) return "0" + id;
  return "" + id;
}
function formatPrice(value) {
  const str = value.toFixed(2);
  return str + "€";
}
function drawCentered(doc, text, fontName, fontSize, y, pageWidth) {
  doc.font(fontName).fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  const x = (pageWidth - textWidth) / 2;
  doc.text(text, x, y, { lineBreak: false });
}
function drawLeft(doc, text, fontName, fontSize, x, y) {
  doc.font(fontName).fontSize(fontSize);
  doc.text(text, x, y, { lineBreak: false });
}
function drawRight(doc, text, fontName, fontSize, xRight, y) {
  doc.font(fontName).fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  doc.text(text, xRight - textWidth, y, { lineBreak: false });
}
function drawLine(doc, x, y, width) {
  doc.lineWidth(0.6);
  doc.dash(1.5, { space: 0.4 });
  doc.moveTo(x, y).lineTo(x + width, y).stroke();
  doc.undash();
}
function drawImage(doc, imageName, x, y, width) {
  const imgPath = path.join(getImagesPath(), imageName);
  if (!fs.existsSync(imgPath)) return false;
  try {
    doc.image(imgPath, x, y, { width });
    return true;
  } catch {
    return false;
  }
}
function drawImageCentered(doc, imageName, y, imgWidth, pageWidth) {
  const x = (pageWidth - imgWidth) / 2;
  return drawImage(doc, imageName, x, y, imgWidth);
}
function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
function calcTicketHeightMm(numItems) {
  return TICKET_MARGIN_TOP + TICKET_LOGO_HEIGHT + TICKET_HEADER_HEIGHT + TICKET_COLUMNS_HEIGHT + numItems * TICKET_ITEM_ROW_HEIGHT + TICKET_TOTAL_HEIGHT + TICKET_FOOTER_HEIGHT + TICKET_MARGIN_BOTTOM;
}
const TICKET_MARGIN_TOP = 5;
const TICKET_LOGO_HEIGHT = 14;
const TICKET_HEADER_HEIGHT = 32;
const TICKET_COLUMNS_HEIGHT = 5;
const TICKET_ITEM_ROW_HEIGHT = 3.5;
const TICKET_TOTAL_HEIGHT = 8;
const TICKET_FOOTER_HEIGHT = 20;
const TICKET_MARGIN_BOTTOM = 5;
function calcTicketCajaHeightMm(numItems) {
  return 5 + 14 + 38 + 5 + numItems * 3.5 + 8 + 16 + 5;
}
const MASTER_MARGIN_TOP = 5;
const MASTER_LOGO_HEIGHT = 14;
const MASTER_HEADER_HEIGHT = 36;
const MASTER_COLUMNS_HEIGHT = 5;
const MASTER_ITEM_ROW_HEIGHT = 3.5;
const MASTER_TOTAL_HEIGHT = 8;
const MASTER_FOOTER_HEIGHT = 20;
const MASTER_MARGIN_BOTTOM = 5;
function calcTicketMasterHeightMm(numItems) {
  return MASTER_MARGIN_TOP + MASTER_LOGO_HEIGHT + MASTER_HEADER_HEIGHT + MASTER_COLUMNS_HEIGHT + numItems * MASTER_ITEM_ROW_HEIGHT + MASTER_TOTAL_HEIGHT + MASTER_FOOTER_HEIGHT + MASTER_MARGIN_BOTTOM;
}
async function genTicket(params) {
  const {
    fechaTicket,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket,
    items,
    idCliente,
    nombreMaquina,
    productos,
    feria,
    lugar,
    empresa,
    cif,
    cp,
    l1,
    l2,
    l3
  } = params;
  const nitems = countActiveItems(items);
  const pageHeightMm = calcTicketHeightMm(nitems);
  const pageHeight = pageHeightMm * MM_TO_PT;
  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: "Factura Simplificada", Author: "Stamp Sales App" }
  });
  const result = collectPdf(doc);
  registerFonts(doc);
  const pageWidth = TICKET_WIDTH;
  let y = TICKET_MARGIN_TOP;
  drawImageCentered(doc, "image2.jpg", y * MM_TO_PT, 30 * MM_TO_PT, pageWidth);
  y += TICKET_LOGO_HEIGHT;
  drawImage(doc, "fondoticketori.png", 5 * MM_TO_PT, y * MM_TO_PT, 20 * MM_TO_PT);
  drawCentered(doc, feria, FONTS.bold, 12, y * MM_TO_PT, pageWidth);
  y += 5;
  drawCentered(doc, lugar, FONTS.bold, 10, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, empresa, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 3;
  drawCentered(doc, cif, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 3;
  drawCentered(doc, cp, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, "Fecha", FONTS.condensed, 8, y * MM_TO_PT, pageWidth);
  y += 3;
  drawCentered(doc, fechaTicket, FONTS.condensed, 8, y * MM_TO_PT, pageWidth);
  y += 4;
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, y * MM_TO_PT);
  y += 6;
  drawLeft(doc, "Producto", FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Cant.", FONTS.condensed, 8, 45 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Precio", FONTS.condensed, 8, 55 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Importe", FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT);
  y += 3;
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
  y += 2;
  let totalProductos = 0;
  let totalImporte = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const producto = productos[index];
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      totalProductos += item.cantidad;
      totalImporte += item.cantidad * producto.precio;
      const itemName = modeloTicket + " " + producto.nombre_ticket;
      const quantity = String(item.cantidad);
      const price = formatPrice(producto.precio);
      const total = formatPrice(item.cantidad * producto.precio);
      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
      y += TICKET_ITEM_ROW_HEIGHT;
    }
  }
  y += 1;
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT);
  y += 3;
  drawLeft(doc, "Total:", FONTS.condensed, 8, 35 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, formatPrice(totalImporte), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
  y += 4;
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
  y += 4;
  const clienteStr = formatClientId(idCliente);
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`;
  drawCentered(doc, sessionText, FONTS.condensed, 9, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, l1, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, l2, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, l3, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  doc.end();
  return result;
}
async function genTicketCaja(params) {
  const {
    items,
    idCliente,
    nombreMaquina,
    productos,
    feria,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket
  } = params;
  const nitems = countActiveItems(items);
  const HEADER_HEIGHT_MM = 72;
  const FOOTER_HEIGHT_MM = 22;
  const ITEM_HEIGHT_MM = 3.5;
  const pageHeightMm = HEADER_HEIGHT_MM + nitems * ITEM_HEIGHT_MM + FOOTER_HEIGHT_MM;
  const pageHeight = pageHeightMm * MM_TO_PT;
  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: "Copia Ticket Caja", Author: "Stamp Sales App" }
  });
  const result = collectPdf(doc);
  registerFonts(doc);
  const pageWidth = TICKET_WIDTH;
  let y = 2;
  drawImageCentered(doc, "image2.jpg", y * MM_TO_PT, 30 * MM_TO_PT, pageWidth);
  y += 12;
  drawImage(doc, "fondoticketcop-nada.png", 5 * MM_TO_PT, (y + 2) * MM_TO_PT, 20 * MM_TO_PT);
  drawCentered(doc, feria, FONTS.bold, 12, y * MM_TO_PT, pageWidth);
  y += 5;
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, y * MM_TO_PT);
  y += 4;
  drawLeft(doc, "TARJETA P.:", FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT);
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT);
  y += 6;
  drawLeft(doc, "TP TUSELLO:", FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT);
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT);
  y += 6;
  drawLeft(doc, "ATM SOBRE:", FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT);
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT);
  y += 6;
  drawLeft(doc, "ATM Tarifa A:", FONTS.bold, 12, 20 * MM_TO_PT, y * MM_TO_PT);
  drawLine(doc, 55 * MM_TO_PT, y * MM_TO_PT + 12, pageWidth - 55 * MM_TO_PT - 5 * MM_TO_PT);
  y += 7;
  drawLeft(doc, "Producto", FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Cantidad", FONTS.condensed, 8, 30 * MM_TO_PT, y * MM_TO_PT);
  y += 3;
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
  y += 2;
  let totalProductos = 0;
  let totalImporte = 0;
  let inicioMod2 = false;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const producto = productos[index];
      const isModel2 = item.idProducto.slice(-1) === "2";
      const modeloTicket = isModel2 ? modelo2Ticket : modelo1Ticket;
      if (isModel2 && !inicioMod2) {
        drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
        inicioMod2 = true;
        y += 2;
      }
      totalProductos += item.cantidad;
      totalImporte += item.cantidad * producto.precio;
      const itemName = modeloTicket + " " + producto.nombre_ticket;
      const quantity = String(item.cantidad);
      const price = formatPrice(producto.precio);
      const total = formatPrice(item.cantidad * producto.precio);
      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
      y += ITEM_HEIGHT_MM;
    }
  }
  y += 2;
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT);
  y += 3;
  drawLeft(doc, "Total:", FONTS.condensed, 8, 35 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, formatPrice(totalImporte), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
  y += 4;
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
  y += 4;
  const clienteStr = formatClientId(idCliente);
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`;
  drawCentered(doc, sessionText, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, "PARA RECOGER SU PEDIDO", FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, "PASE POR CAJA y ENTREGUE ESTE RESGUARDO", FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  doc.end();
  return result;
}
async function genTicketMaster(params) {
  const {
    fechaTicket,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket,
    items,
    idCliente,
    nombreMaquina,
    feria,
    lugar,
    empresa,
    cif,
    cp,
    l1,
    l2,
    l3
  } = params;
  const nitems = countActiveItems(items);
  const HEADER_HEIGHT_MM = 66;
  const FOOTER_HEIGHT_MM = 30;
  const ITEM_HEIGHT_MM = 3;
  const pageHeightMm = HEADER_HEIGHT_MM + nitems * ITEM_HEIGHT_MM + FOOTER_HEIGHT_MM;
  const pageHeight = pageHeightMm * MM_TO_PT;
  const doc = new PDFDocument({
    size: [TICKET_WIDTH, pageHeight],
    margin: 0,
    info: { Title: "Master Set Ticket", Author: "Stamp Sales App" }
  });
  const result = collectPdf(doc);
  registerFonts(doc);
  const pageWidth = TICKET_WIDTH;
  let y = 2;
  drawImageCentered(doc, "image2.jpg", y * MM_TO_PT, 30 * MM_TO_PT, pageWidth);
  y += 12;
  drawImage(doc, "fondoticketcop.png", 5 * MM_TO_PT, y * MM_TO_PT, 70 * MM_TO_PT);
  drawCentered(doc, feria, FONTS.bold, 12, y * MM_TO_PT, pageWidth);
  y += 5;
  drawCentered(doc, lugar, FONTS.bold, 10, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, empresa, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 3;
  drawCentered(doc, cif, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 3;
  drawCentered(doc, cp, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, fechaTicket, FONTS.condensed, 8, y * MM_TO_PT, pageWidth);
  y += 4;
  drawLeft(doc, "MASTER SET", FONTS.bold, 9.5, 5 * MM_TO_PT, y * MM_TO_PT);
  y += 3;
  drawLeft(doc, modoTicket, FONTS.bold, 6.5, 5 * MM_TO_PT, y * MM_TO_PT);
  y += 4;
  drawLeft(doc, "Producto", FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Cant.", FONTS.condensed, 8, 45 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Precio", FONTS.condensed, 8, 55 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, "Importe", FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT);
  y += 3;
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
  y += 2;
  const MASTER_SET_PRICE = 31.05;
  let totalItems = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      totalItems++;
      const itemName = modeloTicket + " Master Set";
      drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, "1", FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, formatPrice(MASTER_SET_PRICE), FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, formatPrice(MASTER_SET_PRICE), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
      y += ITEM_HEIGHT_MM;
    }
  }
  y += 2;
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT);
  y += 3;
  const masterTotal = totalItems * MASTER_SET_PRICE;
  drawLeft(doc, `Total:     ${totalItems}`, FONTS.condensed, 8, 40 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, formatPrice(masterTotal), FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT);
  y += 4;
  drawLine(doc, 5 * MM_TO_PT, y * MM_TO_PT, pageWidth - 2 * 5 * MM_TO_PT);
  y += 4;
  const clienteStr = formatClientId(idCliente);
  const sessionText = `${nombreMaquina} - Sesión: ${clienteStr}`;
  drawCentered(doc, sessionText, FONTS.condensed, 9, y * MM_TO_PT, pageWidth);
  y += 5;
  drawCentered(doc, l1, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, l2, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  y += 4;
  drawCentered(doc, l3, FONTS.bold, 7.5, y * MM_TO_PT, pageWidth);
  doc.end();
  return result;
}
function resolveImageLayers(options) {
  const notifications = [];
  let backgroundImage = null;
  let overlayImage = null;
  const { printFondo, printSello, fondoImage, selloImage } = options;
  if (printSello && !selloImage) {
    notifications.push({
      type: "missing_image",
      imageType: "sello",
      message: "La imagen del sello está activada pero no fue encontrada para la feria activa"
    });
  }
  if (printFondo && !fondoImage) {
    notifications.push({
      type: "missing_image",
      imageType: "fondo",
      message: "La imagen de fondo está activada pero no fue encontrada para la feria activa"
    });
  }
  if (printSello && printFondo) {
    backgroundImage = fondoImage;
    overlayImage = selloImage;
  } else if (printSello) {
    backgroundImage = selloImage;
  } else if (printFondo) {
    backgroundImage = fondoImage;
  }
  return { backgroundImage, overlayImage, notifications };
}
function formatMes(mesCfg) {
  const month = mesCfg === 0 ? (/* @__PURE__ */ new Date()).getMonth() + 1 : mesCfg;
  if (month === 10) return "O";
  if (month === 11) return "N";
  if (month === 12) return "D";
  return month.toString();
}
function formatAnnio(annioCfg) {
  if (annioCfg === "auto") {
    return ((/* @__PURE__ */ new Date()).getFullYear() - 2e3).toString();
  }
  return annioCfg;
}
function formatCliente(cliente) {
  return cliente.toString().padStart(4, "0");
}
function formatProducto(producto) {
  return producto.toString().padStart(3, "0");
}
function buildLabelCode(config, productoId) {
  const { codigo } = config;
  const modo = codigo.modo;
  const mes = formatMes(codigo.mes);
  const pais = codigo.pais;
  const annio = formatAnnio(codigo.annio);
  const maquina = codigo.maquina;
  const cliente = formatCliente(codigo.cliente);
  const producto = formatProducto(productoId);
  return `${modo}${mes}${pais}${annio} ${maquina}-${cliente}-${producto}`;
}
function buildTicketTitle(profile, baseTitle) {
  const profileLower = profile.toLowerCase();
  if (profileLower === "filatelia") return `Filatelia de: ${baseTitle}`;
  if (profileLower === "protocolo") return `Protocolo de: ${baseTitle}`;
  if (profileLower === "spde") return `SPDE de: ${baseTitle}`;
  return baseTitle;
}
function getTicketDateTime(config) {
  const { ticket } = config;
  const now = /* @__PURE__ */ new Date();
  const fecha = ticket.fecha === "auto" ? now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : ticket.fecha;
  const hora = ticket.hora === "auto" ? now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ticket.hora;
  return `${fecha} ${hora}`;
}
function getModelBackground(modelName, imagesRepo, syncRepo) {
  if (!modelName) return null;
  const image = imagesRepo.getByName(modelName);
  if (image) return image.url;
  if (syncRepo) {
    const fairs = syncRepo.getFairList();
    const matchedFair = fairs.find(
      (f) => f.fairName.toLowerCase() === modelName.toLowerCase()
    );
    if (matchedFair) {
      const fondoName = buildImageName(matchedFair.year, matchedFair.fairName, "fondo");
      const fondoImage = imagesRepo.getByName(fondoName);
      return fondoImage?.url ?? null;
    }
  }
  return null;
}
function buildTicketData(quantities, precios) {
  const tarifaTA = precios.tarifaTA ?? precios.tarifaA * 4;
  const tarifaT4 = precios.tarifaT4 ?? precios.tarifaA + precios.tarifaA2 + precios.tarifaB + precios.tarifaC;
  const items = [
    { idProducto: "AT1", cantidad: quantities.tarifaAT1 },
    { idProducto: "AT2", cantidad: quantities.tarifaAT2 },
    { idProducto: "4T1", cantidad: quantities.tarifa4T1 },
    { idProducto: "4T2", cantidad: quantities.tarifa4T2 },
    { idProducto: "AS1", cantidad: quantities.tarifaAS1 },
    { idProducto: "AS2", cantidad: quantities.tarifaAS2 },
    { idProducto: "A2S1", cantidad: quantities.tarifaA2S1 },
    { idProducto: "A2S2", cantidad: quantities.tarifaA2S2 },
    { idProducto: "BS1", cantidad: quantities.tarifaBS1 },
    { idProducto: "BS2", cantidad: quantities.tarifaBS2 },
    { idProducto: "CS1", cantidad: quantities.tarifaCS1 },
    { idProducto: "CS2", cantidad: quantities.tarifaCS2 }
  ];
  const productos = [
    { idProducto: "AT1", modo: "T", precio: tarifaTA, nombre_ticket: "Tarifa A Tira 4" },
    { idProducto: "AT2", modo: "T", precio: tarifaTA, nombre_ticket: "Tarifa A Tira 4" },
    { idProducto: "4T1", modo: "T", precio: tarifaT4, nombre_ticket: "Tira de 4 Tarifas" },
    { idProducto: "4T2", modo: "T", precio: tarifaT4, nombre_ticket: "Tira de 4 Tarifas" },
    { idProducto: "AS1", modo: "S", precio: precios.tarifaA, nombre_ticket: "Tarifa A" },
    { idProducto: "AS2", modo: "S", precio: precios.tarifaA, nombre_ticket: "Tarifa A" },
    { idProducto: "A2S1", modo: "S", precio: precios.tarifaA2, nombre_ticket: "Tarifa A2" },
    { idProducto: "A2S2", modo: "S", precio: precios.tarifaA2, nombre_ticket: "Tarifa A2" },
    { idProducto: "BS1", modo: "S", precio: precios.tarifaB, nombre_ticket: "Tarifa B" },
    { idProducto: "BS2", modo: "S", precio: precios.tarifaB, nombre_ticket: "Tarifa B" },
    { idProducto: "CS1", modo: "S", precio: precios.tarifaC, nombre_ticket: "Tarifa C" },
    { idProducto: "CS2", modo: "S", precio: precios.tarifaC, nombre_ticket: "Tarifa C" }
  ];
  return { items, productos };
}
const TARIFF_DEFS = [
  // Model 1 simple stamps
  { qtyKey: "tarifaAS1", label: "Tarifa A", isTira: false, model: 1, target: "printer1" },
  { qtyKey: "tarifaA2S1", label: "Tarifa A2", isTira: false, model: 1, target: "printer1" },
  { qtyKey: "tarifaBS1", label: "Tarifa B", isTira: false, model: 1, target: "printer1" },
  { qtyKey: "tarifaCS1", label: "Tarifa C", isTira: false, model: 1, target: "printer1" },
  // Model 1 tiras
  { qtyKey: "tarifaAT1", label: "Tarifa A", isTira: true, model: 1, target: "printer1" },
  { qtyKey: "tarifa4T1", label: "Tira 4 Tarifas", isTira: true, model: 1, target: "printer1" },
  // Model 2 simple stamps
  { qtyKey: "tarifaAS2", label: "Tarifa A", isTira: false, model: 2, target: "printer2" },
  { qtyKey: "tarifaA2S2", label: "Tarifa A2", isTira: false, model: 2, target: "printer2" },
  { qtyKey: "tarifaBS2", label: "Tarifa B", isTira: false, model: 2, target: "printer2" },
  { qtyKey: "tarifaCS2", label: "Tarifa C", isTira: false, model: 2, target: "printer2" },
  // Model 2 tiras
  { qtyKey: "tarifaAT2", label: "Tarifa A", isTira: true, model: 2, target: "printer2" },
  { qtyKey: "tarifa4T2", label: "Tira 4 Tarifas", isTira: true, model: 2, target: "printer2" }
];
async function generateSalePdfs(config, quantities, profile, imagesRepo, imageLayerOptions) {
  const repo = new ImagesRepository();
  const pdfs = [];
  const notifications = [];
  let productoCounter = 1;
  const eventoIndex = config.sello.elevento;
  const evento = config.sello.eventos?.[eventoIndex];
  const stampFecha = evento?.fecha ?? "";
  const stampEvento = evento?.localidad ?? "";
  const model1Name = evento?.motivoi ?? config.sello.modelo1 ?? "";
  const model2Name = evento?.motivod ?? config.sello.modelo2 ?? "";
  let bg1 = null;
  let bg2 = null;
  let overlay1 = null;
  let overlay2 = null;
  if (imageLayerOptions) {
    const layerResult = resolveImageLayers(imageLayerOptions);
    bg1 = layerResult.backgroundImage;
    bg2 = layerResult.backgroundImage;
    overlay1 = layerResult.overlayImage;
    overlay2 = layerResult.overlayImage;
    notifications.push(...layerResult.notifications);
  } else {
    let syncRepo;
    try {
      syncRepo = new ImageSyncRepository();
    } catch {
    }
    bg1 = getModelBackground(model1Name, repo, syncRepo);
    bg2 = getModelBackground(model2Name, repo, syncRepo);
  }
  const usesBlankBackground = config.codigo.modo === "MD" || config.codigo.modo === "FI";
  for (const tariff of TARIFF_DEFS) {
    const qty = quantities[tariff.qtyKey];
    if (qty <= 0) continue;
    const background = usesBlankBackground ? null : tariff.model === 1 ? bg1 : bg2;
    const overlay = usesBlankBackground ? null : tariff.model === 1 ? overlay1 : overlay2;
    if (tariff.isTira) {
      for (let i = 0; i < qty; i++) {
        const stamps = [];
        if (tariff.qtyKey.startsWith("tarifa4T")) {
          const tariffLabels = ["Tarifa A", "Tarifa A2", "Tarifa B", "Tarifa C"];
          for (const tLabel of tariffLabels) {
            stamps.push({
              tarifa: tLabel,
              fecha: stampFecha,
              evento: stampEvento,
              codigo: buildLabelCode(config, productoCounter),
              backgroundImage: background,
              overlayImage: overlay
            });
            productoCounter++;
          }
        } else {
          for (let j = 0; j < 4; j++) {
            stamps.push({
              tarifa: tariff.label,
              fecha: stampFecha,
              evento: stampEvento,
              codigo: buildLabelCode(config, productoCounter),
              backgroundImage: background,
              overlayImage: overlay
            });
            productoCounter++;
          }
        }
        const pdfBuffer = await renderStampMultiPage(stamps);
        pdfs.push({
          buffer: pdfBuffer,
          target: tariff.target,
          pdfType: "stamp_tira",
          description: `Tira ${tariff.label} modelo${tariff.model} #${i + 1}`
        });
      }
    } else {
      for (let i = 0; i < qty; i++) {
        const pdfBuffer = await renderStamp({
          tarifa: tariff.label,
          fecha: stampFecha,
          evento: stampEvento,
          codigo: buildLabelCode(config, productoCounter),
          backgroundImage: background,
          overlayImage: overlay
        });
        productoCounter++;
        pdfs.push({
          buffer: pdfBuffer,
          target: tariff.target,
          pdfType: "stamp_simple",
          description: `${tariff.label} modelo${tariff.model} #${i + 1}`
        });
      }
    }
  }
  const counterRef = { value: productoCounter };
  await generateEspecialStrips(config, quantities, counterRef, pdfs);
  productoCounter = counterRef.value;
  const { items, productos } = buildTicketData(quantities, config.precios);
  const hasAnyItems = items.some((item) => item.cantidad > 0);
  if (hasAnyItems) {
    const fechaTicket = getTicketDateTime(config);
    const modoTicket = buildTicketTitle(profile, config.ticket.titulo);
    const modelo1Ticket = model1Name || "Modelo 1";
    const modelo2Ticket = model2Name || "Modelo 2";
    const nitems = countActiveItems(items);
    const ticketHeightMm = calcTicketHeightMm(nitems);
    const ticketCajaHeightMm = calcTicketCajaHeightMm(nitems);
    const ticketMasterHeightMm = calcTicketMasterHeightMm(nitems);
    const ticketBuffer = await genTicket({
      fechaTicket,
      modoTicket,
      modelo1Ticket,
      modelo2Ticket,
      items,
      idCliente: config.codigo.cliente,
      nombreMaquina: config.codigo.maquina,
      productos,
      feria: config.ticket.feria,
      lugar: config.ticket.lugar,
      empresa: config.ticket.empresa,
      cif: config.ticket.cif,
      cp: config.ticket.cp,
      l1: config.ticket.l1,
      l2: config.ticket.l2,
      l3: config.ticket.l3
    });
    pdfs.push({
      buffer: ticketBuffer,
      target: "ticket",
      pdfType: "ticket",
      description: "Ticket principal (Factura Simplificada)",
      ticketHeightMm
    });
    if (config.ticket.ImprimeCopiaTicket === "S") {
      const ticketCajaBuffer = await genTicketCaja({
        items,
        idCliente: config.codigo.cliente,
        nombreMaquina: config.codigo.maquina,
        productos,
        feria: config.ticket.feria,
        modoTicket: config.ticket.tituloCopia || "COPIA Factura Simplificada",
        modelo1Ticket,
        modelo2Ticket
      });
      pdfs.push({
        buffer: ticketCajaBuffer,
        target: "ticket",
        pdfType: "ticket_caja",
        description: "Ticket copia (caja)",
        ticketHeightMm: ticketCajaHeightMm
      });
    }
    if (config.ticket.ImprimeMasterTicket === "S") {
      const ticketMasterBuffer = await genTicketMaster({
        fechaTicket,
        modoTicket: "Master Set",
        modelo1Ticket,
        modelo2Ticket,
        items,
        idCliente: config.codigo.cliente,
        nombreMaquina: config.codigo.maquina,
        feria: config.ticket.feria,
        lugar: config.ticket.lugar,
        empresa: config.ticket.empresa,
        cif: config.ticket.cif,
        cp: config.ticket.cp,
        l1: config.ticket.l1,
        l2: config.ticket.l2,
        l3: config.ticket.l3
      });
      pdfs.push({
        buffer: ticketMasterBuffer,
        target: "ticket",
        pdfType: "ticket_master",
        description: "Ticket master set",
        ticketHeightMm: ticketMasterHeightMm
      });
    }
    const maquinaPrefix = config.codigo.maquina.substring(0, 2).toUpperCase();
    if (maquinaPrefix !== "MD" && maquinaPrefix !== "FI") {
      for (let idx = 0; idx < items.length; idx++) {
        if (items[idx].cantidad > 0 && productos[idx].modo === "T") {
          for (let t = 0; t < items[idx].cantidad; t++) {
            const singleTiraItems = items.map((item, i) => ({
              idProducto: item.idProducto,
              cantidad: i === idx ? 1 : 0
            }));
            const singleTiraHeightMm = calcTicketHeightMm(1);
            const singleTiraBuffer = await genTicket({
              fechaTicket,
              modoTicket,
              modelo1Ticket,
              modelo2Ticket,
              items: singleTiraItems,
              idCliente: config.codigo.cliente,
              nombreMaquina: config.codigo.maquina,
              productos,
              feria: config.ticket.feria,
              lugar: config.ticket.lugar,
              empresa: config.ticket.empresa,
              cif: config.ticket.cif,
              cp: config.ticket.cp,
              l1: config.ticket.l1,
              l2: config.ticket.l2,
              l3: config.ticket.l3
            });
            pdfs.push({
              buffer: singleTiraBuffer,
              target: "ticket",
              pdfType: "ticket_tira",
              description: `Ticket individual tira ${productos[idx].nombre_ticket} #${t + 1}`,
              ticketHeightMm: singleTiraHeightMm
            });
          }
        }
      }
    }
  }
  const stampCount = pdfs.filter(
    (p) => p.pdfType === "stamp_simple" || p.pdfType === "stamp_tira" || p.pdfType === "stamp_especial"
  ).length;
  const ticketCount = pdfs.filter(
    (p) => p.pdfType === "ticket" || p.pdfType === "ticket_caja" || p.pdfType === "ticket_master" || p.pdfType === "ticket_tira"
  ).length;
  return { pdfs, stampCount, ticketCount, nextProducto: productoCounter, notifications };
}
async function generateEspecialStrips(config, quantities, counterRef, pdfs) {
  const { ticket } = config;
  const hasTiras1 = quantities.tarifaAT1 > 0 || quantities.tarifa4T1 > 0;
  const hasTiras2 = quantities.tarifaAT2 > 0 || quantities.tarifa4T2 > 0;
  if (ticket.TEmod1 === "S" && hasTiras1) {
    const especialPrices = [ticket.T1especial, ticket.T2especial, ticket.T3especial];
    for (let idx = 0; idx < especialPrices.length; idx++) {
      const price = especialPrices[idx];
      if (price && price > 0) {
        const codigos = [
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++)
        ];
        const tarifa = `Tarifa A${idx + 1 > 1 ? idx + 1 : ""}`;
        const buffer = await renderStampEspecialStrip(codigos, "  -E", tarifa);
        pdfs.push({
          buffer,
          target: "printer1",
          pdfType: "stamp_especial",
          description: `Tira especial ${idx + 1} modelo1`
        });
      }
    }
  }
  if (ticket.TEmod2 === "S" && hasTiras2) {
    const especialPrices = [ticket.T1especial, ticket.T2especial, ticket.T3especial];
    for (let idx = 0; idx < especialPrices.length; idx++) {
      const price = especialPrices[idx];
      if (price && price > 0) {
        const codigos = [
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++),
          buildLabelCode(config, counterRef.value++)
        ];
        const tarifa = `Tarifa A${idx + 1 > 1 ? idx + 1 : ""}`;
        const buffer = await renderStampEspecialStrip(codigos, "  -E", tarifa);
        pdfs.push({
          buffer,
          target: "printer2",
          pdfType: "stamp_especial",
          description: `Tira especial ${idx + 1} modelo2`
        });
      }
    }
  }
}
const pdfCache = /* @__PURE__ */ new Map();
function registerSaleHandlers() {
  const configRepo = new ConfigRepository();
  handleIpc(
    "sale:execute",
    async (config, quantities, profile, imageFlags) => {
      const typedConfig = config;
      const typedQuantities = quantities;
      const typedProfile = profile;
      const typedImageFlags = imageFlags;
      const result = executeSale(typedConfig, typedQuantities, typedProfile);
      if (!result.success) {
        return result;
      }
      notifyConfigChanged(configRepo.get());
      const updatedConfig = {
        ...typedConfig,
        codigo: {
          ...typedConfig.codigo,
          cliente: result.sesionId
        }
      };
      let imageLayerOptions;
      if (typedImageFlags) {
        const imagesRepo = new ImagesRepository();
        const imagenesConfig = configRepo.getImagenes();
        let fondoImage = null;
        let selloImage = null;
        if (imagenesConfig.activeFair) {
          const { year, fairName } = imagenesConfig.activeFair;
          const fondoName = buildImageName(year, fairName, "fondo");
          const selloName = buildImageName(year, fairName, "sello");
          const fondoRecord = imagesRepo.getByName(fondoName);
          const selloRecord = imagesRepo.getByName(selloName);
          fondoImage = fondoRecord?.url ?? null;
          selloImage = selloRecord?.url ?? null;
        }
        imageLayerOptions = {
          printFondo: typedImageFlags.printFondo,
          printSello: typedImageFlags.printSello,
          fondoImage,
          selloImage
        };
      }
      try {
        const pdfResult = await generateSalePdfs(
          updatedConfig,
          typedQuantities,
          typedProfile,
          void 0,
          imageLayerOptions
        );
        pdfCache.set(result.sesionId, pdfResult.pdfs);
        let printJobIds = [];
        try {
          const queueService = getPrintQueueService();
          printJobIds = queueService.enqueue(pdfResult.pdfs);
        } catch (enqueueErr) {
          const enqueueError = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr);
          console.error("[Sale] Failed to enqueue PDFs in print queue:", enqueueError);
        }
        return {
          ...result,
          pdfCount: pdfResult.stampCount + pdfResult.ticketCount,
          stampCount: pdfResult.stampCount,
          ticketCount: pdfResult.ticketCount,
          printJobIds
        };
      } catch (err) {
        const pdfError = err instanceof Error ? err.message : String(err);
        console.error("[Sale] PDF generation failed after successful transaction:", pdfError);
        return {
          ...result,
          pdfError: `Error generando PDFs: ${pdfError}`
        };
      }
    }
  );
  handleIpc(
    "sale:cancel",
    async (input) => {
      const typedInput = input;
      const result = cancelSale(typedInput);
      if (result.success) {
        notifyConfigChanged(configRepo.get());
      }
      return result;
    }
  );
}
function getAutoLaunchEnabled() {
  if (process.platform !== "win32") {
    return false;
  }
  const settings = electron.app.getLoginItemSettings();
  return settings.openAtLogin;
}
function setAutoLaunchEnabled(enabled) {
  if (process.platform !== "win32") {
    return;
  }
  electron.app.setLoginItemSettings({
    openAtLogin: enabled,
    // Pass --hidden flag so the app knows it was auto-launched
    // and can optionally start minimized or in system tray
    args: enabled ? ["--hidden"] : []
  });
}
function registerAutoLaunchHandlers() {
  handleIpc("autoLaunch:get", () => {
    return getAutoLaunchEnabled();
  });
  handleIpc("autoLaunch:set", (enabled) => {
    if (typeof enabled !== "boolean") {
      throw new Error("autoLaunch:set expects a boolean argument");
    }
    setAutoLaunchEnabled(enabled);
    return getAutoLaunchEnabled();
  });
}
function registerAllHandlers() {
  registerConfigHandlers();
  registerOrdersHandlers();
  registerImagesHandlers();
  registerPrinterHandlers();
  registerSaleHandlers();
  registerAutoLaunchHandlers();
}
function notifyConfigChanged(config) {
  const windows = electron.BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("config:changed", config);
  }
}
function handleIpc(channel, handler) {
  electron.ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[IPC] Error in channel "${channel}":`, message);
      throw new Error(message);
    }
  });
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.stamp-sales");
  initDatabase();
  const configRepo = new ConfigRepository();
  configRepo.initConfig();
  try {
    const basePath = path.join(
      electron.app.isPackaged ? path.dirname(electron.app.getPath("exe")) : electron.app.getAppPath(),
      "bbdd-ferias"
    );
    console.log("[sync-images] Starting image synchronization from:", basePath);
    const syncResult = syncImages(basePath);
    setLastSyncResult(syncResult);
    console.log(
      `[sync-images] Sync complete — inserted: ${syncResult.inserted}, updated: ${syncResult.updated}, deleted: ${syncResult.deleted}, unchanged: ${syncResult.unchanged}`
    );
    if (syncResult.errors.length > 0) {
      console.warn(`[sync-images] Sync finished with ${syncResult.errors.length} error(s):`);
      for (const err of syncResult.errors) {
        console.warn(`  - ${err.path}: ${err.error}`);
      }
    }
  } catch (err) {
    console.error("[sync-images] Image synchronization failed (non-blocking):", err);
  }
  registerAllHandlers();
  initServices();
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  shutdownServices();
  closeDatabase();
});
