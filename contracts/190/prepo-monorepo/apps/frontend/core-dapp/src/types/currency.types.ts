import { IconName } from 'prepo-ui'
import { RootStore } from '../stores/RootStore'
import { altCoinsMap, stableCoinsMap } from '../__mocks__/currency.mock'

export type SupportAltCoins = keyof typeof altCoinsMap
export type SupportedStableCoins = keyof typeof stableCoinsMap
export type SupportedCurrencies = SupportAltCoins | SupportedStableCoins

export type Currency = {
  balance?: number
  iconName: IconName
  id: SupportedCurrencies
  name: string
  sameUsdValue?: boolean
  value?: number
  storeName?: keyof RootStore
}
