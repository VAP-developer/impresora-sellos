import { handleIpc, notifyConfigChanged } from './handlers'
import { ConfigRepository, type AppLanguage } from '../database/repositories/config.repository'

/**
 * Registers IPC handlers for configuration management.
 *
 * Channels:
 * - config:get
 * - config:updateMaquina
 * - config:updateImprimir
 * - config:updateSesion
 * - config:updateSesionError
 * - config:updateRollos
 * - config:updateRollosRevert
 * - config:initConfig
 * - config:getImagenes
 * - config:updateImagenes
 * - config:getCutNumber
 * - config:setCutNumber
 * - config:getLanguage
 * - config:setLanguage
 */
export function registerConfigHandlers(): void {
  const repo = new ConfigRepository()

  handleIpc('config:get', () => {
    return repo.get()
  })

  handleIpc('config:updateMaquina', (data: unknown) => {
    repo.updateMaquina(data as Parameters<ConfigRepository['updateMaquina']>[0])
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateImprimir', (data: unknown) => {
    repo.updateImprimir(data as Parameters<ConfigRepository['updateImprimir']>[0])
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateSesion', () => {
    repo.updateSesion()
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateSesionError', () => {
    repo.updateSesionError()
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateRollos', (sellos1: unknown, sellos2: unknown, tickets: unknown) => {
    repo.updateRollos(sellos1 as number, sellos2 as number, tickets as number)
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:updateRollosRevert', (sellos1: unknown, sellos2: unknown, tickets: unknown) => {
    repo.updateRollosRevert(sellos1 as number, sellos2 as number, tickets as number)
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:initConfig', () => {
    repo.initConfig()
    notifyConfigChanged(repo.get())
  })

  handleIpc('config:getImagenes', () => {
    return repo.getImagenes()
  })

  handleIpc('config:updateImagenes', (data: unknown) => {
    repo.updateImagenes(data as Parameters<ConfigRepository['updateImagenes']>[0])
  })

  handleIpc('config:getCutNumber', () => {
    return repo.getCutNumber()
  })

  handleIpc('config:setCutNumber', (value: unknown) => {
    repo.setCutNumber(value as number)
  })

  handleIpc('config:getLanguage', () => {
    return repo.getLanguage()
  })

  handleIpc('config:setLanguage', (value: unknown) => {
    repo.setLanguage(value as AppLanguage)
  })

  handleIpc('config:getPrintRotation', () => {
    return repo.getPrintRotation()
  })

  handleIpc('config:setPrintRotation', (value: unknown) => {
    repo.setPrintRotation(value as boolean)
  })
}
