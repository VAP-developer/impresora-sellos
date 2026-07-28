import { handleIpc } from './handlers'
import { TariffGroupsRepository } from '../database/repositories/tariff-groups.repository'
import type {
  TariffGroupInput,
  TariffGroupUpdateInput
} from '../database/repositories/tariff-groups.repository'

/**
 * Registers IPC handlers for tariff group management.
 *
 * Channels:
 * - tariff-groups:getYears   → returns distinct years with groups (descending)
 * - tariff-groups:getAll     → returns all groups with tariffs
 * - tariff-groups:getByYear  → returns groups for a given year with tariffs
 * - tariff-groups:getById    → returns a single group by ID with tariffs
 * - tariff-groups:create     → creates a new group with tariffs
 * - tariff-groups:update     → updates an existing group and syncs tariffs
 * - tariff-groups:delete     → deletes a group (fails if in use by events)
 */
export function registerTariffGroupsHandlers(): void {
  const repo = new TariffGroupsRepository()

  handleIpc('tariff-groups:getYears', () => {
    return repo.getYears()
  })

  handleIpc('tariff-groups:getAll', () => {
    return repo.getAll()
  })

  handleIpc('tariff-groups:getByYear', (year: unknown) => {
    return repo.getByYear(year as number)
  })

  handleIpc('tariff-groups:getById', (id: unknown) => {
    return repo.getById(id as number)
  })

  handleIpc('tariff-groups:create', (input: unknown) => {
    return repo.create(input as TariffGroupInput)
  })

  handleIpc('tariff-groups:update', (id: unknown, input: unknown) => {
    return repo.update(id as number, input as TariffGroupUpdateInput)
  })

  handleIpc('tariff-groups:delete', (id: unknown) => {
    return repo.delete(id as number)
  })
}
