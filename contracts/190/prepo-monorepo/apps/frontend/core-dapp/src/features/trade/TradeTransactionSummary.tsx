import { useRouter } from 'next/router'
import { observer } from 'mobx-react-lite'
import EstimateProfitLoss from './EstimateProfitLoss'
import TransactionSummary from '../../components/TransactionSummary/TransactionSummary'
import { Callback } from '../../types/common.types'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimatedValuation } from '../definitions'
import { Routes } from '../../lib/routes'
import { numberFormatter } from '../../utils/numberFormatter'

const { significantDigits } = numberFormatter
const HIGHLIGHT_IMPACT_BREAKPOINT = 5

const TradeTransactionSummary: React.FC = () => {
  const router = useRouter()
  const {
    tradeStore,
    preCTTokenStore,
    advancedSettingsStore: { slippage },
  } = useRootStore()
  const {
    openTradeAmountBN,
    openTradeAmount,
    openTradeHash,
    openTradeUILoading,
    setOpenTradeHash,
    tradeDisabled,
    selectedMarket,
    valuation: { raw, afterSlippage },
    direction,
  } = tradeStore

  const valuationDirection = direction === 'long' ? 'Maximum' : 'Minimum'

  const onCancel = (): void => {
    setOpenTradeHash(undefined)
  }

  const onComplete = (): void => {
    setOpenTradeHash(undefined)
    router.push(Routes.Portfolio)
  }

  const handlePlaceTrade = async (
    successCallback: Callback<string>,
    failedCallback: Callback<string>
  ): Promise<void> => {
    if (selectedMarket === undefined) {
      // this shouldn't ever happen unless we use this component in pages where markets aren't selected
      failedCallback('No market selected!')
      return
    }
    const { error } = await tradeStore.openTrade(selectedMarket)

    if (error) {
      failedCallback(error)
    } else {
      successCallback()
    }
  }

  const estimatedValuation = raw ?? 0
  const currentValuation = selectedMarket?.estimatedValuation?.value
  const valuationImpact = currentValuation
    ? numberFormatter.rawPercent(estimatedValuation / currentValuation - 1)
    : undefined

  const tradeTransactionSummary = [
    {
      label: 'Trade Size',
      amount: openTradeAmount,
    },
    {
      label: 'Expected Valuation',
      tooltip: <EstimatedValuation marketName={selectedMarket?.name ?? ''} />,
      amount: `$${significantDigits(estimatedValuation)}`,
      ignoreFormatAmount: true,
    },
    {
      label: 'Valuation Impact',
      amount: `${valuationImpact}%`,
      ignoreFormatAmount: true,
      warning: +(valuationImpact || 0) > HIGHLIGHT_IMPACT_BREAKPOINT,
    },
    {
      label: `${valuationDirection} Valuation After Slippage (${numberFormatter.percent(
        slippage
      )})`,
      amount: `$${significantDigits(afterSlippage ?? 0)}`,
      ignoreFormatAmount: true,
    },
  ]

  return (
    <TransactionSummary
      overrideText={selectedMarket === undefined ? 'Select a Market' : undefined}
      loading={openTradeUILoading(selectedMarket) || openTradeAmountBN === undefined}
      data={tradeTransactionSummary}
      disabled={tradeDisabled || raw === undefined || selectedMarket === undefined}
      onComplete={onComplete}
      onConfirm={handlePlaceTrade}
      onRetry={handlePlaceTrade}
      onCancel={onCancel}
      transactionHash={openTradeHash}
      successButtonText="View Portfolio"
      unlock={{
        amount: openTradeAmount,
        token: preCTTokenStore,
        contentType: 'openTrade',
      }}
    >
      {selectedMarket?.sliderSettings && (
        <EstimateProfitLoss
          sliderSettings={selectedMarket.sliderSettings}
          getProfitLossOnExit={selectedMarket.getProfitLossOnExit}
          openTradeAmount={openTradeAmount}
        />
      )}
    </TransactionSummary>
  )
}

export default observer(TradeTransactionSummary)
