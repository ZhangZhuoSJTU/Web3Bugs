import { DetailedHTMLProps, HTMLAttributes } from 'react'
import styled, { Color, css, useTheme } from 'styled-components'
import { media } from '../../common-utils/media'

export type HeadingSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5'

export type TextAlign = 'left' | 'center' | 'right'

export type HeaderProps = {
  type?: HeadingSize
  align?: TextAlign
  color?: keyof Color
} & DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>

const commonHeadingCss = css`
  line-height: 1;
  margin: 0;
`

type HeadingProps = {
  textAlign: TextAlign
  color: string
}

const Heading1 = styled.h1<HeadingProps>`
  ${commonHeadingCss}
  color: ${({ color }): string => color};
  font-size: ${({ theme }): string => theme.fontSize.xl};
  text-align: ${({ textAlign }): string => textAlign};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize['2xl']};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['4xl']};
  `}
`

const Heading2 = styled.h2<HeadingProps>`
  ${commonHeadingCss}
  color: ${({ color }): string => color};
  font-size: ${({ theme }): string => theme.fontSize.lg};
  text-align: ${({ textAlign }): string => textAlign};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['3xl']};
  `}
`

const Heading3 = styled.h3<HeadingProps>`
  ${commonHeadingCss}
  color: ${({ color }): string => color};
  font-size: ${({ theme }): string => theme.fontSize.md};
  text-align: ${({ textAlign }): string => textAlign};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['2xl']};
  `}
`

const Heading4 = styled.h4<HeadingProps>`
  ${commonHeadingCss}
  color: ${({ color }): string => color};
  font-size: ${({ theme }): string => theme.fontSize.md};
  text-align: ${({ textAlign }): string => textAlign};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const Heading5 = styled.h5<HeadingProps>`
  ${commonHeadingCss}
  color: ${({ color }): string => color};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  text-align: ${({ textAlign }): string => textAlign};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const Heading: React.FC<HeaderProps> = ({
  type = 'h1',
  align = 'left',
  color = 'primary',
  children,
  className,
}) => {
  const theme = useTheme()
  const headingSize = {
    h1: Heading1,
    h2: Heading2,
    h3: Heading3,
    h4: Heading4,
    h5: Heading5,
  }

  const HeadingComponent = headingSize[type]

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <HeadingComponent color={theme.color[color]} textAlign={align} className={className}>
      {children}
    </HeadingComponent>
  )
}

export default Heading
