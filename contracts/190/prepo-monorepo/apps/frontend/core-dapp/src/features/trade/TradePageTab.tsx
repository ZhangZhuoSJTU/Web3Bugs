import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { centered, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { TradeAction } from './TradeStore'
import { useRootStore } from '../../context/RootStoreProvider'

type ShadowDirection = 'left' | 'right'

const Wrapper = styled.div`
  background-color: ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({
    theme: {
      borderRadius: { lg },
    },
  }): string => `${lg} ${lg} 0 0`};
  display: flex;
  flex-direction: row;
`

const TabButton = styled.div<{
  selected: boolean
  shadowDirection?: ShadowDirection
  showShadow: boolean
}>`
  ${centered}
  background-color: ${({ theme, selected }): string =>
    theme.color[selected ? 'neutral10' : 'transparent']};
  border-radius: ${spacingIncrement(24)} ${spacingIncrement(24)} 0 0;
  box-shadow: ${({ selected, shadowDirection, showShadow }): string =>
    selected && showShadow
      ? `${shadowDirection === 'right' ? '2px' : '-2px'} -2px 2px rgba(98, 100, 217, 0.15)`
      : 'unset'};
  color: ${({ theme, selected }): string => theme.color[selected ? 'secondary' : 'neutral3']};
  cursor: pointer;
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  padding: ${spacingIncrement(16)};
  width: 100%;
  :hover {
    color: ${({ theme }): string => theme.color.secondary};
  }
`

const tabs: { key: TradeAction; name: string; shadowDirection: ShadowDirection }[] = [
  { key: 'open', name: 'Open', shadowDirection: 'right' },
  { key: 'close', name: 'Close', shadowDirection: 'left' },
]

const TradePageTab: React.FC = () => {
  const router = useRouter()
  const { tradeStore } = useRootStore()
  const { action, setAction, slideUpContent } = tradeStore

  const handleClick = (newAction: TradeAction): void => {
    if (newAction === action) return
    const tradeUrl = setAction(newAction)
    router.push(tradeUrl)
  }

  return (
    <Wrapper>
      {tabs.map(({ key, name, shadowDirection }) => (
        <TabButton
          onClick={(): void => handleClick(key)}
          key={key}
          selected={action === key}
          shadowDirection={shadowDirection}
          showShadow={slideUpContent === undefined}
        >
          {name}
        </TabButton>
      ))}
    </Wrapper>
  )
}

export default observer(TradePageTab)
