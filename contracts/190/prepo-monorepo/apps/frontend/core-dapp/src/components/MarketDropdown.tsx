import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import { Dropdown, Icon, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import Menu from './Menu'
import { MarketEntity } from '../stores/entities/MarketEntity'
import { useRootStore } from '../context/RootStoreProvider'

type Props = {
  label?: string
  selectedMarket?: MarketEntity
  onSelectMarket?: (key: string) => unknown
}

const MarketIcon = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(12)};
`

const MarketName = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: 0;
`
const MarketWrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

const RowWrapper = styled.div`
  padding: ${spacingIncrement(11)} ${spacingIncrement(4)};
  padding-right: ${spacingIncrement(12)};
`

const SelectMarketText = styled.p`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.md};
  line-height: ${spacingIncrement(28)};
  margin-bottom: 0;
`

const StyledDropdown = styled(Dropdown)<{ showShadow: boolean }>`
  box-shadow: ${({ showShadow, theme }): string => (showShadow ? theme.shadow.prepo : 'unset')};
`

const Market: React.FC<{ market: MarketEntity; showBalance?: boolean }> = ({ market }) => (
  <MarketWrapper>
    <MarketIcon>
      <Icon name={market.iconName} height="28" width="28" />
      <MarketName>{market.name}</MarketName>
    </MarketIcon>
  </MarketWrapper>
)

const MarketDropdown: React.FC<Props> = ({ onSelectMarket, selectedMarket }) => {
  const { marketStore } = useRootStore()
  const { markets } = marketStore
  const [showDropdown, setShowDropdown] = useState(false)
  const onClick = ({ key }: { key: string }): void => {
    if (typeof onSelectMarket === 'function') onSelectMarket(key)
    setShowDropdown(false)
  }
  const getMarketsDropdownMenu = (
    <Menu
      size="md"
      onClick={onClick}
      items={Object.values(markets).map((market) => ({
        key: market.urlId,
        label: (
          <RowWrapper>
            <Market market={market} />
          </RowWrapper>
        ),
      }))}
    />
  )

  return (
    <StyledDropdown
      showShadow={!selectedMarket}
      overlay={getMarketsDropdownMenu}
      trigger={['click']}
      block
      visible={showDropdown}
      onVisibleChange={setShowDropdown}
    >
      {selectedMarket ? (
        <Market market={selectedMarket} />
      ) : (
        <SelectMarketText>Select a Market</SelectMarketText>
      )}
    </StyledDropdown>
  )
}

export default observer(MarketDropdown)
