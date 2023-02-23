import { Box, Grid, Flex, Icon, spacingIncrement, media } from 'prepo-ui'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import { PpoHistoryItem } from './ppo-history.types'
import PpoHistoryEvent from './PpoHistoryEvent'
import { getFullLiteralDateTimeFromSeconds } from '../../../utils/date-utils'
import Link from '../../../components/Link'

const Wrapper = styled.div`
  border-bottom: 1px solid ${({ theme }): string => theme.color.neutral8};

  &:last-child {
    border: none;
  }
`

const Amount = styled.div`
  color: ${({ theme }): string => theme.color.accent3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(30)};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const AmountUSD = styled.span`
  color: ${({ theme }): string => theme.color.neutral11};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(22)};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const Subtitle = styled.div`
  color: ${({ theme }): string => theme.color.neutral11};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(18)};
  margin-bottom: ${spacingIncrement(8)};
`

const Timestamp = styled.div`
  color: ${({ theme }): string => theme.color.accent3};
  font-size: ${({ theme }): string => theme.fontSize.lg};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(26)};
`

const PpoHistoryItemDesktop: React.FC<{ item: PpoHistoryItem }> = ({ item }) => (
  <Wrapper>
    <Grid
      gap={`${spacingIncrement(96)} ${spacingIncrement(31)}}`}
      gridTemplateColumns="1fr 1fr 1fr auto"
      alignItems="center"
      pl={80}
      pr={32}
    >
      <Box display="flex" py={35}>
        <Icon name="ppo-logo" width="66" height="66" />
        <Flex ml={12} alignItems="flex-start" justifyItems="center" flexDirection="column">
          <Amount>+ {item.amount}</Amount>
          <AmountUSD>{item.amountUsd}</AmountUSD>
        </Flex>
      </Box>
      <Flex flexDirection="column" py={35} alignItems="flex-start">
        <Subtitle>
          <Trans>Transaction Date</Trans>
        </Subtitle>
        <Timestamp>{getFullLiteralDateTimeFromSeconds(item.timestamp)}</Timestamp>
      </Flex>
      <PpoHistoryEvent event={item.type} />
      <Link href="mockurl">
        <Icon name="share" width="24" height="24" color="neutral5" />
      </Link>
    </Grid>
  </Wrapper>
)

export default PpoHistoryItemDesktop
