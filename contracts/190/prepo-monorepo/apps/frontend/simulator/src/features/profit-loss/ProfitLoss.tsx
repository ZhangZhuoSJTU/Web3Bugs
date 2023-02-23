import React from 'react'
import styled from 'styled-components'

import { useAppSelector } from '../../app/hooks'
import useBreakpoint from '../../hooks/useBreakpoint'
import { bigAmountToUsd } from '../../utils/number-utils'
import RoiPercent, { RoiWrapper } from '../../components/RoiPercent'
import { selectOutcome } from '../position/outcome-selector'
import { formatUsd } from '../../helpers'
import ProfitBackground from '../../assets/images/profit-background.svg'
import LossBackground from '../../assets/images/loss-background.svg'

const Wrapper = styled.div`
  position: sticky;
`

const Container = styled.div<{ profit: number }>`
  align-items: center;
  background-color: ${({ theme, profit }): string => {
    if (profit > 0) return theme.colors.profitBright
    if (profit < 0) return theme.colors.loss
    return theme.colors.buttonLight
  }};
  ${({ profit }): string => {
    if (profit > 0) return `background-image: url(${ProfitBackground});`
    if (profit < 0) return `background-image: url(${LossBackground});`
    return ''
  }}
  background-size: cover;
  border-radius: 0.75rem;
  color: ${({ theme, profit }): string => {
    if (profit === 0) return theme.colors.accent
    return theme.colors.foreground
  }};
  display: flex;
  flex-direction: row;
  height: 8.875rem;
  margin: 1rem 0;
  padding: 1rem;
`

const RhsWrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  margin-left: 1rem;
  width: 100%;
`

const TopOuter = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  width: 100%;
`

const BottomOuter = styled.div`
  align-items: center;
  display: flex;
  font-size: 0.75rem;
  justify-content: space-between;
  width: 100%;
`

const Equals = styled.span`
  font-size: 3.4375rem;
  font-weight: bold;
`

const UNKNOWN_AMOUNT = '???'

const ProfitLoss: React.FC = () => {
  const outcome = useAppSelector(selectOutcome)
  const breakpoint = useBreakpoint()
  const formatAmount = breakpoint === 'lg' ? formatUsd : bigAmountToUsd
  const isZero = outcome.netProfitLoss.amount === 0
  const depositedAmount = isZero ? UNKNOWN_AMOUNT : formatAmount(outcome.deposited)
  const withdrawnAmount = isZero ? UNKNOWN_AMOUNT : formatAmount(outcome.withdrawn)
  const netProfitLossAmount = isZero ? UNKNOWN_AMOUNT : formatAmount(outcome.netProfitLoss.amount)

  return (
    <Wrapper>
      <Container profit={outcome.netProfitLoss.amount}>
        <Equals>=</Equals>
        <RhsWrapper>
          <TopOuter>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem' }}>Your Profit/Loss</span>
              <span style={{ fontSize: '2.25rem', fontWeight: 'bold' }}>{netProfitLossAmount}</span>
            </div>
            {!isZero && (
              <RoiWrapper style={{ marginRight: '1.25rem', marginLeft: '0.5rem' }}>
                <RoiPercent roi={outcome.netProfitLoss.percent} />
              </RoiWrapper>
            )}
          </TopOuter>
          <BottomOuter>
            Deposited: {depositedAmount} | Withdrawn: {withdrawnAmount}
          </BottomOuter>
        </RhsWrapper>
      </Container>
    </Wrapper>
  )
}

export default ProfitLoss
