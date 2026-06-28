/**
 * Feature: stack-migration, Property 1: Round-trip del mensaje WebSocket (lado frontend)
 *
 * Property-based test that verifies the fundamental round-trip property of the
 * WebSocket message protocol from the frontend (JavaScript) side:
 *
 *   buildMessage(parseMessage(msg)) === msg
 *
 * For any valid WebSocket message (31 fields separated by `*¿?*`), parsing the
 * message into a structured object and then building it back into a string MUST
 * produce a message identical to the original.
 *
 * Framework: fast-check (JavaScript)
 * Minimum: 100 iterations
 * Validates: Requirements 3.3, 7.5, 8.4
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─────────────────────────────────────────────
// Protocol constants
// ─────────────────────────────────────────────

const SEPARADOR = '*¿?*'
const NUM_CAMPOS = 31

// ─────────────────────────────────────────────
// OrdenImpresion type (mirrors Python dataclass)
// ─────────────────────────────────────────────

interface OrdenImpresion {
  id_cliente: string          // Field 0
  id_producto: string         // Field 1
  fecha_sello: string         // Field 2
  evento_sello: string        // Field 3
  fecha_ticket: string        // Field 4
  modo_ticket: string         // Field 5
  modelo1_ticket: string      // Field 6
  modelo2_ticket: string      // Field 7
  modo_maquina: string        // Field 8
  nombre_maquina: string      // Field 9
  mes_maquina: string         // Field 10
  pais_maquina: string        // Field 11
  year_maquina: string        // Field 12
  cantidades: string          // Field 13 (12 values space-separated)
  precios: string             // Field 14 (4 values space-separated)
  empresa: string             // Field 15
  cif: string                 // Field 16
  cp: string                  // Field 17
  l1: string                  // Field 18
  l2: string                  // Field 19
  l3: string                  // Field 20
  feria: string               // Field 21
  lugar: string               // Field 22
  T1especial: string          // Field 23
  T2especial: string          // Field 24
  T3especial: string          // Field 25
  TEmod1: string              // Field 26
  TEmod2: string              // Field 27
  ImprimeCopiaTicket: string  // Field 28
  ImprimeMasterTicket: string // Field 29
  modo_ticket_copia: string   // Field 30
}

// ─────────────────────────────────────────────
// Protocol functions: parseMessage & buildMessage
// ─────────────────────────────────────────────

/**
 * Parse a raw WebSocket message string into a structured OrdenImpresion object.
 * The message must have exactly 31 fields separated by `*¿?*`.
 *
 * @throws Error if the message does not have exactly 31 fields.
 */
function parseMessage(msg: string): OrdenImpresion {
  const campos = msg.split(SEPARADOR)
  if (campos.length !== NUM_CAMPOS) {
    throw new Error(
      `Formato inválido: se esperaban ${NUM_CAMPOS} campos, se recibieron ${campos.length}`
    )
  }

  return {
    id_cliente: campos[0],
    id_producto: campos[1],
    fecha_sello: campos[2],
    evento_sello: campos[3],
    fecha_ticket: campos[4],
    modo_ticket: campos[5],
    modelo1_ticket: campos[6],
    modelo2_ticket: campos[7],
    modo_maquina: campos[8],
    nombre_maquina: campos[9],
    mes_maquina: campos[10],
    pais_maquina: campos[11],
    year_maquina: campos[12],
    cantidades: campos[13],
    precios: campos[14],
    empresa: campos[15],
    cif: campos[16],
    cp: campos[17],
    l1: campos[18],
    l2: campos[19],
    l3: campos[20],
    feria: campos[21],
    lugar: campos[22],
    T1especial: campos[23],
    T2especial: campos[24],
    T3especial: campos[25],
    TEmod1: campos[26],
    TEmod2: campos[27],
    ImprimeCopiaTicket: campos[28],
    ImprimeMasterTicket: campos[29],
    modo_ticket_copia: campos[30],
  }
}

/**
 * Build a raw WebSocket message string from a structured OrdenImpresion object.
 * Produces exactly 31 fields joined by `*¿?*`.
 */
function buildMessage(orden: OrdenImpresion): string {
  return [
    orden.id_cliente,
    orden.id_producto,
    orden.fecha_sello,
    orden.evento_sello,
    orden.fecha_ticket,
    orden.modo_ticket,
    orden.modelo1_ticket,
    orden.modelo2_ticket,
    orden.modo_maquina,
    orden.nombre_maquina,
    orden.mes_maquina,
    orden.pais_maquina,
    orden.year_maquina,
    orden.cantidades,
    orden.precios,
    orden.empresa,
    orden.cif,
    orden.cp,
    orden.l1,
    orden.l2,
    orden.l3,
    orden.feria,
    orden.lugar,
    orden.T1especial,
    orden.T2especial,
    orden.T3especial,
    orden.TEmod1,
    orden.TEmod2,
    orden.ImprimeCopiaTicket,
    orden.ImprimeMasterTicket,
    orden.modo_ticket_copia,
  ].join(SEPARADOR)
}

// ─────────────────────────────────────────────
// fast-check arbitraries (data generators)
// ─────────────────────────────────────────────

/**
 * Generate arbitrary text that does NOT contain the protocol separator.
 * If a field contained the separator, split() would produce more than 31 fields,
 * which is an invalid message by protocol definition.
 */
const campoTextoLibre = fc.string({ minLength: 0, maxLength: 50 })
  .filter(s => !s.includes(SEPARADOR) && !s.includes('\0'))

/**
 * Generate numeric ID fields (fields 0 and 1) as strings.
 */
const campoId = fc.integer({ min: 0, max: 99999 }).map(n => String(n))

/**
 * Generate field 13: 12 integer values separated by spaces.
 * Represents quantities per tariff and label type.
 */
const campoCantidades = fc.array(
  fc.integer({ min: 0, max: 999 }),
  { minLength: 12, maxLength: 12 }
).map(nums => nums.join(' '))

/**
 * Generate field 14: 4 decimal values separated by spaces.
 * Represents prices for tariffs A, A2, B, C.
 */
const campoPrecios = fc.array(
  fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })
    .map(f => f.toFixed(2)),
  { minLength: 4, maxLength: 4 }
).map(prices => prices.join(' '))

/**
 * Generate a valid 31-field WebSocket message.
 * Fields respect the protocol semantics:
 * - Fields 0,1: numeric IDs
 * - Field 13: 12 quantities space-separated
 * - Field 14: 4 prices space-separated
 * - All others: free text (without containing the separator)
 */
const mensajeWsValido = fc.tuple(
  campoId,              // 0:  id_cliente
  campoId,              // 1:  id_producto
  campoTextoLibre,      // 2:  fecha_sello
  campoTextoLibre,      // 3:  evento_sello
  campoTextoLibre,      // 4:  fecha_ticket
  campoTextoLibre,      // 5:  modo_ticket
  campoTextoLibre,      // 6:  modelo1_ticket
  campoTextoLibre,      // 7:  modelo2_ticket
  campoTextoLibre,      // 8:  modo_maquina
  campoTextoLibre,      // 9:  nombre_maquina
  campoTextoLibre,      // 10: mes_maquina
  campoTextoLibre,      // 11: pais_maquina
  campoTextoLibre,      // 12: year_maquina
  campoCantidades,      // 13: cantidades (12 values)
  campoPrecios,         // 14: precios (4 values)
  campoTextoLibre,      // 15: empresa
  campoTextoLibre,      // 16: cif
  campoTextoLibre,      // 17: cp
  campoTextoLibre,      // 18: l1
  campoTextoLibre,      // 19: l2
  campoTextoLibre,      // 20: l3
  campoTextoLibre,      // 21: feria
  campoTextoLibre,      // 22: lugar
  campoTextoLibre,      // 23: T1especial
  campoTextoLibre,      // 24: T2especial
  campoTextoLibre,      // 25: T3especial
  campoTextoLibre,      // 26: TEmod1
  campoTextoLibre,      // 27: TEmod2
  campoTextoLibre,      // 28: ImprimeCopiaTicket
  campoTextoLibre,      // 29: ImprimeMasterTicket
  campoTextoLibre,      // 30: modo_ticket_copia
).map(campos => campos.join(SEPARADOR))

// ─────────────────────────────────────────────
// Property-based tests
// ─────────────────────────────────────────────

describe('Feature: stack-migration, Property 1: Round-trip del mensaje WebSocket (lado frontend)', () => {

  it('buildMessage(parseMessage(msg)) === msg — round-trip identity', () => {
    fc.assert(
      fc.property(mensajeWsValido, (msg) => {
        const orden = parseMessage(msg)
        const resultado = buildMessage(orden)
        expect(resultado).toBe(msg)
      }),
      { numRuns: 200 }
    )
  })

  it('parseMessage produces an object with all 31 fields correctly assigned', () => {
    fc.assert(
      fc.property(mensajeWsValido, (msg) => {
        const campos = msg.split(SEPARADOR)
        const orden = parseMessage(msg)

        expect(orden.id_cliente).toBe(campos[0])
        expect(orden.id_producto).toBe(campos[1])
        expect(orden.fecha_sello).toBe(campos[2])
        expect(orden.evento_sello).toBe(campos[3])
        expect(orden.fecha_ticket).toBe(campos[4])
        expect(orden.modo_ticket).toBe(campos[5])
        expect(orden.modelo1_ticket).toBe(campos[6])
        expect(orden.modelo2_ticket).toBe(campos[7])
        expect(orden.modo_maquina).toBe(campos[8])
        expect(orden.nombre_maquina).toBe(campos[9])
        expect(orden.mes_maquina).toBe(campos[10])
        expect(orden.pais_maquina).toBe(campos[11])
        expect(orden.year_maquina).toBe(campos[12])
        expect(orden.cantidades).toBe(campos[13])
        expect(orden.precios).toBe(campos[14])
        expect(orden.empresa).toBe(campos[15])
        expect(orden.cif).toBe(campos[16])
        expect(orden.cp).toBe(campos[17])
        expect(orden.l1).toBe(campos[18])
        expect(orden.l2).toBe(campos[19])
        expect(orden.l3).toBe(campos[20])
        expect(orden.feria).toBe(campos[21])
        expect(orden.lugar).toBe(campos[22])
        expect(orden.T1especial).toBe(campos[23])
        expect(orden.T2especial).toBe(campos[24])
        expect(orden.T3especial).toBe(campos[25])
        expect(orden.TEmod1).toBe(campos[26])
        expect(orden.TEmod2).toBe(campos[27])
        expect(orden.ImprimeCopiaTicket).toBe(campos[28])
        expect(orden.ImprimeMasterTicket).toBe(campos[29])
        expect(orden.modo_ticket_copia).toBe(campos[30])
      }),
      { numRuns: 200 }
    )
  })

  it('double round-trip: parse → build → parse → build produces stable output', () => {
    fc.assert(
      fc.property(mensajeWsValido, (msg) => {
        const orden1 = parseMessage(msg)
        const msg2 = buildMessage(orden1)
        const orden2 = parseMessage(msg2)
        const msg3 = buildMessage(orden2)

        expect(msg).toBe(msg2)
        expect(msg2).toBe(msg3)
      }),
      { numRuns: 100 }
    )
  })

  it('parseMessage throws on incorrect number of fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }).filter(n => n !== NUM_CAMPOS),
        (numCampos) => {
          const campos = Array(numCampos).fill('campo')
          const mensajeInvalido = campos.join(SEPARADOR)

          expect(() => parseMessage(mensajeInvalido)).toThrow(
            `se esperaban ${NUM_CAMPOS} campos`
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('buildMessage always produces exactly 30 separators (31 fields)', () => {
    fc.assert(
      fc.property(mensajeWsValido, (msg) => {
        const orden = parseMessage(msg)
        const resultado = buildMessage(orden)
        const separatorMatches = resultado.match(/\*¿\?\*/g) || []
        expect(separatorMatches.length).toBe(30)
      }),
      { numRuns: 100 }
    )
  })
})
