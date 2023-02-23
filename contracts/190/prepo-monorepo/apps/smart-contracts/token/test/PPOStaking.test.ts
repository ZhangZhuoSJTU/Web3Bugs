import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { MockContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import {
  smockMockAchievementsManagerFixture,
  smockSteppedTimeMultiplierV1Fixture,
  mockPPOStakingDeployFixture,
} from './fixtures/PPOStakingFixtures'
import { calcTimeToStakeAt, calcWeightedTimestamp, MAX_UINT128, ONE, ONE_WEEK } from '../utils'
import { UserStakingData } from '../types/ppoStaking'
import {
  MockERC20,
  MockERC20__factory,
  MockNexus,
  MockNexus__factory,
  PlatformTokenVendorFactory__factory,
  MockPPOStaking,
} from '../types/generated'

chai.use(smock.matchers)

describe('PPOStaking', () => {
  interface Deployment {
    ppoToken: MockERC20
    ppoStaking: MockPPOStaking
  }

  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress
  let rewardsDistributor: SignerWithAddress
  let nexus: MockNexus
  let ppoToken: MockERC20
  let ppoStaking: MockPPOStaking
  let smockAchievementsManager: MockContract<Contract>
  let mockSteppedTimeMultiplier: MockContract<Contract>

  const COOLDOWN_SECONDS = ONE_WEEK
  const UNSTAKE_WINDOW = ONE_WEEK.mul(2)
  const MAX_MULTIPLIER = 5e12 // 5X
  const PPO_SUPPLY = parseEther('1000000000') // 1 billion (total PPO supply)
  const MULTIPLIER_DENOMINATOR = 1e12

  const initAccounts = async (): Promise<void> => {
    ;[deployer, owner, user1, user2, user3, rewardsDistributor] = await ethers.getSigners()
  }

  const redeployPPOStaking = async (tokenSupply: BigNumber): Promise<Deployment> => {
    nexus = await new MockNexus__factory(user1).deploy(owner.address, JUNK_ADDRESS, JUNK_ADDRESS)
    ppoToken = await new MockERC20__factory(user1).deploy(
      'prePO Token',
      'PPO',
      0,
      user1.address,
      tokenSupply
    )
    smockAchievementsManager = await smockMockAchievementsManagerFixture()
    // Achievement multiplier is set to 0 to simulate an initial staker w/ no achievements
    smockAchievementsManager.checkForSeasonFinish.returns(0)
    const platformTokenVendorFactory = await new PlatformTokenVendorFactory__factory(user1).deploy()
    ppoStaking = await mockPPOStakingDeployFixture(
      platformTokenVendorFactory.address,
      nexus.address,
      ppoToken.address,
      smockAchievementsManager.address,
      ppoToken.address,
      COOLDOWN_SECONDS,
      UNSTAKE_WINDOW
    )
    await ppoStaking.__mockPPOStaking_init(rewardsDistributor.address)
    mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
    await ppoStaking.connect(owner).setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
    await ppoStaking.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
    return {
      ppoToken,
      ppoStaking,
    }
  }

  const snapshotUserStakingData = async (account: string): Promise<UserStakingData> => {
    const scaledBalance = await ppoStaking.balanceOf(account)
    const votes = await ppoStaking.getVotes(account)
    const earnedRewards = await ppoStaking.earned(account)
    const numCheckpoints = await ppoStaking.numCheckpoints(account)
    const rewardTokenBalance = await ppoStaking.balanceOf(account)
    const rawBalance = await ppoStaking.balanceData(account)

    return {
      scaledBalance,
      votes,
      earnedRewards,
      numCheckpoints,
      rewardTokenBalance,
      rawBalance,
    }
  }

  context('initial state', () => {
    before(async () => {
      await initAccounts()
      ;({ ppoToken, ppoStaking } = await redeployPPOStaking(PPO_SUPPLY))
    })

    it('sets name from constructor', async () => {
      expect(await ppoStaking.name()).to.eq('PPO Power')
    })

    it('sets symbol from constructor', async () => {
      expect(await ppoStaking.symbol()).to.eq('pPPO')
    })

    it('sets rewards distributor from constructor', async () => {
      expect(await ppoStaking.rewardsDistributor()).to.eq(rewardsDistributor.address)
    })

    it('sets decimals to 18', async () => {
      expect(await ppoStaking.decimals()).to.eq(18)
    })

    it('sets nexus from constructor', async () => {
      expect(await ppoStaking.nexus()).to.eq(nexus.address)
    })

    it('sets achievements manager from constructor', async () => {
      expect(await ppoStaking.achievementsManager()).to.eq(smockAchievementsManager.address)
    })

    it('sets staked token from constructor', async () => {
      expect(await ppoStaking.STAKED_TOKEN()).to.eq(ppoToken.address)
    })

    it('sets rewards token from constructor', async () => {
      expect(await ppoStaking.REWARDS_TOKEN()).to.eq(ppoToken.address)
    })

    it('sets cooldown seconds from constructor', async () => {
      expect(await ppoStaking.COOLDOWN_SECONDS()).to.eq(COOLDOWN_SECONDS)
    })

    it('sets unstake window from constructor', async () => {
      expect(await ppoStaking.UNSTAKE_WINDOW()).to.eq(UNSTAKE_WINDOW)
    })
  })

  // TODO Add tests for a subsequent stake
  // TODO Add tests for modification of scaling and timeweighted balance updates
  describe('# stake', () => {
    let staker: SignerWithAddress
    let recipient: SignerWithAddress
    let testAmountToStake: BigNumber
    // Test against maximum uint128 value since our raw balance is kept in a uint128
    const testAmountsToStake = [parseEther('1000'), ONE, parseEther('1000000000'), MAX_UINT128]

    context('first stake', () => {
      beforeEach(async () => {
        await initAccounts()
        ;({ ppoToken, ppoStaking } = await redeployPPOStaking(PPO_SUPPLY))
        staker = user1
        recipient = user2
      })

      it('returns without staking if amount = 0', async () => {
        expect(staker.address).to.not.eq(recipient.address)
        const stakerPPOBalanceBefore = await ppoToken.balanceOf(staker.address)

        const tx = await ppoStaking.connect(staker).stake(recipient.address, 0)

        await expect(tx).to.not.emit(ppoToken, 'Transfer')
        expect(await ppoToken.balanceOf(staker.address)).to.eq(stakerPPOBalanceBefore)
        await expect(tx).to.not.emit(ppoStaking, 'Stake')
        expect(await ppoStaking.balanceOf(recipient.address)).to.eq(0)
      })

      context('staking with various amounts', () => {
        // eslint-disable-next-line no-restricted-syntax
        for (const amount of testAmountsToStake) {
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          context(`staking with ${formatEther(amount)} PPO`, () => {
            beforeEach(async () => {
              if (amount === MAX_UINT128) {
                ;({ ppoToken, ppoStaking } = await redeployPPOStaking(MAX_UINT128))
              }
              testAmountToStake = amount
              await ppoToken.connect(staker).approve(ppoStaking.address, testAmountToStake)
            })

            it('reverts if insufficient PPO allowance', async () => {
              await ppoToken.connect(staker).approve(ppoStaking.address, testAmountToStake.sub(1))
              expect(await ppoToken.allowance(staker.address, ppoStaking.address)).to.be.lt(
                testAmountToStake
              )

              await expect(
                ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)
              ).to.be.revertedWith('ERC20: insufficient allowance')
            })

            it('transfers PPO from msg.sender to staking contract', async () => {
              const stakerBalanceBefore = await ppoToken.balanceOf(staker.address)
              const recipientBalanceBefore = await ppoToken.balanceOf(recipient.address)
              const stakingContractBalanceBefore = await ppoToken.balanceOf(ppoStaking.address)
              expect(staker.address).to.not.eq(recipient.address)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, testAmountToStake)

              await expect(tx)
                .to.emit(ppoToken, 'Transfer')
                .withArgs(staker.address, ppoStaking.address, testAmountToStake)
              expect(await ppoToken.balanceOf(staker.address)).to.eq(
                stakerBalanceBefore.sub(testAmountToStake)
              )
              expect(await ppoToken.balanceOf(recipient.address)).to.eq(recipientBalanceBefore)
              expect(await ppoToken.balanceOf(ppoStaking.address)).to.eq(
                stakingContractBalanceBefore.add(testAmountToStake)
              )
            })

            it('mints staked position for recipient', async () => {
              const recipientStakingBalanceBefore = await ppoStaking.balanceOf(recipient.address)
              expect(staker.address).to.not.eq(recipient.address)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, testAmountToStake)

              await expect(tx)
                .to.emit(ppoStaking, 'Stake')
                .withArgs(recipient.address, testAmountToStake)
              expect(await ppoStaking.balanceOf(recipient.address)).to.eq(
                recipientStakingBalanceBefore.add(testAmountToStake)
              )
            })

            it("doesn't change delegatee if delegatee is delegator and staker is not recipient", async () => {
              const delegator = recipient
              const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
              expect(previousDelegateeAddress).to.eq(delegator.address)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, testAmountToStake)

              expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
              await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
              await expect(tx)
                .to.emit(ppoStaking, 'DelegateeVotesChange')
                .withArgs(previousDelegateeAddress, 0, testAmountToStake)
            })

            it("doesn't change delegatee if delegatee is non-delegator and staker is not recipient", async () => {
              const delegator = recipient
              await ppoStaking.connect(delegator).delegate(staker.address)
              const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
              expect(previousDelegateeAddress).to.not.eq(delegator.address)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, testAmountToStake)

              expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
              await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
              await expect(tx)
                .to.emit(ppoStaking, 'DelegateeVotesChange')
                .withArgs(previousDelegateeAddress, 0, testAmountToStake)
            })

            it("doesn't change delegatee if delegatee is delegator and staker is recipient", async () => {
              const delegator = staker
              const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
              expect(previousDelegateeAddress).to.eq(delegator.address)

              const tx = await ppoStaking.connect(staker).stake(staker.address, testAmountToStake)

              expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
              await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
              await expect(tx)
                .to.emit(ppoStaking, 'DelegateeVotesChange')
                .withArgs(previousDelegateeAddress, 0, testAmountToStake)
            })

            it("doesn't change delegatee if delegatee is non-delegator and staker is recipient", async () => {
              const delegator = staker
              await ppoStaking.connect(delegator).delegate(recipient.address)
              const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
              expect(previousDelegateeAddress).to.not.eq(delegator.address)

              const tx = await ppoStaking.connect(staker).stake(staker.address, testAmountToStake)

              expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
              await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
              await expect(tx)
                .to.emit(ppoStaking, 'DelegateeVotesChange')
                .withArgs(previousDelegateeAddress, 0, testAmountToStake)
            })

            it("sets recipient's weighted timestamp", async () => {
              const recipientBalanceDataBefore = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataBefore.weightedTimestamp).to.eq(0)

              await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

              const initialStakingTime = await utils.getLastTimestamp(ethers.provider)
              const recipientBalanceDataAfter = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataAfter.weightedTimestamp).to.eq(initialStakingTime)
            })
          })
        }
      })
    })

    context('subsequent stake', () => {
      let initialStakingTime: number
      beforeEach(async () => {
        await initAccounts()
        ;({ ppoToken, ppoStaking } = await redeployPPOStaking(PPO_SUPPLY))
        staker = user1
        recipient = user2
        testAmountToStake = parseEther('1000')
        await ppoToken.connect(staker).approve(ppoStaking.address, testAmountToStake)
        await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)
        initialStakingTime = await utils.getLastTimestamp(ethers.provider)
        await ppoToken.connect(staker).approve(ppoStaking.address, testAmountToStake)
      })

      it('returns without staking if amount = 0', async () => {
        expect(staker.address).to.not.eq(recipient.address)
        const stakerPPOBalanceBefore = await ppoToken.balanceOf(staker.address)
        const recipientScaledBalanceBefore = await ppoStaking.balanceOf(recipient.address)

        const tx = await ppoStaking.connect(staker).stake(recipient.address, 0)

        await expect(tx).to.not.emit(ppoToken, 'Transfer')
        expect(await ppoToken.balanceOf(staker.address)).to.eq(stakerPPOBalanceBefore)
        await expect(tx).to.not.emit(ppoStaking, 'Stake')
        expect(await ppoStaking.balanceOf(recipient.address)).to.eq(recipientScaledBalanceBefore)
      })

      it('transfers PPO from msg.sender to staking contract', async () => {
        const stakerBalanceBefore = await ppoToken.balanceOf(staker.address)
        const recipientBalanceBefore = await ppoToken.balanceOf(recipient.address)
        const stakingContractBalanceBefore = await ppoToken.balanceOf(ppoStaking.address)
        expect(staker.address).to.not.eq(recipient.address)
        expect(staker.address).to.not.eq(ZERO_ADDRESS)

        const tx = await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        await expect(tx)
          .to.emit(ppoToken, 'Transfer')
          .withArgs(staker.address, ppoStaking.address, testAmountToStake)
        expect(await ppoToken.balanceOf(staker.address)).to.eq(
          stakerBalanceBefore.sub(testAmountToStake)
        )
        expect(await ppoToken.balanceOf(recipient.address)).to.eq(recipientBalanceBefore)
        expect(await ppoToken.balanceOf(ppoStaking.address)).to.eq(
          stakingContractBalanceBefore.add(testAmountToStake)
        )
      })

      it("adds to recipient's existing scaled balance", async () => {
        const stakerScaledBalanceBefore = await ppoStaking.balanceOf(staker.address)
        const recipientScaledBalanceBefore = await ppoStaking.balanceOf(recipient.address)
        expect(staker.address).to.not.eq(recipient.address)
        expect(staker.address).to.not.eq(ZERO_ADDRESS)

        const tx = await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        await expect(tx).to.emit(ppoStaking, 'Stake').withArgs(recipient.address, testAmountToStake)
        expect(await ppoStaking.balanceOf(staker.address)).to.eq(stakerScaledBalanceBefore)
        expect(await ppoStaking.balanceOf(recipient.address)).to.eq(
          recipientScaledBalanceBefore.add(testAmountToStake)
        )
      })

      it("doesn't change delegatee if delegatee is delegator and staker is not recipient", async () => {
        const delegator = recipient
        const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
        expect(previousDelegateeAddress).to.eq(delegator.address)
        const delegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

        const tx = await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
        await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
        await expect(tx)
          .to.emit(ppoStaking, 'DelegateeVotesChange')
          .withArgs(
            previousDelegateeAddress,
            delegateeVotesBefore,
            delegateeVotesBefore.add(testAmountToStake)
          )
      })

      it("doesn't change delegatee if delegatee is non-delegator and staker is not recipient", async () => {
        const delegator = recipient
        await ppoStaking.connect(delegator).delegate(staker.address)
        const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
        expect(previousDelegateeAddress).to.not.eq(delegator.address)
        const delegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

        const tx = await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
        await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
        await expect(tx)
          .to.emit(ppoStaking, 'DelegateeVotesChange')
          .withArgs(
            previousDelegateeAddress,
            delegateeVotesBefore,
            delegateeVotesBefore.add(testAmountToStake)
          )
      })

      it("doesn't change delegatee if delegatee is delegator and staker is recipient", async () => {
        const delegator = staker
        const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
        expect(previousDelegateeAddress).to.eq(delegator.address)
        const delegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

        const tx = await ppoStaking.connect(staker).stake(staker.address, testAmountToStake)

        expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
        await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
        await expect(tx)
          .to.emit(ppoStaking, 'DelegateeVotesChange')
          .withArgs(
            previousDelegateeAddress,
            delegateeVotesBefore,
            delegateeVotesBefore.add(testAmountToStake)
          )
      })

      it("doesn't change delegatee if delegatee is non-delegator and staker is recipient", async () => {
        const delegator = staker
        await ppoStaking.connect(delegator).delegate(recipient.address)
        const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
        expect(previousDelegateeAddress).to.not.eq(delegator.address)
        const delegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

        const tx = await ppoStaking.connect(staker).stake(staker.address, testAmountToStake)

        expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
        await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
        await expect(tx)
          .to.emit(ppoStaking, 'DelegateeVotesChange')
          .withArgs(
            previousDelegateeAddress,
            delegateeVotesBefore,
            delegateeVotesBefore.add(testAmountToStake)
          )
      })

      context('restaking after a cooldown', () => {
        let amountToCooldown: BigNumber
        const cooldownTestNames = ['partial amount cooldown', 'full amount cooldown']
        // eslint-disable-next-line no-restricted-syntax
        for (const cooldownTest of cooldownTestNames) {
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          context(`after a ${cooldownTest}`, () => {
            beforeEach(async () => {
              if (cooldownTest === 'partial cooldown') {
                amountToCooldown = (await ppoStaking.balanceOf(recipient.address)).sub(1)
              } else {
                amountToCooldown = await ppoStaking.balanceOf(recipient.address)
              }
            })

            it("doesn't end cooldown if time passed < cooldown period + unstaking window", async () => {
              await ppoStaking.connect(recipient).startCooldown(amountToCooldown)
              const cooldownStartTime = BigNumber.from(
                await utils.getLastTimestamp(ethers.provider)
              )
              const recipientBalanceDataBefore = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataBefore.cooldownTimestamp).to.eq(cooldownStartTime)
              expect(recipientBalanceDataBefore.cooldownUnits).to.eq(amountToCooldown)
              const secondAmountToStake = 1
              await ppoToken.connect(user1).approve(ppoStaking.address, secondAmountToStake)
              const cooldownAndUnstakeEndTime = cooldownStartTime
                .add(COOLDOWN_SECONDS)
                .add(UNSTAKE_WINDOW)
                .toNumber()
              await utils.setNextTimestamp(ethers.provider, cooldownAndUnstakeEndTime - 1)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, secondAmountToStake)

              expect(tx).to.not.emit(ppoStaking, 'CooldownExit')
              const recipientBalanceDataAfter = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataAfter.raw).to.eq(
                recipientBalanceDataBefore.raw.add(secondAmountToStake)
              )
              expect(recipientBalanceDataAfter.cooldownTimestamp).to.eq(cooldownStartTime)
              expect(recipientBalanceDataAfter.cooldownUnits).to.eq(
                recipientBalanceDataBefore.cooldownUnits
              )
            })

            it("doesn't end cooldown if time passed = cooldown period + unstaking window", async () => {
              await ppoStaking.connect(recipient).startCooldown(amountToCooldown)
              const cooldownStartTime = BigNumber.from(
                await utils.getLastTimestamp(ethers.provider)
              )
              const recipientBalanceDataBefore = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataBefore.cooldownTimestamp).to.eq(cooldownStartTime)
              expect(recipientBalanceDataBefore.cooldownUnits).to.eq(amountToCooldown)
              const secondAmountToStake = 1
              await ppoToken.connect(user1).approve(ppoStaking.address, secondAmountToStake)
              const cooldownAndUnstakeEndTime = cooldownStartTime
                .add(COOLDOWN_SECONDS)
                .add(UNSTAKE_WINDOW)
                .toNumber()
              await utils.setNextTimestamp(ethers.provider, cooldownAndUnstakeEndTime)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, secondAmountToStake)

              expect(tx).to.not.emit(ppoStaking, 'CooldownExit')
              const recipientBalanceDataAfter = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataAfter.raw).to.eq(
                recipientBalanceDataBefore.raw.add(secondAmountToStake)
              )
              expect(recipientBalanceDataAfter.cooldownTimestamp).to.eq(cooldownStartTime)
              expect(recipientBalanceDataAfter.cooldownUnits).to.eq(
                recipientBalanceDataBefore.cooldownUnits
              )
            })

            it('ends cooldown if time passed > cooldown period + unstaking window', async () => {
              await ppoStaking.connect(recipient).startCooldown(amountToCooldown)
              const cooldownStartTime = BigNumber.from(
                await utils.getLastTimestamp(ethers.provider)
              )
              const recipientBalanceDataBefore = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataBefore.cooldownTimestamp).to.eq(cooldownStartTime)
              expect(recipientBalanceDataBefore.cooldownUnits).to.eq(amountToCooldown)
              const secondAmountToStake = 1
              await ppoToken.connect(user1).approve(ppoStaking.address, secondAmountToStake)
              const cooldownAndUnstakeEndTime = cooldownStartTime
                .add(COOLDOWN_SECONDS)
                .add(UNSTAKE_WINDOW)
                .toNumber()
              await utils.setNextTimestamp(ethers.provider, cooldownAndUnstakeEndTime + 1)

              const tx = await ppoStaking
                .connect(staker)
                .stake(recipient.address, secondAmountToStake)

              expect(tx).to.emit(ppoStaking, 'CooldownExit').withArgs(recipient.address)
              const recipientBalanceDataAfter = await ppoStaking.balanceData(recipient.address)
              expect(recipientBalanceDataAfter.raw).to.eq(
                recipientBalanceDataBefore.raw.add(amountToCooldown).add(secondAmountToStake)
              )
              expect(recipientBalanceDataAfter.cooldownTimestamp).to.eq(0)
              expect(recipientBalanceDataAfter.cooldownUnits).to.eq(0)
            })
          })
        }
      })

      it("doesn't apply new multiplier if time staked < new multiplier threshold", async () => {
        const recipientDataBefore = await snapshotUserStakingData(recipient.address)
        expect(recipientDataBefore.rawBalance.weightedTimestamp).to.eq(initialStakingTime)
        // SteppedTimeMultiplierV1 does not scale beyond 1x until time passed > 13 weeks
        const deltaBelowScalingThreshold = ONE_WEEK.mul(13).sub(1)
        const timeToStake = await calcTimeToStakeAt(
          recipientDataBefore.rawBalance.weightedTimestamp,
          deltaBelowScalingThreshold,
          recipientDataBefore.scaledBalance,
          testAmountToStake,
          true
        )
        await utils.setNextTimestamp(ethers.provider, timeToStake)

        await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        const subsequentStakingTime = await utils.getLastTimestamp(ethers.provider)
        const recipientDataAfter = await snapshotUserStakingData(recipient.address)
        const newWeightedTimestamp = calcWeightedTimestamp(
          initialStakingTime,
          subsequentStakingTime,
          recipientDataBefore.scaledBalance,
          testAmountToStake,
          true
        )
        expect(recipientDataAfter.rawBalance.weightedTimestamp).to.eq(newWeightedTimestamp)
        expect(recipientDataAfter.scaledBalance).to.be.eq(
          recipientDataBefore.scaledBalance.add(testAmountToStake)
        )
      })

      it('applies new multiplier if time staked = new multiplier threshold', async () => {
        const recipientDataBefore = await snapshotUserStakingData(recipient.address)
        expect(recipientDataBefore.rawBalance.weightedTimestamp).to.eq(initialStakingTime)
        // SteppedTimeMultiplierV1 does not scale beyond 1x until time passed >= 13 weeks
        const deltaAtScalingThreshold = ONE_WEEK.mul(13)
        const timeToStake = await calcTimeToStakeAt(
          recipientDataBefore.rawBalance.weightedTimestamp,
          deltaAtScalingThreshold,
          recipientDataBefore.scaledBalance,
          testAmountToStake,
          true
        )
        await utils.setNextTimestamp(ethers.provider, timeToStake)

        await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        const subsequentStakingTime = await utils.getLastTimestamp(ethers.provider)
        const recipientDataAfter = await snapshotUserStakingData(recipient.address)
        const newWeightedTimestamp = calcWeightedTimestamp(
          initialStakingTime,
          subsequentStakingTime,
          recipientDataBefore.scaledBalance,
          testAmountToStake,
          true
        )
        expect(recipientDataAfter.rawBalance.weightedTimestamp).to.eq(newWeightedTimestamp)
        expect(recipientDataAfter.rawBalance.timeMultiplier).to.be.gt(
          recipientDataBefore.rawBalance.timeMultiplier
        )
        const expectedTimeMultiplier = await mockSteppedTimeMultiplier.calculate(
          recipientDataBefore.rawBalance.weightedTimestamp
        )
        expect(recipientDataAfter.rawBalance.timeMultiplier).to.eq(expectedTimeMultiplier)
        expect(recipientDataAfter.scaledBalance).to.be.eq(
          recipientDataBefore.rawBalance.raw
            .add(testAmountToStake)
            .mul(expectedTimeMultiplier)
            .div(MULTIPLIER_DENOMINATOR)
        )
      })

      it('applies new multiplier if time staked > new multiplier threshold', async () => {
        const recipientDataBefore = await snapshotUserStakingData(recipient.address)
        expect(recipientDataBefore.rawBalance.weightedTimestamp).to.eq(initialStakingTime)
        const deltaAtScalingThreshold = ONE_WEEK.mul(13)
        const timeToStake = await calcTimeToStakeAt(
          recipientDataBefore.rawBalance.weightedTimestamp,
          // Add 1 to the floor of the first multiplier threshold
          deltaAtScalingThreshold.add(1),
          recipientDataBefore.scaledBalance,
          testAmountToStake,
          true
        )
        await utils.setNextTimestamp(ethers.provider, timeToStake)

        await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)

        const subsequentStakingTime = await utils.getLastTimestamp(ethers.provider)
        const recipientDataAfter = await snapshotUserStakingData(recipient.address)
        const newWeightedTimestamp = calcWeightedTimestamp(
          initialStakingTime,
          subsequentStakingTime,
          recipientDataBefore.scaledBalance,
          testAmountToStake,
          true
        )
        expect(recipientDataAfter.rawBalance.weightedTimestamp).to.eq(newWeightedTimestamp)
        expect(recipientDataAfter.rawBalance.timeMultiplier).to.be.gt(
          recipientDataBefore.rawBalance.timeMultiplier
        )
        const expectedTimeMultiplier = await mockSteppedTimeMultiplier.calculate(
          recipientDataBefore.rawBalance.weightedTimestamp
        )
        expect(recipientDataAfter.rawBalance.timeMultiplier).to.eq(expectedTimeMultiplier)
        expect(recipientDataAfter.scaledBalance).to.be.eq(
          recipientDataBefore.rawBalance.raw
            .add(testAmountToStake)
            .mul(expectedTimeMultiplier)
            .div(MULTIPLIER_DENOMINATOR)
        )
      })
    })
  })

  describe('# delegate', () => {
    let staker: SignerWithAddress
    let recipient: SignerWithAddress
    let delegator: SignerWithAddress
    const testAmountToStake = parseEther('1000')
    beforeEach(async () => {
      await initAccounts()
      ;({ ppoToken, ppoStaking } = await redeployPPOStaking(PPO_SUPPLY))
      staker = user1
      recipient = user2
      delegator = recipient
      await ppoToken.connect(staker).approve(ppoStaking.address, testAmountToStake)
      await ppoStaking.connect(staker).stake(recipient.address, testAmountToStake)
    })

    it('delegates to delegator', async () => {
      // stake to non-delegator to verify a change occurred
      await ppoStaking.connect(delegator).delegate(staker.address)
      const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
      expect(previousDelegateeAddress).to.not.eq(delegator.address)
      const delegatorVotesBefore = await ppoStaking.getVotes(delegator.address)
      expect(delegatorVotesBefore).to.eq(0)
      const previousDelegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

      const tx = await ppoStaking.connect(delegator).delegate(delegator.address)

      expect(await ppoStaking.delegates(delegator.address)).to.eq(delegator.address)
      expect(await ppoStaking.getVotes(delegator.address)).to.eq(previousDelegateeVotesBefore)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeChange')
        .withArgs(delegator.address, previousDelegateeAddress, delegator.address)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeVotesChange')
        .withArgs(delegator.address, 0, previousDelegateeVotesBefore)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeVotesChange')
        .withArgs(previousDelegateeAddress, previousDelegateeVotesBefore, 0)
    })

    it('delegates to non-delegator', async () => {
      const delegatee = staker
      expect(delegatee.address).to.not.eq(delegator.address)
      const delegatorVotesBefore = await ppoStaking.getVotes(delegator.address)

      const tx = await ppoStaking.connect(delegator).delegate(delegatee.address)

      expect(await ppoStaking.delegates(delegator.address)).to.eq(delegatee.address)
      expect(await ppoStaking.getVotes(delegator.address)).to.eq(0)
      expect(await ppoStaking.getVotes(delegatee.address)).to.eq(delegatorVotesBefore)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeChange')
        .withArgs(delegator.address, delegator.address, delegatee.address)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeVotesChange')
        .withArgs(delegator.address, delegatorVotesBefore, 0)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeVotesChange')
        .withArgs(delegatee.address, 0, delegatorVotesBefore)
    })

    it('delegating to zero address delegates to delegator', async () => {
      // stake to non-delegator to verify a change occurred
      await ppoStaking.connect(delegator).delegate(staker.address)
      const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
      expect(previousDelegateeAddress).to.not.eq(delegator.address)
      const delegatorVotesBefore = await ppoStaking.getVotes(delegator.address)
      expect(delegatorVotesBefore).to.eq(0)
      const previousDelegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

      const tx = await ppoStaking.connect(delegator).delegate(ZERO_ADDRESS)

      expect(await ppoStaking.delegates(delegator.address)).to.eq(delegator.address)
      expect(await ppoStaking.getVotes(delegator.address)).to.eq(previousDelegateeVotesBefore)
      expect(await ppoStaking.getVotes(previousDelegateeAddress)).to.eq(0)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeChange')
        .withArgs(delegator.address, previousDelegateeAddress, delegator.address)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeVotesChange')
        .withArgs(delegator.address, 0, previousDelegateeVotesBefore)
      await expect(tx)
        .to.emit(ppoStaking, 'DelegateeVotesChange')
        .withArgs(previousDelegateeAddress, previousDelegateeVotesBefore, 0)
    })

    it("doesn't change delegate if delegatee is current one", async () => {
      // stake to non-delegator to verify a change occurred
      await ppoStaking.connect(delegator).delegate(staker.address)
      const previousDelegateeAddress = await ppoStaking.delegates(delegator.address)
      expect(previousDelegateeAddress).to.not.eq(delegator.address)
      expect(await ppoStaking.getVotes(delegator.address)).to.eq(0)
      const previousDelegateeVotesBefore = await ppoStaking.getVotes(previousDelegateeAddress)

      const tx = await ppoStaking.connect(delegator).delegate(previousDelegateeAddress)

      expect(await ppoStaking.delegates(delegator.address)).to.eq(previousDelegateeAddress)
      expect(await ppoStaking.getVotes(previousDelegateeAddress)).to.eq(
        previousDelegateeVotesBefore
      )
      await expect(tx).to.not.emit(ppoStaking, 'DelegateeChange')
      await expect(tx).to.not.emit(ppoStaking, 'DelegateeVotesChange')
    })
  })
})
