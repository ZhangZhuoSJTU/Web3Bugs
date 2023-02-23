import { Col, Row } from 'antd'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { spacingIncrement, media } from 'prepo-ui'
import { t, Trans } from '@lingui/macro'
import Heading from '../../components/Heading'
import Tabs from '../../components/Tabs'
import MarketCard from '../../components/MarketCard'
import { useRootStore } from '../../context/RootStoreProvider'
import MarketSearch from '../../components/MarketSearch'
import useResponsive from '../../hooks/useResponsive'
import { MarketEntity } from '../../stores/entities/MarketEntity'

const DEFAULT_PLACEHOLDER_WIDTH_DESKTOP_MAX = 370
const DEFAULT_PLACEHOLDER_WIDTH_MOBILE_MAX = 300
const DEFAULT_PLACEHOLDER_WIDTH_MIN = 260

const StyledTabs = styled(Tabs)`
  &&&& {
    .ant-tabs-tab-btn {
      font-size: ${({ theme }): string => theme.fontSize.xs};

      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.base};
      `}
    }

    .ant-tabs-nav {
      align-items: flex-start;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap-reverse;
      justify-content: flex-start;
      gap: ${spacingIncrement(16)};
      ${media.desktop`
        gap: ${spacingIncrement(45)};
      `}
    }
    .ant-tabs-nav-wrap {
      flex: unset;
      justify-content: flex-start;
      ${media.desktop`
        justify-content: flex-end;
      `}
    }
    .ant-tabs-extra-content {
      min-width: ${DEFAULT_PLACEHOLDER_WIDTH_MIN}px;
      max-width: 100%;
      flex: 1;
      align-self: stretch;
      ${media.tablet`
        max-width: ${DEFAULT_PLACEHOLDER_WIDTH_MOBILE_MAX}px;
      `}
      ${media.desktop`
        max-width: ${DEFAULT_PLACEHOLDER_WIDTH_DESKTOP_MAX}px;
      `}
    }

    .ant-tabs-nav-list,
    .ant-tabs-tab {
      height: ${spacingIncrement(38)};
      ${media.desktop`
        height: ${spacingIncrement(54)};
      `}
    }

    .ant-tabs-nav {
      margin-bottom: ${spacingIncrement(16)};
      ${media.desktop`
        margin-bottom: ${spacingIncrement(49)};
      `}
    }

    .ant-tabs-tab {
      margin-bottom: ${spacingIncrement(38)};
      padding: ${spacingIncrement(7)} ${spacingIncrement(15)};
      ${media.desktop`
        padding: ${spacingIncrement(16)} ${spacingIncrement(30)};
      `}
    }
  }
`

const Wrapper = styled.div`
  display: grid;
  grid-row-gap: ${spacingIncrement(16)};
  ${media.desktop`
    grid-row-gap: ${spacingIncrement(48)};
  `}
`

const MarketContent: React.FC<{ id: string; markets: MarketEntity[] }> = ({ id, markets }) => {
  let spacing = 16
  const { isDesktop } = useResponsive()
  if (isDesktop) {
    spacing = 32
  }
  return (
    <Row gutter={[spacing, spacing]}>
      {markets.map((market) => (
        <Col xxl={8} xl={12} md={12} xs={24} key={market.name}>
          <MarketCard id={id} market={market} />
        </Col>
      ))}
    </Row>
  )
}

const ExploreMarkets: React.FC = () => {
  const { marketStore } = useRootStore()
  const { filteredMarkets, setSearchQuery, filteredIcoMarkets, filteredIpoMarkets } = marketStore
  return (
    <Wrapper>
      <Col xs={24}>
        <Heading type="h1" color="secondary">
          <Trans>Explore Markets</Trans>
        </Heading>
      </Col>
      <Col xs={24}>
        <StyledTabs
          tabBarExtraContent={
            <MarketSearch
              onChange={setSearchQuery}
              placeholder={t`Search for Pre-IPO and Pre-IDO Markets`}
            />
          }
          type="card"
          tab={[
            { heading: t`All`, content: <MarketContent id="all" markets={filteredMarkets} /> },
            {
              heading: 'Pre-IPO',
              content: <MarketContent id="pre-ipo" markets={filteredIpoMarkets} />,
            },
            {
              heading: 'Pre-IDO',
              content: <MarketContent id="pre-ido" markets={filteredIcoMarkets} />,
            },
          ]}
        />
      </Col>
    </Wrapper>
  )
}

export default observer(ExploreMarkets)
