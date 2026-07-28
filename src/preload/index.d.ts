import type { ElectronAPI } from './index'

export type { Tariff, TariffGroup, TariffGroupInput, TariffInput, TariffGroupUpdateInput } from './index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
