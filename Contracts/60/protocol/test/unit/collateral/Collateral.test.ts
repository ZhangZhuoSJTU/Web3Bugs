import { MockContract } from '@ethereum-waffle/mock-contract'
import { utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { impersonate } from '../../testutil'

import {
  Collateral,
  Collateral__factory,
  Factory__factory,
  IERC20Metadata__factory,
  Product__factory,
} from '../../../types/generated'

const { ethers } = HRE

describe('Collateral', () => {
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let userB: SignerWithAddress
  let treasuryA: SignerWithAddress
  let treasuryB: SignerWithAddress
  let factory: MockContract
  let token: MockContract
  let product: MockContract
  let productSigner: SignerWithAddress

  let collateral: Collateral

  beforeEach(async () => {
    ;[owner, user, userB, treasuryA, treasuryB] = await ethers.getSigners()

    token = await waffle.deployMockContract(owner, IERC20Metadata__factory.abi)
    await token.mock.decimals.returns(18)

    product = await waffle.deployMockContract(owner, Product__factory.abi)
    productSigner = await impersonate.impersonateWithBalance(product.address, utils.parseEther('10'))

    factory = await waffle.deployMockContract(owner, Factory__factory.abi)
    await factory.mock.isPaused.withArgs().returns(false)
    await factory.mock.minCollateral.withArgs().returns(0)
    await factory.mock.isProduct.withArgs(product.address).returns(true)

    collateral = await new Collateral__factory(owner).deploy()
    await collateral.initialize(factory.address, token.address)
  })

  describe('#initialize', async () => {
    it('initialize with the correct variables set', async () => {
      expect(await collateral.factory()).to.equal(factory.address)
      expect(await collateral.token()).to.equal(token.address)
      expect(await collateral.liquidationFee()).to.equal(utils.parseEther('0.5'))
    })

    it('reverts if already initialized', async () => {
      await expect(collateral.initialize(factory.address, token.address)).to.be.revertedWith(
        'AlreadyInitializedError()',
      )
    })
  })

  describe('#depositTo', async () => {
    it('deposits to the user account', async () => {
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
      await expect(collateral.connect(owner).depositTo(user.address, product.address, 100))
        .to.emit(collateral, 'Deposit')
        .withArgs(user.address, product.address, 100)

      expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(100)
      expect(await collateral['collateral(address)'](product.address)).to.equal(100)
    })

    it('reverts if paused', async () => {
      await factory.mock.isPaused.withArgs().returns(true)
      await expect(collateral.connect(owner).depositTo(user.address, product.address, 100)).to.be.revertedWith(
        'PausedError()',
      )
    })

    it('reverts if below limit', async () => {
      await factory.mock.minCollateral.withArgs().returns(100)
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 80).returns(true)

      await expect(collateral.connect(owner).depositTo(user.address, product.address, 80)).to.be.revertedWith(
        'CollateralUnderLimitError()',
      )
    })

    describe('multiple users per product', async () => {
      beforeEach(async () => {
        await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
        await collateral.connect(owner).depositTo(user.address, product.address, 100)
      })

      it('adds to both totals', async () => {
        await expect(collateral.connect(owner).depositTo(userB.address, product.address, 100))
          .to.emit(collateral, 'Deposit')
          .withArgs(userB.address, product.address, 100)

        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(100)
        expect(await collateral['collateral(address,address)'](userB.address, product.address)).to.equal(100)
        expect(await collateral['collateral(address)'](product.address)).to.equal(200)
      })
    })
  })

  describe('#withdrawTo', async () => {
    beforeEach(async () => {
      await product.mock.maintenance.withArgs(user.address).returns(0)
      await product.mock.maintenanceNext.withArgs(user.address).returns(0)
      await product.mock.maintenance.withArgs(userB.address).returns(0)
      await product.mock.maintenanceNext.withArgs(userB.address).returns(0)
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
      await collateral.connect(owner).depositTo(user.address, product.address, 100)
    })

    it('withdraws from the user account', async () => {
      await token.mock.transfer.withArgs(owner.address, 80).returns(true)
      await expect(collateral.connect(user).withdrawTo(owner.address, product.address, 80))
        .to.emit(collateral, 'Withdrawal')
        .withArgs(user.address, product.address, 80)

      expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(20)
      expect(await collateral['collateral(address)'](product.address)).to.equal(20)
    })

    it('reverts if paused', async () => {
      await factory.mock.isPaused.withArgs().returns(true)
      await expect(collateral.connect(user).withdrawTo(user.address, product.address, 80)).to.be.revertedWith(
        'PausedError()',
      )
    })

    it('reverts if below limit', async () => {
      await factory.mock.minCollateral.withArgs().returns(50)
      await token.mock.transfer.withArgs(user.address, 80).returns(true)

      await expect(collateral.connect(user).withdrawTo(user.address, product.address, 80)).to.be.revertedWith(
        'CollateralUnderLimitError()',
      )
    })

    it('reverts if liquidatable current', async () => {
      await product.mock.maintenance.withArgs(user.address).returns(50)
      await product.mock.maintenanceNext.withArgs(user.address).returns(100)

      await token.mock.transfer.withArgs(user.address, 80).returns(true)
      await expect(collateral.connect(user).withdrawTo(user.address, product.address, 80)).to.be.revertedWith(
        'CollateralInsufficientCollateralError()',
      )
    })

    it('reverts if liquidatable next', async () => {
      await product.mock.maintenance.withArgs(user.address).returns(100)
      await product.mock.maintenanceNext.withArgs(user.address).returns(50)

      await token.mock.transfer.withArgs(user.address, 80).returns(true)
      await expect(collateral.connect(user).withdrawTo(user.address, product.address, 80)).to.be.revertedWith(
        'CollateralInsufficientCollateralError()',
      )
    })

    describe('multiple users per product', async () => {
      beforeEach(async () => {
        await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
        await collateral.connect(owner).depositTo(userB.address, product.address, 100)
        await token.mock.transfer.withArgs(owner.address, 80).returns(true)
        await collateral.connect(user).withdrawTo(owner.address, product.address, 80)
      })

      it('subtracts from both totals', async () => {
        await expect(collateral.connect(userB).withdrawTo(owner.address, product.address, 80))
          .to.emit(collateral, 'Withdrawal')
          .withArgs(userB.address, product.address, 80)

        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(20)
        expect(await collateral['collateral(address,address)'](userB.address, product.address)).to.equal(20)
        expect(await collateral['collateral(address)'](product.address)).to.equal(40)
      })
    })

    describe('shortfall', async () => {
      beforeEach(async () => {
        await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
        await collateral.connect(owner).depositTo(userB.address, product.address, 100)

        await collateral.connect(productSigner).settleAccount(userB.address, -150)
        await collateral.connect(productSigner).settleAccount(user.address, 150)
      })

      it('reverts if depleted', async () => {
        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(250)
        expect(await collateral['collateral(address)'](product.address)).to.equal(200)
        expect(await collateral.shortfall(product.address)).to.equal(50)

        await expect(collateral.connect(user).withdrawTo(user.address, product.address, 250)).to.be.revertedWith('0x11') // underflow
      })
    })
  })

  describe('#settleAccount', async () => {
    it('credits the account', async () => {
      await expect(collateral.connect(productSigner).settleAccount(user.address, 101))
        .to.emit(collateral, 'AccountSettle')
        .withArgs(product.address, user.address, 101, 0)
      expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(101)
      expect(await collateral['collateral(address)'](product.address)).to.equal(0)
    })

    context('negative credit', async () => {
      it('doesnt create a shortfall', async () => {
        await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
        await collateral.depositTo(user.address, product.address, 100)

        await expect(collateral.connect(productSigner).settleAccount(user.address, -99))
          .to.emit(collateral, 'AccountSettle')
          .withArgs(product.address, user.address, -99, 0)

        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(1)
        expect(await collateral['collateral(address)'](product.address)).to.equal(100)
        expect(await collateral.shortfall(product.address)).to.equal(0)
      })

      it('creates a shortfall', async () => {
        await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
        await collateral.depositTo(user.address, product.address, 100)

        await expect(collateral.connect(productSigner).settleAccount(user.address, -101))
          .to.emit(collateral, 'AccountSettle')
          .withArgs(product.address, user.address, -101, 1)

        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(0)
        expect(await collateral['collateral(address)'](product.address)).to.equal(100)
        expect(await collateral.shortfall(product.address)).to.equal(1)
      })
    })

    it('reverts if not product', async () => {
      await factory.mock.isProduct.withArgs(user.address).returns(false)

      await expect(collateral.connect(user).settleAccount(user.address, 101)).to.be.revertedWith(
        `NotProductError("${user.address}")`,
      )
    })
  })

  describe('#settleProduct', async () => {
    beforeEach(async () => {
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
      await collateral.depositTo(user.address, product.address, 100)

      await factory.mock['treasury()'].returns(treasuryA.address)
      await factory.mock['treasury(address)'].withArgs(product.address).returns(treasuryB.address)
      await factory.mock.fee.returns(utils.parseEther('0.1'))
    })

    it('settles the product fee', async () => {
      await expect(collateral.connect(productSigner).settleProduct(90))
        .to.emit(collateral, 'ProductSettle')
        .withArgs(product.address, 9, 81)

      expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(100)

      expect(await collateral['collateral(address)'](product.address)).to.equal(10)
      expect(await collateral.shortfall(product.address)).to.equal(0)
      expect(await collateral.fees(treasuryA.address)).to.equal(9)
      expect(await collateral.fees(treasuryB.address)).to.equal(81)
    })

    it('reverts if product shortfall', async () => {
      await expect(collateral.connect(productSigner).settleProduct(110)).to.be.revertedWith(`0x11`)
    })

    it('reverts if not product', async () => {
      await factory.mock.isProduct.withArgs(user.address).returns(false)

      await expect(collateral.connect(user).settleProduct(90)).to.be.revertedWith(`NotProductError("${user.address}")`)
    })
  })

  describe('#liquidate', async () => {
    beforeEach(async () => {
      // Setup the with 100 underlying collateral
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
      await collateral.depositTo(user.address, product.address, 100)

      // Mock settle calls
      await product.mock.settle.returns()
      await product.mock.settleAccount.withArgs(user.address).returns()
    })

    context('user not liquidatable', async () => {
      it('reverts without liquidating', async () => {
        await product.mock.maintenance.withArgs(user.address).returns(10)

        expect(await collateral.liquidatable(user.address, product.address)).to.equal(false)

        await expect(collateral.liquidate(user.address, product.address)).to.be.revertedWith(
          'CollateralCantLiquidate(10, 100)',
        )
      })
    })

    context('user liquidatable', async () => {
      it('liquidates the user', async () => {
        await product.mock.maintenance.withArgs(user.address).returns(101)
        await product.mock.closeAll.withArgs(user.address).returns()
        await token.mock.transfer.withArgs(owner.address, 50).returns(true)

        expect(await collateral.liquidatable(user.address, product.address)).to.equal(true)

        await expect(collateral.liquidate(user.address, product.address))
          .to.emit(collateral, 'Liquidation')
          .withArgs(user.address, product.address, owner.address, 50)

        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(50)
        expect(await collateral['collateral(address)'](product.address)).to.equal(50)
      })

      it('limits fee to total collateral', async () => {
        await product.mock.maintenance.withArgs(user.address).returns(210)
        await product.mock.closeAll.withArgs(user.address).returns()
        await token.mock.transfer.withArgs(owner.address, 100).returns(true)

        expect(await collateral.liquidatable(user.address, product.address)).to.equal(true)

        await expect(collateral.liquidate(user.address, product.address))
          .to.emit(collateral, 'Liquidation')
          .withArgs(user.address, product.address, owner.address, 100)

        expect(await collateral['collateral(address,address)'](user.address, product.address)).to.equal(0)
        expect(await collateral['collateral(address)'](product.address)).to.equal(0)
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(collateral.liquidate(user.address, product.address)).to.be.revertedWith('PausedError()')
      })
    })
  })

  describe('#liquidatableNext', async () => {
    beforeEach(async () => {
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
      await collateral.depositTo(user.address, product.address, 100)
    })

    it('returns true', async () => {
      await product.mock.maintenanceNext.withArgs(user.address).returns(101)

      expect(await collateral.liquidatableNext(user.address, product.address)).to.equal(true)
    })

    it('returns false', async () => {
      await product.mock.maintenanceNext.withArgs(user.address).returns(99)

      expect(await collateral.liquidatableNext(user.address, product.address)).to.equal(false)
    })
  })

  describe('#resolveShortfall', async () => {
    beforeEach(async () => {
      await collateral.connect(productSigner).settleAccount(user.address, -100)
    })

    it('pays off the shortfall', async () => {
      await token.mock.transferFrom.withArgs(user.address, collateral.address, 90).returns(true)

      await expect(collateral.connect(user).resolveShortfall(product.address, 90))
        .to.emit(collateral, 'ShortfallResolution')
        .withArgs(product.address, 90)

      expect(await collateral['collateral(address)'](product.address)).to.equal(90)
      expect(await collateral.shortfall(product.address)).to.equal(10)
    })
  })

  describe('#updateLiquidationFee', async () => {
    beforeEach(async () => {
      await factory.mock['owner()'].returns(owner.address)
    })

    it('updates the liquidation fee', async () => {
      const newFee = utils.parseEther('0.05')
      await expect(collateral.updateLiquidationFee(newFee))
        .to.emit(collateral, 'LiquidationFeeUpdated')
        .withArgs(newFee)

      expect(await collateral.liquidationFee()).to.equal(newFee)
    })

    it('reverts if not owner', async () => {
      const newFee = utils.parseEther('0.05')
      await expect(collateral.connect(user).updateLiquidationFee(newFee)).to.be.revertedWith(
        `NotOwnerError("${user.address}")`,
      )
    })
  })

  describe('#claimFee', async () => {
    beforeEach(async () => {
      await token.mock.transferFrom.withArgs(owner.address, collateral.address, 100).returns(true)
      await collateral.depositTo(user.address, product.address, 100)

      await factory.mock['treasury()'].returns(treasuryA.address)
      await factory.mock['treasury(address)'].withArgs(product.address).returns(treasuryB.address)
      await factory.mock.fee.returns(utils.parseEther('0.1'))

      await collateral.connect(productSigner).settleProduct(90)
    })

    it('claims fee', async () => {
      await token.mock.transfer.withArgs(treasuryA.address, 9).returns(true)
      await token.mock.transfer.withArgs(treasuryB.address, 81).returns(true)

      await expect(collateral.connect(treasuryA).claimFee())
        .to.emit(collateral, 'FeeClaim')
        .withArgs(treasuryA.address, 9)

      await expect(collateral.connect(treasuryB).claimFee())
        .to.emit(collateral, 'FeeClaim')
        .withArgs(treasuryB.address, 81)

      expect(await collateral.fees(treasuryA.address)).to.equal(0)
      expect(await collateral.fees(treasuryB.address)).to.equal(0)
    })
  })
})
