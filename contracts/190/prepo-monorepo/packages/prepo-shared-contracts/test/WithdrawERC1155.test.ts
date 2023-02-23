import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { withdrawERC1155Fixture } from './fixtures/WithdrawERC1155Fixture'
import { WithdrawERC1155 } from '../types/generated'
import { MockContract, smock } from '@defi-wonderland/smock'
import { parseEther } from 'ethers/lib/utils'
import { Contract } from 'ethers'

describe('WithdrawERC1155', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let withdrawERC1155: WithdrawERC1155
  let firstMockERC1155: MockContract<Contract>
  let secondMockERC1155: MockContract<Contract>
  const ERC1155IdArray = [1, 2]
  const ERC1155AmountArray = [parseEther('1'), parseEther('2')]

  const setupWithdrawERC1155 = async (): Promise<void> => {
    ;[deployer, user1, user2] = await ethers.getSigners()
    owner = deployer
    withdrawERC1155 = await withdrawERC1155Fixture()
  }

  const setupWithdrawERC1155AndMockERC1155 = async (): Promise<void> => {
    await setupWithdrawERC1155()
    const mockERC1155Factory = await smock.mock('ERC1155Mintable')
    firstMockERC1155 = await mockERC1155Factory.deploy('firstMockURI')
    await firstMockERC1155
      .connect(owner)
      .mint(withdrawERC1155.address, ERC1155IdArray[0], ERC1155AmountArray[0])
    secondMockERC1155 = await mockERC1155Factory.deploy('secondMockURI')
    await secondMockERC1155
      .connect(owner)
      .mint(withdrawERC1155.address, ERC1155IdArray[1], ERC1155AmountArray[1])
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupWithdrawERC1155()
    })

    it('sets owner to deployer', async () => {
      expect(await withdrawERC1155.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await withdrawERC1155.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  //TODO: add tests of Recipients inclusion and modify current tests
  describe('# withdrawERC1155', async () => {
    let ERC1155ContractArray: string[]
    let RecipientsArray: string[]
    beforeEach(async () => {
      await setupWithdrawERC1155AndMockERC1155()
      ERC1155ContractArray = [firstMockERC1155.address, secondMockERC1155.address]
      RecipientsArray = [owner.address, owner.address]
    })

    it('reverts if not owner', async () => {
      expect(await withdrawERC1155.owner()).to.not.eq(user1.address)

      await expect(
        withdrawERC1155
          .connect(user1)
          .withdrawERC1155(
            ERC1155ContractArray,
            RecipientsArray,
            ERC1155IdArray,
            ERC1155AmountArray
          )
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if token contract array length mismatch', async () => {
      const mismatchedContractArray = ERC1155ContractArray.slice(0, 1)
      expect(mismatchedContractArray.length).to.not.eq(ERC1155IdArray.length)
      expect(ERC1155IdArray.length).to.eq(ERC1155AmountArray.length)

      await expect(
        withdrawERC1155
          .connect(owner)
          .withdrawERC1155(
            mismatchedContractArray,
            RecipientsArray,
            ERC1155IdArray,
            ERC1155AmountArray
          )
      ).revertedWith('Array length mismatch')
    })

    it('reverts if token id array length mismatch', async () => {
      const mismatchedTokenIdArray = ERC1155IdArray.slice(0, 1)
      expect(mismatchedTokenIdArray.length).to.not.eq(ERC1155AmountArray)
      expect(ERC1155AmountArray.length).to.eq(ERC1155ContractArray.length)

      await expect(
        withdrawERC1155
          .connect(owner)
          .withdrawERC1155(
            ERC1155ContractArray,
            RecipientsArray,
            mismatchedTokenIdArray,
            ERC1155AmountArray
          )
      ).revertedWith('Array length mismatch')
    })

    it('reverts if token amount array length mismatch', async () => {
      const mismatchedAmountArray = ERC1155AmountArray.slice(0, 1)
      expect(mismatchedAmountArray.length).to.not.eq(ERC1155IdArray.length)
      expect(ERC1155IdArray.length).to.eq(ERC1155ContractArray.length)

      await expect(
        withdrawERC1155
          .connect(owner)
          .withdrawERC1155(
            ERC1155ContractArray,
            RecipientsArray,
            ERC1155IdArray,
            mismatchedAmountArray
          )
      ).revertedWith('Array length mismatch')
    })

    it('reverts if amount > balance', async () => {
      const contractERC1155Balance = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )

      await expect(
        withdrawERC1155
          .connect(owner)
          .withdrawERC1155(
            [firstMockERC1155.address],
            [RecipientsArray[0]],
            [ERC1155IdArray[0]],
            [contractERC1155Balance.add(1)]
          )
      ).revertedWith('ERC1155: insufficient balance for transfer')
    })

    it('succeeds if amount = 0', async () => {
      const contractFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )
      const ownerFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[0]
      )
      expect(contractFirstERC1155BalanceBefore).to.not.eq(0)

      await withdrawERC1155
        .connect(owner)
        .withdrawERC1155([firstMockERC1155.address], [RecipientsArray[0]], [ERC1155IdArray[0]], [0])

      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[0])).to.eq(
        contractFirstERC1155BalanceBefore
      )
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[0])).to.eq(
        ownerFirstERC1155BalanceBefore
      )
    })

    it('withdraws if amount = contract balance', async () => {
      const contractFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )
      const ownerFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[0]
      )
      expect(contractFirstERC1155BalanceBefore).to.not.eq(0)

      await withdrawERC1155
        .connect(owner)
        .withdrawERC1155(
          [firstMockERC1155.address],
          [RecipientsArray[0]],
          [ERC1155IdArray[0]],
          [contractFirstERC1155BalanceBefore]
        )

      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[0])).to.eq(0)
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[0])).to.eq(
        ownerFirstERC1155BalanceBefore.add(contractFirstERC1155BalanceBefore)
      )
    })

    it('withdraws if amount < contract balance', async () => {
      const contractFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )
      const ownerFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[0]
      )
      expect(contractFirstERC1155BalanceBefore).to.not.eq(0)

      await withdrawERC1155
        .connect(owner)
        .withdrawERC1155(
          [firstMockERC1155.address],
          [RecipientsArray[0]],
          [ERC1155IdArray[0]],
          [contractFirstERC1155BalanceBefore.sub(1)]
        )

      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[0])).to.eq(1)
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[0])).to.eq(
        ownerFirstERC1155BalanceBefore.add(contractFirstERC1155BalanceBefore.sub(1))
      )
    })

    it('withdraws different amounts of same id of same contract', async () => {
      await firstMockERC1155
        .connect(owner)
        .mint(withdrawERC1155.address, ERC1155IdArray[0], ERC1155AmountArray[1])
      const contractFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )
      const ownerFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[0]
      )
      expect(contractFirstERC1155BalanceBefore).to.not.eq(0)
      expect(ERC1155AmountArray[0]).to.not.eq(ERC1155AmountArray[1])

      await withdrawERC1155
        .connect(owner)
        .withdrawERC1155(
          [firstMockERC1155.address, firstMockERC1155.address],
          RecipientsArray,
          [ERC1155IdArray[0], ERC1155IdArray[0]],
          ERC1155AmountArray
        )

      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[0])).to.eq(
        contractFirstERC1155BalanceBefore.sub(ERC1155AmountArray[0].add(ERC1155AmountArray[1]))
      )
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[0])).to.eq(
        ownerFirstERC1155BalanceBefore.add(ERC1155AmountArray[0].add(ERC1155AmountArray[1]))
      )
    })

    it('withdraws different amounts of multiple ids of same contract', async () => {
      await firstMockERC1155
        .connect(owner)
        .mint(withdrawERC1155.address, ERC1155IdArray[1], ERC1155AmountArray[1])
      const contractFirstERC1155Id1BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )
      const ownerFirstERC1155Id1BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[0]
      )
      const contractFirstERC1155Id2BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[1]
      )
      const ownerFirstERC1155Id2BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[1]
      )
      expect(contractFirstERC1155Id1BalanceBefore).to.not.eq(0)
      expect(contractFirstERC1155Id2BalanceBefore).to.not.eq(0)
      expect(ERC1155AmountArray[0]).to.not.eq(ERC1155AmountArray[1])
      expect(ERC1155IdArray[0]).to.not.eq(ERC1155IdArray[1])

      await withdrawERC1155
        .connect(owner)
        .withdrawERC1155(
          [firstMockERC1155.address, firstMockERC1155.address],
          RecipientsArray,
          ERC1155IdArray,
          ERC1155AmountArray
        )

      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[0])).to.eq(
        contractFirstERC1155Id1BalanceBefore.sub(ERC1155AmountArray[0])
      )
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[0])).to.eq(
        ownerFirstERC1155Id1BalanceBefore.add(ERC1155AmountArray[0])
      )
      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[1])).to.eq(
        contractFirstERC1155Id2BalanceBefore.sub(ERC1155AmountArray[1])
      )
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[1])).to.eq(
        ownerFirstERC1155Id2BalanceBefore.add(ERC1155AmountArray[1])
      )
    })

    it('withdraws different amounts of multiple ids of different contracts', async () => {
      const contractFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[0]
      )
      const ownerFirstERC1155BalanceBefore = await firstMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[0]
      )
      const contractSecondERC1155BalanceBefore = await secondMockERC1155.balanceOf(
        withdrawERC1155.address,
        ERC1155IdArray[1]
      )
      const ownerSecondERC1155BalanceBefore = await secondMockERC1155.balanceOf(
        owner.address,
        ERC1155IdArray[1]
      )
      expect(contractFirstERC1155BalanceBefore).to.not.eq(0)
      expect(contractSecondERC1155BalanceBefore).to.not.eq(0)

      await withdrawERC1155
        .connect(owner)
        .withdrawERC1155(ERC1155ContractArray, RecipientsArray, ERC1155IdArray, ERC1155AmountArray)

      expect(await firstMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[0])).to.eq(
        contractFirstERC1155BalanceBefore.sub(ERC1155AmountArray[0])
      )
      expect(await firstMockERC1155.balanceOf(owner.address, ERC1155IdArray[0])).to.eq(
        ownerFirstERC1155BalanceBefore.add(ERC1155AmountArray[0])
      )
      expect(await secondMockERC1155.balanceOf(withdrawERC1155.address, ERC1155IdArray[1])).to.eq(
        contractSecondERC1155BalanceBefore.sub(ERC1155AmountArray[1])
      )
      expect(await secondMockERC1155.balanceOf(owner.address, ERC1155IdArray[1])).to.eq(
        ownerSecondERC1155BalanceBefore.add(ERC1155AmountArray[1])
      )
    })
  })

  describe('# onERC1155Received', () => {
    beforeEach(async () => {
      await setupWithdrawERC1155AndMockERC1155()
    })

    it('is compliant with ERC1155 safeTransferFrom() requirements', async () => {
      //Since id = 1 is already minted in beforeEach
      await firstMockERC1155.mint(user1.address, ERC1155IdArray[1], ERC1155AmountArray[1])

      await expect(
        firstMockERC1155
          .connect(user1)
          .safeTransferFrom(
            user1.address,
            withdrawERC1155.address,
            ERC1155IdArray[1],
            ERC1155AmountArray[1],
            []
          )
      ).not.reverted
    })
  })

  describe('# onERC1155BatchReceived', () => {
    beforeEach(async () => {
      await setupWithdrawERC1155AndMockERC1155()
    })

    it('is compliant with ERC1155 safeBatchTransferFrom() requirements', async () => {
      //Since id = 1 is already minted in beforeEach
      await firstMockERC1155.mint(user1.address, ERC1155IdArray[1], ERC1155AmountArray[1])

      await expect(
        firstMockERC1155
          .connect(user1)
          .safeBatchTransferFrom(
            user1.address,
            withdrawERC1155.address,
            [ERC1155IdArray[1]],
            [ERC1155AmountArray[1]],
            []
          )
      ).not.reverted
    })
  })
})
