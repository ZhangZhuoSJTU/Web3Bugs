import { Icon, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { Trans } from '@lingui/macro'
import { Label, Value } from './FromPower'
import useResponsive from '../../../hooks/useResponsive'
import { numberFormatter } from '../../../utils/numberFormatter'

const { significantDigits } = numberFormatter

type Props = { connected: boolean; power: number; delegatorsCount: number }

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding-bottom: ${spacingIncrement(18)};
  ${media.desktop`
    padding-bottom: ${spacingIncrement(24)};
  `}
`

const SubLabel = styled(Label)`
  color: ${({ theme }): string => theme.color.neutral3};
`

const FromDelegators: React.FC<Props> = ({ connected, power = 0, delegatorsCount }) => {
  const { isDesktop } = useResponsive()

  const size = isDesktop ? '26' : '13'
  return (
    <Wrapper>
      <div>
        <Label>
          <Trans>From Delegators</Trans>
          {/* TODO: add tooltip text */}
          {false && <Icon name="info" color="neutral5" width={size} height={size} />}
        </Label>
        {connected && (
          <SubLabel>
            {delegatorsCount} <Trans>Delegators</Trans>
          </SubLabel>
        )}
      </div>
      <Value>{connected ? significantDigits(power) : '-'}</Value>
    </Wrapper>
  )
}

export default FromDelegators
