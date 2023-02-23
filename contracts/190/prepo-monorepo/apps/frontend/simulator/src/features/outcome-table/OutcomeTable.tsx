import React from 'react'
import styled from 'styled-components'
import OutcomeRewardsTable from './OutcomeRewardsTable'
import OutcomeTablePosition from './OutcomeTablePosition'

const Wrapper = styled.div``

const OutcomeTable: React.FC = () => (
  <Wrapper>
    <OutcomeTablePosition />
    <OutcomeRewardsTable />
  </Wrapper>
)

export default OutcomeTable
