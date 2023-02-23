import React from 'react'
import styled from 'styled-components'
import PositionSettingsValuationRange from './PositionSettingsValuationRange'
import MarketPosition from '../MarketPosition'
import MarketValuation from '../MarketValuation'

const Wrapper = styled.div``

const PositionSettingsEntryExit: React.FC = () => (
  <Wrapper>
    <MarketPosition />
    <PositionSettingsValuationRange />
    <MarketValuation />
  </Wrapper>
)

export default PositionSettingsEntryExit
