import { Button, Modal } from 'antd'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useRootStore } from '../../context/RootStoreProvider'
import { spacingIncrement } from '../../utils/theme/utils'

const Header = styled.div`
  font-size: ${({ theme }): string => theme.fontSize['2xl']};
  text-align: center;
`

const SubTitle = styled.div`
  font-size: ${({ theme }): string => theme.fontSize.md};
`

const ModalSection = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: ${spacingIncrement(24)};
`

const AccountModal: React.FC = () => {
  const { web3Store } = useRootStore()
  const account = web3Store.signerState.address

  const { uiStore } = useRootStore()
  const { accountModalOpen } = uiStore

  const onClose = (): void => {
    uiStore.setAccountModalOpen(false)
  }

  const handleDeactivateAccount = (): void => {
    web3Store.disconnect()
    onClose()
  }

  return (
    <Modal
      title="Vertically centered modal dialog"
      centered
      visible={accountModalOpen}
      onOk={onClose}
      onCancel={onClose}
    >
      <Header>Account</Header>
      <ModalSection>
        <SubTitle>Connected</SubTitle>
        <Button size="small" onClick={handleDeactivateAccount}>
          Disconnect
        </Button>
      </ModalSection>
      <ModalSection>
        <SubTitle>
          {account &&
            `${account.slice(0, 6)}...${account.slice(account.length - 4, account.length)}`}
        </SubTitle>
        <CopyToClipboard text={account ?? ''}>
          <Button size="small">Copy to Clipboard</Button>
        </CopyToClipboard>
      </ModalSection>
    </Modal>
  )
}

export default observer(AccountModal)
