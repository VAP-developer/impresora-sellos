"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const utils = require("@electron-toolkit/utils");
const Database = require("better-sqlite3");
const child_process = require("child_process");
const util = require("util");
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
const CONFIG_ERRORS = {
  CUT_NUMBER_OUT_OF_RANGE: "El número de corte debe estar entre 2 y 16",
  INVALID_LANGUAGE: 'El idioma debe ser "es" o "en"'
};
const DEFAULT_CONFIG = {
  ticket: {
    feria: "XLIX Feria Nacional SelloJC",
    lugar: "Plaza Mayor - MadridJC",
    fecha: "auto",
    hora: "auto",
    titulo: "Factura SimplificadaJC",
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
      { nevento: "Feria MadridJJ", nferia: "XLIX Feria Nacional SelloJJ", nlugar: "Plaza Mayor MadridJJ", motivoi: "", motivod: "", fecha: "21-24 abril 2025", localidad: "Madrid" },
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
  // === Settings Methods ===
  /**
   * Get the cut number from config settings, returns default 4 if unset.
   */
  getCutNumber() {
    const config = this.get();
    return config?.settings?.cutNumber ?? 4;
  }
  /**
   * Set the cut number (validated 2-16 range).
   */
  setCutNumber(value) {
    if (value < 2 || value > 16 || !Number.isInteger(value)) {
      throw new Error(CONFIG_ERRORS.CUT_NUMBER_OUT_OF_RANGE);
    }
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.settings = { ...config.settings, cutNumber: value, language: config.settings?.language ?? "es" };
    this.set(config);
  }
  /**
   * Get the active language, returns default 'es' if unset.
   */
  getLanguage() {
    const config = this.get();
    return config?.settings?.language ?? "es";
  }
  /**
   * Set the active language (validated 'es' | 'en').
   */
  setLanguage(value) {
    if (value !== "es" && value !== "en") {
      throw new Error(CONFIG_ERRORS.INVALID_LANGUAGE);
    }
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.settings = { ...config.settings, cutNumber: config.settings?.cutNumber ?? 4, language: value };
    this.set(config);
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
  handleIpc("config:getCutNumber", () => {
    return repo.getCutNumber();
  });
  handleIpc("config:setCutNumber", (value) => {
    repo.setCutNumber(value);
  });
  handleIpc("config:getLanguage", () => {
    return repo.getLanguage();
  });
  handleIpc("config:setLanguage", (value) => {
    repo.setLanguage(value);
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
      const existingImage = imagesRepo.getByName(imageName);
      if (!existingImage) {
        try {
          const dataUri = fileToDataUri(file.filePath);
          const ext = path.extname(file.fileName).toLowerCase();
          const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
          const stat = fs.statSync(file.filePath);
          imagesRepo.upload(imageName, dataUri, mimeType, stat.size);
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
    if (!imageName) return null;
    const directResult = repo.getByName(imageName);
    if (directResult) return directResult;
    const fairs = syncRepo.getFairList();
    const matchedFair = fairs.find(
      (f) => f.fairName.toLowerCase() === imageName.toLowerCase()
    );
    if (matchedFair) {
      const fondoName = buildImageName(matchedFair.year, matchedFair.fairName, "fondo");
      const fondoResult = repo.getByName(fondoName);
      if (fondoResult) return fondoResult;
    }
    const allImages = repo.getAll();
    const lowerName = imageName.toLowerCase();
    const partialMatch = allImages.find(
      (img) => img.name.toLowerCase().includes(lowerName) && img.name.toLowerCase().includes("fondo")
    );
    if (partialMatch) {
      return { name: partialMatch.name, url: partialMatch.data };
    }
    const anyMatch = allImages.find(
      (img) => img.name.toLowerCase().includes(lowerName)
    );
    if (anyMatch) {
      return { name: anyMatch.name, url: anyMatch.data };
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
    let basePath;
    if (electron.app.isPackaged) {
      const exeDirPath = path.join(path.dirname(electron.app.getPath("exe")), "bbdd-ferias");
      const resourcesPath = path.join(process.resourcesPath, "bbdd-ferias");
      basePath = fs.existsSync(exeDirPath) ? exeDirPath : resourcesPath;
    } else {
      basePath = path.join(electron.app.getAppPath(), "bbdd-ferias");
    }
    const result = syncImages(basePath);
    lastSyncResult = result;
    return result;
  });
}
const execAsync = util.promisify(child_process.exec);
const defaultDiscoveryExecutor = {
  exec: (command) => execAsync(command, { timeout: 1e4 })
};
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
const defaultWindowsExecutor = {
  exec(command, options) {
    const { exec: nodeExec } = require("child_process");
    const { promisify } = require("util");
    const execAsync2 = promisify(nodeExec);
    return execAsync2(command, { timeout: options?.timeout ?? 1e4 });
  },
  execFile(file, args, options) {
    const { execFile: nodeExecFile } = require("child_process");
    const { promisify } = require("util");
    const execFileAsync = promisify(nodeExecFile);
    return execFileAsync(file, args, { timeout: options?.timeout ?? 3e4 });
  }
};
function getWindowsPrinterName(printerUri) {
  const encoded = printerUri.replace("win://", "");
  return decodeURIComponent(encoded);
}
function escapePsName(name) {
  return name.replace(/'/g, "''");
}
function getSumatraPdfPath() {
  const { join } = require("path");
  let sumatraPath = join(
    require.resolve("pdf-to-printer"),
    "..",
    "SumatraPDF-3.4.6-32.exe"
  );
  if (sumatraPath.includes("app.asar")) {
    sumatraPath = sumatraPath.replace("app.asar", "app.asar.unpacked");
  }
  return sumatraPath;
}
class WindowsBackend {
  cmd;
  constructor(executor) {
    this.cmd = executor ?? defaultWindowsExecutor;
  }
  /**
   * Prints a PDF by invoking SumatraPDF directly with:
   *   SumatraPDF.exe -print-to "PrinterName" -print-settings "noscale" -silent file.pdf
   *
   * "noscale" = print at 100% original size, no fitting, no shrinking.
   * The printer driver's paper size configuration determines the output.
   */
  async print(printerUri, pdfBuffer, options) {
    const { writeFileSync, unlinkSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const { tmpdir } = require("os");
    const printerName = getWindowsPrinterName(printerUri);
    const jobName = options.jobName ?? `print_${Date.now()}`;
    const tempDir = join(tmpdir(), "stamp-sales-print");
    try {
      mkdirSync(tempDir, { recursive: true });
    } catch {
    }
    const tempFile = join(tempDir, `${jobName}_${Date.now()}.pdf`);
    try {
      writeFileSync(tempFile, pdfBuffer);
      const sumatraPath = getSumatraPdfPath();
      const args = [
        "-print-to",
        printerName,
        "-print-settings",
        "noscale",
        "-silent",
        tempFile
      ];
      await this.cmd.execFile(sumatraPath, args, { timeout: 3e4 });
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
      return { success: false, error: `Print failed: ${message}` };
    }
  }
  async getStatus(printerUri) {
    const printerName = getWindowsPrinterName(printerUri);
    try {
      const escaped = escapePsName(printerName);
      const { stdout } = await this.cmd.exec(
        `powershell -NoProfile -Command "Get-Printer -Name '${escaped}' | Select-Object PrinterStatus | ConvertTo-Json -Compress"`,
        { timeout: 5e3 }
      );
      if (!stdout || stdout.trim().length === 0) return "disconnected";
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
  async pause(printerUri) {
    const escaped = escapePsName(getWindowsPrinterName(printerUri));
    try {
      await this.cmd.exec(`powershell -NoProfile -Command "Stop-Printer -Name '${escaped}'"`, { timeout: 5e3 });
      return true;
    } catch {
      return false;
    }
  }
  async resume(printerUri) {
    const escaped = escapePsName(getWindowsPrinterName(printerUri));
    try {
      await this.cmd.exec(`powershell -NoProfile -Command "Restart-Printer -Name '${escaped}'"`, { timeout: 5e3 });
      return true;
    } catch {
      return false;
    }
  }
  async discover() {
    const executor = {
      exec: (command) => this.cmd.exec(command, { timeout: 15e3 })
    };
    return discoverWindowsLocalPrinters(executor);
  }
  async cancelJob(printerUri, jobId) {
    const escaped = escapePsName(getWindowsPrinterName(printerUri));
    const numericJobId = parseInt(jobId, 10);
    if (isNaN(numericJobId)) return false;
    try {
      await this.cmd.exec(
        `powershell -NoProfile -Command "Remove-PrintJob -PrinterName '${escaped}' -ID ${numericJobId}"`,
        { timeout: 5e3 }
      );
      return true;
    } catch {
      return false;
    }
  }
}
const DEFAULT_THERMAL_CONFIG = {
  enabled: true,
  rotateDegrees: 0,
  paperWidthMm: 55,
  paperHeightMm: 25,
  forceSingleCopy: true
};
const STAMP_MEDIA = "DC55x55";
const STAMP_ORIENTATION = 6;
const TICKET_ORIENTATION = 0;
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
    const thermalConfig = this.assignments.thermalConfig?.[target];
    const optionsWithThermal = thermalConfig?.enabled ? { ...options, thermalConfig } : options;
    return this.backend.print(uri, pdfBuffer, optionsWithThermal);
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
function createPlatformBackend(platformOverride) {
  return new WindowsBackend();
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
      media: buildTicketMedia,
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
    const assignments = Object.keys(savedAssignments).length > 0 ? {
      ...savedAssignments,
      thermalConfig: {
        printer1: DEFAULT_THERMAL_CONFIG,
        printer2: DEFAULT_THERMAL_CONFIG
      }
    } : void 0;
    printerManager = createPrinterManager(assignments);
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
const TARIFF_GROUP_ERRORS = {
  DUPLICATE_YEAR: "Ya existe un grupo para ese año",
  MIN_INDIVIDUAL_TARIFFS: "Se requieren al menos 2 tarifas individuales",
  MAX_INDIVIDUAL_TARIFFS: "El máximo permitido es 20 tarifas individuales",
  STRIP_MIN_TARIFFS: "Una tira debe referenciar al menos 2 tarifas individuales",
  EMPTY_TITLE: "El título es obligatorio",
  EMPTY_CURRENCY: "El tipo de moneda es obligatorio",
  EMPTY_TARIFF_NAME: "El nombre de la tarifa es obligatorio",
  TARIFF_NAME_TOO_LONG: "El nombre no puede exceder 16 caracteres",
  INVALID_LOCAL_PRICE: "El precio local debe ser un número positivo",
  INVALID_SECONDARY_PRICE: "El precio complementario debe ser un número positivo",
  GROUP_IN_USE: "No se puede eliminar: el grupo está asociado a eventos",
  NOT_FOUND: "Grupo de tarifas no encontrado"
};
class TariffGroupsRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Validates tariff group input fields with type-aware rules.
   * Throws an error with a descriptive message if validation fails.
   */
  validate(input) {
    if (input.title !== void 0 && !input.title.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TITLE);
    }
    if (input.local_currency !== void 0 && !input.local_currency.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_CURRENCY);
    }
    if (input.complementary_currency !== void 0 && !input.complementary_currency.trim()) {
      throw new Error(TARIFF_GROUP_ERRORS.EMPTY_CURRENCY);
    }
    const individualCount = input.tariffs.length;
    if (individualCount < 2) {
      throw new Error(TARIFF_GROUP_ERRORS.MIN_INDIVIDUAL_TARIFFS);
    }
    if (individualCount > 20) {
      throw new Error(TARIFF_GROUP_ERRORS.MAX_INDIVIDUAL_TARIFFS);
    }
    for (const tariff of input.tariffs) {
      if (!tariff.name || !tariff.name.trim()) {
        throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TARIFF_NAME);
      }
      if (tariff.name.length > 16) {
        throw new Error(TARIFF_GROUP_ERRORS.TARIFF_NAME_TOO_LONG);
      }
      if (typeof tariff.local_price !== "number" || isNaN(tariff.local_price) || !isFinite(tariff.local_price) || tariff.local_price <= 0) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_LOCAL_PRICE);
      }
      if (typeof tariff.secondary_price !== "number" || isNaN(tariff.secondary_price) || !isFinite(tariff.secondary_price) || tariff.secondary_price < 0) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_SECONDARY_PRICE);
      }
    }
    for (const strip of input.strips) {
      if (!strip.name || !strip.name.trim()) {
        throw new Error(TARIFF_GROUP_ERRORS.EMPTY_TARIFF_NAME);
      }
      if (strip.name.length > 16) {
        throw new Error(TARIFF_GROUP_ERRORS.TARIFF_NAME_TOO_LONG);
      }
      if (typeof strip.local_price !== "number" || isNaN(strip.local_price) || !isFinite(strip.local_price) || strip.local_price <= 0) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_LOCAL_PRICE);
      }
      if (typeof strip.secondary_price !== "number" || isNaN(strip.secondary_price) || !isFinite(strip.secondary_price) || strip.secondary_price < 0) {
        throw new Error(TARIFF_GROUP_ERRORS.INVALID_SECONDARY_PRICE);
      }
      if (!strip.tariff_ids || strip.tariff_ids.length < 2) {
        throw new Error(TARIFF_GROUP_ERRORS.STRIP_MIN_TARIFFS);
      }
    }
  }
  /**
   * Attaches tariffs and strips (with tariff_ids) to an array of group rows,
   * returning full TariffGroup objects with separate tariffs and strips arrays.
   */
  _attachTariffs(groups) {
    const getStripTariffIds = this.db.prepare(
      "SELECT tariff_id, quantity FROM strip_tariffs WHERE strip_id = ? ORDER BY id ASC"
    );
    return groups.map((group) => {
      const rows = this.db.prepare(
        "SELECT id, group_id, name, description, local_price, secondary_price, position, type, strip_count FROM tariffs WHERE group_id = ? ORDER BY position ASC"
      ).all(group.id);
      const tariffs = [];
      const strips = [];
      for (const row of rows) {
        if (row.type === "strip") {
          const junctionRows = getStripTariffIds.all(row.id);
          const tariffIds = [];
          for (const junction of junctionRows) {
            const times = Math.max(1, junction.quantity ?? 1);
            for (let i = 0; i < times; i++) {
              tariffIds.push(junction.tariff_id);
            }
          }
          strips.push({
            id: row.id,
            name: row.name,
            local_price: row.local_price,
            secondary_price: row.secondary_price,
            position: row.position,
            type: "strip",
            tariff_ids: tariffIds
          });
        } else {
          tariffs.push({
            id: row.id,
            name: row.name,
            description: row.description ?? "",
            local_price: row.local_price,
            secondary_price: row.secondary_price,
            position: row.position,
            type: row.type
          });
        }
      }
      return {
        id: group.id,
        year: group.year,
        title: group.title,
        local_currency: group.local_currency ?? "EUR",
        complementary_currency: group.complementary_currency ?? "EUR",
        tariffs,
        strips,
        created_at: group.created_at,
        updated_at: group.updated_at
      };
    });
  }
  /**
   * Collapses a strip's tariff_ids array (which may repeat the same tariff) into
   * [tariffId, quantity] pairs, preserving first-appearance order.
   *
   * e.g. [1, 1, 1, 1] → [[1, 4]] and [1, 2, 1] → [[1, 2], [2, 1]]
   */
  countTariffOccurrences(tariffIds) {
    const counts = /* @__PURE__ */ new Map();
    for (const tariffId of tariffIds) {
      counts.set(tariffId, (counts.get(tariffId) ?? 0) + 1);
    }
    return [...counts.entries()];
  }
  /**
   * Returns all distinct years that have tariff groups, sorted descending.
   */
  getYears() {
    const rows = this.db.prepare("SELECT DISTINCT year FROM tariff_groups ORDER BY year DESC").all();
    return rows.map((r) => r.year);
  }
  /**
   * Returns all tariff groups with their tariffs and strips included.
   */
  getAll() {
    const groups = this.db.prepare("SELECT * FROM tariff_groups ORDER BY year DESC, title ASC").all();
    return this._attachTariffs(groups);
  }
  /**
   * Returns tariff groups for a given year with their tariffs and strips.
   */
  getByYear(year) {
    const groups = this.db.prepare("SELECT * FROM tariff_groups WHERE year = ? ORDER BY title ASC").all(year);
    return this._attachTariffs(groups);
  }
  /**
   * Returns a single tariff group by ID with its tariffs and strips, or null if not found.
   */
  getById(id) {
    const group = this.db.prepare("SELECT * FROM tariff_groups WHERE id = ?").get(id);
    if (!group) return null;
    return this._attachTariffs([group])[0];
  }
  /**
   * Creates a new tariff group with its tariffs and strips atomically in a transaction.
   * Returns the created group with its tariffs and strips.
   */
  create(input) {
    this.validate({
      title: input.title,
      local_currency: input.local_currency,
      complementary_currency: input.complementary_currency,
      tariffs: input.tariffs,
      strips: input.strips
    });
    const insertGroup = this.db.prepare(`
      INSERT INTO tariff_groups (year, title, currency, local_currency, complementary_currency)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, description, local_price, secondary_price, position, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStripTariff = this.db.prepare(`
      INSERT INTO strip_tariffs (strip_id, tariff_id, quantity)
      VALUES (?, ?, ?)
    `);
    const createTransaction = this.db.transaction(() => {
      let result;
      try {
        result = insertGroup.run(
          input.year,
          input.title,
          input.local_currency,
          // also set deprecated currency column
          input.local_currency,
          input.complementary_currency
        );
      } catch (err) {
        if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR);
        }
        throw err;
      }
      const groupId2 = Number(result.lastInsertRowid);
      const positionToNewId = /* @__PURE__ */ new Map();
      for (const tariff of input.tariffs) {
        const tariffResult = insertTariff.run(
          groupId2,
          tariff.name,
          tariff.description ?? "",
          tariff.local_price,
          tariff.secondary_price,
          tariff.position,
          "individual"
        );
        positionToNewId.set(tariff.position, Number(tariffResult.lastInsertRowid));
      }
      for (const strip of input.strips) {
        const stripResult = insertTariff.run(
          groupId2,
          strip.name,
          "",
          strip.local_price,
          strip.secondary_price,
          strip.position,
          "strip"
        );
        const stripId = Number(stripResult.lastInsertRowid);
        for (const [tariffPosition, quantity] of this.countTariffOccurrences(strip.tariff_ids)) {
          const newTariffId = positionToNewId.get(tariffPosition);
          if (newTariffId != null) {
            insertStripTariff.run(stripId, newTariffId, quantity);
          }
        }
      }
      return groupId2;
    });
    const groupId = createTransaction();
    return this.getById(groupId);
  }
  /**
   * Updates an existing tariff group and syncs its tariffs/strips (delete + re-insert) atomically.
   * Returns the updated group or null if not found.
   */
  update(id, input) {
    const existing = this.getById(id);
    if (!existing) return null;
    const title = input.title ?? existing.title;
    const localCurrency = input.local_currency ?? existing.local_currency;
    const complementaryCurrency = input.complementary_currency ?? existing.complementary_currency;
    this.validate({
      title,
      local_currency: localCurrency,
      complementary_currency: complementaryCurrency,
      tariffs: input.tariffs,
      strips: input.strips
    });
    const updateGroup = this.db.prepare(`
      UPDATE tariff_groups SET
        year = ?, title = ?, currency = ?, local_currency = ?, complementary_currency = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
    const deleteStripTariffs = this.db.prepare(`
      DELETE FROM strip_tariffs WHERE strip_id IN (
        SELECT id FROM tariffs WHERE group_id = ? AND type = 'strip'
      )
    `);
    const deleteTariffs = this.db.prepare("DELETE FROM tariffs WHERE group_id = ?");
    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, description, local_price, secondary_price, position, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStripTariff = this.db.prepare(`
      INSERT INTO strip_tariffs (strip_id, tariff_id, quantity)
      VALUES (?, ?, ?)
    `);
    const updateTransaction = this.db.transaction(() => {
      const year = input.year ?? existing.year;
      try {
        updateGroup.run(year, title, localCurrency, localCurrency, complementaryCurrency, id);
      } catch (err) {
        if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR);
        }
        throw err;
      }
      deleteStripTariffs.run(id);
      deleteTariffs.run(id);
      const positionToNewId = /* @__PURE__ */ new Map();
      for (const tariff of input.tariffs) {
        const tariffResult = insertTariff.run(
          id,
          tariff.name,
          tariff.description ?? "",
          tariff.local_price,
          tariff.secondary_price,
          tariff.position,
          "individual"
        );
        positionToNewId.set(tariff.position, Number(tariffResult.lastInsertRowid));
      }
      for (const strip of input.strips) {
        const stripResult = insertTariff.run(
          id,
          strip.name,
          "",
          strip.local_price,
          strip.secondary_price,
          strip.position,
          "strip"
        );
        const stripId = Number(stripResult.lastInsertRowid);
        for (const [tariffPosition, quantity] of this.countTariffOccurrences(strip.tariff_ids)) {
          const newTariffId = positionToNewId.get(tariffPosition);
          if (newTariffId != null) {
            insertStripTariff.run(stripId, newTariffId, quantity);
          }
        }
      }
    });
    updateTransaction();
    return this.getById(id);
  }
  /**
   * Deletes a tariff group by ID.
   * Verifies no events reference the group before deleting.
   * Returns { success: true } on success, or { success: false, error } if the group is in use.
   */
  delete(id) {
    const existing = this.getById(id);
    if (!existing) {
      return { success: false, error: TARIFF_GROUP_ERRORS.NOT_FOUND };
    }
    const events = this.getEventsByGroupId(id);
    if (events.length > 0) {
      return { success: false, error: TARIFF_GROUP_ERRORS.GROUP_IN_USE };
    }
    this.db.prepare("DELETE FROM tariff_groups WHERE id = ?").run(id);
    return { success: true };
  }
  /**
   * Returns IDs of events that reference the given tariff group.
   */
  getEventsByGroupId(groupId) {
    const rows = this.db.prepare("SELECT id FROM eventos WHERE tariff_group_id = ?").all(groupId);
    return rows.map((r) => r.id);
  }
}
const MAX_EVENT_TARIFFS = 8;
const MAX_EVENT_STRIPS = 4;
class EventosRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Returns all distinct years that have events, sorted descending.
   */
  getYears() {
    const rows = this.db.prepare("SELECT DISTINCT year FROM eventos ORDER BY year DESC").all();
    return rows.map((r) => r.year);
  }
  /**
   * Parse JSON arrays from database rows for selected IDs.
   */
  parseEventoRow(row) {
    return {
      ...row,
      selected_tariff_ids: this.parseJsonArray(row.selected_tariff_ids),
      selected_strip_ids: this.parseJsonArray(row.selected_strip_ids)
    };
  }
  parseJsonArray(jsonStr) {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  /**
   * Returns all events for a given year, sorted by name.
   */
  getByYear(year) {
    const rows = this.db.prepare("SELECT * FROM eventos WHERE year = ? ORDER BY nevento ASC").all(year);
    return rows.map((row) => this.parseEventoRow(row));
  }
  /**
   * Returns a single event by ID.
   */
  getById(id) {
    const row = this.db.prepare("SELECT * FROM eventos WHERE id = ?").get(id);
    return row ? this.parseEventoRow(row) : null;
  }
  /**
   * Validates tariff selection constraints.
   */
  validateTariffSelection(input) {
    const tariffCount = input.selected_tariff_ids?.length ?? 0;
    const stripCount = input.selected_strip_ids?.length ?? 0;
    if (tariffCount > MAX_EVENT_TARIFFS) {
      throw new Error(`Máximo ${MAX_EVENT_TARIFFS} tarifas individuales por evento`);
    }
    if (stripCount > MAX_EVENT_STRIPS) {
      throw new Error(`Máximo ${MAX_EVENT_STRIPS} tiras por evento`);
    }
  }
  /**
   * Creates a new event. Returns the created event with its ID.
   */
  create(input) {
    this.validateTariffSelection(input);
    const selectedTariffIds = JSON.stringify(input.selected_tariff_ids ?? []);
    const selectedStripIds = JSON.stringify(input.selected_strip_ids ?? []);
    const stmt = this.db.prepare(`
      INSERT INTO eventos (year, codigo, nevento, nferia, nlugar, motivoi, motivod, fecha, localidad, tariff_group_id, selected_tariff_ids, selected_strip_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.year,
      input.codigo,
      input.nevento,
      input.nferia,
      input.nlugar,
      input.motivoi,
      input.motivod,
      input.fecha,
      input.localidad,
      input.tariff_group_id ?? null,
      selectedTariffIds,
      selectedStripIds
    );
    return this.getById(Number(result.lastInsertRowid));
  }
  /**
   * Updates an existing event by ID. Returns the updated event.
   */
  update(id, input) {
    const existing = this.getById(id);
    if (!existing) return null;
    this.validateTariffSelection(input);
    const updated = {
      year: input.year ?? existing.year,
      codigo: input.codigo ?? existing.codigo,
      nevento: input.nevento ?? existing.nevento,
      nferia: input.nferia ?? existing.nferia,
      nlugar: input.nlugar ?? existing.nlugar,
      motivoi: input.motivoi ?? existing.motivoi,
      motivod: input.motivod ?? existing.motivod,
      fecha: input.fecha ?? existing.fecha,
      localidad: input.localidad ?? existing.localidad,
      tariff_group_id: input.tariff_group_id !== void 0 ? input.tariff_group_id : existing.tariff_group_id,
      selected_tariff_ids: input.selected_tariff_ids !== void 0 ? input.selected_tariff_ids : existing.selected_tariff_ids,
      selected_strip_ids: input.selected_strip_ids !== void 0 ? input.selected_strip_ids : existing.selected_strip_ids
    };
    const selectedTariffIds = JSON.stringify(updated.selected_tariff_ids);
    const selectedStripIds = JSON.stringify(updated.selected_strip_ids);
    this.db.prepare(`
      UPDATE eventos SET
        year = ?, codigo = ?, nevento = ?, nferia = ?, nlugar = ?,
        motivoi = ?, motivod = ?, fecha = ?, localidad = ?,
        tariff_group_id = ?,
        selected_tariff_ids = ?,
        selected_strip_ids = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updated.year,
      updated.codigo,
      updated.nevento,
      updated.nferia,
      updated.nlugar,
      updated.motivoi,
      updated.motivod,
      updated.fecha,
      updated.localidad,
      updated.tariff_group_id ?? null,
      selectedTariffIds,
      selectedStripIds,
      id
    );
    return this.getById(id);
  }
  /**
   * Deletes an event by ID. Returns true if deleted.
   */
  delete(id) {
    const result = this.db.prepare("DELETE FROM eventos WHERE id = ?").run(id);
    return result.changes > 0;
  }
  /**
   * Returns all events (all years).
   */
  getAll() {
    const rows = this.db.prepare("SELECT * FROM eventos ORDER BY year DESC, nevento ASC").all();
    return rows.map((row) => this.parseEventoRow(row));
  }
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
function buildDynamicKey(tariffId, model) {
  return `tariff_${tariffId}_s${model}`;
}
function calcDynamicSellos1(quantities, tariffs, strips) {
  let total = 0;
  for (const tariff of tariffs) {
    const key = buildDynamicKey(tariff.id, 1);
    total += quantities[key] ?? 0;
  }
  for (const strip of strips) {
    const key = buildDynamicKey(strip.id, 1);
    const stripQty = quantities[key] ?? 0;
    total += stripQty * strip.tariff_ids.length;
  }
  return total;
}
function calcDynamicSellos2(quantities, tariffs, strips) {
  let total = 0;
  for (const tariff of tariffs) {
    const key = buildDynamicKey(tariff.id, 2);
    total += quantities[key] ?? 0;
  }
  for (const strip of strips) {
    const key = buildDynamicKey(strip.id, 2);
    const stripQty = quantities[key] ?? 0;
    total += stripQty * strip.tariff_ids.length;
  }
  return total;
}
function calcDynamicTicketsUsed(quantities, _tariffs, strips) {
  let totalStripQty = 0;
  for (const strip of strips) {
    const key1 = buildDynamicKey(strip.id, 1);
    const key2 = buildDynamicKey(strip.id, 2);
    totalStripQty += (quantities[key1] ?? 0) + (quantities[key2] ?? 0);
  }
  return totalStripQty + 2;
}
function generateOrderLines(config, quantities, profile, sesionId) {
  const orders = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { precios, codigo, sello } = config;
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
function generateDynamicOrderLines(config, quantities, tariffGroup, profile, sesionId) {
  const orders = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { codigo, sello } = config;
  const evento = sello.eventos[sello.elevento] ?? sello.eventos[0];
  const eventName = evento?.nevento ?? sello.elnevento ?? "";
  const feria = evento?.nferia ?? sello.feria ?? "";
  const lugar = evento?.nlugar ?? sello.lugar ?? "";
  const fecha = evento?.fecha ?? "";
  const sellos1 = calcDynamicSellos1(quantities, tariffGroup.tariffs, tariffGroup.strips);
  const sellos2 = calcDynamicSellos2(quantities, tariffGroup.tariffs, tariffGroup.strips);
  const base = {
    event: eventName,
    venue: lugar,
    machine: codigo.maquina,
    transactionDate: now,
    currency: tariffGroup.currency,
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
  for (const tariff of tariffGroup.tariffs) {
    const qty1 = quantities[buildDynamicKey(tariff.id, 1)] ?? 0;
    if (qty1 > 0) {
      orders.push({
        ...base,
        vendType: tariff.name,
        productName: "Sello Modelo 1",
        quantity: qty1,
        quantitySet: 1,
        totalStamps: qty1,
        value: qty1 * tariff.price
      });
    }
    const qty2 = quantities[buildDynamicKey(tariff.id, 2)] ?? 0;
    if (qty2 > 0) {
      orders.push({
        ...base,
        vendType: tariff.name,
        productName: "Sello Modelo 2",
        quantity: qty2,
        quantitySet: 1,
        totalStamps: qty2,
        value: qty2 * tariff.price
      });
    }
  }
  for (const strip of tariffGroup.strips) {
    const stripTariffCount = strip.tariff_ids.length;
    const qty1 = quantities[buildDynamicKey(strip.id, 1)] ?? 0;
    if (qty1 > 0) {
      orders.push({
        ...base,
        vendType: strip.name,
        productName: "Tira Modelo 1",
        quantity: qty1,
        quantitySet: stripTariffCount,
        totalStamps: qty1 * stripTariffCount,
        value: qty1 * strip.price
      });
    }
    const qty2 = quantities[buildDynamicKey(strip.id, 2)] ?? 0;
    if (qty2 > 0) {
      orders.push({
        ...base,
        vendType: strip.name,
        productName: "Tira Modelo 2",
        quantity: qty2,
        quantitySet: stripTariffCount,
        totalStamps: qty2 * stripTariffCount,
        value: qty2 * strip.price
      });
    }
  }
  return orders;
}
function executeSale(config, quantities, profile, db2, tariffGroupCtx) {
  const database = getDatabase();
  const isDynamic = !!tariffGroupCtx;
  let sellos1;
  let sellos2;
  let ticketsUsed;
  if (isDynamic) {
    const dynQty = quantities;
    sellos1 = calcDynamicSellos1(dynQty, tariffGroupCtx.tariffs, tariffGroupCtx.strips);
    sellos2 = calcDynamicSellos2(dynQty, tariffGroupCtx.tariffs, tariffGroupCtx.strips);
    ticketsUsed = calcDynamicTicketsUsed(dynQty, tariffGroupCtx.tariffs, tariffGroupCtx.strips);
  } else {
    const legacyQty = quantities;
    sellos1 = calcSellos1(legacyQty);
    sellos2 = calcSellos2(legacyQty);
    ticketsUsed = calcTicketsUsed(legacyQty);
  }
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
    let orders;
    if (isDynamic) {
      orders = generateDynamicOrderLines(config, quantities, tariffGroupCtx, profile, newSesionId);
    } else {
      orders = generateOrderLines(config, quantities, profile, newSesionId);
    }
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
const STAMP_HEIGHT_MM = 55;
const STAMP_WIDTH = STAMP_WIDTH_MM * MM_TO_PT$1;
const STAMP_HEIGHT = STAMP_HEIGHT_MM * MM_TO_PT$1;
const FONTS = {
  regular: "FranklinGothic",
  bold: "FranklinGothicBold",
  condensed: "FranklinGothicCondensed"
};
const TEXT_LEFT_MM = 2;
const TEXT_RIGHT_MARGIN_MM = 2;
const FECHA_LOCALIDAD_FONT_SIZE = 9;
const FECHA_Y_MM = 43;
const LOCALIDAD_Y_MM = 39.5;
const LOGO_TEXT_GAP_MM = 5;
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
function formatFechaMonthYear(fecha) {
  const match = fecha.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{4}$/i);
  if (match) {
    return match[0];
  }
  return fecha;
}
function formatCodigoLines(codigo) {
  const spaceIdx = codigo.indexOf(" ");
  if (spaceIdx === -1) {
    return { line1: codigo, line2: "" };
  }
  const prefix = codigo.substring(0, spaceIdx);
  const suffix = codigo.substring(spaceIdx + 1);
  if (prefix.length < 6 || prefix[0] !== "P") {
    return { line1: codigo, line2: "" };
  }
  const mes = prefix[1];
  const pais = prefix.substring(2, 4);
  const anio = prefix.substring(4, 6);
  const line1 = `P${anio}-${mes}${pais}`;
  const dashParts = suffix.split("-");
  let line2;
  if (dashParts.length >= 3) {
    line2 = `${dashParts[dashParts.length - 2]}-${dashParts[dashParts.length - 1]}`;
  } else if (dashParts.length === 2) {
    line2 = `${dashParts[0]}-${dashParts[1]}`;
  } else {
    line2 = suffix;
  }
  return { line1, line2 };
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
function drawOverlay(doc, imageSource) {
  if (!imageSource) return;
  const overlayX = 27.5 * MM_TO_PT$1;
  const overlayWidth = 27.5 * MM_TO_PT$1;
  try {
    if (imageSource.startsWith("data:")) {
      const base64Data = imageSource.split(",")[1];
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");
        doc.image(buffer, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT });
      }
    } else if (fs.existsSync(imageSource)) {
      doc.image(imageSource, overlayX, 0, { width: overlayWidth, height: STAMP_HEIGHT });
    }
  } catch {
  }
}
function computeLogoBox(doc, fecha, evento) {
  doc.font(FONTS.regular).fontSize(FECHA_LOCALIDAD_FONT_SIZE);
  const fechaWidth = doc.widthOfString(formatFechaMonthYear(fecha));
  const eventoWidth = doc.widthOfString(evento);
  const textBlockWidth = Math.max(fechaWidth, eventoWidth);
  const x = TEXT_LEFT_MM * MM_TO_PT$1 + textBlockWidth + LOGO_TEXT_GAP_MM * MM_TO_PT$1;
  const top = bottomToTop(FECHA_Y_MM, FECHA_LOCALIDAD_FONT_SIZE);
  const bottom = bottomToTop(LOCALIDAD_Y_MM, FECHA_LOCALIDAD_FONT_SIZE) + FECHA_LOCALIDAD_FONT_SIZE;
  const height = bottom - top;
  const width = STAMP_WIDTH - TEXT_RIGHT_MARGIN_MM * MM_TO_PT$1 - x;
  if (width <= 0 || height <= 0) return null;
  return { x, y: top, width, height };
}
function drawLogoPng(doc, imageSource, fecha, evento) {
  if (!imageSource) return;
  const box = computeLogoBox(doc, fecha, evento);
  if (!box) return;
  const options = {
    fit: [box.width, box.height],
    align: "left",
    valign: "center"
  };
  try {
    if (imageSource.startsWith("data:")) {
      const base64Data = imageSource.split(",")[1];
      if (base64Data) {
        const buffer = Buffer.from(base64Data, "base64");
        doc.image(buffer, box.x, box.y, options);
      }
    } else if (fs.existsSync(imageSource)) {
      doc.image(imageSource, box.x, box.y, options);
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
    if (stamp.printLogoPng && stamp.logoPngImage) {
      drawLogoPng(doc, stamp.logoPngImage);
    } else {
      drawOverlay(doc, stamp.overlayImage);
    }
    drawTextLeft(doc, stamp.tarifa, FONTS.regular, 13, 2, 50);
    drawTextLeft(doc, stamp.tarifaDescripcion ?? "", FONTS.regular, 9, 2, 46.5);
    drawTextLeft(doc, formatFechaMonthYear(stamp.fecha), FONTS.regular, 9, 2, 43);
    drawTextLeft(doc, stamp.evento, FONTS.regular, 9, 2, 39.5);
    const { line1, line2 } = formatCodigoLines(stamp.codigo);
    drawTextLeft(doc, line1, FONTS.regular, 8, 2, 36);
    drawTextLeft(doc, line2, FONTS.regular, 7, 2, 32.5);
  });
  doc.end();
  return result;
}
async function renderStampEspecialStrip(codigos, especial, tarifa) {
  const doc = new PDFDocument({
    size: [STAMP_WIDTH, STAMP_HEIGHT],
    margin: 0,
    layout: "portrait",
    info: { Title: "Tira Especial", Author: "Stamp Sales App" }
  });
  const result = collectPdf$1(doc);
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  doc.save();
  doc.rotate(90, { origin: [pageWidth / 2, pageHeight / 2] });
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
function formatPrice(value, currencySymbol = "€") {
  const str = value.toFixed(2);
  return str + currencySymbol;
}
function drawCentered(doc, text, fontName, fontSize, y, pageWidth) {
  doc.font(fontName).fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  const x = (pageWidth - textWidth) / 2;
  doc.text(text, x, y, { lineBreak: false });
}
function drawLeft(doc, text, fontName, fontSize, x, y, maxWidth) {
  doc.font(fontName).fontSize(fontSize);
  const options = maxWidth ? { width: maxWidth, lineBreak: true } : { lineBreak: false };
  doc.text(text, x, y, options);
  if (maxWidth) {
    return doc.heightOfString(text, options);
  }
  return fontSize * 0.352778;
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
function drawImageConstrained(doc, imageName, y, maxWidth, maxHeight, pageWidth) {
  const imgPath = path.join(getImagesPath(), imageName);
  if (!fs.existsSync(imgPath)) return false;
  try {
    const x = (pageWidth - maxWidth) / 2;
    doc.image(imgPath, x, y, { fit: [maxWidth, maxHeight], align: "center", valign: "center" });
    return true;
  } catch {
    return false;
  }
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
function calcActualTicketHeight(params) {
  const tempDoc = new PDFDocument({ size: [TICKET_WIDTH, 1e3 * MM_TO_PT], margin: 0 });
  registerFonts(tempDoc);
  const { items, productos, modelo1Ticket, modelo2Ticket } = params;
  let totalHeight = 0;
  totalHeight += TICKET_MARGIN_TOP;
  totalHeight += TICKET_LOGO_HEIGHT;
  totalHeight += TICKET_HEADER_HEIGHT;
  totalHeight += TICKET_COLUMNS_HEIGHT;
  const itemNameMaxWidth = 40 * MM_TO_PT;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const producto = productos[index];
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      const itemName = modeloTicket + " " + producto.nombre_ticket;
      tempDoc.font(FONTS.condensed).fontSize(8);
      const textHeight = tempDoc.heightOfString(itemName, { width: itemNameMaxWidth, lineBreak: true });
      const textHeightMm = textHeight / MM_TO_PT;
      totalHeight += Math.max(TICKET_ITEM_ROW_HEIGHT, textHeightMm + 0.5);
    }
  }
  totalHeight += TICKET_TOTAL_HEIGHT;
  totalHeight += TICKET_FOOTER_HEIGHT;
  totalHeight += TICKET_MARGIN_BOTTOM;
  tempDoc.end();
  return totalHeight;
}
const TICKET_MARGIN_TOP = 5;
const TICKET_LOGO_HEIGHT = 24;
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
    l3,
    currencySymbol = "€"
  } = params;
  const pageHeightMm = calcActualTicketHeight(params);
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
  const logoWidth = 30 * MM_TO_PT;
  const logoHeight = 23 * MM_TO_PT;
  drawImageConstrained(doc, "image2.jpg", y * MM_TO_PT, logoWidth, logoHeight, pageWidth);
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
  const itemNameMaxWidth = 40 * MM_TO_PT;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const producto = productos[index];
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      totalProductos += item.cantidad;
      totalImporte += item.cantidad * producto.precio;
      const itemName = modeloTicket + " " + producto.nombre_ticket;
      const quantity = String(item.cantidad);
      const price = formatPrice(producto.precio, currencySymbol);
      const total = formatPrice(item.cantidad * producto.precio, currencySymbol);
      const textHeightPt = drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT, itemNameMaxWidth);
      const textHeightMm = textHeightPt / MM_TO_PT;
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
      y += Math.max(TICKET_ITEM_ROW_HEIGHT, textHeightMm + 0.5);
    }
  }
  y += 1;
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT);
  y += 3;
  drawLeft(doc, "Total:", FONTS.condensed, 8, 35 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, formatPrice(totalImporte, currencySymbol), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
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
function calcActualTicketCajaHeight(params) {
  const tempDoc = new PDFDocument({ size: [TICKET_WIDTH, 1e3 * MM_TO_PT], margin: 0 });
  registerFonts(tempDoc);
  const { items, productos, modelo1Ticket, modelo2Ticket } = params;
  const HEADER_HEIGHT_MM = 72;
  const FOOTER_HEIGHT_MM = 22;
  const itemNameMaxWidth = 25 * MM_TO_PT;
  let itemsHeight = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const producto = productos[index];
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      const itemName = modeloTicket + " " + producto.nombre_ticket;
      tempDoc.font(FONTS.condensed).fontSize(8);
      const textHeight = tempDoc.heightOfString(itemName, { width: itemNameMaxWidth, lineBreak: true });
      const textHeightMm = textHeight / MM_TO_PT;
      itemsHeight += Math.max(3.5, textHeightMm + 0.5);
    }
  }
  tempDoc.end();
  return HEADER_HEIGHT_MM + itemsHeight + FOOTER_HEIGHT_MM;
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
    modelo2Ticket,
    currencySymbol = "€"
  } = params;
  const pageHeightMm = calcActualTicketCajaHeight(params);
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
  const logoWidth = 30 * MM_TO_PT;
  const logoHeight = 11 * MM_TO_PT;
  drawImageConstrained(doc, "image2.jpg", y * MM_TO_PT, logoWidth, logoHeight, pageWidth);
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
  const itemNameMaxWidth = 25 * MM_TO_PT;
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
      const price = formatPrice(producto.precio, currencySymbol);
      const total = formatPrice(item.cantidad * producto.precio, currencySymbol);
      const textHeightPt = drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT, itemNameMaxWidth);
      const textHeightMm = textHeightPt / MM_TO_PT;
      drawRight(doc, quantity, FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, price, FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, total, FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
      y += Math.max(3.5, textHeightMm + 0.5);
    }
  }
  y += 2;
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT);
  y += 3;
  drawLeft(doc, "Total:", FONTS.condensed, 8, 35 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, String(totalProductos), FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
  drawRight(doc, formatPrice(totalImporte, currencySymbol), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
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
function calcActualTicketMasterHeight(params) {
  const tempDoc = new PDFDocument({ size: [TICKET_WIDTH, 1e3 * MM_TO_PT], margin: 0 });
  registerFonts(tempDoc);
  const { items, modelo1Ticket, modelo2Ticket } = params;
  const HEADER_HEIGHT_MM = 66;
  const FOOTER_HEIGHT_MM = 30;
  const itemNameMaxWidth = 40 * MM_TO_PT;
  let itemsHeight = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      const itemName = modeloTicket + " Master Set";
      tempDoc.font(FONTS.condensed).fontSize(8);
      const textHeight = tempDoc.heightOfString(itemName, { width: itemNameMaxWidth, lineBreak: true });
      const textHeightMm = textHeight / MM_TO_PT;
      itemsHeight += Math.max(3, textHeightMm + 0.5);
    }
  }
  tempDoc.end();
  return HEADER_HEIGHT_MM + itemsHeight + FOOTER_HEIGHT_MM;
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
    l3,
    currencySymbol = "€"
  } = params;
  const pageHeightMm = calcActualTicketMasterHeight(params);
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
  drawImageConstrained(doc, "image2.jpg", y * MM_TO_PT, 30 * MM_TO_PT, 11 * MM_TO_PT, pageWidth);
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
  const itemNameMaxWidth = 40 * MM_TO_PT;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.cantidad > 0) {
      const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
      totalItems++;
      const itemName = modeloTicket + " Master Set";
      const textHeightPt = drawLeft(doc, itemName, FONTS.condensed, 8, 5 * MM_TO_PT, y * MM_TO_PT, itemNameMaxWidth);
      const textHeightMm = textHeightPt / MM_TO_PT;
      drawRight(doc, "1", FONTS.condensed, 8, 50 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, formatPrice(MASTER_SET_PRICE, currencySymbol), FONTS.condensed, 8, 62 * MM_TO_PT, y * MM_TO_PT);
      drawRight(doc, formatPrice(MASTER_SET_PRICE, currencySymbol), FONTS.condensed, 8, 73 * MM_TO_PT, y * MM_TO_PT);
      y += Math.max(3, textHeightMm + 0.5);
    }
  }
  y += 2;
  drawLine(doc, 30 * MM_TO_PT, y * MM_TO_PT, pageWidth - 30 * MM_TO_PT - 5 * MM_TO_PT);
  y += 3;
  const masterTotal = totalItems * MASTER_SET_PRICE;
  drawLeft(doc, `Total:     ${totalItems}`, FONTS.condensed, 8, 40 * MM_TO_PT, y * MM_TO_PT);
  drawLeft(doc, formatPrice(masterTotal, currencySymbol), FONTS.condensed, 8, 65 * MM_TO_PT, y * MM_TO_PT);
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
const MIN_CUT_NUMBER = 2;
const MAX_CUT_NUMBER = 16;
function groupLabels(items, cutNumber) {
  if (cutNumber < MIN_CUT_NUMBER || cutNumber > MAX_CUT_NUMBER) {
    throw new Error(
      `El número de corte debe estar entre ${MIN_CUT_NUMBER} y ${MAX_CUT_NUMBER}`
    );
  }
  const groups = [];
  for (let i = 0; i < items.length; i += cutNumber) {
    groups.push(items.slice(i, i + cutNumber));
  }
  return groups;
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
function getModelLogoPng(modelName, imagesRepo, syncRepo, fallbackLogo) {
  const isPng = (record) => {
    if (!record) return false;
    if (record.type) return record.type.toLowerCase() === "image/png";
    return record.data.startsWith("data:image/png");
  };
  if (modelName && syncRepo) {
    try {
      const fairs = syncRepo.getFairList();
      const matchedFair = fairs.find(
        (f) => f.fairName.toLowerCase() === modelName.toLowerCase()
      );
      if (matchedFair) {
        const selloName = buildImageName(matchedFair.year, matchedFair.fairName, "sello");
        const record = imagesRepo.getFullByName(selloName);
        if (isPng(record)) return record.data;
      }
    } catch {
    }
  }
  if (modelName) {
    try {
      const direct = imagesRepo.getFullByName(modelName);
      if (isPng(direct)) return direct.data;
    } catch {
    }
  }
  return fallbackLogo;
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
async function generateSalePdfs(config, quantities, profile, imagesRepo, imageLayerOptions, dynamicTariffCtx) {
  const repo = new ImagesRepository();
  const pdfs = [];
  const notifications = [];
  let cutNumber;
  try {
    const configRepo = new ConfigRepository();
    cutNumber = configRepo.getCutNumber();
  } catch {
    cutNumber = 4;
  }
  let productoCounter = 1;
  let stampFecha;
  let stampEvento;
  let model1Name;
  let model2Name;
  if (dynamicTariffCtx) {
    stampFecha = dynamicTariffCtx.eventFecha ?? "";
    stampEvento = dynamicTariffCtx.eventLocalidad ?? "";
    model1Name = config.sello.modelo1 ?? "";
    model2Name = config.sello.modelo2 ?? "";
  } else {
    const eventoIndex = config.sello.elevento;
    const evento = config.sello.eventos?.[eventoIndex];
    stampFecha = evento?.fecha ?? "";
    stampEvento = evento?.localidad ?? "";
    model1Name = evento?.motivoi ?? config.sello.modelo1 ?? "";
    model2Name = evento?.motivod ?? config.sello.modelo2 ?? "";
  }
  let bg1 = null;
  let bg2 = null;
  let overlay1 = null;
  let overlay2 = null;
  let logoPng1 = null;
  let logoPng2 = null;
  let printLogoPng = false;
  if (imageLayerOptions) {
    const layerResult = resolveImageLayers(imageLayerOptions);
    bg1 = layerResult.backgroundImage;
    bg2 = layerResult.backgroundImage;
    overlay1 = layerResult.overlayImage;
    overlay2 = layerResult.overlayImage;
    notifications.push(...layerResult.notifications);
    printLogoPng = imageLayerOptions.printLogoPng ?? false;
    if (printLogoPng) {
      let syncRepo;
      try {
        syncRepo = new ImageSyncRepository();
      } catch {
      }
      logoPng1 = getModelLogoPng(model1Name, repo, syncRepo, imageLayerOptions.selloImage);
      logoPng2 = getModelLogoPng(model2Name, repo, syncRepo, imageLayerOptions.selloImage);
    }
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
  if (dynamicTariffCtx) {
    const dynQty = quantities;
    for (const tariff of dynamicTariffCtx.tariffs) {
      const key1 = `tariff_${tariff.id}_s1`;
      const qty1 = dynQty[key1] ?? 0;
      if (qty1 > 0) {
        const background = usesBlankBackground ? null : bg1;
        const overlay = usesBlankBackground ? null : overlay1;
        const stamps = [];
        for (let i = 0; i < qty1; i++) {
          stamps.push({
            tarifa: tariff.name,
            tarifaDescripcion: tariff.description,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: buildLabelCode(config, productoCounter),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logoPng1
          });
          productoCounter++;
        }
        const groups = groupLabels(stamps, cutNumber);
        for (const group of groups) {
          const pdfBuffer = await renderStampMultiPage(group);
          pdfs.push({
            buffer: pdfBuffer,
            target: "printer1",
            pdfType: "stamp_simple",
            description: `${tariff.name} modelo1 x${group.length}`
          });
        }
      }
      const key2 = `tariff_${tariff.id}_s2`;
      const qty2 = dynQty[key2] ?? 0;
      if (qty2 > 0) {
        const background = usesBlankBackground ? null : bg2;
        const overlay = usesBlankBackground ? null : overlay2;
        const stamps = [];
        for (let i = 0; i < qty2; i++) {
          stamps.push({
            tarifa: tariff.name,
            tarifaDescripcion: tariff.description,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: buildLabelCode(config, productoCounter),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logoPng2
          });
          productoCounter++;
        }
        const groups = groupLabels(stamps, cutNumber);
        for (const group of groups) {
          const pdfBuffer = await renderStampMultiPage(group);
          pdfs.push({
            buffer: pdfBuffer,
            target: "printer2",
            pdfType: "stamp_simple",
            description: `${tariff.name} modelo2 x${group.length}`
          });
        }
      }
    }
  } else {
    const legacyQty = quantities;
    for (const tariff of TARIFF_DEFS) {
      const qty = legacyQty[tariff.qtyKey];
      if (qty <= 0) continue;
      const background = usesBlankBackground ? null : tariff.model === 1 ? bg1 : bg2;
      const overlay = usesBlankBackground ? null : tariff.model === 1 ? overlay1 : overlay2;
      const logo = tariff.model === 1 ? logoPng1 : logoPng2;
      if (tariff.isTira) {
        for (let i = 0; i < qty; i++) {
          const stamps = [];
          if (tariff.qtyKey.startsWith("tarifa4T")) {
            const tariffLabels = ["Tarifa AJ", "Tarifa A2J", "Tarifa BJ", "Tarifa CJ"];
            for (const tLabel of tariffLabels) {
              stamps.push({
                tarifa: tLabel,
                fecha: stampFecha,
                evento: stampEvento,
                codigo: buildLabelCode(config, productoCounter),
                backgroundImage: background,
                overlayImage: overlay,
                printLogoPng,
                logoPngImage: logo
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
                overlayImage: overlay,
                printLogoPng,
                logoPngImage: logo
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
        const stamps = [];
        for (let i = 0; i < qty; i++) {
          stamps.push({
            tarifa: tariff.label,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: buildLabelCode(config, productoCounter),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logo
          });
          productoCounter++;
        }
        const groups = groupLabels(stamps, cutNumber);
        for (const group of groups) {
          const pdfBuffer = await renderStampMultiPage(group);
          pdfs.push({
            buffer: pdfBuffer,
            target: tariff.target,
            pdfType: "stamp_simple",
            description: `${tariff.label} modelo${tariff.model} x${group.length}`
          });
        }
      }
    }
  }
  if (!dynamicTariffCtx) {
    const counterRef = { value: productoCounter };
    await generateEspecialStrips(config, quantities, counterRef, pdfs);
    productoCounter = counterRef.value;
  }
  let items;
  let productos;
  if (dynamicTariffCtx) {
    const dynQty = quantities;
    items = [];
    productos = [];
    for (const tariff of dynamicTariffCtx.tariffs) {
      const key1 = `tariff_${tariff.id}_s1`;
      const qty1 = dynQty[key1] ?? 0;
      const prodId1 = `D${tariff.id}S1`;
      items.push({ idProducto: prodId1, cantidad: qty1 });
      productos.push({ idProducto: prodId1, modo: "S", precio: tariff.price, nombre_ticket: tariff.name });
      const key2 = `tariff_${tariff.id}_s2`;
      const qty2 = dynQty[key2] ?? 0;
      const prodId2 = `D${tariff.id}S2`;
      items.push({ idProducto: prodId2, cantidad: qty2 });
      productos.push({ idProducto: prodId2, modo: "S", precio: tariff.price, nombre_ticket: tariff.name });
    }
  } else {
    const result = buildTicketData(quantities, config.precios);
    items = result.items;
    productos = result.productos;
  }
  const hasAnyItems = items.some((item) => item.cantidad > 0);
  if (hasAnyItems) {
    const fechaTicket = getTicketDateTime(config);
    const modoTicket = buildTicketTitle(profile, config.ticket.titulo);
    const modelo1Ticket = model1Name || "Modelo 1";
    const modelo2Ticket = model2Name || "Modelo 2";
    const ticketFeria = dynamicTariffCtx ? dynamicTariffCtx.title || config.ticket.feria : config.ticket.feria;
    const ticketLugar = dynamicTariffCtx ? config.sello.eventos?.[0]?.localidad || config.ticket.lugar : config.ticket.lugar;
    if (imageLayerOptions?.useSecondaryPrice && dynamicTariffCtx) {
      for (const producto of productos) {
        const tariffId = parseInt(producto.idProducto.replace(/^D/, "").replace(/S[12]$/, ""), 10);
        const matchingTariff = dynamicTariffCtx.tariffs.find((t) => t.id === tariffId);
        if (matchingTariff && matchingTariff.secondaryPrice != null) {
          producto.precio = matchingTariff.secondaryPrice;
        }
      }
    }
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
      feria: ticketFeria,
      lugar: ticketLugar,
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
        feria: ticketFeria,
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
        feria: ticketFeria,
        lugar: ticketLugar,
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
              feria: ticketFeria,
              lugar: ticketLugar,
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
function getCurrencySymbol(code) {
  const symbols = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    JPY: "¥",
    CHF: "Fr",
    CNY: "¥",
    MXN: "$",
    ARS: "$",
    COP: "$",
    BRL: "R$"
  };
  return symbols[code] ?? code;
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
      const quantityKeys = Object.keys(typedQuantities);
      const isDynamic = quantityKeys.some((key) => /^tariff_\d+_s[12]$/.test(key));
      let tariffGroupCtx;
      let dynamicTariffCtx;
      if (isDynamic) {
        const activeEventoId = typedConfig.sello.elevento;
        if (activeEventoId && activeEventoId > 0) {
          const eventosRepo = new EventosRepository();
          const evento = eventosRepo.getById(activeEventoId);
          const tariffGroupId = evento?.tariff_group_id;
          if (tariffGroupId) {
            const tariffGroupsRepo = new TariffGroupsRepository();
            const group = tariffGroupsRepo.getById(tariffGroupId);
            if (group) {
              tariffGroupCtx = {
                id: group.id,
                title: group.title,
                currency: group.local_currency,
                tariffs: group.tariffs.map((t) => ({
                  id: t.id,
                  name: t.name,
                  price: t.local_price,
                  position: t.position
                })),
                strips: group.strips.map((s) => ({
                  id: s.id,
                  name: s.name,
                  price: s.local_price,
                  position: s.position,
                  tariff_ids: s.tariff_ids
                }))
              };
              dynamicTariffCtx = {
                groupId: group.id,
                title: group.title,
                eventName: evento?.nferia,
                // Add event name for ticket header
                eventFecha: evento?.fecha,
                // Add event date for stamp labels
                eventLocalidad: evento?.localidad,
                // Add event locality for stamp labels
                currency: group.local_currency,
                currencySymbol: getCurrencySymbol(group.local_currency),
                // Add currency symbol
                tariffs: group.tariffs.map((t) => ({
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  price: t.local_price,
                  secondaryPrice: t.secondary_price,
                  position: t.position
                })),
                strips: group.strips.map((s) => ({
                  id: s.id,
                  name: s.name,
                  price: s.local_price,
                  secondaryPrice: s.secondary_price,
                  position: s.position,
                  tariff_ids: s.tariff_ids
                }))
              };
            }
          }
        }
      }
      if (isDynamic && !tariffGroupCtx) {
        return {
          success: false,
          error: "No se pudo cargar el grupo de tarifas del evento activo. Revise la configuración del evento."
        };
      }
      const result = executeSale(typedConfig, typedQuantities, typedProfile, void 0, tariffGroupCtx);
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
          printLogoPng: typedImageFlags.printLogoPng ?? false,
          fondoImage,
          selloImage,
          useSecondaryPrice: typedImageFlags.useSecondaryPrice ?? false
        };
      }
      try {
        const pdfResult = await generateSalePdfs(
          updatedConfig,
          typedQuantities,
          typedProfile,
          void 0,
          imageLayerOptions,
          dynamicTariffCtx
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
function registerEventosHandlers() {
  const repo = new EventosRepository();
  handleIpc("eventos:getYears", () => {
    return repo.getYears();
  });
  handleIpc("eventos:getByYear", (year) => {
    return repo.getByYear(year);
  });
  handleIpc("eventos:getById", (id) => {
    return repo.getById(id);
  });
  handleIpc("eventos:create", (input) => {
    return repo.create(input);
  });
  handleIpc("eventos:update", (id, input) => {
    return repo.update(id, input);
  });
  handleIpc("eventos:delete", (id) => {
    return repo.delete(id);
  });
}
function registerTariffGroupsHandlers() {
  const repo = new TariffGroupsRepository();
  handleIpc("tariff-groups:getYears", () => {
    return repo.getYears();
  });
  handleIpc("tariff-groups:getAll", () => {
    return repo.getAll();
  });
  handleIpc("tariff-groups:getByYear", (year) => {
    return repo.getByYear(year);
  });
  handleIpc("tariff-groups:getById", (id) => {
    return repo.getById(id);
  });
  handleIpc("tariff-groups:create", (input) => {
    return repo.create(input);
  });
  handleIpc("tariff-groups:update", (id, input) => {
    return repo.update(id, input);
  });
  handleIpc("tariff-groups:delete", (id) => {
    return repo.delete(id);
  });
}
function registerAllHandlers() {
  registerConfigHandlers();
  registerOrdersHandlers();
  registerImagesHandlers();
  registerPrinterHandlers();
  registerSaleHandlers();
  registerAutoLaunchHandlers();
  registerEventosHandlers();
  registerTariffGroupsHandlers();
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
  try {
    initDatabase();
    const configRepo = new ConfigRepository();
    configRepo.initConfig();
  } catch (err) {
    const errorMsg = `[FATAL] Database initialization failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg);
    try {
      const logPath = path.join(electron.app.isPackaged ? path.dirname(electron.app.getPath("exe")) : electron.app.getAppPath(), "startup-error.log");
      fs.writeFileSync(logPath, `${(/* @__PURE__ */ new Date()).toISOString()}
${errorMsg}
${err instanceof Error ? err.stack : ""}
`);
    } catch {
    }
    electron.dialog.showErrorBox("Error de inicio", `La base de datos no se pudo inicializar:

${err instanceof Error ? err.message : String(err)}

Revisa el archivo startup-error.log junto al ejecutable.`);
    electron.app.quit();
    return;
  }
  try {
    let basePath;
    if (electron.app.isPackaged) {
      const exeDirPath = path.join(path.dirname(electron.app.getPath("exe")), "bbdd-ferias");
      const resourcesPath = path.join(process.resourcesPath, "bbdd-ferias");
      basePath = fs.existsSync(exeDirPath) ? exeDirPath : resourcesPath;
    } else {
      basePath = path.join(electron.app.getAppPath(), "bbdd-ferias");
    }
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
  try {
    registerAllHandlers();
  } catch (err) {
    console.error("[FATAL] Failed to register IPC handlers:", err);
  }
  try {
    initServices();
  } catch (err) {
    console.error("[FATAL] Failed to initialize services:", err);
  }
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
