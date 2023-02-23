import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import OpenTrade from './open-trade'
import useTradePage from './useTradePage'
import TradePageTab from './TradePageTab'
import Card from '../../components/Card'
import { isProduction } from '../../utils/isProduction'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled(Card)`
  max-width: ${spacingIncrement(380)};
  position: relative;
  width: 100%;
  &&& {
    .ant-card-body {
      padding: 0;
    }
  }
`

const TradePage: React.FC = () => {
  useTradePage()
  const { tradeStore } = useRootStore()
  const { action } = tradeStore
  const hideTabs = isProduction()

  return (
    <Wrapper>
      {!hideTabs && <TradePageTab />}
      {/** only show close trade flow if open/close tabs are shown */}
      {!hideTabs && action === 'close' ? 'CloseTrade' : <OpenTrade />}
    </Wrapper>
  )
}

export default observer(TradePage)
