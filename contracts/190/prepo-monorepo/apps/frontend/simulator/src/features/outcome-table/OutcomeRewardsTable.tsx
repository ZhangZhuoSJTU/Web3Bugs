import React from 'react'
import styled from 'styled-components'
import OutcomeTableTop from './OutcomeTableTop'
import OutcomeTableRow, { RowData } from './OutcomeTableRow'
import { selectOutcome } from '../position/outcome-selector'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { spacingIncrement } from '../app/themes'
import StepNumberInput from '../../components/StepNumberInput'
import { formatPercent } from '../../helpers'
import { actions } from '../position/position-slice'
import { DEFAULT_HOLDING_PERIOD_MESSAGE, MAX_REWARD } from '../../constants'

const Wrapper = styled.div`
  margin-bottom: ${spacingIncrement(4)};
`

const OutcomeRewardsTable: React.FC = () => {
  const dispatch = useAppDispatch()
  const position = useAppSelector((state) => state.position)
  const outcome = useAppSelector(selectOutcome)

  const editComponentCollateralFarming = (
    <StepNumberInput
      label="APR"
      suffix="%"
      min={0}
      max={MAX_REWARD * 100}
      value={formatPercent(position.rewards.collateralFarming, false)}
      onLeftButtonClick={(value): void => {
        dispatch(actions.collateralFarmingApyChanged(value))
      }}
      onRightButtonClick={(value): void => {
        dispatch(actions.collateralFarmingApyChanged(value))
      }}
      onCustomInput={(input: number): void => {
        dispatch(actions.collateralFarmingApyChanged(input))
      }}
    />
  )

  const editComponentPPO = (
    <StepNumberInput
      label="APR"
      min={0}
      max={MAX_REWARD * 100}
      suffix="%"
      value={formatPercent(position.rewards.ppo, false)}
      onLeftButtonClick={(value): void => {
        dispatch(actions.ppoApyChanged(value))
      }}
      onRightButtonClick={(value): void => {
        dispatch(actions.ppoApyChanged(value))
      }}
      onCustomInput={(input: number): void => {
        dispatch(actions.ppoApyChanged(input))
      }}
    />
  )

  const collateralFarmingData: RowData = {
    signImg: 'plus',
    label: 'Collateral Farming',
    toolTip: `Your deposit in prePO grows passively in value from yield farms. ${
      position.ui.mode === 'basic' ? DEFAULT_HOLDING_PERIOD_MESSAGE : ''
    }`,
    fee: outcome.rewards.collateralFarming.amount,
    roi: outcome.rewards.collateralFarming.percent,
    editComponent: editComponentCollateralFarming,
  }

  const PPOData: RowData = {
    signImg: 'plus',
    label: 'PPO',
    toolTip: `Traders and LPs are rewarded with PPO tokens for actively using the platform. ${
      position.ui.mode === 'basic' ? DEFAULT_HOLDING_PERIOD_MESSAGE : ''
    }`,
    fee: outcome.rewards.ppo.amount,
    roi: outcome.rewards.ppo.percent,
    editComponent: editComponentPPO,
  }

  const tableRowsData: RowData[] = [collateralFarmingData, PPOData]

  const onEdit = (): void => {
    dispatch(actions.setEditingRewardsTable(!position.ui.editingRewardsTable))
  }

  return (
    <Wrapper>
      <OutcomeTableTop
        label="Rewards"
        profit={outcome.rewards.total.amount}
        roi={outcome.rewards.total.percent}
        isEditing={position.ui.editingRewardsTable}
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
          isEditing={position.ui.editingRewardsTable}
          editComponent={rowData.editComponent}
          canEdit={position.size !== 0}
        />
      ))}
    </Wrapper>
  )
}

export default OutcomeRewardsTable
