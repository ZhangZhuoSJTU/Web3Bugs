import { centered, Icon, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { i18n } from '@lingui/core'
import { NavigationItem } from './Navigation'
import Menu from './Menu'
import Link from './Link'
import Dropdown from './Dropdown'
import useResponsive from '../hooks/useResponsive'
import { Routes } from '../lib/routes'
import usePpoNavigation from '../features/ppo/usePpoNavigation'

const PpoWrapper = styled.div`
  ${centered};
`

const Name = styled.div`
  align-items: center;
  color: inherit;
  display: flex;
  flex-direction: row;
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin: 0 ${spacingIncrement(32)} 0 ${spacingIncrement(20)};
`

const DropDownWrapper = styled(Dropdown)`
  padding: 0;
  &&& {
    &.ant-dropdown-trigger {
      background-color: transparent;
    }
  }
`

const PpoLabel = (): JSX.Element => (
  <PpoWrapper>
    <NavigationItem iconName="ppo-logo" path={Routes.PPO} name="PPO" />
  </PpoWrapper>
)

const PpoDropdown: React.FC = () => {
  const { isPhone, isTablet } = useResponsive()
  const ppoItems = usePpoNavigation()

  const desktopDropdownMenu = (): React.ReactElement => (
    <Menu
      keepBackgroundColorOnHover
      size="md"
      items={ppoItems
        .filter(({ href }) => Boolean(href))
        .map(({ title, href, target }) => ({
          key: title,
          label: (
            <Link href={href} target={target}>
              <Name>
                {i18n._(title)}
                {target && (
                  <Icon
                    name="share"
                    height="12"
                    width="12"
                    style={{ marginLeft: spacingIncrement(12), paddingTop: spacingIncrement(2) }}
                  />
                )}
              </Name>
            </Link>
          ),
        }))}
    />
  )

  return isPhone || isTablet ? (
    <PpoLabel />
  ) : (
    <DropDownWrapper
      overlay={desktopDropdownMenu}
      variant="standard"
      size="md"
      trigger={['hover']}
      placement="bottom"
    >
      <PpoLabel />
    </DropDownWrapper>
  )
}

export default PpoDropdown
