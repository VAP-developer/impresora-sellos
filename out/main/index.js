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
require("pdfkit");
const nodeMachineId = require("node-machine-id");
const crypto = require("crypto");
const https = require("https");
const url = require("url");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const https__namespace = /* @__PURE__ */ _interopNamespaceDefault(https);
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
    producto: 1,
    codigo_feria_1: "",
    codigo_feria_2: ""
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
    const config = JSON.parse(row.data);
    if (config.codigo && config.codigo.codigo_feria_1 === void 0) {
      config.codigo.codigo_feria_1 = "";
    }
    if (config.codigo && config.codigo.codigo_feria_2 === void 0) {
      config.codigo.codigo_feria_2 = "";
    }
    return config;
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
    return config?.imagenes ?? { printSello: false, printLogoPng: false, useSecondaryPrice: false, activeFair: null };
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
  /**
   * Get the print rotation setting, returns default false if unset.
   */
  getPrintRotation() {
    const config = this.get();
    return config?.settings?.printRotation180 ?? false;
  }
  /**
   * Set the print rotation setting (true = 180° rotation enabled).
   */
  setPrintRotation(value) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.settings = {
      ...config.settings,
      cutNumber: config.settings?.cutNumber ?? 4,
      language: config.settings?.language ?? "es",
      printRotation180: value
    };
    this.set(config);
  }
  /**
   * Get the virtual keyboard enabled setting, returns default false if unset.
   */
  getVirtualKeyboardEnabled() {
    const config = this.get();
    return config?.settings?.virtualKeyboardEnabled ?? false;
  }
  /**
   * Set the virtual keyboard enabled setting (true = virtual keyboard active).
   */
  setVirtualKeyboardEnabled(value) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.settings = {
      ...config.settings,
      cutNumber: config.settings?.cutNumber ?? 4,
      language: config.settings?.language ?? "es",
      printRotation180: config.settings?.printRotation180 ?? false,
      virtualKeyboardEnabled: value
    };
    this.set(config);
  }
  /**
   * Get the virtual keyboard language setting, returns default 'es' if unset.
   */
  getVirtualKeyboardLanguage() {
    const config = this.get();
    return config?.settings?.virtualKeyboardLanguage ?? "es";
  }
  /**
   * Set the virtual keyboard language (validated 'es' | 'en').
   */
  setVirtualKeyboardLanguage(value) {
    if (value !== "es" && value !== "en") {
      throw new Error(CONFIG_ERRORS.INVALID_LANGUAGE);
    }
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.settings = {
      ...config.settings,
      cutNumber: config.settings?.cutNumber ?? 4,
      language: config.settings?.language ?? "es",
      printRotation180: config.settings?.printRotation180 ?? false,
      virtualKeyboardEnabled: config.settings?.virtualKeyboardEnabled ?? false,
      virtualKeyboardLanguage: value
    };
    this.set(config);
  }
  /**
   * Get the "Formato Correo ESP" setting, returns default false if unset.
   */
  getFormatoCorreoEsp() {
    const config = this.get();
    return config?.settings?.formatoCorreoEsp ?? false;
  }
  /**
   * Set the "Formato Correo ESP" setting.
   * When enabled, labels show only the tariff name and tickets get an "ESP"
   * prefix on their title.
   */
  setFormatoCorreoEsp(value) {
    const config = this.get();
    if (!config) {
      throw new Error("Config not initialized. Call initConfig() first.");
    }
    config.settings = {
      ...config.settings,
      cutNumber: config.settings?.cutNumber ?? 4,
      language: config.settings?.language ?? "es",
      printRotation180: config.settings?.printRotation180 ?? false,
      virtualKeyboardEnabled: config.settings?.virtualKeyboardEnabled ?? false,
      virtualKeyboardLanguage: config.settings?.virtualKeyboardLanguage ?? "es",
      formatoCorreoEsp: value
    };
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
  handleIpc("config:getPrintRotation", () => {
    return repo.getPrintRotation();
  });
  handleIpc("config:setPrintRotation", (value) => {
    repo.setPrintRotation(value);
  });
  handleIpc("config:getVirtualKeyboardEnabled", () => {
    return repo.getVirtualKeyboardEnabled();
  });
  handleIpc("config:setVirtualKeyboardEnabled", (value) => {
    repo.setVirtualKeyboardEnabled(value);
  });
  handleIpc("config:getVirtualKeyboardLanguage", () => {
    return repo.getVirtualKeyboardLanguage();
  });
  handleIpc("config:setVirtualKeyboardLanguage", (value) => {
    repo.setVirtualKeyboardLanguage(value);
  });
  handleIpc("config:getFormatoCorreoEsp", () => {
    return repo.getFormatoCorreoEsp();
  });
  handleIpc("config:setFormatoCorreoEsp", (value) => {
    repo.setFormatoCorreoEsp(value);
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
class StampsRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Returns all stamp records ordered by year DESC, stamp_name ASC.
   */
  getAll() {
    const rows = this.db.prepare("SELECT * FROM stamps ORDER BY year DESC, stamp_name ASC").all();
    return rows.map(this.rowToRecord);
  }
  /**
   * Returns stamps for a given year, ordered by stamp_name ASC.
   */
  getByYear(year) {
    const rows = this.db.prepare("SELECT * FROM stamps WHERE year = ? ORDER BY stamp_name ASC").all(year);
    return rows.map(this.rowToRecord);
  }
  /**
   * Inserts or replaces a stamp record.
   * Uses stamp_id as the conflict key (UNIQUE constraint).
   */
  upsert(stamp) {
    this.db.prepare(
      `INSERT OR REPLACE INTO stamps (stamp_id, year, stamp_name, fondo_path, logo_path, status, synced_at)
         VALUES (@stampId, @year, @stampName, @fondoPath, @logoPath, @status, @syncedAt)`
    ).run({
      stampId: stamp.stampId,
      year: stamp.year,
      stampName: stamp.stampName,
      fondoPath: stamp.fondoPath,
      logoPath: stamp.logoPath,
      status: stamp.status,
      syncedAt: stamp.syncedAt
    });
  }
  /**
   * Deletes a stamp by its stamp_id.
   */
  remove(stampId) {
    this.db.prepare("DELETE FROM stamps WHERE stamp_id = ?").run(stampId);
  }
  /**
   * Removes all records from the stamps table.
   */
  clear() {
    this.db.prepare("DELETE FROM stamps").run();
  }
  /**
   * Converts a raw database row (snake_case) to a StampRecord (camelCase).
   */
  rowToRecord(row) {
    return {
      id: row.id,
      stampId: row.stamp_id,
      year: row.year,
      stampName: row.stamp_name,
      fondoPath: row.fondo_path,
      logoPath: row.logo_path,
      status: row.status,
      syncedAt: row.synced_at,
      createdAt: row.created_at
    };
  }
}
function fileToDataUri$1(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
function buildImageName(year, fairName, imageType) {
  return `${year}/${fairName}-${imageType}`;
}
function registerImagesHandlers() {
  const stampsRepo = new StampsRepository();
  handleIpc("images:upload", () => {
    console.warn("[images:upload] Disabled — images are managed via cloud sync only.");
  });
  handleIpc("images:remove", () => {
    console.warn("[images:remove] Disabled — images are managed via cloud sync only.");
  });
  handleIpc("images:getByName", (name) => {
    const imageName = name;
    if (!imageName) return null;
    const allStamps = stampsRepo.getAll();
    const exactMatch = allStamps.find(
      (s) => s.stampName.toLowerCase() === imageName.toLowerCase()
    );
    if (exactMatch && exactMatch.fondoPath) {
      const url2 = fileToDataUri$1(exactMatch.fondoPath);
      if (url2) return { name: exactMatch.stampName, url: url2 };
    }
    const lowerName = imageName.toLowerCase();
    for (const stamp of allStamps) {
      const fondoKey = buildImageName(stamp.year, stamp.stampName, "fondo");
      const selloKey = buildImageName(stamp.year, stamp.stampName, "sello");
      if (fondoKey.toLowerCase() === lowerName) {
        const url2 = fileToDataUri$1(stamp.fondoPath ?? "");
        if (url2) return { name: fondoKey, url: url2 };
      }
      if (selloKey.toLowerCase() === lowerName) {
        const url2 = fileToDataUri$1(stamp.logoPath ?? "");
        if (url2) return { name: selloKey, url: url2 };
      }
    }
    const partialMatch = allStamps.find(
      (s) => s.stampName.toLowerCase().includes(lowerName)
    );
    if (partialMatch && partialMatch.fondoPath) {
      const url2 = fileToDataUri$1(partialMatch.fondoPath);
      if (url2) return { name: partialMatch.stampName, url: url2 };
    }
    return null;
  });
  handleIpc("images:getFairList", () => {
    const stamps = stampsRepo.getAll();
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const stamp of stamps) {
      const key = `${stamp.year}#${stamp.stampName}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ year: stamp.year, fairName: stamp.stampName });
      }
    }
    return result;
  });
  handleIpc("images:getByFair", (year, fairName) => {
    const y = year;
    const fn = fairName;
    const stamps = stampsRepo.getAll();
    const match = stamps.find(
      (s) => s.year === y && s.stampName.toLowerCase() === fn.toLowerCase()
    );
    if (!match) {
      return { fondo: null, sello: null };
    }
    return {
      fondo: fileToDataUri$1(match.fondoPath ?? ""),
      sello: fileToDataUri$1(match.logoPath ?? "")
    };
  });
  handleIpc("images:getSyncStatus", () => {
    const stamps = stampsRepo.getAll();
    return {
      inserted: stamps.length,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      errors: []
    };
  });
  handleIpc("images:resync", () => {
    console.warn("[images:resync] Disabled — use stamps:sync for cloud synchronization.");
    const stamps = stampsRepo.getAll();
    return {
      inserted: stamps.length,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      errors: []
    };
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
const FALLBACK_DPI = { dpiX: 203, dpiY: 203 };
class DpiCache {
  cache = /* @__PURE__ */ new Map();
  get(printerName) {
    return this.cache.get(printerName);
  }
  set(printerName, dpi) {
    this.cache.set(printerName, dpi);
  }
  delete(printerName) {
    this.cache.delete(printerName);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
}
class WmiDpiDetector {
  executor;
  constructor(executor) {
    this.executor = executor;
  }
  async detect(printerName) {
    try {
      const escapedName = printerName.replace(/'/g, "''");
      const command = `powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_PrinterConfiguration -Filter \\"Name='${escapedName}'\\" | Select-Object XResolution, YResolution | ConvertTo-Json -Compress"`;
      const { stdout } = await this.executor.exec(command, { timeout: 5e3 });
      const parsed = JSON.parse(stdout.trim());
      const dpiX = parsed.XResolution;
      const dpiY = parsed.YResolution;
      if (typeof dpiX === "number" && typeof dpiY === "number" && Number.isInteger(dpiX) && Number.isInteger(dpiY) && dpiX > 0 && dpiY > 0) {
        return { dpiX, dpiY };
      }
      console.warn(`[DpiDetector] Invalid DPI values for "${printerName}": X=${dpiX}, Y=${dpiY}. Using fallback.`);
      return FALLBACK_DPI;
    } catch (error) {
      console.warn(`[DpiDetector] Failed to detect DPI for "${printerName}". Using fallback.`, error);
      return FALLBACK_DPI;
    }
  }
}
function parseMediaToMm(media) {
  const match = media.match(/^Custom\.(\d+)x(\d+)mm$/);
  if (!match) return null;
  return { widthMm: parseInt(match[1], 10), heightMm: parseInt(match[2], 10) };
}
function resolveMediaSizeMm(options) {
  if (options.mediaSizeMm) return options.mediaSizeMm;
  return parseMediaToMm(options.media);
}
const MM_TO_MICRONS = 1e3;
class ElectronPrintBackend {
  /**
   * Imprime un PDF ya escrito en disco.
   *
   * @param printerName - Nombre de la impresora en Windows
   * @param pdfPath - Ruta al PDF en disco
   * @param options - Opciones de impresión (tamaño de papel, orientación, ...)
   */
  async print(printerName, pdfPath, options) {
    const jobName = options.jobName ?? `electron_print_${Date.now()}`;
    let BrowserWindow;
    try {
      ;
      ({ BrowserWindow } = require("electron"));
      if (!BrowserWindow) throw new Error("BrowserWindow no disponible");
    } catch (err) {
      return {
        success: false,
        error: `Electron no disponible para imprimir: ${err instanceof Error ? err.message : String(err)}`
      };
    }
    const size = resolveMediaSizeMm(options);
    if (!size) {
      return { success: false, error: `No se pudo determinar el tamaño de papel de "${options.media}"` };
    }
    const pageSize = {
      width: Math.round(size.widthMm * MM_TO_MICRONS),
      height: Math.round(size.heightMm * MM_TO_MICRONS)
    };
    let win = null;
    try {
      win = new BrowserWindow({
        show: false,
        webPreferences: {
          // Necesario para que Chromium renderice el PDF con su visor interno
          plugins: true,
          sandbox: false
        }
      });
      const { pathToFileURL } = require("url");
      await win.loadURL(pathToFileURL(pdfPath).toString());
      await new Promise((resolve) => setTimeout(resolve, 700));
      console.log(
        `[ElectronPrintBackend] PRINT job="${jobName}" printer="${printerName}" pageSize=${size.widthMm}x${size.heightMm}mm (${pageSize.width}x${pageSize.height} micras) landscape=${options.landscape ?? false} pdf="${pdfPath}"`
      );
      const result = await new Promise((resolve) => {
        const contents = win.webContents;
        contents.print(
          {
            silent: true,
            deviceName: printerName,
            // Debe ser TRUE: al cargar el PDF en un BrowserWindow, Chromium lo
            // pinta con su visor interno y, si esto es false, no imprime nada
            // (etiqueta en blanco).
            //
            // Contrapartida: el visor tiene fondo gris oscuro y en monocromo
            // saldría un cuadrado negro. Por eso el PDF DEBE pintar su propio
            // fondo blanco (ver drawWhitePageBackground en stamp-renderer).
            printBackground: true,
            color: false,
            // Sin márgenes: el PDF ya tiene el tamaño exacto de la etiqueta.
            margins: { marginType: "none" },
            landscape: options.landscape ?? false,
            // 100 = tamaño original, sin reescalado.
            scaleFactor: 100,
            copies: options.copies ?? 1,
            pageSize
          },
          (success, failureReason) => {
            if (success) {
              resolve({ success: true, jobId: jobName });
            } else {
              resolve({ success: false, error: `webContents.print falló: ${failureReason}` });
            }
          }
        );
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ElectronPrintBackend] ERROR job="${jobName}": ${message}`);
      return { success: false, error: `Electron print falló: ${message}` };
    } finally {
      if (win && !win.isDestroyed()) {
        win.destroy();
      }
    }
  }
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
function parseCustomMedia(media) {
  const match = media.match(/^Custom\.(\d+)x(\d+)mm$/);
  if (!match) return null;
  return { widthTenths: parseInt(match[1], 10) * 10, heightTenths: parseInt(match[2], 10) * 10 };
}
async function configureCutAtEnd(printerName, executor) {
  const scriptPath = findScript("configure-cut-at-end.ps1");
  if (!scriptPath) {
    return;
  }
  const escapedPrinter = printerName.replace(/"/g, '`"');
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escapedPrinter}"`;
  try {
    await executor.exec(cmd, { timeout: 1e4 });
  } catch {
  }
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
function findScript(scriptName) {
  const { join } = require("path");
  const { existsSync } = require("fs");
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, scriptName));
  }
  candidates.push(join(__dirname, "..", "..", "resources", scriptName));
  candidates.push(join(__dirname, "..", "..", "..", "resources", scriptName));
  candidates.push(join(__dirname, "..", "..", "scripts", scriptName));
  candidates.push(join(__dirname, "..", "..", "..", "scripts", scriptName));
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}
class WindowsBackend {
  cmd;
  dpiCache;
  constructor(executor, dpiCache) {
    this.cmd = executor ?? defaultWindowsExecutor;
    this.dpiCache = dpiCache;
  }
  /**
   * Configures a printer's driver to cut only at the end of each job.
   * Fire-and-forget friendly: never throws, runs once per printer.
   * See configureCutAtEnd() for the rationale.
   */
  async configureCutAtEnd(printerName) {
    return configureCutAtEnd(printerName, this.cmd);
  }
  /**
   * Prints a PDF using the best available method:
   *
   * - For TICKETS (custom paper size): Uses Electron's webContents.print() API
   *   which passes the page size per-job in the DEVMODE. This ensures the
   *   correct paper height regardless of the Windows driver defaults.
   *
   * - For STAMPS (fixed 55x25mm): Uses SumatraPDF with the driver's configured
   *   paper size. The cut interval is controlled by grouping stamps into
   *   separate PDFs (one per cut group) — the driver just needs "cut at end".
   *
   * Fallback: if Electron print fails, falls back to SumatraPDF.
   */
  async print(printerUri, pdfBuffer, options) {
    const { writeFileSync, unlinkSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const { tmpdir } = require("os");
    const printerName = getWindowsPrinterName(printerUri);
    const jobName = options.jobName ?? `print_${Date.now()}`;
    const isHtml = options.contentType === "html";
    const ext = isHtml ? "html" : "pdf";
    const tempDir = join(tmpdir(), "stamp-sales-print");
    try {
      mkdirSync(tempDir, { recursive: true });
    } catch {
    }
    const tempFile = join(tempDir, `${jobName}_${Date.now()}.${ext}`);
    try {
      writeFileSync(tempFile, pdfBuffer);
      const customMedia = parseCustomMedia(options.media);
      const canUseElectron = isHtml || Boolean(customMedia) || Boolean(options.mediaSizeMm);
      if (canUseElectron) {
        try {
          const electronBackend = new ElectronPrintBackend();
          const result = await electronBackend.print(printerName, tempFile, options);
          if (result.success) {
            setTimeout(() => {
              try {
                unlinkSync(tempFile);
              } catch {
              }
            }, 1e4);
            return result;
          }
          console.warn("[WindowsBackend] Electron print failed:", result.error);
        } catch (err) {
          console.warn("[WindowsBackend] Electron print error:", err);
        }
        if (isHtml) {
          try {
            unlinkSync(tempFile);
          } catch {
          }
          console.error(
            `[WindowsBackend] PRINT FAILED (html) printer="${printerName}" job="${jobName}": Electron no pudo imprimir y SumatraPDF no soporta HTML`
          );
          return { success: false, error: "Electron print failed for HTML content (no SumatraPDF fallback)" };
        }
        console.warn("[WindowsBackend] Falling back to SumatraPDF (pdf content)");
      }
      const sumatraPath = getSumatraPdfPath();
      const dpi = this.dpiCache?.get(printerName) ?? FALLBACK_DPI;
      const dpiSetting = `${dpi.dpiX}x${dpi.dpiY}dpi`;
      const printSettings = `noscale,${dpiSetting}`;
      const args = [
        "-print-to",
        printerName,
        "-print-settings",
        printSettings,
        "-silent",
        tempFile
      ];
      console.log(
        `[WindowsBackend] PRINT job="${jobName}" printer="${printerName}" media="${options.media}" dpi=${dpi.dpiX}x${dpi.dpiY} render=${dpiSetting} pdfBytes=${pdfBuffer.length} sumatra="${sumatraPath}" tmp="${tempFile}"`
      );
      const startedAt = Date.now();
      await this.cmd.execFile(sumatraPath, args, { timeout: 3e4 });
      console.log(
        `[WindowsBackend] SumatraPDF returned for job="${jobName}" printer="${printerName}" in ${Date.now() - startedAt}ms`
      );
      if (customMedia) {
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
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
      const e = err;
      console.error(
        `[WindowsBackend] PRINT FAILED printer="${printerName}" job="${jobName}" code=${String(e?.code)} signal=${String(e?.signal)} msg=${message} stderr=${String(e?.stderr ?? "").trim()} stdout=${String(e?.stdout ?? "").trim()}`
      );
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
const STAMP_SIZE_MM = { widthMm: 55, heightMm: 25 };
const TICKET_WIDTH_MM_FOR_PRINT = 78;
const STAMP_ORIENTATION = 6;
const TICKET_ORIENTATION = 0;
function buildTicketMedia(heightMm) {
  return `Custom.78x${Math.ceil(heightMm)}mm`;
}
class PrinterManager {
  backend;
  assignments;
  paused;
  dpiDetector;
  dpiCache;
  constructor(backend, assignments, dpiDetector, dpiCache) {
    this.backend = backend;
    this.assignments = assignments ?? {};
    this.paused = /* @__PURE__ */ new Set();
    this.dpiDetector = dpiDetector;
    this.dpiCache = dpiCache;
  }
  /**
   * Returns the active backend instance.
   */
  getBackend() {
    return this.backend;
  }
  /**
   * Updates the printer assignments (target → URI mapping).
   * Triggers fire-and-forget DPI detection for newly assigned printers.
   */
  setAssignments(assignments) {
    const previousAssignments = { ...this.assignments };
    this.assignments = { ...this.assignments, ...assignments };
    if (this.dpiDetector && this.dpiCache) {
      const targets = ["printer1", "printer2", "ticket"];
      const detector = this.dpiDetector;
      const cache = this.dpiCache;
      const detectionPromises = [];
      for (const target of targets) {
        const newUri = assignments[target];
        if (!newUri) continue;
        const printerName = getWindowsPrinterName(newUri);
        const previousUri = previousAssignments[target];
        if (previousUri) {
          const previousName = getWindowsPrinterName(previousUri);
          if (previousName !== printerName) {
            cache.delete(previousName);
          }
        }
        detectionPromises.push(
          detector.detect(printerName).then(
            (dpi) => {
              cache.set(printerName, dpi);
            },
            () => {
              cache.set(printerName, FALLBACK_DPI);
            }
          )
        );
      }
      if (detectionPromises.length > 0) {
        void Promise.allSettled(detectionPromises);
      }
    }
    if (typeof this.backend.configureCutAtEnd === "function") {
      const backend = this.backend;
      const stampTargets = ["printer1", "printer2"];
      const cutPromises = [];
      for (const target of stampTargets) {
        const newUri = assignments[target];
        if (!newUri) continue;
        const previousUri = previousAssignments[target];
        if (previousUri === newUri) continue;
        const printerName = getWindowsPrinterName(newUri);
        cutPromises.push(
          backend.configureCutAtEnd(printerName).catch(() => {
          })
        );
      }
      if (cutPromises.length > 0) {
        void Promise.allSettled(cutPromises);
      }
    }
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
      console.error(
        `[PrinterManager] No printer assigned for target "${target}". Current assignments: ${JSON.stringify({
          printer1: this.assignments.printer1,
          printer2: this.assignments.printer2,
          ticket: this.assignments.ticket
        })}`
      );
      return {
        success: false,
        error: `No printer assigned for target "${target}"`
      };
    }
    if (this.paused.has(target)) {
      console.warn(`[PrinterManager] Target "${target}" is PAUSED — job not sent`);
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
      // Tamaño explícito para que el backend de Electron lo mande en el DEVMODE
      mediaSizeMm: { ...STAMP_SIZE_MM },
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
   * Recovers jobs left stuck in 'printing' (e.g. the app was killed or a print
   * backend hung during a previous run). Marks them as 'error' so they don't
   * remain zombie rows that never complete. Returns the number of jobs reset.
   *
   * Called on service startup.
   */
  resetStuckPrinting() {
    const result = this.db.prepare(
      `UPDATE print_queue
         SET status = 'error', error_message = 'Interrupted while printing (recovered on startup)'
         WHERE status = 'printing'`
    ).run();
    return result.changes;
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
  defaultTicketHeightMm: 200,
  printTimeoutMs: 45e3
};
class PrintQueueService {
  repository;
  printerManager;
  options;
  /** In-memory buffer cache for jobs awaiting printing (jobId → contenido + metadata) */
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
    const summary = pdfs.map((p) => `${p.pdfType}→${p.target}`).join(", ");
    console.log(
      `[PrintQueue] ENQUEUE ${pdfs.length} pdf(s) orderId=${orderId ?? "none"}` + (pdfs.length > 0 ? `: ${summary}` : " — WARNING: sale produced NO PDFs")
    );
    for (const pdf of pdfs) {
      const id = this.repository.insert({
        orderId: orderId ?? null,
        printerTarget: pdf.target,
        pdfType: pdf.pdfType,
        filePath: null
      });
      this.bufferCache.set(id, {
        buffer: pdf.buffer,
        ticketHeightMm: pdf.ticketHeightMm,
        contentType: pdf.contentType
      });
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
      console.warn(
        `[PrintQueue] Job ${job.id} (${job.pdfType} → ${job.printerTarget}): buffer missing from cache, marking error`
      );
      this.repository.markError(job.id, "PDF buffer not found in cache (possible restart)");
      return false;
    }
    const { buffer } = cached;
    const targetUri = this.printerManager.getUriForTarget(job.printerTarget);
    console.log(
      `[PrintQueue] Job ${job.id} START type=${job.pdfType} target=${job.printerTarget} uri=${targetUri ?? "UNASSIGNED"} bytes=${buffer.length} attempts=${job.attempts}`
    );
    this.repository.markPrinting(job.id);
    try {
      const options = this.buildPrintOptions(job);
      const result = await this.withTimeout(
        this.printerManager.print(job.printerTarget, buffer, options),
        this.options.printTimeoutMs,
        `Print timed out after ${this.options.printTimeoutMs}ms`
      );
      if (result.success) {
        console.log(`[PrintQueue] Job ${job.id} OK (target=${job.printerTarget})`);
        this.repository.markCompleted(job.id);
        this.bufferCache.delete(job.id);
        return true;
      } else {
        console.error(
          `[PrintQueue] Job ${job.id} FAILED (target=${job.printerTarget}): ${result.error ?? "unknown error"}`
        );
        this.repository.markError(job.id, result.error ?? "Unknown printer error");
        await this.scheduleRetry(job);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[PrintQueue] Job ${job.id} THREW (target=${job.printerTarget}): ${errorMessage}`
      );
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
      const cached2 = this.bufferCache.get(job.id);
      const heightMm = cached2?.ticketHeightMm ?? this.options.defaultTicketHeightMm;
      const media = buildTicketMedia(heightMm);
      console.log(`[PrintQueue] Ticket job ${job.id}: heightMm=${heightMm}, media=${media}, cached=${!!cached2?.ticketHeightMm}, contentType=${cached2?.contentType ?? "pdf"}`);
      return {
        media,
        orientation: TICKET_ORIENTATION,
        jobName: `${job.pdfType}_${job.id}`,
        contentType: cached2?.contentType,
        // Tamaño explícito para que Electron lo mande en el DEVMODE del trabajo:
        // ancho fijo 78mm, alto el calculado para este ticket.
        mediaSizeMm: { widthMm: TICKET_WIDTH_MM_FOR_PRINT, heightMm: Math.ceil(heightMm) }
      };
    }
    let cutInterval;
    try {
      const configRepo = new ConfigRepository();
      cutInterval = configRepo.getCutNumber();
    } catch {
      cutInterval = void 0;
    }
    const cached = this.bufferCache.get(job.id);
    return {
      media: STAMP_MEDIA,
      orientation: STAMP_ORIENTATION,
      jobName: `${job.pdfType}_${job.id}`,
      cutInterval,
      contentType: cached?.contentType,
      // Tamaño físico de la etiqueta (55x25mm) enviado en el DEVMODE por Electron.
      mediaSizeMm: { ...STAMP_SIZE_MM }
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
    try {
      const recovered = this.repository.resetStuckPrinting();
      if (recovered > 0) {
        console.log(`[PrintQueue] Recovered ${recovered} job(s) stuck in 'printing'`);
      }
    } catch (err) {
      console.warn("[PrintQueue] Failed to recover stuck jobs:", err);
    }
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
  /**
   * Races a promise against a timeout. If the promise doesn't settle within
   * `ms`, the returned promise rejects with an Error(message). Used to prevent a
   * hung print backend from blocking the queue indefinitely.
   */
  withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
    const dpiCache = new DpiCache();
    const dpiDetector = new WmiDpiDetector(defaultWindowsExecutor);
    const backend = new WindowsBackend(defaultWindowsExecutor, dpiCache);
    console.log(
      `[Services] Printer assignments loaded: ${JSON.stringify(savedAssignments)}`
    );
    printerManager = new PrinterManager(backend, assignments, dpiDetector, dpiCache);
    if (assignments) {
      printerManager.setAssignments(assignments);
    }
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
  configureStampPrinters().catch((err) => {
    console.warn("[Services] Failed to configure stamp printers:", err);
  });
}
const STAMP_PAGE_WIDTH_MM = 55;
const STAMP_PAGE_HEIGHT_MM$1 = 25;
function findResourceScript(scriptName) {
  const { existsSync } = require("fs");
  const { join } = require("path");
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, scriptName));
  }
  candidates.push(join(__dirname, "..", "resources", scriptName));
  candidates.push(join(__dirname, "..", "..", "resources", scriptName));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "";
}
function getStampPrinterNames() {
  let savedAssignments = {};
  try {
    const assignmentsRepo = new PrinterAssignmentsRepository();
    savedAssignments = assignmentsRepo.getAll();
  } catch {
    return [];
  }
  return [savedAssignments.printer1, savedAssignments.printer2].filter((uri) => Boolean(uri)).map((uri) => decodeURIComponent(uri.replace("win://", "")));
}
async function configureStampPrinters() {
  const scriptPath = findResourceScript("set-stamp-paper-size.ps1");
  if (!scriptPath) {
    console.log("[Services] set-stamp-paper-size.ps1 not found, skipping");
    return;
  }
  const stampPrinters = getStampPrinterNames();
  if (stampPrinters.length === 0) return;
  const { exec: nodeExec } = require("child_process");
  const { promisify } = require("util");
  const execAsync2 = promisify(nodeExec);
  for (const printerName of stampPrinters) {
    const escaped = printerName.replace(/"/g, '`"');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${escaped}" -WidthMm ${STAMP_PAGE_WIDTH_MM} -HeightMm ${STAMP_PAGE_HEIGHT_MM$1}`;
    try {
      const { stdout, stderr } = await execAsync2(cmd, { timeout: 1e4 });
      const out = String(stdout ?? "").trim().replace(/\s*\n\s*/g, " | ");
      console.log(`[Services] Configured stamp printer "${printerName}": ${out}`);
      const errOut = String(stderr ?? "").trim();
      if (errOut) console.warn(`[Services] Config stderr for "${printerName}": ${errOut}`);
    } catch (err) {
      console.warn(`[Services] Failed to configure stamp printer ${printerName}:`, err);
    }
  }
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
  handleIpc("printer:pauseTarget", async (target) => {
    const typedTarget = target;
    if (!["printer1", "printer2", "ticket"].includes(typedTarget)) {
      return { success: false };
    }
    const printerManager2 = getPrinterManager();
    await printerManager2.pause(typedTarget);
    console.log(`[Printer] Target "${typedTarget}" paused`);
    return { success: true };
  });
  handleIpc("printer:resumeTarget", async (target) => {
    const typedTarget = target;
    if (!["printer1", "printer2", "ticket"].includes(typedTarget)) {
      return { success: false };
    }
    const printerManager2 = getPrinterManager();
    await printerManager2.resume(typedTarget);
    const queueService = getPrintQueueService();
    queueService.retryErrorsByTarget(typedTarget);
    console.log(`[Printer] Target "${typedTarget}" resumed`);
    return { success: true };
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
        local_currency_symbol_before: Boolean(group.local_currency_symbol_before),
        complementary_currency_symbol_before: Boolean(group.complementary_currency_symbol_before),
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
      INSERT INTO tariff_groups (
        year, title, currency, local_currency, complementary_currency,
        local_currency_symbol_before, complementary_currency_symbol_before
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
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
          input.complementary_currency,
          input.local_currency_symbol_before ? 1 : 0,
          input.complementary_currency_symbol_before ? 1 : 0
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
   * Updates an existing tariff group using a diff-based approach:
   * - Existing tariffs/strips are updated in-place (preserving IDs)
   * - New tariffs/strips are inserted
   * - Omitted tariffs/strips are deleted
   * - Orphaned references in events are cleaned up
   * All operations execute atomically in a single transaction.
   * Returns the updated group or null if not found.
   */
  update(id, input) {
    const existing = this.getById(id);
    if (!existing) return null;
    const title = input.title ?? existing.title;
    const localCurrency = input.local_currency ?? existing.local_currency;
    const complementaryCurrency = input.complementary_currency ?? existing.complementary_currency;
    const localSymbolBefore = input.local_currency_symbol_before ?? existing.local_currency_symbol_before;
    const complementarySymbolBefore = input.complementary_currency_symbol_before ?? existing.complementary_currency_symbol_before;
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
        local_currency_symbol_before = ?, complementary_currency_symbol_before = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
    const insertTariff = this.db.prepare(`
      INSERT INTO tariffs (group_id, name, description, local_price, secondary_price, position, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStripTariff = this.db.prepare(`
      INSERT INTO strip_tariffs (strip_id, tariff_id, quantity)
      VALUES (?, ?, ?)
    `);
    const updateTariffStmt = this.db.prepare(`
      UPDATE tariffs SET name = ?, description = ?, local_price = ?, secondary_price = ?, position = ?
      WHERE id = ?
    `);
    const deleteSingleTariff = this.db.prepare("DELETE FROM tariffs WHERE id = ?");
    const deleteStripTariffsForTariff = this.db.prepare("DELETE FROM strip_tariffs WHERE tariff_id = ?");
    const deleteStripJunction = this.db.prepare("DELETE FROM strip_tariffs WHERE strip_id = ?");
    const updateTransaction = this.db.transaction(() => {
      const year = input.year ?? existing.year;
      try {
        updateGroup.run(
          year,
          title,
          localCurrency,
          localCurrency,
          complementaryCurrency,
          localSymbolBefore ? 1 : 0,
          complementarySymbolBefore ? 1 : 0,
          id
        );
      } catch (err) {
        if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
          throw new Error(TARIFF_GROUP_ERRORS.DUPLICATE_YEAR);
        }
        throw err;
      }
      const existingTariffIds = new Set(existing.tariffs.map((t) => t.id));
      const incomingTariffIds = /* @__PURE__ */ new Set();
      const positionToId = /* @__PURE__ */ new Map();
      for (const tariff of input.tariffs) {
        if (tariff.id && existingTariffIds.has(tariff.id)) {
          updateTariffStmt.run(
            tariff.name,
            tariff.description ?? "",
            tariff.local_price,
            tariff.secondary_price,
            tariff.position,
            tariff.id
          );
          incomingTariffIds.add(tariff.id);
          positionToId.set(tariff.position, tariff.id);
        }
      }
      for (const tariff of input.tariffs) {
        if (!tariff.id || !existingTariffIds.has(tariff.id)) {
          const result = insertTariff.run(
            id,
            tariff.name,
            tariff.description ?? "",
            tariff.local_price,
            tariff.secondary_price,
            tariff.position,
            "individual"
          );
          positionToId.set(tariff.position, Number(result.lastInsertRowid));
        }
      }
      const deletedTariffIds = [];
      for (const existingId of existingTariffIds) {
        if (!incomingTariffIds.has(existingId)) {
          deleteStripTariffsForTariff.run(existingId);
          deleteSingleTariff.run(existingId);
          deletedTariffIds.push(existingId);
        }
      }
      const existingStripIds = new Set(existing.strips.map((s) => s.id));
      const incomingStripIds = /* @__PURE__ */ new Set();
      const deletedStripIds = [];
      for (const strip of input.strips) {
        if (strip.id && existingStripIds.has(strip.id)) {
          updateTariffStmt.run(
            strip.name,
            "",
            strip.local_price,
            strip.secondary_price,
            strip.position,
            strip.id
          );
          incomingStripIds.add(strip.id);
          deleteStripJunction.run(strip.id);
          for (const [tariffPosition, quantity] of this.countTariffOccurrences(strip.tariff_ids)) {
            const resolvedId = positionToId.get(tariffPosition);
            if (resolvedId != null) {
              insertStripTariff.run(strip.id, resolvedId, quantity);
            }
          }
        } else {
          const result = insertTariff.run(
            id,
            strip.name,
            "",
            strip.local_price,
            strip.secondary_price,
            strip.position,
            "strip"
          );
          const newStripId = Number(result.lastInsertRowid);
          for (const [tariffPosition, quantity] of this.countTariffOccurrences(strip.tariff_ids)) {
            const resolvedId = positionToId.get(tariffPosition);
            if (resolvedId != null) {
              insertStripTariff.run(newStripId, resolvedId, quantity);
            }
          }
        }
      }
      for (const existingId of existingStripIds) {
        if (!incomingStripIds.has(existingId)) {
          deleteStripJunction.run(existingId);
          deleteSingleTariff.run(existingId);
          deletedStripIds.push(existingId);
        }
      }
      if (deletedTariffIds.length > 0 || deletedStripIds.length > 0) {
        this.cleanOrphanedIds(id, deletedTariffIds, deletedStripIds);
      }
    });
    updateTransaction();
    return this.getById(id);
  }
  /**
   * Removes deleted tariff/strip IDs from all events that reference the given tariff group.
   * Updates `updated_at` for affected event rows.
   * Must be called within the same transaction as the tariff deletions.
   */
  cleanOrphanedIds(groupId, deletedTariffIds, deletedStripIds) {
    const events = this.db.prepare("SELECT id, selected_tariff_ids, selected_strip_ids FROM eventos WHERE tariff_group_id = ?").all(groupId);
    const updateStmt = this.db.prepare(`
      UPDATE eventos SET selected_tariff_ids = ?, selected_strip_ids = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    const deletedTariffSet = new Set(deletedTariffIds);
    const deletedStripSet = new Set(deletedStripIds);
    for (const event of events) {
      const currentTariffs = this.parseJsonArray(event.selected_tariff_ids);
      const currentStrips = this.parseJsonArray(event.selected_strip_ids);
      const filteredTariffs = currentTariffs.filter((id) => !deletedTariffSet.has(id));
      const filteredStrips = currentStrips.filter((id) => !deletedStripSet.has(id));
      const tariffChanged = filteredTariffs.length !== currentTariffs.length;
      const stripChanged = filteredStrips.length !== currentStrips.length;
      if (tariffChanged || stripChanged) {
        updateStmt.run(
          JSON.stringify(filteredTariffs),
          JSON.stringify(filteredStrips),
          event.id
        );
      }
    }
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
   * Creates a new event. Returns the created event with its ID.
   */
  create(input) {
    const selectedTariffIds = JSON.stringify(input.selected_tariff_ids ?? []);
    const selectedStripIds = JSON.stringify(input.selected_strip_ids ?? []);
    const stmt = this.db.prepare(`
      INSERT INTO eventos (year, codigo, codigo_feria_1, codigo_feria_2, nevento, nferia, nlugar, motivoi, motivod, layout_modelo1, layout_modelo2, fecha, localidad, tariff_group_id, selected_tariff_ids, selected_strip_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.year,
      input.codigo,
      input.codigo_feria_1,
      input.codigo_feria_2,
      input.nevento,
      input.nferia,
      input.nlugar,
      input.motivoi,
      input.motivod,
      input.layout_modelo1,
      input.layout_modelo2,
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
    const updated = {
      year: input.year ?? existing.year,
      codigo: input.codigo ?? existing.codigo,
      codigo_feria_1: input.codigo_feria_1 ?? existing.codigo_feria_1,
      codigo_feria_2: input.codigo_feria_2 ?? existing.codigo_feria_2,
      nevento: input.nevento ?? existing.nevento,
      nferia: input.nferia ?? existing.nferia,
      nlugar: input.nlugar ?? existing.nlugar,
      motivoi: input.motivoi ?? existing.motivoi,
      motivod: input.motivod ?? existing.motivod,
      layout_modelo1: input.layout_modelo1 ?? existing.layout_modelo1,
      layout_modelo2: input.layout_modelo2 ?? existing.layout_modelo2,
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
        year = ?, codigo = ?, codigo_feria_1 = ?, codigo_feria_2 = ?,
        nevento = ?, nferia = ?, nlugar = ?,
        motivoi = ?, motivod = ?, layout_modelo1 = ?, layout_modelo2 = ?,
        fecha = ?, localidad = ?,
        tariff_group_id = ?,
        selected_tariff_ids = ?,
        selected_strip_ids = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updated.year,
      updated.codigo,
      updated.codigo_feria_1,
      updated.codigo_feria_2,
      updated.nevento,
      updated.nferia,
      updated.nlugar,
      updated.motivoi,
      updated.motivod,
      updated.layout_modelo1,
      updated.layout_modelo2,
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
const STAMP_WIDTH_MM = 55;
const STAMP_PAGE_HEIGHT_MM = 25;
const SELLO_LAYOUT = {
  tarifa: { x: 1, y: 1.4, size: 12.2 },
  descripcion: { x: 1, y: 5.4, size: 9 },
  // esta línea NO SE USA
  fecha: { x: 1, y: 11, size: 9 },
  localidad: { x: 1, y: 14, size: 9 },
  codigo1: { x: 1, y: 18.5, size: 5.9 },
  // esta línea NO SE USA
  codigo2: { x: 1, y: 20.5, size: 5.9 }
  // CÓDIGO: letra P+MES+PAÍS+AÑO   CÓDIGO EVENTO+0001+001  = ejemplo: P9ES26 EX26-0001-001
};
const SELLO_LAYOUT_DEFAULT = [
  { source: "tarifa", x: SELLO_LAYOUT.tarifa.x, y: SELLO_LAYOUT.tarifa.y, size: SELLO_LAYOUT.tarifa.size },
  { source: "descripcion", x: SELLO_LAYOUT.descripcion.x, y: SELLO_LAYOUT.descripcion.y, size: SELLO_LAYOUT.descripcion.size },
  { source: "fecha", x: SELLO_LAYOUT.fecha.x, y: SELLO_LAYOUT.fecha.y, size: SELLO_LAYOUT.fecha.size },
  { source: "localidad", x: SELLO_LAYOUT.localidad.x, y: SELLO_LAYOUT.localidad.y, size: SELLO_LAYOUT.localidad.size },
  { source: "codigoLinea1", x: SELLO_LAYOUT.codigo1.x, y: SELLO_LAYOUT.codigo1.y, size: SELLO_LAYOUT.codigo1.size },
  { source: "codigoLinea2", x: SELLO_LAYOUT.codigo2.x, y: SELLO_LAYOUT.codigo2.y, size: SELLO_LAYOUT.codigo2.size }
];
const SELLO_LAYOUT_CORREO_ESP = [
  { source: "tarifa", x: 1, y: 1.4, size: 12.2 },
  { source: "fecha", x: 1, y: 11.2, size: 9 },
  { source: "localidad", x: 1, y: 15.2, size: 9 },
  // Código en un único campo (no se parte en dos líneas):
  // formato P{mes}{pais}{annio} {feria}-{cliente}-{producto}, ej. "P9ES26 EX26-0001-001"
  { source: "codigoCompleto", x: 1, y: 20, size: 5.9 }
];
function getSelloLayout(formatoCorreoEsp) {
  return formatoCorreoEsp ? SELLO_LAYOUT_CORREO_ESP : SELLO_LAYOUT_DEFAULT;
}
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
  const line1 = codigo.substring(0, spaceIdx);
  const line2 = codigo.substring(spaceIdx + 1);
  return { line1, line2 };
}
let _fontCssCache = null;
function buildFontFaceCss() {
  if (_fontCssCache !== null) return _fontCssCache;
  const fontsPath = getFontsPath();
  const faces = [
    { family: "FranklinGothic", file: "franklin_gothic.ttf", weight: "normal" },
    { family: "FranklinGothic", file: "franklin_gothic_bold.ttf", weight: "bold" },
    { family: "FranklinGothicCondensed", file: "franklin_gothic_condensed.ttf", weight: "normal" }
  ];
  const css = [];
  for (const face of faces) {
    const full = path.join(fontsPath, face.file);
    if (!fs.existsSync(full)) continue;
    try {
      const b64 = fs.readFileSync(full).toString("base64");
      css.push(
        `@font-face{font-family:'${face.family}';font-weight:${face.weight};font-style:normal;src:url(data:font/truetype;charset=utf-8;base64,${b64}) format('truetype');}`
      );
    } catch {
    }
  }
  _fontCssCache = css.join("\n");
  return _fontCssCache;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function imageToSrc(image) {
  if (!image) return null;
  if (image.startsWith("data:")) return image;
  if (!fs.existsSync(image)) return null;
  try {
    const lower = image.toLowerCase();
    const mime = lower.endsWith(".png") ? "image/png" : lower.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(image).toString("base64")}`;
  } catch {
    return null;
  }
}
function renderImageLayers(stamp) {
  const parts = [];
  const fondo = imageToSrc(stamp.backgroundImage);
  if (fondo) {
    parts.push(`<img class="layer" src="${fondo}" alt="">`);
  }
  if (stamp.printLogoPng && stamp.logoPngImage) {
    const logo = imageToSrc(stamp.logoPngImage);
    if (logo) parts.push(`<img class="layer" src="${logo}" alt="">`);
  } else {
    const overlay = imageToSrc(stamp.overlayImage);
    if (overlay) parts.push(`<img class="layer" src="${overlay}" alt="">`);
  }
  return parts.join("");
}
function resolveFieldText(stamp, source) {
  const { line1, line2 } = formatCodigoLines(stamp.codigo);
  switch (source) {
    case "tarifa":
      return stamp.tarifa;
    case "descripcion":
      return stamp.tarifaDescripcion ?? "";
    case "fecha":
      return formatFechaMonthYear(stamp.fecha);
    case "localidad":
      return stamp.evento;
    case "codigoLinea1":
      return line1;
    case "codigoLinea2":
      return line2;
    case "codigoCompleto":
      return stamp.codigo;
    default:
      return "";
  }
}
function renderTextFields(stamp, formatoCorreoEsp) {
  const layout = getSelloLayout(formatoCorreoEsp);
  return layout.map((f) => {
    const text = resolveFieldText(stamp, f.source);
    if (!text) return "";
    return `<div class="f" style="left:${f.x}mm;top:${f.y}mm;font-size:${f.size}pt">${escapeHtml(text)}</div>`;
  }).join("");
}
function renderStampsHtml(stamps, options = {}) {
  const widthMm = options.widthMm ?? STAMP_WIDTH_MM;
  const heightMm = options.heightMm ?? STAMP_PAGE_HEIGHT_MM;
  const formatoCorreoEsp = options.formatoCorreoEsp ?? false;
  const rotate180 = options.rotate180 ?? false;
  const labels = stamps.map((stamp) => {
    const inner = renderImageLayers(stamp) + renderTextFields(stamp, formatoCorreoEsp);
    return `<div class="label"><div class="inner">${inner}</div></div>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiquetas</title>
<style>
${buildFontFaceCss()}
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
html, body {
  margin: 0;
  padding: 0;
  /* Fondo blanco explícito: sin esto, al imprimir en monocromo se hereda el
     gris del navegador y la etiqueta sale negra. */
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.label {
  position: relative;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
  ${options.debugBorder ? "outline: 0.2mm solid #000; outline-offset: -0.2mm;" : ""}
}
.label:last-child { page-break-after: auto; break-after: auto; }
.inner {
  position: absolute;
  inset: 0;
  ${rotate180 ? "transform: rotate(180deg);" : ""}
}
/* Capas de imagen: cubren la etiqueta completa */
.layer {
  position: absolute;
  left: 0;
  top: 0;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  object-fit: fill;
}
/* Campos de texto posicionados en mm desde la esquina superior izquierda */
.f {
  position: absolute;
  margin: 0;
  padding: 0;
  color: #000;
  font-family: 'FranklinGothic', Arial, Helvetica, sans-serif;
  font-weight: normal;
  line-height: 1;
  white-space: nowrap;
}
</style>
</head>
<body>
${labels}
</body>
</html>`;
}
const ESPECIAL_LAYOUT = {
  codigo: { x: 1.5, y: 19.5, size: 6 },
  especial: { x: 23.3, y: 19.5, size: 6 },
  tarifa: { x: 1.5, y: 3, size: 12 }
};
const ESPECIAL_BG_FILES = [
  "TiraEspecial1.png",
  "TiraEspecial2.png",
  "TiraEspecial3.png",
  "TiraEspecial4.png"
];
function renderEspecialStripHtml(params, options = {}) {
  const widthMm = options.widthMm ?? STAMP_WIDTH_MM;
  const heightMm = options.heightMm ?? STAMP_PAGE_HEIGHT_MM;
  const rotate180 = options.rotate180 ?? false;
  const imagesPath = getImagesPath();
  const L = ESPECIAL_LAYOUT;
  const field = (text, pos) => {
    if (!text) return "";
    return `<div class="f" style="left:${pos.x}mm;top:${pos.y}mm;font-size:${pos.size}pt">${escapeHtml(text)}</div>`;
  };
  const labels = [0, 1, 2, 3].map((page) => {
    const bgFull = path.join(imagesPath, ESPECIAL_BG_FILES[page]);
    const bgSrc = imageToSrc(bgFull);
    const bg = bgSrc ? `<img class="layer" src="${bgSrc}" alt="">` : "";
    const showTarifa = page === 1 || page === 2;
    const inner = bg + (showTarifa ? field(params.tarifa, L.tarifa) : "") + field(params.codigos[page], L.codigo) + field(params.especial, L.especial);
    return `<div class="label"><div class="inner">${inner}</div></div>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Tira Especial</title>
<style>
${buildFontFaceCss()}
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.label {
  position: relative;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  background: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
}
.label:last-child { page-break-after: auto; break-after: auto; }
.inner { position: absolute; inset: 0; ${rotate180 ? "transform: rotate(180deg);" : ""} }
.layer { position: absolute; left: 0; top: 0; width: ${widthMm}mm; height: ${heightMm}mm; object-fit: fill; }
.f { position: absolute; margin: 0; padding: 0; color: #000; font-family: 'FranklinGothic', Arial, Helvetica, sans-serif; font-weight: normal; line-height: 1; white-space: nowrap; }
</style>
</head>
<body>
${labels}
</body>
</html>`;
}
const TICKET_WIDTH_MM = 78;
const TICKET_LAYOUT_DEFAULT = [
  { source: "logo" },
  { source: "feria", style: "feria" },
  { source: "lugar", style: "lugar" },
  { source: "empresa", style: "info" },
  { source: "cif", style: "info" },
  { source: "cp", style: "info" },
  { source: "fecha", style: "fecha" },
  { source: "modo", style: "modo" },
  { source: "columnas" },
  { source: "items", separatorBefore: true },
  { source: "total", separatorBefore: true },
  { source: "legal1", style: "legal", separatorBefore: true },
  { source: "legal2", style: "legal" },
  { source: "legal3", style: "legal" }
];
const TICKET_LAYOUT_CORREO_ESP = [
  { source: "logo" },
  { source: "feria", style: "feria" },
  { source: "lugar", style: "lugar" },
  { source: "empresa", style: "info" },
  { source: "cif", style: "info" },
  { source: "cp", style: "info" },
  { source: "fecha", style: "fecha" },
  { source: "modo", style: "modo" },
  { source: "columnas" },
  { source: "items", separatorBefore: true },
  { source: "total", separatorBefore: true },
  { source: "legal1", style: "legal", separatorBefore: true },
  { source: "legal2", style: "legal" },
  { source: "legal3", style: "legal" }
  // Ejemplo para futuros campos exclusivos de Correo ESP:
  // { source: 'session', style: 'session' }
];
function getTicketLayout(formatoCorreoEsp) {
  return formatoCorreoEsp ? TICKET_LAYOUT_CORREO_ESP : TICKET_LAYOUT_DEFAULT;
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
function formatPrice(value, currencySymbol = "€", symbolBefore = false) {
  const str = value.toFixed(2);
  return symbolBefore ? currencySymbol + str : str + currencySymbol;
}
function calcTicketHeightMm(numItems) {
  return TICKET_MARGIN_TOP + TICKET_LOGO_HEIGHT + TICKET_HEADER_HEIGHT + TICKET_COLUMNS_HEIGHT + numItems * TICKET_ITEM_ROW_HEIGHT + TICKET_TOTAL_HEIGHT + TICKET_FOOTER_HEIGHT + TICKET_MARGIN_BOTTOM + TICKET_HEIGHT_SAFETY_MARGIN;
}
const TICKET_MARGIN_TOP = 7;
const TICKET_LOGO_HEIGHT = 24;
const TICKET_HEADER_HEIGHT = 29;
const TICKET_COLUMNS_HEIGHT = 5;
const TICKET_ITEM_ROW_HEIGHT = 3.5;
const TICKET_TOTAL_HEIGHT = 8;
const TICKET_FOOTER_HEIGHT = 16;
const TICKET_MARGIN_BOTTOM = 5;
const TICKET_HEIGHT_SAFETY_MARGIN = 8;
function calcTicketCajaHeightMm(numItems) {
  return 5 + 14 + 38 + 5 + numItems * 3.5 + 8 + 16 + 5 + TICKET_HEIGHT_SAFETY_MARGIN;
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
  return MASTER_MARGIN_TOP + MASTER_LOGO_HEIGHT + MASTER_HEADER_HEIGHT + MASTER_COLUMNS_HEIGHT + numItems * MASTER_ITEM_ROW_HEIGHT + MASTER_TOTAL_HEIGHT + MASTER_FOOTER_HEIGHT + MASTER_MARGIN_BOTTOM + TICKET_HEIGHT_SAFETY_MARGIN;
}
function imageFileToSrc(imageName) {
  const full = path.join(getImagesPath(), imageName);
  if (!fs.existsSync(full)) return null;
  try {
    const lower = imageName.toLowerCase();
    const mime = lower.endsWith(".png") ? "image/png" : lower.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${fs.readFileSync(full).toString("base64")}`;
  } catch {
    return null;
  }
}
function itemRow(name, qty, price, total) {
  return `<div class="row"><span class="c-name">${escapeHtml(name)}</span><span class="c-qty">${escapeHtml(qty)}</span><span class="c-price">${escapeHtml(price)}</span><span class="c-total">${escapeHtml(total)}</span></div>`;
}
function ticketDocument(title, heightMm, body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
${buildFontFaceCss()}
@page { size: ${TICKET_WIDTH_MM}mm ${Math.ceil(heightMm)}mm; margin: 0; }
html, body {
  margin: 0; padding: 0; background: #ffffff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.ticket {
  position: relative;
  width: ${TICKET_WIDTH_MM}mm;
  min-height: ${Math.ceil(heightMm)}mm;
  background: #ffffff;
  box-sizing: border-box;
  padding: 4mm 5mm 5mm 5mm;
  color: #000;
  font-family: 'FranklinGothic', Arial, Helvetica, sans-serif;
}
.logo { display:block; margin: 0 auto 1mm auto; }
.center { text-align: center; }
.bold { font-family: 'FranklinGothicBold', 'FranklinGothic', Arial, sans-serif; font-weight: bold; }
.cond { font-family: 'FranklinGothicCondensed', 'FranklinGothic', Arial, sans-serif; }
.feria { font-size: 12pt; }
.lugar { font-size: 10pt; margin-top: 1mm; }
.info { font-size: 7.5pt; margin-top: 0.6mm; }
.fecha { font-size: 8pt; margin-top: 1.5mm; }
.modo { font-size: 6.5pt; margin-top: 1.5mm; }
.sep { border: 0; border-top: 0.2mm dashed #000; margin: 1mm 0; }
.sep-total { border: 0; border-top: 0.2mm dashed #000; margin: 1mm 0 1mm 25mm; }
.cols, .row {
  position: relative;
  font-size: 8pt;
  min-height: 3.2mm;
}
.cols { font-weight: normal; }
.c-name { display: inline-block; width: 38mm; vertical-align: top; }
.c-qty { position: absolute; left: 40mm; width: 10mm; text-align: right; }
.c-price { position: absolute; left: 50mm; width: 12mm; text-align: right; }
.c-total { position: absolute; left: 62mm; width: 13mm; text-align: right; }
.h-name { display:inline-block; width: 38mm; }
.h-qty { position:absolute; left: 40mm; }
.h-price { position:absolute; left: 50mm; }
.h-total { position:absolute; left: 60mm; }
.total-row { position: relative; font-size: 8pt; margin-top: 1mm; }
.t-label { position:absolute; left: 30mm; }
.t-qty { position:absolute; left: 40mm; width:10mm; text-align:right; }
.t-total { position:absolute; left: 62mm; width:13mm; text-align:right; }
.legal { font-size: 7.5pt; margin-top: 1.5mm; }
.session { font-size: 7.5pt; margin-top: 1.5mm; }
.pay { font-size: 12pt; margin-top: 2mm; }
.pay-line { display:inline-block; border-bottom: 0.2mm solid #000; width: 20mm; margin-left: 2mm; }
.masterlabel { font-size: 9.5pt; margin-top: 1mm; }
</style>
</head>
<body>
<div class="ticket">
${body}
</div>
</body>
</html>`;
}
function columnsHeader() {
  return `<div class="cols cond"><span class="h-name">Producto</span><span class="h-qty">Cant.</span><span class="h-price">Precio</span><span class="h-total">Importe</span></div>`;
}
const BLOCK_STYLE_CLASS = {
  feria: "center bold feria",
  lugar: "center bold lugar",
  info: "center bold info",
  fecha: "center cond fecha",
  modo: "bold modo",
  legal: "center bold legal",
  session: "center bold session",
  master: "bold masterlabel"
};
function renderTicketHtml(params, formatoCorreoEsp = false) {
  const {
    fechaTicket,
    modoTicket,
    modelo1Ticket,
    modelo2Ticket,
    items,
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
  const numItems = countActiveItems(items);
  const heightMm = calcTicketHeightMm(numItems);
  const logo = imageFileToSrc("image2.jpg");
  const codigoFeriaDisplay = params.codigoTicket || [params.codigoFeria1, params.codigoFeria2].filter(Boolean).join("-");
  const modoLine = codigoFeriaDisplay ? `${modoTicket}: ${codigoFeriaDisplay}` : modoTicket;
  let totalProductos = 0;
  let totalImporte = 0;
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.cantidad <= 0) continue;
    const producto = productos[i];
    const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
    totalProductos += item.cantidad;
    totalImporte += item.cantidad * producto.precio;
    rows.push(
      itemRow(
        `${modeloTicket} ${producto.nombre_ticket}`,
        String(item.cantidad),
        formatPrice(producto.precio, currencySymbol),
        formatPrice(item.cantidad * producto.precio, currencySymbol)
      )
    );
  }
  const textFor = (block) => {
    switch (block.source) {
      case "feria":
        return feria;
      case "lugar":
        return lugar;
      case "empresa":
        return empresa;
      case "cif":
        return cif;
      case "cp":
        return cp;
      case "fecha":
        return `Fecha ${fechaTicket}`;
      case "modo":
        return modoLine;
      case "session":
        return `${params.nombreMaquina ?? ""} - Sesión: ${formatClientId(params.idCliente ?? 0)}`;
      case "legal1":
        return l1;
      case "legal2":
        return l2;
      case "legal3":
        return l3;
      case "masterLabel":
        return "MASTER SET";
      default:
        return "";
    }
  };
  const renderBlock = (block) => {
    const sep = block.separatorBefore ? block.source === "total" ? '<hr class="sep-total">' : '<hr class="sep">' : "";
    switch (block.source) {
      case "logo":
        return logo ? `<img class="logo" src="${logo}" style="width:30mm">` : "";
      case "columnas":
        return sep + columnsHeader();
      case "items":
        return sep + rows.join("");
      case "total":
        return sep + `<div class="total-row cond"><span class="t-label">Total:</span><span class="t-qty">${totalProductos}</span><span class="t-total">${escapeHtml(formatPrice(totalImporte, currencySymbol))}</span></div>`;
      default: {
        const text = textFor(block);
        if (!text) return sep;
        const cls = block.style ? BLOCK_STYLE_CLASS[block.style] : "info";
        return sep + `<div class="${cls}">${escapeHtml(text)}</div>`;
      }
    }
  };
  const layout = getTicketLayout(formatoCorreoEsp);
  const body = layout.map(renderBlock).join("\n");
  return ticketDocument("Factura Simplificada", heightMm, body);
}
function renderTicketCajaHtml(params) {
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
  const numItems = countActiveItems(items);
  const heightMm = calcTicketCajaHeightMm(numItems);
  const logo = imageFileToSrc("image2.jpg");
  let totalProductos = 0;
  let totalImporte = 0;
  let inicioMod2 = false;
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.cantidad <= 0) continue;
    const producto = productos[i];
    const isModel2 = item.idProducto.slice(-1) === "2";
    const modeloTicket = isModel2 ? modelo2Ticket : modelo1Ticket;
    if (isModel2 && !inicioMod2) {
      rows.push('<hr class="sep">');
      inicioMod2 = true;
    }
    totalProductos += item.cantidad;
    totalImporte += item.cantidad * producto.precio;
    rows.push(
      itemRow(
        `${modeloTicket} ${producto.nombre_ticket}`,
        String(item.cantidad),
        formatPrice(producto.precio, currencySymbol),
        formatPrice(item.cantidad * producto.precio, currencySymbol)
      )
    );
  }
  const payField = (label) => `<div class="bold pay">${escapeHtml(label)}<span class="pay-line"></span></div>`;
  const body = [
    logo ? `<img class="logo" src="${logo}" style="width:30mm">` : "",
    `<div class="center bold feria">${escapeHtml(feria)}</div>`,
    `<div class="bold modo">${escapeHtml(modoTicket)}</div>`,
    payField("TARJETA P.:"),
    payField("TP TUSELLO:"),
    payField("ATM SOBRE:"),
    payField("ATM Tarifa A:"),
    `<div class="cols cond"><span class="h-name">Producto</span><span class="h-qty">Cantidad</span></div>`,
    `<hr class="sep">`,
    rows.join(""),
    `<hr class="sep-total">`,
    `<div class="total-row cond"><span class="t-label">Total:</span><span class="t-qty">${totalProductos}</span><span class="t-total">${escapeHtml(formatPrice(totalImporte, currencySymbol))}</span></div>`,
    `<hr class="sep">`,
    `<div class="center bold session">${escapeHtml(`${nombreMaquina} - Sesión: ${formatClientId(idCliente)}`)}</div>`,
    `<div class="center bold legal">PARA RECOGER SU PEDIDO</div>`,
    `<div class="center bold legal">PASE POR CAJA y ENTREGUE ESTE RESGUARDO</div>`
  ].join("\n");
  return ticketDocument("Copia Ticket Caja", heightMm, body);
}
const MASTER_SET_PRICE = 31.05;
function renderTicketMasterHtml(params) {
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
  const numItems = countActiveItems(items);
  const heightMm = calcTicketMasterHeightMm(numItems);
  const logo = imageFileToSrc("image2.jpg");
  let totalItems = 0;
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.cantidad <= 0) continue;
    const modeloTicket = item.idProducto.slice(-1) === "1" ? modelo1Ticket : modelo2Ticket;
    totalItems++;
    rows.push(
      itemRow(
        `${modeloTicket} Master Set`,
        "1",
        formatPrice(MASTER_SET_PRICE, currencySymbol),
        formatPrice(MASTER_SET_PRICE, currencySymbol)
      )
    );
  }
  const masterTotal = totalItems * MASTER_SET_PRICE;
  const body = [
    logo ? `<img class="logo" src="${logo}" style="width:30mm">` : "",
    `<div class="center bold feria">${escapeHtml(feria)}</div>`,
    `<div class="center bold lugar">${escapeHtml(lugar)}</div>`,
    `<div class="center bold info">${escapeHtml(empresa)}</div>`,
    `<div class="center bold info">${escapeHtml(cif)}</div>`,
    `<div class="center bold info">${escapeHtml(cp)}</div>`,
    `<div class="center cond fecha">${escapeHtml(fechaTicket)}</div>`,
    `<div class="bold masterlabel">MASTER SET</div>`,
    `<div class="bold modo">${escapeHtml(modoTicket)}</div>`,
    columnsHeader(),
    `<hr class="sep">`,
    rows.join(""),
    `<hr class="sep-total">`,
    `<div class="total-row cond"><span class="t-label">Total: ${totalItems}</span><span class="t-total">${escapeHtml(formatPrice(masterTotal, currencySymbol))}</span></div>`,
    `<hr class="sep">`,
    `<div class="center cond session">${escapeHtml(`${nombreMaquina} - Sesión: ${formatClientId(idCliente)}`)}</div>`,
    `<div class="center bold legal">${escapeHtml(l1)}</div>`,
    `<div class="center bold legal">${escapeHtml(l2)}</div>`,
    `<div class="center bold legal">${escapeHtml(l3)}</div>`
  ].join("\n");
  return ticketDocument("Master Set Ticket", heightMm, body);
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
function htmlBuffer(html) {
  return Buffer.from(html, "utf8");
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
function buildLabelCode(config, productoId, codigoFeria1Override, codigoFeria2Override) {
  const { codigo } = config;
  const cliente = formatCliente(codigo.cliente);
  const producto = formatProducto(productoId);
  const feria1 = codigoFeria1Override ?? codigo.codigo_feria_1 ?? "";
  const feria2 = codigoFeria2Override ?? codigo.codigo_feria_2 ?? "";
  if (feria1 || feria2) {
    const mes2 = formatMes(codigo.mes);
    return `${feria1}-${mes2}${feria2} ${cliente}-${producto}`;
  }
  const modo = codigo.modo;
  const mes = formatMes(codigo.mes);
  const pais = codigo.pais;
  const annio = formatAnnio(codigo.annio);
  const maquina = codigo.maquina;
  return `${modo}${mes}${pais}${annio} ${maquina}-${cliente}-${producto}`;
}
function buildLabelCodeCorreoEsp(config, productoId, codigoFeria1Override) {
  const { codigo } = config;
  const mes = formatMes(codigo.mes);
  const pais = codigo.pais;
  const annio = formatAnnio(codigo.annio);
  const feria1 = codigoFeria1Override ?? codigo.codigo_feria_1 ?? "";
  const cliente = formatCliente(codigo.cliente);
  const producto = formatProducto(productoId);
  return `P${mes}${pais}${annio} ${feria1}-${cliente}-${producto}`;
}
function buildTicketTitle(profile, baseTitle) {
  const profileLower = profile.toLowerCase();
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
function fileToDataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
function getModelBackground(modelName, stampsRepo) {
  if (!modelName) return null;
  const allStamps = stampsRepo.getAll();
  const match = allStamps.find(
    (s) => s.stampName.toLowerCase() === modelName.toLowerCase()
  );
  if (match && match.fondoPath) {
    return fileToDataUri(match.fondoPath);
  }
  const lowerName = modelName.toLowerCase();
  const partial = allStamps.find(
    (s) => s.stampName.toLowerCase().includes(lowerName)
  );
  if (partial && partial.fondoPath) {
    return fileToDataUri(partial.fondoPath);
  }
  return null;
}
function getModelLogoPng(modelName, stampsRepo, fallbackLogo) {
  console.log(`[getModelLogoPng] modelName="${modelName}", fallbackLogo length=${fallbackLogo?.length ?? 0}`);
  if (modelName) {
    const allStamps = stampsRepo.getAll();
    const match = allStamps.find(
      (s) => s.stampName.toLowerCase() === modelName.toLowerCase()
    );
    if (match && match.logoPath) {
      const dataUri = fileToDataUri(match.logoPath);
      if (dataUri) {
        console.log(`[getModelLogoPng] Found stamp "${match.stampName}", logo loaded`);
        return dataUri;
      }
    }
    const lowerName = modelName.toLowerCase();
    const partial = allStamps.find(
      (s) => s.stampName.toLowerCase().includes(lowerName)
    );
    if (partial && partial.logoPath) {
      const dataUri = fileToDataUri(partial.logoPath);
      if (dataUri) {
        console.log(`[getModelLogoPng] Partial match "${partial.stampName}", logo loaded`);
        return dataUri;
      }
    }
  }
  if (fallbackLogo) {
    console.log(`[getModelLogoPng] Returning fallback (length=${fallbackLogo.length})`);
    return fallbackLogo;
  }
  console.log(`[getModelLogoPng] Returning null — no logo found`);
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
async function generateSalePdfs(config, quantities, profile, _imagesRepo, imageLayerOptions, dynamicTariffCtx) {
  const stampsRepo = new StampsRepository();
  const pdfs = [];
  const notifications = [];
  let cutNumber;
  let formatoCorreoEsp = false;
  let rotate180 = false;
  try {
    const configRepo = new ConfigRepository();
    cutNumber = configRepo.getCutNumber();
    formatoCorreoEsp = configRepo.getFormatoCorreoEsp();
    rotate180 = configRepo.getPrintRotation();
  } catch {
    cutNumber = 4;
  }
  const stampHtmlOpts = { rotate180, formatoCorreoEsp };
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
  let codigoFeria1;
  let codigoFeria2;
  const profileLower = profile.toLowerCase();
  const isNoLogoMode = imageLayerOptions ? !imageLayerOptions.printLogoPng : false;
  if (profileLower === "filatelia" || isNoLogoMode) {
    codigoFeria1 = config.codigo.codigo_feria_1 ?? "";
    codigoFeria2 = config.codigo.codigo_feria_2 ?? "";
  } else if (dynamicTariffCtx) {
    codigoFeria1 = dynamicTariffCtx.eventCodigoFeria1 ?? "";
    codigoFeria2 = dynamicTariffCtx.eventCodigoFeria2 ?? "";
  } else {
    codigoFeria1 = void 0;
    codigoFeria2 = void 0;
  }
  const layoutModelo1 = dynamicTariffCtx?.eventLayoutModelo1 ?? "derecha";
  const layoutModelo2 = dynamicTariffCtx?.eventLayoutModelo2 ?? "derecha";
  const makeCode = (productoId) => formatoCorreoEsp ? buildLabelCodeCorreoEsp(config, productoId, codigoFeria1) : buildLabelCode(config, productoId, codigoFeria1, codigoFeria2);
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
      logoPng1 = getModelLogoPng(model1Name, stampsRepo, imageLayerOptions.selloImage);
      logoPng2 = getModelLogoPng(model2Name, stampsRepo, imageLayerOptions.selloImage);
    }
  } else {
    bg1 = getModelBackground(model1Name, stampsRepo);
    bg2 = getModelBackground(model2Name, stampsRepo);
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
            codigo: makeCode(productoCounter),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logoPng1,
            layout: layoutModelo1
          });
          productoCounter++;
        }
        const groups = groupLabels(stamps, cutNumber);
        for (const group of groups) {
          const html = renderStampsHtml(group, stampHtmlOpts);
          pdfs.push({
            buffer: htmlBuffer(html),
            contentType: "html",
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
            codigo: makeCode(productoCounter),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logoPng2,
            layout: layoutModelo2
          });
          productoCounter++;
        }
        const groups = groupLabels(stamps, cutNumber);
        for (const group of groups) {
          const html = renderStampsHtml(group, stampHtmlOpts);
          pdfs.push({
            buffer: htmlBuffer(html),
            contentType: "html",
            target: "printer2",
            pdfType: "stamp_simple",
            description: `${tariff.name} modelo2 x${group.length}`
          });
        }
      }
    }
    for (const strip of dynamicTariffCtx.strips ?? []) {
      const stripTariffs = strip.tariff_ids.map((tid) => dynamicTariffCtx.tariffs.find((t) => t.id === tid)).filter((t) => t != null);
      if (stripTariffs.length === 0) continue;
      for (const model of [1, 2]) {
        const qty = dynQty[`tariff_${strip.id}_s${model}`] ?? 0;
        if (qty <= 0) continue;
        const background = usesBlankBackground ? null : model === 1 ? bg1 : bg2;
        const overlay = usesBlankBackground ? null : model === 1 ? overlay1 : overlay2;
        const logo = model === 1 ? logoPng1 : logoPng2;
        const target = model === 1 ? "printer1" : "printer2";
        for (let i = 0; i < qty; i++) {
          const stripStamps = [];
          for (const stripTariff of stripTariffs) {
            stripStamps.push({
              tarifa: stripTariff.name,
              tarifaDescripcion: stripTariff.description,
              fecha: stampFecha,
              evento: stampEvento,
              codigo: makeCode(productoCounter),
              backgroundImage: background,
              overlayImage: overlay,
              printLogoPng,
              logoPngImage: logo,
              layout: model === 1 ? layoutModelo1 : layoutModelo2
            });
            productoCounter++;
          }
          const html = renderStampsHtml(stripStamps, stampHtmlOpts);
          pdfs.push({
            buffer: htmlBuffer(html),
            contentType: "html",
            target,
            pdfType: "stamp_tira",
            description: `Tira ${strip.name} modelo${model} unidad ${i + 1}/${qty} (${stripStamps.length} sellos)`
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
          const stripStamps = [];
          if (tariff.qtyKey.startsWith("tarifa4T")) {
            const tariffLabels = ["Tarifa AJ", "Tarifa A2J", "Tarifa BJ", "Tarifa CJ"];
            for (const tLabel of tariffLabels) {
              stripStamps.push({
                tarifa: tLabel,
                fecha: stampFecha,
                evento: stampEvento,
                codigo: makeCode(productoCounter),
                backgroundImage: background,
                overlayImage: overlay,
                printLogoPng,
                logoPngImage: logo,
                layout: tariff.model === 1 ? layoutModelo1 : layoutModelo2
              });
              productoCounter++;
            }
          } else {
            for (let j = 0; j < 4; j++) {
              stripStamps.push({
                tarifa: tariff.label,
                fecha: stampFecha,
                evento: stampEvento,
                codigo: makeCode(productoCounter),
                backgroundImage: background,
                overlayImage: overlay,
                printLogoPng,
                logoPngImage: logo,
                layout: tariff.model === 1 ? layoutModelo1 : layoutModelo2
              });
              productoCounter++;
            }
          }
          const html = renderStampsHtml(stripStamps, stampHtmlOpts);
          pdfs.push({
            buffer: htmlBuffer(html),
            contentType: "html",
            target: tariff.target,
            pdfType: "stamp_tira",
            description: `Tira ${tariff.label} modelo${tariff.model} unidad ${i + 1}/${qty} (${stripStamps.length} sellos)`
          });
        }
      } else {
        const stamps = [];
        for (let i = 0; i < qty; i++) {
          stamps.push({
            tarifa: tariff.label,
            fecha: stampFecha,
            evento: stampEvento,
            codigo: makeCode(productoCounter),
            backgroundImage: background,
            overlayImage: overlay,
            printLogoPng,
            logoPngImage: logo,
            layout: tariff.model === 1 ? layoutModelo1 : layoutModelo2
          });
          productoCounter++;
        }
        const groups = groupLabels(stamps, cutNumber);
        for (const group of groups) {
          const html = renderStampsHtml(group, stampHtmlOpts);
          pdfs.push({
            buffer: htmlBuffer(html),
            contentType: "html",
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
    await generateEspecialStrips(config, quantities, counterRef, pdfs, rotate180, formatoCorreoEsp);
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
    for (const strip of dynamicTariffCtx.strips ?? []) {
      const stripKey1 = `tariff_${strip.id}_s1`;
      const stripQty1 = dynQty[stripKey1] ?? 0;
      const stripProdId1 = `D${strip.id}S1`;
      items.push({ idProducto: stripProdId1, cantidad: stripQty1 });
      productos.push({ idProducto: stripProdId1, modo: "T", precio: strip.price, nombre_ticket: strip.name });
      const stripKey2 = `tariff_${strip.id}_s2`;
      const stripQty2 = dynQty[stripKey2] ?? 0;
      const stripProdId2 = `D${strip.id}S2`;
      items.push({ idProducto: stripProdId2, cantidad: stripQty2 });
      productos.push({ idProducto: stripProdId2, modo: "T", precio: strip.price, nombre_ticket: strip.name });
    }
  } else {
    const result = buildTicketData(quantities, config.precios);
    items = result.items;
    productos = result.productos;
  }
  const hasAnyItems = items.some((item) => item.cantidad > 0);
  if (hasAnyItems) {
    const fechaTicket = getTicketDateTime(config);
    const rawTitle = config.ticket.eltitulo || config.ticket.titulo;
    const baseTitle = isNoLogoMode ? `Filatelia de: ${rawTitle}` : buildTicketTitle(profile, rawTitle);
    const modoTicket = baseTitle;
    const modelo1Ticket = model1Name || "Modelo 1";
    const modelo2Ticket = model2Name || "Modelo 2";
    const baseFeria = dynamicTariffCtx ? dynamicTariffCtx.eventName || dynamicTariffCtx.title || config.ticket.feria : config.ticket.feria;
    const ticketFeria = formatoCorreoEsp ? `ESP ${baseFeria}` : baseFeria;
    const ticketLugar = dynamicTariffCtx ? dynamicTariffCtx.eventNlugar || config.ticket.lugar : config.ticket.lugar;
    if (imageLayerOptions?.useSecondaryPrice && dynamicTariffCtx) {
      for (const producto of productos) {
        const tariffId = parseInt(producto.idProducto.replace(/^D/, "").replace(/S[12]$/, ""), 10);
        const matchingTariff = dynamicTariffCtx.tariffs.find((t) => t.id === tariffId);
        if (matchingTariff && matchingTariff.secondaryPrice != null) {
          producto.precio = matchingTariff.secondaryPrice;
          continue;
        }
        const matchingStrip = dynamicTariffCtx.strips?.find((s) => s.id === tariffId);
        if (matchingStrip && matchingStrip.secondaryPrice != null) {
          producto.precio = matchingStrip.secondaryPrice;
        }
      }
    }
    const ticketMasterHeightMm = calcTicketMasterHeightMm(countActiveItems(items));
    const currencySymbol = imageLayerOptions?.useSecondaryPrice && dynamicTariffCtx?.complementaryCurrencySymbol ? dynamicTariffCtx.complementaryCurrencySymbol : dynamicTariffCtx?.currencySymbol ?? "€";
    const feria1ForTicket = codigoFeria1 ?? "";
    const feria2ForTicket = codigoFeria2 ?? "";
    let codigoTicket = "";
    if (feria1ForTicket || feria2ForTicket) {
      const cliente = formatCliente(config.codigo.cliente);
      codigoTicket = `${feria1ForTicket} ${cliente}`;
    }
    const mainTicketParams = {
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
      l3: config.ticket.l3,
      currencySymbol,
      codigoTicket
    };
    const ticketHeightMm = calcTicketHeightMm(countActiveItems(items));
    const ticketHtml = renderTicketHtml(mainTicketParams, formatoCorreoEsp);
    pdfs.push({
      buffer: htmlBuffer(ticketHtml),
      contentType: "html",
      target: "ticket",
      pdfType: "ticket",
      description: "Ticket principal",
      ticketHeightMm
    });
    const maquinaPrefix = config.codigo.maquina.substring(0, 2).toUpperCase();
    if (maquinaPrefix !== "MD" && maquinaPrefix !== "FI" && profile !== "filatelia" && !isNoLogoMode) {
      for (let idx = 0; idx < items.length; idx++) {
        if (items[idx].cantidad > 0 && productos[idx].modo === "T") {
          for (let t = 0; t < items[idx].cantidad; t++) {
            const singleTiraItems = items.map((item, i) => ({
              idProducto: item.idProducto,
              cantidad: i === idx ? 1 : 0
            }));
            const singleTiraParams = {
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
              l3: config.ticket.l3,
              currencySymbol,
              codigoTicket
            };
            const singleTiraHeightMm = calcTicketHeightMm(countActiveItems(singleTiraItems));
            const singleTiraHtml = renderTicketHtml(singleTiraParams, formatoCorreoEsp);
            pdfs.push({
              buffer: htmlBuffer(singleTiraHtml),
              contentType: "html",
              target: "ticket",
              pdfType: "ticket",
              description: `Ticket tira ${productos[idx].nombre_ticket} unidad ${t + 1}`,
              ticketHeightMm: singleTiraHeightMm
            });
          }
        }
      }
    }
    if (config.ticket.ImprimeCopiaTicket === "S") {
      const ticketCajaParams = {
        items,
        idCliente: config.codigo.cliente,
        nombreMaquina: config.codigo.maquina,
        productos,
        feria: ticketFeria,
        modoTicket: config.ticket.tituloCopia || "COPIA Factura Simplificada",
        modelo1Ticket,
        modelo2Ticket,
        currencySymbol
      };
      const ticketCajaHeightMm = calcTicketCajaHeightMm(countActiveItems(items));
      const ticketCajaHtml = renderTicketCajaHtml(ticketCajaParams);
      pdfs.push({
        buffer: htmlBuffer(ticketCajaHtml),
        contentType: "html",
        target: "ticket",
        pdfType: "ticket_caja",
        description: "Ticket copia (caja)",
        ticketHeightMm: ticketCajaHeightMm
      });
    }
    if (config.ticket.ImprimeMasterTicket === "S") {
      const ticketMasterHtml = renderTicketMasterHtml({
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
        l3: config.ticket.l3,
        currencySymbol
      });
      pdfs.push({
        buffer: htmlBuffer(ticketMasterHtml),
        contentType: "html",
        target: "ticket",
        pdfType: "ticket_master",
        description: "Ticket master set",
        ticketHeightMm: ticketMasterHeightMm
      });
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
async function generateEspecialStrips(config, quantities, counterRef, pdfs, rotate180 = false, formatoCorreoEsp = false) {
  const { ticket } = config;
  const makeCode = (productoId) => formatoCorreoEsp ? buildLabelCodeCorreoEsp(config, productoId) : buildLabelCode(config, productoId);
  const hasTiras1 = quantities.tarifaAT1 > 0 || quantities.tarifa4T1 > 0;
  const hasTiras2 = quantities.tarifaAT2 > 0 || quantities.tarifa4T2 > 0;
  if (ticket.TEmod1 === "S" && hasTiras1) {
    const especialPrices = [ticket.T1especial, ticket.T2especial, ticket.T3especial];
    for (let idx = 0; idx < especialPrices.length; idx++) {
      const price = especialPrices[idx];
      if (price && price > 0) {
        const codigos = [
          makeCode(counterRef.value++),
          makeCode(counterRef.value++),
          makeCode(counterRef.value++),
          makeCode(counterRef.value++)
        ];
        const tarifa = `Tarifa A${idx + 1 > 1 ? idx + 1 : ""}`;
        const html = renderEspecialStripHtml({ codigos, especial: "  -E", tarifa }, { rotate180 });
        pdfs.push({
          buffer: htmlBuffer(html),
          contentType: "html",
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
          makeCode(counterRef.value++),
          makeCode(counterRef.value++),
          makeCode(counterRef.value++),
          makeCode(counterRef.value++)
        ];
        const tarifa = `Tarifa A${idx + 1 > 1 ? idx + 1 : ""}`;
        const html = renderEspecialStripHtml({ codigos, especial: "  -E", tarifa }, { rotate180 });
        pdfs.push({
          buffer: htmlBuffer(html),
          contentType: "html",
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
      const effectiveProfile = typedImageFlags && !typedImageFlags.printLogoPng ? "Oficina" : typedProfile;
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
                eventNlugar: evento?.nlugar,
                // Event lugar for ticket header
                eventFecha: evento?.fecha,
                // Add event date for stamp labels
                eventLocalidad: evento?.localidad,
                // Add event locality for stamp labels
                eventCodigoFeria1: evento?.codigo_feria_1,
                // Fair code part 1 for stamp labels
                eventCodigoFeria2: evento?.codigo_feria_2,
                // Fair code part 2 for stamp labels
                eventLayoutModelo1: evento?.layout_modelo1,
                // Layout template for modelo1
                eventLayoutModelo2: evento?.layout_modelo2,
                // Layout template for modelo2
                currency: group.local_currency,
                currencySymbol: getCurrencySymbol(group.local_currency),
                // Add currency symbol
                complementaryCurrencySymbol: getCurrencySymbol(group.complementary_currency),
                // Complementary currency symbol
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
      const result = executeSale(typedConfig, typedQuantities, effectiveProfile, void 0, tariffGroupCtx);
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
        const stampsRepo = new StampsRepository();
        const imagenesConfig = configRepo.getImagenes();
        let fondoImage = null;
        let selloImage = null;
        if (imagenesConfig.activeFair) {
          const { year, fairName } = imagenesConfig.activeFair;
          const allStamps = stampsRepo.getAll();
          const match = allStamps.find(
            (s) => s.year === year && s.stampName.toLowerCase() === fairName.toLowerCase()
          );
          if (match) {
            const { readFileSync, existsSync } = require("fs");
            const { extname } = require("path");
            if (match.fondoPath && existsSync(match.fondoPath)) {
              const buf = readFileSync(match.fondoPath);
              const ext = extname(match.fondoPath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : "image/jpeg";
              fondoImage = `data:${mime};base64,${buf.toString("base64")}`;
            }
            if (match.logoPath && existsSync(match.logoPath)) {
              const buf = readFileSync(match.logoPath);
              const ext = extname(match.logoPath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : "image/jpeg";
              selloImage = `data:${mime};base64,${buf.toString("base64")}`;
            }
          }
          console.log(`[Sale:LogoPng] activeFair: ${year}/${fairName}, fondoImage: ${!!fondoImage}, selloImage length: ${selloImage?.length ?? 0}`);
        } else {
          console.log("[Sale:LogoPng] WARNING: No activeFair configured — attempting to load sello from first synced stamp");
          if (typedImageFlags.printLogoPng) {
            const allStamps = stampsRepo.getAll();
            if (allStamps.length > 0) {
              const first = allStamps[0];
              if (first.logoPath) {
                const { readFileSync, existsSync } = require("fs");
                const { extname } = require("path");
                if (existsSync(first.logoPath)) {
                  const buf = readFileSync(first.logoPath);
                  const ext = extname(first.logoPath).toLowerCase();
                  const mime = ext === ".png" ? "image/png" : "image/jpeg";
                  selloImage = `data:${mime};base64,${buf.toString("base64")}`;
                  console.log(`[Sale:LogoPng] Loaded sello from first stamp: ${first.stampName}, selloImage length: ${selloImage?.length ?? 0}`);
                }
              }
            }
          }
        }
        console.log(`[Sale:LogoPng] imageFlags: printLogoPng=${typedImageFlags.printLogoPng}, printSello=${typedImageFlags.printSello}, printFondo=${typedImageFlags.printFondo}`);
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
          effectiveProfile,
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
const DEFAULT_USER_CONFIG = {
  version: 1,
  user: {
    id: "local",
    username: "local",
    displayName: "Usuario"
  },
  app: {
    welcomeMessage: "Bienvenido"
  },
  license: {},
  database: {}
};
let userConfig = { ...DEFAULT_USER_CONFIG };
function loadUserConfig() {
  const { path: configPath, shouldCopy } = findConfigPath();
  if (!configPath) {
    console.log("[user-config] No config.json found. Using default configuration.");
    userConfig = { ...DEFAULT_USER_CONFIG };
    return userConfig;
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    userConfig = {
      version: parsed.version ?? DEFAULT_USER_CONFIG.version,
      user: {
        ...DEFAULT_USER_CONFIG.user,
        ...parsed.user
      },
      app: {
        ...DEFAULT_USER_CONFIG.app,
        ...parsed.app
      },
      license: parsed.license ?? {},
      database: parsed.database ?? {}
    };
    console.log(`[user-config] Loaded config.json from: ${configPath}`);
    console.log(`[user-config] User: ${userConfig.user.displayName} (${userConfig.user.username})`);
    if (shouldCopy && electron.app.isPackaged) {
      copyToUserData(raw);
    }
    return userConfig;
  } catch (err) {
    console.error("[user-config] Failed to parse config.json:", err);
    userConfig = { ...DEFAULT_USER_CONFIG };
    return userConfig;
  }
}
function getUserConfig() {
  return userConfig;
}
function findConfigPath() {
  if (electron.app.isPackaged) {
    const userDataPath = path.join(electron.app.getPath("userData"), "config.json");
    const externalPath = findExternalConfig();
    if (externalPath && fs.existsSync(userDataPath)) {
      const { statSync } = require("fs");
      try {
        const externalMtime = statSync(externalPath).mtimeMs;
        const userDataMtime = statSync(userDataPath).mtimeMs;
        if (externalMtime > userDataMtime) {
          return { path: externalPath, shouldCopy: true };
        }
      } catch {
        return { path: externalPath, shouldCopy: true };
      }
      return { path: userDataPath, shouldCopy: false };
    }
    if (externalPath) {
      return { path: externalPath, shouldCopy: true };
    }
    if (fs.existsSync(userDataPath)) {
      return { path: userDataPath, shouldCopy: false };
    }
  } else {
    const devPath = path.join(electron.app.getAppPath(), "config.json");
    if (fs.existsSync(devPath)) {
      return { path: devPath, shouldCopy: false };
    }
  }
  return { path: null, shouldCopy: false };
}
function findExternalConfig() {
  const candidates = [];
  candidates.push(path.join(path.dirname(electron.app.getPath("exe")), "config.json"));
  try {
    candidates.push(path.join(electron.app.getPath("downloads"), "config.json"));
  } catch {
  }
  try {
    candidates.push(path.join(electron.app.getPath("desktop"), "config.json"));
  } catch {
  }
  try {
    candidates.push(path.join(electron.app.getPath("documents"), "config.json"));
  } catch {
  }
  try {
    candidates.push(path.join(electron.app.getPath("home"), "config.json"));
    candidates.push(path.join(electron.app.getPath("home"), "Downloads", "config.json"));
    candidates.push(path.join(electron.app.getPath("home"), "Descargas", "config.json"));
  } catch {
  }
  const drives = ["C:", "D:", "E:", "F:"];
  for (const drive of drives) {
    candidates.push(path.join(drive, "Downloads", "config.json"));
    candidates.push(path.join(drive, "Descargas", "config.json"));
  }
  candidates.push(path.join(process.resourcesPath, "config.json"));
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
    }
  }
  return null;
}
function copyToUserData(content) {
  try {
    const userDataDir = electron.app.getPath("userData");
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    const destPath = path.join(userDataDir, "config.json");
    fs.writeFileSync(destPath, content, "utf-8");
    console.log(`[user-config] Copied config.json to userData: ${destPath}`);
  } catch (err) {
    console.error("[user-config] Failed to copy config.json to userData:", err);
  }
}
function registerUserConfigHandlers() {
  handleIpc("userConfig:get", () => {
    return getUserConfig();
  });
}
let cachedMachineId = null;
function getMachineId() {
  if (!cachedMachineId) {
    cachedMachineId = nodeMachineId.machineIdSync({ original: false });
  }
  return cachedMachineId;
}
const API_BASE$1 = "https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api";
let licenseStatus = { ok: false, error: "No validado aún" };
let authToken = null;
function setAuthToken(token) {
  authToken = token;
}
async function activateLicense() {
  const config = getUserConfig();
  const machineId = getMachineId();
  const apiKey = authToken || config.license?.apiKey || "";
  if (!apiKey) {
    const ticket = loadActivationTicket();
    if (ticket && ticket.machineId === machineId) {
      const EXPIRY_DAYS = 14;
      const lastValidated = new Date(ticket.lastValidatedAt || ticket.activatedAt).getTime();
      const now = Date.now();
      const daysSinceValidation = (now - lastValidated) / (1e3 * 60 * 60 * 24);
      if (daysSinceValidation > EXPIRY_DAYS) {
        licenseStatus = {
          ok: false,
          error: `Licencia caducada. Han pasado más de ${EXPIRY_DAYS} días sin validar. Restaura el archivo config.json y conéctate a internet.`
        };
        return licenseStatus;
      }
      licenseStatus = { ok: true, message: "Licencia activa (ticket local)", isAdmin: ticket.isAdmin };
      return licenseStatus;
    }
    licenseStatus = { ok: false, error: "No se encontró configuración de licencia. Reinstala la aplicación con el archivo config.json." };
    return licenseStatus;
  }
  try {
    const result = await httpPost$1(`${API_BASE$1}/activate`, {
      machineId,
      apiKey
    });
    if (result.ok) {
      saveActivationTicket({
        machineId,
        username: config.user?.username || "unknown",
        activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastValidatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        isAdmin: result.isAdmin || false
      });
      licenseStatus = result;
    } else {
      removeActivationTicket();
      licenseStatus = result;
    }
    return licenseStatus;
  } catch (err) {
    console.error("[license] Activation failed (network error):", err);
    const ticket = loadActivationTicket();
    if (ticket && ticket.machineId === machineId) {
      const EXPIRY_DAYS = 14;
      const lastValidated = new Date(ticket.lastValidatedAt || ticket.activatedAt).getTime();
      const now = Date.now();
      const daysSinceValidation = (now - lastValidated) / (1e3 * 60 * 60 * 24);
      if (daysSinceValidation > EXPIRY_DAYS) {
        licenseStatus = {
          ok: false,
          error: `Licencia caducada. Han pasado más de ${EXPIRY_DAYS} días sin conexión. Conéctate a internet y reinicia la aplicación.`
        };
        console.log(`[license] Offline mode: ticket expired (${Math.floor(daysSinceValidation)} days since last validation)`);
      } else {
        licenseStatus = {
          ok: true,
          message: `Licencia activa (modo offline, ${Math.floor(EXPIRY_DAYS - daysSinceValidation)} días restantes)`,
          isAdmin: ticket.isAdmin
        };
        console.log(`[license] Offline mode: valid ticket, ${Math.floor(EXPIRY_DAYS - daysSinceValidation)} days remaining`);
      }
    } else {
      licenseStatus = {
        ok: false,
        error: "Se requiere conexión a internet para activar la licencia por primera vez."
      };
      console.log("[license] Offline mode: no valid ticket, blocking");
    }
    return licenseStatus;
  }
}
async function deactivateLicense() {
  const config = getUserConfig();
  const machineId = getMachineId();
  const apiKey = authToken || config.license?.apiKey || "";
  if (!apiKey) {
    return { ok: false, error: "No hay apiKey configurada" };
  }
  try {
    const result = await httpPost$1(`${API_BASE$1}/deactivate`, {
      machineId,
      apiKey
    });
    if (result.ok) {
      removeActivationTicket();
      licenseStatus = { ok: false, error: "Equipo desactivado" };
    }
    return result;
  } catch (err) {
    console.error("[license] Deactivation failed:", err);
    return { ok: false, error: "Error de conexión. Se necesita internet para desactivar." };
  }
}
function getLicenseStatus() {
  return licenseStatus;
}
const _S1 = "SvvS";
const _S2 = "K10sk0";
const _S3 = "!L1c#";
const _S4 = "2026xQ9";
const TICKET_SECRET = [_S1, _S2, _S3, _S4].join("-");
function computeSignature(ticket) {
  const payload = JSON.stringify(ticket);
  return crypto.createHmac("sha256", TICKET_SECRET).update(payload).digest("hex");
}
function getTicketPath() {
  return path.join(electron.app.getPath("userData"), ".license-ticket");
}
function saveActivationTicket(ticket) {
  try {
    const dir = electron.app.getPath("userData");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const signed = {
      data: ticket,
      signature: computeSignature(ticket)
    };
    fs.writeFileSync(getTicketPath(), JSON.stringify(signed), "utf-8");
    console.log("[license] Activation ticket saved (signed)");
  } catch (err) {
    console.error("[license] Failed to save activation ticket:", err);
  }
}
function loadActivationTicket() {
  try {
    const path2 = getTicketPath();
    if (!fs.existsSync(path2)) {
      return null;
    }
    const raw = fs.readFileSync(path2, "utf-8");
    const signed = JSON.parse(raw);
    if (!signed.data || !signed.signature) {
      console.warn("[license] Ticket has invalid structure");
      return null;
    }
    const expectedSignature = computeSignature(signed.data);
    if (signed.signature !== expectedSignature) {
      console.warn("[license] Ticket signature mismatch — file has been tampered with");
      return null;
    }
    return signed.data;
  } catch {
    return null;
  }
}
function removeActivationTicket() {
  try {
    const path2 = getTicketPath();
    if (fs.existsSync(path2)) {
      fs.unlinkSync(path2);
      console.log("[license] Activation ticket removed");
    }
  } catch (err) {
    console.error("[license] Failed to remove activation ticket:", err);
  }
}
function httpPost$1(url$1, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const parsedUrl = new url.URL(url$1);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr)
      }
    };
    const req = https__namespace.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk.toString();
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch {
          reject(new Error(`Invalid response: ${responseData}`));
        }
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}
function registerLicenseHandlers() {
  handleIpc("license:activate", async () => {
    return await activateLicense();
  });
  handleIpc("license:deactivate", async () => {
    return await deactivateLicense();
  });
  handleIpc("license:status", () => {
    return getLicenseStatus();
  });
  handleIpc("license:machineId", () => {
    return getMachineId();
  });
}
class AppStateRepository {
  db;
  constructor(db2) {
    this.db = db2 ?? getDatabase();
  }
  /**
   * Returns the value for a given key, or null if not found.
   */
  get(key) {
    const row = this.db.prepare("SELECT value FROM app_state WHERE key = ?").get(key);
    return row?.value ?? null;
  }
  /**
   * Inserts or replaces a key-value pair.
   */
  set(key, value) {
    this.db.prepare(
      `INSERT OR REPLACE INTO app_state (key, value, updated_at)
         VALUES (?, ?, datetime('now'))`
    ).run(key, value);
  }
  /**
   * Deletes a key from the app_state table.
   */
  delete(key) {
    this.db.prepare("DELETE FROM app_state WHERE key = ?").run(key);
  }
  /**
   * Returns true if the 'blocked' key has value 'true'.
   */
  isBlocked() {
    return this.get("blocked") === "true";
  }
  /**
   * Sets or clears the blocked state.
   * When blocking, also stores related metadata (machineId, apiKey).
   * When unblocking, removes metadata keys.
   */
  setBlocked(blocked, details) {
    if (blocked) {
      this.set("blocked", "true");
      if (details) {
        this.set("blocked_machine_id", details.machineId);
        this.set("blocked_api_key", details.apiKey);
      }
    } else {
      this.set("blocked", "false");
      this.delete("blocked_machine_id");
      this.delete("blocked_api_key");
    }
  }
}
const API_URL = "https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api/stamps/sync";
async function syncStamps() {
  const config = getUserConfig();
  const apiKey = config.license?.apiKey || "";
  const machineId = getMachineId();
  if (!apiKey) {
    return { ok: false, added: 0, removed: 0, total: 0, error: "No se encontró apiKey en la configuración" };
  }
  let response;
  try {
    response = await httpPost(API_URL, { apiKey, machineId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de conexión";
    return { ok: false, added: 0, removed: 0, total: 0, error: message };
  }
  if (!response.ok && response.error === "AUTH_FAILED") {
    console.error("[stamp-sync] AUTH_FAILED:", response.reason);
    blockApplication(apiKey, machineId);
    return { ok: false, added: 0, removed: 0, total: 0, error: "AUTH_FAILED", blocked: true };
  }
  if (!response.ok) {
    return { ok: false, added: 0, removed: 0, total: 0, error: response.error || "Error desconocido del servidor" };
  }
  const catalog = response.catalog || [];
  const stampsRepo = new StampsRepository();
  const stampsDir = path.join(electron.app.getPath("userData"), "stamps");
  if (!fs.existsSync(stampsDir)) {
    fs.mkdirSync(stampsDir, { recursive: true });
  }
  const localStamps = stampsRepo.getAll();
  const localStampIds = new Set(localStamps.map((s) => s.stampId));
  const remoteStampIds = new Set(catalog.map((c) => c.stampId));
  const newItems = catalog.filter((c) => !localStampIds.has(c.stampId));
  const removedItems = localStamps.filter((s) => !remoteStampIds.has(s.stampId));
  for (const item of newItems) {
    const stampDir = path.join(stampsDir, item.year, item.stampName);
    if (!fs.existsSync(stampDir)) {
      fs.mkdirSync(stampDir, { recursive: true });
    }
    const fondoPath = path.join(stampDir, `${item.stampName}-fondo.jpg`);
    const logoPath = path.join(stampDir, `${item.stampName}-sello.png`);
    try {
      await downloadFile(item.fondoUrl, fondoPath);
      await downloadFile(item.logoUrl, logoPath);
    } catch (err) {
      console.error(`[stamp-sync] Error downloading images for ${item.stampId}:`, err);
      try {
        if (fs.existsSync(stampDir)) {
          fs.rmSync(stampDir, { recursive: true, force: true });
        }
      } catch {
      }
      return {
        ok: false,
        added: 0,
        removed: 0,
        total: localStamps.length,
        error: `Error descargando imágenes para "${item.stampName}": ${err instanceof Error ? err.message : "Error desconocido"}`
      };
    }
  }
  for (const removed2 of removedItems) {
    const stampDir = path.join(stampsDir, removed2.year, removed2.stampName);
    try {
      if (fs.existsSync(stampDir)) {
        fs.rmSync(stampDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[stamp-sync] Error removing stamp folder ${removed2.stampId}:`, err);
    }
    stampsRepo.remove(removed2.stampId);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const item of catalog) {
    const stampDir = path.join(stampsDir, item.year, item.stampName);
    const fondoPath = path.join(stampDir, `${item.stampName}-fondo.jpg`);
    const logoPath = path.join(stampDir, `${item.stampName}-sello.png`);
    stampsRepo.upsert({
      stampId: item.stampId,
      year: item.year,
      stampName: item.stampName,
      fondoPath,
      logoPath,
      status: item.status,
      syncedAt: now
    });
  }
  const total = catalog.length;
  const added = newItems.length;
  const removed = removedItems.length;
  console.log(`[stamp-sync] Sync complete: ${added} added, ${removed} removed, ${total} total`);
  return { ok: true, added, removed, total };
}
function blockApplication(apiKey, machineId) {
  console.error(`[stamp-sync] BLOCKING APPLICATION — apiKey: ${apiKey.slice(0, 8)}..., machineId: ${machineId.slice(0, 8)}...`);
  const stampsRepo = new StampsRepository();
  stampsRepo.clear();
  const stampsDir = path.join(electron.app.getPath("userData"), "stamps");
  try {
    if (fs.existsSync(stampsDir)) {
      fs.rmSync(stampsDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("[stamp-sync] Error removing stamps folder:", err);
  }
  const ticketPath = path.join(electron.app.getPath("userData"), ".license-ticket");
  try {
    if (fs.existsSync(ticketPath)) {
      fs.unlinkSync(ticketPath);
    }
  } catch (err) {
    console.error("[stamp-sync] Error removing license ticket:", err);
  }
  const appStateRepo = new AppStateRepository();
  appStateRepo.setBlocked(true, { machineId, apiKey });
  appStateRepo.set("blocked_at", (/* @__PURE__ */ new Date()).toISOString());
}
function httpPost(url$1, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const parsedUrl = new url.URL(url$1);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr)
      }
    };
    const req = https__namespace.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk.toString();
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch {
          reject(new Error(`Respuesta inválida del servidor: ${responseData.slice(0, 200)}`));
        }
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}
function downloadFile(url$1, destPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(url$1);
    const originEnd = url$1.indexOf("/", url$1.indexOf("://") + 3);
    const rawPathAndSearch = originEnd !== -1 ? url$1.slice(originEnd) : parsedUrl.pathname + parsedUrl.search;
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: rawPathAndSearch,
      method: "GET"
    };
    const req = https__namespace.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} descargando ${parsedUrl.pathname}`));
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
      fileStream.on("error", (err) => {
        fileStream.close();
        reject(err);
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.end();
  });
}
const API_BASE = "https://md6oe7qpfk.execute-api.eu-west-1.amazonaws.com/prod/api";
const UPLOAD_URL_ENDPOINT = `${API_BASE}/stamps/upload-url`;
const DELETE_ENDPOINT = `${API_BASE}/stamps/delete`;
const MIN_BYTES = 3 * 1024;
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;
const FONDO_SUFFIX$1 = "-fondo.jpg";
const SELLO_SUFFIX$1 = "-sello.png";
function validateYear(year) {
  if (!/^\d{4}$/.test(year)) return "El año debe ser un número de 4 dígitos";
  const n = Number(year);
  if (n < MIN_YEAR || n > MAX_YEAR) {
    return `El año debe estar entre ${MIN_YEAR} y ${MAX_YEAR}`;
  }
  return null;
}
function validateStampName(stampName) {
  if (!stampName || !stampName.trim()) return "El nombre del sello es obligatorio";
  if (/[\\/]/.test(stampName)) return "El nombre del sello no puede contener / ni \\";
  return null;
}
function validateUploadFiles(fondoPath, logoPath) {
  const fondoName = path.basename(fondoPath).toLowerCase();
  const logoName = path.basename(logoPath).toLowerCase();
  if (!fondoName.endsWith(FONDO_SUFFIX$1)) {
    return `El archivo de fondo debe terminar en "${FONDO_SUFFIX$1}"`;
  }
  if (!logoName.endsWith(SELLO_SUFFIX$1)) {
    return `El archivo de sello debe terminar en "${SELLO_SUFFIX$1}"`;
  }
  for (const [label, p] of [["fondo", fondoPath], ["sello", logoPath]]) {
    let size;
    try {
      size = fs.statSync(p).size;
    } catch {
      return `No se pudo leer el archivo de ${label}`;
    }
    if (size < MIN_BYTES) {
      return `El archivo de ${label} es demasiado pequeño (mínimo 3 KB)`;
    }
    if (size > MAX_BYTES) {
      return `El archivo de ${label} supera el máximo de 2 MB`;
    }
  }
  return null;
}
async function uploadStamp(input) {
  const { year, stampName, fondoPath, logoPath } = input;
  const yearErr = validateYear(year);
  if (yearErr) return { ok: false, error: yearErr };
  const nameErr = validateStampName(stampName);
  if (nameErr) return { ok: false, error: nameErr };
  const filesErr = validateUploadFiles(fondoPath, logoPath);
  if (filesErr) return { ok: false, error: filesErr };
  const config = getUserConfig();
  const apiKey = config.license?.apiKey || "";
  const machineId = getMachineId();
  if (!apiKey) {
    return { ok: false, error: "No se encontró apiKey en la configuración" };
  }
  try {
    await uploadOneFile(apiKey, machineId, year, stampName, "fondo", fondoPath);
    await uploadOneFile(apiKey, machineId, year, stampName, "sello", logoPath);
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "AUTH_FAILED", blocked: true };
    }
    const message = err instanceof Error ? err.message : "Error subiendo el sello";
    return { ok: false, error: message };
  }
  return { ok: true };
}
async function deleteStamp(input) {
  const { year, stampName } = input;
  const yearErr = validateYear(year);
  if (yearErr) return { ok: false, error: yearErr };
  const nameErr = validateStampName(stampName);
  if (nameErr) return { ok: false, error: nameErr };
  const config = getUserConfig();
  const apiKey = config.license?.apiKey || "";
  const machineId = getMachineId();
  if (!apiKey) {
    return { ok: false, error: "No se encontró apiKey en la configuración" };
  }
  let response;
  try {
    response = await httpPostJson(DELETE_ENDPOINT, {
      apiKey,
      machineId,
      year,
      stampName
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de conexión";
    return { ok: false, error: message };
  }
  if (!response.ok && response.error === "AUTH_FAILED") {
    return { ok: false, error: "AUTH_FAILED", blocked: true };
  }
  if (!response.ok) {
    return { ok: false, error: response.error || "Error desconocido del servidor" };
  }
  return { ok: true, deleted: response.deleted ?? 0 };
}
class AuthError extends Error {
}
async function uploadOneFile(apiKey, machineId, year, stampName, fileType, filePath) {
  const presignedResp = await httpPostJson(UPLOAD_URL_ENDPOINT, {
    apiKey,
    machineId,
    year,
    stampName,
    fileType
  });
  if (!presignedResp.ok && presignedResp.error === "AUTH_FAILED") {
    throw new AuthError("AUTH_FAILED");
  }
  if (!presignedResp.ok || !presignedResp.upload) {
    throw new Error(presignedResp.reason || presignedResp.error || "No se pudo obtener la URL de subida");
  }
  const contentType = fileType === "fondo" ? "image/jpeg" : "image/png";
  const fileBuffer = fs.readFileSync(filePath);
  await postMultipartToS3(presignedResp.upload, fileBuffer, path.basename(filePath), contentType);
}
function httpPostJson(url$1, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const parsedUrl = new url.URL(url$1);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr)
      }
    };
    const req = https__namespace.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk.toString();
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          reject(new Error(`Respuesta inválida del servidor: ${responseData.slice(0, 200)}`));
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}
function postMultipartToS3(presigned, fileBuffer, fileName, contentType) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(presigned.url);
    const boundary = `----svvsFormBoundary${Date.now().toString(16)}`;
    const parts = [];
    for (const [name, value] of Object.entries(presigned.fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r
Content-Disposition: form-data; name="${name}"\r
\r
${value}\r
`
        )
      );
    }
    parts.push(
      Buffer.from(
        `--${boundary}\r
Content-Disposition: form-data; name="file"; filename="${fileName}"\r
Content-Type: ${contentType}\r
\r
`
      )
    );
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r
--${boundary}--\r
`));
    const requestBody = Buffer.concat(parts);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": requestBody.length
      }
    };
    const req = https__namespace.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk.toString();
      });
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(
            new Error(
              `S3 rechazó la subida (HTTP ${res.statusCode}). ${responseData.slice(0, 200)}`
            )
          );
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.write(requestBody);
    req.end();
  });
}
const FONDO_SUFFIX = "-fondo.jpg";
const SELLO_SUFFIX = "-sello.png";
function registerStampsHandlers() {
  handleIpc("stamps:sync", async () => {
    return await syncStamps();
  });
  handleIpc("stamps:getAll", () => {
    const repo = new StampsRepository();
    return repo.getAll();
  });
  handleIpc("stamps:getStatus", () => {
    const stampsRepo = new StampsRepository();
    const appStateRepo = new AppStateRepository();
    const stamps = stampsRepo.getAll();
    const lastSync = stamps.length > 0 ? stamps[0].syncedAt : null;
    return {
      totalStamps: stamps.length,
      lastSyncAt: lastSync,
      isBlocked: appStateRepo.isBlocked()
    };
  });
  handleIpc("stamps:pickFiles", async () => {
    const win = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0];
    const result = win ? await electron.dialog.showOpenDialog(win, {
      title: "Seleccione el fondo (-fondo.jpg) y el sello (-sello.png)",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Imágenes de sello", extensions: ["jpg", "png"] }]
    }) : await electron.dialog.showOpenDialog({
      title: "Seleccione el fondo (-fondo.jpg) y el sello (-sello.png)",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Imágenes de sello", extensions: ["jpg", "png"] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { fondoPath: null, logoPath: null };
    }
    if (result.filePaths.length !== 2) {
      return {
        fondoPath: null,
        logoPath: null,
        error: "Debe seleccionar exactamente 2 archivos: uno -fondo.jpg y otro -sello.png"
      };
    }
    let fondoPath = null;
    let logoPath = null;
    for (const p of result.filePaths) {
      const name = path.basename(p).toLowerCase();
      if (name.endsWith(FONDO_SUFFIX)) fondoPath = p;
      else if (name.endsWith(SELLO_SUFFIX)) logoPath = p;
    }
    if (!fondoPath || !logoPath) {
      return {
        fondoPath: null,
        logoPath: null,
        error: 'Los archivos deben ser uno "-fondo.jpg" y otro "-sello.png"'
      };
    }
    return { fondoPath, logoPath };
  });
  handleIpc("stamps:existsInYear", (...args) => {
    const { year, stampName } = args[0];
    const repo = new StampsRepository();
    const stampId = `${year}#${stampName}`;
    return repo.getByYear(year).some((s) => s.stampId === stampId);
  });
  handleIpc("stamps:upload", async (...args) => {
    return await uploadStamp(args[0]);
  });
  handleIpc("stamps:delete", async (...args) => {
    return await deleteStamp(args[0]);
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
  registerUserConfigHandlers();
  registerLicenseHandlers();
  registerStampsHandlers();
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
const MAX_LOG_BYTES = 5 * 1024 * 1024;
let stream = null;
let logFilePath = "";
let installed = false;
function getLogFilePath() {
  return logFilePath;
}
function formatArg(arg) {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.message}
${arg.stack ?? ""}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}
function timestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function initFileLogger() {
  if (installed) return;
  installed = true;
  try {
    const logsDir = path.join(electron.app.getPath("userData"), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    logFilePath = path.join(logsDir, "main.log");
    try {
      if (fs.existsSync(logFilePath) && fs.statSync(logFilePath).size > MAX_LOG_BYTES) {
        fs.renameSync(logFilePath, path.join(logsDir, "main.prev.log"));
      }
    } catch {
    }
    stream = fs.createWriteStream(logFilePath, { flags: "a" });
    stream.on("error", () => {
      stream = null;
    });
    const write = (level, args) => {
      if (!stream) return;
      try {
        stream.write(`[${timestamp()}] [${level}] ${args.map(formatArg).join(" ")}
`);
      } catch {
      }
    };
    const original = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    };
    console.log = (...args) => {
      original.log(...args);
      write("INFO", args);
    };
    console.info = (...args) => {
      original.info(...args);
      write("INFO", args);
    };
    console.warn = (...args) => {
      original.warn(...args);
      write("WARN", args);
    };
    console.error = (...args) => {
      original.error(...args);
      write("ERROR", args);
    };
    process.on("uncaughtException", (err) => {
      write("FATAL", ["uncaughtException:", err]);
    });
    process.on("unhandledRejection", (reason) => {
      write("FATAL", ["unhandledRejection:", reason]);
    });
    console.log(
      `[Logger] File logging started — version=${electron.app.getVersion()} packaged=${electron.app.isPackaged} log=${logFilePath}`
    );
  } catch {
    stream = null;
  }
}
electron.app.commandLine.appendSwitch("disable-features", "InputPaneOnScreenKeyboard");
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
electron.app.whenReady().then(async () => {
  utils.electronApp.setAppUserModelId("com.stamp-sales");
  initFileLogger();
  const userConfig2 = loadUserConfig();
  if (userConfig2.license && userConfig2.license.apiKey) {
    setAuthToken(userConfig2.license.apiKey);
  }
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
  const appStateRepo = new AppStateRepository();
  if (appStateRepo.isBlocked()) {
    const blockedMachineId = getMachineId();
    console.error(`[startup] Application is BLOCKED. MachineId: ${blockedMachineId}`);
    registerAllHandlers();
    createWindow();
    const win = electron.BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.on("did-finish-load", () => {
        win.webContents.send("app:blocked", { machineId: blockedMachineId });
      });
    }
    electron.app.on("activate", function() {
      if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    return;
  }
  try {
    registerAllHandlers();
  } catch (err) {
    console.error("[FATAL] Failed to register IPC handlers:", err);
  }
  try {
    initServices();
    console.log(`[startup] Services initialised. Log file: ${getLogFilePath()}`);
  } catch (err) {
    console.error("[FATAL] Failed to initialize services:", err);
  }
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  const licenseResult = await activateLicense();
  console.log(`[license] Activation result: ${licenseResult.ok ? "OK" : "DENIED"} - ${licenseResult.message || licenseResult.error || ""}`);
  createWindow();
  if (!licenseResult.ok) {
    const { BrowserWindow: BW } = await import("electron");
    const win = BW.getAllWindows()[0];
    if (win) {
      win.webContents.on("did-finish-load", () => {
        win.webContents.send("license:blocked", licenseResult.error || "Licencia no válida");
      });
    }
  }
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
