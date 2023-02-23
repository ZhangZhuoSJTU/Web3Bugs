import React from 'react'
import { Radio as ARadio, RadioProps } from 'antd'
import styled from 'styled-components'

type Props = RadioProps & {
  color?: string
}

const Wrapper = styled(ARadio)<Props>`
  &.ant-radio-wrapper {
    color: ${({ theme, color }): string => color || theme.colors.textPrimary};
  }

  &.ant-radio-wrapper-disabled:hover {
    cursor: not-allowed;
  }
`

const Radio: React.FC<Props> = ({ children, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Wrapper {...props}>{children}</Wrapper>
)

export default Radio
