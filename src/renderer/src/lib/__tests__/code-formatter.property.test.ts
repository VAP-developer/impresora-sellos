/**
 * Property-based tests for code-formatter.ts
 *
 * Tests correctness Property 3 as defined in the design spec.
 *
 * Property 3: Formato correcto del Código de Etiqueta
 *
 * For any valid code configuration (modo, mes 1-12, país, año, máquina,
 * cliente 0-9999, producto), the formatted code must conform to the pattern:
 *   {modo}{mesFormateado}{país}{año2dígitos} {máquina}-{cliente4dígitos}-{producto3dígitos}
 *
 * Where months 10/11/12 are represented as O/N/D and the client ID is
 * zero-padded to 4 digits.
 *
 * Validates: Requirements 3.1, 3.4, 3.7
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  formatMes,
  formatAnnio,
  formatCliente,
  formatProducto,
  formatLabelCode,
  isClienteOverflow
} from '../code-formatter'
import type { CodigoConfig } from '@renderer/types/config'

// ─── Arbitraries (data generators) ─────────────────────────────────────────────

/** Generate a valid month (1-12) for manual config */
const arbMonth = fc.integer({ min: 1, max: 12 })

/** Generate a mes config value (0 = auto, 1-12 = manual) */
const arbMesCfg = fc.integer({ min: 0, max: 12 })

/** Generate a modo string (single uppercase letter) */
const arbModo = fc.constantFrom('P', 'F', 'M', 'D', 'E')

/** Generate a país code (2 uppercase letters) */
const arbPais = fc.constantFrom('ES', 'AD', 'FR', 'PT', 'IT', 'DE', 'GB', 'US')

/** Generate an año config ("auto" or 2-digit year string) */
const arbAnnioCfg = fc.oneof(
  fc.constant('auto'),
  fc.integer({ min: 0, max: 99 }).map((n) => n.toString())
)

/** Generate a máquina code (alphanumeric, 2-6 chars) */
const arbMaquina = fc.constantFrom('CH17', 'FI01', 'MA03', 'BC12', 'AD01', 'ZZ99')

/** Generate a valid cliente ID (0-9999) */
const arbCliente = fc.integer({ min: 0, max: 9999 })

/** Generate an overflow cliente ID (>9999) */
const arbClienteOverflow = fc.integer({ min: 10000, max: 99999 })

/** Generate a valid producto number (1-999) */
const arbProducto = fc.integer({ min: 1, max: 999 })

/** Generate a valid CodigoConfig */
const arbCodigoConfig: fc.Arbitrary<CodigoConfig> = fc.record({
  modo: arbModo,
  mes: arbMesCfg,
  annio: arbAnnioCfg,
  pais: arbPais,
  maquina: arbMaquina,
  cliente: arbCliente,
  producto: arbProducto
})

/** Generate a CodigoConfig with overflowed cliente */
const arbCodigoOverflow: fc.Arbitrary<CodigoConfig> = fc.record({
  modo: arbModo,
  mes: arbMesCfg,
  annio: arbAnnioCfg,
  pais: arbPais,
  maquina: arbMaquina,
  cliente: arbClienteOverflow,
  producto: arbProducto
})

/** Generate a fixed Date for deterministic testing */
const arbDate = fc
  .record({
    year: fc.integer({ min: 2020, max: 2035 }),
    month: fc.integer({ min: 0, max: 11 }), // JS months are 0-indexed
    day: fc.integer({ min: 1, max: 28 })
  })
  .map(({ year, month, day }) => new Date(year, month, day))

// ─── Property 3: Formato correcto del Código de Etiqueta ────────────────────────

describe('Property 3: Formato correcto del Código de Etiqueta', () => {
  describe('formatMes', () => {
    it('months 1-9 are represented as their numeric string value', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 9 }), (month) => {
          const result = formatMes(month)
          expect(result).toBe(month.toString())
        }),
        { numRuns: 100 }
      )
    })

    it('month 10 (October) is represented as "O"', () => {
      expect(formatMes(10)).toBe('O')
    })

    it('month 11 (November) is represented as "N"', () => {
      expect(formatMes(11)).toBe('N')
    })

    it('month 12 (December) is represented as "D"', () => {
      expect(formatMes(12)).toBe('D')
    })

    it('mes=0 (auto) uses the current system month', () => {
      fc.assert(
        fc.property(arbDate, (date) => {
          const result = formatMes(0, date)
          const expectedMonth = date.getMonth() + 1

          if (expectedMonth === 10) expect(result).toBe('O')
          else if (expectedMonth === 11) expect(result).toBe('N')
          else if (expectedMonth === 12) expect(result).toBe('D')
          else expect(result).toBe(expectedMonth.toString())
        }),
        { numRuns: 200 }
      )
    })

    it('manual month (1-12) always produces a single character output', () => {
      fc.assert(
        fc.property(arbMonth, (month) => {
          const result = formatMes(month)
          expect(result.length).toBe(1)
        }),
        { numRuns: 100 }
      )
    })

    it('result is never empty for any valid month config', () => {
      fc.assert(
        fc.property(arbMesCfg, arbDate, (mesCfg, date) => {
          const result = formatMes(mesCfg, date)
          expect(result.length).toBeGreaterThan(0)
        }),
        { numRuns: 200 }
      )
    })
  })

  describe('formatAnnio', () => {
    it('"auto" uses last two digits of the current year', () => {
      fc.assert(
        fc.property(arbDate, (date) => {
          const result = formatAnnio('auto', date)
          const expected = (date.getFullYear() - 2000).toString()
          expect(result).toBe(expected)
        }),
        { numRuns: 200 }
      )
    })

    it('non-"auto" values are returned as-is', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }).map((n) => n.toString()),
          (yearStr) => {
            const result = formatAnnio(yearStr)
            expect(result).toBe(yearStr)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('result is never empty', () => {
      fc.assert(
        fc.property(arbAnnioCfg, arbDate, (annioCfg, date) => {
          const result = formatAnnio(annioCfg, date)
          expect(result.length).toBeGreaterThan(0)
        }),
        { numRuns: 200 }
      )
    })
  })

  describe('formatCliente', () => {
    it('values 0-9999 are zero-padded to exactly 4 digits', () => {
      fc.assert(
        fc.property(arbCliente, (cliente) => {
          const result = formatCliente(cliente)
          expect(result).toHaveLength(4)
          expect(result).toMatch(/^\d{4}$/)
          expect(parseInt(result, 10)).toBe(cliente)
        }),
        { numRuns: 1000 }
      )
    })

    it('values > 9999 return overflow sentinel "HACER RESET"', () => {
      fc.assert(
        fc.property(arbClienteOverflow, (cliente) => {
          const result = formatCliente(cliente)
          expect(result).toBe('HACER RESET')
        }),
        { numRuns: 200 }
      )
    })

    it('boundary: 0 formats as "0000"', () => {
      expect(formatCliente(0)).toBe('0000')
    })

    it('boundary: 9999 formats as "9999"', () => {
      expect(formatCliente(9999)).toBe('9999')
    })

    it('boundary: 10000 returns overflow sentinel', () => {
      expect(formatCliente(10000)).toBe('HACER RESET')
    })
  })

  describe('formatProducto', () => {
    it('values are zero-padded to exactly 3 digits', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 999 }), (producto) => {
          const result = formatProducto(producto)
          expect(result).toHaveLength(3)
          expect(result).toMatch(/^\d{3}$/)
          expect(parseInt(result, 10)).toBe(producto)
        }),
        { numRuns: 500 }
      )
    })

    it('boundary: 1 formats as "001"', () => {
      expect(formatProducto(1)).toBe('001')
    })

    it('boundary: 999 formats as "999"', () => {
      expect(formatProducto(999)).toBe('999')
    })
  })

  describe('formatLabelCode (full code formatting)', () => {
    it('produces the pattern {modo}{mes}{pais}{año} {maquina}-{cliente4}-{producto3}', () => {
      fc.assert(
        fc.property(arbCodigoConfig, arbDate, (codigo, date) => {
          const result = formatLabelCode(codigo, date)

          // Should not be null for valid client IDs
          expect(result).not.toBeNull()

          // Verify the code contains a single space separator
          const parts = result!.split(' ')
          expect(parts).toHaveLength(2)

          // The second part has the format: {maquina}-{cliente4}-{producto3}
          const rightParts = parts[1].split('-')
          expect(rightParts).toHaveLength(3)

          // Client is 4 digits
          expect(rightParts[1]).toMatch(/^\d{4}$/)
          expect(parseInt(rightParts[1], 10)).toBe(codigo.cliente)

          // Product is 3 digits
          expect(rightParts[2]).toMatch(/^\d{3}$/)
          expect(parseInt(rightParts[2], 10)).toBe(codigo.producto)

          // Machine matches
          expect(rightParts[0]).toBe(codigo.maquina)
        }),
        { numRuns: 1000 }
      )
    })

    it('left part starts with modo and contains pais', () => {
      fc.assert(
        fc.property(arbCodigoConfig, arbDate, (codigo, date) => {
          const result = formatLabelCode(codigo, date)!
          const leftPart = result.split(' ')[0]

          // Starts with modo
          expect(leftPart.startsWith(codigo.modo)).toBe(true)

          // Contains pais (2-letter country code)
          expect(leftPart).toContain(codigo.pais)
        }),
        { numRuns: 500 }
      )
    })

    it('the mes component is correctly placed between modo and pais', () => {
      fc.assert(
        fc.property(arbCodigoConfig, arbDate, (codigo, date) => {
          const result = formatLabelCode(codigo, date)!
          const leftPart = result.split(' ')[0]

          const expectedMes = formatMes(codigo.mes, date)
          const expectedAnnio = formatAnnio(codigo.annio, date)

          // Full left part should be: {modo}{mes}{pais}{año}
          const expectedLeft = `${codigo.modo}${expectedMes}${codigo.pais}${expectedAnnio}`
          expect(leftPart).toBe(expectedLeft)
        }),
        { numRuns: 1000 }
      )
    })

    it('reconstructed code matches the full expected format', () => {
      fc.assert(
        fc.property(arbCodigoConfig, arbDate, (codigo, date) => {
          const result = formatLabelCode(codigo, date)

          const expectedMes = formatMes(codigo.mes, date)
          const expectedAnnio = formatAnnio(codigo.annio, date)
          const expectedCliente = formatCliente(codigo.cliente)
          const expectedProducto = formatProducto(codigo.producto)

          const expected = `${codigo.modo}${expectedMes}${codigo.pais}${expectedAnnio} ${codigo.maquina}-${expectedCliente}-${expectedProducto}`
          expect(result).toBe(expected)
        }),
        { numRuns: 1000 }
      )
    })

    it('returns null when cliente exceeds 9999', () => {
      fc.assert(
        fc.property(arbCodigoOverflow, arbDate, (codigo, date) => {
          const result = formatLabelCode(codigo, date)
          expect(result).toBeNull()
        }),
        { numRuns: 200 }
      )
    })

    it('specific months O/N/D appear correctly in the code', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(10, 11, 12),
          arbModo,
          arbPais,
          arbAnnioCfg,
          arbMaquina,
          arbCliente,
          arbProducto,
          arbDate,
          (mes, modo, pais, annio, maquina, cliente, producto, date) => {
            const codigo: CodigoConfig = { modo, mes, annio, pais, maquina, cliente, producto }
            const result = formatLabelCode(codigo, date)!

            const mesChar = mes === 10 ? 'O' : mes === 11 ? 'N' : 'D'
            const leftPart = result.split(' ')[0]

            // After modo, the next char should be the month letter
            expect(leftPart[modo.length]).toBe(mesChar)
          }
        ),
        { numRuns: 300 }
      )
    })

    it('numeric months 1-9 appear as single digit in the code', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }),
          arbModo,
          arbPais,
          arbAnnioCfg,
          arbMaquina,
          arbCliente,
          arbProducto,
          arbDate,
          (mes, modo, pais, annio, maquina, cliente, producto, date) => {
            const codigo: CodigoConfig = { modo, mes, annio, pais, maquina, cliente, producto }
            const result = formatLabelCode(codigo, date)!
            const leftPart = result.split(' ')[0]

            // After modo, the next char should be the digit
            expect(leftPart[modo.length]).toBe(mes.toString())
          }
        ),
        { numRuns: 300 }
      )
    })
  })

  describe('isClienteOverflow', () => {
    it('returns false for values 0-9999', () => {
      fc.assert(
        fc.property(arbCliente, (cliente) => {
          expect(isClienteOverflow(cliente)).toBe(false)
        }),
        { numRuns: 500 }
      )
    })

    it('returns true for values > 9999', () => {
      fc.assert(
        fc.property(arbClienteOverflow, (cliente) => {
          expect(isClienteOverflow(cliente)).toBe(true)
        }),
        { numRuns: 200 }
      )
    })

    it('boundary: 9999 is not overflow', () => {
      expect(isClienteOverflow(9999)).toBe(false)
    })

    it('boundary: 10000 is overflow', () => {
      expect(isClienteOverflow(10000)).toBe(true)
    })
  })

  describe('Compositional consistency', () => {
    it('formatLabelCode is consistent with its component functions', () => {
      fc.assert(
        fc.property(arbCodigoConfig, arbDate, (codigo, date) => {
          const fullCode = formatLabelCode(codigo, date)
          if (fullCode === null) return // Skip overflow cases

          // Each component function should produce the same result
          // as its portion in the full code
          const mes = formatMes(codigo.mes, date)
          const annio = formatAnnio(codigo.annio, date)
          const cliente = formatCliente(codigo.cliente)
          const producto = formatProducto(codigo.producto)

          expect(fullCode).toContain(codigo.modo)
          expect(fullCode).toContain(mes)
          expect(fullCode).toContain(codigo.pais)
          expect(fullCode).toContain(annio)
          expect(fullCode).toContain(codigo.maquina)
          expect(fullCode).toContain(cliente)
          expect(fullCode).toContain(producto)
        }),
        { numRuns: 500 }
      )
    })

    it('isClienteOverflow is consistent with formatCliente sentinel', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 20000 }), (cliente) => {
          const isOverflow = isClienteOverflow(cliente)
          const formatted = formatCliente(cliente)

          if (isOverflow) {
            expect(formatted).toBe('HACER RESET')
          } else {
            expect(formatted).toMatch(/^\d{4}$/)
          }
        }),
        { numRuns: 500 }
      )
    })

    it('isClienteOverflow is consistent with formatLabelCode returning null', () => {
      fc.assert(
        fc.property(
          fc.record({
            modo: arbModo,
            mes: arbMesCfg,
            annio: arbAnnioCfg,
            pais: arbPais,
            maquina: arbMaquina,
            cliente: fc.integer({ min: 0, max: 20000 }),
            producto: arbProducto
          }),
          arbDate,
          (codigo, date) => {
            const isOverflow = isClienteOverflow(codigo.cliente)
            const result = formatLabelCode(codigo, date)

            if (isOverflow) {
              expect(result).toBeNull()
            } else {
              expect(result).not.toBeNull()
            }
          }
        ),
        { numRuns: 500 }
      )
    })
  })
})
