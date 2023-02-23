import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import DelegateCustomAddress from './DelegateCustomAddress'
import Modal from '../../../components/Modal'
import { Routes } from '../../../lib/routes'

type Props = {
  visible: boolean
}

const DelegateCustomAddressModal: React.FC<Props> = ({ visible }) => {
  const router = useRouter()
  const onCancel = (): Promise<boolean> => router.push(Routes.Delegate)

  return (
    <Modal
      centered
      titleAlign="left"
      footer={null}
      onCancel={onCancel}
      onOk={onCancel}
      title="Delegate to Custom Address"
      visible={visible}
    >
      <DelegateCustomAddress />
    </Modal>
  )
}

export default observer(DelegateCustomAddressModal)
