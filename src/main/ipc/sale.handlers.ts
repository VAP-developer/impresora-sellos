/**
 * sale.handlers.ts
 *
 * IPC handler for the atomic sale execution.
 * Exposes the `sale:execute` channel to the renderer process.
 *
 * After a successful sale transaction, generates all PDFs (stamps + tickets),
 * stores them in a module-level cache, and enqueues them in the print queue
 * for background processing by the PrintQueueService.
 *
 * Validates: Requirements 8.1 (route to correct printer), 8.2 (ticket routing),
 * 8.5 (retry on error), 18.2 (persist before sending)
 */

import { handleIpc, notifyConfigChanged } from './handlers'
import { ConfigRepository } from '../database/repositories/config.repository'
import { ImagesRepository } from '../database/repositories/images.repository'
import { executeSale, cancelSale } from '../sales/sale.service'
import { generateSalePdfs } from '../printing/pdf-generator'
import { buildImageName } from '../images/sync-images'
import { getPrintQueueService } from '../services'
import type { GeneratedPdf, SaleGenerationResult, ImageLayerOptions } from '../printing/pdf-generator'
import type { AppConfig } from '../database/repositories/config.repository'
import type {
  KioskoQuantities,
  SaleOutcome,
  CancelSaleInput,
  CancelSaleOutcome
} from '../sales/sale.service'

// ─── PDF Cache ────────────────────────────────────────────────────────────────

/**
 * Module-level cache storing generated PDFs keyed by session ID.
 * Used for backward compatibility and immediate access.
 * The primary flow now goes through the print queue service.
 */
const pdfCache: Map<number, GeneratedPdf[]> = new Map()

/**
 * Retrieves and removes cached PDFs for a given session ID.
 * Returns null if no PDFs are cached for that session.
 */
export function consumePdfsForSession(sesionId: number): GeneratedPdf[] | null {
  const pdfs = pdfCache.get(sesionId)
  if (pdfs) {
    pdfCache.delete(sesionId)
    return pdfs
  }
  return null
}

/**
 * Returns the current PDF cache (for testing/inspection purposes).
 */
export function getPdfCache(): Map<number, GeneratedPdf[]> {
  return pdfCache
}

// ─── Handler Registration ─────────────────────────────────────────────────────

/**
 * Registers IPC handlers for the sale flow.
 *
 * Channels:
 * - sale:execute — Executes an atomic sale transaction, then generates PDFs
 */
export function registerSaleHandlers(): void {
  const configRepo = new ConfigRepository()

  handleIpc(
    'sale:execute',
    async (config: unknown, quantities: unknown, profile: unknown, imageFlags: unknown): Promise<SaleOutcome> => {
      const typedConfig = config as AppConfig
      const typedQuantities = quantities as KioskoQuantities
      const typedProfile = profile as string
      const typedImageFlags = imageFlags as { printFondo: boolean; printSello: boolean } | undefined

      // Step 1: Execute atomic sale transaction (synchronous SQLite)
      const result = executeSale(typedConfig, typedQuantities, typedProfile)

      // If transaction failed, return error immediately (no PDFs generated per Req 11.3)
      if (!result.success) {
        return result
      }

      // Step 2: Notify renderer of config change
      notifyConfigChanged(configRepo.get())

      // Step 3: Generate PDFs with the UPDATED session ID
      // Build config with the new codigo.cliente from the transaction result
      const updatedConfig: AppConfig = {
        ...typedConfig,
        codigo: {
          ...typedConfig.codigo,
          cliente: result.sesionId
        }
      }

      // Step 3b: Build ImageLayerOptions if image flags were provided
      let imageLayerOptions: ImageLayerOptions | undefined
      if (typedImageFlags) {
        const imagesRepo = new ImagesRepository()
        const imagenesConfig = configRepo.getImagenes()
        let fondoImage: string | null = null
        let selloImage: string | null = null

        if (imagenesConfig.activeFair) {
          const { year, fairName } = imagenesConfig.activeFair
          const fondoName = buildImageName(year, fairName, 'fondo')
          const selloName = buildImageName(year, fairName, 'sello')

          const fondoRecord = imagesRepo.getByName(fondoName)
          const selloRecord = imagesRepo.getByName(selloName)

          fondoImage = fondoRecord?.url ?? null
          selloImage = selloRecord?.url ?? null
        }

        imageLayerOptions = {
          printFondo: typedImageFlags.printFondo,
          printSello: typedImageFlags.printSello,
          fondoImage,
          selloImage
        }
      }

      try {
        const pdfResult: SaleGenerationResult = await generateSalePdfs(
          updatedConfig,
          typedQuantities,
          typedProfile,
          undefined,
          imageLayerOptions
        )

        // Store PDFs in cache for backward compatibility
        pdfCache.set(result.sesionId, pdfResult.pdfs)

        // Enqueue PDFs in the print queue for background processing (Req 18.2)
        let printJobIds: number[] = []
        try {
          const queueService = getPrintQueueService()
          printJobIds = queueService.enqueue(pdfResult.pdfs)
        } catch (enqueueErr) {
          const enqueueError =
            enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)
          console.error('[Sale] Failed to enqueue PDFs in print queue:', enqueueError)
          // PDFs are still cached — not a fatal error for the sale
        }

        // Add PDF metadata to the sale result
        return {
          ...result,
          pdfCount: pdfResult.stampCount + pdfResult.ticketCount,
          stampCount: pdfResult.stampCount,
          ticketCount: pdfResult.ticketCount,
          printJobIds
        }
      } catch (err) {
        // PDF generation failed but sale data is already committed
        // Report the error but don't fail the sale
        const pdfError = err instanceof Error ? err.message : String(err)
        console.error('[Sale] PDF generation failed after successful transaction:', pdfError)

        return {
          ...result,
          pdfError: `Error generando PDFs: ${pdfError}`
        }
      }
    }
  )

  // ─── Cancel Sale Handler ──────────────────────────────────────────────────

  handleIpc(
    'sale:cancel',
    async (input: unknown): Promise<CancelSaleOutcome> => {
      const typedInput = input as CancelSaleInput

      // Execute atomic cancellation transaction
      const result = cancelSale(typedInput)

      if (result.success) {
        // Notify renderer of config change
        notifyConfigChanged(configRepo.get())
      }

      return result
    }
  )
}
