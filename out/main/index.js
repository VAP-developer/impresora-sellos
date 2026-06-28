"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const Database = require("better-sqlite3");
const fs = require("fs");
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
function registerImagesHandlers() {
  const repo = new ImagesRepository();
  handleIpc("images:upload", (name, dataUri, type, size) => {
    repo.upload(name, dataUri, type, size);
  });
  handleIpc("images:remove", (name) => {
    repo.remove(name);
  });
  handleIpc("images:getByName", (name) => {
    return repo.getByName(name);
  });
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
function registerPrinterHandlers() {
  const queueRepo = new PrintQueueRepository();
  handleIpc("printer:getStatus", () => {
    return [];
  });
  handleIpc("printer:print", (_config, _quantities, _profile) => {
    console.log("[Printer] print called — stub (printing module not yet implemented)");
  });
  handleIpc("printer:pause", () => {
    console.log("[Printer] pause called — stub (printing module not yet implemented)");
  });
  handleIpc("printer:resume", () => {
    console.log("[Printer] resume called — stub (printing module not yet implemented)");
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
}
function registerAllHandlers() {
  registerConfigHandlers();
  registerOrdersHandlers();
  registerImagesHandlers();
  registerPrinterHandlers();
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
  registerAllHandlers();
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
  closeDatabase();
});
