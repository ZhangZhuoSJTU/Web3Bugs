import { Trans } from '@lingui/macro'
import { differenceInMinutes } from 'date-fns'
import { Icon } from 'prepo-ui'
import { displayDecimals } from 'prepo-utils'
import styled from 'styled-components'
import useResponsive from '../../../hooks/useResponsive'

const StyledLink = styled.a`
  align-items: center;
  color: ${({ theme }): string => theme.color.primary};
  cursor: pointer;
  display: inline-flex;
  &:hover {
    color: ${({ theme }): string => theme.color.primary};
  }
`

const WarningText = styled.span`
  color: ${({ theme }): string => theme.color.warning};
`

const InfoText = styled.span`
  color: ${({ theme }): string => theme.color.primary};
`

const DangerText = styled.span`
  color: ${({ theme }): string => theme.color.error};
`

export const LearnMore: React.FC<{ href: string }> = ({ href }) => {
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '16' : '12'

  // TODO: fix all missing hrefs
  if (!href) {
    return null
  }

  return (
    <StyledLink href={href} target="_blank">
      <span>
        <Trans>Learn More</Trans>
      </span>
      &nbsp;
      <Icon name="share" width={size} height={size} />
    </StyledLink>
  )
}

export const CooldownPeriod: React.FC = () => (
  <span>
    <Trans>
      There is a cooldown on period to unstake and a penalty if you have not staked long enough.
    </Trans>
    &nbsp;
    <LearnMore href="" />
  </span>
)

export const UnstakingFee: React.FC<{ fee: number }> = ({ fee }) => (
  <span>
    <Trans>
      Your <WarningText>unstaking fee is {fee}%.</WarningText> Stake for longer to reduce this fee.
    </Trans>
  </span>
)

export const UnstakeImmediately: React.FC = () => (
  <span>
    <Trans>
      Your <WarningText>unstaking fee is 15.0%.</WarningText> Unstake non-immediately, or stake for
      longer, to reduce this fee.
    </Trans>
  </span>
)

export const DuringUnstaking: React.FC = () => (
  <span>
    <Trans>
      During the unstaking process, the amount being unstacked will lose all associated PPO
      Power.&nbsp;
    </Trans>
    <LearnMore href="" />
  </span>
)

export const UnstakeRequest: React.FC<{ unstakePpo: string; fee: number }> = ({
  unstakePpo,
  fee,
}) => (
  <span>
    You requested to unstake <WarningText>{displayDecimals(unstakePpo)} PPO</WarningText>, subject
    to an&nbsp;
    <WarningText>unstaking fee of {fee}%.</WarningText>
  </span>
)

export const UnstakeRequestDuringCooldown: React.FC<{ unstakePpo: number; fee: number }> = ({
  unstakePpo,
  fee,
}) => (
  <span>
    <Trans>
      You requested to unstake&nbsp;
      <WarningText>{unstakePpo} PPO</WarningText>, subject to an&nbsp;
      <WarningText>unstaking fee of {fee}%.</WarningText>&nbsp;Cancel and stake for longer to reduce
      this fee.
    </Trans>
  </span>
)

export const DateChanges: React.FC<{ from: string; to: string }> = ({ from, to }) => (
  <span>
    <Trans>
      Your weighted average staking date will increase from {from} to <InfoText>{to}.</InfoText>
    </Trans>
  </span>
)

export const UnstakingPeriod: React.FC = () => (
  <span>
    <Trans>
      Unstaking is subject to a cooldown period of 21 days, followed by a 7 day period for your
      final confirmation.
    </Trans>
    &nbsp;
    <LearnMore href="" />
  </span>
)

export const FeeForAllUnstaking: React.FC = () => (
  <span>
    <Trans>
      All unstaking will be subject to a fee. The longer you stake, the lower the unstaking fee.
    </Trans>
  </span>
)

export const UnstakingAll: React.FC = () => (
  <span>
    <Trans>You will immediately lose</Trans>&nbsp;
    <DangerText>
      <Trans>all PPO Power</Trans>
    </DangerText>
    .&nbsp;
    <LearnMore href="" />
  </span>
)

export const UnstakingPartially: React.FC<{ unstakePpo: number }> = ({ unstakePpo }) => (
  <span>
    <Trans>
      You will immediately lose <DangerText>{unstakePpo} PPO Power</DangerText> for the amount being
      unstacked.
    </Trans>
    &nbsp;
    <LearnMore href="" />
  </span>
)

const DAY = 24 * 60
const HOUR = 60

export const CooldownEnds: React.FC<{ ends: Date | undefined }> = ({ ends }) => {
  if (!ends) {
    return null
  }
  const totalMinutes = differenceInMinutes(ends, new Date())
  const days = Math.floor(totalMinutes / DAY)
  const hours = Math.floor((totalMinutes - days * DAY) / HOUR)
  const minutes = totalMinutes - days * DAY - hours * HOUR
  return (
    <span>
      <Trans>
        Cooldown period ends in: <InfoText>{`${days}d ${hours}h ${minutes}m.`}</InfoText>
      </Trans>
    </span>
  )
}
