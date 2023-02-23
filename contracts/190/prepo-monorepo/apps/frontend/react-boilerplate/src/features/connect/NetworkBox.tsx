import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { useRootStore } from '../../context/RootStoreProvider'
import { spacingIncrement } from '../../utils/theme/utils'

const Wrapper = styled.div`
  align-items: center;
  background: ${({ theme }): string => theme.color.primary};
  border-radius: ${({ theme }): string => `${theme.borderRadius}px`};
  color: ${({ theme }): string => theme.color.whiteFont};
  display: flex;
  height: ${spacingIncrement(40)};
  line-height: 1;
  margin-right: ${spacingIncrement(32)};
  padding: 0 ${spacingIncrement(16)};
`

const NetworkBox: React.FC = () => {
  const { web3Store } = useRootStore()
  const { network } = web3Store

  if (!network) return null

  return (
    <Wrapper>
      <div>{network.name}</div>
    </Wrapper>
  )
}

export default observer(NetworkBox)
