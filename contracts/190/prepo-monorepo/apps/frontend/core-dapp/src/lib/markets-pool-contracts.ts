import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedMarketPools =
  | 'PREFAKESTOCK_LONG_POOL'
  | 'PREFAKESTOCK_SHORT_POOL'
  | 'PREFAKETOKEN_LONG_POOL'
  | 'PREFAKETOKEN_SHORT_POOL'

export const PREFAKESTOCK_LONG_POOL_ADDRESS: ExternalContract = {
  goerli: '0x7785e7dadf530e6d1a62c98c3ca9be911bba679e',
}

export const PREFAKESTOCK_SHORT_POOL_ADDRESS: ExternalContract = {
  goerli: '0x378b98617107f0d702e76678f396bc6f1da00832',
}

export const PREFAKETOKEN_LONG_POOL_ADDRESS: ExternalContract = {
  goerli: '0x54a7311e9c11c3c69d74b009b962b7c6b3b30eb4',
}

export const PREFAKETOKEN_SHORT_POOL_ADDRESS: ExternalContract = {
  goerli: '0xea260b4e3131ab43ae94205cb62b1245048b6fa5',
}

export const supportedMarketPools: SupportedContracts = {
  PREFAKESTOCK_LONG_POOL: PREFAKESTOCK_LONG_POOL_ADDRESS,
  PREFAKESTOCK_SHORT_POOL: PREFAKESTOCK_SHORT_POOL_ADDRESS,
  PREFAKETOKEN_LONG_POOL: PREFAKETOKEN_LONG_POOL_ADDRESS,
  PREFAKETOKEN_SHORT_POOL: PREFAKETOKEN_SHORT_POOL_ADDRESS,
}
