import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { Flex, Icon, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import SlideUpCard from '../SlideUpCard'
import { useRootStore } from '../../../context/RootStoreProvider'
import MarketButton from '../SlideUpButton'
import { SupportedMarketID } from '../../../types/market.types'
import { MarketEntity } from '../../../stores/entities/MarketEntity'
import { numberFormatter } from '../../../utils/numberFormatter'

type MarketProps = {
  id: SupportedMarketID
  market: MarketEntity
  selected?: boolean
  onClick?: (id: SupportedMarketID) => void
}

const { significantDigits } = numberFormatter

const MarketWrapper = styled.div<{ selected?: boolean }>`
  align-items: center;
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  cursor: ${({ selected }): string => (selected ? 'default' : 'pointer')};
  display: flex;
  gap: ${spacingIncrement(16)};
  justify-content: space-between;
  padding: ${spacingIncrement(6)} ${spacingIncrement(8)};
  width: 100%;
  :hover {
    background-color: ${({ theme, selected }): string =>
      selected ? 'unset' : theme.color.accentPrimary};
  }
`

const MarketName = styled.p<{ size?: 'lg' }>`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme, size }): string => theme.fontSize[size ?? 'base']};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const MarketValuation = styled.span<{ size?: 'md' }>`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme, size }): string => theme.fontSize[size ?? 'sm']};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const MarketItem: React.FC<MarketProps> = ({ id, market, onClick, selected }) => {
  const handleClick = (): void => {
    if (!selected && onClick) onClick(id)
  }
  return (
    <MarketWrapper onClick={handleClick} selected={selected}>
      <Flex gap={16}>
        <Icon name={market.iconName} height="48" width="48" />
        <div>
          <MarketName>{market.name}</MarketName>
          {market.estimatedValuation !== undefined && (
            <p>
              <MarketValuation>
                ${significantDigits(market.estimatedValuation?.value)}
              </MarketValuation>
            </p>
          )}
        </div>
      </Flex>
      {selected && (
        <Flex color="success">
          <Icon name="check" height="24" width="24" />
        </Flex>
      )}
    </MarketWrapper>
  )
}

const MarketSlideUp: React.FC = () => {
  const router = useRouter()
  const { marketStore, tradeStore } = useRootStore()
  const { slideUpContent, selectedMarket, setSlideUpContent } = tradeStore
  const { markets } = marketStore

  const onSelectMarket = (key: string): void => {
    const tradeUrl = tradeStore.setSelectedMarket(key)
    setSlideUpContent(undefined)
    router.push(tradeUrl)
  }

  // close SlideUp when this component is unmounted (e.g. user leaves page)
  useEffect(
    () => () => {
      setSlideUpContent(undefined)
    },
    [setSlideUpContent]
  )

  return (
    <>
      <MarketButton
        showShadow={!selectedMarket}
        onClick={(): void => setSlideUpContent('OpenMarket')}
      >
        {selectedMarket ? (
          <Flex gap={16}>
            <Icon name={selectedMarket.iconName} height="36" width="36" />
            <MarketName size="lg">
              {selectedMarket.name}{' '}
              {selectedMarket.estimatedValuation !== undefined && (
                <MarketValuation size="md">
                  (${significantDigits(selectedMarket.estimatedValuation.value)})
                </MarketValuation>
              )}
            </MarketName>
          </Flex>
        ) : (
          'Select a Market'
        )}
      </MarketButton>
      <SlideUpCard
        show={slideUpContent === 'OpenMarket'}
        onClose={(): void => setSlideUpContent(undefined)}
        title="Select a Market"
      >
        {selectedMarket && (
          <MarketItem id={selectedMarket.urlId} market={selectedMarket} selected />
        )}
        {Object.entries(markets)
          .filter(([id]) => id !== selectedMarket?.urlId)
          .map(([id, market]) => (
            <MarketItem
              key={id}
              id={id as SupportedMarketID}
              market={market}
              onClick={onSelectMarket}
              selected={selectedMarket?.urlId === id}
            />
          ))}
      </SlideUpCard>
    </>
  )
}

export default observer(MarketSlideUp)
