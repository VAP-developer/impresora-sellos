import { handleIpc } from './handlers'
import { EventosRepository } from '../database/repositories/eventos.repository'
import type { EventoInput } from '../database/repositories/eventos.repository'

/**
 * Registers IPC handlers for event (evento) management.
 *
 * Channels:
 * - eventos:getYears       → returns distinct years
 * - eventos:getByYear      → returns all events for a given year
 * - eventos:getById        → returns a single event by ID
 * - eventos:create         → creates a new event
 * - eventos:update         → updates an existing event
 * - eventos:delete         → deletes an event by ID
 */
export function registerEventosHandlers(): void {
  const repo = new EventosRepository()

  handleIpc('eventos:getYears', () => {
    return repo.getYears()
  })

  handleIpc('eventos:getByYear', (year: unknown) => {
    return repo.getByYear(year as number)
  })

  handleIpc('eventos:getById', (id: unknown) => {
    return repo.getById(id as number)
  })

  handleIpc('eventos:create', (input: unknown) => {
    return repo.create(input as EventoInput)
  })

  handleIpc('eventos:update', (id: unknown, input: unknown) => {
    return repo.update(id as number, input as Partial<EventoInput>)
  })

  handleIpc('eventos:delete', (id: unknown) => {
    return repo.delete(id as number)
  })
}
