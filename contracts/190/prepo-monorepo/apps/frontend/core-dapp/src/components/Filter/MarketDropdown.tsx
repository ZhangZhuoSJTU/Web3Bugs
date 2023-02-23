import styled from 'styled-components'
import { useMemo } from 'react'
import { media, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { LabelWrapper } from './FilterModal'
import Dropdown from '../Dropdown'
import Menu from '../Menu'
import { useRootStore } from '../../context/RootStoreProvider'
import { markets } from '../../lib/markets'

const StyledDropdown = styled(Dropdown)`
  font-size: ${({ theme }): string => theme.fontSize.xs};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
  height: ${spacingIncrement(40)};
`

const StyledMenu = styled(Menu)`
  &&& {
    .ant-dropdown-menu-title-content {
      font-size: ${({ theme }): string => theme.fontSize.xs};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.sm};
      `}
    }
  }
`

const MarketDropdown: React.FC = () => {
  const { filterStore } = useRootStore()
  const {
    filterOptions: { selectedMarket },
  } = filterStore
  const onClick = ({ key }: { key: string }): void => {
    const newMarket = key === 'all' ? 'All' : markets.find((x) => x.name === key)
    if (newMarket) filterStore.setSelectedMarket(newMarket)
  }
  const items = [
    { key: 'all', label: 'All' },
    ...markets.map((market) => ({
      label: market.name,
      key: market.name,
    })),
  ]
  const getMenuItems = <StyledMenu size="sm" onClick={onClick} items={items} />

  const getMarketName = useMemo((): string => {
    if (typeof selectedMarket !== 'string') return selectedMarket.name
    return 'All'
  }, [selectedMarket])

  return (
    <div>
      <LabelWrapper>Market</LabelWrapper>
      <StyledDropdown
        customStyles={{
          backgroundColor: 'marketChartFloatingCard',
        }}
        label=""
        overlay={getMenuItems}
        variant="outline"
      >
        {getMarketName}
      </StyledDropdown>
    </div>
  )
}

export default observer(MarketDropdown)
