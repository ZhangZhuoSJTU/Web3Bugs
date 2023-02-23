import { Button as AButton, Col, Row, Tooltip } from 'antd'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  centered,
  coreDappTheme,
  media,
  spacingIncrement,
  Slider,
  Icon,
  SliderValue,
} from 'prepo-ui'
import Skeleton from 'react-loading-skeleton'
import { observer } from 'mobx-react-lite'
import { formatNumber } from 'prepo-utils'
import LiquidityTransactionSummary from './LiquidityTransactionSummary'
import MarketDropdown from '../../components/MarketDropdown'
import SecondaryNavigation from '../../components/SecondaryNavigation'
import { makeAddStep, makeMinusStep } from '../../utils/number-utils'
import StepNumberInput from '../../components/StepNumberInput'
import LiquidityChartRangeInput from '../../components/LiquidityChartRangeInput'
import { liquidityRangeInputMockData } from '../../__mocks__/liquidity.mock'
import { Bound } from '../../components/LiquidityChartRangeInput/types'
import useResponsive from '../../hooks/useResponsive'
import Card from '../../components/Card'
import MultiCurrencySelect from '../../components/MultiCurrencySelect'
import AdvancedSettingsModal from '../../components/AdvancedSettingsModal'
import CurrenciesBreakdown from '../../components/CurrenciesBreakdown'
import useSelectedMarket from '../../hooks/useSelectedMarket'
import { useRootStore } from '../../context/RootStoreProvider'
import ComingSoonTooltip from '../../components/ComingSoonTooltip'
import { numberFormatter } from '../../utils/numberFormatter'

const { significantDigits } = numberFormatter

const {
  roundedBorder,
  Z_INDEX: { onboardModal },
} = coreDappTheme

const BalanceWrapper = styled.div`
  align-items: center;
  display: flex;
`

const BlackMediumText = styled.p`
  ${centered}
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  gap: ${spacingIncrement(3)};
  margin: 0;
  margin-right: ${spacingIncrement(11)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

const BigBlackMediumText = styled.p`
  ${centered}
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  gap: ${spacingIncrement(3)};
  margin: 0;
  margin-right: ${spacingIncrement(5)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const BoundBox = styled.div`
  ${roundedBorder}
  padding: ${spacingIncrement(14)} ${spacingIncrement(12)};
  padding-bottom: ${spacingIncrement(17)};
`

const Backdrop = styled.div<{ $show: boolean }>`
  cursor: not-allowed;
  display: ${({ $show }): string => ($show ? 'flex' : 'none')};
  height: 100%;
  left: 0;
  position: absolute;
  top: 0;
  width: 100%;
  z-index: ${onboardModal};
`

const BoundTitleWrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  margin-bottom: ${spacingIncrement(9)};
  text-align: center;
`

const CardWrapper = styled(Card)`
  width: ${spacingIncrement(960)};
`

const CapitalEfficiencyBox = styled.div`
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  border-radius: 1px;
  padding: ${spacingIncrement(21)} ${spacingIncrement(20)};
  svg {
    ${media.desktop`
      height: ${spacingIncrement(20)};
      width: ${spacingIncrement(20)};
    `}
  }
`

const CapitalEfficiencySliderWrapper = styled.div`
  margin-top: ${spacingIncrement(55)};
`

const Label = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: 1;
  width: max-content;
  ${media.desktop`
  font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const LightGrayText = styled.span`
  color: ${({ theme }): string => theme.color.neutral3};
`

const LiquidityRangeText = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  margin: 0;
  text-align: right;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const Navigation = styled(SecondaryNavigation)`
  margin-bottom: ${spacingIncrement(32)};
`

const RangeLabel = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: ${spacingIncrement(12)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const RowCentered = styled.div<{ clickable?: boolean }>`
  align-items: center;
  display: flex;
  ${({ clickable }): string => (clickable ? 'cursor: pointer;' : '')}
`

const Semibold = styled.span`
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const SemiboldBalance = styled(Semibold)`
  color: ${({ theme }): string => theme.color.secondary};
`

const TooltipIconWrapper = styled.div`
  ${centered}
`

const BalanceTooltipIconWrapper = styled(TooltipIconWrapper)`
  svg {
    height: ${spacingIncrement(13)};
    margin-right: ${spacingIncrement(3)};
    width: ${spacingIncrement(13)};
    ${media.desktop`
      height: ${spacingIncrement(20)};
      margin-right: ${spacingIncrement(4)};
      width: ${spacingIncrement(20)};
    `}
  }
`

const ValuationButton = styled(AButton)`
  ${roundedBorder}
  color: ${({ theme }): string => theme.color.neutral5};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  height: ${spacingIncrement(38)};
  line-height: ${spacingIncrement(18)};
  padding: ${spacingIncrement(10)};
  :hover {
    border-color: ${({ theme }): string => theme.color.primaryLight};
    color: ${({ theme }): string => theme.color.primaryLight};
  }
`

const ValuationControlWrapper = styled(Row)`
  padding: 0 ${spacingIncrement(9)};
`

const ValuationInputBox = styled.div`
  ${roundedBorder}
  padding-bottom: ${spacingIncrement(18)};
  padding-left: ${spacingIncrement(6)};
  padding-right: ${spacingIncrement(6)};
  padding-top: ${spacingIncrement(15)};
`

const ValuationRangeInputWrapper = styled.div`
  margin-bottom: ${spacingIncrement(20)};
  position: relative;
`

const ValuationWrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${spacingIncrement(12)};
  ${media.desktop`
    margin-bottom: ${spacingIncrement(20)};
  `}
`

const Wrapper: React.FC = ({ children }) => {
  const { isPhone } = useResponsive()
  if (isPhone) {
    return <>{children}</>
  }
  return <CardWrapper>{children}</CardWrapper>
}

const LiquidityPage: React.FC = () => {
  const selectedMarket = useSelectedMarket()
  const router = useRouter()
  const [amount, setAmount] = useState(0)
  const [capitalEfficiency, setCapitalEfficiency] = useState(1.8)
  const [minBound, setMinBound] = useState<number | undefined>()
  const [maxBound, setMaxBound] = useState<number | undefined>()
  const [lowerRange, setLowerRange] = useState<number | undefined>()
  const [upperRange, setUpperRange] = useState<number | undefined>()
  const {
    uiStore: { disableMocks },
  } = useRootStore()

  const { isDesktop } = useResponsive()

  const onSelectMarket = (key: string): void => {
    const url = `/markets/${key}/liquidity`
    router.push(url)
  }

  const handleRangeChange = useCallback(
    (bound: Bound, value: number): void => {
      if (minBound === undefined || maxBound === undefined) return
      if (bound === Bound.LOWER) {
        const newLowerRangeValue = value < minBound ? minBound : value
        setLowerRange(newLowerRangeValue)
      }
      if (bound === Bound.UPPER) {
        const newUpperRangeValue = value > maxBound ? maxBound : value
        setUpperRange(newUpperRangeValue)
      }
    },
    [maxBound, minBound]
  )

  useEffect(() => {
    setUpperRange(maxBound)
    setLowerRange(minBound)
  }, [minBound, maxBound])

  useEffect(() => {
    if (selectedMarket?.valuationRange !== undefined) {
      const [newMinBound, newMaxBound] = selectedMarket.valuationRange
      setMinBound(newMinBound)
      setMaxBound(newMaxBound)
    }
  }, [selectedMarket?.valuationRange])

  const renderCoefficient = useMemo(
    () => (
      <>
        <Col xs={24}>
          <CapitalEfficiencyBox>
            <RowCentered>
              <BigBlackMediumText>Capital Efficiency</BigBlackMediumText>
            </RowCentered>
            <CapitalEfficiencySliderWrapper>
              <Slider
                labelSpacing="normal"
                value={capitalEfficiency}
                min={0.1}
                max={3.4}
                step={0.1}
                onChange={(n: SliderValue): void => {
                  if (typeof n === 'number') {
                    setCapitalEfficiency(n)
                  }
                }}
                labelPosition="side"
                numberFormatter={(n: number): string => `${n}x`}
                tooltipLabels={['', '']}
                trackUnderlyingColor="neutral7"
              />

              <ComingSoonTooltip placement="bottom">
                <Backdrop $show={disableMocks} />
              </ComingSoonTooltip>
            </CapitalEfficiencySliderWrapper>
          </CapitalEfficiencyBox>
        </Col>
        <Col xs={24}>
          <CurrenciesBreakdown />
        </Col>
      </>
    ),
    [capitalEfficiency, disableMocks]
  )

  // this should never happen because getStaticPath would've directed to not found page
  if (selectedMarket === undefined) return null

  return (
    <Wrapper>
      <AdvancedSettingsModal />
      <Navigation
        backUrl={`/markets/${selectedMarket.urlId}`}
        title="Add Liquidity"
        showAdvancedSettings
      />
      <Row gutter={[40, 24]}>
        <Col xs={24} md={10}>
          <Row gutter={[24, 40]}>
            <Col xs={24}>
              <MarketDropdown selectedMarket={selectedMarket} onSelectMarket={onSelectMarket} />
            </Col>
            <Col xs={24}>
              <MultiCurrencySelect
                label={<Label>Amount</Label>}
                balance={
                  <BalanceWrapper>
                    <Tooltip overlay="Balance">
                      <BalanceTooltipIconWrapper>
                        <Icon color="neutral5" name="info" />
                      </BalanceTooltipIconWrapper>
                    </Tooltip>
                    <Label style={{ lineHeight: 1, marginBottom: 0 }}>
                      <LightGrayText>Balance:&nbsp;</LightGrayText>
                      <SemiboldBalance>{formatNumber(20000, { usd: true })}</SemiboldBalance>
                    </Label>
                  </BalanceWrapper>
                }
                inputValue={amount}
                onInputChange={setAmount}
                maxValue={20000}
                minValue={0}
              />
            </Col>
            {isDesktop && renderCoefficient}
          </Row>
        </Col>
        <Col xs={24} md={14}>
          <Row gutter={[24, 0]}>
            <Col xs={24}>
              <RangeLabel>Set Liquidity Range</RangeLabel>
              <ValuationWrapper>
                {minBound === undefined || maxBound === undefined ? (
                  <Skeleton height={25} width={260} />
                ) : (
                  <LiquidityRangeText>
                    Valuation Range:{' '}
                    <Semibold>
                      ${significantDigits(minBound)} - ${significantDigits(maxBound)}
                    </Semibold>
                  </LiquidityRangeText>
                )}
              </ValuationWrapper>
              <ValuationInputBox>
                <ValuationRangeInputWrapper>
                  <LiquidityChartRangeInput
                    data={liquidityRangeInputMockData}
                    lowerPrice={lowerRange}
                    upperPrice={upperRange}
                    price={selectedMarket.estimatedValuation?.value}
                    onLeftRangeInput={(value): void => handleRangeChange(Bound.LOWER, value)}
                    onRightRangeInput={(value): void => handleRangeChange(Bound.UPPER, value)}
                    ticksAtLimit={{ LOWER: undefined, UPPER: undefined }}
                    brushLimit={{ LOWER: minBound, UPPER: maxBound }}
                  />
                  <ComingSoonTooltip placement="bottom">
                    <Backdrop $show={disableMocks} />
                  </ComingSoonTooltip>
                </ValuationRangeInputWrapper>
                <ValuationControlWrapper gutter={[16, 17]}>
                  <Col xs={12}>
                    <BoundBox>
                      <BoundTitleWrapper>
                        <BlackMediumText>Lower Bound</BlackMediumText>
                      </BoundTitleWrapper>
                      {lowerRange === undefined || minBound === undefined ? (
                        <Skeleton height={30} width="100%" />
                      ) : (
                        <StepNumberInput
                          addStep={makeAddStep(lowerRange)}
                          disabled={disableMocks}
                          format={significantDigits}
                          max={upperRange}
                          min={minBound}
                          minusStep={makeMinusStep(lowerRange)}
                          onChange={(value): void => handleRangeChange(Bound.LOWER, value)}
                          value={lowerRange}
                        />
                      )}
                    </BoundBox>
                  </Col>
                  <Col xs={12}>
                    <BoundBox>
                      <BoundTitleWrapper>
                        <BlackMediumText>Upper Bound</BlackMediumText>
                      </BoundTitleWrapper>
                      {upperRange === undefined || maxBound === undefined ? (
                        <Skeleton height={30} width="100%" />
                      ) : (
                        <StepNumberInput
                          addStep={makeAddStep(upperRange)}
                          disabled={disableMocks}
                          format={significantDigits}
                          max={maxBound}
                          min={lowerRange}
                          minusStep={makeMinusStep(upperRange)}
                          onChange={(value): void => handleRangeChange(Bound.UPPER, value)}
                          value={upperRange}
                        />
                      )}
                    </BoundBox>
                  </Col>
                  <Col xs={24}>
                    {maxBound === undefined || minBound === undefined ? (
                      <Skeleton height={38} width="100%" />
                    ) : (
                      <ValuationButton
                        block
                        disabled={disableMocks}
                        onClick={(): void => {
                          handleRangeChange(Bound.LOWER, minBound)
                          handleRangeChange(Bound.UPPER, maxBound)
                        }}
                        type="text"
                      >
                        Max Range
                      </ValuationButton>
                    )}
                  </Col>
                </ValuationControlWrapper>
              </ValuationInputBox>
            </Col>
          </Row>
        </Col>
        {!isDesktop && renderCoefficient}
        <Col xs={24}>
          <LiquidityTransactionSummary />
        </Col>
      </Row>
    </Wrapper>
  )
}

export default observer(LiquidityPage)
