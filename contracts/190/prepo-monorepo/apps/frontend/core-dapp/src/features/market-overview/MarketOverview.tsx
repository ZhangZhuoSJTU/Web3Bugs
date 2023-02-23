import { Col, Row } from 'antd'
import styled from 'styled-components'
import { media, Button, Icon, Flex } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import Skeleton from 'react-loading-skeleton'
import { Trans } from '@lingui/macro'
import SelectedMarketColumn from './SelectedMarketColumn'
import MarketChart from './MarketChart'
import MarketDataColumn from './MarketDataColumn'
import { getValuationRangeString } from './market-utils'
import Subtitle from '../../components/Subtitle'
import useResponsive from '../../hooks/useResponsive'
import MarketIconTitle from '../../components/MarketIconTitle'
import useSelectedMarket from '../../hooks/useSelectedMarket'
import { MarketEntity } from '../../stores/entities/MarketEntity'
import { ValuationRange } from '../definitions'

type Props = {
  selectedMarket: MarketEntity
}

const BoldText = styled.span`
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const ValuationRangeText = styled(BoldText)`
  color: ${({ theme }): string => theme.color.secondary};
`

const ValuationText = styled.span`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  margin: 0;

  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const MarketTitleAndValuation: React.FC<Props> = observer(({ selectedMarket }) => {
  if (selectedMarket === undefined) return null
  const { name, iconName, valuationRange } = selectedMarket

  return (
    <Col xs={24} md={12} lg={16}>
      <Row gutter={[0, 16]}>
        <Col xs={24}>
          <MarketIconTitle iconName={iconName} size="lg">
            {name}
          </MarketIconTitle>
        </Col>
        <Subtitle tooltip={<ValuationRange />}>
          <ValuationText>
            <Trans>Valuation Range</Trans>:{' '}
            {valuationRange === undefined ? (
              <Skeleton height={20} width={160} />
            ) : (
              <ValuationRangeText>{getValuationRangeString(valuationRange)}</ValuationRangeText>
            )}
          </ValuationText>
        </Subtitle>
      </Row>
    </Col>
  )
})

const MarketSubNavigation: React.FC<Props> = ({ selectedMarket }) => {
  const { urlId } = selectedMarket

  const { isDesktop } = useResponsive()

  const iconSize = isDesktop ? '24' : '16'

  return (
    <Col xs={24} md={12} lg={8}>
      <Row gutter={[16, 0]}>
        <Col xs={12} lg={8}>
          <Button type="primary" block href={`/markets/${urlId}/trade`}>
            <Trans>Trade</Trans>
          </Button>
        </Col>
        <Col xs={12} lg={16}>
          <Button
            block
            type="text"
            href={`/markets/${urlId}/liquidity`}
            icon={<Icon name="plus" color="primaryLight" height={iconSize} width={iconSize} />}
          >
            <Trans>Add Liquidity</Trans>
          </Button>
        </Col>
      </Row>
    </Col>
  )
}

const MarketOverview: React.FC = () => {
  const selectedMarket = useSelectedMarket()

  if (selectedMarket === undefined) {
    return null
  }

  const { iconName, name } = selectedMarket

  return (
    <Flex alignItems="flex-start" gap={16}>
      <Flex
        borderRight="1px solid"
        borderColor="neutral8"
        display={{ phone: 'none', largeDesktop: 'flex' }}
        pr={16}
      >
        <SelectedMarketColumn iconName={iconName} name={name} />
      </Flex>
      <Flex flex={1}>
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Row gutter={[0, 16]}>
              <MarketTitleAndValuation selectedMarket={selectedMarket} />
              <MarketSubNavigation selectedMarket={selectedMarket} />
            </Row>
          </Col>
          <Col xs={24} md={16} xl={18}>
            <MarketChart />
          </Col>
          <Col xs={24} md={8} xl={6}>
            <MarketDataColumn />
          </Col>
        </Row>
      </Flex>
    </Flex>
  )
}

export default observer(MarketOverview)
