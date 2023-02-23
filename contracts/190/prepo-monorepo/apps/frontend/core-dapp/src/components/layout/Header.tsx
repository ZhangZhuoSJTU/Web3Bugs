import { Layout } from 'antd'
import styled from 'styled-components'
import { coreDappTheme, Flex, Icon, media, spacingIncrement } from 'prepo-ui'
import Navigation from '../Navigation'
import ConnectButton from '../../features/connect/ConnectButton'
import TestnetBanner from '../../features/testnet-onboarding/TestnetBanner'
import DynamicBanner from '../../features/testnet-onboarding/DynamicBanner'
import SettingsMenu from '../SettingsMenu'

const { Z_INDEX } = coreDappTheme

const { Header: AHeader } = Layout

const Wrapper = styled.div`
  position: sticky;
  top: 0;
  z-index: ${Z_INDEX.navigation};
  .ant-layout-header {
    align-items: center;
    background-color: ${({ theme }): string => theme.color.neutral10};
    display: flex;
    height: min-content;
    justify-content: space-between;
    padding: ${spacingIncrement(16)};
    position: relative;
    ${media.tablet`
      padding: ${spacingIncrement(32)};
  `};
  }
`

const Header: React.FC = () => (
  <>
    <TestnetBanner />
    <DynamicBanner />
    <Wrapper>
      <AHeader>
        <Flex justifyContent="flex-start" gap={8}>
          <Icon name="brand-logo" color="primaryWhite" height="38" width="115" />
          <Navigation />
        </Flex>
        <Flex gap={8}>
          <ConnectButton />
          <SettingsMenu />
        </Flex>
      </AHeader>
    </Wrapper>
  </>
)

export default Header
