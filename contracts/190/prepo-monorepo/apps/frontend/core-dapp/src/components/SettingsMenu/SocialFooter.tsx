import Link from 'next/link'
import { Flex, Icon, IconName } from 'prepo-ui'
import styled from 'styled-components'
import { PREPO_DISCORD, PREPO_MEDIUM, PREPO_TWITTER } from '../../lib/constants'

type Props = {
  iconName: IconName
  href: string
}

const IconWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: pointer;
  :hover {
    color: ${({ theme }): string => theme.color.primary};
  }
`

const SocialMediaButton: React.FC<Props> = ({ iconName, href }) => (
  <Link href={href} target="_blank">
    <a href={href} target="_blank" rel="noreferrer">
      <IconWrapper>
        <Icon name={iconName} height="14" width="14" />
      </IconWrapper>
    </a>
  </Link>
)

const SocialFooter: React.FC = () => (
  <Flex alignItems="center" gap={12} justifyContent="start" paddingX={24} paddingTop={12}>
    <SocialMediaButton iconName="discord" href={PREPO_DISCORD} />
    <SocialMediaButton iconName="twitter" href={PREPO_TWITTER} />
    <SocialMediaButton iconName="medium" href={PREPO_MEDIUM} />
  </Flex>
)

export default SocialFooter
