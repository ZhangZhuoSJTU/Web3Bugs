import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { Button } from 'antd'
import NumberInput from '../../components/NumberInput'
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
  width: 40%;
`

const Title = styled(Heading)`
  margin-bottom: ${spacingIncrement(32)};
`

const IconWrapper = styled.div`
  align-items: center;
  display: flex;
`

const IconImage = styled.img`
  border-radius: 50%;
  max-width: 25px;
`

const IconText = styled.div`
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.extraBold};
  margin-left: ${spacingIncrement(16)};
`

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: ${spacingIncrement(16)};
  width: 40%;
`

const SwapButton = styled(Button)`
  margin-top: ${spacingIncrement(32)};
`

const CoinIcon: React.FC<{ src: string; name: string }> = ({ src, name }) => (
  <IconWrapper>
    <IconImage src={src} alt={name} />
    <IconText>{name}</IconText>
  </IconWrapper>
)

const Swap: React.FC = () => {
  const { web3Store, uniswapV2RouterContractStore, swapStore } = useRootStore()
  const { signerState } = web3Store
  const account = signerState.address
  const { ethInputValue, usdcInputValue, setUsdcInputValue, setEthInputValue } = swapStore

  const amountsOut = uniswapV2RouterContractStore.getAmountsOut('1000', [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    '0x6b175474e89094c44da98b954eedeac495271d0f',
  ])

  // eslint-disable-next-line no-console
  console.log('swap', amountsOut)

  const swapDisabled =
    usdcInputValue === undefined ||
    usdcInputValue === '' ||
    (usdcInputValue !== undefined && parseFloat(usdcInputValue) <= 0)

  return (
    <Wrapper>
      <Title type="h5">Swap</Title>
      <Row>
        <CoinIcon
          name="USDC"
          src="https://raw.githubusercontent.com/compound-finance/token-list/master/assets/asset_USDC.svg"
        />
        <NumberInput
          disabled={!account}
          onChange={(value): void => {
            setUsdcInputValue(`${value}`)
          }}
          placeholder="0.0"
          value={usdcInputValue}
        />
      </Row>

      <Row>
        <CoinIcon name="ETH" src="/ETH-icon.png" />
        <NumberInput
          disabled={!account}
          onChange={(value): void => {
            setEthInputValue(`${value}`)
          }}
          value={ethInputValue}
        />
      </Row>

      <SwapButton disabled={swapDisabled}>{swapDisabled ? 'Enter an amount' : 'Swap'}</SwapButton>
    </Wrapper>
  )
}

export default observer(Swap)
