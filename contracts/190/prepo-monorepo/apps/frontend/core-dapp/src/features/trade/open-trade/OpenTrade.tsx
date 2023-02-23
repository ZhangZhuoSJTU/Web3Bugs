import { Alert, CurrencyInput, Icon, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import DirectionRadio from './DirectionRadio'
import MarketSlideUp from './MarketSlideUp'
import TradeTransactionSummary from '../TradeTransactionSummary'
import Link from '../../../components/Link'
import { useRootStore } from '../../../context/RootStoreProvider'
import { Routes } from '../../../lib/routes'

const AlertWrapper = styled.div`
  div[class*='ant-alert-message'] {
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
    `}
  }
`

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  padding: ${spacingIncrement(8)};
`

const Message = styled.div`
  a {
    &:hover {
      color: ${({ theme }): string => theme.color.darkPrimary};
    }

    text-decoration: underline;
  }
`

const OpenTrade: React.FC = () => {
  const { tradeStore, web3Store, preCTTokenStore } = useRootStore()
  const { openTradeAmount, openTradeAmountBN, setOpenTradeAmount, selectedMarket } = tradeStore
  const { balanceOfSigner, tokenBalanceFormat } = preCTTokenStore
  const { connected, isNetworkSupported } = web3Store

  return (
    <Wrapper>
      <MarketSlideUp />
      <DirectionRadio />
      <CurrencyInput
        balance={tokenBalanceFormat}
        isBalanceZero={balanceOfSigner?.eq(0)}
        disabled={!connected || !isNetworkSupported || !selectedMarket}
        currency={{ icon: 'cash', text: 'USD' }}
        onChange={setOpenTradeAmount}
        value={openTradeAmount}
        placeholder="0"
        showBalance
      />
      <TradeTransactionSummary />
      {openTradeAmountBN !== undefined &&
        (balanceOfSigner?.lt(openTradeAmountBN) || balanceOfSigner?.eq(0)) && (
          <AlertWrapper>
            <Alert
              message={
                <Message>
                  You need to <Link href={Routes.Deposit}>deposit more funds</Link> to make this
                  trade.
                </Message>
              }
              type="warning"
              showIcon
              icon={<Icon name="info" color="warning" />}
            />
          </AlertWrapper>
        )}
    </Wrapper>
  )
}

export default observer(OpenTrade)
