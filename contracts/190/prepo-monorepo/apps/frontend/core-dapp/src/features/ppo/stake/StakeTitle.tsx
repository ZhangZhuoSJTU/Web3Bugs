import { Trans } from '@lingui/macro'
import { media, Icon, Typography } from 'prepo-ui'
import styled from 'styled-components'
import PageTitle from '../PageTitle'

const StyledHeader = styled(Typography)`
  color: ${({ theme }): string => theme.color.neutral4};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${media.desktop`
    color: ${({ theme }): string => theme.color.neutral1};
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  `}
`

const StakeTitle: React.FC = () => (
  <PageTitle>
    <div>
      <Typography variant="text-semiBold-xl" display={{ phone: 'block', desktop: 'none' }} mb={25}>
        <Trans>Stake</Trans>
      </Typography>
      <StyledHeader
        display="flex"
        alignItems="center"
        variant="text-semiBold-xl"
        justifyContent="center"
        as="h4"
      >
        <Trans>Staking APY</Trans>
        {/* TODO: add tooltip text */}
        {false && <Icon name="info" color="neutral5" width="16" height="16" />}
      </StyledHeader>
      <Typography variant="text-bold-4xl" color="success" mt={4}>
        -%
      </Typography>
    </div>
  </PageTitle>
)

export default StakeTitle
