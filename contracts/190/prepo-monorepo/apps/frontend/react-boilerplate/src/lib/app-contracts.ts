import { ExternalContract } from './contract.types'

export type AppContractNames = 'UNISWAP_V2_ROUTER'

export type AppContracts = {
  [key in AppContractNames]: ExternalContract
}

export const UNISWAP_V2_ROUTER_ADDRESSES: ExternalContract = {
  mainnet: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  goerli: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
}

export const appContracts: AppContracts = {
  UNISWAP_V2_ROUTER: UNISWAP_V2_ROUTER_ADDRESSES,
}
