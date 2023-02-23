/* eslint-disable no-await-in-loop */
import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MockContract, smock } from '@defi-wonderland/smock'
import { parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { purchaseHookFixture } from './fixtures/TokenShopFixtures'
import { mockERC20Fixture } from './fixtures/MockERC20Fixtures'
import { ZERO, MAX_UINT256 } from '../utils'
import { MockERC20 } from '../types/generated'
import { PurchaseHook } from '../types/generated/contracts/token-shop/PurchaseHook'

chai.use(smock.matchers)

describe('PurchaseHook', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let purchaseHook: PurchaseHook
  let tokenContracts: string[]
  let firstERC721: MockContract<Contract>
  let secondERC721: MockContract<Contract>
  let firstERC1155: MockContract<Contract>
  let secondERC1155: MockContract<Contract>
  let tokenShop: MockContract<Contract>
  let paymentToken: MockERC20

  const setupPurchaseHook = async (): Promise<void> => {
    ;[deployer, user1] = await ethers.getSigners()
    owner = deployer
    purchaseHook = await purchaseHookFixture()
  }

  const setupMockERC721Contracts = async (): Promise<void> => {
    const mockERC721Factory = await smock.mock('ERC721Mintable')
    firstERC721 = await mockERC721Factory.deploy('first mock ERC721', 'fmERC721')
    secondERC721 = await mockERC721Factory.deploy('second mock ERC721', 'smERC721')
  }

  const setupMockERC1155Contracts = async (): Promise<void> => {
    const mockERC1155Factory = await smock.mock('ERC1155Mintable')
    firstERC1155 = await mockERC1155Factory.deploy('mockURI1')
    secondERC1155 = await mockERC1155Factory.deploy('mockURI2')
  }

  const setupMockTokenShop = async (): Promise<void> => {
    const mockERC20Recipient = owner.address
    const mockERC20Decimals = 18
    const mockERC20InitialSupply = parseEther('100')
    paymentToken = await mockERC20Fixture(
      'Payment Token',
      'PT',
      mockERC20Decimals,
      mockERC20Recipient,
      mockERC20InitialSupply
    )
    const tokenShopFactory = await smock.mock('TokenShop')
    tokenShop = await tokenShopFactory.deploy(paymentToken.address)
  }

  describe('initial state', () => {
    before(async () => {
      await setupPurchaseHook()
    })

    it('sets owner to deployer', async () => {
      expect(await purchaseHook.owner()).to.eq(owner.address)
    })
  })

  describe('# setMaxERC721PurchasesPerUser', () => {
    const maxAmounts = [1, 2]

    beforeEach(async () => {
      await setupPurchaseHook()
      await setupMockERC721Contracts()
      tokenContracts = [secondERC721.address, firstERC721.address]
    })

    it('reverts if not owner', async () => {
      expect(await purchaseHook.owner()).to.not.eq(user1.address)

      await expect(
        purchaseHook.connect(user1).setMaxERC721PurchasesPerUser(tokenContracts, maxAmounts)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if array length mismatch', async () => {
      const mismatchedContractArray = tokenContracts.slice(0, 1)
      expect(mismatchedContractArray.length).to.not.eq(maxAmounts.length)

      await expect(
        purchaseHook
          .connect(owner)
          .setMaxERC721PurchasesPerUser(mismatchedContractArray, maxAmounts)
      ).revertedWith('Array length mismatch')
    })

    it('sets amount to non-zero for single item', async () => {
      const contract = tokenContracts[0]
      const maxAmount = maxAmounts[0]
      expect(maxAmount).to.not.eq(ZERO)
      expect(await purchaseHook.getMaxERC721PurchasesPerUser(contract)).to.not.eq(maxAmount)

      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([contract], [maxAmount])

      expect(await purchaseHook.getMaxERC721PurchasesPerUser(contract)).to.eq(maxAmount)
    })

    it('sets amount to non-zero for multiple items', async () => {
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(maxAmounts[i]).to.not.eq(ZERO)
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.not.eq(
          maxAmounts[i]
        )
      }

      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser(tokenContracts, maxAmounts)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.eq(
          maxAmounts[i]
        )
      }
    })

    it('sets amount to zero for single item', async () => {
      const contract = tokenContracts[0]
      const maxAmount = maxAmounts[0]
      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([contract], [maxAmount])
      expect(await purchaseHook.getMaxERC721PurchasesPerUser(contract)).to.not.eq(ZERO)

      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([contract], [ZERO])

      expect(await purchaseHook.getMaxERC721PurchasesPerUser(contract)).to.eq(ZERO)
    })

    it('sets amount to zero for multiple items', async () => {
      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser(tokenContracts, maxAmounts)
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.not.eq(ZERO)
      }
      const arrayOfZeroes = new Array(maxAmounts.length).fill(ZERO)

      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser(tokenContracts, arrayOfZeroes)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.eq(ZERO)
      }
    })

    it('is idempotent', async () => {
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.not.eq(
          maxAmounts[i]
        )
      }

      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser(tokenContracts, maxAmounts)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.eq(
          maxAmounts[i]
        )
      }

      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser(tokenContracts, maxAmounts)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await purchaseHook.getMaxERC721PurchasesPerUser(tokenContracts[i])).to.eq(
          maxAmounts[i]
        )
      }
    })
  })

  describe('# setMaxERC1155PurchasesPerUser', () => {
    const maxAmounts = [1, 2]
    const tokenIds = [0, 1]

    beforeEach(async () => {
      await setupPurchaseHook()
      await setupMockERC1155Contracts()
      tokenContracts = [firstERC1155.address, secondERC1155.address]
    })

    it('reverts if not owner', async () => {
      expect(await purchaseHook.owner()).to.not.eq(user1.address)

      await expect(
        purchaseHook
          .connect(user1)
          .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, maxAmounts)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if token contract array length mismatch', async () => {
      const mismatchedContractArray = tokenContracts.slice(0, 1)
      expect(tokenIds.length).to.eq(maxAmounts.length)
      expect(mismatchedContractArray.length).to.not.eq(tokenIds.length)

      await expect(
        purchaseHook
          .connect(owner)
          .setMaxERC1155PurchasesPerUser(mismatchedContractArray, tokenIds, maxAmounts)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if amount array length mismatch', async () => {
      const mismatchedAmountArray = maxAmounts.slice(0, 1)
      expect(tokenContracts.length).to.eq(tokenIds.length)
      expect(mismatchedAmountArray.length).to.not.eq(tokenIds.length)

      await expect(
        purchaseHook
          .connect(owner)
          .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, mismatchedAmountArray)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if token id array length mismatch', async () => {
      const mismatchedIdArray = tokenIds.slice(0, 1)
      expect(tokenContracts.length).to.eq(maxAmounts.length)
      expect(mismatchedIdArray.length).to.not.eq(tokenContracts.length)

      await expect(
        purchaseHook
          .connect(owner)
          .setMaxERC1155PurchasesPerUser(tokenContracts, mismatchedIdArray, maxAmounts)
      ).revertedWith('Array length mismatch')
    })

    it('sets amount to non-zero for single item', async () => {
      const contract = tokenContracts[0]
      const tokenId = tokenIds[0]
      const maxAmount = maxAmounts[0]
      expect(maxAmount).to.not.eq(ZERO)
      expect(await purchaseHook.getMaxERC1155PurchasesPerUser(contract, tokenId)).to.not.eq(
        maxAmount
      )

      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([contract], [tokenId], [maxAmount])

      expect(await purchaseHook.getMaxERC1155PurchasesPerUser(contract, tokenId)).to.eq(maxAmount)
    })

    it('sets amount to non-zero for multiple items', async () => {
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(maxAmounts[i]).to.not.eq(ZERO)
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds)
        ).to.not.eq(maxAmounts[i])
      }

      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, maxAmounts)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds[i])
        ).to.eq(maxAmounts[i])
      }
    })

    it('sets amount to zero for single item', async () => {
      const contract = tokenContracts[0]
      const maxAmount = maxAmounts[0]
      const tokenId = tokenIds[0]
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([contract], [tokenId], [maxAmount])
      expect(await purchaseHook.getMaxERC1155PurchasesPerUser(contract, tokenId)).to.not.eq(ZERO)

      await purchaseHook.connect(owner).setMaxERC1155PurchasesPerUser([contract], [tokenId], [ZERO])

      expect(await purchaseHook.getMaxERC1155PurchasesPerUser(contract, tokenId)).to.eq(ZERO)
    })

    it('sets amount to zero for multiple items', async () => {
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, maxAmounts)
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds[i])
        ).to.not.eq(ZERO)
      }
      const arrayOfZeroes = new Array(maxAmounts.length).fill(ZERO)

      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, arrayOfZeroes)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds[i])
        ).to.eq(ZERO)
      }
    })

    it('is idempotent', async () => {
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds[i])
        ).to.not.eq(maxAmounts[i])
      }

      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, maxAmounts)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds[i])
        ).to.eq(maxAmounts[i])
      }

      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser(tokenContracts, tokenIds, maxAmounts)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(
          await purchaseHook.getMaxERC1155PurchasesPerUser(tokenContracts[i], tokenIds[i])
        ).to.eq(maxAmounts[i])
      }
    })
  })

  describe('# setTokenShop', () => {
    before(async () => {
      await setupPurchaseHook()
      await setupMockTokenShop()
    })

    it('reverts if not owner', async () => {
      expect(await purchaseHook.owner()).to.not.eq(user1.address)

      await expect(purchaseHook.connect(user1).setTokenShop(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await purchaseHook.getTokenShop()).to.not.eq(JUNK_ADDRESS)
      expect(JUNK_ADDRESS).to.not.equal(ZERO_ADDRESS)

      await purchaseHook.connect(owner).setTokenShop(JUNK_ADDRESS)

      expect(await purchaseHook.getTokenShop()).to.eq(JUNK_ADDRESS)
    })

    it('sets to zero address', async () => {
      await purchaseHook.connect(owner).setTokenShop(JUNK_ADDRESS)
      expect(await purchaseHook.getTokenShop()).to.not.eq(ZERO_ADDRESS)

      await purchaseHook.connect(owner).setTokenShop(ZERO_ADDRESS)

      expect(await purchaseHook.getTokenShop()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await purchaseHook.getTokenShop()).to.not.eq(JUNK_ADDRESS)

      await purchaseHook.connect(owner).setTokenShop(JUNK_ADDRESS)

      expect(await purchaseHook.getTokenShop()).to.eq(JUNK_ADDRESS)

      await purchaseHook.connect(owner).setTokenShop(JUNK_ADDRESS)

      expect(await purchaseHook.getTokenShop()).to.eq(JUNK_ADDRESS)
    })
  })

  describe('# hookERC721', () => {
    const tokenId = 1
    let erc721Contract: string
    beforeEach(async () => {
      await setupPurchaseHook()
      await setupMockTokenShop()
      await setupMockERC721Contracts()
      erc721Contract = firstERC721.address
      await purchaseHook.connect(owner).setTokenShop(tokenShop.address)
    })

    it('reverts if token shop not set', async () => {
      await purchaseHook.connect(owner).setTokenShop(ZERO_ADDRESS)

      await expect(purchaseHook.hookERC721(user1.address, erc721Contract, tokenId)).revertedWith(
        'Token shop not set in hook'
      )
    })

    it("reverts if user's ERC721 purchase count > limit", async () => {
      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([erc721Contract], [1])
      tokenShop.getERC721PurchaseCount.whenCalledWith(user1.address, erc721Contract).returns(2)

      await expect(purchaseHook.hookERC721(user1.address, erc721Contract, tokenId)).revertedWith(
        'ERC721 purchase limit reached'
      )
    })

    it("reverts if user's ERC721 purchase count = limit", async () => {
      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([erc721Contract], [1])
      tokenShop.getERC721PurchaseCount.whenCalledWith(user1.address, erc721Contract).returns(1)

      await expect(purchaseHook.hookERC721(user1.address, erc721Contract, tokenId)).revertedWith(
        'ERC721 purchase limit reached'
      )
    })

    it("succeeds if user's ERC721 purchase count < limit", async () => {
      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([erc721Contract], [2])
      tokenShop.getERC721PurchaseCount.whenCalledWith(user1.address, erc721Contract).returns(1)

      await expect(purchaseHook.hookERC721(user1.address, erc721Contract, tokenId)).to.not.reverted
    })

    it("succeeds if max ERC721 purchase limit = 0 and user's ERC721 purchase count > 0", async () => {
      /**
       * maxPurchaseAmount = 0 refers to no limit on max purchase, hence user's ERC721 balance
       * can be greater than max purchase limit i.e 0
       */
      await purchaseHook.connect(owner).setMaxERC721PurchasesPerUser([erc721Contract], [ZERO])
      tokenShop.getERC721PurchaseCount.whenCalledWith(user1.address, erc721Contract).returns(1)

      await expect(purchaseHook.hookERC721(user1.address, erc721Contract, tokenId)).to.not.reverted
    })
  })

  describe('# hookERC1155', () => {
    const tokenId = 1
    const erc1155MaxAmount = 10
    let erc1155Contract: string
    beforeEach(async () => {
      await setupPurchaseHook()
      await setupMockTokenShop()
      await setupMockERC1155Contracts()
      erc1155Contract = firstERC1155.address
      await purchaseHook.connect(owner).setTokenShop(tokenShop.address)
      tokenShop.getERC1155PurchaseCount
        .whenCalledWith(user1.address, erc1155Contract, tokenId)
        .returns(1)
    })

    it('reverts if token shop not set', async () => {
      await purchaseHook.connect(owner).setTokenShop(ZERO_ADDRESS)

      await expect(
        purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, erc1155MaxAmount)
      ).revertedWith('Token shop not set in hook')
    })

    it("reverts if user's ERC1155 purchase count after purchase > limit", async () => {
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([erc1155Contract], [tokenId], [erc1155MaxAmount])
      const purchaseCountBefore = await tokenShop.getERC1155PurchaseCount(
        user1.address,
        erc1155Contract,
        tokenId
      )
      const amountToExceedLimit = erc1155MaxAmount - purchaseCountBefore.toNumber() + 1
      expect(purchaseCountBefore.add(amountToExceedLimit)).to.be.gt(erc1155MaxAmount)

      await expect(
        purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, amountToExceedLimit)
      ).revertedWith('ERC1155 purchase limit reached')
    })

    it("succeeds if user's ERC1155 purchase count after purchase = limit", async () => {
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([erc1155Contract], [tokenId], [erc1155MaxAmount])
      const purchaseCountBefore = await tokenShop.getERC1155PurchaseCount(
        user1.address,
        erc1155Contract,
        tokenId
      )
      const amountToReachLimit = erc1155MaxAmount - purchaseCountBefore.toNumber()
      expect(purchaseCountBefore.add(amountToReachLimit)).to.eq(erc1155MaxAmount)

      await expect(
        purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, amountToReachLimit)
      ).to.not.reverted
    })

    it("succeeds if user's ERC1155 purchase count after purchase < limit", async () => {
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([erc1155Contract], [tokenId], [erc1155MaxAmount])
      const purchaseCountBefore = await tokenShop.getERC1155PurchaseCount(
        user1.address,
        erc1155Contract,
        tokenId
      )
      const amountToStayUnderLimit = erc1155MaxAmount - purchaseCountBefore.toNumber() - 1
      expect(purchaseCountBefore.add(amountToStayUnderLimit)).to.be.lt(erc1155MaxAmount)

      await expect(
        purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, amountToStayUnderLimit)
      ).to.not.reverted
    })

    it("succeeds if max ERC1155 purchase limit = 0 and user's ERC1155 purchase count > 0", async () => {
      /**
       * maxPurchaseAmount = 0 refers to no limit on max purchase, hence user's ERC1155 balance
       * can be greater than max purchase limit i.e 0
       */
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([erc1155Contract], [tokenId], [ZERO])

      await expect(
        purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, erc1155MaxAmount)
      ).to.not.reverted
    })

    it('succeeds if purchase amount = 0', async () => {
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([erc1155Contract], [tokenId], [erc1155MaxAmount])

      await expect(purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, ZERO)).to.not
        .reverted
    })

    it('succeeds if purchase amount is max uint', async () => {
      await purchaseHook
        .connect(owner)
        .setMaxERC1155PurchasesPerUser([erc1155Contract], [tokenId], [MAX_UINT256])
      tokenShop.getERC1155PurchaseCount
        .whenCalledWith(user1.address, erc1155Contract, tokenId)
        .returns(0)

      await expect(purchaseHook.hookERC1155(user1.address, erc1155Contract, tokenId, MAX_UINT256))
        .to.not.reverted
    })
  })
})
