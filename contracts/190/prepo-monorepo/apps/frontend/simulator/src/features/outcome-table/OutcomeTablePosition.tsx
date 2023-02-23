import React from 'react'
import styled from 'styled-components'
import OutcomeTableRow, { RowData } from './OutcomeTableRow'
import OutcomeTableTop from './OutcomeTableTop'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectOutcome } from '../position/outcome-selector'
import { spacingIncrement } from '../app/themes'
import { actions } from '../position/position-slice'
import StepNumberInput from '../../components/StepNumberInput'
import { formatPercent } from '../../helpers'
import { DEFAULT_HOLDING_PERIOD_MESSAGE, MAX_FEE, MAX_REWARD } from '../../constants'

const Wrapper = styled.div`
  margin-bottom: ${spacingIncrement(4)};
`

const OutcomeTablePosition: React.FC = () => {
  const dispatch = useAppDispatch()
  const outcome = useAppSelector(selectOutcome)
  const position = useAppSelector((state) => state.position)
  const isLP = position.type === 'lp'

  const editComponentMintFee = (
    <StepNumberInput
      label="Fee"
      suffix="%"
      value={formatPercent(position.fees.mint, false)}
      min={0}
      max={MAX_FEE * 100}
      onLeftButtonClick={(value): void => {
        dispatch(actions.mintFeeChanged(value))
      }}
      onRightButtonClick={(value): void => {
        dispatch(actions.mintFeeChanged(value))
      }}
      onCustomInput={(input: number): void => {
        dispatch(actions.mintFeeChanged(input))
      }}
    />
  )

  const editComponentRedemptionFee = (
    <StepNumberInput
      min={0}
      max={MAX_FEE * 100}
      label="Fee"
      suffix="%"
      value={formatPercent(position.fees.redeem, false)}
      onLeftButtonClick={(value): void => {
        dispatch(actions.redeemFeeChanged(value))
      }}
      onRightButtonClick={(value): void => {
        dispatch(actions.redeemFeeChanged(value))
      }}
      onCustomInput={(input: number): void => {
        dispatch(actions.redeemFeeChanged(input))
      }}
    />
  )

  const editComponentFeesEarned = (
    <StepNumberInput
      min={0}
      max={MAX_REWARD * 100}
      label="APY"
      suffix="%"
      value={formatPercent(position.swapFeeApy, false)}
      onLeftButtonClick={(value): void => {
        dispatch(actions.swapFeeApyChanged(value))
      }}
      onRightButtonClick={(value): void => {
        dispatch(actions.swapFeeApyChanged(value))
      }}
      onCustomInput={(input: number): void => {
        dispatch(actions.swapFeeApyChanged(input))
      }}
    />
  )

  const mintFeeData: RowData = {
    signImg: 'minus',
    label: 'Deposit Fee',
    toolTip: 'PPO token holders can vote to enact a deposit fee.',
    fee: outcome.fees.mint,
    roi: -position.fees.mint,
    editComponent: editComponentMintFee,
  }

  const redemptionFeeData: RowData = {
    signImg: 'minus',
    label: 'Withdrawal Fee',
    toolTip: 'PPO token holders can vote to enact a withdrawal fee.',
    fee: outcome.fees.redeem,
    roi: -position.fees.redeem,
    editComponent: editComponentRedemptionFee,
  }

  const positionProfitData: RowData = {
    signImg: outcome.profit.marketPosition.amount >= 0 ? 'plus' : 'minus',
    label: 'Position Profit',
    fee: outcome.profit.marketPosition.amount,
    roi: outcome.profit.marketPosition.percent,
  }

  const feesEarnedData: RowData = {
    signImg: 'plus',
    label: 'Fees Earned',
    fee: outcome.profit.swapFee.amount,
    roi: outcome.profit.swapFee.percent,
    editComponent: editComponentFeesEarned,
    toolTip: `LP fees. ${position.ui.mode === 'basic' ? DEFAULT_HOLDING_PERIOD_MESSAGE : ''}`,
  }

  const traderRowsData: RowData[] = [
    mintFeeData,
    {
      signImg: outcome.profit.marketPosition.amount >= 0 ? 'plus' : 'minus',
      label: 'Trading Profit',
      fee: outcome.profit.marketPosition.amount,
      roi: outcome.profit.marketPosition.percent,
    },
    redemptionFeeData,
  ]

  const lpRowsData: RowData[] = [mintFeeData, positionProfitData, feesEarnedData, redemptionFeeData]
  const tableRowsData = isLP ? lpRowsData : traderRowsData

  const onEdit = (): void => {
    dispatch(actions.setEditingPositionTable(!position.ui.editingPositionTable))
  }

  return (
    <Wrapper>
      <OutcomeTableTop
        label="Position"
        profit={outcome.profit.total.amount}
        roi={outcome.profit.total.percent}
        isEditing={position.ui.editingPositionTable}
        onEdit={onEdit}
        canEdit={position.size !== 0}
      />
      {tableRowsData.map((rowData) => (
        <OutcomeTableRow
          key={rowData.label}
          signImg={rowData?.signImg}
          label={rowData.label}
          toolTip={rowData.toolTip}
          fee={rowData.fee}
          roi={rowData.roi}
          isEditing={position.ui.editingPositionTable}
          editComponent={rowData.editComponent}
          canEdit={position.size !== 0}
        />
      ))}
    </Wrapper>
  )
}

export default OutcomeTablePosition
