import { DetailedHTMLProps, HTMLAttributes } from 'react'
import styled, { css } from 'styled-components'
import { media } from '../utils/theme/media'

type HeadingSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5'

type Props = {
  type?: HeadingSize
} & DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>

const commonHeadingCss = css`
  color: ${({ theme }): string => theme.color.primaryFont};
  line-height: 1;
  margin: 0;
`

const Heading1 = styled.h1`
  ${commonHeadingCss}
  font-size: ${({ theme }): string => theme.fontSize.xl};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize['2xl']};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['4xl']};
  `}
`

const Heading2 = styled.h2`
  ${commonHeadingCss}
  font-size: ${({ theme }): string => theme.fontSize.lg};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['3xl']};
  `}
`

const Heading3 = styled.h3`
  ${commonHeadingCss}
  font-size: ${({ theme }): string => theme.fontSize.md};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['2xl']};
  `}
`

const Heading4 = styled.h4`
  ${commonHeadingCss}
  font-size: ${({ theme }): string => theme.fontSize.md};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const Heading5 = styled.h5`
  ${commonHeadingCss}
  font-size: ${({ theme }): string => theme.fontSize.sm};
  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const Heading: React.FC<Props> = ({ type = 'h1', ...otherProps }) => {
  const headingSize = {
    h1: Heading1,
    h2: Heading2,
    h3: Heading3,
    h4: Heading4,
    h5: Heading5,
  }

  const HeadingComponent = headingSize[type] as React.FC<Omit<Props, 'type'>>

  // eslint-disable-next-line react/jsx-props-no-spreading
  return <HeadingComponent {...otherProps} />
}

export default Heading
