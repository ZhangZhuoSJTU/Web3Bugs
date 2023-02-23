import React from 'react'
import styled from 'styled-components'
import { Tooltip } from 'antd'
import InfoIcon from '../../assets/images/info-icon.svg'

const ToolTipWrapper = styled(Tooltip)`
  margin-left: 0.5rem;
`

type Props = {
  text: string
}

const InfoTooltipIcon: React.FC<Props> = ({ text }) => (
  <ToolTipWrapper overlay={text}>
    <img src={InfoIcon} alt="info icon" />
  </ToolTipWrapper>
)

export default InfoTooltipIcon
