import { Switch as ASwitch, SwitchProps } from 'antd'
import styled, { Color } from 'styled-components'
import { spacingIncrement } from '../../common-utils'

type Props = {
  color?: keyof Color
}

const Wrapper = styled.div<Required<Props>>`
  &&& {
    .ant-switch {
      height: ${spacingIncrement(14)};
      min-width: ${spacingIncrement(30)};
      background-color: ${({ theme }): string => theme.color.neutral5};
    }
    .ant-switch-handle {
      height: ${spacingIncrement(20)};
      width: ${spacingIncrement(20)};
      top: -${spacingIncrement(3)};
      left: -${spacingIncrement(3)};
      transition: all 0.2s ease-in-out;
      z-index: 1;
      :after,
      :before {
        border-radius: 100%;
        background-color: ${({ theme }): string => theme.color.switchHandler};
      }
    }
    .ant-switch-checked {
      background-color: ${({ theme, color }): string => theme.color[color]};
      .ant-switch-handle {
        left: unset;
        right: -${spacingIncrement(3)};
      }
    }
  }
`

const Switch: React.FC<Props & SwitchProps> = ({ color = 'primary', ...props }) => (
  <Wrapper color={color}>
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    <ASwitch {...props} />
  </Wrapper>
)

export default Switch
