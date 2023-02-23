/* eslint-disable no-await-in-loop */
import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { Contract } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { tokenShopFixture, fakePurchaseHookFixture } from './fixtures/TokenShopFixtures'
import { mockERC20Fixture } from './fixtures/MockERC20Fixtures'
import { ZERO } from '../utils'
import { TokenShop, MockERC20, contracts } from '../types/generated'

chai.use(smock.matchers)

describe('TokenShop', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let paymentToken: MockERC20
  let externalERC20Token: MockERC20
  let tokenShop: TokenShop
  let mockERC721: MockContract<Contract>
  let mockERC1155: MockContract<Contract>
  let tokenContracts: string[]
  const erc1155Id1 = 1
  const erc1155Id1Amount = 2
  const erc1155Id1Price = parseEther('1')
  const erc1155Id2 = 2
  const erc1155Id2Amount = 2
  const erc1155Id2Price = parseEther('2')
  const erc721Id1 = 1
  const erc721Id1Amount = 1
  const erc721Id1Price = parseEther('1')
  const erc721Id2 = 2
  const erc721Id2Amount = 1
  const erc721Id2Price = parseEther('2')
  const itemPrices = [erc1155Id1Price, erc721Id1Price]
  const tokenIds = [erc1155Id1, erc721Id1]
  const amounts = [erc1155Id1Amount, erc721Id1Amount]

  const deployTokenShop = async (): Promise<void> => {
    ;[deployer, owner, user1] = await ethers.getSigners()
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
    tokenShop = await tokenShopFixture(paymentToken.address)
  }

  const setupTokenShop = async (): Promise<void> => {
    await deployTokenShop()
    await tokenShop.connect(deployer).transferOwnership(owner.address)
    await tokenShop.connect(owner).acceptOwnership()
  }

  const setupMockContracts = async (): Promise<void> => {
    const mockERC115Factory = await smock.mock('ERC1155Mintable')
    const mockERC721Factory = await smock.mock('ERC721Mintable')
    mockERC1155 = await mockERC115Factory.deploy('mockURI')
    mockERC721 = await mockERC721Factory.deploy('mock ERC721', 'mERC721')
  }

  describe('initial state', () => {
    before(async () => {
      await deployTokenShop()
    })

    it('sets nominee to zero address', async () => {
      expect(await tokenShop.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets payment token from constructor', async () => {
      expect(await tokenShop.getPaymentToken()).to.eq(paymentToken.address)
    })

    it('sets owner to deployer', async () => {
      expect(await tokenShop.owner()).to.eq(deployer.address)
    })
  })

  describe('# setContractToIdToPrice', () => {
    beforeEach(async () => {
      await setupTokenShop()
      await setupMockContracts()
      tokenContracts = [mockERC1155.address, mockERC721.address]
    })

    it('reverts if not owner', async () => {
      expect(await tokenShop.owner()).to.not.eq(user1.address)

      await expect(
        tokenShop.connect(user1).setContractToIdToPrice(tokenContracts, tokenIds, itemPrices)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if token contract array length mismatch', async () => {
      const contractArray = tokenContracts.slice(0, 1)
      const idArray = tokenIds
      const priceArray = itemPrices
      expect(idArray.length).to.eq(priceArray.length)
      expect(contractArray.length).to.not.eq(idArray.length)
      expect(contractArray.length).to.not.eq(priceArray.length)

      await expect(
        tokenShop.connect(owner).setContractToIdToPrice(contractArray, idArray, priceArray)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if item price array length mismatch', async () => {
      const contractArray = tokenContracts
      const idArray = tokenIds
      const priceArray = itemPrices.slice(0, 1)
      expect(contractArray.length).to.eq(idArray.length)
      expect(priceArray.length).to.not.eq(idArray.length)
      expect(priceArray.length).to.not.eq(contractArray.length)

      await expect(
        tokenShop.connect(owner).setContractToIdToPrice(contractArray, idArray, priceArray)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if token id array length mismatch', async () => {
      const contractArray = tokenContracts
      const idArray = tokenIds.slice(0, 1)
      const priceArray = itemPrices
      expect(contractArray.length).to.eq(priceArray.length)
      expect(idArray.length).to.not.eq(contractArray.length)
      expect(idArray.length).to.not.eq(priceArray.length)

      await expect(
        tokenShop.connect(owner).setContractToIdToPrice(contractArray, idArray, priceArray)
      ).revertedWith('Array length mismatch')
    })

    it('sets price to non-zero for single item', async () => {
      const contract = tokenContracts[0]
      const tokenId = erc1155Id1
      const itemPrice = erc1155Id1Price
      expect(itemPrice).to.not.eq(ZERO)
      expect(await tokenShop.getPrice(contract, tokenId)).to.not.eq(itemPrice)

      await tokenShop.connect(owner).setContractToIdToPrice([contract], [tokenId], [itemPrice])

      expect(await tokenShop.getPrice(contract, tokenId)).to.eq(itemPrice)
    })

    it('sets price to non-zero for multiple items', async () => {
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(itemPrices[i]).to.not.eq(ZERO)
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.not.eq(itemPrices[i])
      }

      await tokenShop.connect(owner).setContractToIdToPrice(tokenContracts, tokenIds, itemPrices)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.eq(itemPrices[i])
      }
    })

    it('sets price to zero for single item', async () => {
      const contract = tokenContracts[0]
      const tokenId = erc1155Id1
      const itemPrice = erc1155Id1Price
      await tokenShop.connect(owner).setContractToIdToPrice([contract], [tokenId], [itemPrice])
      expect(await tokenShop.getPrice(contract, tokenId)).to.not.eq(ZERO)

      await tokenShop.connect(owner).setContractToIdToPrice([contract], [tokenId], [ZERO])

      expect(await tokenShop.getPrice(contract, tokenId)).to.eq(ZERO)
    })

    it('sets price to zero for multiple items', async () => {
      await tokenShop.connect(owner).setContractToIdToPrice(tokenContracts, tokenIds, itemPrices)
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.not.eq(ZERO)
      }
      const arrayOfZeroes = new Array(itemPrices.length).fill(ZERO)

      await tokenShop.connect(owner).setContractToIdToPrice(tokenContracts, tokenIds, arrayOfZeroes)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.eq(ZERO)
      }
    })

    it('is idempotent', async () => {
      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.not.eq(itemPrices[i])
      }

      await tokenShop.connect(owner).setContractToIdToPrice(tokenContracts, tokenIds, itemPrices)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.eq(itemPrices[i])
      }

      await tokenShop.connect(owner).setContractToIdToPrice(tokenContracts, tokenIds, itemPrices)

      for (let i = 0; i < tokenContracts.length; i++) {
        expect(await tokenShop.getPrice(tokenContracts[i], tokenIds[i])).to.eq(itemPrices[i])
      }
    })
  })

  describe('# setPurchaseHook', () => {
    beforeEach(async () => {
      await setupTokenShop()
    })

    it('reverts if not owner', async () => {
      expect(await tokenShop.owner()).to.not.eq(user1.address)

      await expect(tokenShop.connect(user1).setPurchaseHook(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await tokenShop.getPurchaseHook()).to.not.eq(JUNK_ADDRESS)
      expect(JUNK_ADDRESS).to.not.equal(ZERO_ADDRESS)

      await tokenShop.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      expect(await tokenShop.getPurchaseHook()).to.eq(JUNK_ADDRESS)
    })

    it('sets to zero address', async () => {
      await tokenShop.connect(owner).setPurchaseHook(JUNK_ADDRESS)
      expect(await tokenShop.getPurchaseHook()).to.not.eq(ZERO_ADDRESS)

      await tokenShop.connect(owner).setPurchaseHook(ZERO_ADDRESS)

      expect(await tokenShop.getPurchaseHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await tokenShop.getPurchaseHook()).to.not.eq(JUNK_ADDRESS)

      await tokenShop.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      expect(await tokenShop.getPurchaseHook()).to.eq(JUNK_ADDRESS)

      await tokenShop.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      expect(await tokenShop.getPurchaseHook()).to.eq(JUNK_ADDRESS)
    })
  })

  describe('# purchase', () => {
    let fakePurchaseHook: FakeContract<Contract>
    const purchasePrices = itemPrices
    beforeEach(async () => {
      await setupTokenShop()
      await setupMockContracts()
      fakePurchaseHook = await fakePurchaseHookFixture()
      tokenContracts = [mockERC1155.address, mockERC721.address]
      await mockERC1155.mint(tokenShop.address, erc1155Id1, erc1155Id1Amount)
      await mockERC721.mint(tokenShop.address, erc721Id1)
      await tokenShop.connect(owner).setPurchaseHook(fakePurchaseHook.address)
      await tokenShop.connect(owner).setContractToIdToPrice(tokenContracts, tokenIds, itemPrices)
      await paymentToken.connect(owner).transfer(user1.address, parseEther('10'))
    })

    it('reverts if paused', async () => {
      await tokenShop.connect(owner).setPaused(true)
      expect(await tokenShop.isPaused()).to.be.eq(true)

      await expect(
        tokenShop.connect(user1).purchase(tokenContracts, tokenIds, amounts, purchasePrices)
      ).revertedWith('Paused')
    })

    it('reverts if token contract array length mismatch', async () => {
      const mismatchedContractArray = tokenContracts.slice(0, 1)
      expect(mismatchedContractArray.length).to.not.eq(tokenIds.length)
      expect(tokenIds.length).to.eq(amounts.length)
      expect(tokenIds.length).to.eq(purchasePrices.length)

      await expect(
        tokenShop
          .connect(user1)
          .purchase(mismatchedContractArray, tokenIds, amounts, purchasePrices)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if amount array length mismatch', async () => {
      const mismatchedAmountArray = amounts.slice(0, 1)
      expect(mismatchedAmountArray.length).to.not.eq(tokenContracts.length)
      expect(tokenContracts.length).to.eq(tokenIds.length)
      expect(tokenContracts.length).to.eq(purchasePrices.length)

      await expect(
        tokenShop
          .connect(user1)
          .purchase(tokenContracts, tokenIds, mismatchedAmountArray, purchasePrices)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if token id array length mismatch', async () => {
      const mismatchedTokenIdArray = amounts.slice(0, 1)
      expect(mismatchedTokenIdArray.length).to.not.eq(tokenContracts.length)
      expect(tokenContracts.length).to.eq(amounts.length)
      expect(tokenContracts.length).to.eq(purchasePrices.length)

      await expect(
        tokenShop
          .connect(user1)
          .purchase(tokenContracts, mismatchedTokenIdArray, amounts, purchasePrices)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if purchase prices array length mismatch', async () => {
      const mismatchedPurchasePricesArray = purchasePrices.slice(0, 1)
      expect(mismatchedPurchasePricesArray.length).to.not.eq(tokenContracts.length)
      expect(tokenContracts.length).to.eq(tokenIds.length)
      expect(tokenContracts.length).to.eq(amounts.length)

      await expect(
        tokenShop
          .connect(user1)
          .purchase(tokenContracts, tokenIds, amounts, mismatchedPurchasePricesArray)
      ).revertedWith('Array length mismatch')
    })

    it('reverts if purchase hook is zero address', async () => {
      await tokenShop.connect(owner).setPurchaseHook(ZERO_ADDRESS)
      expect(await tokenShop.getPurchaseHook()).to.be.eq(ZERO_ADDRESS)

      await expect(
        tokenShop.connect(user1).purchase(tokenContracts, tokenIds, amounts, purchasePrices)
      ).revertedWith('Purchase hook not set')
    })

    it('reverts if non-purchasable item', async () => {
      await tokenShop
        .connect(owner)
        .setContractToIdToPrice([tokenContracts[0]], [erc1155Id1], [ZERO])
      expect(await tokenShop.getPrice(tokenContracts[0], erc1155Id1)).to.be.eq(ZERO)

      await expect(
        tokenShop
          .connect(user1)
          .purchase([tokenContracts[0]], [erc1155Id1], [erc1155Id1Amount], [erc1155Id1Price])
      ).revertedWith('Non-purchasable item')
    })

    it('reverts if called contract neither ERC1155 nor ERC721', async () => {
      await expect(
        tokenShop
          .connect(user1)
          .purchase([paymentToken.address], [erc1155Id1], [erc1155Id1Amount], [erc1155Id1Price])
      ).to.be.reverted
    })

    it('reverts if ERC1155 hook reverts', async () => {
      fakePurchaseHook.hookERC1155.reverts()

      await expect(
        tokenShop.connect(user1).purchase(tokenContracts, tokenIds, amounts, purchasePrices)
      ).to.be.reverted
    })

    it('reverts if ERC721 hook reverts', async () => {
      fakePurchaseHook.hookERC721.reverts()

      await expect(
        tokenShop.connect(user1).purchase(tokenContracts, tokenIds, amounts, purchasePrices)
      ).to.be.reverted
    })

    it('reverts if purchase price < price', async () => {
      const invalidPurchasePrice = erc1155Id1Price.sub(1)
      expect(invalidPurchasePrice).to.be.lt(
        await tokenShop.getPrice(mockERC1155.address, erc1155Id1)
      )

      await expect(
        tokenShop
          .connect(user1)
          .purchase([mockERC1155.address], [erc1155Id1], [erc1155Id1Amount], [invalidPurchasePrice])
      ).revertedWith('Purchase price < Price')
    })

    it('succeeds if purchase price = price', async () => {
      const validPurchasePrice = erc1155Id1Price
      expect(validPurchasePrice).to.be.eq(await tokenShop.getPrice(mockERC1155.address, erc1155Id1))
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      await paymentToken
        .connect(user1)
        .approve(tokenShop.address, erc1155Id1Price.mul(erc1155Id1Amount))

      await tokenShop
        .connect(user1)
        .purchase([mockERC1155.address], [erc1155Id1], [erc1155Id1Amount], [validPurchasePrice])

      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(erc1155Id1Price.mul(erc1155Id1Amount))
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(erc1155Id1Price.mul(erc1155Id1Amount))
      )
    })

    it('succeeds if purchase price > price', async () => {
      const validPurchasePrice = erc1155Id1Price.add(1)
      expect(validPurchasePrice).to.be.gt(await tokenShop.getPrice(mockERC1155.address, erc1155Id1))
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      await paymentToken
        .connect(user1)
        .approve(tokenShop.address, erc1155Id1Price.mul(erc1155Id1Amount))

      await tokenShop
        .connect(user1)
        .purchase([mockERC1155.address], [erc1155Id1], [erc1155Id1Amount], [validPurchasePrice])

      /**
       * If purchase price > price of token, the amount deducted should still be equal
       * to (price of token)*(amount of token)
       */
      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(erc1155Id1Price.mul(erc1155Id1Amount))
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(erc1155Id1Price.mul(erc1155Id1Amount))
      )
    })

    it("doesn't call ERC721 hook if only purchasing ERC1155 item", async () => {
      await paymentToken
        .connect(user1)
        .approve(tokenShop.address, erc1155Id1Price.mul(erc1155Id1Amount))

      await tokenShop
        .connect(user1)
        .purchase([mockERC1155.address], [erc1155Id1], [erc1155Id1Amount], [erc1155Id1Price])

      expect(fakePurchaseHook.hookERC1155).to.have.been.called
      expect(fakePurchaseHook.hookERC721).to.not.have.been.called
    })

    it("doesn't call ERC1155 hook if only purchasing ERC721 item", async () => {
      await paymentToken.connect(user1).approve(tokenShop.address, erc721Id1Price)

      await tokenShop
        .connect(user1)
        .purchase([mockERC721.address], [erc721Id1], [erc721Id1Amount], [erc721Id1Price])

      expect(fakePurchaseHook.hookERC721).to.have.been.called
      expect(fakePurchaseHook.hookERC1155).to.not.have.been.called
    })

    it('transfers to user if single ERC1155 item', async () => {
      const tokenShopERC1155BalanceBefore = await mockERC1155.balanceOf(
        tokenShop.address,
        erc1155Id1
      )
      const userERC1155BalanceBefore = await mockERC1155.balanceOf(user1.address, erc1155Id1)
      await paymentToken
        .connect(user1)
        .approve(tokenShop.address, erc1155Id1Price.mul(erc1155Id1Amount))

      await tokenShop
        .connect(user1)
        .purchase([mockERC1155.address], [erc1155Id1], [erc1155Id1Amount], [erc1155Id1Price])

      expect(await mockERC1155.balanceOf(tokenShop.address, erc1155Id1)).to.be.eq(
        tokenShopERC1155BalanceBefore.sub(erc1155Id1Amount)
      )
      expect(await mockERC1155.balanceOf(user1.address, erc1155Id1)).to.be.eq(
        userERC1155BalanceBefore.add(erc1155Id1Amount)
      )
    })

    it('transfers payment token if single ERC1155 item', async () => {
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      await paymentToken
        .connect(user1)
        .approve(tokenShop.address, erc1155Id1Price.mul(erc1155Id1Amount))

      await tokenShop
        .connect(user1)
        .purchase([mockERC1155.address], [erc1155Id1], [erc1155Id1Amount], [erc1155Id1Price])

      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(erc1155Id1Price.mul(erc1155Id1Amount))
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(erc1155Id1Price.mul(erc1155Id1Amount))
      )
    })

    it('transfers to user if multiple ERC1155 items', async () => {
      const erc1155Contracts = [mockERC1155.address, mockERC1155.address]
      // Since ERC1155 for id = 2 is not minted in beforeEach
      await mockERC1155.mint(tokenShop.address, erc1155Id2, erc1155Id2Amount)
      // Since price for second ERC1155 (id = 2) is not set in beforeEach
      await tokenShop
        .connect(owner)
        .setContractToIdToPrice([mockERC1155.address], [erc1155Id2], [erc1155Id2Price])
      const tokenShopERC1155Id1BalanceBefore = await mockERC1155.balanceOf(
        tokenShop.address,
        erc1155Id1
      )
      const tokenShopERC1155Id2BalanceBefore = await mockERC1155.balanceOf(
        tokenShop.address,
        erc1155Id2
      )
      const userERC1155Id1BalanceBefore = await mockERC1155.balanceOf(user1.address, erc1155Id1)
      const userERC1155Id2BalanceBefore = await mockERC1155.balanceOf(user1.address, erc1155Id2)
      const totalPurchaseAmount = erc1155Id1Price
        .mul(erc1155Id1Amount)
        .add(erc1155Id2Price.mul(erc1155Id2Amount))
      await paymentToken.connect(user1).approve(tokenShop.address, totalPurchaseAmount)

      await tokenShop
        .connect(user1)
        .purchase(
          erc1155Contracts,
          [erc1155Id1, erc1155Id2],
          [erc1155Id1Amount, erc1155Id2Amount],
          [erc1155Id1Price, erc1155Id2Price]
        )

      expect(await mockERC1155.balanceOf(tokenShop.address, erc1155Id1)).to.be.eq(
        tokenShopERC1155Id1BalanceBefore.sub(erc1155Id1Amount)
      )
      expect(await mockERC1155.balanceOf(user1.address, erc1155Id1)).to.be.eq(
        userERC1155Id1BalanceBefore.add(erc1155Id1Amount)
      )
      expect(await mockERC1155.balanceOf(tokenShop.address, erc1155Id2)).to.be.eq(
        tokenShopERC1155Id2BalanceBefore.sub(erc1155Id2Amount)
      )
      expect(await mockERC1155.balanceOf(user1.address, erc1155Id2)).to.be.eq(
        userERC1155Id2BalanceBefore.add(erc1155Id2Amount)
      )
    })

    it('transfers payment token if multiple ERC1155 items', async () => {
      const erc1155Contracts = [mockERC1155.address, mockERC1155.address]
      // Since ERC1155 for id = 2 is not minted in beforeEach
      await mockERC1155.mint(tokenShop.address, erc1155Id2, erc1155Id2Amount)
      // Since price for second ERC1155 (id = 2) is not set in beforeEach
      await tokenShop
        .connect(owner)
        .setContractToIdToPrice([mockERC1155.address], [erc1155Id2], [erc1155Id2Price])
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      const totalPurchaseAmount = erc1155Id1Price
        .mul(erc1155Id1Amount)
        .add(erc1155Id2Price.mul(erc1155Id2Amount))
      await paymentToken.connect(user1).approve(tokenShop.address, totalPurchaseAmount)

      await tokenShop
        .connect(user1)
        .purchase(
          erc1155Contracts,
          [erc1155Id1, erc1155Id2],
          [erc1155Id1Amount, erc1155Id2Amount],
          [erc1155Id1Price, erc1155Id2Price]
        )

      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(totalPurchaseAmount)
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(totalPurchaseAmount)
      )
    })

    it('transfers to user if single ERC721 item', async () => {
      const tokenShopERC721BalanceBefore = await mockERC721.balanceOf(tokenShop.address)
      const userERC721BalanceBefore = await mockERC721.balanceOf(user1.address)
      await paymentToken.connect(user1).approve(tokenShop.address, erc721Id1Price)

      await tokenShop
        .connect(user1)
        .purchase([mockERC721.address], [erc721Id1], [erc721Id1Amount], [erc721Id1Price])

      expect(await mockERC721.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopERC721BalanceBefore.sub(erc721Id1Amount)
      )
      expect(await mockERC721.balanceOf(user1.address)).to.be.eq(
        userERC721BalanceBefore.add(erc721Id1Amount)
      )
    })

    it('transfers payment token if single ERC721 item', async () => {
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      await paymentToken.connect(user1).approve(tokenShop.address, erc721Id1Price)

      await tokenShop
        .connect(user1)
        .purchase([mockERC721.address], [erc721Id1], [erc721Id1Amount], [erc721Id1Price])

      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(erc721Id1Price)
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(erc721Id1Price)
      )
    })

    it('transfers to user if multiple ERC721 items', async () => {
      const erc721Contracts = [mockERC721.address, mockERC721.address]
      // Since id 1 is already minted in beforeEach
      await mockERC721.mint(tokenShop.address, erc721Id2)
      // Since price for Id 2 is not set in beforeEach
      await tokenShop
        .connect(owner)
        .setContractToIdToPrice([mockERC721.address], [erc721Id2], [erc721Id2Price])
      const tokenShopERC721BalanceBefore = await mockERC721.balanceOf(tokenShop.address)
      const userERC721BalanceBefore = await mockERC721.balanceOf(user1.address)
      const totalPurchaseAmount = erc721Id1Price
        .mul(erc721Id1Amount)
        .add(erc721Id2Price.mul(erc721Id2Amount))
      await paymentToken.connect(user1).approve(tokenShop.address, totalPurchaseAmount)

      await tokenShop
        .connect(user1)
        .purchase(
          erc721Contracts,
          [erc721Id1, erc721Id2],
          [erc721Id1Amount, erc721Id2Amount],
          [erc721Id1Price, erc721Id2Price]
        )

      expect(await mockERC721.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopERC721BalanceBefore.sub(erc721Id1Amount + erc721Id2Amount)
      )
      expect(await mockERC721.balanceOf(user1.address)).to.be.eq(
        userERC721BalanceBefore.add(erc721Id1Amount + erc721Id2Amount)
      )
    })

    it('transfers payment token if multiple ERC721 items', async () => {
      const erc721Contracts = [mockERC721.address, mockERC721.address]
      // Since id 1 is already minted in beforeEach
      await mockERC721.mint(tokenShop.address, erc721Id2)
      // Since price for Id 2 is not set in beforeEach
      await tokenShop
        .connect(owner)
        .setContractToIdToPrice([mockERC721.address], [erc721Id2], [erc721Id2Price])
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      const totalPurchaseAmount = erc721Id1Price
        .mul(erc721Id1Amount)
        .add(erc721Id2Price.mul(erc721Id2Amount))
      await paymentToken.connect(user1).approve(tokenShop.address, totalPurchaseAmount)

      await tokenShop
        .connect(user1)
        .purchase(
          erc721Contracts,
          [erc721Id1, erc721Id2],
          [erc721Id1Amount, erc721Id2Amount],
          [erc721Id1Price, erc721Id2Price]
        )

      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(erc721Id1Price.add(erc721Id2Price))
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(erc721Id1Price.add(erc721Id2Price))
      )
    })

    it('transfers to user if both ERC721 and ERC1155 items', async () => {
      const tokenShopERC1155BalanceBefore = await mockERC1155.balanceOf(
        tokenShop.address,
        erc1155Id1
      )
      const userERC1155BalanceBefore = await mockERC1155.balanceOf(user1.address, erc1155Id1)
      const tokenShopERC721BalanceBefore = await mockERC721.balanceOf(tokenShop.address)
      const userERC721BalanceBefore = await mockERC721.balanceOf(user1.address)
      const totalPurchaseAmount = erc1155Id1Price
        .mul(erc1155Id1Amount)
        .add(erc721Id1Price.mul(erc721Id1Amount))
      await paymentToken.connect(user1).approve(tokenShop.address, totalPurchaseAmount)

      await tokenShop
        .connect(user1)
        .purchase(
          tokenContracts,
          [erc1155Id1, erc721Id1],
          [erc1155Id1Amount, erc721Id1Amount],
          [erc1155Id1Price, erc721Id1Price]
        )

      expect(await mockERC1155.balanceOf(tokenShop.address, erc1155Id1)).to.be.eq(
        tokenShopERC1155BalanceBefore.sub(erc1155Id1Amount)
      )
      expect(await mockERC1155.balanceOf(user1.address, erc1155Id1)).to.be.eq(
        userERC1155BalanceBefore.add(erc1155Id1Amount)
      )
      expect(await mockERC721.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopERC721BalanceBefore.sub(erc721Id1Amount)
      )
      expect(await mockERC721.balanceOf(user1.address)).to.be.eq(
        userERC721BalanceBefore.add(erc721Id1Amount)
      )
    })

    it('transfers payment token if both ERC721 and ERC1155 items', async () => {
      const userPaymentTokenBalanceBefore = await paymentToken.balanceOf(user1.address)
      const tokenShopPaymentTokenBalanceBefore = await paymentToken.balanceOf(tokenShop.address)
      const totalPurchaseAmount = erc1155Id1Price
        .mul(erc1155Id1Amount)
        .add(erc721Id1Price.mul(erc721Id1Amount))
      await paymentToken.connect(user1).approve(tokenShop.address, totalPurchaseAmount)

      await tokenShop
        .connect(user1)
        .purchase(
          tokenContracts,
          [erc1155Id1, erc721Id1],
          [erc1155Id1Amount, erc721Id1Amount],
          [erc1155Id1Price, erc721Id1Price]
        )

      expect(await paymentToken.balanceOf(user1.address)).to.be.eq(
        userPaymentTokenBalanceBefore.sub(totalPurchaseAmount)
      )
      expect(await paymentToken.balanceOf(tokenShop.address)).to.be.eq(
        tokenShopPaymentTokenBalanceBefore.add(totalPurchaseAmount)
      )
    })
  })
  // TODO : add tests for tx.origin vs msg.sender

  describe('# withdrawERC20 (amounts)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await setupTokenShop()
    })

    it("doesn't revert", async () => {
      await expect(
        tokenShop.connect(owner)['withdrawERC20(address[],uint256[])']([paymentToken.address], [0])
      ).not.reverted
    })
  })

  describe('# withdrawERC20 (full balance)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await setupTokenShop()
    })

    it("doesn't revert", async () => {
      await expect(tokenShop.connect(owner)['withdrawERC20(address[])']([paymentToken.address])).not
        .reverted
    })
  })

  describe('# withdrawERC721', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    const erc721Id = 1
    beforeEach(async () => {
      await setupTokenShop()
      await setupMockContracts()
      await mockERC721.mint(tokenShop.address, erc721Id)
    })

    it('reverts if not owner', async () => {
      expect(await tokenShop.owner()).to.not.eq(user1.address)

      await expect(
        tokenShop.connect(user1).withdrawERC721([mockERC721.address], [owner.address], [erc721Id])
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if token id not owned by token shop', async () => {
      const idNotOwnedByTokenShop = 2
      await mockERC721.mint(user1.address, idNotOwnedByTokenShop)
      mockERC721.ownerOf.whenCalledWith(idNotOwnedByTokenShop).returns(user1.address)

      await expect(
        tokenShop
          .connect(owner)
          .withdrawERC721([mockERC721.address], [owner.address], [idNotOwnedByTokenShop])
      ).revertedWith('ERC721: caller is not token owner nor approved')
    })

    it('transfers if token id owned by token shop', async () => {
      mockERC721.ownerOf.whenCalledWith(erc721Id).returns(tokenShop.address)
      const tokenShop721BalanceBefore = await mockERC721.balanceOf(tokenShop.address)
      const ownerERC721BalanceBefore = await mockERC721.balanceOf(owner.address)

      await tokenShop
        .connect(owner)
        .withdrawERC721([mockERC721.address], [owner.address], [erc721Id])

      expect(await mockERC721.balanceOf(owner.address)).to.be.equal(ownerERC721BalanceBefore.add(1))
      expect(await mockERC721.balanceOf(tokenShop.address)).to.be.equal(
        tokenShop721BalanceBefore.sub(1)
      )
    })
  })

  describe('# withdrawERC1155', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    const erc1155Id = 1
    const erc1155Amount = 10
    beforeEach(async () => {
      await setupTokenShop()
      await setupMockContracts()
      await mockERC1155.mint(tokenShop.address, erc1155Id, erc1155Amount)
    })

    it('reverts if not owner', async () => {
      expect(await tokenShop.owner()).to.not.eq(user1.address)

      await expect(
        tokenShop
          .connect(user1)
          .withdrawERC1155([mockERC1155.address], [owner.address], [erc1155Id], [erc1155Amount])
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if amount to withdraw > balance', async () => {
      const tokenShopERC1155Balance = await mockERC1155.balanceOf(tokenShop.address, erc1155Id)

      await expect(
        tokenShop
          .connect(owner)
          .withdrawERC1155(
            [mockERC1155.address],
            [owner.address],
            [erc1155Id],
            [tokenShopERC1155Balance.add(1)]
          )
      ).revertedWith('ERC1155: insufficient balance for transfer')
    })

    it('transfers if amount to withdraw = balance', async () => {
      const tokenShop1155BalanceBefore = await mockERC1155.balanceOf(tokenShop.address, erc1155Id)
      expect(tokenShop1155BalanceBefore).to.be.gt(0)
      const ownerERC1155BalanceBefore = await mockERC1155.balanceOf(owner.address, erc1155Id)

      await tokenShop
        .connect(owner)
        .withdrawERC1155(
          [mockERC1155.address],
          [owner.address],
          [erc1155Id],
          [tokenShop1155BalanceBefore]
        )

      expect(await mockERC1155.balanceOf(owner.address, erc1155Id)).to.be.equal(
        ownerERC1155BalanceBefore.add(tokenShop1155BalanceBefore)
      )
      expect(await mockERC1155.balanceOf(tokenShop.address, erc1155Id)).to.be.equal(ZERO)
    })
  })

  describe('# onERC721Received', () => {
    beforeEach(async () => {
      await setupTokenShop()
      await setupMockContracts()
    })

    it('is compliant with ERC721 safeTransferFrom() requirements', async () => {
      await mockERC721.mint(user1.address, erc1155Id1)

      await expect(
        mockERC721
          .connect(user1)
          ['safeTransferFrom(address,address,uint256)'](
            user1.address,
            tokenShop.address,
            erc1155Id1
          )
      ).not.reverted
    })
  })
})
