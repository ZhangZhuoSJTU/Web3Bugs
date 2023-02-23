import { Alert, media } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { useRootStore } from '../../context/RootStoreProvider'

const Message = styled.span<{ type?: 'success' | 'error' }>`
  color: ${({ theme, type }): string =>
    type === 'error' ? theme.color.error : theme.color.success};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};

  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const DelegateAlertValidation: React.FC = () => {
  const {
    delegateStore: { customDelegate, alreadySelected },
  } = useRootStore()
  const ensName = customDelegate?.ensName ?? ''
  const address = customDelegate?.delegateAddress ?? undefined

  const validText = ensName ? 'Valid ENS name' : 'Valid Ethereum address'
  const invalidText = 'Invalid value'
  const type = address ? 'success' : 'error'
  const text = address ? validText : invalidText
  const message = alreadySelected ? 'This address is already selected' : text

  return <Alert message={<Message type={type}>{message}</Message>} type={type} />
}

export default observer(DelegateAlertValidation)
