import styled from 'styled-components'
import { Checkbox, Flex, Icon, media, spacingIncrement, TokenInput } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import { BigNumber } from 'ethers'
import { Trans } from '@lingui/macro'
import StakeUnstakeLayout from './StakeUnstakeLayout'
import StakeDelegate from './StakeDelegate'
import {
  CooldownEnds,
  CooldownPeriod,
  UnstakeRequest,
  UnstakingFee,
  UnstakingPeriod,
  UnstakingPartially,
  FeeForAllUnstaking,
} from './StakeWarningMessages'
import { MessageType } from './StakeWarning'
import TimeMultiplierChart from '../timeMultiplier/TimeMultiplierChart'
import Input, { LabelWrapper } from '../../../components/Input'
import { useRootStore } from '../../../context/RootStoreProvider'
import UnstakingFeeChart from '../timeMultiplier/UnstakingFeeChart'
import useResponsive from '../../../hooks/useResponsive'

export const PrefixWrapper = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.color.neutral1};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(24)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
    line-height: ${spacingIncrement(30)};
  `}
  div {
    display: flex;
  }
`

export const StyledInput = styled(Input)`
  input {
    text-align: right;
  }
  &&& .ant-input-disabled {
    color: ${({ theme }): string => theme.color.neutral5};
  }
`

export const StyledLabel = styled(LabelWrapper)`
  display: flex;
`

const StyledCheckbox = styled(Checkbox)`
  background: ${({ theme }): string => theme.color.primaryAccent};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  padding: ${spacingIncrement(10)} ${spacingIncrement(11)};
  ${media.desktop`
    padding: ${spacingIncrement(18)} ${spacingIncrement(12)};
  `}
  &:hover {
    &&& * {
      border-color: ${({ theme }): string => theme.color.darkPrimary};
    }
  }
`

const StakePage: React.FC = () => {
  const {
    ppoTokenStore: { tokenBalanceFormat },
    unstakeStore: { confirm, setConfirm, currentUnstakingValue, setCurrentUnstakingValue },
    ppoStakingStore: {
      balanceData,
      isWithdrawWindowActive,
      fee,
      isCooldownActive,
      withdrawWindowStarted,
    },
    stakeStore,
    web3Store: { connected },
  } = useRootStore()
  const { currentStakingValue, setCurrentStakingValue } = stakeStore
  const { isDesktop } = useResponsive()
  const size = isDesktop ? '24' : '16'

  // TODO: parseEther(balanceData.raw) when SC
  const cooldownUnits = balanceData?.cooldownUnits
    ? BigNumber.from(balanceData.cooldownUnits).toNumber()
    : undefined
  const stakedPPO = balanceData?.raw ? BigNumber.from(balanceData.raw).toNumber() : undefined
  const unitsToUse = `${isWithdrawWindowActive ? cooldownUnits : stakedPPO}`

  const unstakedMessages: MessageType[] = []
  if (isCooldownActive) {
    unstakedMessages.push({
      type: 'warning',
      key: 'UnstakeRequest',
      message: <UnstakeRequest fee={fee} unstakePpo={currentUnstakingValue} />,
    })

    unstakedMessages.push({
      type: 'warning',
      key: 'CooldownEnds',
      message: <CooldownEnds ends={withdrawWindowStarted} />,
    })
  } else if (isWithdrawWindowActive) {
    unstakedMessages.push({ type: 'warning', key: 'UnstakingPeriod', message: <UnstakingPeriod /> })
    unstakedMessages.push({
      type: 'warning',
      key: 'UnstakingPartially',
      message: <UnstakingPartially unstakePpo={(+currentUnstakingValue * fee) / 100} />,
    })
    unstakedMessages.push({ type: 'warning', key: 'UnstakingPeriod', message: <UnstakingPeriod /> })
    unstakedMessages.push({
      type: 'warning',
      key: 'FeeForAllUnstaking',
      message: <FeeForAllUnstaking />,
    })
  } else {
    unstakedMessages.push({ type: 'warning', key: 'CooldownPeriod', message: <CooldownPeriod /> })
    if (connected) {
      unstakedMessages.push({
        type: 'warning',
        key: 'UnstakingFee',
        message: <UnstakingFee fee={fee} />,
      })
    }
  }

  const pageMap = {
    stake: {
      chart: <TimeMultiplierChart />,
      messages: [
        { type: 'warning', key: 'cooldown', message: <CooldownPeriod /> },
      ] as MessageType[],
      body: (
        <>
          <TokenInput
            alignInput="right"
            balance={tokenBalanceFormat}
            connected={connected}
            iconName="ppo-logo"
            max={tokenBalanceFormat}
            onChange={setCurrentStakingValue}
            showSlider
            symbol="PPO"
            value={currentStakingValue}
          />
          <StakeDelegate />
        </>
      ),
    },
    unstake: {
      chart: <UnstakingFeeChart />,
      messages: unstakedMessages,
      body: (
        <>
          <TokenInput
            alignInput="right"
            disableClickBalance
            balance={unitsToUse}
            connected={connected}
            iconName="ppo-logo"
            max={unitsToUse}
            label="Amount"
            onChange={setCurrentUnstakingValue}
            symbol="PPO"
            value={currentUnstakingValue}
          />
          <StyledCheckbox checked={confirm} onChange={setConfirm}>
            <Flex gap={6}>
              <Trans>Unstake PPO Immediately</Trans>
              {/* TODO: add tooltip text */}
              {false && <Icon name="info" color="neutral5" width={size} height={size} />}
            </Flex>
          </StyledCheckbox>
        </>
      ),
    },
  }
  const [tab, changeTab] = useState<'stake' | 'unstake'>('stake')
  const content = pageMap[tab]

  return (
    <StakeUnstakeLayout
      onTabChange={changeTab}
      chart={content.chart}
      messages={content.messages}
      tab={tab}
    >
      {content.body}
    </StakeUnstakeLayout>
  )
}

export default observer(StakePage)
