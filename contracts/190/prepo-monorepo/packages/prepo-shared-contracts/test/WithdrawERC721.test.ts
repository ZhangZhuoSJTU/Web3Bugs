import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { withdrawERC721Fixture } from './fixtures/WithdrawERC721Fixture'
import { WithdrawERC721 } from '../types/generated'
import { MockContract, smock } from '@defi-wonderland/smock'
import { Contract } from 'ethers'

describe('WithdrawERC721', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let withdrawERC721: WithdrawERC721
  let firstMockERC721: MockContract<Contract>
  let secondMockERC721: MockContract<Contract>
  const ERC721IdArray = [1, 2]

  const setupWithdrawERC721 = async (): Promise<void> => {
    ;[deployer, user1] = await ethers.getSigners()
    owner = deployer
    withdrawERC721 = await withdrawERC721Fixture()
  }

  const setupWithdrawERC721AndMockERC721 = async (): Promise<void> => {
    await setupWithdrawERC721()
    const mockERC721Factory = await smock.mock('ERC721Mintable')
    firstMockERC721 = await mockERC721Factory.deploy('firstMockERC721', 'MERC721F')
    await firstMockERC721.connect(owner).mint(withdrawERC721.address, ERC721IdArray[0])
    secondMockERC721 = await mockERC721Factory.deploy('secondMockERC721', 'MERC721S')
    await secondMockERC721.connect(owner).mint(withdrawERC721.address, ERC721IdArray[1])
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupWithdrawERC721()
    })

    it('sets owner to deployer', async () => {
      expect(await withdrawERC721.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await withdrawERC721.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  //TODO: add tests and modify current ones for Recipient Array inclusion
  describe('# withdrawERC721', async () => {
    let ERC721ContractArray: string[]
    let RecipientsArray: string[]
    beforeEach(async () => {
      await setupWithdrawERC721AndMockERC721()
      ERC721ContractArray = [firstMockERC721.address, secondMockERC721.address]
      RecipientsArray = [owner.address, owner.address]
    })

    it('reverts if not owner', async () => {
      expect(await withdrawERC721.owner()).to.not.eq(user1.address)

      await expect(
        withdrawERC721
          .connect(user1)
          .withdrawERC721(ERC721ContractArray, RecipientsArray, ERC721IdArray)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if array length mismatch', async () => {
      expect([firstMockERC721].length).to.not.eq(ERC721IdArray.length)

      await expect(
        withdrawERC721
          .connect(owner)
          .withdrawERC721([firstMockERC721.address], RecipientsArray, ERC721IdArray)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if token id not owned by contract', async () => {
      const idNotOwnedByContract = 2
      await firstMockERC721.connect(owner).mint(user1.address, idNotOwnedByContract)
      expect(await firstMockERC721.ownerOf(idNotOwnedByContract)).to.not.eq(withdrawERC721.address)

      await expect(
        withdrawERC721
          .connect(owner)
          .withdrawERC721([firstMockERC721.address], [owner.address], [idNotOwnedByContract])
      ).revertedWith('ERC721: caller is not token owner nor approved')
    })

    it('withdraws single ERC721 token', async () => {
      const contractFirstERC721BalanceBefore = await firstMockERC721.balanceOf(
        withdrawERC721.address
      )
      const ownerFirstERC721BalanceBefore = await firstMockERC721.balanceOf(owner.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.eq(withdrawERC721.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.not.eq(owner.address)

      await withdrawERC721
        .connect(owner)
        .withdrawERC721([firstMockERC721.address], [RecipientsArray[0]], [ERC721IdArray[0]])

      expect(await firstMockERC721.balanceOf(owner.address)).to.be.equal(
        ownerFirstERC721BalanceBefore.add(1)
      )
      expect(await firstMockERC721.balanceOf(withdrawERC721.address)).to.be.equal(
        contractFirstERC721BalanceBefore.sub(1)
      )
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.eq(owner.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.not.eq(withdrawERC721.address)
    })

    it('withdraws different ids of same contract', async () => {
      await firstMockERC721.connect(owner).mint(withdrawERC721.address, ERC721IdArray[1])
      const contractFirstERC721BalanceBefore = await firstMockERC721.balanceOf(
        withdrawERC721.address
      )
      const ownerFirstERC721BalanceBefore = await firstMockERC721.balanceOf(owner.address)
      expect(ERC721IdArray[0]).to.not.eq(ERC721IdArray[1])
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.eq(withdrawERC721.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.not.eq(owner.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[1])).to.eq(withdrawERC721.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[1])).to.not.eq(owner.address)

      await withdrawERC721
        .connect(owner)
        .withdrawERC721(
          [firstMockERC721.address, firstMockERC721.address],
          RecipientsArray,
          ERC721IdArray
        )

      expect(await firstMockERC721.balanceOf(owner.address)).to.be.equal(
        ownerFirstERC721BalanceBefore.add(2)
      )
      expect(await firstMockERC721.balanceOf(withdrawERC721.address)).to.be.equal(
        contractFirstERC721BalanceBefore.sub(2)
      )
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.eq(owner.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.not.eq(withdrawERC721.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[1])).to.eq(owner.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[1])).to.not.eq(withdrawERC721.address)
    })

    it('withdraws different ids of multiple contracts', async () => {
      const contractFirstERC721BalanceBefore = await firstMockERC721.balanceOf(
        withdrawERC721.address
      )
      const ownerFirstERC721BalanceBefore = await firstMockERC721.balanceOf(owner.address)
      const contractSecondERC721BalanceBefore = await secondMockERC721.balanceOf(
        withdrawERC721.address
      )
      const ownerSecondERC721BalanceBefore = await secondMockERC721.balanceOf(owner.address)
      expect(ERC721IdArray[0]).to.not.eq(ERC721IdArray[1])
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.eq(withdrawERC721.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.not.eq(owner.address)
      expect(await secondMockERC721.ownerOf(ERC721IdArray[1])).to.eq(withdrawERC721.address)
      expect(await secondMockERC721.ownerOf(ERC721IdArray[1])).to.not.eq(owner.address)

      await withdrawERC721
        .connect(owner)
        .withdrawERC721(ERC721ContractArray, RecipientsArray, ERC721IdArray)

      expect(await firstMockERC721.balanceOf(owner.address)).to.be.equal(
        ownerFirstERC721BalanceBefore.add(1)
      )
      expect(await firstMockERC721.balanceOf(withdrawERC721.address)).to.be.equal(
        contractFirstERC721BalanceBefore.sub(1)
      )
      expect(await secondMockERC721.balanceOf(owner.address)).to.be.equal(
        ownerSecondERC721BalanceBefore.add(1)
      )
      expect(await secondMockERC721.balanceOf(withdrawERC721.address)).to.be.equal(
        contractSecondERC721BalanceBefore.sub(1)
      )
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.eq(owner.address)
      expect(await firstMockERC721.ownerOf(ERC721IdArray[0])).to.not.eq(withdrawERC721.address)
      expect(await secondMockERC721.ownerOf(ERC721IdArray[1])).to.eq(owner.address)
      expect(await secondMockERC721.ownerOf(ERC721IdArray[1])).to.not.eq(withdrawERC721.address)
    })
  })
})
