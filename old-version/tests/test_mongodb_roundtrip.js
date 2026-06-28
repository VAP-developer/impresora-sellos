/**
 * Feature: stack-migration, Property 2: Round-trip de documentos MongoDB
 * Framework: fast-check + Vitest
 *
 * Verifies that for any valid document in collections config, orders, or images,
 * writing the document to MongoDB and reading it back produces an equivalent document.
 *
 * Validates: Requirements 2.1, 2.3, 7.6
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import fc from 'fast-check';
import { MongoClient } from 'mongodb';

// ---------------------------------------------------------------------------
// Connection setup (uses real MongoDB instance — start with docker run -d -p 27017:27017 mongo:7)
// ---------------------------------------------------------------------------

const MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017';
const DB_NAME = 'correos_test_roundtrip';

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
// Arbitrary generators for each collection's document schema
// ---------------------------------------------------------------------------

/**
 * Generator for "config" collection documents.
 * Based on the ConfigDocument interface defined in design.md.
 */
const arbConfigDocument = () =>
  fc.record({
    ticket: fc.record({
      feria: fc.string({ minLength: 0, maxLength: 50 }),
      lugar: fc.string({ minLength: 0, maxLength: 50 }),
      fecha: fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.constant('auto')),
      hora: fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.constant('auto')),
      titulo: fc.string({ minLength: 0, maxLength: 100 }),
      tituloCopia: fc.string({ minLength: 0, maxLength: 100 }),
      rollo1: fc.integer({ min: 0, max: 10000 }),
      rollo2: fc.integer({ min: 0, max: 10000 }),
      tickets: fc.integer({ min: 0, max: 10000 }),
      limiteTickets: fc.integer({ min: 0, max: 10000 }),
      limiteImporte: fc.integer({ min: 0, max: 100000 }),
      NUEVOlimiteImporte: fc.integer({ min: 0, max: 100000 }),
      empresa: fc.string({ minLength: 0, maxLength: 100 }),
      cif: fc.string({ minLength: 0, maxLength: 20 }),
      cp: fc.string({ minLength: 0, maxLength: 10 }),
      l1: fc.string({ minLength: 0, maxLength: 100 }),
      l2: fc.string({ minLength: 0, maxLength: 100 }),
      l3: fc.string({ minLength: 0, maxLength: 100 }),
      T1especial: fc.string({ minLength: 0, maxLength: 100 }),
      T2especial: fc.string({ minLength: 0, maxLength: 100 }),
      T3especial: fc.string({ minLength: 0, maxLength: 100 }),
      TEmod1: fc.string({ minLength: 0, maxLength: 50 }),
      TEmod2: fc.string({ minLength: 0, maxLength: 50 }),
      ImprimeCopiaTicket: fc.string({ minLength: 0, maxLength: 10 }),
      ImprimeMasterTicket: fc.string({ minLength: 0, maxLength: 10 }),
    }),
    codigo: fc.record({
      modo: fc.string({ minLength: 0, maxLength: 10 }),
      mes: fc.oneof(fc.integer({ min: 1, max: 12 }), fc.string({ minLength: 1, maxLength: 3 })),
      annio: fc.oneof(fc.string({ minLength: 2, maxLength: 4 }), fc.constant('auto')),
      pais: fc.string({ minLength: 0, maxLength: 10 }),
      maquina: fc.string({ minLength: 0, maxLength: 20 }),
      cliente: fc.integer({ min: 0, max: 99999 }),
      producto: fc.integer({ min: 0, max: 99999 }),
    }),
    sello: fc.record({
      fecha: fc.string({ minLength: 0, maxLength: 30 }),
      evento: fc.string({ minLength: 0, maxLength: 100 }),
      modelo1: fc.string({ minLength: 0, maxLength: 50 }),
      modelo2: fc.string({ minLength: 0, maxLength: 50 }),
      modo: fc.integer({ min: 0, max: 10 }),
      elperfil: fc.integer({ min: 0, max: 100 }),
      elnperfil: fc.string({ minLength: 0, maxLength: 50 }),
      elnevento: fc.string({ minLength: 0, maxLength: 50 }),
      elevento: fc.integer({ min: 0, max: 100 }),
      feria: fc.string({ minLength: 0, maxLength: 50 }),
      lugar: fc.string({ minLength: 0, maxLength: 50 }),
      PERFILlimiteImporte: fc.integer({ min: 0, max: 100000 }),
    }),
    precios: fc.record({
      tarifaA: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
      tarifaA2: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
      tarifaB: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
      tarifaC: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
      tarifaTA: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
      tarifaT4: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
    }),
  });

/**
 * Generator for "orders" collection documents.
 * Based on the OrderDocument interface defined in design.md.
 */
const arbOrderDocument = () =>
  fc.record({
    event: fc.string({ minLength: 0, maxLength: 100 }),
    venue: fc.string({ minLength: 0, maxLength: 100 }),
    machine: fc.string({ minLength: 0, maxLength: 50 }),
    vendType: fc.string({ minLength: 0, maxLength: 20 }),
    productName: fc.string({ minLength: 0, maxLength: 100 }),
    transactionDate: fc.string({ minLength: 0, maxLength: 30 }),
    quantity: fc.integer({ min: 0, max: 1000 }),
    quantitySet: fc.integer({ min: 0, max: 1000 }),
    totalStamps: fc.integer({ min: 0, max: 10000 }),
    currency: fc.string({ minLength: 0, maxLength: 5 }),
    value: fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }),
    paymentStatus: fc.string({ minLength: 0, maxLength: 20 }),
    sesionId: fc.integer({ min: 0, max: 99999 }),
    etiquetasRollo1: fc.integer({ min: 0, max: 10000 }),
    etiquetasRollo2: fc.integer({ min: 0, max: 10000 }),
    etiquetaMes: fc.string({ minLength: 0, maxLength: 10 }),
    titutoEvento: fc.string({ minLength: 0, maxLength: 100 }),
    feria: fc.string({ minLength: 0, maxLength: 100 }),
    Lugar: fc.string({ minLength: 0, maxLength: 100 }),
    fecha: fc.string({ minLength: 0, maxLength: 30 }),
    mes: fc.oneof(fc.integer({ min: 1, max: 12 }), fc.string({ minLength: 1, maxLength: 3 })),
    annio: fc.string({ minLength: 1, maxLength: 4 }),
    documento: fc.string({ minLength: 0, maxLength: 50 }),
  });

/**
 * Generator for "images" collection documents.
 * Based on the ImageDocument interface defined in design.md.
 */
const arbImageDocument = () =>
  fc.record({
    name: fc.oneof(fc.constant('Modelo1'), fc.constant('Modelo2')),
    path: fc.string({ minLength: 1, maxLength: 200 }),
    type: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    size: fc.option(fc.integer({ min: 0, max: 10000000 }), { nil: undefined }),
    url: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clones a plain object (no functions, no circular refs).
 * Used to preserve the original document before insertOne mutates it with _id.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compares two documents for field-level equivalence, ignoring _id.
 * Handles floating point comparison with a tolerance.
 */
function assertDocumentsEquivalent(original, retrieved) {
  const { _id, ...retrievedFields } = retrieved;

  // _id must exist in the retrieved document
  expect(_id).toBeDefined();

  // Deep comparison of all original fields
  for (const [key, value] of Object.entries(original)) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      // Floating point tolerance
      expect(retrievedFields[key]).toBeCloseTo(value, 10);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      assertNestedEquivalent(value, retrievedFields[key]);
    } else {
      expect(retrievedFields[key]).toStrictEqual(value);
    }
  }
}

/**
 * Recursively compares nested objects with float tolerance.
 */
function assertNestedEquivalent(original, retrieved) {
  if (original === null || original === undefined) {
    expect(retrieved).toEqual(original);
    return;
  }

  expect(retrieved).toBeDefined();

  for (const [key, value] of Object.entries(original)) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      expect(retrieved[key]).toBeCloseTo(value, 10);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      assertNestedEquivalent(value, retrieved[key]);
    } else {
      expect(retrieved[key]).toStrictEqual(value);
    }
  }
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe('Property 2: Round-trip de documentos MongoDB', () => {
  it('config: read(write(doc)) devuelve documento equivalente al original', async () => {
    const collection = db.collection('config');

    await fc.assert(
      fc.asyncProperty(arbConfigDocument(), async (doc) => {
        // Clone to preserve original (insertOne mutates with _id)
        const original = deepClone(doc);

        // Write
        const result = await collection.insertOne(doc);
        expect(result.insertedId).toBeDefined();

        // Read
        const retrieved = await collection.findOne({ _id: result.insertedId });
        expect(retrieved).not.toBeNull();

        // Verify equivalence
        assertDocumentsEquivalent(original, retrieved);

        // Cleanup to avoid collection bloat
        await collection.deleteOne({ _id: result.insertedId });
      }),
      { numRuns: 100 }
    );
  });

  it('orders: read(write(doc)) devuelve documento equivalente al original', async () => {
    const collection = db.collection('orders');

    await fc.assert(
      fc.asyncProperty(arbOrderDocument(), async (doc) => {
        // Clone to preserve original
        const original = deepClone(doc);

        // Write
        const result = await collection.insertOne(doc);
        expect(result.insertedId).toBeDefined();

        // Read
        const retrieved = await collection.findOne({ _id: result.insertedId });
        expect(retrieved).not.toBeNull();

        // Verify equivalence
        assertDocumentsEquivalent(original, retrieved);

        // Cleanup
        await collection.deleteOne({ _id: result.insertedId });
      }),
      { numRuns: 100 }
    );
  });

  it('images: read(write(doc)) devuelve documento equivalente al original', async () => {
    const collection = db.collection('images');

    await fc.assert(
      fc.asyncProperty(arbImageDocument(), async (doc) => {
        // Remove undefined optional fields before insert (MongoDB doesn't store undefined)
        const cleanDoc = Object.fromEntries(
          Object.entries(doc).filter(([_, v]) => v !== undefined)
        );

        // Clone to preserve original
        const original = deepClone(cleanDoc);

        // Write
        const result = await collection.insertOne(cleanDoc);
        expect(result.insertedId).toBeDefined();

        // Read
        const retrieved = await collection.findOne({ _id: result.insertedId });
        expect(retrieved).not.toBeNull();

        // Verify equivalence
        assertDocumentsEquivalent(original, retrieved);

        // Cleanup
        await collection.deleteOne({ _id: result.insertedId });
      }),
      { numRuns: 100 }
    );
  });
});
