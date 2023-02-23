import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { Alert, Icon, media, spacingIncrement, TokenInput } from 'prepo-ui'
import { useEffect } from 'react'
import DepositTransactionSummary from './DepositTransactionSummary'
import SecondaryNavigation from '../../components/SecondaryNavigation'
import Card from '../../components/Card'
import { useRootStore } from '../../context/RootStoreProvider'
import useResponsive from '../../hooks/useResponsive'
import CurrenciesBreakdown from '../../components/CurrenciesBreakdown'
import { PREPO_TESTNET_FORM, USDC_SYMBOL } from '../../lib/constants'

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

const AlertWrapper = styled.div`
  div[class*='ant-alert-message'] {
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
    `}
  }
`

const Message = styled.div`
  a {
    &:hover {
      color: ${({ theme }): string => theme.color.darkPrimary};
    }
    text-decoration: underline;
    white-space: nowrap;
  }
`

const DepositPage: React.FC = () => {
  const {
    depositStore: { depositAmount, setDepositAmount },
    web3Store: { connected },
    preCTTokenStore,
    baseTokenStore: { balanceOfSigner, tokenBalanceFormat },
  } = useRootStore()

  useEffect(() => {
    if (tokenBalanceFormat) {
      setDepositAmount(tokenBalanceFormat)
    }
  }, [setDepositAmount, tokenBalanceFormat])

  return (
    <Wrapper>
      <Navigation backUrl="/portfolio" title="Deposit" showAdvancedSettings />
      <FormItem>
        <TokenInput
          alignInput="right"
          balance={tokenBalanceFormat}
          connected={connected}
          iconName="usdc"
          max={tokenBalanceFormat}
          onChange={setDepositAmount}
          showSlider
          symbol={USDC_SYMBOL}
          value={depositAmount}
        />
      </FormItem>
      <FormItem>
        <CurrenciesBreakdown />
      </FormItem>
      <FormItem>
        <DepositTransactionSummary />
      </FormItem>
      {preCTTokenStore.balanceOfSigner?.eq(0) && balanceOfSigner?.eq(0) && (
        <FormItem>
          <AlertWrapper>
            <Alert
              message={
                <Message>
                  Get FAKEUSD by filling out{' '}
                  <a target="_blank" href={PREPO_TESTNET_FORM} rel="noreferrer">
                    this form
                  </a>
                  .
                </Message>
              }
              type="warning"
              showIcon
              icon={<Icon name="info" color="warning" />}
            />
          </AlertWrapper>
        </FormItem>
      )}
    </Wrapper>
  )
}

export default observer(DepositPage)
