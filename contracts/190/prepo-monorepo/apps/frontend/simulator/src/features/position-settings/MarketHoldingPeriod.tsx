import React from 'react'
import styled from 'styled-components'
import { Col, Row } from 'antd'
import { getHoldingPeriodLabel } from './utils/market-position-utils'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { actions, Periods } from '../position/position-slice'
import { spacingIncrement } from '../app/themes'
import Input from '../../components/Input'
import { MultiSelect, MultiSelectItem } from '../../components/MultiSelect'

const OuterWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: ${spacingIncrement(6)};
`

const Top = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.6rem;
`

const PromptText = styled.span`
  font-weight: bold;
`

const Period = styled.span`
  font-size: ${({ theme }): string => theme.fontSize.lgx};
  font-weight: bold;
  margin-left: 1rem;
`

const StyledMultiSelect = styled(MultiSelect)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  height: 1.5625rem;
  width: 6.9375rem;
`

const StyledInput = styled(Input)`
  font-size: ${({ theme }): string => theme.fontSize.lgx};
  height: auto;
  text-align: center;
`

const CenteredCol = styled(Col)`
  align-items: center;
  display: flex;
`

const MarketHoldingPeriod: React.FC = () => {
  const holdingPeriod = useAppSelector((state) => state.position.holdingPeriod)
  const positionUi = useAppSelector((state) => state.position.ui)
  const dispatch = useAppDispatch()

  const holdingPeriodChanged = (
    e: React.ChangeEvent<HTMLInputElement>
  ): { payload: number; type: string } => {
    const val = Math.round(parseInt(e.target.value, 10))
    return dispatch(actions.holdingPeriodNumChanged(val))
  }

  const periodUnitChanged = (unit: keyof Periods): void => {
    dispatch(actions.holdingPeriodUnitChanged(unit))
  }

  const onBlur = (): void => {
    if (Number.isNaN(holdingPeriod.num)) {
      dispatch(actions.holdingPeriodNumChanged(1))
    }
  }

  if (positionUi.mode !== 'advanced' || !positionUi.positionSettingsCompleted) return null

  return (
    <OuterWrapper>
      <Top>
        <PromptText>I want to hold for...</PromptText>
        <StyledMultiSelect selectedKey={holdingPeriod.unit}>
          <MultiSelectItem itemKey="Y" onClick={(): void => periodUnitChanged('Y')}>
            Y
          </MultiSelectItem>
          <MultiSelectItem itemKey="M" onClick={(): void => periodUnitChanged('M')}>
            M
          </MultiSelectItem>
          <MultiSelectItem itemKey="D" onClick={(): void => periodUnitChanged('D')}>
            D
          </MultiSelectItem>
        </StyledMultiSelect>
      </Top>

      <Row>
        <Col xs={16} lg={20}>
          <StyledInput
            type="number"
            textCentered
            onChange={holdingPeriodChanged}
            value={holdingPeriod.num}
            onBlur={onBlur}
          />
        </Col>
        <CenteredCol xs={8} lg={4}>
          <Period>{getHoldingPeriodLabel(holdingPeriod.unit, holdingPeriod.num)}</Period>
        </CenteredCol>
      </Row>
    </OuterWrapper>
  )
}

export default MarketHoldingPeriod
