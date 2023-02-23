import { ExternalContract } from './contract.types'

export type CoreTokenContractNames =
  | 'MBT'
  | 'preCT'
  | 'PREPO_HELPER'
  | 'SINGLE_STRATEGY_CONTROLLER'
  | 'MOCK_STRATEGY'
  | 'MARKET_FACTORY'
  | 'PREPO_MARKET'
  | 'PPO'
  | 'PPO_STAKING'

export type CoreContracts = {
  [key in CoreTokenContractNames]: ExternalContract
}

export const BASE_TOKEN_ADDRESS: ExternalContract = {
  goerli: '0xc0D34e36D829Ac4fbDcb9aE42FcbA14ff6C434d5',
}

export const COLLATERAL_TOKEN_ADDRESS: ExternalContract = {
  goerli: '0xab7F09a1bd92AE0508884e6ab02a7A11dF83512D',
}

export const PREPO_HELPER_ADDRESS: ExternalContract = {
  goerli: '0xF22219e8479C964D1131B138F8C55c2b8b7201B8',
}

export const SINGLE_STRATEGY_CONTROLLER_ADDRESS: ExternalContract = {
  goerli: '0xcf88bb8f916705D199B597e6131C9febE5289aE1',
}

export const MOCK_STRATEGY_ADDRESS: ExternalContract = {
  goerli: '0x595F50A830A3a34686c8BA37467D7D1962c0d63E',
}

export const MARKET_FACTORY_ADDRESS: ExternalContract = {
  goerli: '0x0FE8d6f54e49f10c5cF91c475aa9C2018Df9468e',
}

export const PREPO_MARKET_ADDRESS: ExternalContract = {
  goerli: '0xa98559c16233f173ECf26b39b1331C36c736Ab38',
}

export const PPO_ADDRESS: ExternalContract = {
  goerli: '0xfD4D774f151f210F5761d60CC6618378658269f6',
}

export const PPO_STAKING_ADDRESS: ExternalContract = {
  goerli: 'Not yet deployed',
}

export const coreContracts: CoreContracts = {
  MBT: BASE_TOKEN_ADDRESS,
  preCT: COLLATERAL_TOKEN_ADDRESS,
  PREPO_HELPER: PREPO_HELPER_ADDRESS,
  SINGLE_STRATEGY_CONTROLLER: SINGLE_STRATEGY_CONTROLLER_ADDRESS,
  MOCK_STRATEGY: MOCK_STRATEGY_ADDRESS,
  MARKET_FACTORY: MARKET_FACTORY_ADDRESS,
  PREPO_MARKET: PREPO_MARKET_ADDRESS,
  PPO: PPO_ADDRESS,
  PPO_STAKING: PPO_STAKING_ADDRESS,
}
