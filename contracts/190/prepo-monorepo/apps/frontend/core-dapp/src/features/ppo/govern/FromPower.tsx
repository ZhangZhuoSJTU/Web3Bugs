import { Trans } from '@lingui/macro'
import { media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { numberFormatter } from '../../../utils/numberFormatter'

const { significantDigits } = numberFormatter

type Props = { connected: boolean; power: number }

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin: ${spacingIncrement(24)} 0;
  ${media.desktop`
    margin: ${spacingIncrement(32)} 0;
  `}
`

export const Value = styled.div`
  color: ${({ theme }): string => theme.color.primary};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.bold};
  line-height: ${spacingIncrement(20)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize['2xl']};
    line-height: ${spacingIncrement(32)};
  `}
`

export const Label = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: ${spacingIncrement(15)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
    line-height: ${spacingIncrement(23)};
  `};
`

const FromPower: React.FC<Props> = ({ connected, power = 0 }) => (
  <Wrapper>
    <Label>
      <Trans>From PPO Power</Trans>
    </Label>
    <Value>{connected ? significantDigits(power) : '-'}</Value>
  </Wrapper>
)

export default FromPower
