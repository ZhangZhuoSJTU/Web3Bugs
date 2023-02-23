import { observer } from 'mobx-react'
import { Button, Flex } from 'prepo-ui'
import { t, Trans } from '@lingui/macro'
import { customStyles } from './StakeUnstakeNavigationButtons'
import { useRootStore } from '../../../context/RootStoreProvider'
import useFeatureFlag, { FeatureFlag } from '../../../hooks/useFeatureFlag'

const UnstakeButtons: React.FC = () => {
  const {
    unstakeStore: { isCurrentUnstakingValueValid, confirm, startCooldown, withdraw },
    ppoStakingStore: {
      startingCooldown,
      endingCooldown,
      isCooldownActive,
      withdrawing,
      fee,
      endCooldown,
      isWithdrawWindowActive,
    },
  } = useRootStore()
  const { enabled } = useFeatureFlag(FeatureFlag.enableStakingLocally)

  if (!enabled) {
    return (
      <Button type="primary" block disabled>
        <Trans>Coming Soon</Trans>
      </Button>
    )
  }
  const loading = startingCooldown || endingCooldown || withdrawing
  const confirmUnstaking = (): Promise<{
    success: boolean
    error?: string | undefined
  }> => withdraw(false)
  const unstakeImmediately = (): Promise<{
    success: boolean
    error?: string | undefined
  }> => withdraw(true)

  if (isCooldownActive) {
    return (
      <Flex flexDirection="column" gap={8} alignItems="stretch">
        <Button
          type="primary"
          disabled={loading}
          block
          onClick={unstakeImmediately}
          customColors={{
            background: 'error',
            border: 'error',
            hoverBackground: 'error',
            hoverBorder: 'error',
          }}
        >
          {`Unstake Immediately for ${fee}% Total Fee`}
        </Button>
        <Button
          type="default"
          customColors={customStyles}
          block
          onClick={endCooldown}
          disabled={loading}
        >
          <Trans>Cancel Unstaking</Trans>
        </Button>
      </Flex>
    )
  }

  if (isWithdrawWindowActive) {
    return (
      <Flex flexDirection="column" gap={8} alignItems="stretch">
        <Button type="primary" block onClick={endCooldown} disabled={loading} loading={loading}>
          <Trans>Cancel Unstaking</Trans>
        </Button>
        <Button
          type="default"
          block
          customColors={customStyles}
          onClick={confirmUnstaking}
          disabled={loading}
        >
          <Trans>Confirm Unstaking</Trans>
        </Button>
      </Flex>
    )
  }

  const text = confirm ? t`Unstake PPO` : t`Begin Cooldown`
  const onClick = confirm ? unstakeImmediately : startCooldown
  return (
    <Button
      type={confirm ? 'primary' : 'default'}
      customColors={confirm ? undefined : customStyles}
      block
      disabled={loading || !isCurrentUnstakingValueValid}
      loading={loading}
      onClick={onClick}
    >
      {text}
    </Button>
  )
}
export default observer(UnstakeButtons)
