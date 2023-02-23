import React from 'react'
import styled from 'styled-components'
import OutcomeTable from '../outcome-table/OutcomeTable'
import ProfitLoss from '../profit-loss/ProfitLoss'
import { useAppSelector } from '../../app/hooks'
import { media } from '../../utils/media'
import Deposit from '../deposit/Deposit'

type WrapperProps = {
  visibleOnMobile: boolean
  hasCompletedPositionSettings: boolean
}

const Wrapper = styled.div`
  div {
    transition: background-color 0.1s ease;
  }
  ${media.lg`
    display: ${({ hasCompletedPositionSettings }: WrapperProps): string =>
      hasCompletedPositionSettings ? 'block' : 'none'};
    opacity: ${({ visibleOnMobile }: WrapperProps): string => (visibleOnMobile ? '1' : '0')};
    transition: transform 0.3s ease-in, opacity 0.3s ease-in;
  `}
`

const Outcome: React.FC = () => {
  const position = useAppSelector((state) => state.position)

  return (
    <Wrapper
      visibleOnMobile={position.ui.hasCompletedEntryExit}
      hasCompletedPositionSettings={position.ui.hasCompletedEntryExit}
    >
      <Deposit />
      <OutcomeTable />
      <ProfitLoss />
    </Wrapper>
  )
}

export default Outcome
