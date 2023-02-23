import { t, Trans } from '@lingui/macro'
import { media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import useResponsive from '../../../hooks/useResponsive'
import { PREPO_DISCORD } from '../../../lib/constants'
import { IconSizeResponsive } from '../../../types/general.types'
import ButtonLink from '../ButtonLink'

const Wrapper = styled.div`
  border: 1px solid ${({ theme }): string => theme.color.neutral6};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  color: ${({ theme }): string => theme.color.neutral3};
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  gap: ${spacingIncrement(16)};
  line-height: ${spacingIncrement(14)};
  max-width: ${spacingIncrement(480)};
  padding: ${spacingIncrement(16)} ${spacingIncrement(20)};
  width: 100%;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
    gap: ${spacingIncrement(24)};
    line-height: ${spacingIncrement(36)};
    padding: ${spacingIncrement(28)};
  `}
  > a {
    border: none;
    position: relative;
    width: 100%;
  }
`

const buttonList = [
  { title: t`Vote on Snapshot`, href: 'https://vote.prepo.io/' },
  { title: t`Discuss on Discord`, href: PREPO_DISCORD },
  // TODO: show later { title: 'Discuss on Forum', href: ' https://forum.prepo.io/' },
  { title: t`Learn about Governance`, href: 'https://docs.prepo.io/governance' },
] as const

const externalIconSize: IconSizeResponsive = {
  desktop: 14,
  mobile: 15,
}

const Participate: React.FC = () => {
  const { isDesktop } = useResponsive()
  const iconSize = isDesktop ? externalIconSize.desktop : externalIconSize.mobile

  return (
    <Wrapper>
      <Trans>Participate</Trans>
      {buttonList.map(({ title, href }, index) => (
        <ButtonLink
          key={title}
          title={title}
          href={href}
          target="_blank"
          externalIconStyles={{
            size: iconSize,
            marginRight: {
              desktop: '0',
            },
          }}
          customStyles={
            index === 0
              ? undefined
              : {
                  background: 'primaryAccent',
                  label: 'primary',
                  hoverBackground: 'primaryAccent',
                  hoverLabel: 'primary',
                }
          }
        />
      ))}
    </Wrapper>
  )
}

export default Participate
