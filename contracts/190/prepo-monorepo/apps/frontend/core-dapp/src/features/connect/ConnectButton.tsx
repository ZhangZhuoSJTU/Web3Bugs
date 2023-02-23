import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Button } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  display: inline-flex;
`

const Flex = styled.div`
  display: flex;
`

const ConnectButton: React.FC = () => {
  const { web3Store } = useRootStore()
  const { signerState } = web3Store
  const account = signerState.address

  const onClickLogin = (): void => {
    web3Store.connect()
  }

  if (account) return null
  return (
    <Wrapper>
      <Flex>
        <Button type="primary" onClick={onClickLogin} size="sm">
          <Trans>Connect Wallet</Trans>
        </Button>
      </Flex>
    </Wrapper>
  )
}

export default observer(ConnectButton)
