import { spacingIncrement, media } from 'prepo-ui'
import styled from 'styled-components'

type Props = {
  className?: string
}

const Description = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
  line-height: ${spacingIncrement(18)};
  margin: ${spacingIncrement(30)} auto ${spacingIncrement(58)};
  max-width: ${spacingIncrement(980)};
  text-align: left;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
    font-weight: ${({ theme }): number => theme.fontWeight.medium};
    line-height: ${spacingIncrement(28)};
    text-align: center;
  `}
`

const PageDescription: React.FC<Props> = ({ className, children }) => (
  <Description className={className}>{children}</Description>
)

export default PageDescription
