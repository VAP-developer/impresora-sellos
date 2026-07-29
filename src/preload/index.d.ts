import type { ElectronAPI } from './index'

export type {
  TariffType,
  Tariff,
  Strip,
  TariffGroup,
  TariffGroupInput,
  TariffInput,
  StripInput,
  TariffGroupUpdateInput
} from './index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
