import React, { useMemo } from 'react'
import styled from 'styled-components'
import { Row, Col } from 'antd'
import { useAppSelector } from '../../../app/hooks'
import { spacingIncrement } from '../../app/themes'
import { media } from '../../../utils/media'
import { selectNonZeroOutcome } from '../../position/outcome-selector'
import RightArrowIcon from '../../../components/icons/RightArrowIcon'
import { formatValuationNumber } from '../../../helpers'
import { cardPadding } from '../../../components/Card'
import {
  floatToPercentageFormat,
  getCapitalEfficiencyLabelFormat,
  getMarketValuationRange,
  getPositionColor,
} from '../utils/market-position-utils'

const Wrapper = styled.div`
  display: flex;
  ${cardPadding};

  span {
    font-weight: 800;
  }

  ${media.md`
    flex-direction: column;
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

const PrimaryText = styled.span`
  color: ${({ theme }): string => theme.colors.primary};
`

const Left = styled.div`
  align-items: center;
  display: flex;
  margin-bottom: ${spacingIncrement(2)};
  margin-top: ${spacingIncrement(2)};
  position: relative;

  &::after {
    background-color: ${({ theme }): string => theme.colors.accent};
    content: '';
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    width: 1px;
  }

  ${media.md`
    align-items: center;
    justify-content: flex-start;

    &::after {
      content: none;
    }
  `}
`

const MarketLogo = styled.img`
  max-height: 3.5rem;
  max-width: 6.5rem;
  padding-right: ${spacingIncrement(4)};

  ${media.md`
    padding: 0;
  `}
`

const Right = styled.div`
  color: ${({ theme }): string => theme.colors.subtitle};
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.2;
  margin-left: ${spacingIncrement(4)};
  width: 100%;

  ${media.md`
    margin: 0;
  `}
`

const SpacerRow = styled(Row)`
  margin-top: ${spacingIncrement(1)};
`

const Spacer = styled.div`
  margin-top: ${spacingIncrement(1)};
`

const DynamicSpan = styled.span<{ dynamicColor: string }>`
  ${({ theme, dynamicColor }): string => {
    const fontColor = dynamicColor === 'red' ? theme.colors.loss : theme.colors.profit
    return `color: ${fontColor};`
  }}
`

const PositionSettingsEntryExitSummary: React.FC = () => {
  const position = useAppSelector((state) => state.position)
  const nonZeroOutcome = useAppSelector(selectNonZeroOutcome)
  const positionColor = getPositionColor(nonZeroOutcome)

  const AdvancedSummary = useMemo(() => {
    const component = (): JSX.Element => (
      <>
        <Spacer>
          <Row>
            <Col xs={12} lg={10}>
              Payout Range
            </Col>
            <Col xs={12} lg={14}>
              <span>
                {floatToPercentageFormat(position?.payoutRange.floor)} -{' '}
                {floatToPercentageFormat(position?.payoutRange.ceil)}
              </span>
            </Col>
          </Row>
        </Spacer>
        <Spacer>
          <Row>
            <Col xs={12} lg={10}>
              Capital Efficiency
            </Col>
            <Col xs={12} lg={14}>
              <span>{getCapitalEfficiencyLabelFormat(position?.capitalEfficiency)}</span>
            </Col>
          </Row>
        </Spacer>
      </>
    )
    return component
  }, [position?.capitalEfficiency, position?.payoutRange.floor, position?.payoutRange.ceil])

  if (!position.market) return <Wrapper>No Market selected</Wrapper>

  return (
    <Wrapper>
      <Left>
        {position.ui.mode === 'basic' ? (
          <MarketLogo src={position.market.logo.src} alt={position.market.name} />
        ) : (
          <PrimaryText>Custom Market</PrimaryText>
        )}
      </Left>
      <Right>
        <Row>
          <Col xs={12} lg={10}>
            Valuation Range
          </Col>
          <Col xs={12} lg={14}>
            <span>{getMarketValuationRange(position.market.bounds.valuation)}</span>
          </Col>
        </Row>
        <SpacerRow>
          <Col xs={12} lg={10}>
            My Entry & Exit
          </Col>
          <Col xs={12} lg={14}>
            <span>{formatValuationNumber(position.entry)}</span> <RightArrowIcon />{' '}
            <DynamicSpan dynamicColor={positionColor}>
              {formatValuationNumber(position.exit)}
            </DynamicSpan>
          </Col>
        </SpacerRow>
        {position.ui.mode === 'advanced' && <AdvancedSummary />}
      </Right>
    </Wrapper>
  )
}

export default PositionSettingsEntryExitSummary
