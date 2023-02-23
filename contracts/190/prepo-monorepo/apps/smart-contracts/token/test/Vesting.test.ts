/* eslint-disable no-await-in-loop */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { vestingFixture, mockVestingClaimerFixture } from './fixtures/VestingFixtures'
import { mockERC20Fixture } from './fixtures/MockERC20Fixtures'
import { ZERO, ONE } from '../utils'
import { Vesting, MockERC20, MockVestingClaimer } from '../types/generated'

const { mineBlocks, mineBlock } = utils

describe('Vesting', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let vesting: Vesting
  let vestingStartTime: number
  let vestingEndTime: number
  let currentTime: number
  let mockERC20Token: MockERC20
  let externalERC20Token: MockERC20
  let mockVestingClaimer: MockVestingClaimer
  let recipients: string[]
  let amountsAllocated: BigNumber[]
  let lowerAllocationAmounts: BigNumber[]
  let higherAllocationAmounts: BigNumber[]
  let timeAfterVestingStarted: number
  const DAY_IN_SECONDS = 86400
  const YEAR_IN_SECONDS = DAY_IN_SECONDS * 365
  const ONE_ETH = parseEther('1')
  const BLOCK_DURATION_IN_SECONDS = 15

  const deployVesting = async (): Promise<void> => {
    ;[deployer, owner, user1, user2] = await ethers.getSigners()
    vesting = await vestingFixture()
  }

  const setupVesting = async (): Promise<void> => {
    await deployVesting()
    await vesting.connect(deployer).transferOwnership(owner.address)
    await vesting.connect(owner).acceptOwnership()
    const mockERC20Recipient = owner.address
    const mockERC20Decimal = 18
    const mockERC20InitialMint = ONE_ETH.mul(100)
    mockERC20Token = await mockERC20Fixture(
      'Mock ERC20',
      'MERC20',
      mockERC20Decimal,
      mockERC20Recipient,
      mockERC20InitialMint
    )
  }

  describe('initial state', () => {
    before(async () => {
      await deployVesting()
    })

    it('sets nominee to zero address', async () => {
      expect(await vesting.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await vesting.owner()).to.eq(deployer.address)
    })
  })

  describe('# setToken', () => {
    beforeEach(async () => {
      await setupVesting()
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).to.not.eq(user1.address)

      await expect(vesting.connect(user1).setToken(mockERC20Token.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await vesting.connect(owner).getToken()).to.not.eq(mockERC20Token.address)

      await vesting.connect(owner).setToken(mockERC20Token.address)

      expect(await vesting.connect(owner).getToken()).to.eq(mockERC20Token.address)
      expect(await vesting.connect(owner).getToken()).to.not.eq(ZERO_ADDRESS)
    })

    it('sets to zero address', async () => {
      await vesting.connect(owner).setToken(mockERC20Token.address)
      expect(await vesting.connect(owner).getToken()).to.not.eq(ZERO_ADDRESS)

      await vesting.connect(owner).setToken(ZERO_ADDRESS)

      expect(await vesting.connect(owner).getToken()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await vesting.connect(owner).getToken()).to.not.eq(mockERC20Token.address)

      await vesting.connect(owner).setToken(mockERC20Token.address)

      expect(await vesting.connect(owner).getToken()).to.eq(mockERC20Token.address)

      await vesting.connect(owner).setToken(mockERC20Token.address)

      expect(await vesting.connect(owner).getToken()).to.eq(mockERC20Token.address)
    })
  })

  describe('# setVestingStartTime', () => {
    beforeEach(async () => {
      await setupVesting()
      currentTime = await utils.getLastTimestamp(ethers.provider)
      vestingStartTime = (await utils.getLastTimestamp(ethers.provider)) + DAY_IN_SECONDS
      vestingEndTime = vestingStartTime + 3 * YEAR_IN_SECONDS
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).to.not.eq(user1.address)

      await expect(vesting.connect(user1).setVestingStartTime(vestingStartTime)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if start time > end time', async () => {
      const invalidVestingStartTime = vestingEndTime + 1
      expect(await vesting.getVestingEndTime()).to.be.equals(vestingEndTime)

      await expect(
        vesting.connect(owner).setVestingStartTime(invalidVestingStartTime)
      ).revertedWith('Vesting start time >= end time')
    })

    it('reverts if start time = end time', async () => {
      const invalidVestingStartTime = vestingEndTime
      expect(await vesting.getVestingEndTime()).to.be.equals(vestingEndTime)

      await expect(
        vesting.connect(owner).setVestingStartTime(invalidVestingStartTime)
      ).revertedWith('Vesting start time >= end time')
    })

    it('sets to future time', async () => {
      expect(vestingStartTime).to.be.greaterThan(currentTime)
      expect(await vesting.getVestingStartTime()).to.not.eq(vestingStartTime)

      await vesting.connect(owner).setVestingStartTime(vestingStartTime)

      expect(await vesting.getVestingStartTime()).to.eq(vestingStartTime)
    })

    it('sets to past time', async () => {
      const pastTime = vestingStartTime - 2 * DAY_IN_SECONDS
      expect(pastTime).to.be.lessThan(currentTime)
      expect(await vesting.getVestingStartTime()).to.not.eq(pastTime)

      await vesting.connect(owner).setVestingStartTime(pastTime)

      expect(await vesting.getVestingStartTime()).to.eq(pastTime)
    })

    it('sets to future time after vesting started', async () => {
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      const newFutureStartTime = vestingStartTime + 10 * DAY_IN_SECONDS
      const newCurrentTime = vestingStartTime + DAY_IN_SECONDS
      // Set the current time to be after vesting started.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, newCurrentTime)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(newCurrentTime)
      expect(newCurrentTime).to.be.greaterThan(vestingStartTime)
      expect(newFutureStartTime).to.be.greaterThan(currentTime)

      await vesting.connect(owner).setVestingStartTime(newFutureStartTime)

      expect(await vesting.getVestingStartTime()).to.eq(newFutureStartTime)
    })

    it('sets to past time after vesting started', async () => {
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      const newPastStartTime = vestingStartTime - 10 * DAY_IN_SECONDS
      // Set the current time to be after vesting started.
      const newCurrentTime = vestingStartTime + DAY_IN_SECONDS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, newCurrentTime)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(newCurrentTime)
      expect(newCurrentTime).to.be.greaterThan(vestingStartTime)
      expect(newPastStartTime).to.be.lessThan(currentTime)

      await vesting.connect(owner).setVestingStartTime(newPastStartTime)

      expect(await vesting.getVestingStartTime()).to.eq(newPastStartTime)
    })

    it('is idempotent', async () => {
      expect(await vesting.getVestingStartTime()).to.not.eq(vestingStartTime)

      await vesting.connect(owner).setVestingStartTime(vestingStartTime)

      expect(await vesting.getVestingStartTime()).to.eq(vestingStartTime)

      await vesting.connect(owner).setVestingStartTime(vestingStartTime)

      expect(await vesting.getVestingStartTime()).to.eq(vestingStartTime)
    })
  })

  describe('# setVestingEndTime', () => {
    beforeEach(async () => {
      await setupVesting()
      currentTime = await utils.getLastTimestamp(ethers.provider)
      vestingStartTime = currentTime + DAY_IN_SECONDS
      vestingEndTime = vestingStartTime + 3 * YEAR_IN_SECONDS
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).to.not.eq(user1.address)

      await expect(vesting.connect(user1).setVestingEndTime(vestingEndTime)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if end time < start time', async () => {
      // vestingEndTime needs to be set first.
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      expect(await vesting.getVestingStartTime()).to.be.equal(vestingStartTime)
      const invalidVestingEndTime = vestingStartTime - 1

      await expect(vesting.connect(owner).setVestingEndTime(invalidVestingEndTime)).revertedWith(
        'Vesting end time <= start time'
      )
    })

    it('reverts if start time = end time', async () => {
      // vestingEndTime needs to be set first.
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      expect(await vesting.getVestingStartTime()).to.be.equal(vestingStartTime)
      const invalidVestingEndTime = vestingStartTime

      await expect(vesting.connect(owner).setVestingEndTime(invalidVestingEndTime)).revertedWith(
        'Vesting end time <= start time'
      )
    })

    it('sets to future time', async () => {
      expect(vestingEndTime).to.be.gt(currentTime)
      expect(await vesting.getVestingEndTime()).to.not.eq(vestingEndTime)

      await vesting.connect(owner).setVestingEndTime(vestingEndTime)

      expect(await vesting.getVestingEndTime()).to.eq(vestingEndTime)
    })

    it('sets to past time', async () => {
      const pastTime = currentTime - 2 * DAY_IN_SECONDS
      expect(pastTime).to.be.lt(currentTime)
      expect(await vesting.getVestingEndTime()).to.not.eq(pastTime)

      await vesting.connect(owner).setVestingEndTime(pastTime)

      expect(await vesting.getVestingEndTime()).to.eq(pastTime)
    })

    it('sets to future time after vesting started', async () => {
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      const newEndTime = vestingEndTime + 10 * DAY_IN_SECONDS
      // Set the current time to be after vesting started
      const newCurrentTime = vestingStartTime + DAY_IN_SECONDS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, newCurrentTime)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(newCurrentTime)
      expect(newCurrentTime).to.be.gt(vestingStartTime)
      expect(newEndTime).to.be.gt(newCurrentTime)

      await vesting.connect(owner).setVestingEndTime(newEndTime)

      expect(await vesting.getVestingEndTime()).to.eq(newEndTime)
    })

    it('sets to past time after vesting started', async () => {
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      const newEndTime = vestingEndTime - 10 * DAY_IN_SECONDS
      // Set the current time to be after vesting started
      const newCurrentTime = vestingEndTime - DAY_IN_SECONDS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, newCurrentTime)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(newCurrentTime)
      expect(newCurrentTime).to.be.gt(vestingStartTime)
      expect(newEndTime).to.be.lt(newCurrentTime)

      await vesting.connect(owner).setVestingEndTime(newEndTime)

      expect(await vesting.getVestingEndTime()).to.eq(newEndTime)
    })

    it('is idempotent', async () => {
      expect(await vesting.getVestingEndTime()).to.not.eq(vestingEndTime)

      await vesting.connect(owner).setVestingEndTime(vestingEndTime)

      expect(await vesting.getVestingEndTime()).to.eq(vestingEndTime)

      await vesting.connect(owner).setVestingEndTime(vestingEndTime)

      expect(await vesting.getVestingEndTime()).to.eq(vestingEndTime)
    })
  })

  describe('# setAllocations', () => {
    let expectedDecrease: BigNumber
    before(() => {
      amountsAllocated = [ONE_ETH, ONE_ETH.mul(2)]
      lowerAllocationAmounts = [amountsAllocated[0].sub(1), amountsAllocated[1].sub(1)]
      higherAllocationAmounts = [amountsAllocated[0].add(1), amountsAllocated[1].add(1)]
      expectedDecrease = ONE.mul(2)
    })

    beforeEach(async () => {
      await setupVesting()
      recipients = [user1.address, user2.address]
      vestingStartTime = (await utils.getLastTimestamp(ethers.provider)) + DAY_IN_SECONDS
      vestingEndTime = vestingStartTime + 3 * YEAR_IN_SECONDS
      timeAfterVestingStarted = vestingStartTime + BLOCK_DURATION_IN_SECONDS
    })

    it('reverts if not owner', async () => {
      expect(await vesting.owner()).to.not.eq(user1.address)

      await expect(
        vesting.connect(user1).setAllocations(recipients, amountsAllocated)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if array length mismatch', async () => {
      expect([user1.address].length).to.not.be.eq(amountsAllocated.length)

      await expect(
        vesting.connect(owner).setAllocations([user1.address], amountsAllocated)
      ).revertedWith('Array length mismatch')
    })

    it('allocates to single recipient', async () => {
      expect(await vesting.getAmountAllocated(user1.address)).to.not.equal(amountsAllocated[0])

      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])

      expect(await vesting.getAmountAllocated(user1.address)).to.eq(amountsAllocated[0])
    })

    it('allocates to multiple recipients', async () => {
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.not.equal(amountsAllocated[i])
      }

      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }
    })

    it('allocates lower amounts to existing recipients', async () => {
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }

      await vesting.connect(owner).setAllocations(recipients, lowerAllocationAmounts)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(lowerAllocationAmounts[i])
        expect(lowerAllocationAmounts[i]).to.be.lt(amountsAllocated[i])
      }
    })

    it('allocates higher amounts to existing recipients', async () => {
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }

      await vesting.connect(owner).setAllocations(recipients, higherAllocationAmounts)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(higherAllocationAmounts[i])
        expect(higherAllocationAmounts[i]).to.be.gt(amountsAllocated[i])
      }
    })

    it('sets allocations to zero', async () => {
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.not.equal(0)
      }
      const zeroAllocations = new Array(amountsAllocated.length).fill(ZERO)

      await vesting.connect(owner).setAllocations(recipients, zeroAllocations)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.equal(0)
      }
    })

    it('increases total allocated supply if allocating new recipients', async () => {
      const totalAllocationBefore = await vesting.getTotalAllocatedSupply()
      let expectedIncrease = ZERO
      for (let i = 0; i < amountsAllocated.length; i++) {
        expectedIncrease = expectedIncrease.add(amountsAllocated[i])
      }

      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)

      const totalAllocationAfter = await vesting.getTotalAllocatedSupply()
      expect(totalAllocationAfter).to.be.eq(totalAllocationBefore.add(expectedIncrease))
      expect(totalAllocationAfter).to.be.not.eq(totalAllocationBefore)
    })

    it('increases total allocated supply if allocating higher amounts to existing recipients', async () => {
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }
      const totalAllocationBefore = await vesting.getTotalAllocatedSupply()
      let expectedIncrease = ZERO
      for (let i = 0; i < amountsAllocated.length; i++) {
        expectedIncrease = expectedIncrease.add(higherAllocationAmounts[i].sub(amountsAllocated[i]))
      }

      await vesting.connect(owner).setAllocations(recipients, higherAllocationAmounts)

      const totalAllocationAfter = await vesting.getTotalAllocatedSupply()
      expect(totalAllocationAfter).to.be.eq(totalAllocationBefore.add(expectedIncrease))
      expect(totalAllocationAfter).to.be.not.eq(totalAllocationBefore)
    })

    it('decreases total allocated supply if allocating lower amounts to existing recipients', async () => {
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }
      const totalAllocationBefore = await vesting.getTotalAllocatedSupply()

      await vesting.connect(owner).setAllocations(recipients, lowerAllocationAmounts)

      const totalAllocationAfter = await vesting.getTotalAllocatedSupply()
      expect(totalAllocationAfter).to.be.eq(totalAllocationBefore.sub(expectedDecrease))
      expect(totalAllocationAfter).to.be.not.eq(totalAllocationBefore)
    })

    it('is idempotent', async () => {
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.not.equal(amountsAllocated[i])
      }

      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }

      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.eq(amountsAllocated[i])
      }
    })

    it('emits Allocation events', async () => {
      for (let i = 0; i < recipients.length; i++) {
        expect(await vesting.getAmountAllocated(recipients[i])).to.not.equal(amountsAllocated[i])
      }

      const tx = await vesting.connect(owner).setAllocations(recipients, amountsAllocated)

      for (let i = 0; i < recipients.length; i++) {
        await expect(tx)
          .to.emit(vesting, 'Allocation(address,uint256)')
          .withArgs(recipients[i], amountsAllocated[i])
      }
    })

    it('allocates lower amount than total claimed', async () => {
      // Setup for setting allocation and claiming.
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      await vesting.connect(owner).setToken(mockERC20Token.address)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // Set time to be after vesting start to be able to claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const lowerAllocationAmount = totalClaimedAfter.sub(1)

      await vesting.connect(owner).setAllocations([user1.address], [lowerAllocationAmount])

      expect(await vesting.getAmountAllocated(user1.address)).to.eq(lowerAllocationAmount)
    })

    it('allocates equal amount to total claimed', async () => {
      // Setup for setting allocation and claiming.
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      await vesting.connect(owner).setToken(mockERC20Token.address)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // Set time to be after vesting start to be able to claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const equalAllocationAmount = await vesting.getClaimedAmount(user1.address)

      await vesting.connect(owner).setAllocations([user1.address], [equalAllocationAmount])

      expect(await vesting.getAmountAllocated(user1.address)).to.eq(equalAllocationAmount)
    })

    it('allocates higher amount than total claimed', async () => {
      // Setup for setting allocation and claiming.
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      await vesting.connect(owner).setToken(mockERC20Token.address)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // Set time to be after vesting start to be able to claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const higherAllocationAmount = (await vesting.getClaimedAmount(user1.address)).add(1)

      await vesting.connect(owner).setAllocations([user1.address], [higherAllocationAmount])

      expect(await vesting.getAmountAllocated(user1.address)).to.eq(higherAllocationAmount)
    })
  })

  describe('# claim', () => {
    beforeEach(async () => {
      await setupVesting()
      mockVestingClaimer = await mockVestingClaimerFixture(vesting.address)
      recipients = [user1.address, user2.address, mockVestingClaimer.address]
      amountsAllocated = [ONE_ETH, ONE_ETH.mul(2), ONE_ETH.mul(3)]
      vestingStartTime = (await utils.getLastTimestamp(ethers.provider)) + DAY_IN_SECONDS
      vestingEndTime = vestingStartTime + 3 * YEAR_IN_SECONDS
      currentTime = await utils.getLastTimestamp(ethers.provider)
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      await vesting.connect(owner).setToken(mockERC20Token.address)
      timeAfterVestingStarted = vestingStartTime + BLOCK_DURATION_IN_SECONDS
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
    })

    it('reverts if paused', async () => {
      await vesting.connect(owner).setPaused(true)
      expect(await vesting.isPaused()).to.be.eq(true)

      await expect(vesting.connect(user1).claim()).revertedWith('Paused')
    })

    it('reverts if unallocated user', async () => {
      expect(await vesting.getAmountAllocated(deployer.address)).to.be.eq(0)

      await expect(vesting.connect(deployer).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if vesting not started', async () => {
      expect(currentTime).to.be.lt(vestingStartTime)
      expect(await vesting.connect(user1).getClaimableAmount(user1.address)).to.be.eq(0)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if allocated amount < already claimed', async () => {
      /**
       * Special cases when allocation for a user is readjusted after it has
       * already been claimed, such that claimed amount >= allocated amount
       * In such case claimable amount will be zero.
       */
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // Set current time to be after vesting started.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // Adjust allocations such that new allocated amount < claimed amount.
      const newAllocation = claimedAmount.sub(1)
      await vesting.connect(owner).setAllocations([user1.address], [newAllocation])
      expect(await vesting.getVestedAmount(user1.address)).to.be.lt(claimedAmount)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if allocated amount = already claimed', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // Set current time to be after vesting started.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // Adjust allocations such that new allocated amount = claimed amount.
      const newAllocation = claimedAmount
      await vesting.connect(owner).setAllocations([user1.address], [newAllocation])
      expect(await vesting.getVestedAmount(user1.address)).to.be.lt(claimedAmount)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if vested amount < already claimed', async () => {
      /**
       * Special case when allocation for a user is readjusted after it has
       * already been claimed, such that vested amount >= allocated amount
       * In such case claimable amount will be zero.
       */
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // Set the current time to be after vesting started and then claim.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // adjust allocations such that new vested amount < claimed amount < newAllocation.
      const newAllocation = amountsAllocated[0].div(2)
      await vesting.connect(owner).setAllocations([user1.address], [newAllocation])
      expect(await vesting.getVestedAmount(user1.address)).to.be.lt(claimedAmount)

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('reverts if insufficient balance in contract', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      const claimableAmount = await vesting.getClaimableAmount(user1.address)
      await mockERC20Token.connect(owner).transfer(vesting.address, claimableAmount.sub(1))

      await expect(vesting.connect(user1).claim()).revertedWith('Insufficient balance in contract')
    })

    it('transfers tokens if still vesting', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
      const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

      await vesting.connect(user1).claim()

      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(user1.address)).to.be.eq(
        userBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).to.be.eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )
    })

    it('transfers tokens if vesting ended', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, vestingEndTime + 1)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(vestingEndTime + 1)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
      const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

      await vesting.connect(user1).claim()

      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(user1.address)).to.be.eq(
        userBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).to.be.eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )
    })

    it('transfers only once if vesting ended', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, vestingEndTime + 1)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(vestingEndTime + 1)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
      const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)
      await vesting.connect(user1).claim()
      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(user1.address)).to.be.eq(
        userBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).to.be.eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )

      await expect(vesting.connect(user1).claim()).revertedWith('Claimable amount = 0')
    })

    it('transfers multiple times if still vesting', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      const numberOfWithdrawals = 2
      const duration = vestingEndTime - vestingStartTime
      const timeBetweenEachWithdrawal = duration / numberOfWithdrawals
      for (let i = 1; i <= numberOfWithdrawals; i++) {
        const withdrawalTime = vestingStartTime + i * timeBetweenEachWithdrawal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mineBlock(ethers.provider as any, withdrawalTime)
        expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(withdrawalTime)
        const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)
        const userBalanceBefore = await mockERC20Token.balanceOf(user1.address)
        const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

        await vesting.connect(user1).claim()

        const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
        const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
        expect(await mockERC20Token.balanceOf(user1.address)).to.be.eq(
          userBalanceBefore.add(expectedChangeInBalance)
        )
        expect(await mockERC20Token.balanceOf(vesting.address)).to.be.eq(
          contractBalanceBefore.sub(expectedChangeInBalance)
        )
      }
    })

    it('transfers to calling contract', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[2])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      const totalClaimedBefore = await vesting.getClaimedAmount(mockVestingClaimer.address)
      const mockVestingClaimerBalanceBefore = await mockERC20Token.balanceOf(
        mockVestingClaimer.address
      )
      const contractBalanceBefore = await mockERC20Token.balanceOf(vesting.address)

      await mockVestingClaimer.claimFunds()

      const totalClaimedAfter = await vesting.getClaimedAmount(mockVestingClaimer.address)
      const expectedChangeInBalance = totalClaimedAfter.sub(totalClaimedBefore)
      expect(await mockERC20Token.balanceOf(mockVestingClaimer.address)).to.be.eq(
        mockVestingClaimerBalanceBefore.add(expectedChangeInBalance)
      )
      expect(await mockERC20Token.balanceOf(vesting.address)).to.be.eq(
        contractBalanceBefore.sub(expectedChangeInBalance)
      )
    })

    it('emits Claim', async () => {
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mineBlock(ethers.provider as any, timeAfterVestingStarted)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.eq(timeAfterVestingStarted)
      const totalClaimedBefore = await vesting.getClaimedAmount(user1.address)

      const tx = await vesting.connect(user1).claim()

      const totalClaimedAfter = await vesting.getClaimedAmount(user1.address)
      const claimedAmount = totalClaimedAfter.sub(totalClaimedBefore)
      await expect(tx)
        .to.emit(vesting, 'Claim(address,uint256)')
        .withArgs(user1.address, claimedAmount)
    })
  })

  describe('# getClaimableAmount', () => {
    before(() => {
      amountsAllocated = [parseEther('1'), parseEther('2')]
      lowerAllocationAmounts = [amountsAllocated[0].sub(1), amountsAllocated[1].sub(1)]
      higherAllocationAmounts = [amountsAllocated[0].add(1), amountsAllocated[1].add(1)]
    })

    beforeEach(async () => {
      await setupVesting()
      recipients = [user1.address, user2.address]
      vestingStartTime = (await utils.getLastTimestamp(ethers.provider)) + DAY_IN_SECONDS
      vestingEndTime = vestingStartTime + 3 * YEAR_IN_SECONDS
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      await vesting.connect(owner).setToken(mockERC20Token.address)
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
    })

    it('returns 0 if unallocated user', async () => {
      expect(await vesting.getAmountAllocated(deployer.address)).to.be.eq(0)

      expect(await vesting.getClaimableAmount(deployer.address)).to.be.eq(0)
    })

    it('returns 0 if vesting not started', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime - 1)
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      expect(await vesting.getClaimedAmount(user1.address)).to.be.eq(0)
      expect(await utils.getLastTimestamp(ethers.provider)).to.be.lt(
        await vesting.getVestingStartTime()
      )

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(0)
    })

    it('returns 0 if amount claimed > allocated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // Adjust allocations such that new allocated amount < claimed amount.
      const newAllocation = claimedAmount.sub(1)
      await vesting.connect(owner).setAllocations([user1.address], [newAllocation])
      expect(claimedAmount).to.be.gt(await vesting.getAmountAllocated(user1.address))

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(0)
    })

    it('returns 0 if amount claimed = allocated', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      await vesting.connect(owner).setAllocations([user1.address], [claimedAmount])
      expect(claimedAmount).to.be.eq(await vesting.getAmountAllocated(user1.address))

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(0)
    })

    it('returns 0 if account claimed after vesting ended', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingEndTime + 1)
      await vesting.connect(user1).claim()

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(0)
    })

    it('returns vested amount if still vesting and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(
        await vesting.getVestedAmount(user1.address)
      )
    })

    it('returns entire allocation if vesting ended and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingEndTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(
        await vesting.getAmountAllocated(user1.address)
      )
    })

    it('returns vested minus claimed amount if still vesting and account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlocks(ethers.provider as any, 1)
      const vestedAmountTillNow = await vesting.getVestedAmount(user1.address)
      const expectedClaimableAmount = vestedAmountTillNow.sub(claimedAmount)

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(expectedClaimableAmount)
    })

    it('returns allocation minus claimed amount if vesting ended after account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      const claimedAmount = await vesting.getClaimedAmount(user1.address)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, vestingEndTime + 1)
      const amountAllocated = await vesting.getAmountAllocated(user1.address)
      const expectedClaimableAmount = amountAllocated.sub(claimedAmount)

      expect(await vesting.getClaimableAmount(user1.address)).to.be.eq(expectedClaimableAmount)
    })
  })

  describe('# getVestedAmount', () => {
    before(() => {
      amountsAllocated = [parseEther('1'), parseEther('2')]
      lowerAllocationAmounts = [amountsAllocated[0].sub(1), amountsAllocated[1].sub(1)]
      higherAllocationAmounts = [amountsAllocated[0].add(1), amountsAllocated[1].add(1)]
    })

    beforeEach(async () => {
      await setupVesting()
      recipients = [user1.address, user2.address]
      vestingStartTime = (await utils.getLastTimestamp(ethers.provider)) + DAY_IN_SECONDS
      vestingEndTime = vestingStartTime + 3 * YEAR_IN_SECONDS
      await vesting.connect(owner).setVestingEndTime(vestingEndTime)
      await vesting.connect(owner).setVestingStartTime(vestingStartTime)
      await vesting.connect(owner).setToken(mockERC20Token.address)
      timeAfterVestingStarted = vestingStartTime + BLOCK_DURATION_IN_SECONDS
      await mockERC20Token.connect(owner).transfer(vesting.address, amountsAllocated[0])
    })

    it('returns 0 if unallocated user', async () => {
      expect(await vesting.getAmountAllocated(deployer.address)).to.be.eq(0)

      expect(await vesting.getVestedAmount(deployer.address)).to.be.eq(0)
    })

    it('returns 0 if vesting not started', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime - 1)
      await vesting.connect(owner).setAllocations(recipients, amountsAllocated)
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)

      expect(await vesting.getVestedAmount(user1.address)).to.be.eq(0)
    })

    it('returns vesting amount if still vesting and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      const vestedAmountTillNow = await vesting.getVestedAmount(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).to.be.eq(vestedAmountTillNow)
    })

    it('returns entire allocation if vesting ended and account never claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingEndTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)

      expect(await vesting.getVestedAmount(user1.address)).to.be.eq(
        await vesting.getAmountAllocated(user1.address)
      )
    })

    it('returns vesting amount if still vesting and account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlocks(ethers.provider as any, 1)
      const vestedAmountTillNow = await vesting.getVestedAmount(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).to.be.eq(vestedAmountTillNow)
    })

    it('returns entire allocation if vesting ended after account claimed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingStartTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await mineBlock(ethers.provider as any, vestingEndTime + 1)
      const amountAllocated = await vesting.getAmountAllocated(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).to.be.eq(amountAllocated)
    })

    it('returns entire allocation if account claimed after vesting ended', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await utils.setNextTimestamp(ethers.provider as any, vestingEndTime + 1)
      await vesting.connect(owner).setAllocations([user1.address], [amountsAllocated[0]])
      expect(await vesting.getAmountAllocated(user1.address)).to.be.gt(0)
      await vesting.connect(user1).claim()
      const amountAllocated = await vesting.getAmountAllocated(user1.address)

      expect(await vesting.getVestedAmount(user1.address)).to.be.eq(amountAllocated)
    })
  })

  describe('# withdrawERC20 (amounts)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await setupVesting()
    })

    it("doesn't revert", async () => {
      await expect(
        vesting.connect(owner)['withdrawERC20(address[],uint256[])']([mockERC20Token.address], [0])
      ).not.reverted
    })
  })

  describe('# withdrawERC20 (full balance)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await setupVesting()
    })

    it("doesn't revert", async () => {
      await expect(vesting.connect(owner)['withdrawERC20(address[])']([mockERC20Token.address])).not
        .reverted
    })
  })
})
