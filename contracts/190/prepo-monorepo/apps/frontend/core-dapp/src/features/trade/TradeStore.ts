import { BigNumber, ethers } from 'ethers'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import QuoterABI from '../../../abi/uniswapV3Quoter.abi.json'
import { UNISWAP_QUOTER_ADDRESS } from '../../lib/external-contracts'
import { Erc20Store } from '../../stores/entities/Erc20.entity'
import { MarketEntity } from '../../stores/entities/MarketEntity'
import { RootStore } from '../../stores/RootStore'
import { TradeType } from '../../stores/SwapStore'
import { debounce } from '../../utils/debounce'
import { makeQueryString } from '../../utils/makeQueryString'
import { calculateValuation } from '../../utils/market-utils'

export type Direction = 'long' | 'short'
export type TradeAction = 'open' | 'close'
type SlideUpContent = 'OpenMarket' | 'OpenCurrency' | 'ClosePosition' | 'CloseCurrency'

const DEFAULT_DIRECTION = 'long'

export class TradeStore {
  action: TradeAction = 'open'
  closeTradeHash?: string
  direction: Direction = DEFAULT_DIRECTION
  openTradeAmount = ''
  openTradeAmountOutBN?: BigNumber
  openTradeHash?: string
  selectedMarket?: MarketEntity
  slideUpContent?: SlideUpContent = undefined

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribeOpenTradeAmountOut()
  }

  subscribeOpenTradeAmountOut(): void {
    reaction(
      () => ({
        selectedMarket: this.selectedMarket,
        openTradeAmountBN: this.openTradeAmountBN,
        direction: this.direction,
      }),
      async ({ openTradeAmountBN, selectedMarket }) => {
        if (!selectedMarket || openTradeAmountBN === undefined) {
          this.openTradeAmountOutBN = undefined
          return
        }
        if (openTradeAmountBN.eq(0)) {
          this.openTradeAmountOutBN = BigNumber.from(0)
          return
        }

        this.openTradeAmountOutBN = undefined // clean up while new amountOut gets loaded
        const openTradeAmountOutBN = await this.quoteExactInput(selectedMarket)
        runInAction(() => {
          this.openTradeAmountOutBN = openTradeAmountOutBN
        })
      }
    )
  }

  openTradeUILoading(selectedMarket?: MarketEntity): boolean {
    if (selectedMarket === undefined) return false
    return (
      selectedMarket[`${this.direction}TokenPrice`] === undefined ||
      this.openTradeAmountOutBN === undefined
    )
  }

  setAction(action: TradeAction): string {
    this.action = action
    return this.tradeUrl
  }

  setCloseTradeHash(hash?: string): void {
    this.closeTradeHash = hash
  }

  setSlideUpContent(slideUpContent?: SlideUpContent): void {
    this.slideUpContent = slideUpContent
  }

  setDirection(direction: Direction, selectedMarket?: MarketEntity): string {
    this.direction = direction
    selectedMarket?.setSelectedPool(direction)
    return this.tradeUrl
  }

  setSelectedMarket(marketUrlId?: string): string {
    if (!marketUrlId) {
      this.selectedMarket = undefined
      return this.tradeUrl
    }
    const market = this.root.marketStore.markets[marketUrlId]
    this.selectedMarket = market
    return this.tradeUrl
  }

  setOpenTradeAmount(amount: string): void {
    if (validateStringToBN(amount, this.root.preCTTokenStore.decimalsNumber))
      this.openTradeAmount = amount
  }

  setOpenTradeHash(hash?: string): void {
    this.openTradeHash = hash
  }

  get openTradeAmountOut(): string | undefined {
    if (!this.selectedMarket || this.openTradeAmountOutBN === undefined) return undefined
    const token = this.selectedMarket[`${this.direction}Token`]
    return token?.formatUnits(this.openTradeAmountOutBN)
  }

  get openTradeAmountBN(): BigNumber | undefined {
    return this.root.preCTTokenStore.parseUnits(this.openTradeAmount)
  }

  get tradeUrl(): string {
    return makeQueryString({
      marketId: this.selectedMarket?.urlId,
      direction: this.direction,
      action: this.action,
    })
  }

  get valuation(): { raw?: number | undefined; afterSlippage?: number | undefined } {
    if (
      !this.selectedMarket ||
      this.openTradeAmountOut === undefined ||
      this.openTradeAmountOut === undefined
    )
      return {}
    const { payoutRange, valuationRange } = this.selectedMarket
    if (!valuationRange || !payoutRange) return {}

    const price = +this.openTradeAmount / +this.openTradeAmountOut
    const longTokenPrice = this.direction === 'long' ? price : 1 - price

    const { slippage } = this.root.advancedSettingsStore
    const amountOutAfterSlippage = +this.openTradeAmountOut * (1 - slippage)
    const priceAfterSlippage = +this.openTradeAmount / amountOutAfterSlippage
    const longTokenPriceAfterSlippage =
      this.direction === 'long' ? priceAfterSlippage : 1 - priceAfterSlippage

    return {
      raw: calculateValuation({ longTokenPrice, payoutRange, valuationRange }),
      afterSlippage: calculateValuation({
        longTokenPrice: longTokenPriceAfterSlippage,
        payoutRange,
        valuationRange,
      }),
    }
  }

  quoteExactInput = debounce(
    async (selectedMarket: MarketEntity): Promise<BigNumber | undefined> => {
      const selectedToken = selectedMarket[`${this.direction}Token`]
      const pool = selectedMarket[`${this.direction}Pool`]
      const state = pool?.poolState
      const fee = pool?.poolImmutables?.fee
      if (!fee || !selectedToken || !state || !this.openTradeAmount || !selectedToken.address) {
        return undefined
      }
      const tokenAddressFrom = this.root.preCTTokenStore.uniswapToken.address
      const tokenAddressTo = selectedToken.address
      const quoterContract = new ethers.Contract(
        UNISWAP_QUOTER_ADDRESS.mainnet ?? '', // all uniswap contracts has same address on all chains
        QuoterABI,
        this.root.web3Store.coreProvider
      )

      try {
        const sqrtPriceLimitX96 = 0 // The price limit of the pool that cannot be exceeded by the swap
        return await quoterContract.callStatic.quoteExactInputSingle(
          tokenAddressFrom,
          tokenAddressTo,
          fee,
          this.openTradeAmountBN,
          sqrtPriceLimitX96
        )
      } catch (e) {
        this.root.toastStore.errorToast('Error calculating output amount', e)
        return undefined
      }
    },
    400
  )

  // eslint-disable-next-line require-await
  async openTrade(selectedMarket: MarketEntity): Promise<{ success: boolean; error?: string }> {
    const selectedToken = selectedMarket[`${this.direction}Token`]
    const price = selectedMarket[`${this.direction}TokenPrice`]
    const fee = selectedMarket[`${this.direction}Pool`]?.poolImmutables?.fee
    const { swap } = this.root.swapStore
    const { uniswapToken } = this.root.preCTTokenStore
    if (
      !selectedToken?.address ||
      price === undefined ||
      fee === undefined ||
      this.openTradeAmountBN === undefined ||
      this.openTradeAmountOutBN === undefined
    )
      return { success: false }

    this.setOpenTradeHash(undefined)
    return swap({
      fee,
      fromAmount: this.openTradeAmountBN,
      fromTokenAddress: uniswapToken.address,
      toAmount: this.openTradeAmountOutBN,
      toTokenAddress: selectedToken.address,
      type: TradeType.EXACT_INPUT,
      onHash: (hash) => this.setOpenTradeHash(hash),
    })
  }

  // eslint-disable-next-line require-await
  async closeTrade(
    token: Erc20Store,
    amount: BigNumber,
    tokensReceivable: BigNumber,
    selectedMarket: MarketEntity
  ): Promise<{ success: boolean; error?: string }> {
    this.setCloseTradeHash(undefined)

    const fee = selectedMarket[`${this.direction}Pool`]?.poolImmutables?.fee
    const { swap } = this.root.swapStore
    const { uniswapToken } = this.root.preCTTokenStore
    if (!token.address || !uniswapToken.address || fee === undefined)
      return { success: false, error: 'Please try again later.' }

    return swap({
      fee,
      fromAmount: amount,
      fromTokenAddress: token.address,
      toTokenAddress: uniswapToken.address,
      toAmount: tokensReceivable,
      type: TradeType.EXACT_INPUT,
      onHash: (hash) => this.setCloseTradeHash(hash),
    })
  }

  get tradeDisabled(): boolean {
    const { preCTTokenStore } = this.root
    const { tokenBalanceRaw } = preCTTokenStore
    return this.openTradeAmountBN && tokenBalanceRaw
      ? this.openTradeAmountBN.gt(tokenBalanceRaw)
      : false
  }
}
