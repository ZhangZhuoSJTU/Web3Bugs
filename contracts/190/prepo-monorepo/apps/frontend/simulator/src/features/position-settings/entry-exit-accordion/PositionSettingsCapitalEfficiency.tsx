import React from 'react'
import styled from 'styled-components'
import { useSelector } from 'react-redux'
import { Col, Row } from 'antd'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { actions } from '../../position/position-slice'
import { spacingIncrement } from '../../app/themes'
import { selectMaxCapitalEfficiency } from '../../position/max-capital-efficiency-selector'
import InfoTooltipIcon from '../../icons/InfoTooltipIcon'
import { checkValuationRangeValid } from '../../../helpers'
import { getCapitalEfficiencyLabelFormat } from '../utils/market-position-utils'
import Slider, { SliderValue } from '../../../components/Slider/Slider'

const Wrapper = styled.div`
  margin-top: ${spacingIncrement(6)};
`

const Title = styled.div`
  font-weight: 800;
  margin-bottom: ${spacingIncrement(3)};
`

const Span = styled.span`
  border: 1px solid ${({ theme }): string => theme.colors.accentLight};
  border-radius: 0.5rem;
  font-weight: 800;
  padding: ${spacingIncrement(1)};
`

const RightCol = styled(Col)`
  align-items: flex-end;
  display: flex;
  justify-content: center;
`

const PositionSettingsCapitalEfficiency: React.FC = () => {
  const position = useAppSelector((state) => state.position)
  const maxCapitalEfficiency = useSelector(selectMaxCapitalEfficiency)
  const dispatch = useAppDispatch()

  if (
    position.ui.mode !== 'advanced' ||
    !position.market ||
    !checkValuationRangeValid(position.market.bounds.valuation) ||
    position.type !== 'lp'
  ) {
    return null
  }

  const capitalEfficiencyPercentChanged = (value: SliderValue): void => {
    dispatch(actions.capitalEfficiencyChanged(value as number))
  }

  return (
    <Wrapper>
      <Title>
        Capital Efficiency{' '}
        <InfoTooltipIcon text="Higher capital efficiency leads to higher returns but with higher risk. This is achieved through concentrated liquidity. A tighter payout range results in greater capital efficiency. Docs coming soon." />
      </Title>
      <Row>
        <Col xs={18} lg={20}>
          <Slider
            min={0.01}
            max={maxCapitalEfficiency}
            value={position.capitalEfficiency}
            onChange={capitalEfficiencyPercentChanged}
            numberFormatter={getCapitalEfficiencyLabelFormat}
            step={0.01}
          />
        </Col>
        <RightCol xs={6} lg={4}>
          <Span>{getCapitalEfficiencyLabelFormat(position.capitalEfficiency)}</Span>
        </RightCol>
      </Row>
    </Wrapper>
  )
}

export default PositionSettingsCapitalEfficiency
