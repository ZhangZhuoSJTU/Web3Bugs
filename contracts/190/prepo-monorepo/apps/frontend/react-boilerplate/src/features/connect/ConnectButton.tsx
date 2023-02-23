import { Button } from 'antd'
import { observer } from 'mobx-react-lite'
import { Trans } from '@lingui/macro'
import styled from 'styled-components'
import { formatNumber } from 'prepo-utils'
import Identicon from './Identicon'
import Balance from './Balance'
import AccountModal from './AccountModal'
import { useRootStore } from '../../context/RootStoreProvider'
import { centered, spacingIncrement } from '../../utils/theme/utils'

const Wrapper = styled.div`
  border-radius: ${({ theme }): string => `${theme.borderRadius}px`};
  ${centered}
`

const BalanceWrapper = styled.div`
  align-items: center;
  display: flex;
  margin-right: ${spacingIncrement(16)};
`

const Flex = styled.div`
  display: flex;
`

const AccountIcon = styled(Identicon)`
  margin-left: ${spacingIncrement(16)};
`

const ConnectButton: React.FC = () => {
  const { uiStore, web3Store } = useRootStore()
  const { signerState } = web3Store
  const account = signerState.address
  const { balance } = signerState

  const onClickLogin = (): void => {
    web3Store.connect()
  }

  const onOpenModal = (): void => {
    uiStore.setAccountModalOpen(true)
  }

  const onClick = account ? onOpenModal : onClickLogin

  return (
    <Wrapper>
      <AccountModal />
      {balance && (
        <BalanceWrapper>
          <Balance />
        </BalanceWrapper>
      )}
      <Flex>
        <Button onClick={onClick} size="large">
          {(account && formatNumber(account, { compact: true })) ?? <Trans>Connect Wallet</Trans>}
          <AccountIcon />
        </Button>
      </Flex>
    </Wrapper>
  )
}

export default observer(ConnectButton)
