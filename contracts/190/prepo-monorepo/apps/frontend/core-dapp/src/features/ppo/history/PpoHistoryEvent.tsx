import { media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { PpoEventObject, PpoHistoryEnum, PpoEventColors } from './ppo-history.types'

const Container = styled.div<{ $colors: PpoEventColors }>`
  background-color: ${({ theme, $colors }): string => theme.color[$colors.accent]};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  color: ${({ theme, $colors }): string => theme.color[$colors.primary]};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  padding: ${spacingIncrement(0.5)} ${spacingIncrement(2)};
  text-align: center;

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
    padding: ${spacingIncrement(15)} ${spacingIncrement(13)};
  `}
`

const Wrapper = styled.div`
  align-self: center;
  display: block;
`

export const eventObject: PpoEventObject = {
  [PpoHistoryEnum.LIQUIDITY]: {
    label: PpoHistoryEnum.LIQUIDITY,
    colors: {
      accent: 'accentInfo',
      primary: 'info',
    },
  },
  [PpoHistoryEnum.GOVERNANCE]: {
    label: PpoHistoryEnum.GOVERNANCE,
    colors: {
      accent: 'accentSuccess',
      primary: 'success',
    },
  },
  [PpoHistoryEnum.STAKING]: {
    label: PpoHistoryEnum.STAKING,
    colors: {
      accent: 'accentWarning',
      primary: 'warning',
    },
  },
  [PpoHistoryEnum.TRADING_REWARDS]: {
    label: PpoHistoryEnum.TRADING_REWARDS,
    colors: {
      accent: 'accentError',
      primary: 'error',
    },
  },
  [PpoHistoryEnum.BONDING]: {
    label: PpoHistoryEnum.BONDING,
    colors: {
      accent: 'accentPurple',
      primary: 'bondingEvent',
    },
  },
}

type Props = {
  event: PpoHistoryEnum
}

const PpoHistoryEvent: React.FC<Props> = ({ event }) => (
  <Wrapper>
    <Container $colors={eventObject[event].colors}>{eventObject[event].label}</Container>
  </Wrapper>
)

export default PpoHistoryEvent
