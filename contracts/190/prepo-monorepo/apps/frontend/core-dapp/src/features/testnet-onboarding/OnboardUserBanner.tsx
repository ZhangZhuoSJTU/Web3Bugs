import { Typography } from 'prepo-ui'
import styled from 'styled-components'
import Link from '../../components/Link'
import { Routes } from '../../lib/routes'

const StyledText = styled(Typography)`
  text-align: center;
  text-overflow: ellipsis;
  width: 100%;
`

const CustomLink = styled(Link)`
  text-decoration: underline;
  whitespace: nowrap;

  :hover {
    color: ${({ theme }): string => theme.color.darkBlue};
    text-decoration: underline;
  }
`

const OnboardUserBanner: React.FC = () => (
  <StyledText as="p" variant="text-regular-base" background="success" color="white" py={6}>
    Your testnet funds have arrived!{' '}
    <span>
      <CustomLink href={Routes.Deposit}>Deposit now</CustomLink>
    </span>{' '}
    to start using the app.
  </StyledText>
)

export default OnboardUserBanner
