import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import SettingsMenuItem from './SettingsMenuItem'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral2};
  padding: 0 ${spacingIncrement(24)};
`

const RightNetwork = styled.div`
  border: solid 1px ${({ theme }): string => theme.color.purpleStroke};
  border-left: 0;
  border-right: 0;
  line-height: ${spacingIncrement(20)};
  padding: ${spacingIncrement(6)} 0;
`

const NetworkStatus: React.FC = () => {
  const { web3Store } = useRootStore()
  const { connected, isNetworkSupported, network } = web3Store

  const handleSwitchNetwork = (): void => {
    web3Store.setNetwork(network)
  }

  if (!connected) return null
  if (!isNetworkSupported)
    return (
      <SettingsMenuItem
        onClick={handleSwitchNetwork}
        color="error"
        hoverColor="error"
        iconName="exclamation-triangle"
      >
        Switch to Arbitrum
      </SettingsMenuItem>
    )
  return (
    <Wrapper>
      <RightNetwork>Connected to {network.displayName ?? network.name}</RightNetwork>
    </Wrapper>
  )
}

export default observer(NetworkStatus)
