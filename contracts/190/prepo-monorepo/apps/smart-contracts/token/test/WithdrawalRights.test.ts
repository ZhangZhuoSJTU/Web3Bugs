import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { withdrawalRightsFixture } from './fixtures/PPOStakingFixtures'
import { WithdrawalRights } from '../types/generated'

describe('WithdrawalRights', () => {
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let ppoStaking: SignerWithAddress
  let withdrawalRights: WithdrawalRights
  const testURI = 'https://newBaseURI/'

  const setupAccounts = async (): Promise<void> => {
    ;[deployer, governance, user1, user2, ppoStaking] = await ethers.getSigners()
  }

  const deployWithdrawalRights = async (): Promise<void> => {
    withdrawalRights = await withdrawalRightsFixture()
  }

  const setupWithdrawalRights = async (): Promise<void> => {
    await deployWithdrawalRights()
    await withdrawalRights.connect(deployer).transferOwnership(governance.address)
    await withdrawalRights.connect(governance).acceptOwnership()
  }

  describe('initial state', () => {
    before(async () => {
      await setupAccounts()
      await deployWithdrawalRights()
    })

    it("sets name to 'Staked PPO Withdrawal Rights'", async () => {
      expect(await withdrawalRights.name()).to.eq('Staked PPO Withdrawal Rights')
    })

    it("sets symbol to 'stkPPO-WR'", async () => {
      expect(await withdrawalRights.symbol()).to.eq('stkPPO-WR')
    })

    it('sets nominee to zero address', async () => {
      expect(await withdrawalRights.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await withdrawalRights.owner()).to.eq(deployer.address)
    })
  })

  describe('# setURI', () => {
    beforeEach(async () => {
      await setupAccounts()
      await setupWithdrawalRights()
    })

    it('reverts if not owner', async () => {
      expect(await withdrawalRights.owner()).to.not.eq(user1.address)

      await expect(withdrawalRights.connect(user1).setURI(testURI)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-empty string', async () => {
      expect(await withdrawalRights.tokenURI(0)).to.not.eq(testURI)

      await withdrawalRights.connect(governance).setURI(testURI)

      expect(await withdrawalRights.tokenURI(0)).to.eq(testURI)
    })

    it('sets to empty string', async () => {
      await withdrawalRights.connect(governance).setURI(testURI)
      expect(await withdrawalRights.tokenURI(0)).to.not.eq('')

      await withdrawalRights.connect(governance).setURI('')

      expect(await withdrawalRights.tokenURI(0)).to.eq('')
    })

    it('is idempotent', async () => {
      expect(await withdrawalRights.tokenURI(0)).to.not.eq(testURI)

      await withdrawalRights.connect(governance).setURI(testURI)

      expect(await withdrawalRights.tokenURI(0)).to.eq(testURI)

      await withdrawalRights.connect(governance).setURI(testURI)

      expect(await withdrawalRights.tokenURI(0)).to.eq(testURI)
    })
  })

  describe('# setPPOStaking', () => {
    beforeEach(async () => {
      await setupAccounts()
      await setupWithdrawalRights()
    })

    it('reverts if not owner', async () => {
      expect(await withdrawalRights.owner()).to.not.eq(user1.address)

      await expect(withdrawalRights.connect(user1).setPPOStaking(ppoStaking.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await withdrawalRights.getPPOStaking()).to.not.eq(ppoStaking.address)

      await withdrawalRights.connect(governance).setPPOStaking(ppoStaking.address)

      expect(await withdrawalRights.getPPOStaking()).to.eq(ppoStaking.address)
    })

    it('sets to zero address', async () => {
      await withdrawalRights.connect(governance).setPPOStaking(ppoStaking.address)
      expect(await withdrawalRights.getPPOStaking()).to.not.eq(ZERO_ADDRESS)

      await withdrawalRights.connect(governance).setPPOStaking(ZERO_ADDRESS)

      expect(await withdrawalRights.getPPOStaking()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await withdrawalRights.getPPOStaking()).to.not.eq(ppoStaking.address)

      await withdrawalRights.connect(governance).setPPOStaking(ppoStaking.address)

      expect(await withdrawalRights.getPPOStaking()).to.eq(ppoStaking.address)

      await withdrawalRights.connect(governance).setPPOStaking(ppoStaking.address)

      expect(await withdrawalRights.getPPOStaking()).to.eq(ppoStaking.address)
    })
  })

  describe('# mint', () => {
    beforeEach(async () => {
      await setupAccounts()
      await setupWithdrawalRights()
      await withdrawalRights.connect(governance).setPPOStaking(ppoStaking.address)
    })

    it('reverts if not PPOStaking', async () => {
      expect(await withdrawalRights.getPPOStaking()).to.not.eq(user1.address)

      await expect(withdrawalRights.connect(user1).mint(user1.address)).revertedWith(
        'msg.sender != PPOStaking'
      )
    })

    it("increments recipient's balance by 1", async () => {
      const user1BalanceBefore = await withdrawalRights.balanceOf(user1.address)

      await withdrawalRights.connect(ppoStaking).mint(user1.address)

      expect(await withdrawalRights.balanceOf(user1.address)).to.eq(user1BalanceBefore.add(1))
    })

    it('sets tokenId owner to recipient', async () => {
      await expect(withdrawalRights.ownerOf(0)).to.be.revertedWith('ERC721: invalid token ID')

      await withdrawalRights.connect(ppoStaking).mint(user1.address)

      expect(await withdrawalRights.ownerOf(0)).to.eq(user1.address)
    })
  })
})
