import { BigNumber } from 'ethers'

export interface UserBalance {
  raw: BigNumber
  weightedTimestamp: BigNumber
  timeMultiplier: BigNumber
  achievementsMultiplier: BigNumber
  cooldownTimestamp: BigNumber
  cooldownUnits: BigNumber
}

export interface UserStakingData {
  scaledBalance: BigNumber
  votes: BigNumber
  earnedRewards: BigNumber
  numCheckpoints: number
  rewardTokenBalance: BigNumber
  rawBalance: UserBalance
}
