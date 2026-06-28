import { WebSocket } from 'ws';

/**
 * WebSocket helpers for E2E tests.
 *
 * Provides a client class and message utilities for interacting with
 * the demonio-python WebSocket server (port 8000).
 *
 * Protocol: Messages consist of 31 fields separated by `*¿?*`.
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const WS_URL = 'ws://localhost:8000';
export const SEPARATOR = '*¿?*';
export const NUM_FIELDS = 31;

// ─────────────────────────────────────────────
// WebSocketClient
// ─────────────────────────────────────────────

/**
 * A simple WebSocket client for E2E test interactions with demonio-python.
 *
 * Usage:
 *   const client = new WebSocketClient();
 *   await client.connect();
 *   client.send(buildTestMessage());
 *   const response = await client.waitForMessage();
 *   await client.close();
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string = WS_URL) {
    this.url = url;
  }

  /**
   * Open a WebSocket connection to the server.
   * Resolves when the connection is established.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout to ${this.url}`));
      }, 10_000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Send a text message through the WebSocket connection.
   */
  send(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected. Call connect() first.');
    }
    this.ws.send(message);
  }

  /**
   * Wait for the next message from the server.
   * Resolves with the received message string.
   */
  waitForMessage(timeoutMs = 10_000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket is not connected. Call connect() first.'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for WebSocket message (${timeoutMs}ms)`));
      }, timeoutMs);

      this.ws.once('message', (data) => {
        clearTimeout(timeout);
        resolve(data.toString());
      });

      this.ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.once('close', () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket closed while waiting for message'));
      });
    });
  }

  /**
   * Close the WebSocket connection gracefully.
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      this.ws.on('close', () => resolve());
      this.ws.close();
    });
  }
}

// ─────────────────────────────────────────────
// Message utilities
// ─────────────────────────────────────────────

/** Default field values for a test message */
const DEFAULT_FIELDS: string[] = [
  '1',                    // 0:  id_cliente
  '1',                    // 1:  id_producto
  '2024-01-15',           // 2:  fecha_sello
  'Test Event',           // 3:  evento_sello
  '2024-01-15',           // 4:  fecha_ticket
  'normal',               // 5:  modo_ticket
  'Modelo1',              // 6:  modelo1_ticket
  'Modelo2',              // 7:  modelo2_ticket
  'normal',               // 8:  modo_maquina
  'KIOSK-01',             // 9:  nombre_maquina
  'Enero',                // 10: mes_maquina
  'ES',                   // 11: pais_maquina
  '2024',                 // 12: year_maquina
  '1 0 0 0 0 0 0 0 0 0 0 0', // 13: cantidades (12 values)
  '1.50 2.00 3.00 4.00',     // 14: precios (4 values)
  'Test Company',         // 15: empresa
  'B12345678',            // 16: cif
  '28001',                // 17: cp
  'Calle Test 1',         // 18: l1
  'Piso 2',              // 19: l2
  'Madrid',              // 20: l3
  'Test Feria',          // 21: feria
  'Madrid',              // 22: lugar
  '',                    // 23: T1especial
  '',                    // 24: T2especial
  '',                    // 25: T3especial
  '',                    // 26: TEmod1
  '',                    // 27: TEmod2
  'false',               // 28: ImprimeCopiaTicket
  'true',                // 29: ImprimeMasterTicket
  'normal',              // 30: modo_ticket_copia
];

/**
 * Build a valid 31-field WebSocket test message with sensible defaults.
 * Override specific fields by passing a partial map of field index → value.
 *
 * @param overrides - Map of field index (0-30) to custom value
 * @returns A complete message string with fields joined by `*¿?*`
 *
 * @example
 *   // Use defaults
 *   const msg = buildTestMessage();
 *
 *   // Override id_cliente and cantidades
 *   const msg = buildTestMessage({ 0: '42', 13: '2 1 0 0 0 0 0 0 0 0 0 0' });
 */
export function buildTestMessage(overrides?: Record<number, string>): string {
  const fields = [...DEFAULT_FIELDS];

  if (overrides) {
    for (const [index, value] of Object.entries(overrides)) {
      const i = Number(index);
      if (i >= 0 && i < NUM_FIELDS) {
        fields[i] = value;
      }
    }
  }

  return fields.join(SEPARATOR);
}

/**
 * Parse a raw WebSocket message string into an array of 31 fields.
 *
 * @param raw - The raw message string from the WebSocket
 * @returns Array of 31 field values
 * @throws Error if the message doesn't have exactly 31 fields
 */
export function parseMessage(raw: string): string[] {
  const fields = raw.split(SEPARATOR);
  if (fields.length !== NUM_FIELDS) {
    throw new Error(
      `Invalid message: expected ${NUM_FIELDS} fields, got ${fields.length}`
    );
  }
  return fields;
}
