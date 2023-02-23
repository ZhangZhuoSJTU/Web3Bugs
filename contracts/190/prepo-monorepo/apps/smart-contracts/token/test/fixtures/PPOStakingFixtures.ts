import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { MockContract, smock } from '@defi-wonderland/smock'
import {
  MockPPOStaking,
  MockPPOGamifiedToken,
  WithdrawalRights,
  StakingRewardsDistribution,
} from '../../types/generated'

export async function mockPPOStakingDeployFixture(
  platformTokenVendorFactoryAddress: string,
  nexus: string,
  rewardsToken: string,
  achievementsManager: string,
  stakedToken: string,
  cooldownSeconds: BigNumber,
  unstakeWindow: BigNumber
): Promise<MockPPOStaking> {
  const Factory = await ethers.getContractFactory('MockPPOStaking', {
    libraries: {
      PlatformTokenVendorFactory: platformTokenVendorFactoryAddress,
    },
  })
  return (await Factory.deploy(
    nexus,
    rewardsToken,
    achievementsManager,
    stakedToken,
    cooldownSeconds,
    unstakeWindow
  )) as unknown as MockPPOStaking
}

export async function mockPPOGamifiedTokenDeployFixture(
  platformTokenVendorFactoryAddress: string,
  nexus: string,
  rewardsToken: string,
  questManager: string
): Promise<MockPPOGamifiedToken> {
  const Factory = await ethers.getContractFactory('MockPPOGamifiedToken', {
    libraries: {
      PlatformTokenVendorFactory: platformTokenVendorFactoryAddress,
    },
  })
  return (await Factory.deploy(
    nexus,
    rewardsToken,
    questManager
  )) as unknown as MockPPOGamifiedToken
}

export async function withdrawalRightsFixture(): Promise<WithdrawalRights> {
  const Factory = await ethers.getContractFactory('WithdrawalRights')
  return (await Factory.deploy()) as unknown as WithdrawalRights
}

export async function stakingRewardsDistributionFixture(): Promise<StakingRewardsDistribution> {
  const Factory = await ethers.getContractFactory('StakingRewardsDistribution')
  return (await Factory.deploy()) as unknown as StakingRewardsDistribution
}

export async function smockMockAchievementsManagerFixture(): Promise<MockContract> {
  const smockMockAchievementsManagerFactory = await smock.mock('MockAchievementsManager')
  // eslint-disable-next-line @typescript-eslint/return-await
  return await smockMockAchievementsManagerFactory.deploy()
}

export async function smockSteppedTimeMultiplierV1Fixture(): Promise<MockContract> {
  const smockSteppedTimeMultiplierV1Factory = await smock.mock('SteppedTimeMultiplierV1')
  // eslint-disable-next-line @typescript-eslint/return-await
  return await smockSteppedTimeMultiplierV1Factory.deploy()
}
