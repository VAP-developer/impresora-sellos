/**
 * Feature: stack-migration, Task 3.5: Tests de smoke para métodos del servidor
 * Framework: Vitest
 *
 * Smoke tests for the Meteor server methods, verifying that:
 * - pausarImpresora and reanudarImpresora execute without errors (with mock demonio)
 * - insertOrder, downloadXLS, initConfig, updateRollos respond correctly
 *
 * These tests exercise the same business logic as the Meteor methods but without
 * the Meteor runtime. Meteor-specific APIs are mocked to isolate the logic.
 *
 * Validates: Requirements 1.2, 7.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock infrastructure: simulates Meteor collections with in-memory storage
// ---------------------------------------------------------------------------

function createMockCollection() {
  let docs = [];
  let nextId = 1;

  return {
    _docs: docs,

    async findOneAsync(query) {
      if (!query || Object.keys(query).length === 0) {
        return docs[0] || null;
      }
      return docs.find((d) => {
        return Object.entries(query).every(([k, v]) => d[k] === v);
      }) || null;
    },

    find() {
      return {
        async fetchAsync() {
          return [...docs];
        },
      };
    },

    async insertAsync(doc) {
      const newDoc = { _id: `mock_id_${nextId++}`, ...doc };
      docs.push(newDoc);
      return newDoc._id;
    },

    async removeAsync(query) {
      if (!query || Object.keys(query).length === 0) {
        const count = docs.length;
        docs.length = 0;
        return count;
      }
      const before = docs.length;
      docs = docs.filter((d) => {
        return !Object.entries(query).every(([k, v]) => d[k] === v);
      });
      // Update the reference since we reassigned
      createMockCollection._lastDocs = docs;
      return before - docs.length;
    },

    async updateAsync(query, modifier) {
      const doc = docs.find((d) => {
        return Object.entries(query).every(([k, v]) => d[k] === v);
      });
      if (!doc) return 0;

      if (modifier.$set) {
        for (const [path, value] of Object.entries(modifier.$set)) {
          setNestedValue(doc, path, value);
        }
      }
      if (modifier.$inc) {
        for (const [path, value] of Object.entries(modifier.$inc)) {
          const current = getNestedValue(doc, path) || 0;
          setNestedValue(doc, path, current + value);
        }
      }
      return 1;
    },

    // Reset for tests
    _reset() {
      docs.length = 0;
      nextId = 1;
    },

    _getDocs() {
      return docs;
    },
  };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (!o[k]) o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

// ---------------------------------------------------------------------------
// Mock Meteor and fetch
// ---------------------------------------------------------------------------

const MockConfig = createMockCollection();
const MockOrders = createMockCollection();

// ---------------------------------------------------------------------------
// Business logic extracted from Meteor methods (testable without Meteor runtime)
// These mirror the actual implementations in the source files.
// ---------------------------------------------------------------------------

/**
 * Mirrors: correos-webapp/server/server_methods.js → callDemonio
 */
async function callDemonio(path, fetchFn, host = 'demonio-python', port = 8001) {
  const url = `http://${host}:${port}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    const data = await response.text();

    if (!response.ok) {
      throw new Error(data);
    }

    return JSON.parse(data);
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Timeout al conectar con el demonio');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mirrors: correos-webapp/server/server_methods.js → pausarImpresora
 */
async function pausarImpresora(fetchFn) {
  const result = await callDemonio('/pausar', fetchFn);
  return result.message;
}

/**
 * Mirrors: correos-webapp/server/server_methods.js → reanudarImpresora
 */
async function reanudarImpresora(fetchFn) {
  const result = await callDemonio('/reanudar', fetchFn);
  return result.message;
}

/**
 * Mirrors: correos-webapp/imports/api/config/methods.js → initConfig
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
      NUEVOlimiteImporte: 399.99,
      empresa: 'S.E. Correos y Telégrafos S.A., S.M.E.',
      cif: 'A83052407',
      cp: '28042 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones',
      T1especial: '',
      T2especial: '',
      T3especial: '',
      TEmod1: '',
      TEmod2: '',
      ImprimeCopiaTicket: '1',
      ImprimeMasterTicket: '1',
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
      tarifaA: 0.50,
      tarifaA2: 0.60,
      tarifaB: 1.25,
      tarifaC: 1.35,
    },
  };

  await configCollection.removeAsync({});
  await configCollection.insertAsync(initialConfiguration);
}

/**
 * Mirrors: correos-webapp/imports/api/config/methods.js → updateRollos
 */
async function updateRollos(configCollection, sellos1, sellos2, tickets) {
  const doc = await configCollection.findOneAsync();
  await configCollection.updateAsync({ _id: doc._id }, {
    $inc: {
      'ticket.rollo1': sellos1 * -1,
      'ticket.rollo2': sellos2 * -1,
      'ticket.tickets': tickets * -1,
    },
  });
}

/**
 * Mirrors: correos-webapp/imports/api/orders/methods.js → insertOrder
 */
async function insertOrder(ordersCollection, orders) {
  for (let i = 0; i < orders.length; i++) {
    await ordersCollection.insertAsync(orders[i]);
  }
}

/**
 * Mirrors: correos-webapp/imports/api/orders/methods.js → collectionToCSV + downloadXLS
 */
function collectionToCSV(data, { heading = true, delimiter = ',' } = {}) {
  if (!data || data.length === 0) return '';

  const keys = Object.keys(data[0]).filter((k) => k !== '_id');
  const lines = [];

  if (heading) {
    lines.push(keys.join(delimiter));
  }

  for (const doc of data) {
    const values = keys.map((key) => {
      const val = doc[key];
      if (val == null) return '';
      const str = String(val);
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}

async function downloadXLS(ordersCollection) {
  const collection = await ordersCollection.find().fetchAsync();
  const heading = true;
  const delimiter = ';';
  return collectionToCSV(collection, { heading, delimiter });
}

// ---------------------------------------------------------------------------
// Helper: create a mock fetch that returns a success response
// ---------------------------------------------------------------------------

function createMockFetch(responseBody, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(responseBody),
  });
}

function createMockFetchError(errorMessage) {
  return vi.fn().mockRejectedValue(new Error(errorMessage));
}

// ---------------------------------------------------------------------------
// Tests: pausarImpresora
// ---------------------------------------------------------------------------

describe('pausarImpresora — ejecuta sin errores con mock del demonio', () => {
  it('returns success message when demonio responds OK', async () => {
    const mockFetch = createMockFetch({ message: 'Impresora pausada correctamente' });

    const result = await pausarImpresora(mockFetch);

    expect(result).toBe('Impresora pausada correctamente');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://demonio-python:8001/pausar',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('throws error when demonio responds with HTTP error', async () => {
    const mockFetch = createMockFetch('cupsdisable failed', 500);

    await expect(pausarImpresora(mockFetch)).rejects.toThrow();
  });

  it('throws error when demonio is unreachable', async () => {
    const mockFetch = createMockFetchError('ECONNREFUSED');

    await expect(pausarImpresora(mockFetch)).rejects.toThrow('ECONNREFUSED');
  });

  it('calls the correct endpoint /pausar', async () => {
    const mockFetch = createMockFetch({ message: 'ok' });

    await pausarImpresora(mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/pausar');
  });
});

// ---------------------------------------------------------------------------
// Tests: reanudarImpresora
// ---------------------------------------------------------------------------

describe('reanudarImpresora — ejecuta sin errores con mock del demonio', () => {
  it('returns success message when demonio responds OK', async () => {
    const mockFetch = createMockFetch({ message: 'Impresora reanudada correctamente' });

    const result = await reanudarImpresora(mockFetch);

    expect(result).toBe('Impresora reanudada correctamente');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://demonio-python:8001/reanudar',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('throws error when demonio responds with HTTP error', async () => {
    const mockFetch = createMockFetch('cupsenable failed', 500);

    await expect(reanudarImpresora(mockFetch)).rejects.toThrow();
  });

  it('throws error when demonio is unreachable', async () => {
    const mockFetch = createMockFetchError('ECONNREFUSED');

    await expect(reanudarImpresora(mockFetch)).rejects.toThrow('ECONNREFUSED');
  });

  it('calls the correct endpoint /reanudar', async () => {
    const mockFetch = createMockFetch({ message: 'ok' });

    await reanudarImpresora(mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/reanudar');
  });
});

// ---------------------------------------------------------------------------
// Tests: initConfig
// ---------------------------------------------------------------------------

describe('initConfig — responde correctamente', () => {
  beforeEach(() => {
    MockConfig._reset();
  });

  it('creates initial config document in empty collection', async () => {
    await initConfig(MockConfig);

    const docs = MockConfig._getDocs();
    expect(docs).toHaveLength(1);
  });

  it('creates config with correct ticket structure', async () => {
    await initConfig(MockConfig);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket).toBeDefined();
    expect(doc.ticket.feria).toBe('XLIX Feria Nacional Sello');
    expect(doc.ticket.lugar).toBe('Plaza Mayor - Madrid');
    expect(doc.ticket.rollo1).toBe(1500);
    expect(doc.ticket.rollo2).toBe(1500);
    expect(doc.ticket.tickets).toBe(450);
    expect(doc.ticket.limiteImporte).toBeCloseTo(399.99);
    expect(doc.ticket.empresa).toBe('S.E. Correos y Telégrafos S.A., S.M.E.');
    expect(doc.ticket.cif).toBe('A83052407');
  });

  it('creates config with correct codigo structure', async () => {
    await initConfig(MockConfig);

    const doc = await MockConfig.findOneAsync();
    expect(doc.codigo).toBeDefined();
    expect(doc.codigo.modo).toBe('P');
    expect(doc.codigo.pais).toBe('ES');
    expect(doc.codigo.maquina).toBe('CH17');
    expect(doc.codigo.cliente).toBe(1);
    expect(doc.codigo.producto).toBe(1);
  });

  it('creates config with correct precios structure', async () => {
    await initConfig(MockConfig);

    const doc = await MockConfig.findOneAsync();
    expect(doc.precios).toBeDefined();
    expect(doc.precios.tarifaA).toBeCloseTo(0.50);
    expect(doc.precios.tarifaA2).toBeCloseTo(0.60);
    expect(doc.precios.tarifaB).toBeCloseTo(1.25);
    expect(doc.precios.tarifaC).toBeCloseTo(1.35);
  });

  it('clears existing config before inserting (idempotent)', async () => {
    // Insert some existing data
    await MockConfig.insertAsync({ ticket: { rollo1: 999 } });
    await MockConfig.insertAsync({ ticket: { rollo1: 888 } });

    await initConfig(MockConfig);

    const docs = MockConfig._getDocs();
    expect(docs).toHaveLength(1);
    const doc = docs[0];
    expect(doc.ticket.rollo1).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// Tests: updateRollos
// ---------------------------------------------------------------------------

describe('updateRollos — responde correctamente', () => {
  beforeEach(async () => {
    MockConfig._reset();
    await initConfig(MockConfig);
  });

  it('decrements rollo1 correctly', async () => {
    await updateRollos(MockConfig, 10, 0, 0);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket.rollo1).toBe(1490);
    expect(doc.ticket.rollo2).toBe(1500);
    expect(doc.ticket.tickets).toBe(450);
  });

  it('decrements rollo2 correctly', async () => {
    await updateRollos(MockConfig, 0, 5, 0);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket.rollo1).toBe(1500);
    expect(doc.ticket.rollo2).toBe(1495);
    expect(doc.ticket.tickets).toBe(450);
  });

  it('decrements tickets correctly', async () => {
    await updateRollos(MockConfig, 0, 0, 3);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket.rollo1).toBe(1500);
    expect(doc.ticket.rollo2).toBe(1500);
    expect(doc.ticket.tickets).toBe(447);
  });

  it('decrements all three simultaneously', async () => {
    await updateRollos(MockConfig, 10, 5, 2);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket.rollo1).toBe(1490);
    expect(doc.ticket.rollo2).toBe(1495);
    expect(doc.ticket.tickets).toBe(448);
  });

  it('handles zero values (no change)', async () => {
    await updateRollos(MockConfig, 0, 0, 0);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket.rollo1).toBe(1500);
    expect(doc.ticket.rollo2).toBe(1500);
    expect(doc.ticket.tickets).toBe(450);
  });

  it('accumulates multiple decrements', async () => {
    await updateRollos(MockConfig, 100, 50, 10);
    await updateRollos(MockConfig, 200, 150, 20);

    const doc = await MockConfig.findOneAsync();
    expect(doc.ticket.rollo1).toBe(1200);
    expect(doc.ticket.rollo2).toBe(1300);
    expect(doc.ticket.tickets).toBe(420);
  });
});

// ---------------------------------------------------------------------------
// Tests: insertOrder
// ---------------------------------------------------------------------------

describe('insertOrder — responde correctamente', () => {
  beforeEach(() => {
    MockOrders._reset();
  });

  it('inserts a single order', async () => {
    const orders = [{
      event: 'Feria 2024',
      venue: 'Plaza Mayor',
      machine: 'CH17',
      quantity: 3,
      value: 1.50,
    }];

    await insertOrder(MockOrders, orders);

    const docs = MockOrders._getDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].event).toBe('Feria 2024');
    expect(docs[0].quantity).toBe(3);
  });

  it('inserts multiple orders in sequence', async () => {
    const orders = [
      { event: 'Feria A', quantity: 1 },
      { event: 'Feria B', quantity: 2 },
      { event: 'Feria C', quantity: 3 },
    ];

    await insertOrder(MockOrders, orders);

    const docs = MockOrders._getDocs();
    expect(docs).toHaveLength(3);
    expect(docs[0].event).toBe('Feria A');
    expect(docs[1].event).toBe('Feria B');
    expect(docs[2].event).toBe('Feria C');
  });

  it('handles empty orders array without errors', async () => {
    await insertOrder(MockOrders, []);

    const docs = MockOrders._getDocs();
    expect(docs).toHaveLength(0);
  });

  it('preserves all fields of each order document', async () => {
    const orders = [{
      event: 'Test Event',
      venue: 'Test Venue',
      machine: 'M01',
      vendType: 'kiosko',
      productName: 'Sello A',
      transactionDate: '2024-05-15',
      quantity: 10,
      quantitySet: 2,
      totalStamps: 20,
      currency: 'EUR',
      value: 5.00,
      paymentStatus: 'paid',
      sesionId: 42,
      etiquetasRollo1: 10,
      etiquetasRollo2: 10,
      etiquetaMes: '05',
      titutoEvento: 'Test',
      feria: 'Test Feria',
      Lugar: 'Madrid',
      fecha: '15-05-2024',
      mes: 5,
      annio: '2024',
      documento: 'P-ES-M01-0042-0001',
    }];

    await insertOrder(MockOrders, orders);

    const doc = MockOrders._getDocs()[0];
    expect(doc.event).toBe('Test Event');
    expect(doc.venue).toBe('Test Venue');
    expect(doc.machine).toBe('M01');
    expect(doc.vendType).toBe('kiosko');
    expect(doc.productName).toBe('Sello A');
    expect(doc.quantity).toBe(10);
    expect(doc.paymentStatus).toBe('paid');
    expect(doc.documento).toBe('P-ES-M01-0042-0001');
  });
});

// ---------------------------------------------------------------------------
// Tests: downloadXLS
// ---------------------------------------------------------------------------

describe('downloadXLS — responde correctamente', () => {
  beforeEach(() => {
    MockOrders._reset();
  });

  it('returns empty string when no orders exist', async () => {
    const result = await downloadXLS(MockOrders);
    expect(result).toBe('');
  });

  it('returns CSV with semicolon delimiter and header', async () => {
    await MockOrders.insertAsync({
      event: 'Feria 2024',
      venue: 'Madrid',
      quantity: 5,
    });

    const result = await downloadXLS(MockOrders);

    // Should have header + 1 data line
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);

    // Header uses semicolons
    expect(lines[0]).toContain(';');
    expect(lines[0]).toContain('event');
    expect(lines[0]).toContain('venue');
    expect(lines[0]).toContain('quantity');

    // Data row
    expect(lines[1]).toContain('Feria 2024');
    expect(lines[1]).toContain('Madrid');
    expect(lines[1]).toContain('5');
  });

  it('handles multiple orders correctly', async () => {
    await MockOrders.insertAsync({ event: 'A', quantity: 1 });
    await MockOrders.insertAsync({ event: 'B', quantity: 2 });
    await MockOrders.insertAsync({ event: 'C', quantity: 3 });

    const result = await downloadXLS(MockOrders);
    const lines = result.split('\n');

    // 1 header + 3 data lines
    expect(lines).toHaveLength(4);
  });

  it('excludes _id field from CSV output', async () => {
    await MockOrders.insertAsync({ event: 'Test', quantity: 1 });

    const result = await downloadXLS(MockOrders);
    const header = result.split('\n')[0];

    expect(header).not.toContain('_id');
  });

  it('escapes values containing semicolons', async () => {
    await MockOrders.insertAsync({ event: 'Feria;Nacional', quantity: 1 });

    const result = await downloadXLS(MockOrders);
    const dataLine = result.split('\n')[1];

    // Value with semicolons should be quoted
    expect(dataLine).toContain('"Feria;Nacional"');
  });

  it('escapes values containing quotes', async () => {
    await MockOrders.insertAsync({ event: 'Feria "Grande"', quantity: 1 });

    const result = await downloadXLS(MockOrders);
    const dataLine = result.split('\n')[1];

    // Quotes inside should be doubled
    expect(dataLine).toContain('""Grande""');
  });

  it('handles null/undefined values as empty strings', async () => {
    await MockOrders.insertAsync({ event: 'Test', venue: null, quantity: 1 });

    const result = await downloadXLS(MockOrders);
    const dataLine = result.split('\n')[1];
    const values = dataLine.split(';');

    // The null venue field should be empty
    expect(values[1]).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: callDemonio timeout and error handling
// ---------------------------------------------------------------------------

describe('callDemonio — manejo de errores', () => {
  it('throws timeout error when request takes too long', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        // Simulate timeout by rejecting with AbortError
        setTimeout(() => reject(error), 50);
      });
    });

    await expect(callDemonio('/pausar', mockFetch)).rejects.toThrow(
      'Timeout al conectar con el demonio'
    );
  });

  it('throws when response body is not valid JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'not json',
    });

    await expect(callDemonio('/pausar', mockFetch)).rejects.toThrow();
  });

  it('throws error message from non-OK response body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error: cupsdisable not found',
    });

    await expect(callDemonio('/pausar', mockFetch)).rejects.toThrow(
      'Internal Server Error: cupsdisable not found'
    );
  });

  it('uses correct URL format with host and port', async () => {
    const mockFetch = createMockFetch({ message: 'ok' });

    await callDemonio('/reanudar', mockFetch, 'my-host', 9999);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://my-host:9999/reanudar',
      expect.anything()
    );
  });
});
