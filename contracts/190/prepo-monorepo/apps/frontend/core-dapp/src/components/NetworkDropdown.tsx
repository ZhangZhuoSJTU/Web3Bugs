import styled from 'styled-components'
import { Flex, Icon, media, spacingIncrement, Typography } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { ChainId, Network, NETWORKS } from 'prepo-constants'
import Dropdown from './Dropdown'
import Menu from './Menu'
import { useRootStore } from '../context/RootStoreProvider'

const StyledDropdown = styled(Dropdown)<{ isNetworkSupported: boolean }>`
  &&& {
    background-color: ${({ isNetworkSupported, theme }): string =>
      isNetworkSupported ? 'transparent' : theme.color.error};
    border-color: ${({ isNetworkSupported, theme }): string =>
      theme.color[isNetworkSupported ? 'neutral7' : 'error']};
    color: ${({ isNetworkSupported, theme }): string =>
      theme.color[isNetworkSupported ? 'neutral1' : 'white']};
    height: ${spacingIncrement(38)};
    margin-left: ${spacingIncrement(16)};
    margin-right: ${spacingIncrement(8)};
    padding: ${spacingIncrement(4)};
    ${media.desktop`
      padding: ${spacingIncrement(8)};
    `}
  }
`

const StyledName = styled(Typography)`
  display: none;
  white-space: nowrap;
  ${media.desktop`
    display: flex;
  `}
`

const StyledText = styled(Typography)`
  border-bottom: 1px solid ${({ theme }): string => theme.color.primaryAccent};
  padding: ${spacingIncrement(12)} ${spacingIncrement(24)};
  text-transform: capitalize;
  width: 100%;
  ${media.desktop`
    border-bottom: none;
    padding: 0 ${spacingIncrement(8)};
  `}
`
const StyledMenu = styled(Menu)`
  &&&& {
    .ant-dropdown-menu-item-divider {
      background-color: ${({ theme }): string => theme.color.primaryAccent};
    }
    .ant-dropdown-menu-item {
      height: ${spacingIncrement(50)};
    }
    .ant-dropdown-menu-item-disabled:hover {
      background-color: transparent;
    }
  }
`

const comingSoonNetworks: Network[] = [NETWORKS.arbitrumOne]
const isNetworkComingSoon = (id: ChainId): boolean =>
  comingSoonNetworks.map(({ chainId }) => chainId).includes(id)

const Item: React.FC<{ network: Network; selected: boolean }> = ({
  network: { chainName, chainId, displayName, iconName },
  selected,
}) => {
  const color = selected ? 'primary' : 'neutral1'
  const iconSize = '24px'
  const supported = !isNetworkComingSoon(chainId)

  return (
    <StyledText
      variant="text-medium-md"
      display="flex"
      alignItems="center"
      gap={20}
      color={supported ? color : 'neutral5'}
    >
      <Icon name={iconName} width={iconSize} height={iconSize} />
      {displayName ?? chainName}
      {supported ? '' : ' (Coming Soon)'}
    </StyledText>
  )
}

const NetworkDropdown: React.FC = () => {
  const {
    web3Store,
    config: { supportedNetworks },
  } = useRootStore()
  const { network: selectedNetwork, isNetworkSupported } = web3Store

  const allNetworks = [...supportedNetworks, ...comingSoonNetworks]

  const marketsDropdownMenu = (
    <StyledMenu
      size="md"
      items={allNetworks.map((network) => ({
        key: network.chainId,
        onClick: (): void => web3Store.setNetwork(network),
        disabled: isNetworkComingSoon(network.chainId),
        label: (
          <Item
            network={network}
            selected={isNetworkSupported && selectedNetwork.chainId === network.chainId}
          />
        ),
      }))}
    />
  )

  return (
    <StyledDropdown
      isNetworkSupported={isNetworkSupported}
      overlay={marketsDropdownMenu}
      variant="outline"
      size="md"
      placement="bottom"
    >
      <Flex alignItems="center" gap={8}>
        <Icon
          name={isNetworkSupported ? selectedNetwork.iconName : 'exclamation-triangle'}
          width="24"
          height="24"
        />
        <StyledName variant="text-medium-base" style={{ textTransform: 'capitalize' }}>
          {isNetworkSupported ? selectedNetwork.name : 'Switch Network'}
        </StyledName>
      </Flex>
    </StyledDropdown>
  )
}

export default observer(NetworkDropdown)
