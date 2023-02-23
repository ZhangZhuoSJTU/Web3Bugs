import { Trans } from '@lingui/macro'
import { Icon, media, spacingIncrement, Typography } from 'prepo-ui'
import styled from 'styled-components'
import Accordion from '../../components/Accordion'
import useResponsive from '../../hooks/useResponsive'

const StyledAccordion = styled(Accordion)`
  margin-top: ${spacingIncrement(8)};
  > button {
    border: 1px solid ${({ theme }): string => `${theme.color.profileBorderColor}`};
    border-bottom: none;
    border-top-left-radius: ${({ theme }): string => theme.borderRadius.base};
    border-top-right-radius: ${({ theme }): string => theme.borderRadius.base};
    padding: ${spacingIncrement(15)} ${spacingIncrement(21)};
    ${media.desktop`
      padding: ${spacingIncrement(25)}  ${spacingIncrement(23)};
    `}
  }
  > div {
    border: 1px solid ${({ theme }): string => `${theme.color.profileBorderColor}`};
    border-bottom-left-radius: ${({ theme }): string => theme.borderRadius.base};
    border-bottom-right-radius: ${({ theme }): string => theme.borderRadius.base};
    border-top: none;
    padding: 0;
  }
  ${media.desktop`
    margin-top: ${spacingIncrement(16)};
  `}
`

const ProfileAccordion: React.FC = ({ children }) => {
  const { isDesktop } = useResponsive()
  const accordionCollapsebleIconSize = isDesktop ? '32' : '24'
  const logoSize = isDesktop ? '46' : '31'
  return (
    <StyledAccordion
      visible
      title={
        <Typography
          as="h3"
          variant="text-semiBold-3xl"
          color="neutral1"
          display="flex"
          alignItems="center"
          gap={8}
        >
          <Icon name="ppo-logo" width={logoSize} height={logoSize} />
          <Trans>PPO Stats</Trans>
        </Typography>
      }
      renderIcon={(active): JSX.Element => (
        <Icon
          name={active ? 'minus' : 'plus'}
          width={accordionCollapsebleIconSize}
          height={accordionCollapsebleIconSize}
        />
      )}
    >
      {children}
    </StyledAccordion>
  )
}

export default ProfileAccordion
