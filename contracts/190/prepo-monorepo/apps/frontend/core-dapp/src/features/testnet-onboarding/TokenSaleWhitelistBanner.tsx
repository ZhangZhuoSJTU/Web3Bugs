import { Typography } from 'prepo-ui'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import { PREPO_TESTNET_FORM } from '../../lib/constants'

const StyledText = styled(Typography)`
  margin-bottom: 0;
  text-align: center;
  text-overflow: ellipsis;
  width: 100%;
`

const TokenSaleWhitelistBanner: React.FC = () => (
  <StyledText as="p" variant="text-regular-base" background="primary" color="white" py={6}>
    <Trans>
      Fill out{' '}
      <span>
        <a
          style={{ textDecoration: 'underline', whiteSpace: 'nowrap' }}
          target="_blank"
          href={PREPO_TESTNET_FORM}
          rel="noreferrer"
        >
          this form
        </a>
      </span>{' '}
      for testnet funds.
    </Trans>
  </StyledText>
)

export default TokenSaleWhitelistBanner
