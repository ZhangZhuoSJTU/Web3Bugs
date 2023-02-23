import { observer } from 'mobx-react-lite'
import { Flex, spacingIncrement, ThemeModes } from 'prepo-ui'
import styled from 'styled-components'
import NetworkStatus from './NetworkStatus'
import SettingsMenuItem from './SettingsMenuItem'
import SocialFooter from './SocialFooter'
import WalletInfo from './WalletInfo'
import { useRootStore } from '../../context/RootStoreProvider'

const externalLinks = [{ link: 'https://docs.prepo.io/', name: 'Documentation' }]

const Divider = styled.div`
  padding: 0px 24px;
  width: 100%;
  ::after {
    background-color: ${({ theme }): string => theme.color.purpleStroke};
    content: '';
    display: block;
    height: ${spacingIncrement(1)};
    width: 100%;
  }
`

const MenuWrapper = styled.div`
  background-color: ${({ theme }): string => theme.color.neutral10};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  box-shadow: 0px 4px 22px rgba(98, 100, 217, 0.11);
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(12)};
  margin-top: ${spacingIncrement(6)};
  padding: ${spacingIncrement(20)} 0;
  width: ${spacingIncrement(240)};
`

const SettingsCard: React.FC<{ onClose: () => void; portfolioValue?: string }> = ({ onClose }) => {
  const { uiStore } = useRootStore()
  const { selectedTheme, setTheme } = uiStore
  const isDarkTheme = selectedTheme === ThemeModes.Dark

  const toggleTheme = (): void => {
    setTheme(selectedTheme === ThemeModes.Dark ? ThemeModes.Light : ThemeModes.Dark)
  }

  return (
    <MenuWrapper>
      <Flex gap={8} flexDirection="column" alignItems="stretch">
        <WalletInfo onClose={onClose} />
        <NetworkStatus />
        <SettingsMenuItem
          iconName={isDarkTheme ? 'light-theme' : 'dark-theme'}
          onClick={toggleTheme}
        >
          {isDarkTheme ? `Light` : 'Dark'} Mode
        </SettingsMenuItem>
      </Flex>
      <Divider />
      <Flex gap={8} flexDirection="column" alignItems="stretch">
        {externalLinks.map(({ link, name }) => (
          <SettingsMenuItem key={link} iconName="arrow-up-right" href={link} external>
            {name}
          </SettingsMenuItem>
        ))}
      </Flex>
      <SocialFooter />
    </MenuWrapper>
  )
}

export default observer(SettingsCard)
