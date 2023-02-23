import { BigNumber, ethers } from 'ethers'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { makeAutoObservable, runInAction, toJS } from 'mobx'
import { SEC_IN_MS, GasPriceSuggestions, GasPriceSource, GasSpeed } from 'prepo-constants'
import { sleep, truncateAmountString } from 'prepo-utils'
import { RootStore } from './RootStore'

type GasPriceSuggestionsInNumber = {
  [key in GasSpeed]?: number
}

// every api has different paths to get the different level of gas price
// hence we need a dynamic way to find gas price
const findGasPriceByPath = (gasMap: unknown, path: string): BigNumber | undefined => {
  const keys = path.split('.')
  let cur = gasMap
  for (let i = 0; i < keys.length; i++) {
    if (typeof cur === 'object' && cur !== null) {
      const key = keys[i]
      if (key in cur) {
        cur = (cur as { [key: string]: unknown })[key]
      }
    }
  }
  if (typeof cur === 'number' || typeof cur === 'string')
    return ethers.utils.parseUnits(`${cur}`, 'gwei')
  return undefined
}

const multiplyGasPrice = (
  gasPrice: BigNumber,
  multiplier: number,
  multiplierPrecision?: number
): BigNumber => {
  const precision = multiplierPrecision ?? 10
  return gasPrice.mul(multiplier * precision).div(precision)
}

const getGasPrices = async (
  gasPriceChecker: GasPriceSource
): Promise<GasPriceSuggestions | undefined> => {
  try {
    const res = await fetch(gasPriceChecker.url)
    const gasJson = await res.json()
    const { fastPath } = gasPriceChecker.paths
    const fast = findGasPriceByPath(gasJson, fastPath)
    // if any of these is undefined, it's probably API failure, hence, return false
    // to load alternative api
    if (fast === undefined) throw Error('Gas price API incomplete.')
    return {
      [GasSpeed.VERYFAST]: multiplyGasPrice(fast, 1.4),
      [GasSpeed.FAST]: multiplyGasPrice(fast, 1.2),
    }
  } catch (error) {
    // if any error occur, return false to try alternative API
    // if everything doesn't work, use fallback api
    return undefined
  }
}
export class GasStore {
  cachedGasPrice: Omit<GasPriceSuggestions, 'Custom'>
  customGasInput?: number = undefined
  gasSpeed = GasSpeed.FAST
  root: RootStore<unknown>
  constructor(root: RootStore<unknown>) {
    this.cachedGasPrice = {}
    this.root = root
    makeAutoObservable(this, {}, { autoBind: true })
    this.updateGasPrice()
  }

  reset(): void {
    this.setCustomGasPrice()
    this.setGasSpeed(GasSpeed.FAST)
  }

  setCustomGasPrice(gasPrice?: number): void {
    if (gasPrice === undefined) {
      this.customGasInput = undefined
      return
    }
    this.customGasInput = gasPrice
    this.setGasSpeed(GasSpeed.CUSTOM)
  }

  setGasSpeed(gasSpeed: GasSpeed): void {
    this.gasSpeed = gasSpeed
  }

  async updateGasPrice(): Promise<void> {
    const { gasPriceCheckers } = this.root.web3Store.network
    const jsGasPriceCheckers = toJS(gasPriceCheckers)
    const gasPriceMap: GasPriceSuggestions = {}
    let successGasPriceCount = 0
    if (jsGasPriceCheckers && jsGasPriceCheckers.length > 0) {
      for (let i = 0; i < jsGasPriceCheckers.length; i++) {
        const gasPriceChecker = jsGasPriceCheckers[i]
        // eslint-disable-next-line no-await-in-loop
        const curGasPrice = await getGasPrices(gasPriceChecker)
        if (curGasPrice !== undefined) {
          Object.keys(curGasPrice).forEach((key) => {
            const gasSpeed = key as GasSpeed
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            gasPriceMap[gasSpeed] = curGasPrice[gasSpeed].add(gasPriceMap[gasSpeed] ?? 0)
          })
          successGasPriceCount += 1
        }
      }
      runInAction(() => {
        Object.keys(gasPriceMap).forEach((gasSpeed) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.cachedGasPrice[gasSpeed] = gasPriceMap[gasSpeed].div(successGasPriceCount)
        })
      })
      // only fetch next update 5 seconds after all current calls are resolved
      await sleep(SEC_IN_MS * 5)
      this.updateGasPrice()
    }
  }

  get gasPrice(): BigNumber {
    return this.gasPriceOptions[this.gasSpeed]
  }

  get gasPriceOptions(): Required<GasPriceSuggestions> {
    const fallbackGasPrice = this.root.web3Store.network.gasPrice || parseUnits('60', 'gwei')
    const customGas =
      this.customGasInput === undefined ? undefined : parseUnits(`${this.customGasInput}`, 'gwei')
    return {
      // if dynamic price is undefined, it's either we haven't got the data since page load or there was API failure
      // hence, use fallbackGasPrice with multiplier
      [GasSpeed.FAST]: this.cachedGasPrice.Fast || multiplyGasPrice(fallbackGasPrice, 1.5),
      [GasSpeed.VERYFAST]:
        this.cachedGasPrice[GasSpeed.VERYFAST] || multiplyGasPrice(fallbackGasPrice, 2),
      [GasSpeed.CUSTOM]: customGas ?? fallbackGasPrice,
    }
  }

  get gasPriceOptionsNumber(): Required<GasPriceSuggestionsInNumber> {
    const options: GasPriceSuggestionsInNumber = {}
    Object.entries(this.gasPriceOptions).forEach(([speed, price]) => {
      options[speed as keyof GasPriceSuggestionsInNumber] = +truncateAmountString(
        formatUnits(price, 'gwei'),
        {
          maxDecimalDigits: 0,
          hideCommas: true,
        }
      )
    })
    return options as Required<GasPriceSuggestionsInNumber>
  }
}
