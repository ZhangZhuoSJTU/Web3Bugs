import { Alert as AAlert, AlertProps } from 'antd'
import styled, { Color } from 'styled-components'
import Icon from '../Icon'
import useResponsive from '../../hooks/useResponsive'
import { spacingIncrement, media } from '../../common-utils'

type Props = AlertProps & {
  background?: keyof Color
  color?: keyof Color
}

const Wrapper = styled.div<{ background?: keyof Color; color?: keyof Color }>`
  &&& {
    .ant-alert-icon {
      display: flex;
      align-items: center;
      margin-right: 0;
    }
    .ant-alert {
      border-radius: ${({ theme }): string => theme.borderRadius.xs};
      border-width: 0;
      font-family: ${({ theme }): string => theme.fontFamily.primary};
      font-size: ${({ theme }): string => theme.fontSize.xs};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      line-height: ${spacingIncrement(17)};
      padding: ${spacingIncrement(12)};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.base};
        line-height: ${spacingIncrement(23)};
      `}
    }
    .ant-alert-message {
      color: ${({ theme, color }): string => theme.color[color ?? 'neutral1']};
    }
    .ant-alert-success {
      .ant-alert-message {
        color: ${({ theme, color }): string => theme.color[color ?? 'success']};
      }
      background-color: ${({ theme, background }): string =>
        theme.color[background ?? 'alertBoxSuccess']};
    }
    .ant-alert-info {
      .ant-alert-message {
        color: ${({ theme, color }): string => theme.color[color ?? 'info']};
      }
      background-color: ${({ theme, background }): string =>
        theme.color[background ?? 'alertBoxInfo']};
    }
    .ant-alert-error {
      .ant-alert-message {
        color: ${({ theme, color }): string => theme.color[color ?? 'error']};
      }
      background-color: ${({ theme, background }): string =>
        theme.color[background ?? 'alertBoxError']};
    }
    .ant-alert-warning {
      .ant-alert-message {
        color: ${({ theme, color }): string => theme.color[color ?? 'warning']};
      }
      background-color: ${({ theme, background }): string =>
        theme.color[background ?? 'alertBoxWarning']};
    }
    .ant-alert-content {
      margin-left: ${spacingIncrement(18)};
    }
  }
`

const Alert: React.FC<Props> = ({ type, background, color, ...props }) => {
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '31' : '24'

  return (
    <Wrapper background={background} color={color}>
      <AAlert
        type={type}
        icon={<Icon name="info" color={type} width={size} height={size} />}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
      />
    </Wrapper>
  )
}

export default Alert
