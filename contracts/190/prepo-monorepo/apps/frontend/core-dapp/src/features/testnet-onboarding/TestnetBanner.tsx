import { Typography } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import { useRootStore } from '../../context/RootStoreProvider'

const StyledText = styled(Typography)`
  text-align: center;
  text-overflow: ellipsis;
  width: 100%;
`

const TestnetBanner: React.FC = () => {
  const {
    web3Store: {
      network: { testNetwork = true },
    },
  } = useRootStore()

  if (!testNetwork) return null

  return (
    <StyledText variant="text-regular-base" background="warning" color="white" py={6}>
      <Trans>Connected to Testnet (Goerli)</Trans>
    </StyledText>
  )
}

export default observer(TestnetBanner)
