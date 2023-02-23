import { Tooltip } from 'prepo-ui'
import { TooltipPlacement } from 'antd/lib/tooltip'
import styled from 'styled-components'

const ButtonWrapper = styled.div`
  cursor: not-allowed;
  button {
    pointer-events: none;
  }
`

const ComingSoonTooltip: React.FC<{ placement?: TooltipPlacement }> = ({ children, placement }) => (
  <Tooltip title="Coming soon" placement={placement}>
    <ButtonWrapper>{children}</ButtonWrapper>
  </Tooltip>
)

export default ComingSoonTooltip
