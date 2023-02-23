import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import DelegateCustomAddress from './DelegateCustomAddress'
import { Routes } from '../../../lib/routes'
import Accordion from '../../../components/Accordion'

type Props = {
  visible: boolean
}

const Wrapper = styled(Accordion)`
  margin-top: ${spacingIncrement(16)};
`

const DelegateCustomAddressAccordion: React.FC<Props> = ({ visible }) => {
  const router = useRouter()
  const onCancel = (isVisible: boolean): Promise<boolean> => {
    if (!isVisible) {
      return router.push(Routes.Delegate)
    }
    return router.push(Routes.Delegate_Custom_Address)
  }

  return (
    <Wrapper title="Delegate to Custom Address" visible={visible} onChange={onCancel}>
      <DelegateCustomAddress />
    </Wrapper>
  )
}

export default observer(DelegateCustomAddressAccordion)
