import { ExternalContract, SupportedContracts } from './contract.types'

export type SupportedExternalContractsNames =
  | 'DAI'
  | 'USDC'
  | 'UNISWAP_SWAP_ROUTER'
  | 'UNISWAP_QUOTER'

export const DAI_ADDRESS: ExternalContract = {
  mainnet: '0x6b175474e89094c44da98b954eedeac495271d0f',
  ropsten: '0xad6d458402f60fd3bd25163575031acdce07538d',
}

export const USDC_ADDRESS: ExternalContract = {
  mainnet: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  ropsten: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
  goerli: '0xaFF4481D10270F50f203E0763e2597776068CBc5', // Wenus
}

export const UNISWAP_SWAP_ROUTER_ADDRESS: ExternalContract = {
  mainnet: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  goerli: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
}

export const UNISWAP_QUOTER_ADDRESS: ExternalContract = {
  mainnet: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  goerli: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
}

export const supportedExternalTokenContracts: SupportedContracts = {
  DAI: DAI_ADDRESS,
  USDC: USDC_ADDRESS,
  UNISWAP_SWAP_ROUTER: UNISWAP_SWAP_ROUTER_ADDRESS,
  UNISWAP_QUOTER: UNISWAP_QUOTER_ADDRESS,
}
