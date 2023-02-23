import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { media, spacingIncrement, Typography } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import PpoHistoryItemDesktop from './PpoHistoryItemDesktop'
import PpoHistoryItemMobile from './PpoHistoryItemMobile'
import { useRootStore } from '../../../context/RootStoreProvider'
import useResponsive from '../../../hooks/useResponsive'

const Wrapper = styled.div`
  border: none;

  ${media.desktop`
    border: 1px solid ${({ theme }): string => theme.color.neutral8};
  `}
`

const DateTitle = styled.div`
  border-bottom: 1px solid ${({ theme }): string => theme.color.neutral8};
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  padding-bottom: ${spacingIncrement(16)};

  ${media.desktop`
    display: none;
  `}
`

const PpoHistoryItems: React.FC = () => {
  const {
    uiStore: { historyComingSoon },
    ppoHistoryStore: { filteredHistoryItems },
  } = useRootStore()
  const { isDesktop } = useResponsive()
  const PpoHistoryItemComponent = isDesktop ? PpoHistoryItemDesktop : PpoHistoryItemMobile

  if (historyComingSoon)
    return (
      <Typography variant="text-medium-md" textAlign="center" color="neutral3">
        <Trans>Coming soon</Trans>
      </Typography>
    )

  return (
    <Wrapper>
      <DateTitle>21st January, 2021</DateTitle>
      {filteredHistoryItems.map((item) => (
        <PpoHistoryItemComponent key={item.type} item={item} />
      ))}
    </Wrapper>
  )
}

export default observer(PpoHistoryItems)
