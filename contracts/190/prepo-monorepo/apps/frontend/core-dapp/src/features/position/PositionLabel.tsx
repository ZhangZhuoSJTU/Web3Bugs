import styled from 'styled-components'
import { PositionType } from '../../utils/prepo.types'

type Props = {
  positionType: PositionType
  className?: string
}

const Wrapper = styled.div<Props>`
  color: ${({ theme, positionType }): string => theme.positionType[positionType]};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  text-transform: capitalize;
`

const PositionLabel: React.FC<Props> = ({ className, positionType }) => (
  <Wrapper positionType={positionType} className={className}>
    {positionType}
  </Wrapper>
)

export default PositionLabel
