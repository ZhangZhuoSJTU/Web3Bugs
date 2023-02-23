import styled from 'styled-components'
import { useRouter } from 'next/router'
import { observer } from 'mobx-react-lite'
import { centered, IconName, Icon, media, Flex, spacingIncrement } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import Link from './Link'
import { Routes } from '../lib/routes'

type PathProps = {
  iconName: IconName
  name: string
  path: Routes
}

const navigationPaths: PathProps[] = [
  {
    iconName: 'home',
    name: 'Trade',
    path: Routes.Trade,
  },
  {
    iconName: 'portfolio',
    name: 'Portfolio',
    path: Routes.Portfolio,
  },
]

const Wrapper = styled(Flex)`
  border: solid 1px ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  line-height: 1;
  padding: ${spacingIncrement(2)};
  transform: translateX(-50%);
  ${media.desktop`
    transform: translateX(0);
  `}
  ${media.largeDesktop`
    transform: translateX(-50%);
  `}
`

const Name = styled.p<{ active: boolean }>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: 0;
  opacity: ${({ active }): string => (active ? '100%' : '50%')};
  white-space: nowrap;
`

const NavigationItemWrapper = styled.div<{ active: boolean }>`
  ${centered}
  background-color: ${({ active, theme: { color } }): string =>
    color[active ? 'neutral7' : 'neutral10']};
  border-radius: ${({ theme }): string => theme.borderRadius.sm};
  color: ${({ theme, active }): string => theme.color[active ? 'primaryLight' : 'neutral5']};
  gap: ${spacingIncrement(8)};
  padding: ${spacingIncrement(8)} ${spacingIncrement(12)};
`

export const NavigationItem: React.FC<PathProps> = ({ path, iconName, name }) => {
  const router = useRouter()
  const isActive = typeof path === 'string' && router.asPath.includes(path)

  return (
    <Link href={path}>
      <NavigationItemWrapper active={isActive}>
        <Icon name={iconName} height="16" width="16" />
        <Name active={isActive}>
          <Trans id={name} />
        </Name>
      </NavigationItemWrapper>
    </Link>
  )
}

const Navigation: React.FC = () => (
  <Wrapper
    position={{ phone: 'fixed', desktop: 'static', largeDesktop: 'absolute' }}
    bottom={{ phone: 40, desktop: 'auto' }}
    left={{ phone: '50%', largeDesktop: '50%' }}
  >
    {navigationPaths.map(({ iconName, name, path }) => (
      <NavigationItem path={path} iconName={iconName} key={name} name={name} />
    ))}
  </Wrapper>
)

export default observer(Navigation)
