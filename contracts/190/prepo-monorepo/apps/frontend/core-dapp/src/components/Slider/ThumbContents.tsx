import styled from 'styled-components'

const ThumbContentsWrapper = styled.div<{ direction: string }>`
  align-items: center;
  display: flex;
  flex-direction: ${({ direction }): string => direction};
  justify-content: center;
`

const Description = styled.div`
  font-size: ${({ theme }): string => theme.fontSize['2xs']};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
  line-height: 1rem;
`

const Amount = styled.div`
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.bold};
  line-height: 1rem;
`

type Props = {
  label: string
  value: number
  direction: string
  numberFormatter: (n: number) => string
}

const SliderThumbContents: React.FC<Props> = ({
  label,
  value,
  direction,
  numberFormatter = (n: number): string => n.toString(),
}) => (
  <ThumbContentsWrapper direction={direction}>
    <Description>{label}</Description>
    <Amount>{numberFormatter(value)}</Amount>
  </ThumbContentsWrapper>
)

export default SliderThumbContents
