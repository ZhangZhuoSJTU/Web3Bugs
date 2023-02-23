import { Radio as ARadio, RadioProps } from 'antd'
import styled, { Color, useTheme } from 'styled-components'
import { media, spacingIncrement } from 'prepo-ui'

type Props = RadioProps & {
  backgroundColor?: keyof Color
  color?: keyof Color
  icon?: React.ReactNode
}

const Wrapper = styled(ARadio)<{ backgroundColor?: keyof Color; color: string }>`
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}

  span {
    background-color: ${({ backgroundColor, theme }): string =>
      theme.color[backgroundColor || 'neutral9']} !important;
  }

  .ant-radio {
    top: 0;
  }

  &.ant-radio-wrapper {
    align-items: center;
    background-color: ${({ backgroundColor, theme }): string =>
      theme.color[backgroundColor || 'neutral9']} !important;
    color: ${({ color }): string => color};
    display: flex;
    span:nth-child(2) {
      display: flex;
      justify-content: space-between;
      flex: 1;
    }
  }

  &.ant-radio-wrapper-disabled:hover {
    cursor: not-allowed;
  }
`

const LabelIconWrapper = styled.div`
  align-items: center;
  display: flex;
  margin-left: ${spacingIncrement(12)};
  ${media.desktop`
    margin-left: ${spacingIncrement(24)};
  `}
`

const LabelIconImage = styled.div`
  display: flex;
  margin-left: ${spacingIncrement(16)};
  width: 1rem;
  ${media.desktop`
    margin-left: ${spacingIncrement(24)};
  `}
`

const Radio: React.FC<Props> = ({
  backgroundColor,
  children,
  icon,
  color = 'secondary',
  ...props
}) => {
  let childrenNode = children
  const theme = useTheme()
  if (icon) {
    childrenNode = (
      <LabelIconWrapper>
        {children} <LabelIconImage>{icon}</LabelIconImage>
      </LabelIconWrapper>
    )
  }
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Wrapper backgroundColor={backgroundColor} color={theme.color[color]} {...props}>
      {childrenNode}
    </Wrapper>
  )
}

export default Radio
