import { Box, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import PpoHistoryItems from './PpoHistoryItems'
import PpoHistoryActionBar from './PpoHistoryActionBar'
import PageDescription from '../PageDescription'
import PageTitle from '../PageTitle'

const Description = styled(PageDescription)`
  display: none;
  margin-bottom: ${spacingIncrement(20)};
  margin-top: ${spacingIncrement(8)};
  ${media.desktop`
    display: block;
  `}
`

const PpoHistoryPage: React.FC = () => (
  <Box maxWidth={1000} mx="auto">
    <PageTitle>
      <Trans>PPO History</Trans>
    </PageTitle>
    <Description>
      <Trans>Track your PPO rewards on prePO</Trans>
    </Description>
    <PpoHistoryActionBar />
    <PpoHistoryItems />
  </Box>
)

export default PpoHistoryPage
