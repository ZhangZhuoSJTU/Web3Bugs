import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { spacingIncrement, TokenInput } from 'prepo-ui'
import WithdrawTransactionSummary from './WithdrawTransactionSummary'
import SecondaryNavigation from '../../components/SecondaryNavigation'
import Card from '../../components/Card'
import { useRootStore } from '../../context/RootStoreProvider'
import useResponsive from '../../hooks/useResponsive'
import CurrenciesBreakdown from '../../components/CurrenciesBreakdown'

const CardWrapper = styled(Card)`
  padding: 0 ${spacingIncrement(10)};
  width: ${spacingIncrement(720)};
`

const Wrapper: React.FC = ({ children }) => {
  const { isPhone } = useResponsive()
  if (isPhone) {
    return <>{children}</>
  }
  return <CardWrapper>{children}</CardWrapper>
}

const Navigation = styled(SecondaryNavigation)`
  margin-bottom: ${spacingIncrement(32)};
`

const FormItem = styled.div`
  margin-bottom: ${spacingIncrement(24)};
`

const WithdrawPage: React.FC = () => {
  const { web3Store, preCTTokenStore, withdrawStore } = useRootStore()
  const { tokenBalanceFormat } = preCTTokenStore
  const { connected } = web3Store
  const { setWithdrawalAmount, withdrawalAmount } = withdrawStore

  return (
    <Wrapper>
      <Navigation backUrl="/portfolio" title="Withdraw" showAdvancedSettings />
      <FormItem>
        <TokenInput
          alignInput="right"
          balance={tokenBalanceFormat}
          connected={connected}
          disableClickBalance
          max={tokenBalanceFormat}
          onChange={setWithdrawalAmount}
          shadowSuffix=""
          symbol="USD"
          usd
          value={withdrawalAmount}
        />
      </FormItem>
      <FormItem>
        <CurrenciesBreakdown />
      </FormItem>

      <FormItem>
        <WithdrawTransactionSummary />
      </FormItem>
    </Wrapper>
  )
}

export default observer(WithdrawPage)
