import styled, { Color, useTheme } from 'styled-components'
import { media, coreDappTheme } from 'prepo-ui'

type HeadingSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5'

export type TextAlign = 'left' | 'center' | 'right'

type Props = {
  type?: HeadingSize
  className?: string
  align?: TextAlign
  color?: keyof Color
}

type HeadingProps = {
  textAlign: TextAlign
  color: string
}

const Heading1 = styled.h1<HeadingProps>`
  ${coreDappTheme.primaryFontFamily}
  color: ${({ color }): string => color};
  font-size: ${({ theme }): string => theme.fontSize.xl};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  text-align: ${({ textAlign }): string => textAlign};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize['4xl']};
    font-weight: ${({ theme }): number => theme.fontWeight.bold};
  `}
`

const Heading2 = styled.h2<HeadingProps>`
  ${coreDappTheme.primaryFontFamily}
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
  ${coreDappTheme.primaryFontFamily}
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
  ${coreDappTheme.primaryFontFamily}
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
  ${coreDappTheme.primaryFontFamily}
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

const Heading: React.FC<Props> = ({
  type = 'h1',
  className,
  align = 'left',
  color = 'primary',
  children,
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
    <HeadingComponent color={theme.color[color]} textAlign={align} className={className}>
      {children}
    </HeadingComponent>
  )
}

export default Heading
