import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedMarkets = 'PREFAKESTOCK_MARKET_ADDRESS' | 'PREFAKETOKEN_MARKET_ADDRESS'

export const PREFAKESTOCK_MARKET_ADDRESS: ExternalContract = {
  goerli: '0x4F290AbCeC143F15d3dBbb3f9065e3715d6B9193',
}
export const PREFAKETOKEN_MARKET_ADDRESS: ExternalContract = {
  goerli: '0xDcd20e0769dBD2609f9d280b274fb1D2bDA2E82B',
}

export const supportedMarkets: SupportedContracts = {
  PREFAKESTOCK_MARKET_ADDRESS,
  PREFAKETOKEN_MARKET_ADDRESS,
}
