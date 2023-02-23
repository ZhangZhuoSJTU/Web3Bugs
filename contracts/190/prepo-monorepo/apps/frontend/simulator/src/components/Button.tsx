import React from 'react'
import { Button as AButton, ButtonProps } from 'antd'
import styled from 'styled-components'

const Wrapper = styled(AButton)`
  border-color: ${({ theme }): string => theme.colors.primary};
  border-radius: 12px;
  color: ${({ theme }): string => theme.colors.primary};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: 800;
  height: 3rem;
  line-height: 1.6875rem;

  width: auto;

  &:hover,
  &:focus {
    border-color: ${({ theme }): string => theme.colors.profit};
    color: ${({ theme }): string => theme.colors.profit};
  }

  &.ant-btn-primary {
    background: ${({ theme }): string => theme.colors.primary};
    color: ${({ theme }): string => theme.colors.textSecondary};
    font-size: ${({ theme }): string => theme.fontSize.base};
  }

  &.ant-btn-primary:hover,
  :focus {
    border-color: ${({ theme }): string => theme.colors.primary};
    color: ${({ theme }): string => theme.colors.textSecondary};
    opacity: 0.9;
  }

  &.ant-btn-sm {
    font-size: ${({ theme }): string => theme.fontSize.xsm};
    height: 1.7em;

    span {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 1rem;
    }
  }

  &:disabled {
    opacity: 0.5;

    &:hover {
      background: ${({ theme }): string => theme.colors.primary};
      opacity: 0.5;
    }
  }
`

const Button: React.FC<ButtonProps> = ({ children, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Wrapper {...props}>{children}</Wrapper>
)

export default Button
