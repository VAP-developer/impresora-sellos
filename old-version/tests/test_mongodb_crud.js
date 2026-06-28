/**
 * Feature: stack-migration, Task 1.3: Tests unitarios CRUD MongoDB
 * Framework: Vitest
 *
 * Verifies CRUD operations on collections config, orders, and images,
 * including the business logic methods: initConfig, insertOrder, updateRollos.
 *
 * These tests exercise the same logic as the Meteor methods but against
 * a real MongoDB instance to validate Requirements 2.1, 2.3, 7.1.
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { MongoClient } from 'mongodb';

// ---------------------------------------------------------------------------
// Connection setup (uses real MongoDB instance — start with docker run -d -p 27017:27017 mongo:7)
// ---------------------------------------------------------------------------

const MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017';
const DB_NAME = 'correos_test_crud';

let client;
let db;

beforeAll(async () => {
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
});

afterAll(async () => {
  if (db) {
    await db.dropDatabase();
  }
  if (client) {
    await client.close();
  }
});

// ---------------------------------------------------------------------------
// Business logic functions (mirroring Meteor methods for testability)
// ---------------------------------------------------------------------------

/**
 * Mirrors: correos-webapp/imports/api/config/methods.js → initConfig
 * Removes all existing config documents and inserts the initial configuration.
 */
async function initConfig(configCollection) {
  const initialConfiguration = {
    ticket: {
      feria: 'XLIX Feria Nacional Sello',
      lugar: 'Plaza Mayor - Madrid',
      fecha: 'auto',
      hora: 'auto',
      titulo: 'Factura Simplificada',
      tituloCopia: 'COPIA Factura Simplificada',
      rollo1: 1500,
      rollo2: 1500,
      tickets: 450,
      limiteTickets: 450,
      limiteImporte: 399.99,
      empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
      cif: 'A83052407',
      cp: '28042 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones',
    },
    codigo: {
      modo: 'P',
      mes: 0,
      annio: 'auto',
      pais: 'ES',
      maquina: 'CH17',
      cliente: 1,
      producto: 1,
    },
    sello: {
      fecha: '21-24 abril 2016',
      evento: 'Madrid',
      modelo1: 'Telegrafo',
      modelo2: 'Buzon',
      modo: 0,
    },
    precios: {
      tarifaA: 0.5,
      tarifaA2: 0.6,
      tarifaB: 1.25,
      tarifaC: 1.35,
    },
  };

  await configCollection.deleteMany({});
  const result = await configCollection.insertOne(initialConfiguration);
  return result;
}

/**
 * Mirrors: correos-webapp/imports/api/orders/methods.js → insertOrder
 * Inserts multiple order lines into the orders collection.
 */
async function insertOrder(ordersCollection, orders) {
  const results = [];
  for (let i = 0; i < orders.length; i++) {
    const result = await ordersCollection.insertOne(orders[i]);
    results.push(result);
  }
  return results;
}

/**
 * Mirrors: correos-webapp/imports/api/config/methods.js → updateRollos
 * Decrements rollo1, rollo2, and tickets by the given amounts.
 */
async function updateRollos(configCollection, sellos1, sellos2, tickets) {
  const configDoc = await configCollection.findOne();
  const id = configDoc._id;
  await configCollection.updateOne({ _id: id }, { $inc: { 'ticket.rollo1': sellos1 * -1 } });
  await configCollection.updateOne({ _id: id }, { $inc: { 'ticket.rollo2': sellos2 * -1 } });
  await configCollection.updateOne({ _id: id }, { $inc: { 'ticket.tickets': tickets * -1 } });
}

// ---------------------------------------------------------------------------
// Tests: initConfig
// ---------------------------------------------------------------------------

describe('initConfig — crea documento inicial correcto', () => {
  let configCollection;

  beforeEach(async () => {
    configCollection = db.collection('config_init_test');
    await configCollection.deleteMany({});
  });

  it('inserts exactly one document into an empty collection', async () => {
    await initConfig(configCollection);

    const count = await configCollection.countDocuments();
    expect(count).toBe(1);
  });

  it('creates document with correct ticket fields', async () => {
    await initConfig(configCollection);

    const doc = await configCollection.findOne();
    expect(doc.ticket).toBeDefined();
    expect(doc.ticket.feria).toBe('XLIX Feria Nacional Sello');
    expect(doc.ticket.lugar).toBe('Plaza Mayor - Madrid');
    expect(doc.ticket.fecha).toBe('auto');
    expect(doc.ticket.hora).toBe('auto');
    expect(doc.ticket.titulo).toBe('Factura Simplificada');
    expect(doc.ticket.tituloCopia).toBe('COPIA Factura Simplificada');
    expect(doc.ticket.rollo1).toBe(1500);
    expect(doc.ticket.rollo2).toBe(1500);
    expect(doc.ticket.tickets).toBe(450);
    expect(doc.ticket.limiteTickets).toBe(450);
    expect(doc.ticket.limiteImporte).toBeCloseTo(399.99);
    expect(doc.ticket.empresa).toBe('S.E. Correos y Telégrafos S.A., S.M.E.');
    expect(doc.ticket.cif).toBe('A83052407');
    expect(doc.ticket.cp).toBe('28042 Madrid');
    expect(doc.ticket.l1).toBe('Exento de impuestos');
    expect(doc.ticket.l2).toBe('Objeto de coleccionismo');
    expect(doc.ticket.l3).toBe('No se admiten devoluciones');
  });

  it('creates document with correct codigo fields', async () => {
    await initConfig(configCollection);

    const doc = await configCollection.findOne();
    expect(doc.codigo).toBeDefined();
    expect(doc.codigo.modo).toBe('P');
    expect(doc.codigo.mes).toBe(0);
    expect(doc.codigo.annio).toBe('auto');
    expect(doc.codigo.pais).toBe('ES');
    expect(doc.codigo.maquina).toBe('CH17');
    expect(doc.codigo.cliente).toBe(1);
    expect(doc.codigo.producto).toBe(1);
  });

  it('creates document with correct sello fields', async () => {
    await initConfig(configCollection);

    const doc = await configCollection.findOne();
    expect(doc.sello).toBeDefined();
    expect(doc.sello.fecha).toBe('21-24 abril 2016');
    expect(doc.sello.evento).toBe('Madrid');
    expect(doc.sello.modelo1).toBe('Telegrafo');
    expect(doc.sello.modelo2).toBe('Buzon');
    expect(doc.sello.modo).toBe(0);
  });

  it('creates document with correct precios fields', async () => {
    await initConfig(configCollection);

    const doc = await configCollection.findOne();
    expect(doc.precios).toBeDefined();
    expect(doc.precios.tarifaA).toBeCloseTo(0.5);
    expect(doc.precios.tarifaA2).toBeCloseTo(0.6);
    expect(doc.precios.tarifaB).toBeCloseTo(1.25);
    expect(doc.precios.tarifaC).toBeCloseTo(1.35);
  });

  it('replaces previous config when called again (idempotent reset)', async () => {
    // Insert initial config
    await initConfig(configCollection);

    // Modify the config
    await configCollection.updateOne({}, { $set: { 'ticket.rollo1': 500 } });

    // Re-initialize
    await initConfig(configCollection);

    const count = await configCollection.countDocuments();
    expect(count).toBe(1);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500); // Reset to initial value
  });

  it('removes multiple existing documents before inserting new one', async () => {
    // Artificially insert multiple config documents
    await configCollection.insertMany([
      { ticket: { rollo1: 100 } },
      { ticket: { rollo1: 200 } },
      { ticket: { rollo1: 300 } },
    ]);

    await initConfig(configCollection);

    const count = await configCollection.countDocuments();
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: insertOrder
// ---------------------------------------------------------------------------

describe('insertOrder — inserta múltiples líneas', () => {
  let ordersCollection;

  beforeEach(async () => {
    ordersCollection = db.collection('orders_insert_test');
    await ordersCollection.deleteMany({});
  });

  it('inserts a single order line', async () => {
    const orders = [
      {
        event: 'Feria Sello 2024',
        venue: 'Plaza Mayor',
        machine: 'CH17',
        vendType: 'kiosko',
        productName: 'Sello A',
        transactionDate: '2024-05-15',
        quantity: 2,
        quantitySet: 1,
        totalStamps: 2,
        currency: 'EUR',
        value: 1.0,
        paymentStatus: 'paid',
        sesionId: 1,
        etiquetasRollo1: 2,
        etiquetasRollo2: 0,
        etiquetaMes: '05',
        titutoEvento: 'Feria Sello',
        feria: 'Feria Nacional',
        Lugar: 'Madrid',
        fecha: '15-05-2024',
        mes: 5,
        annio: '2024',
        documento: 'P-ES-CH17-0001-0001',
      },
    ];

    const results = await insertOrder(ordersCollection, orders);

    expect(results).toHaveLength(1);
    expect(results[0].insertedId).toBeDefined();

    const count = await ordersCollection.countDocuments();
    expect(count).toBe(1);

    const stored = await ordersCollection.findOne();
    expect(stored.event).toBe('Feria Sello 2024');
    expect(stored.machine).toBe('CH17');
    expect(stored.quantity).toBe(2);
  });

  it('inserts multiple order lines in sequence', async () => {
    const orders = [
      {
        event: 'Feria 2024',
        venue: 'Plaza Mayor',
        machine: 'CH17',
        vendType: 'kiosko',
        productName: 'Sello A',
        transactionDate: '2024-05-15',
        quantity: 3,
        quantitySet: 1,
        totalStamps: 3,
        currency: 'EUR',
        value: 1.5,
        paymentStatus: 'paid',
        sesionId: 1,
        etiquetasRollo1: 3,
        etiquetasRollo2: 0,
        etiquetaMes: '05',
        titutoEvento: 'Feria Sello',
        feria: 'Feria Nacional',
        Lugar: 'Madrid',
        fecha: '15-05-2024',
        mes: 5,
        annio: '2024',
        documento: 'P-ES-CH17-0001-0001',
      },
      {
        event: 'Feria 2024',
        venue: 'Plaza Mayor',
        machine: 'CH17',
        vendType: 'kiosko',
        productName: 'Sello B',
        transactionDate: '2024-05-15',
        quantity: 1,
        quantitySet: 1,
        totalStamps: 1,
        currency: 'EUR',
        value: 1.25,
        paymentStatus: 'paid',
        sesionId: 1,
        etiquetasRollo1: 0,
        etiquetasRollo2: 1,
        etiquetaMes: '05',
        titutoEvento: 'Feria Sello',
        feria: 'Feria Nacional',
        Lugar: 'Madrid',
        fecha: '15-05-2024',
        mes: 5,
        annio: '2024',
        documento: 'P-ES-CH17-0001-0002',
      },
      {
        event: 'Feria 2024',
        venue: 'Plaza Mayor',
        machine: 'CH17',
        vendType: 'kiosko',
        productName: 'Sello C',
        transactionDate: '2024-05-15',
        quantity: 5,
        quantitySet: 1,
        totalStamps: 5,
        currency: 'EUR',
        value: 6.75,
        paymentStatus: 'paid',
        sesionId: 1,
        etiquetasRollo1: 5,
        etiquetasRollo2: 0,
        etiquetaMes: '05',
        titutoEvento: 'Feria Sello',
        feria: 'Feria Nacional',
        Lugar: 'Madrid',
        fecha: '15-05-2024',
        mes: 5,
        annio: '2024',
        documento: 'P-ES-CH17-0001-0003',
      },
    ];

    const results = await insertOrder(ordersCollection, orders);

    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r.insertedId).toBeDefined());

    const count = await ordersCollection.countDocuments();
    expect(count).toBe(3);
  });

  it('inserts an empty array without errors', async () => {
    const results = await insertOrder(ordersCollection, []);

    expect(results).toHaveLength(0);

    const count = await ordersCollection.countDocuments();
    expect(count).toBe(0);
  });

  it('each inserted order has a unique _id', async () => {
    const orders = [
      { event: 'A', quantity: 1 },
      { event: 'B', quantity: 2 },
      { event: 'C', quantity: 3 },
    ];

    const results = await insertOrder(ordersCollection, orders);
    const ids = results.map((r) => r.insertedId.toString());
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });

  it('preserves all fields of each order document', async () => {
    const orders = [
      {
        event: 'Test Event',
        venue: 'Test Venue',
        machine: 'M01',
        vendType: 'kiosko',
        productName: 'Stamp Special',
        transactionDate: '2024-12-01',
        quantity: 10,
        quantitySet: 2,
        totalStamps: 20,
        currency: 'EUR',
        value: 12.5,
        paymentStatus: 'paid',
        sesionId: 42,
        etiquetasRollo1: 10,
        etiquetasRollo2: 10,
        etiquetaMes: '12',
        titutoEvento: 'Test',
        feria: 'Test Feria',
        Lugar: 'Test City',
        fecha: '01-12-2024',
        mes: 12,
        annio: '2024',
        documento: 'P-ES-M01-0042-0001',
      },
    ];

    await insertOrder(ordersCollection, orders);
    const stored = await ordersCollection.findOne();

    // Verify all fields are preserved
    expect(stored.event).toBe('Test Event');
    expect(stored.venue).toBe('Test Venue');
    expect(stored.machine).toBe('M01');
    expect(stored.vendType).toBe('kiosko');
    expect(stored.productName).toBe('Stamp Special');
    expect(stored.transactionDate).toBe('2024-12-01');
    expect(stored.quantity).toBe(10);
    expect(stored.quantitySet).toBe(2);
    expect(stored.totalStamps).toBe(20);
    expect(stored.currency).toBe('EUR');
    expect(stored.value).toBeCloseTo(12.5);
    expect(stored.paymentStatus).toBe('paid');
    expect(stored.sesionId).toBe(42);
    expect(stored.etiquetasRollo1).toBe(10);
    expect(stored.etiquetasRollo2).toBe(10);
    expect(stored.etiquetaMes).toBe('12');
    expect(stored.titutoEvento).toBe('Test');
    expect(stored.feria).toBe('Test Feria');
    expect(stored.Lugar).toBe('Test City');
    expect(stored.fecha).toBe('01-12-2024');
    expect(stored.mes).toBe(12);
    expect(stored.annio).toBe('2024');
    expect(stored.documento).toBe('P-ES-M01-0042-0001');
  });
});

// ---------------------------------------------------------------------------
// Tests: updateRollos
// ---------------------------------------------------------------------------

describe('updateRollos — decrementa correctamente', () => {
  let configCollection;

  beforeEach(async () => {
    configCollection = db.collection('config_rollos_test');
    await configCollection.deleteMany({});
    await initConfig(configCollection);
  });

  it('decrements rollo1 by the given amount', async () => {
    await updateRollos(configCollection, 5, 0, 0);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500 - 5);
    expect(doc.ticket.rollo2).toBe(1500); // unchanged
    expect(doc.ticket.tickets).toBe(450); // unchanged
  });

  it('decrements rollo2 by the given amount', async () => {
    await updateRollos(configCollection, 0, 3, 0);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500); // unchanged
    expect(doc.ticket.rollo2).toBe(1500 - 3);
    expect(doc.ticket.tickets).toBe(450); // unchanged
  });

  it('decrements tickets by the given amount', async () => {
    await updateRollos(configCollection, 0, 0, 2);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500); // unchanged
    expect(doc.ticket.rollo2).toBe(1500); // unchanged
    expect(doc.ticket.tickets).toBe(450 - 2);
  });

  it('decrements all three values simultaneously', async () => {
    await updateRollos(configCollection, 10, 7, 3);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500 - 10);
    expect(doc.ticket.rollo2).toBe(1500 - 7);
    expect(doc.ticket.tickets).toBe(450 - 3);
  });

  it('handles zero decrements (no change)', async () => {
    await updateRollos(configCollection, 0, 0, 0);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500);
    expect(doc.ticket.rollo2).toBe(1500);
    expect(doc.ticket.tickets).toBe(450);
  });

  it('allows values to go below zero (mirrors original behavior)', async () => {
    // The original code does not prevent negative values
    await updateRollos(configCollection, 2000, 1600, 500);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500 - 2000); // -500
    expect(doc.ticket.rollo2).toBe(1500 - 1600); // -100
    expect(doc.ticket.tickets).toBe(450 - 500);   // -50
  });

  it('accumulates multiple decrements correctly', async () => {
    await updateRollos(configCollection, 100, 50, 10);
    await updateRollos(configCollection, 200, 150, 20);
    await updateRollos(configCollection, 50, 25, 5);

    const doc = await configCollection.findOne();
    expect(doc.ticket.rollo1).toBe(1500 - 100 - 200 - 50);  // 1150
    expect(doc.ticket.rollo2).toBe(1500 - 50 - 150 - 25);   // 1275
    expect(doc.ticket.tickets).toBe(450 - 10 - 20 - 5);     // 415
  });
});

// ---------------------------------------------------------------------------
// Tests: CRUD operations on collections config, images, orders
// ---------------------------------------------------------------------------

describe('CRUD operations — colección config', () => {
  let configCollection;

  beforeEach(async () => {
    configCollection = db.collection('config_crud_test');
    await configCollection.deleteMany({});
  });

  it('CREATE: inserts a config document', async () => {
    const doc = { ticket: { rollo1: 1000 }, codigo: { modo: 'P' } };
    const result = await configCollection.insertOne(doc);

    expect(result.insertedId).toBeDefined();
    expect(result.acknowledged).toBe(true);
  });

  it('READ: retrieves a config document by _id', async () => {
    const doc = { ticket: { feria: 'Test Feria', rollo1: 800 } };
    const { insertedId } = await configCollection.insertOne(doc);

    const retrieved = await configCollection.findOne({ _id: insertedId });
    expect(retrieved).not.toBeNull();
    expect(retrieved.ticket.feria).toBe('Test Feria');
    expect(retrieved.ticket.rollo1).toBe(800);
  });

  it('UPDATE: modifies nested fields with $set', async () => {
    await initConfig(configCollection);
    const doc = await configCollection.findOne();

    await configCollection.updateOne(
      { _id: doc._id },
      { $set: { 'ticket.feria': 'Nueva Feria', 'precios.tarifaA': 0.75 } }
    );

    const updated = await configCollection.findOne({ _id: doc._id });
    expect(updated.ticket.feria).toBe('Nueva Feria');
    expect(updated.precios.tarifaA).toBeCloseTo(0.75);
    // Other fields unchanged
    expect(updated.ticket.lugar).toBe('Plaza Mayor - Madrid');
  });

  it('UPDATE: increments numeric fields with $inc', async () => {
    await initConfig(configCollection);
    const doc = await configCollection.findOne();

    await configCollection.updateOne(
      { _id: doc._id },
      { $inc: { 'codigo.cliente': 1 } }
    );

    const updated = await configCollection.findOne({ _id: doc._id });
    expect(updated.codigo.cliente).toBe(2);
  });

  it('DELETE: removes a config document', async () => {
    await initConfig(configCollection);
    const doc = await configCollection.findOne();

    const result = await configCollection.deleteOne({ _id: doc._id });
    expect(result.deletedCount).toBe(1);

    const remaining = await configCollection.countDocuments();
    expect(remaining).toBe(0);
  });
});

describe('CRUD operations — colección orders', () => {
  let ordersCollection;

  beforeEach(async () => {
    ordersCollection = db.collection('orders_crud_test');
    await ordersCollection.deleteMany({});
  });

  it('CREATE: inserts an order document', async () => {
    const order = {
      event: 'Feria 2024',
      venue: 'Madrid',
      machine: 'CH17',
      quantity: 5,
      value: 2.5,
    };
    const result = await ordersCollection.insertOne(order);

    expect(result.insertedId).toBeDefined();
    expect(result.acknowledged).toBe(true);
  });

  it('READ: finds orders by event', async () => {
    await ordersCollection.insertMany([
      { event: 'Feria A', quantity: 1 },
      { event: 'Feria B', quantity: 2 },
      { event: 'Feria A', quantity: 3 },
    ]);

    const feriaAOrders = await ordersCollection.find({ event: 'Feria A' }).toArray();
    expect(feriaAOrders).toHaveLength(2);
    expect(feriaAOrders.every((o) => o.event === 'Feria A')).toBe(true);
  });

  it('READ: fetches all orders (equivalent to Orders.find().fetch())', async () => {
    await ordersCollection.insertMany([
      { event: 'E1', quantity: 1 },
      { event: 'E2', quantity: 2 },
      { event: 'E3', quantity: 3 },
    ]);

    const all = await ordersCollection.find().toArray();
    expect(all).toHaveLength(3);
  });

  it('UPDATE: modifies an order field', async () => {
    const { insertedId } = await ordersCollection.insertOne({
      event: 'Feria',
      paymentStatus: 'pending',
    });

    await ordersCollection.updateOne(
      { _id: insertedId },
      { $set: { paymentStatus: 'paid' } }
    );

    const updated = await ordersCollection.findOne({ _id: insertedId });
    expect(updated.paymentStatus).toBe('paid');
  });

  it('DELETE: removes a specific order', async () => {
    const { insertedId } = await ordersCollection.insertOne({
      event: 'To Delete',
      quantity: 1,
    });

    const result = await ordersCollection.deleteOne({ _id: insertedId });
    expect(result.deletedCount).toBe(1);

    const doc = await ordersCollection.findOne({ _id: insertedId });
    expect(doc).toBeNull();
  });

  it('DELETE: removes all orders (bulk delete)', async () => {
    await ordersCollection.insertMany([
      { event: 'A' },
      { event: 'B' },
      { event: 'C' },
    ]);

    const result = await ordersCollection.deleteMany({});
    expect(result.deletedCount).toBe(3);

    const count = await ordersCollection.countDocuments();
    expect(count).toBe(0);
  });
});

describe('CRUD operations — colección images', () => {
  let imagesCollection;

  beforeEach(async () => {
    imagesCollection = db.collection('images_crud_test');
    await imagesCollection.deleteMany({});
  });

  it('CREATE: inserts an image document', async () => {
    const image = {
      name: 'Modelo1',
      path: '/uploads/modelo1.png',
      type: 'image/png',
      size: 245000,
    };
    const result = await imagesCollection.insertOne(image);

    expect(result.insertedId).toBeDefined();
    expect(result.acknowledged).toBe(true);
  });

  it('READ: finds an image by name', async () => {
    await imagesCollection.insertMany([
      { name: 'Modelo1', path: '/uploads/m1.png' },
      { name: 'Modelo2', path: '/uploads/m2.png' },
    ]);

    const modelo1 = await imagesCollection.findOne({ name: 'Modelo1' });
    expect(modelo1).not.toBeNull();
    expect(modelo1.path).toBe('/uploads/m1.png');
  });

  it('UPDATE: replaces image path (simulating re-upload)', async () => {
    const { insertedId } = await imagesCollection.insertOne({
      name: 'Modelo1',
      path: '/uploads/old.png',
      size: 100000,
    });

    await imagesCollection.updateOne(
      { _id: insertedId },
      { $set: { path: '/uploads/new.png', size: 250000 } }
    );

    const updated = await imagesCollection.findOne({ _id: insertedId });
    expect(updated.path).toBe('/uploads/new.png');
    expect(updated.size).toBe(250000);
    expect(updated.name).toBe('Modelo1'); // unchanged
  });

  it('DELETE: removes images by name (mirrors removeImagesWithName)', async () => {
    await imagesCollection.insertMany([
      { name: 'Modelo1', path: '/a.png' },
      { name: 'Modelo1', path: '/b.png' },
      { name: 'Modelo2', path: '/c.png' },
    ]);

    // This mirrors the Meteor method: Images.remove({name: name})
    const result = await imagesCollection.deleteMany({ name: 'Modelo1' });
    expect(result.deletedCount).toBe(2);

    const remaining = await imagesCollection.find().toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Modelo2');
  });

  it('READ: returns null for non-existent image', async () => {
    const doc = await imagesCollection.findOne({ name: 'NonExistent' });
    expect(doc).toBeNull();
  });
});
