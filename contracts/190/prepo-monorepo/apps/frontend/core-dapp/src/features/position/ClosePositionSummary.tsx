import { Icon, spacingIncrement, TokenInput } from 'prepo-ui'
import { BigNumber } from 'ethers'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import styled from 'styled-components'
import { safeStringBN, validateStringToBN } from 'prepo-utils'
import TransactionSummary from '../../components/TransactionSummary'
import { Position } from '../portfolio/PortfolioStore'
import { useRootStore } from '../../context/RootStoreProvider'
import Table, { RowData } from '../../components/Table'
import { Callback } from '../../types/common.types'
import AdvancedSettingsModal from '../../components/AdvancedSettingsModal'
import { ERC20_UNITS } from '../../lib/constants'

type Props = {
  position: Required<Position>
}

const FormItem = styled.div<{ showBorderTop?: boolean }>`
  border-top: 1px solid
    ${({ theme, showBorderTop }): string =>
      showBorderTop ? theme.color.primaryAccent : 'transparent'};
  margin-bottom: ${spacingIncrement(24)};
  padding-top: ${({ showBorderTop }): string => (showBorderTop ? spacingIncrement(12) : '0')};
`

const SettingsIconWrapper = styled.div`
  cursor: pointer;
  :hover {
    svg,
    path {
      fill: ${({ theme }): string => theme.color.primary};
    }
  }
`

const TitleWrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding-right: ${spacingIncrement(36)};
`

const ClosePositionSummary: React.FC<Props> = ({ position }) => {
  const { advancedSettingsStore, portfolioStore, tradeStore, web3Store } = useRootStore()
  const { isSettingsOpen, setIsSettingsOpen } = advancedSettingsStore
  const { closeTrade, closeTradeHash, setCloseTradeHash } = tradeStore
  const { setSelectedPosition } = portfolioStore
  const { connected } = web3Store
  const [closeValue, setCloseValue] = useState(position.data.totalValue)
  const closeValueBN = parseUnits(safeStringBN(closeValue), position.data.decimals)
  const closeAmountBN = closeValueBN
    .mul(BigNumber.from(10).pow(ERC20_UNITS))
    .div(position.data.priceBN)

  const onClickSettings = (): void => setIsSettingsOpen(true)

  const handleClose = (): void => {
    setSelectedPosition(undefined)
    setCloseTradeHash(undefined)
  }

  const handleClosePosition = async (
    successCallback: Callback<string>,
    failedCallback: Callback<string>
  ): Promise<void> => {
    const {
      data: { token },
    } = position

    const { error } = await closeTrade(token, closeAmountBN, closeValueBN, position.market)

    if (error) {
      failedCallback(error)
    } else {
      successCallback()
    }
  }

  const tableData: RowData[] = [
    {
      label: 'Market',
      market: {
        name: position.market.name,
        position: position.position,
      },
    },
    {
      label: 'Position Value',
      amount: position.data.totalValue,
    },
  ]

  const pnlTableData = [
    {
      label: 'Estimated PNL',
      toolTip: 'Some tooltip',
      amount: position.data.pnl,
      percent: position.data.percentage,
    },
  ]

  if (isSettingsOpen) return <AdvancedSettingsModal />
  const insufficentBalance = closeValueBN.gt(position.data.totalValueBN)
  const buttonText = insufficentBalance ? 'Insufficent Position Value' : undefined

  return (
    <TransactionSummary
      data={tableData}
      onCancel={handleClose}
      onComplete={handleClose}
      disabled={insufficentBalance}
      onConfirm={handleClosePosition}
      onRetry={handleClosePosition}
      buttonText={buttonText}
      successButtonText="Close"
      title={
        <TitleWrapper>
          <span>Close Position</span>
          <SettingsIconWrapper onClick={onClickSettings}>
            <Icon name="settings" color="neutral5" width="19" height="20" />
          </SettingsIconWrapper>
        </TitleWrapper>
      }
      transactionHash={closeTradeHash}
      unlock={{
        amount: formatUnits(closeAmountBN, position.data.decimals),
        contentType: 'closeTrade',
        token: position.data.token,
      }}
      withoutModalButton
    >
      <FormItem showBorderTop>
        <TokenInput
          connected={connected}
          hideBalance
          onChange={(value): void => {
            if (validateStringToBN(value, position.data.decimals)) setCloseValue(value)
          }}
          max={position.data.totalValue}
          showSlider
          usd
          value={closeValue}
        />
      </FormItem>
      <Table percentagePrecision={2} data={pnlTableData} />
    </TransactionSummary>
  )
}

export default observer(ClosePositionSummary)
