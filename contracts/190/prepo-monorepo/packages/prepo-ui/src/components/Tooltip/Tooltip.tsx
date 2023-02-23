import { Tooltip as ATooltip } from 'antd'
import { css } from 'styled-components'
import { centered } from '../../common-utils'

export const tooltipStyles = css`
  .ant-tooltip-inner,
  .ant-tooltip-arrow-content {
    background-color: ${({ theme }): string => theme.color.secondary};
    color: ${({ theme }): string => theme.color.white};
  }

  .ant-tooltip-inner {
    ${centered}
    border-radius: 5px;
    font-weight: bold;
  }

  .ant-tooltip-arrow-content {
    pointer-events: none;
  }

  .ant-input-affix-wrapper-focused {
    border-color: ${({ theme }): string => theme.color.primary};
    box-shadow: 0 0 0 2px ${({ theme }): string => theme.color.success};
  }
`

export default ATooltip
