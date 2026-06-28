import { handleIpc } from './handlers'
import { ImagesRepository } from '../database/repositories/images.repository'

/**
 * Registers IPC handlers for image management.
 *
 * Channels:
 * - images:upload — Uploads (inserts or replaces) an image as Base64 data URI
 * - images:remove — Removes an image by name
 * - images:getByName — Retrieves an image's name and data URI by name
 */
export function registerImagesHandlers(): void {
  const repo = new ImagesRepository()

  handleIpc('images:upload', (name: unknown, dataUri: unknown, type: unknown, size: unknown) => {
    repo.upload(name as string, dataUri as string, type as string, size as number)
  })

  handleIpc('images:remove', (name: unknown) => {
    repo.remove(name as string)
  })

  handleIpc('images:getByName', (name: unknown) => {
    return repo.getByName(name as string)
  })
}
