import { Heading, spacingIncrement, media, Flex } from 'prepo-ui'
import styled from 'styled-components'
import BackButton from './BackButton'
import { TextAlign } from '../../components/Heading'
import { Routes } from '../../lib/routes'

type TitleProps = {
  withBackButton?: boolean
  align?: TextAlign
  href?: Routes
}

const StyledHeading = styled(Heading)`
  align-items: stretch;
  color: ${({ theme }): string => theme.color.accent3};
  display: flex;
  flex: 1;
  font-size: ${({ theme }): string => theme.fontSize.xl};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  justify-content: center;
  line-height: ${spacingIncrement(30)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['4xl']};
    font-weight: ${({ theme }): number => theme.fontWeight.bold};
    line-height: ${spacingIncrement(45)};
  `}
`

const PageTitle: React.FC<TitleProps> = ({
  withBackButton = true,
  align = 'center',
  children,
  href = Routes.PPO,
}) => (
  <Flex alignItems="flex-start">
    {withBackButton && <BackButton href={href} />}
    <StyledHeading type="h3" align={align}>
      {children}
    </StyledHeading>
    {withBackButton && <div />}
  </Flex>
)

export default PageTitle
