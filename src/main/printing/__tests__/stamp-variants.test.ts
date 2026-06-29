/**
 * Tests for stamp-variants.ts
 * Verifies the high-level genStampI, genStampD, and genStamp functions.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { join } from 'path'

// Mock @electron-toolkit/utils to avoid Electron dependency in tests
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

import {
  genStampI,
  genStampD,
  genStamp,
  isMdccMachine,
  calcVecesEspecial,
  genStampE1,
  genStampE2,
  ESPECIAL_SUFFIX_MOD1,
  ESPECIAL_SUFFIX_MOD2,
  GenStampParams,
  GenStampMdccParams,
  GenStampEspecialParams,
  ImageResolver
} from '../stamp-variants'
import { setTestFontsPath, setTestImagesPath } from '../stamp-renderer'

// The actual fonts path from the project root
const PROJECT_ROOT = join(__dirname, '../../../..')
const FONTS_PATH = join(PROJECT_ROOT, 'resources/fonts')
const IMAGES_PATH = join(PROJECT_ROOT, 'resources/images')

beforeAll(() => {
  setTestFontsPath(FONTS_PATH)
  setTestImagesPath(IMAGES_PATH)
})

afterAll(() => {
  setTestFontsPath(null)
  setTestImagesPath(null)
})

// Minimal 1x1 PNG as base64 data URI for testing
const MOCK_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Mock image resolver that returns a predefined image for known model names */
function createMockResolver(images: Record<string, string>): ImageResolver {
  return {
    getByName(name: string) {
      const url = images[name]
      if (url) return { name, url }
      return null
    }
  }
}

describe('stamp-variants', () => {
  const baseGenStampParams: GenStampParams = {
    modelName: 'FeriaMadrid2025_izq',
    tarifa: 'Tarifa A',
    fecha: '21-24 abril 2025',
    evento: 'Madrid',
    codigo: 'P4ES25 CH17-0001-001'
  }

  const baseMdccParams: GenStampMdccParams = {
    tarifa: 'Tarifa B',
    fecha: '21-24 abril 2025',
    evento: 'Madrid',
    codigo: 'P4ES25 MD25-0001-001'
  }

  describe('genStampI', () => {
    it('should generate a valid PDF buffer with background image from resolver', async () => {
      const resolver = createMockResolver({
        FeriaMadrid2025_izq: MOCK_IMAGE_DATA_URI
      })

      const buffer = await genStampI(baseGenStampParams, resolver)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should generate a valid PDF even when model image is not found', async () => {
      const resolver = createMockResolver({}) // no images

      const buffer = await genStampI(baseGenStampParams, resolver)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should generate a larger PDF when background image exists vs no image', async () => {
      const resolverWithImage = createMockResolver({
        FeriaMadrid2025_izq: MOCK_IMAGE_DATA_URI
      })
      const resolverEmpty = createMockResolver({})

      const bufferWithImage = await genStampI(baseGenStampParams, resolverWithImage)
      const bufferNoImage = await genStampI(baseGenStampParams, resolverEmpty)

      // PDF with an embedded image should be larger
      expect(bufferWithImage.length).toBeGreaterThan(bufferNoImage.length)
    })

    it('should handle empty model name gracefully', async () => {
      const resolver = createMockResolver({})
      const params: GenStampParams = { ...baseGenStampParams, modelName: '' }

      const buffer = await genStampI(params, resolver)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })
  })

  describe('genStampD', () => {
    it('should generate a valid PDF buffer with background image from resolver', async () => {
      const resolver = createMockResolver({
        FeriaMadrid2025_der: MOCK_IMAGE_DATA_URI
      })

      const params: GenStampParams = { ...baseGenStampParams, modelName: 'FeriaMadrid2025_der' }
      const buffer = await genStampD(params, resolver)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should generate a valid PDF even when model image is not found', async () => {
      const resolver = createMockResolver({}) // no images

      const params: GenStampParams = { ...baseGenStampParams, modelName: 'NonExistent' }
      const buffer = await genStampD(params, resolver)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should produce the same PDF structure as genStampI with same inputs', async () => {
      const resolver = createMockResolver({
        SameModel: MOCK_IMAGE_DATA_URI
      })

      const params: GenStampParams = { ...baseGenStampParams, modelName: 'SameModel' }
      const bufferI = await genStampI(params, resolver)
      const bufferD = await genStampD(params, resolver)

      // Both functions are functionally identical, so same input → same output
      expect(bufferI.length).toBe(bufferD.length)
    })
  })

  describe('genStamp (mdcc mode)', () => {
    it('should generate a valid PDF without custom background', async () => {
      const buffer = await genStamp(baseMdccParams)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should generate a PDF with reasonable content size', async () => {
      const buffer = await genStamp(baseMdccParams)

      // Should have text content (tarifa, fecha, evento, codigo)
      expect(buffer.length).toBeGreaterThan(1000)
    })

    it('should not require a model name', async () => {
      // genStamp doesn't take a modelName - it's for machines that don't use custom images
      const params: GenStampMdccParams = {
        tarifa: 'Tarifa C',
        fecha: '1-5 mayo 2025',
        evento: 'Barcelona',
        codigo: 'P5ES25 MD25-0042-001'
      }

      const buffer = await genStamp(params)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should handle all tarifa types', async () => {
      const tarifas = ['Tarifa A', 'Tarifa A2', 'Tarifa B', 'Tarifa C']

      for (const tarifa of tarifas) {
        const buffer = await genStamp({ ...baseMdccParams, tarifa })
        expect(buffer).toBeInstanceOf(Buffer)
        expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
      }
    })
  })

  describe('isMdccMachine', () => {
    it('should return true for machines starting with "MD"', () => {
      expect(isMdccMachine('MD25')).toBe(true)
      expect(isMdccMachine('MD01')).toBe(true)
      expect(isMdccMachine('MDXX')).toBe(true)
    })

    it('should return true for lowercase "md" prefix', () => {
      expect(isMdccMachine('md25')).toBe(true)
      expect(isMdccMachine('Md01')).toBe(true)
    })

    it('should return false for non-MD machines', () => {
      expect(isMdccMachine('CH17')).toBe(false)
      expect(isMdccMachine('FI01')).toBe(false)
      expect(isMdccMachine('VA01')).toBe(false)
      expect(isMdccMachine('PM01')).toBe(false)
      expect(isMdccMachine('KK01')).toBe(false)
      expect(isMdccMachine('IR01')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isMdccMachine('')).toBe(false)
    })

    it('should return false for strings containing MD but not starting with it', () => {
      expect(isMdccMachine('AMD01')).toBe(false)
      expect(isMdccMachine('XMD')).toBe(false)
    })
  })

  describe('integration: choosing variant based on machine', () => {
    it('should use genStamp for MD machines (no custom background)', async () => {
      const machineName = 'MD25'
      expect(isMdccMachine(machineName)).toBe(true)

      const buffer = await genStamp({
        tarifa: 'Tarifa A',
        fecha: '21-24 abril 2025',
        evento: 'Madrid',
        codigo: 'P4ES25 MD25-0001-001'
      })

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should use genStampI/genStampD for non-MD machines (with background)', async () => {
      const machineName = 'CH17'
      expect(isMdccMachine(machineName)).toBe(false)

      const resolver = createMockResolver({
        MotivoFeria: MOCK_IMAGE_DATA_URI
      })

      const bufferI = await genStampI(
        {
          modelName: 'MotivoFeria',
          tarifa: 'Tarifa A',
          fecha: '21-24 abril 2025',
          evento: 'Madrid',
          codigo: 'P4ES25 CH17-0001-001'
        },
        resolver
      )

      const bufferD = await genStampD(
        {
          modelName: 'MotivoFeria',
          tarifa: 'Tarifa A',
          fecha: '21-24 abril 2025',
          evento: 'Madrid',
          codigo: 'P4ES25 CH17-0001-002'
        },
        resolver
      )

      expect(bufferI).toBeInstanceOf(Buffer)
      expect(bufferD).toBeInstanceOf(Buffer)
      expect(bufferI.slice(0, 5).toString()).toBe('%PDF-')
      expect(bufferD.slice(0, 5).toString()).toBe('%PDF-')
    })
  })

  describe('calcVecesEspecial', () => {
    it('should return 0 when amount is below all thresholds', () => {
      expect(calcVecesEspecial(100, 200, 400, 600)).toBe(0)
    })

    it('should return 1 when amount exceeds only T1', () => {
      expect(calcVecesEspecial(250, 200, 400, 600)).toBe(1)
    })

    it('should return 2 when amount exceeds T1 and T2', () => {
      expect(calcVecesEspecial(450, 200, 400, 600)).toBe(2)
    })

    it('should return 3 when amount exceeds all thresholds', () => {
      expect(calcVecesEspecial(700, 200, 400, 600)).toBe(3)
    })

    it('should return 0 when amount equals T1 exactly (not greater than)', () => {
      expect(calcVecesEspecial(200, 200, 400, 600)).toBe(0)
    })

    it('should return 1 when amount equals T2 exactly', () => {
      expect(calcVecesEspecial(400, 200, 400, 600)).toBe(1)
    })

    it('should return 2 when amount equals T3 exactly', () => {
      expect(calcVecesEspecial(600, 200, 400, 600)).toBe(2)
    })

    it('should default threshold to 500 when value is 0 (legacy behavior)', () => {
      // All thresholds 0 → all default to 500
      expect(calcVecesEspecial(499, 0, 0, 0)).toBe(0)
      expect(calcVecesEspecial(501, 0, 0, 0)).toBe(3) // > 500 exceeds all (all are 500)
    })

    it('should default only zero thresholds to 500, keeping non-zero ones', () => {
      // T1=100, T2=0 (→500), T3=0 (→500)
      expect(calcVecesEspecial(150, 100, 0, 0)).toBe(1) // > 100 but not > 500
      expect(calcVecesEspecial(501, 100, 0, 0)).toBe(3) // > 500 exceeds T2 and T3
    })

    it('should return 0 for negative amounts', () => {
      expect(calcVecesEspecial(-10, 200, 400, 600)).toBe(0)
    })

    it('should return 0 when amount is 0', () => {
      expect(calcVecesEspecial(0, 200, 400, 600)).toBe(0)
    })
  })

  describe('genStampE1 (modelo 1 special strip)', () => {
    const baseEspecialParams: GenStampEspecialParams = {
      codigos: ['CODE-001', 'CODE-002', 'CODE-003', 'CODE-004'],
      tarifa: 'Tarifa A3'
    }

    it('should generate a valid multi-page PDF buffer', async () => {
      const buffer = await genStampE1(baseEspecialParams)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should use ESPECIAL_SUFFIX_MOD1 ("  -E") as the especial suffix', () => {
      expect(ESPECIAL_SUFFIX_MOD1).toBe('  -E')
    })

    it('should produce a 4-page PDF (one page per stamp: E1, E2, E3, E4)', async () => {
      const buffer = await genStampE1(baseEspecialParams)
      const pdfContent = buffer.toString('latin1')

      // Count page objects in the PDF structure — each /Type /Page indicates a page
      const pageMatches = pdfContent.match(/\/Type\s*\/Page[^s]/g)
      expect(pageMatches).not.toBeNull()
      expect(pageMatches!.length).toBe(4)
    })
  })

  describe('genStampE2 (modelo 2 special strip)', () => {
    const baseEspecialParams: GenStampEspecialParams = {
      codigos: ['CODE-005', 'CODE-006', 'CODE-007', 'CODE-008'],
      tarifa: 'Tarifa A3'
    }

    it('should generate a valid multi-page PDF buffer', async () => {
      const buffer = await genStampE2(baseEspecialParams)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    })

    it('should use ESPECIAL_SUFFIX_MOD2 ("-E") as the especial suffix', () => {
      expect(ESPECIAL_SUFFIX_MOD2).toBe('-E')
    })

    it('should produce a 4-page PDF (one page per stamp: E1, E2, E3, E4)', async () => {
      const buffer = await genStampE2(baseEspecialParams)
      const pdfContent = buffer.toString('latin1')

      const pageMatches = pdfContent.match(/\/Type\s*\/Page[^s]/g)
      expect(pageMatches).not.toBeNull()
      expect(pageMatches!.length).toBe(4)
    })

    it('should produce a different suffix than genStampE1', () => {
      expect(ESPECIAL_SUFFIX_MOD1).not.toBe(ESPECIAL_SUFFIX_MOD2)
      expect(ESPECIAL_SUFFIX_MOD1.length).toBeGreaterThan(ESPECIAL_SUFFIX_MOD2.length)
    })
  })
})
