/**
 * Verificación temporal final: genera con los renderizadores HTML nuevos
 *   - un SELLO (logo a toda la etiqueta)
 *   - una TIRA ESPECIAL (E1-E4)
 *   - un TICKET principal
 * para imprimirlos por la vía Electron y validarlos en papel.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

import { setTestFontsPath, setTestImagesPath } from '../stamp-renderer'
import { renderStampsHtml, renderEspecialStripHtml, resetFontCssCache } from '../stamp-html-renderer'
import { renderTicketHtml } from '../ticket-html-renderer'
import type { StampRenderParams } from '../stamp-renderer'

const PROJECT_ROOT = join(__dirname, '../../../..')
const OUT_DIR = join(PROJECT_ROOT, 'out/pdf-samples')
const SELLO_PATH = join(PROJECT_ROOT, 'bbdd-ferias/2026/test/test-sello.png')

beforeAll(() => {
  setTestFontsPath(join(PROJECT_ROOT, 'resources/fonts'))
  setTestImagesPath(join(PROJECT_ROOT, 'resources/images'))
  resetFontCssCache()
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
})

describe('Verificacion final HTML (sello + tira especial + ticket)', () => {
  it('SELLO: logo a toda la etiqueta', () => {
    const sello = 'data:image/png;base64,' + readFileSync(SELLO_PATH).toString('base64')
    const stamp: StampRenderParams = {
      tarifa: 'Tarifa A  0,50',
      fecha: '21-24 abril 2026',
      evento: 'Madrid',
      codigo: 'TEST-9ES26 0001-001',
      backgroundImage: null,
      printLogoPng: true,
      logoPngImage: sello
    }
    const html = renderStampsHtml([stamp])
    expect(html).toContain('55mm 25mm')
    writeFileSync(join(OUT_DIR, 'final-sello.html'), html, 'utf8')
  })

  it('TIRA ESPECIAL: E1-E4', () => {
    const html = renderEspecialStripHtml({
      codigos: ['TEST-01', 'TEST-02', 'TEST-03', 'TEST-04'],
      especial: '  -E',
      tarifa: 'Tarifa A3'
    })
    expect(html).toContain('55mm 25mm')
    writeFileSync(join(OUT_DIR, 'final-tira-especial.html'), html, 'utf8')
  })

  it('TICKET principal', () => {
    const html = renderTicketHtml({
      fechaTicket: '21/04/2026 10:30',
      modoTicket: 'Factura Simplificada',
      modelo1Ticket: 'Feria Madrid',
      modelo2Ticket: 'Feria Madrid 2',
      items: [
        { idProducto: 'AS1', cantidad: 3 },
        { idProducto: 'BS1', cantidad: 2 },
        { idProducto: 'AS2', cantidad: 1 }
      ],
      idCliente: 42,
      nombreMaquina: 'CH17',
      productos: [
        { idProducto: 'AS1', modo: 'S', precio: 0.5, nombre_ticket: 'Tarifa A' },
        { idProducto: 'BS1', modo: 'S', precio: 1.25, nombre_ticket: 'Tarifa B' },
        { idProducto: 'AS2', modo: 'S', precio: 0.5, nombre_ticket: 'Tarifa A' }
      ],
      feria: 'XLIX Feria Nacional del Sello',
      lugar: 'Plaza Mayor - Madrid',
      empresa: 'S.E. Correos y Telégrafos S.A.',
      cif: 'A83052407',
      cp: '28042 Madrid',
      l1: 'Exento de impuestos',
      l2: 'Objeto de coleccionismo',
      l3: 'No se admiten devoluciones'
    })
    expect(html).toContain('78mm')
    writeFileSync(join(OUT_DIR, 'final-ticket.html'), html, 'utf8')
  })
})
