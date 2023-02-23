import { ReactElement, useMemo, useState } from 'react'
import styled, { css, useTheme } from 'styled-components'
import { centered, media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import Dropdown from '../../components/Dropdown'
import AreaChart from '../../components/charts/templates/AreaChart'
import Tabs, { secondaryTabsStyles } from '../../components/Tabs'
import Menu from '../../components/Menu'
import { ColorType } from '../../components/charts'
import { ChartTimeframe, ChartView } from '../../types/market.types'
import useTransformedTVLData from '../../hooks/useTransformedTVLData'
import useTransformedValuationData from '../../hooks/useTransformedValuationData'
import useTransformedVolumeData from '../../hooks/useTransformedVolumeData'
import HistogramChart from '../../components/charts/templates/HistogramChart'
import useSelectedMarket from '../../hooks/useSelectedMarket'
import LoadingLottie from '../../components/lottie-animations/LoadingLottie'
import { numberFormatter } from '../../utils/numberFormatter'

const { significantDigits } = numberFormatter

const ChartBox = styled.div`
  background-color: ${({ theme }): string => theme.color.marketChartBackground};
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  padding: ${spacingIncrement(16)} 0 ${spacingIncrement(20)} 0;
`

const ChartButtonsWrapper = styled.div`
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
  padding-left: ${spacingIncrement(12)};
  padding-right: ${spacingIncrement(18)};
`
const ChartWrapper = styled.div`
  background-color: ${({ theme }): string => theme.color.marketChartBackground};
  height: ${spacingIncrement(198)};
  margin-bottom: ${spacingIncrement(24)};
  margin-top: ${spacingIncrement(70)};
`

const TopRight = styled.div`
  align-items: flex-end;
  display: flex;
  flex-direction: column;
`

const Centered = styled.div`
  ${centered}
`

const tabsStyle = css`
  &&& {
    .ant-tabs-nav {
      margin-bottom: 0;
    }
  }
`

const TabsWrapper = styled(Tabs)`
  ${tabsStyle};
`

const HideOnDesktop = styled.div`
  ${media.largeDesktop`
    display: none;
  `}
`

const HideOnMobile = styled.div`
  display: none;
  ${media.largeDesktop`
    display: block;
  `}
`

const chartView = [ChartView.VALUATION, ChartView.VOLUME]
const defaultTimeFrames = [
  ChartTimeframe.DAY,
  ChartTimeframe.WEEK,
  ChartTimeframe.MONTH,
  ChartTimeframe.YEAR,
  ChartTimeframe.MAX,
]

const ChartTypes: React.FC<{ onChange: (view: ChartView) => void }> = ({ onChange }) => (
  <TabsWrapper
    styles={secondaryTabsStyles}
    size="large"
    type="card"
    tab={chartView.map((value) => ({ heading: value, value }))}
    onChange={(view): void => onChange(view as ChartView)}
  />
)

const ChartTimeframes: React.FC<{
  onChange: (timeFrame: ChartTimeframe) => void
  timeFrames: ChartTimeframe[]
}> = ({ onChange, timeFrames }) => (
  <TabsWrapper
    styles={{ ...secondaryTabsStyles, activeTextWeight: 'medium', height: 32 }}
    type="card"
    tab={timeFrames.map((value) => ({ heading: value, value }))}
    onChange={(value): void => onChange(value as ChartTimeframe)}
  />
)

const MarketChart: React.FC = () => {
  const { color } = useTheme()
  const [view, setView] = useState<ChartView>(chartView[0])
  const selectedMarket = useSelectedMarket()

  const liquidityData = useTransformedTVLData(selectedMarket?.realTimeChartData)
  const valuationData = useTransformedValuationData(selectedMarket?.realTimeChartData)
  const volumeData = useTransformedVolumeData(selectedMarket?.realTimeChartData, {
    timeframe: selectedMarket?.selectedTimeframe,
    timestampInSeconds: true,
    baseColor: 'success',
    negativeColor: 'error',
  })

  const onChangeChartType = (newView: ChartView): void => {
    setView(newView)
  }

  const layout = useMemo(
    () => ({
      textColor: color.neutral2,
      background: {
        type: ColorType.Solid,
        color: color.marketChartBackground,
      },
    }),
    [color.marketChartBackground, color.neutral2]
  )

  const chart = useMemo(() => {
    if (!volumeData || !liquidityData || !valuationData || !selectedMarket)
      return (
        <Centered>
          <LoadingLottie height={60} width={60} />
        </Centered>
      )

    const { selectedTimeframe } = selectedMarket
    const defaultChartProps = {
      chartOptions: {
        handleScroll: true,
        handleScale: true,
        layout,
        timeScale: {
          fixLeftEdge: true,
          fixRightEdge: true,
        },
      },
      chartTooltipFormatter: {
        formatPrice: (price?: number): string =>
          price === undefined ? 'N/A' : `$${significantDigits(price)}`,
      },
    }

    switch (view) {
      case ChartView.VOLUME:
        return (
          <HistogramChart
            data={volumeData}
            options={{ priceLineVisible: false }}
            timeframe={selectedTimeframe}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...defaultChartProps}
          />
        )
      case ChartView.LIQUIDITY:
        return (
          <AreaChart
            data={liquidityData}
            timeframe={selectedTimeframe}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...defaultChartProps}
          />
        )
      default:
        return (
          <AreaChart
            data={valuationData}
            timeframe={selectedTimeframe}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...defaultChartProps}
          />
        )
    }
  }, [layout, liquidityData, selectedMarket, valuationData, view, volumeData])

  const renderChartTypes = useMemo(
    (): ReactElement => (
      <Menu
        selectedKeys={[view]}
        items={chartView.map((type) => ({
          key: type,
          onClick: (): void => onChangeChartType(type),
          label: type,
        }))}
      />
    ),
    [view]
  )

  const chartTimeframes = useMemo(
    () =>
      selectedMarket ? (
        <ChartTimeframes
          onChange={selectedMarket.setSelectedTimeframe}
          timeFrames={defaultTimeFrames}
        />
      ) : null,
    [selectedMarket]
  )

  return (
    <ChartBox>
      <ChartButtonsWrapper>
        <div>
          <HideOnDesktop>
            <Dropdown overlay={renderChartTypes}>{view}</Dropdown>
          </HideOnDesktop>
          <HideOnMobile>
            <ChartTypes onChange={onChangeChartType} />
          </HideOnMobile>
        </div>
        <TopRight>
          <HideOnMobile>{chartTimeframes}</HideOnMobile>
        </TopRight>
      </ChartButtonsWrapper>
      <ChartWrapper>{chart}</ChartWrapper>
      <Centered>
        <HideOnDesktop>{chartTimeframes}</HideOnDesktop>
      </Centered>
    </ChartBox>
  )
}

export default observer(MarketChart)
