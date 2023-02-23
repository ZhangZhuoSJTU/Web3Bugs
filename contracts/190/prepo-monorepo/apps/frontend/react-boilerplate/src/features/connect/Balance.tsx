import { ethers } from 'ethers'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { useRootStore } from '../../context/RootStoreProvider'
import { centered, spacingIncrement } from '../../utils/theme/utils'

const Wrapper = styled.div`
  ${centered}
  display: flex;
`

const Text = styled.div`
  color: ${({ theme }): string => theme.color.whiteFont};
  font-size: ${({ theme }): string => theme.fontSize.md};
  margin-right: ${spacingIncrement(6)};
`

const Balance: React.FC = () => {
  const { web3Store, usdcStore } = useRootStore()
  const { balance } = web3Store.signerState
  const { formattedSignerBalance, symbolString } = usdcStore
  const formattedBalance = ethers.utils.formatEther(balance || 0)

  return (
    <Wrapper>
      <Text>{formattedBalance} ETH</Text>
      <Text>
        {formattedSignerBalance || 'LOADING'} {symbolString || 'LOADING'}
      </Text>
    </Wrapper>
  )
}

export default observer(Balance)
