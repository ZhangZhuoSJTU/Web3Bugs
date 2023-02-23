import { Icon, IconName, spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import styled, { Color, css, FlattenSimpleInterpolation } from 'styled-components'
import { removeUserSelect } from 'prepo-ui/src/themes/core-dapp'
import { Direction } from '../TradeStore'
import { useRootStore } from '../../../context/RootStoreProvider'

const directions: Direction[] = ['long', 'short']

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(8)};
`

const RadioButtonWrapper = styled.div<{ disabled: boolean; selected?: boolean }>`
  align-items: center;
  background-color: ${({ disabled, theme, selected }): string => {
    if (disabled) return theme.color.neutral12
    return theme.color[selected ? 'neutral8' : 'transparent']
  }};
  border: solid 1px ${({ theme }): string => theme.color.neutral8};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  gap: ${spacingIncrement(8)};
  justify-content: center;
  padding: ${spacingIncrement(16)};
  width: 100%;
  ${({ theme, disabled, selected }): FlattenSimpleInterpolation => {
    if (disabled) {
      return css`
        background-color: ${theme.color.neutral12};
        cursor: not-allowed;
        opacity: 60%;
      `
    }
    return css`
      background-color: ${theme.color[selected ? 'neutral8' : 'transparent']};
      cursor: pointer;
      :hover {
        border: solid 1px ${theme.color[selected ? 'neutral8' : 'neutral5']};
      }
    `
  }}
`

const RadioTitle = styled.p<{ color: keyof Color; selected: boolean }>`
  color: ${({ theme, color }): string => theme.color[color]};
  font-size: ${({ selected, theme }): string => theme.fontSize[selected ? 'lg' : 'md']};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: 24px;
  margin-bottom: 0;
  ${removeUserSelect}
`
const RadioButton: React.FC<{
  direction: Direction
  disabled: boolean
  selected: boolean
  onClick: (direction: Direction) => void
}> = ({ direction, disabled, selected, onClick }) => {
  const name = direction === 'long' ? 'Long' : 'Short'
  const iconName: IconName = direction === 'long' ? 'long' : 'short'

  const handleClick = (): void => {
    onClick(direction)
  }

  return (
    <RadioButtonWrapper disabled={disabled} selected={selected} onClick={handleClick}>
      <RadioTitle
        color={direction === 'long' ? 'success' : 'error'}
        selected={!disabled && selected}
      >
        {name}
      </RadioTitle>
      <Icon name={iconName} />
    </RadioButtonWrapper>
  )
}

const DirectionRadio: React.FC = () => {
  const router = useRouter()
  const { tradeStore } = useRootStore()
  const { direction, selectedMarket } = tradeStore

  const onSelectDirection = (newDirection: Direction): void => {
    if (newDirection === direction || !selectedMarket) return
    const tradeUrl = tradeStore.setDirection(newDirection)
    router.push(tradeUrl)
  }

  return (
    <Wrapper>
      {directions.map((value) => (
        <RadioButton
          disabled={!selectedMarket}
          key={value}
          direction={value}
          selected={direction === value}
          onClick={onSelectDirection}
        />
      ))}
    </Wrapper>
  )
}

export default observer(DirectionRadio)
