import styled from 'styled-components'
import { Collapse } from 'antd'

export default styled(Collapse)`
  &&& {
    border-color: ${({ theme }): string => theme.colors.accent};
    border-radius: 1rem;
    font-weight: bold;

    .ant-collapse-header {
      background-color: ${({ theme }): string => theme.colors.foreground};
      border-color: ${({ theme }): string => theme.colors.accent};
      border-radius: 1rem;
    }

    .ant-collapse-content {
      border-bottom-left-radius: 1rem;
      border-bottom-right-radius: 1rem;
      border-color: ${({ theme }): string => theme.colors.accent};
    }
  }
`

export const Panel = styled(Collapse.Panel)`
  &&& {
    border-color: ${({ theme }): string => theme.colors.accent};
    border-radius: 1rem;
  }
`
