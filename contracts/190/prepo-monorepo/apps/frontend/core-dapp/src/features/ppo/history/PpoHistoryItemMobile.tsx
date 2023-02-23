import { Box, Flex, Icon, spacingIncrement, media } from 'prepo-ui'
import styled from 'styled-components'
import { PpoHistoryItem } from './ppo-history.types'
import PpoHistoryEvent from './PpoHistoryEvent'
import Link from '../../../components/Link'
import { get24TimeFromSeconds } from '../../../utils/date-utils'

const Wrapper = styled.div`
  border-bottom: 1px solid ${({ theme }): string => theme.color.neutral8};

  &:first-child {
    border-top: 1px solid ${({ theme }): string => theme.color.neutral8};
  }
`

const Amount = styled.div`
  color: ${({ theme }): string => theme.color.accent3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(17)};
  margin-bottom: ${spacingIncrement(8)};

  ${media.desktop`
    margin-bottom: 0;
    line-height: ${spacingIncrement(30)};
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const AmountUSD = styled.span`
  color: ${({ theme }): string => theme.color.neutral11};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(13)};

  ${media.desktop`
    line-height: ${spacingIncrement(22)};
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const Time = styled.div`
  color: ${({ theme }): string => theme.color.neutral11};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(14)};
  margin-bottom: ${spacingIncrement(8)};

  ${media.desktop`
    margin-bottom: 0;
  `}
`

const PpoHistoryItemMobile: React.FC<{ item: PpoHistoryItem }> = ({ item }) => (
  <Wrapper>
    <Flex py={10} justifyContent="space-between">
      <Box display="flex">
        <Icon name="ppo-logo" width="42" height="42" />
        <Flex ml={12} alignItems="flex-start" justifyItems="center" flexDirection="column">
          <Amount>+ {item.amount}</Amount>
          <AmountUSD>{item.amountUsd}</AmountUSD>
        </Flex>
      </Box>
      <Flex gap={16}>
        <Flex flexDirection="column" alignItems="flex-end">
          <Time>{get24TimeFromSeconds(item.timestamp)}</Time>
          <PpoHistoryEvent event={item.type} />
        </Flex>
        <Link href="mockurl">
          <Icon name="share" width="16" height="16" color="neutral5" />
        </Link>
      </Flex>
    </Flex>
  </Wrapper>
)

export default PpoHistoryItemMobile
