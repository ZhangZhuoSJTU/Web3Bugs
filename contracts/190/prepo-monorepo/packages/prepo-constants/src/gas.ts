import { BigNumber } from 'ethers'

export enum GasSpeed {
  CUSTOM = 'Custom',
  FAST = 'Fast',
  VERYFAST = 'Very Fast',
}

export type GasPriceSuggestions = {
  [GasSpeed.VERYFAST]?: BigNumber
  // default to falbackGasPrice, this is also the value for custom gas price, which can be changed by user
  [GasSpeed.CUSTOM]?: BigNumber
  [GasSpeed.FAST]?: BigNumber
}

export type GasPriceSource = {
  url: string
  paths: {
    averagePath: string
    fastPath: string
    slowPath: string
  }
}

export const maticGas: GasPriceSource[] = [
  {
    url: 'https://gasstation-mainnet.matic.network/v2',
    paths: {
      averagePath: 'standard.maxFee',
      fastPath: 'fast.maxFee',
      slowPath: 'safeLow.maxFee',
    },
  },
  {
    url: 'https://gpoly.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle',
    paths: {
      averagePath: 'result.ProposeGasPrice',
      fastPath: 'result.FastGasPrice',
      slowPath: 'result.SafeGasPrice',
    },
  },
]
