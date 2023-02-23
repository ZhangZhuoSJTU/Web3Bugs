import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Button } from 'antd'
import { utils } from 'ethers'
import { runInAction } from 'mobx'
import { ZERO_ADDRESS } from 'prepo-constants'
import { useRootStore } from '../../context/RootStoreProvider'
import { spacingIncrement } from '../../utils/theme/utils'
import Heading from '../../components/Heading'

const Wrapper = styled.div`
  align-items: center;
  background-color: ${({ theme }): string => theme.color.secondaryBackground};
  border-radius: ${({ theme }): string => `${theme.borderRadius * 2}px`};
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  margin-top: ${spacingIncrement(32)};
  padding: ${spacingIncrement(80)} 0;
  width: 90%;
`

const Title = styled(Heading)`
  margin-bottom: ${spacingIncrement(32)};
`

const BLACK_HOLE = ZERO_ADDRESS

const AMOUNT = '0.000000000000000001'

const BlackHole: React.FC = () => {
  const { usdcStore, web3Store } = useRootStore()
  const { signerState } = web3Store
  const { decimalsString, transferring, transferHash } = usdcStore

  const ready = decimalsString !== undefined && signerState.address

  return (
    <Wrapper>
      <Title type="h5">Black Hole</Title>
      <Button
        disabled={!ready}
        onClick={(): void => {
          if (!decimalsString) return
          runInAction(() => {
            usdcStore.transfer(BLACK_HOLE, utils.parseUnits(AMOUNT, decimalsString))
          })
        }}
        loading={transferring}
      >
        {ready ? `Throw ${AMOUNT} WEENUS into a black hole` : 'Not ready'}
      </Button>
      {transferHash && (
        <a
          style={{ marginTop: '1rem' }}
          href={`https://goerli.etherscan.io/tx/${transferHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View tx on Etherscan
        </a>
      )}
    </Wrapper>
  )
}

export default observer(BlackHole)
