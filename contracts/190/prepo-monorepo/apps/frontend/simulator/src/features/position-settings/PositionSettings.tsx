import React from 'react'
import styled from 'styled-components'
import PositionSettingsEntryExitAccordion from './entry-exit-accordion/PositionSettingsEntryExitAccordion'
import PositionSettingsAccordion from './PositionSettingsTypeAccordion'

const Wrapper = styled.div``

const PositionSettings: React.FC = () => (
  <Wrapper>
    <PositionSettingsAccordion />
    <PositionSettingsEntryExitAccordion />
  </Wrapper>
)

export default PositionSettings
