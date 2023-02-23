import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { parseEther } from 'ethers/lib/utils'
import { MockContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import {
  mockPPOGamifiedTokenDeployFixture,
  smockSteppedTimeMultiplierV1Fixture,
  smockMockAchievementsManagerFixture,
} from './fixtures/PPOStakingFixtures'
import { MAX_INT64, MAX_UINT64, MIN_INT64 } from '../utils'
import {
  MockERC20,
  MockERC20__factory,
  MockNexus,
  MockNexus__factory,
  MockPPOGamifiedToken,
  PlatformTokenVendorFactory__factory,
} from '../types/generated'

chai.use(smock.matchers)

describe('PPOGamifiedToken', () => {
  interface Deployment {
    gamifiedToken: MockPPOGamifiedToken
  }

  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let user3: SignerWithAddress
  let rewardsDistributor: SignerWithAddress
  let nexus: MockNexus
  let ppoToken: MockERC20
  let gamifiedToken: MockPPOGamifiedToken
  let smockAchievementsManager: MockContract<Contract>
  let mockSteppedTimeMultiplier: MockContract<Contract>

  const MULTIPLIER_DENOMINATOR = 1e12
  const MAX_MULTIPLIER = 5e12 // 5X

  const testRawBalance = parseEther('1500')
  const defaultBalanceData = {
    raw: testRawBalance,
    weightedTimestamp: 0,
    timeMultiplier: 0,
    questMultiplier: 0,
    achievementsMultiplier: 0,
    cooldownTimestamp: 0,
    cooldownUnits: 0,
  }

  const initAccounts = async (): Promise<void> => {
    const [localDeployer, localOwner, localUser1, localUser2, localUser3, localRewardsDistributor] =
      await ethers.getSigners()
    deployer = localDeployer
    owner = localOwner
    user1 = localUser1
    user2 = localUser2
    user3 = localUser3
    rewardsDistributor = localRewardsDistributor
  }

  const redeployGamifiedToken = async (): Promise<Deployment> => {
    nexus = await new MockNexus__factory(user1).deploy(owner.address, JUNK_ADDRESS, JUNK_ADDRESS)
    ppoToken = await new MockERC20__factory(user1).deploy(
      'prePO Token',
      'PPO',
      18,
      user1.address,
      10000100
    )
    smockAchievementsManager = await smockMockAchievementsManagerFixture()
    const platformTokenVendorFactory = await new PlatformTokenVendorFactory__factory(user1).deploy()
    gamifiedToken = await mockPPOGamifiedTokenDeployFixture(
      platformTokenVendorFactory.address,
      nexus.address,
      ppoToken.address,
      smockAchievementsManager.address
    )
    await gamifiedToken.__mockPPOGamifiedToken_init('PPO Power', 'pPPO', rewardsDistributor.address)
    return {
      gamifiedToken,
    }
  }

  describe('initial state', () => {
    before(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
    })

    it('sets name from constructor', async () => {
      expect(await gamifiedToken.name()).to.eq('PPO Power')
    })

    it('sets symbol from constructor', async () => {
      expect(await gamifiedToken.symbol()).to.eq('pPPO')
    })

    it('sets rewards distributor from constructor', async () => {
      expect(await gamifiedToken.rewardsDistributor()).to.eq(rewardsDistributor.address)
    })

    it('sets decimals to 18', async () => {
      expect(await gamifiedToken.decimals()).to.eq(18)
    })

    it('sets nexus from constructor', async () => {
      expect(await gamifiedToken.nexus()).to.eq(nexus.address)
    })

    it('sets quest manager from constructor', async () => {
      expect(await gamifiedToken.achievementsManager()).to.eq(smockAchievementsManager.address)
    })
  })

  describe('# setTimeMultiplierCalculator', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
    })

    it('reverts if not governor', async () => {
      expect(await nexus.governor()).to.not.eq(user1)

      await expect(
        gamifiedToken.connect(user1).setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
      ).to.be.revertedWith('Only governor can execute')
    })

    it('sets new calculator to non-zero address', async () => {
      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.not.eq(
        mockSteppedTimeMultiplier.address
      )

      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)

      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.eq(
        mockSteppedTimeMultiplier.address
      )
    })

    it('sets new calculator to zero address', async () => {
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.not.eq(ZERO_ADDRESS)

      await gamifiedToken.connect(owner).setTimeMultiplierCalculator(ZERO_ADDRESS)

      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.eq(ZERO_ADDRESS)
    })

    it('is indempotent', async () => {
      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.eq(ZERO_ADDRESS)

      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)

      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.eq(
        mockSteppedTimeMultiplier.address
      )

      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)

      expect(await gamifiedToken.getTimeMultiplierCalculator()).to.eq(
        mockSteppedTimeMultiplier.address
      )
    })

    it('emits TimeMultiplierCalculatorChange', async () => {
      const tx = await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)

      await expect(tx)
        .to.emit(gamifiedToken, 'TimeMultiplierCalculatorChange(address)')
        .withArgs(mockSteppedTimeMultiplier.address)
    })
  })

  describe('# setMaxMultiplier', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
    })

    it('reverts if not governor', async () => {
      expect(await nexus.governor()).to.not.eq(user1)

      await expect(
        gamifiedToken.connect(user1).setMaxMultiplier(MAX_MULTIPLIER)
      ).to.be.revertedWith('Only governor can execute')
    })

    it('sets new max to value > 0', async () => {
      expect(await gamifiedToken.getMaxMultiplier()).to.not.eq(MAX_MULTIPLIER)

      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)

      expect(await gamifiedToken.getMaxMultiplier()).to.eq(MAX_MULTIPLIER)
    })

    it('sets new max to 0', async () => {
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      expect(await gamifiedToken.getMaxMultiplier()).to.not.eq(0)

      await gamifiedToken.connect(owner).setMaxMultiplier(0)

      expect(await gamifiedToken.getMaxMultiplier()).to.eq(0)
    })

    it('is indempotent', async () => {
      expect(await gamifiedToken.getMaxMultiplier()).to.not.eq(MAX_MULTIPLIER)

      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)

      expect(await gamifiedToken.getMaxMultiplier()).to.eq(MAX_MULTIPLIER)

      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)

      expect(await gamifiedToken.getMaxMultiplier()).to.eq(MAX_MULTIPLIER)
    })

    it('emits MaxMultiplierChange', async () => {
      const tx = await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)

      await expect(tx)
        .to.emit(gamifiedToken, 'MaxMultiplierChange(uint256)')
        .withArgs(MAX_MULTIPLIER)
    })
  })

  describe('# _scaleBalance', () => {
    before(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
    })

    it('scales by sum of both multipliers if temp multiplier > 0 and sum > 0', async () => {
      const timeMultiplier = 15e11 // 1.5X
      const achievementsMultiplier = 1e12 // 1X
      expect(achievementsMultiplier).to.be.gt(0)
      expect(timeMultiplier + achievementsMultiplier).to.be.gt(0)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(
        testRawBalance.mul(timeMultiplier + achievementsMultiplier).div(MULTIPLIER_DENOMINATOR)
      )
    })

    it('scales by sum of both multipliers if temp multiplier < 0 and sum > 0', async () => {
      const timeMultiplier = 15e11
      const achievementsMultiplier = -1e12
      expect(achievementsMultiplier).to.be.lt(0)
      expect(timeMultiplier + achievementsMultiplier).to.be.gt(0)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(
        testRawBalance.mul(timeMultiplier + achievementsMultiplier).div(MULTIPLIER_DENOMINATOR)
      )
    })

    it('returns 0 if multiplier sum = 0', async () => {
      const timeMultiplier = 15e11
      const achievementsMultiplier = timeMultiplier * -1 // -1.5X
      expect(timeMultiplier + achievementsMultiplier).to.be.eq(0)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(0)
    })

    it('returns 0 if multiplier sum < 0', async () => {
      const timeMultiplier = 15e11
      const achievementsMultiplier = (timeMultiplier + 1) * -1
      expect(timeMultiplier + achievementsMultiplier).to.be.lt(0)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(0)
    })

    it('scales by max multiplier if multiplier sum > max', async () => {
      const timeMultiplier = MAX_MULTIPLIER
      const achievementsMultiplier = 1
      expect(timeMultiplier + achievementsMultiplier).to.be.gt(MAX_MULTIPLIER)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(testRawBalance.mul(MAX_MULTIPLIER).div(MULTIPLIER_DENOMINATOR))
    })

    it('scales by max multiplier if multiplier sum = max', async () => {
      const timeMultiplier = MAX_MULTIPLIER
      const achievementsMultiplier = 0
      expect(timeMultiplier + achievementsMultiplier).to.be.eq(MAX_MULTIPLIER)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(testRawBalance.mul(MAX_MULTIPLIER).div(MULTIPLIER_DENOMINATOR))
    })

    it('scales by max multiplier if time multiplier is max uint64 and temp multiplier is max int64', async () => {
      const timeMultiplier = MAX_UINT64
      const achievementsMultiplier = MAX_INT64

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          raw: 1,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(BigNumber.from(1).mul(MAX_MULTIPLIER).div(MULTIPLIER_DENOMINATOR))
    })

    it('scales by max multiplier if time multiplier is max uint64 and temp multiplier is min int64', async () => {
      const timeMultiplier = MAX_UINT64
      const achievementsMultiplier = MIN_INT64
      expect(timeMultiplier.add(achievementsMultiplier)).to.be.gt(MAX_MULTIPLIER)

      expect(
        await gamifiedToken.getScaledBalance({
          ...defaultBalanceData,
          timeMultiplier,
          achievementsMultiplier,
        })
      ).to.eq(testRawBalance.mul(MAX_MULTIPLIER).div(MULTIPLIER_DENOMINATOR))
    })
  })

  describe('# _applyAchievementsMultiplier', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
      /**
       * Set QuestManager to the default account so that we can call
       * applyAchievementsMultiplier.
       */
      await gamifiedToken.setAchievementsManager(user1.address)
    })

    it('uses configured time multiplier calculator', async () => {
      const lastBlockTime = await utils.getLastTimestamp(ethers.provider)
      await gamifiedToken.writeBalance(user1.address, {
        ...defaultBalanceData,
        timeMultiplier: 1,
        weightedTimestamp: lastBlockTime,
      })

      await gamifiedToken.connect(user1).applyAchievementsMultiplier(user1.address, 0)

      expect(mockSteppedTimeMultiplier.calculate).to.be.calledWith(lastBlockTime)
    })
  })

  describe('# _enterCooldownPeriod', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
    })

    it('uses configured time multiplier calculator', async () => {
      const lastBlockTime = await utils.getLastTimestamp(ethers.provider)
      await gamifiedToken.writeBalance(user1.address, {
        ...defaultBalanceData,
        weightedTimestamp: lastBlockTime,
      })
      /**
       * _enterCooldownPeriod checks the QuestManager to see if an account has
       * expired quests. Mocking this for now for simplicity.
       */
      smockAchievementsManager.checkForSeasonFinish.whenCalledWith(user1.address).returns(1)

      await gamifiedToken.enterCooldownPeriod(user1.address, 1)

      expect(mockSteppedTimeMultiplier.calculate).to.be.calledWith(lastBlockTime)
    })
  })

  describe('# _exitCooldownPeriod', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
    })

    it('uses configured time multiplier calculator', async () => {
      const lastBlockTime = await utils.getLastTimestamp(ethers.provider)
      await gamifiedToken.writeBalance(user1.address, {
        ...defaultBalanceData,
        weightedTimestamp: lastBlockTime,
      })
      /**
       * _exitCooldownPeriod checks the QuestManager to see if an account has
       * expired quests. Mocking this for now for simplicity.
       */
      smockAchievementsManager.checkForSeasonFinish.whenCalledWith(user1.address).returns(1)

      await gamifiedToken.exitCooldownPeriod(user1.address)

      expect(mockSteppedTimeMultiplier.calculate).to.be.calledWith(lastBlockTime)
    })
  })

  describe('# _reviewWeightedTimestamp', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
    })

    it('uses configured time multiplier calculator', async () => {
      const lastBlockTime = await utils.getLastTimestamp(ethers.provider)
      await gamifiedToken.writeBalance(user1.address, {
        ...defaultBalanceData,
        weightedTimestamp: lastBlockTime,
      })
      // Ensure calculator returns a new value or else reviewTimestamp will revert
      mockSteppedTimeMultiplier.calculate.whenCalledWith(lastBlockTime).returns(100)
      /**
       * _reviewWeightedTimestamp checks the QuestManager to see if an account
       * has expired quests. Mocking this for now for simplicity.
       */
      smockAchievementsManager.checkForSeasonFinish.whenCalledWith(user1.address).returns(1)

      await gamifiedToken.reviewTimestamp(user1.address)

      expect(mockSteppedTimeMultiplier.calculate).to.be.calledWith(lastBlockTime)
    })
  })

  describe('# _mintRaw', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
    })

    it('uses configured time multiplier calculator', async () => {
      const lastBlockTime = await utils.getLastTimestamp(ethers.provider)
      await gamifiedToken.writeBalance(user1.address, {
        ...defaultBalanceData,
        weightedTimestamp: lastBlockTime,
      })
      /**
       * _mintRaw checks the QuestManager to see if an account
       * has expired quests. Mocking this for now for simplicity.
       */
      smockAchievementsManager.checkForSeasonFinish.whenCalledWith(user1.address).returns(1)

      await gamifiedToken.mintRaw(user1.address, 1, false)

      expect(mockSteppedTimeMultiplier.calculate).to.be.calledWith(lastBlockTime)
    })
  })

  describe('# _burnRaw', () => {
    beforeEach(async () => {
      await initAccounts()
      ;({ gamifiedToken } = await redeployGamifiedToken())
      await gamifiedToken.connect(owner).setMaxMultiplier(MAX_MULTIPLIER)
      mockSteppedTimeMultiplier = await smockSteppedTimeMultiplierV1Fixture()
      await gamifiedToken
        .connect(owner)
        .setTimeMultiplierCalculator(mockSteppedTimeMultiplier.address)
    })

    it('uses configured time multiplier calculator', async () => {
      const lastBlockTime = await utils.getLastTimestamp(ethers.provider)
      await gamifiedToken.writeBalance(user1.address, {
        ...defaultBalanceData,
        weightedTimestamp: lastBlockTime,
        cooldownUnits: parseEther('1500'),
      })
      /**
       * _burnRaw checks the QuestManager to see if an account
       * has expired quests. Mocking this for now for simplicity.
       */
      smockAchievementsManager.checkForSeasonFinish.whenCalledWith(user1.address).returns(1)

      await gamifiedToken.burnRaw(user1.address, 1, false, false)

      expect(mockSteppedTimeMultiplier.calculate).to.be.calledWith(lastBlockTime)
    })
  })
})
