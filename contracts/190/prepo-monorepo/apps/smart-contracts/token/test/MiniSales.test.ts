import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { formatBytes32String, parseUnits } from 'ethers/lib/utils'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { Contract, BigNumber } from 'ethers'
import { miniSalesFixture, fakeAllowlistPurchaseHookFixture } from './fixtures/MiniSalesFixtures'
import { mockERC20Fixture } from './fixtures/MockERC20Fixtures'
import { MiniSales, MockERC20 } from '../types/generated'

chai.use(smock.matchers)

describe('=> MiniSales', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let miniSales: MiniSales
  let paymentToken: MockERC20
  let saleToken: MockERC20
  let fakeAllowlistPurchaseHook: FakeContract<Contract>
  const saleTokenDecimals = 18 // PPO is 18 decimal
  const paymentTokenDecimals = 6 // USDC is 6 decimal
  const testPrice = parseUnits('1.234', paymentTokenDecimals)
  const testDenominator = parseUnits('1', saleTokenDecimals)
  const dataPayloadA = formatBytes32String('A')

  const deployMiniSales = async (): Promise<void> => {
    ;[deployer, owner, user1, user2] = await ethers.getSigners()
    saleToken = await mockERC20Fixture(
      'Sale Token',
      'ST',
      saleTokenDecimals,
      owner.address,
      parseUnits('10000', saleTokenDecimals)
    )
    paymentToken = await mockERC20Fixture(
      'Payment Token',
      'PT',
      paymentTokenDecimals,
      owner.address,
      parseUnits('10000', paymentTokenDecimals)
    )
    miniSales = await miniSalesFixture(saleToken.address, paymentToken.address, saleTokenDecimals)
  }

  const setupMiniSales = async (): Promise<void> => {
    await deployMiniSales()
    await miniSales.connect(deployer).transferOwnership(owner.address)
    await miniSales.connect(owner).acceptOwnership()
    fakeAllowlistPurchaseHook = await fakeAllowlistPurchaseHookFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deployMiniSales()
    })

    it('sets nominee to zero address', async () => {
      expect(await miniSales.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await miniSales.owner()).to.eq(deployer.address)
    })

    it('sets sale token from constructor', async () => {
      expect(await miniSales.getSaleToken()).to.eq(saleToken.address)
    })

    it('sets payment token from constructor', async () => {
      expect(await miniSales.getPaymentToken()).to.eq(paymentToken.address)
    })

    it('sets price to zero', async () => {
      expect(await miniSales.getPrice()).to.eq(0)
    })

    it('sets purchase hook to zero address', async () => {
      expect(await miniSales.getPurchaseHook()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# purchase', () => {
    let contractSaleTokenBalance: BigNumber
    let saleTokenAmount: BigNumber
    let paymentNeeded: BigNumber
    let purchaser: SignerWithAddress
    let recipient: SignerWithAddress

    beforeEach(async () => {
      await setupMiniSales()
      await miniSales.connect(owner).setPrice(testPrice)
      await miniSales.connect(owner).setPurchaseHook(fakeAllowlistPurchaseHook.address)
      await saleToken
        .connect(owner)
        .transfer(miniSales.address, parseUnits('100', saleTokenDecimals))
      contractSaleTokenBalance = await saleToken.balanceOf(miniSales.address)
      saleTokenAmount = contractSaleTokenBalance
      paymentNeeded = saleTokenAmount.mul(testPrice).div(testDenominator)
      purchaser = user1
      recipient = user1
    })

    it('reverts if price mismatch', async () => {
      const currentPrice = await miniSales.getPrice()

      await expect(
        miniSales
          .connect(purchaser)
          .purchase(recipient.address, saleTokenAmount, currentPrice.add(1), dataPayloadA)
      ).revertedWith('Price mismatch')
    })

    it('reverts if purchase hook reverts', async () => {
      expect(await miniSales.getPrice()).to.eq(testPrice)
      fakeAllowlistPurchaseHook.hook.reverts()

      await expect(
        miniSales
          .connect(purchaser)
          .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)
      ).to.be.reverted
      expect(fakeAllowlistPurchaseHook.hook).to.have.been.calledOnce
    })

    it('reverts if insufficient sale token in contract', async () => {
      saleTokenAmount = contractSaleTokenBalance.add(1)
      paymentNeeded = saleTokenAmount.mul(testPrice).div(testDenominator)
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await expect(
        miniSales
          .connect(purchaser)
          .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)
      ).to.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('reverts if insufficient payment token provided', async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded.sub(1))
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await expect(
        miniSales
          .connect(purchaser)
          .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)
      ).to.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('reverts if insufficient payment token approved', async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded.sub(1))

      await expect(
        miniSales
          .connect(purchaser)
          .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)
      ).to.revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if recipient is zero address', async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await expect(
        miniSales
          .connect(purchaser)
          .purchase(ZERO_ADDRESS, saleTokenAmount, testPrice, dataPayloadA)
      ).revertedWith('ERC20: transfer to the zero address')
    })

    it("doesn't call hook if set to zero address", async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)
      await miniSales.connect(owner).setPurchaseHook(ZERO_ADDRESS)

      await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      expect(fakeAllowlistPurchaseHook.hook).to.not.have.been.called
    })

    it('calls hook with correct parameters', async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)
      expect(await miniSales.getPurchaseHook()).to.not.eq(ZERO_ADDRESS)

      await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      expect(fakeAllowlistPurchaseHook.hook).to.have.been.calledWith(
        purchaser.address,
        recipient.address,
        saleTokenAmount,
        testPrice,
        dataPayloadA
      )
    })

    it('transfers nothing if amount = 0', async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      const purchaserSaleTokenBalanceBefore = await saleToken.balanceOf(purchaser.address)
      const recipientSaleTokenBalanceBefore = await saleToken.balanceOf(recipient.address)
      const contractSaleTokenBalanceBefore = await saleToken.balanceOf(miniSales.address)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      const tx = await miniSales
        .connect(purchaser)
        .purchase(recipient.address, 0, testPrice, dataPayloadA)

      expect(await saleToken.balanceOf(purchaser.address)).to.eq(purchaserSaleTokenBalanceBefore)
      expect(await saleToken.balanceOf(recipient.address)).to.eq(recipientSaleTokenBalanceBefore)
      expect(await saleToken.balanceOf(miniSales.address)).to.eq(contractSaleTokenBalanceBefore)
      await expect(tx)
        .to.emit(saleToken, 'Transfer')
        .withArgs(miniSales.address, recipient.address, 0)
      await expect(tx)
        .to.emit(paymentToken, 'Transfer')
        .withArgs(purchaser.address, miniSales.address, 0)
    })

    it('transfers sale token to recipient if recipient is purchaser', async () => {
      expect(recipient.address).to.eq(purchaser.address)
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      const recipientSaleTokenBalanceBefore = await saleToken.balanceOf(recipient.address)
      const contractSaleTokenBalanceBefore = await saleToken.balanceOf(miniSales.address)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      expect(await saleToken.balanceOf(recipient.address)).to.eq(
        recipientSaleTokenBalanceBefore.add(saleTokenAmount)
      )
      expect(await saleToken.balanceOf(miniSales.address)).to.eq(
        contractSaleTokenBalanceBefore.sub(saleTokenAmount)
      )
    })

    it('transfers sale token to recipient if recipient is not purchaser', async () => {
      recipient = user2
      expect(recipient.address).to.not.eq(purchaser.address)
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      const purchaserSaleTokenBalanceBefore = await saleToken.balanceOf(purchaser.address)
      const recipientSaleTokenBalanceBefore = await saleToken.balanceOf(recipient.address)
      const contractSaleTokenBalanceBefore = await saleToken.balanceOf(miniSales.address)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      expect(await saleToken.balanceOf(purchaser.address)).to.eq(purchaserSaleTokenBalanceBefore)
      expect(await saleToken.balanceOf(recipient.address)).to.eq(
        recipientSaleTokenBalanceBefore.add(saleTokenAmount)
      )
      expect(await saleToken.balanceOf(miniSales.address)).to.eq(
        contractSaleTokenBalanceBefore.sub(saleTokenAmount)
      )
    })

    it('transfers payment token from purchaser if recipient is purchaser', async () => {
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      const purchaserPaymentTokenBalanceBefore = await paymentToken.balanceOf(purchaser.address)
      const contractPaymentTokenBalanceBefore = await paymentToken.balanceOf(miniSales.address)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      expect(await paymentToken.balanceOf(purchaser.address)).to.eq(
        purchaserPaymentTokenBalanceBefore.sub(paymentNeeded)
      )
      expect(await paymentToken.balanceOf(miniSales.address)).to.eq(
        contractPaymentTokenBalanceBefore.add(paymentNeeded)
      )
    })

    it("transfers payment token from purchaser if recipient isn't purchaser", async () => {
      recipient = user2
      expect(recipient.address).to.not.eq(purchaser.address)
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      const purchaserPaymentTokenBalanceBefore = await paymentToken.balanceOf(purchaser.address)
      const recipientPaymentTokenBalanceBefore = await paymentToken.balanceOf(recipient.address)
      const contractPaymentTokenBalanceBefore = await paymentToken.balanceOf(miniSales.address)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      expect(await paymentToken.balanceOf(purchaser.address)).to.eq(
        purchaserPaymentTokenBalanceBefore.sub(paymentNeeded)
      )
      expect(await paymentToken.balanceOf(recipient.address)).to.eq(
        recipientPaymentTokenBalanceBefore
      )
      expect(await paymentToken.balanceOf(miniSales.address)).to.eq(
        contractPaymentTokenBalanceBefore.add(paymentNeeded)
      )
    })

    it('emits purchase if amount = 0 and recipient is purchaser', async () => {
      expect(recipient.address).to.eq(purchaser.address)

      const tx = await miniSales
        .connect(purchaser)
        .purchase(recipient.address, 0, testPrice, dataPayloadA)

      await expect(tx)
        .to.emit(miniSales, 'Purchase(address,address,uint256,uint256)')
        .withArgs(purchaser.address, recipient.address, 0, testPrice)
    })

    it('emits purchase if amount = 0 and recipient is not purchaser', async () => {
      recipient = user2
      expect(recipient.address).to.not.eq(purchaser.address)

      const tx = await miniSales
        .connect(purchaser)
        .purchase(recipient.address, 0, testPrice, dataPayloadA)

      await expect(tx)
        .to.emit(miniSales, 'Purchase(address,address,uint256,uint256)')
        .withArgs(purchaser.address, recipient.address, 0, testPrice)
    })

    it('emits purchase if amount > 0 and recipient is purchaser', async () => {
      expect(saleTokenAmount).to.be.gt(0)
      expect(recipient.address).to.eq(purchaser.address)
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      const tx = await miniSales
        .connect(purchaser)
        .purchase(recipient.address, saleTokenAmount, testPrice, dataPayloadA)

      await expect(tx)
        .to.emit(miniSales, 'Purchase(address,address,uint256,uint256)')
        .withArgs(purchaser.address, recipient.address, saleTokenAmount, testPrice)
    })

    it('emits purchase if amount > 0 and recipient is not purchaser', async () => {
      expect(saleTokenAmount).to.be.gt(0)
      recipient = user2
      expect(recipient.address).to.not.eq(purchaser.address)
      await paymentToken.connect(owner).transfer(purchaser.address, paymentNeeded)
      await paymentToken.connect(purchaser).approve(miniSales.address, paymentNeeded)

      const tx = await miniSales
        .connect(purchaser)
        .purchase(user2.address, saleTokenAmount, testPrice, dataPayloadA)

      await expect(tx)
        .to.emit(miniSales, 'Purchase(address,address,uint256,uint256)')
        .withArgs(purchaser.address, recipient.address, saleTokenAmount, testPrice)
    })
  })

  describe('# setPrice', () => {
    beforeEach(async () => {
      await setupMiniSales()
    })

    it('reverts if not owner', async () => {
      expect(await miniSales.owner()).to.not.eq(user1.address)

      await expect(miniSales.connect(user1).setPrice(0)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero', async () => {
      expect(await miniSales.getPrice()).to.not.eq(testPrice)

      await miniSales.connect(owner).setPrice(testPrice)

      expect(await miniSales.getPrice()).to.eq(testPrice)
    })

    it('sets to zero', async () => {
      await miniSales.connect(owner).setPrice(testPrice)
      expect(await miniSales.getPrice()).to.not.eq(0)

      await miniSales.connect(owner).setPrice(0)

      expect(await miniSales.getPrice()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await miniSales.getPrice()).to.not.eq(testPrice)

      await miniSales.connect(owner).setPrice(testPrice)

      expect(await miniSales.getPrice()).to.eq(testPrice)

      await miniSales.connect(owner).setPrice(testPrice)

      expect(await miniSales.getPrice()).to.eq(testPrice)
    })

    it('emits PriceChange', async () => {
      const tx = await miniSales.connect(owner).setPrice(testPrice)

      await expect(tx).to.emit(miniSales, 'PriceChange').withArgs(testPrice)
    })
  })

  describe('# setPurchaseHook', () => {
    beforeEach(async () => {
      await setupMiniSales()
    })

    it('reverts if not owner', async () => {
      expect(await miniSales.owner()).to.not.eq(user1.address)

      await expect(miniSales.connect(user1).setPurchaseHook(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await miniSales.getPurchaseHook()).to.not.eq(JUNK_ADDRESS)
      expect(JUNK_ADDRESS).to.not.equal(ZERO_ADDRESS)

      await miniSales.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      expect(await miniSales.getPurchaseHook()).to.eq(JUNK_ADDRESS)
    })

    it('sets to zero address', async () => {
      await miniSales.connect(owner).setPurchaseHook(JUNK_ADDRESS)
      expect(await miniSales.getPurchaseHook()).to.not.eq(ZERO_ADDRESS)

      await miniSales.connect(owner).setPurchaseHook(ZERO_ADDRESS)

      expect(await miniSales.getPurchaseHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await miniSales.getPurchaseHook()).to.not.eq(JUNK_ADDRESS)

      await miniSales.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      expect(await miniSales.getPurchaseHook()).to.eq(JUNK_ADDRESS)

      await miniSales.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      expect(await miniSales.getPurchaseHook()).to.eq(JUNK_ADDRESS)
    })

    it('emits PurchaseHookChange', async () => {
      const tx = await miniSales.connect(owner).setPurchaseHook(JUNK_ADDRESS)

      await expect(tx).to.emit(miniSales, 'PurchaseHookChange').withArgs(JUNK_ADDRESS)
    })
  })

  describe('# withdrawERC20 (amounts)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await setupMiniSales()
    })

    it("doesn't revert", async () => {
      await expect(
        miniSales.connect(owner)['withdrawERC20(address[],uint256[])']([paymentToken.address], [0])
      ).not.reverted
    })
  })

  describe('# withdrawERC20 (full balance)', () => {
    // Adding minimal test to just ensure function reverts and is callable.
    beforeEach(async () => {
      await setupMiniSales()
    })

    it("doesn't revert", async () => {
      await expect(miniSales.connect(owner)['withdrawERC20(address[])']([paymentToken.address])).not
        .reverted
    })
  })
})
