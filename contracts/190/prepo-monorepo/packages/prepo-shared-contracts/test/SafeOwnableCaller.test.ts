import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { safeOwnableCallerTestFixture } from './fixtures/SafeOwnableCallerFixture'
import { SafeOwnableCallerTest } from '../types/generated'
import { MockContract, smock } from '@defi-wonderland/smock'
import { Contract } from 'ethers'
import { ZERO_ADDRESS } from 'prepo-constants'

chai.use(smock.matchers)

describe('SafeOwnableCallerTest', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let safeOwnableCaller: SafeOwnableCallerTest
  let mockOwnedContract: MockContract<Contract>

  const setupSafeOwnableCallerTest = async (): Promise<void> => {
    ;[deployer, user1] = await ethers.getSigners()
    owner = deployer
    safeOwnableCaller = await safeOwnableCallerTestFixture()
  }

  const setupSafeOwnableCallerAndMockContract = async (): Promise<void> => {
    await setupSafeOwnableCallerTest()
    const mockOwnedContractFactory = await smock.mock('SafeOwnable')
    mockOwnedContract = await mockOwnedContractFactory.deploy()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupSafeOwnableCallerTest()
    })

    it('sets owner to deployer', async () => {
      expect(await safeOwnableCaller.owner()).to.eq(deployer.address)
    })
  })

  describe('# transferOwnership', () => {
    beforeEach(async () => {
      await setupSafeOwnableCallerAndMockContract()
      await mockOwnedContract.connect(owner).transferOwnership(safeOwnableCaller.address)
      await safeOwnableCaller.connect(owner)['acceptOwnership(address)'](mockOwnedContract.address)
    })

    it('reverts if not owner', async () => {
      expect(await safeOwnableCaller.owner()).to.not.eq(user1.address)

      await expect(
        safeOwnableCaller
          .connect(user1)
          ['transferOwnership(address,address)'](mockOwnedContract.address, user1.address)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it("reverts if contract's transferOwnership reverts", async () => {
      mockOwnedContract.transferOwnership.reverts()

      await expect(
        safeOwnableCaller
          .connect(owner)
          ['transferOwnership(address,address)'](mockOwnedContract.address, user1.address)
      ).to.be.reverted
      expect(mockOwnedContract.transferOwnership).to.have.been.called
    })

    it("succeeds if contract's transferOwnership doesn't revert", async () => {
      await safeOwnableCaller
        .connect(owner)
        ['transferOwnership(address,address)'](mockOwnedContract.address, user1.address)

      expect(mockOwnedContract.transferOwnership).to.not.have.been.reverted
      expect(mockOwnedContract.transferOwnership).to.have.been.called
    })

    it('calls transferOwnership of contract with correct parameters', async () => {
      await safeOwnableCaller
        .connect(owner)
        ['transferOwnership(address,address)'](mockOwnedContract.address, user1.address)

      expect(mockOwnedContract.transferOwnership).to.have.been.calledWith(user1.address)
    })
  })

  describe('# acceptOwnership', () => {
    beforeEach(async () => {
      await setupSafeOwnableCallerAndMockContract()
      await mockOwnedContract.connect(owner).transferOwnership(safeOwnableCaller.address)
    })

    it('reverts if not owner', async () => {
      expect(await safeOwnableCaller.owner()).to.not.eq(user1.address)

      await expect(
        safeOwnableCaller.connect(user1)['acceptOwnership(address)'](mockOwnedContract.address)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it("reverts if contract's acceptOwnership reverts", async () => {
      mockOwnedContract.acceptOwnership.reverts()

      await expect(
        safeOwnableCaller.connect(owner)['acceptOwnership(address)'](mockOwnedContract.address)
      ).to.be.reverted
      expect(mockOwnedContract.acceptOwnership).to.have.been.called
    })

    it("succeeds if contract's acceptOwnership doesn't revert", async () => {
      await safeOwnableCaller.connect(owner)['acceptOwnership(address)'](mockOwnedContract.address)

      expect(mockOwnedContract.acceptOwnership).to.not.have.been.reverted
      expect(mockOwnedContract.acceptOwnership).to.have.been.called
    })

    it('calls acceptOwnership of contract with correct parameters', async () => {
      await safeOwnableCaller.connect(owner)['acceptOwnership(address)'](mockOwnedContract.address)

      expect(mockOwnedContract.acceptOwnership).to.have.been.calledWith()
    })
  })

  describe('# renounceOwnership', () => {
    beforeEach(async () => {
      await setupSafeOwnableCallerAndMockContract()
      await mockOwnedContract.connect(owner).transferOwnership(safeOwnableCaller.address)
      await safeOwnableCaller.connect(owner)['acceptOwnership(address)'](mockOwnedContract.address)
    })

    it('reverts if not owner', async () => {
      expect(await safeOwnableCaller.owner()).to.not.eq(user1.address)

      await expect(
        safeOwnableCaller.connect(user1)['renounceOwnership(address)'](mockOwnedContract.address)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it("reverts if contract's renounceOwnership reverts", async () => {
      mockOwnedContract.renounceOwnership.reverts()

      await expect(
        safeOwnableCaller.connect(owner)['renounceOwnership(address)'](mockOwnedContract.address)
      ).to.be.reverted
      expect(mockOwnedContract.renounceOwnership).to.have.been.called
    })

    it("succeeds if contract's renounceOwnership doesn't revert", async () => {
      await safeOwnableCaller
        .connect(owner)
        ['renounceOwnership(address)'](mockOwnedContract.address)

      expect(mockOwnedContract.renounceOwnership).to.not.have.been.reverted
      expect(mockOwnedContract.renounceOwnership).to.have.been.called
    })

    it('calls renounceOwnership of contract with correct parameters', async () => {
      await safeOwnableCaller
        .connect(owner)
        ['renounceOwnership(address)'](mockOwnedContract.address)

      expect(mockOwnedContract.renounceOwnership).to.have.been.calledWith()
    })
  })
})
