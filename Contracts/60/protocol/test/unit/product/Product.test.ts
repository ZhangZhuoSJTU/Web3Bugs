import { MockContract } from '@ethereum-waffle/mock-contract'
import { BigNumber, Signer, utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { impersonate } from '../../testutil'

import {
  Product,
  Collateral__factory,
  Factory__factory,
  Product__factory,
  Incentivizer__factory,
  ProductProviderBase__factory,
} from '../../../types/generated'
import { expectPositionEq, expectPrePositionEq } from '../../testutil/types'

const { ethers } = HRE

describe('Product', () => {
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let userB: SignerWithAddress
  let userC: SignerWithAddress
  let factorySigner: SignerWithAddress
  let collateralSigner: SignerWithAddress
  let factory: MockContract
  let collateral: MockContract
  let productProvider: MockContract
  let incentivizer: MockContract

  let product: Product

  beforeEach(async () => {
    ;[owner, user, userB, userC] = await ethers.getSigners()
    productProvider = await waffle.deployMockContract(owner, ProductProviderBase__factory.abi)
    incentivizer = await waffle.deployMockContract(owner, Incentivizer__factory.abi)

    collateral = await waffle.deployMockContract(owner, Collateral__factory.abi)
    collateralSigner = await impersonate.impersonateWithBalance(collateral.address, utils.parseEther('10'))

    factory = await waffle.deployMockContract(owner, Factory__factory.abi)
    factorySigner = await impersonate.impersonateWithBalance(factory.address, utils.parseEther('10'))
    await factory.mock.isPaused.withArgs().returns(false)
    await factory.mock.collateral.withArgs().returns(collateral.address)
    await factory.mock.incentivizer.withArgs().returns(incentivizer.address)

    product = await new Product__factory(owner).deploy()
    await product.connect(factorySigner).initialize(productProvider.address)
  })

  describe('#initialize', async () => {
    it('initialize with the correct variables set', async () => {
      expect(await product.factory()).to.equal(factory.address)
      expect((await product.functions.provider())[0]).to.equal(productProvider.address)
    })

    it('reverts if already initialized', async () => {
      await expect(product.initialize(productProvider.address)).to.be.revertedWith('AlreadyInitializedError()')
    })
  })

  describe('long market', async () => {
    const ORACLE_VERSION = 1
    const POSITION = utils.parseEther('10')
    const TIMESTAMP = 1636401093
    const PRICE = utils.parseEther('123')
    const RATE = utils.parseEther('0.10').div(365 * 24 * 60 * 60)
    const FUNDING_FEE = utils.parseEther('0.10')
    const MAKER_FEE = utils.parseEther('0.0')
    const TAKER_FEE = utils.parseEther('0.0')
    const MAINTENANCE = utils.parseEther('0.5')

    beforeEach(async () => {
      await collateral.mock.settleProduct.withArgs(0).returns()
      await collateral.mock.settleAccount.withArgs(user.address, 0).returns()
      await collateral.mock.settleAccount.withArgs(userB.address, 0).returns()
      await collateral.mock.settleAccount.withArgs(userC.address, 0).returns()
      await collateral.mock.liquidatableNext.withArgs(user.address, product.address).returns(false)
      await collateral.mock.liquidatableNext.withArgs(userB.address, product.address).returns(false)
      await collateral.mock.liquidatableNext.withArgs(userC.address, product.address).returns(false)

      await productProvider.mock.currentVersion.withArgs().returns(ORACLE_VERSION)
      await productProvider.mock.timestampAtVersion.withArgs(0).returns(0)
      await productProvider.mock.timestampAtVersion.withArgs(1).returns(TIMESTAMP)
      await productProvider.mock.priceAtVersion.withArgs(0).returns(0)
      await productProvider.mock.priceAtVersion.withArgs(1).returns(PRICE)
      await productProvider.mock.rate.withArgs({ maker: 0, taker: 0 }).returns(0)
      await productProvider.mock.fundingFee.withArgs().returns(FUNDING_FEE)
      await productProvider.mock.makerFee.withArgs().returns(MAKER_FEE)
      await productProvider.mock.takerFee.withArgs().returns(TAKER_FEE)
      await productProvider.mock.maintenance.withArgs().returns(MAINTENANCE)
      await productProvider.mock.makerLimit.withArgs().returns(POSITION.mul(10))
      await factory.mock.minFundingFee.withArgs().returns(FUNDING_FEE)

      await incentivizer.mock.sync.withArgs().returns()
      await incentivizer.mock.syncAccount.withArgs(user.address).returns()
      await incentivizer.mock.syncAccount.withArgs(userB.address).returns()
      await incentivizer.mock.syncAccount.withArgs(userC.address).returns()

      await productProvider.mock.sync.withArgs().returns()
    })

    context('#openMake', async () => {
      it('opens the position', async () => {
        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens the position and settles', async () => {
        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (same version)', async () => {
        await product.connect(user).openMake(POSITION)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens a second position and settles (same version)', async () => {
        await product.connect(user).openMake(POSITION)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (next version)', async () => {
        await product.connect(user).openMake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position and settles (next version)', async () => {
        await product.connect(user).openMake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later', async () => {
        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later with fee', async () => {
        await productProvider.mock.makerFee.withArgs().returns(utils.parseEther('0.01'))

        const MAKER_FEE = utils.parseEther('12.3') // position * maker fee * price
        await collateral.mock.settleProduct.withArgs(MAKER_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, MAKER_FEE.mul(-1)).returns()

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('reverts if can liquidate', async () => {
        await collateral.mock.liquidatableNext.withArgs(user.address, product.address).returns(true)

        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith(
          'ProductInsufficientCollateralError()',
        )
      })

      it('reverts if double sided position', async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
        await product.connect(user).openTake(POSITION)

        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('ProductDoubleSidedError()')
      })

      it('reverts if in liquidation', async () => {
        await product.connect(collateralSigner).closeAll(user.address)
        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('PausedError()')
      })

      it('reverts if over maker limit', async () => {
        await productProvider.mock.makerLimit.withArgs().returns(POSITION.div(2))
        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('ProductMakerOverLimitError()')
      })
    })

    context('#closeMake', async () => {
      beforeEach(async () => {
        await product.connect(user).openMake(POSITION)
      })

      it('closes the position partially', async () => {
        await expect(product.connect(user).closeMake(POSITION.div(2)))
          .to.emit(product, 'MakeClosed')
          .withArgs(user.address, POSITION.div(2))

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.div(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.div(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('closes the position', async () => {
        await expect(product.connect(user).closeMake(POSITION))
          .to.emit(product, 'MakeClosed')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(0)
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      context('settles first', async () => {
        beforeEach(async () => {
          await productProvider.mock.currentVersion.withArgs().returns(2)
          await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
          await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

          await product.connect(user).settle()
          await product.connect(user).settleAccount(user.address)
        })

        it('closes the position', async () => {
          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes the position and settles', async () => {
          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (same version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes a second position and settles (same version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (next version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: POSITION.div(2), taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION.div(2), taker: 0 },
          })
          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.div(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION.div(2), taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position and settles (next version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.div(2), taker: 0 }).returns(RATE)

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(4), { maker: utils.parseEther('1080'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 4, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(4), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          await productProvider.mock.makerFee.withArgs().returns(utils.parseEther('0.01'))

          const MAKER_FEE = utils.parseEther('12.3') // position * maker fee * price
          await collateral.mock.settleProduct.withArgs(MAKER_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, MAKER_FEE.mul(-1)).returns()

          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(4), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('reverts if taker > maker', async () => {
          await product.connect(userB).openTake(POSITION)

          await expect(product.connect(user).closeMake(POSITION)).to.be.revertedWith(
            `ProductInsufficientLiquidityError(0)`,
          )
        })

        it('reverts if underflow', async () => {
          await expect(product.connect(user).closeMake(POSITION.mul(2))).to.be.revertedWith('ProductOverClosedError()')
        })

        it('reverts if in liquidation', async () => {
          await product.connect(collateralSigner).closeAll(user.address)
          await expect(product.connect(user).closeMake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
        })

        it('reverts if paused', async () => {
          await factory.mock.isPaused.withArgs().returns(true)
          await expect(product.connect(user).closeMake(POSITION)).to.be.revertedWith('PausedError()')
        })
      })
    })

    context('#openTake', async () => {
      beforeEach(async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
      })

      it('opens the position', async () => {
        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens the position and settles', async () => {
        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (same version)', async () => {
        await product.connect(user).openTake(POSITION)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: POSITION.mul(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: POSITION.mul(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens a second position and settles (same version)', async () => {
        await product.connect(user).openTake(POSITION)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (next version)', async () => {
        await product.connect(user).openTake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position and settles (next version)', async () => {
        // rate * elapsed * utilization * maker * price
        // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
        const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
        const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
        const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

        await product.connect(user).openTake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE.div(20),
          taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('180'),
          taker: utils.parseEther('360'),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later', async () => {
        // rate * elapsed * utilization * maker * price
        // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
        const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
        const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
        const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE.div(20),
          taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('180'),
          taker: utils.parseEther('360'),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later with fee', async () => {
        await productProvider.mock.takerFee.withArgs().returns(utils.parseEther('0.01'))

        const TAKER_FEE = utils.parseEther('12.3') // position * taker fee * price

        // rate * elapsed * utilization * maker * price
        // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
        const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
        const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
        const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

        await collateral.mock.settleProduct.withArgs(TAKER_FEE.add(EXPECTED_FUNDING_FEE)).returns()
        await collateral.mock.settleAccount
          .withArgs(user.address, TAKER_FEE.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
          .returns()

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE.div(20),
          taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('180'),
          taker: utils.parseEther('360'),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('reverts if can liquidate', async () => {
        await collateral.mock.liquidatableNext.withArgs(user.address, product.address).returns(true)

        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith(
          'ProductInsufficientCollateralError()',
        )
      })

      it('reverts if taker > maker', async () => {
        const socialization = utils.parseEther('0.5')
        await expect(product.connect(user).openTake(POSITION.mul(4))).to.be.revertedWith(
          `ProductInsufficientLiquidityError(${socialization})`,
        )
      })

      it('reverts if double sided position', async () => {
        await product.connect(user).openMake(POSITION)
        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith('ProductDoubleSidedError()')
      })

      it('reverts if in liquidation', async () => {
        await product.connect(collateralSigner).closeAll(user.address)
        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith('PausedError()')
      })
    })

    context('#closeTake', async () => {
      beforeEach(async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
        await product.connect(user).openTake(POSITION)
      })

      it('closes the position partially', async () => {
        await expect(product.connect(user).closeTake(POSITION.div(2)))
          .to.emit(product, 'TakeClosed')
          .withArgs(user.address, POSITION.div(2))

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: POSITION.div(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: POSITION.div(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('closes the position', async () => {
        await expect(product.connect(user).closeTake(POSITION))
          .to.emit(product, 'TakeClosed')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(0)
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      context('settles first', async () => {
        beforeEach(async () => {
          await productProvider.mock.currentVersion.withArgs().returns(2)
          await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
          await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

          await product.connect(user).settle()
          await product.connect(user).settleAccount(user.address)
        })

        it('closes the position', async () => {
          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes the position and settles', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('180'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (same version)', async () => {
          await product.connect(user).closeTake(POSITION.div(2))

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes a second position and settles (same version)', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await product.connect(user).closeTake(POSITION.div(2))

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('180'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (next version)', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await product.connect(user).closeTake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION.div(2) },
          })
          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION.div(2) },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('180'),
            taker: utils.parseEther('360'),
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position and settles (next version)', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.25 * 20 * 123 = 7020547944372000
          const EXPECTED_FUNDING_1 = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_2 = ethers.BigNumber.from('7020547944372000')
          const EXPECTED_FUNDING_FEE_1 = EXPECTED_FUNDING_1.div(10)
          const EXPECTED_FUNDING_FEE_2 = EXPECTED_FUNDING_2.div(10)
          const EXPECTED_FUNDING_WITH_FEE_1 = EXPECTED_FUNDING_1.sub(EXPECTED_FUNDING_FEE_1) // maker funding
          const EXPECTED_FUNDING_WITH_FEE_2 = EXPECTED_FUNDING_2.sub(EXPECTED_FUNDING_FEE_2) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE_1).returns()
          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE_2).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE_1.mul(-1)).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE_2.mul(-1)).returns()

          await product.connect(user).closeTake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE_1.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE_1.div(10).mul(-1),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE_1.add(EXPECTED_FUNDING_WITH_FEE_2).div(20),
            taker: EXPECTED_FUNDING_WITH_FEE_1.div(10).add(EXPECTED_FUNDING_WITH_FEE_2.div(5)).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('360'),
            taker: utils.parseEther('1080'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 4, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('360'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          await productProvider.mock.takerFee.withArgs().returns(utils.parseEther('0.01'))

          const TAKER_FEE = utils.parseEther('12.3') // position * taker fee * price

          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(TAKER_FEE.add(EXPECTED_FUNDING_FEE)).returns()
          await collateral.mock.settleAccount
            .withArgs(user.address, TAKER_FEE.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
            .returns()

          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('360'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('reverts if underflow', async () => {
          await expect(product.connect(user).closeTake(POSITION.mul(2))).to.be.revertedWith('ProductOverClosedError()')
        })

        it('reverts if in liquidation', async () => {
          await product.connect(collateralSigner).closeAll(user.address)
          await expect(product.connect(user).closeTake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
        })

        it('reverts if paused', async () => {
          await factory.mock.isPaused.withArgs().returns(true)
          await expect(product.connect(user).closeTake(POSITION)).to.be.revertedWith('PausedError()')
        })
      })
    })

    describe('#closeAll', async () => {
      it('closes maker side', async () => {
        await product.connect(user).openMake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await product.connect(user).settle()
        await product.connect(user).settleAccount(user.address)

        await product.connect(user).openMake(POSITION)

        await product.connect(collateralSigner).closeAll(user.address)

        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: POSITION, taker: 0 },
        })

        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: POSITION, taker: 0 },
        })
        expect(await product.isLiquidating(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
      })

      it('closes taker side', async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
        await product.connect(user).openTake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await product.connect(user).settle()
        await product.connect(user).settleAccount(user.address)

        await product.connect(user).openTake(POSITION)

        await product.connect(collateralSigner).closeAll(user.address)

        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: POSITION },
        })

        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: POSITION },
        })
        expect(await product.isLiquidating(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
      })

      it('reverts if already initialized', async () => {
        await expect(product.connect(user).closeAll(user.address)).to.be.revertedWith(
          `NotCollateralError("${user.address}")`,
        )
      })
    })

    context('#settle / #settleAccount', async () => {
      // rate * elapsed * utilization * maker * price
      // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 10 * 123 = 7020547945205480
      const EXPECTED_FUNDING = 7020547944372000
      const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING / 10
      const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING - EXPECTED_FUNDING_FEE // maker funding

      beforeEach(async () => {
        await product.connect(user).openMake(POSITION)
        await product.connect(userB).openTake(POSITION.div(2))

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await product.connect(user).settle()
        await product.connect(user).settleAccount(user.address)
        await product.connect(user).settleAccount(userB.address)
      })

      it('same price same rate settle', async () => {
        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
        await collateral.mock.settleAccount
          .withArgs(userB.address, -1 * (EXPECTED_FUNDING - EXPECTED_FUNDING_FEE))
          .returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE / 10,
          taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      it('lower price same rate settle', async () => {
        const EXPECTED_POSITION = utils.parseEther('2').mul(5) // maker pnl

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount
          .withArgs(user.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE))
          .returns()
        await collateral.mock.settleAccount
          .withArgs(userB.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
          .returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(utils.parseEther('121'))
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).div(10),
          taker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1).div(5),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('605'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('605'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('302.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('302.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      it('higher price same rate settle', async () => {
        const EXPECTED_POSITION = utils.parseEther('-2').mul(5) // maker pnl

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount
          .withArgs(user.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE))
          .returns()
        await collateral.mock.settleAccount
          .withArgs(userB.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
          .returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(utils.parseEther('125'))
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).div(10),
          taker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1).div(5),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('625'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('625'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('312.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('312.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      it('same price negative rate settle', async () => {
        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, -1 * EXPECTED_FUNDING_WITH_FEE).returns()
        await collateral.mock.settleAccount.withArgs(userB.address, EXPECTED_FUNDING_WITH_FEE).returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE.mul(-1))

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 10,
          taker: EXPECTED_FUNDING_WITH_FEE / 5,
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      context('socialized', async () => {
        it('with socialization to zero', async () => {
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount.withArgs(userB.address, -1 * EXPECTED_FUNDING_WITH_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: 0, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)
        })

        it('with partial socialization', async () => {
          await product.connect(userC).openMake(POSITION.div(4))
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE / 2).returns()

          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount.withArgs(userC.address, EXPECTED_FUNDING_WITH_FEE / 2).returns()
          await collateral.mock.settleAccount
            .withArgs(userB.address, BigNumber.from(EXPECTED_FUNDING_WITH_FEE).mul(3).div(2).mul(-1))
            .returns()

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.div(4), taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10 + EXPECTED_FUNDING_WITH_FEE / 5,
            taker: -1 * (EXPECTED_FUNDING_WITH_FEE / 5 + EXPECTED_FUNDING_WITH_FEE / 10),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.5').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)

          await expect(product.connect(userC).settleAccount(userC.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userC.address, 3, 4)

          expect(await product.isClosed(userC.address)).to.equal(false)
          expect(await product.maintenance(userC.address)).to.equal(utils.parseEther('153.75'))
          expect(await product.maintenanceNext(userC.address)).to.equal(utils.parseEther('153.75'))
          await expectPositionEq(await product.position(userC.address), { maker: POSITION.div(4), taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](userC.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userC.address)).to.equal(4)
        })

        it('with socialization to zero (price change)', async () => {
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount.withArgs(userB.address, -1 * EXPECTED_FUNDING_WITH_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(utils.parseEther('125'))
          await productProvider.mock.rate.withArgs({ maker: 0, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('312.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('312.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)
        })

        it('with partial socialization (price change)', async () => {
          const EXPECTED_POSITION = utils.parseEther('-2').mul(5).div(2) // maker pnl

          await product.connect(userC).openMake(POSITION.div(4))
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE / 2).returns()

          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount
            .withArgs(userC.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE / 2))
            .returns()
          await collateral.mock.settleAccount
            .withArgs(
              userB.address,
              EXPECTED_POSITION.add(BigNumber.from(EXPECTED_FUNDING_WITH_FEE).mul(3).div(2)).mul(-1),
            )
            .returns()

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(utils.parseEther('125'))
          await productProvider.mock.rate.withArgs({ maker: POSITION.div(4), taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          const MAKER_FUNDING = EXPECTED_FUNDING_WITH_FEE / 10 + EXPECTED_FUNDING_WITH_FEE / 5
          const TAKER_FUNDING = -1 * (EXPECTED_FUNDING_WITH_FEE / 5 + EXPECTED_FUNDING_WITH_FEE / 10)
          const MAKER_POSITION = EXPECTED_POSITION.mul(2).div(5)
          const TAKER_POSITION = EXPECTED_POSITION.div(-5)
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: MAKER_POSITION.add(MAKER_FUNDING),
            taker: TAKER_POSITION.add(TAKER_FUNDING),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.5').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('312.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('312.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)

          await expect(product.connect(userC).settleAccount(userC.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userC.address, 3, 4)

          expect(await product.isClosed(userC.address)).to.equal(false)
          expect(await product.maintenance(userC.address)).to.equal(utils.parseEther('156.25'))
          expect(await product.maintenanceNext(userC.address)).to.equal(utils.parseEther('156.25'))
          await expectPositionEq(await product.position(userC.address), { maker: POSITION.div(4), taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](userC.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userC.address)).to.equal(4)
        })
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).settle()).to.be.revertedWith('PausedError()')
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).settleAccount(user.address)).to.be.revertedWith('PausedError()')
      })
    })
  })

  describe('short market', async () => {
    const ORACLE_VERSION = 1
    const POSITION = utils.parseEther('10')
    const TIMESTAMP = 1636401093
    const PRICE = utils.parseEther('-123')
    const RATE = utils.parseEther('0.10').div(365 * 24 * 60 * 60)
    const FUNDING_FEE = utils.parseEther('0.10')
    const MAKER_FEE = utils.parseEther('0.0')
    const TAKER_FEE = utils.parseEther('0.0')
    const MAINTENANCE = utils.parseEther('0.5')

    beforeEach(async () => {
      await collateral.mock.settleProduct.withArgs(0).returns()
      await collateral.mock.settleAccount.withArgs(user.address, 0).returns()
      await collateral.mock.settleAccount.withArgs(userB.address, 0).returns()
      await collateral.mock.settleAccount.withArgs(userC.address, 0).returns()
      await collateral.mock.liquidatableNext.withArgs(user.address, product.address).returns(false)
      await collateral.mock.liquidatableNext.withArgs(userB.address, product.address).returns(false)
      await collateral.mock.liquidatableNext.withArgs(userC.address, product.address).returns(false)

      await productProvider.mock.currentVersion.withArgs().returns(ORACLE_VERSION)
      await productProvider.mock.timestampAtVersion.withArgs(0).returns(0)
      await productProvider.mock.timestampAtVersion.withArgs(1).returns(TIMESTAMP)
      await productProvider.mock.priceAtVersion.withArgs(0).returns(0)
      await productProvider.mock.priceAtVersion.withArgs(1).returns(PRICE)
      await productProvider.mock.rate.withArgs({ maker: 0, taker: 0 }).returns(0)
      await productProvider.mock.fundingFee.withArgs().returns(FUNDING_FEE)
      await productProvider.mock.makerFee.withArgs().returns(MAKER_FEE)
      await productProvider.mock.takerFee.withArgs().returns(TAKER_FEE)
      await productProvider.mock.maintenance.withArgs().returns(MAINTENANCE)
      await productProvider.mock.makerLimit.withArgs().returns(POSITION.mul(10))
      await factory.mock.minFundingFee.withArgs().returns(FUNDING_FEE)

      await incentivizer.mock.sync.withArgs().returns()
      await incentivizer.mock.syncAccount.withArgs(user.address).returns()
      await incentivizer.mock.syncAccount.withArgs(userB.address).returns()
      await incentivizer.mock.syncAccount.withArgs(userC.address).returns()

      await productProvider.mock.sync.withArgs().returns()
    })

    context('#openMake', async () => {
      it('opens the position', async () => {
        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens the position and settles', async () => {
        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (same version)', async () => {
        await product.connect(user).openMake(POSITION)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens a second position and settles (same version)', async () => {
        await product.connect(user).openMake(POSITION)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (next version)', async () => {
        await product.connect(user).openMake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: POSITION, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position and settles (next version)', async () => {
        await product.connect(user).openMake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION.mul(2), taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later', async () => {
        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later with fee', async () => {
        await productProvider.mock.makerFee.withArgs().returns(utils.parseEther('0.01'))

        const MAKER_FEE = utils.parseEther('12.3') // position * maker fee * price
        await collateral.mock.settleProduct.withArgs(MAKER_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, MAKER_FEE.mul(-1)).returns()

        await expect(product.connect(user).openMake(POSITION))
          .to.emit(product, 'MakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('reverts if can liquidate', async () => {
        await collateral.mock.liquidatableNext.withArgs(user.address, product.address).returns(true)

        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith(
          'ProductInsufficientCollateralError()',
        )
      })

      it('reverts if double sided position', async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
        await product.connect(user).openTake(POSITION)

        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('ProductDoubleSidedError()')
      })

      it('reverts if in liquidation', async () => {
        await product.connect(collateralSigner).closeAll(user.address)
        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('PausedError()')
      })

      it('reverts if over maker limit', async () => {
        await productProvider.mock.makerLimit.withArgs().returns(POSITION.div(2))
        await expect(product.connect(user).openMake(POSITION)).to.be.revertedWith('ProductMakerOverLimitError()')
      })
    })

    context('#closeMake', async () => {
      beforeEach(async () => {
        await product.connect(user).openMake(POSITION)
      })

      it('closes the position partially', async () => {
        await expect(product.connect(user).closeMake(POSITION.div(2)))
          .to.emit(product, 'MakeClosed')
          .withArgs(user.address, POSITION.div(2))

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.div(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.div(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('closes the position', async () => {
        await expect(product.connect(user).closeMake(POSITION))
          .to.emit(product, 'MakeClosed')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(0)
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      context('settles first', async () => {
        beforeEach(async () => {
          await productProvider.mock.currentVersion.withArgs().returns(2)
          await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
          await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

          await product.connect(user).settle()
          await product.connect(user).settleAccount(user.address)
        })

        it('closes the position', async () => {
          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes the position and settles', async () => {
          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (same version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes a second position and settles (same version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (next version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: POSITION.div(2), taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION.div(2), taker: 0 },
          })
          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.div(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: POSITION.div(2), taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(3), { maker: utils.parseEther('360'), taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position and settles (next version)', async () => {
          await product.connect(user).closeMake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.div(2), taker: 0 }).returns(RATE)

          await expect(product.connect(user).closeMake(POSITION.div(2)))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(4), { maker: utils.parseEther('1080'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 4, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(4), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          await productProvider.mock.makerFee.withArgs().returns(utils.parseEther('0.01'))

          const MAKER_FEE = utils.parseEther('12.3') // position * maker fee * price
          await collateral.mock.settleProduct.withArgs(MAKER_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, MAKER_FEE.mul(-1)).returns()

          await expect(product.connect(user).closeMake(POSITION))
            .to.emit(product, 'MakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: 0 }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(4), { maker: utils.parseEther('360'), taker: 0 })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('reverts if taker > maker', async () => {
          await product.connect(userB).openTake(POSITION)

          await expect(product.connect(user).closeMake(POSITION)).to.be.revertedWith(
            `ProductInsufficientLiquidityError(0)`,
          )
        })

        it('reverts if underflow', async () => {
          await expect(product.connect(user).closeMake(POSITION.mul(2))).to.be.revertedWith('ProductOverClosedError()')
        })

        it('reverts if in liquidation', async () => {
          await product.connect(collateralSigner).closeAll(user.address)
          await expect(product.connect(user).closeMake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
        })

        it('reverts if paused', async () => {
          await factory.mock.isPaused.withArgs().returns(true)
          await expect(product.connect(user).closeMake(POSITION)).to.be.revertedWith('PausedError()')
        })
      })
    })

    context('#openTake', async () => {
      beforeEach(async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
      })

      it('opens the position', async () => {
        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens the position and settles', async () => {
        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (same version)', async () => {
        await product.connect(user).openTake(POSITION)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: POSITION.mul(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: POSITION.mul(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('opens a second position and settles (same version)', async () => {
        await product.connect(user).openTake(POSITION)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 2)

        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 2)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position (next version)', async () => {
        await product.connect(user).openTake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(2)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: POSITION },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(2)
      })

      it('opens a second position and settles (next version)', async () => {
        // rate * elapsed * utilization * maker * price
        // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
        const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
        const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
        const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

        await product.connect(user).openTake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE.div(20),
          taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('180'),
          taker: utils.parseEther('360'),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('1230'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('1230'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION.mul(2) })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later', async () => {
        // rate * elapsed * utilization * maker * price
        // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
        const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
        const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
        const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE.div(20),
          taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('180'),
          taker: utils.parseEther('360'),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('opens the position and settles later with fee', async () => {
        await productProvider.mock.takerFee.withArgs().returns(utils.parseEther('0.01'))

        const TAKER_FEE = utils.parseEther('12.3') // position * taker fee * price

        // rate * elapsed * utilization * maker * price
        // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
        const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
        const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
        const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

        await collateral.mock.settleProduct.withArgs(TAKER_FEE.add(EXPECTED_FUNDING_FEE)).returns()
        await collateral.mock.settleAccount
          .withArgs(user.address, TAKER_FEE.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
          .returns()

        await expect(product.connect(user).openTake(POSITION))
          .to.emit(product, 'TakeOpened')
          .withArgs(user.address, POSITION)

        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(2, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE.div(20),
          taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('180'),
          taker: utils.parseEther('360'),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 2, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)
      })

      it('reverts if can liquidate', async () => {
        await collateral.mock.liquidatableNext.withArgs(user.address, product.address).returns(true)

        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith(
          'ProductInsufficientCollateralError()',
        )
      })

      it('reverts if taker > maker', async () => {
        const socialization = utils.parseEther('0.5')
        await expect(product.connect(user).openTake(POSITION.mul(4))).to.be.revertedWith(
          `ProductInsufficientLiquidityError(${socialization})`,
        )
      })

      it('reverts if double sided position', async () => {
        await product.connect(user).openMake(POSITION)
        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith('ProductDoubleSidedError()')
      })

      it('reverts if in liquidation', async () => {
        await product.connect(collateralSigner).closeAll(user.address)
        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).openTake(POSITION)).to.be.revertedWith('PausedError()')
      })
    })

    context('#closeTake', async () => {
      beforeEach(async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
        await product.connect(user).openTake(POSITION)
      })

      it('closes the position partially', async () => {
        await expect(product.connect(user).closeTake(POSITION.div(2)))
          .to.emit(product, 'TakeClosed')
          .withArgs(user.address, POSITION.div(2))

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: POSITION.div(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: POSITION.div(2) },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      it('closes the position', async () => {
        await expect(product.connect(user).closeTake(POSITION))
          .to.emit(product, 'TakeClosed')
          .withArgs(user.address, POSITION)

        expect(await product.isClosed(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
        expect(await product.maintenanceNext(user.address)).to.equal(0)
        await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 1,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion()']()).to.equal(ORACLE_VERSION)
        await expectPositionEq(await product.positionAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 1,
          openPosition: { maker: POSITION.mul(2), taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        await expectPositionEq(await product.shareAtVersion(ORACLE_VERSION), { maker: 0, taker: 0 })
        expect(await product['latestVersion(address)'](user.address)).to.equal(ORACLE_VERSION)
      })

      context('settles first', async () => {
        beforeEach(async () => {
          await productProvider.mock.currentVersion.withArgs().returns(2)
          await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
          await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

          await product.connect(user).settle()
          await product.connect(user).settleAccount(user.address)
        })

        it('closes the position', async () => {
          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes the position and settles', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('180'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (same version)', async () => {
          await product.connect(user).closeTake(POSITION.div(2))

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          expect(await product['latestVersion()']()).to.equal(2)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 2,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION },
          })
          await expectPositionEq(await product.valueAtVersion(2), { maker: 0, taker: 0 })
          await expectPositionEq(await product.shareAtVersion(2), { maker: 0, taker: 0 })
          expect(await product['latestVersion(address)'](user.address)).to.equal(2)
        })

        it('closes a second position and settles (same version)', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await product.connect(user).closeTake(POSITION.div(2))

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('180'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 3)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position (next version)', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await product.connect(user).closeTake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          expect(await product.isClosed(user.address)).to.equal(false)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION.div(2) },
          })
          expect(await product['latestVersion()']()).to.equal(3)
          await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 3,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: POSITION.div(2) },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('180'),
            taker: utils.parseEther('360'),
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(3)
        })

        it('closes a second position and settles (next version)', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.25 * 20 * 123 = 7020547944372000
          const EXPECTED_FUNDING_1 = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_2 = ethers.BigNumber.from('7020547944372000')
          const EXPECTED_FUNDING_FEE_1 = EXPECTED_FUNDING_1.div(10)
          const EXPECTED_FUNDING_FEE_2 = EXPECTED_FUNDING_2.div(10)
          const EXPECTED_FUNDING_WITH_FEE_1 = EXPECTED_FUNDING_1.sub(EXPECTED_FUNDING_FEE_1) // maker funding
          const EXPECTED_FUNDING_WITH_FEE_2 = EXPECTED_FUNDING_2.sub(EXPECTED_FUNDING_FEE_2) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE_1).returns()
          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE_2).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE_1.mul(-1)).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE_2.mul(-1)).returns()

          await product.connect(user).closeTake(POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).closeTake(POSITION.div(2)))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION.div(2))

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE_1.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE_1.div(10).mul(-1),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE_1.add(EXPECTED_FUNDING_WITH_FEE_2).div(20),
            taker: EXPECTED_FUNDING_WITH_FEE_1.div(10).add(EXPECTED_FUNDING_WITH_FEE_2.div(5)).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('360'),
            taker: utils.parseEther('1080'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 4, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE.mul(-1)).returns()

          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('360'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('closes the position and settles later', async () => {
          await productProvider.mock.takerFee.withArgs().returns(utils.parseEther('0.01'))

          const TAKER_FEE = utils.parseEther('12.3') // position * taker fee * price

          // rate * elapsed * utilization * maker * price
          // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 20 * 123 = 14041095890000000
          const EXPECTED_FUNDING = ethers.BigNumber.from('14041095888744000')
          const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING.div(10)
          const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING.sub(EXPECTED_FUNDING_FEE) // maker funding

          await collateral.mock.settleProduct.withArgs(TAKER_FEE.add(EXPECTED_FUNDING_FEE)).returns()
          await collateral.mock.settleAccount
            .withArgs(user.address, TAKER_FEE.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
            .returns()

          await expect(product.connect(user).closeTake(POSITION))
            .to.emit(product, 'TakeClosed')
            .withArgs(user.address, POSITION)

          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.mul(2), taker: 0 })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.mul(2), taker: 0 })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE.div(20),
            taker: EXPECTED_FUNDING_WITH_FEE.div(10).mul(-1),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('360'),
            taker: utils.parseEther('360'),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(0)
          expect(await product.maintenanceNext(user.address)).to.equal(0)
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)
        })

        it('reverts if underflow', async () => {
          await expect(product.connect(user).closeTake(POSITION.mul(2))).to.be.revertedWith('ProductOverClosedError()')
        })

        it('reverts if in liquidation', async () => {
          await product.connect(collateralSigner).closeAll(user.address)
          await expect(product.connect(user).closeTake(POSITION)).to.be.revertedWith('ProductInLiquidationError()')
        })

        it('reverts if paused', async () => {
          await factory.mock.isPaused.withArgs().returns(true)
          await expect(product.connect(user).closeTake(POSITION)).to.be.revertedWith('PausedError()')
        })
      })
    })

    describe('#closeAll', async () => {
      it('closes maker side', async () => {
        await product.connect(user).openMake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)

        await product.connect(user).settle()
        await product.connect(user).settleAccount(user.address)

        await product.connect(user).openMake(POSITION)

        await product.connect(collateralSigner).closeAll(user.address)

        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: POSITION, taker: 0 },
        })

        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: POSITION, taker: 0 },
        })
        expect(await product.isLiquidating(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
      })

      it('closes taker side', async () => {
        await product.connect(userB).openMake(POSITION.mul(2))
        await product.connect(user).openTake(POSITION)

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION.mul(2), taker: POSITION }).returns(RATE)

        await product.connect(user).settle()
        await product.connect(user).settleAccount(user.address)

        await product.connect(user).openTake(POSITION)

        await product.connect(collateralSigner).closeAll(user.address)

        await expectPositionEq(await product.positionAtVersion(2), { maker: POSITION.mul(2), taker: POSITION })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: POSITION },
        })

        await expectPositionEq(await product.position(user.address), { maker: 0, taker: POSITION })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 2,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: POSITION },
        })
        expect(await product.isLiquidating(user.address)).to.equal(true)
        expect(await product.maintenance(user.address)).to.equal(0)
      })

      it('reverts if already initialized', async () => {
        await expect(product.connect(user).closeAll(user.address)).to.be.revertedWith(
          `NotCollateralError("${user.address}")`,
        )
      })
    })

    context('#settle / #settleAccount', async () => {
      // rate * elapsed * utilization * maker * price
      // ( 0.1 * 10^18 / 365 / 24 / 60 / 60 ) * 3600 * 0.5 * 10 * 123 = 7020547945205480
      const EXPECTED_FUNDING = 7020547944372000
      const EXPECTED_FUNDING_FEE = EXPECTED_FUNDING / 10
      const EXPECTED_FUNDING_WITH_FEE = EXPECTED_FUNDING - EXPECTED_FUNDING_FEE // maker funding

      beforeEach(async () => {
        await product.connect(user).openMake(POSITION)
        await product.connect(userB).openTake(POSITION.div(2))

        await productProvider.mock.currentVersion.withArgs().returns(2)
        await productProvider.mock.timestampAtVersion.withArgs(2).returns(TIMESTAMP + 3600)
        await productProvider.mock.priceAtVersion.withArgs(2).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await product.connect(user).settle()
        await product.connect(user).settleAccount(user.address)
        await product.connect(user).settleAccount(userB.address)
      })

      it('same price same rate settle', async () => {
        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
        await collateral.mock.settleAccount
          .withArgs(userB.address, -1 * (EXPECTED_FUNDING - EXPECTED_FUNDING_FEE))
          .returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_FUNDING_WITH_FEE / 10,
          taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      it('lower price same rate settle', async () => {
        const EXPECTED_POSITION = utils.parseEther('2').mul(5) // maker pnl

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount
          .withArgs(user.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE))
          .returns()
        await collateral.mock.settleAccount
          .withArgs(userB.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
          .returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(utils.parseEther('-125'))
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).div(10),
          taker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1).div(5),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('625'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('625'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('312.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('312.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      it('higher price same rate settle', async () => {
        const EXPECTED_POSITION = utils.parseEther('-2').mul(5) // maker pnl

        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount
          .withArgs(user.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE))
          .returns()
        await collateral.mock.settleAccount
          .withArgs(userB.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1))
          .returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(utils.parseEther('-121'))
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).div(10),
          taker: EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE).mul(-1).div(5),
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('605'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('605'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('302.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('302.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      it('same price negative rate settle', async () => {
        await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
        await collateral.mock.settleAccount.withArgs(user.address, -1 * EXPECTED_FUNDING_WITH_FEE).returns()
        await collateral.mock.settleAccount.withArgs(userB.address, EXPECTED_FUNDING_WITH_FEE).returns()

        await productProvider.mock.currentVersion.withArgs().returns(3)
        await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
        await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
        await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE.mul(-1))

        await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

        expect(await product['latestVersion()']()).to.equal(3)
        await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre()'](), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        await expectPositionEq(await product.valueAtVersion(3), {
          maker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 10,
          taker: EXPECTED_FUNDING_WITH_FEE / 5,
        })
        await expectPositionEq(await product.shareAtVersion(3), {
          maker: utils.parseEther('0.1').mul(3600),
          taker: utils.parseEther('0.2').mul(3600),
        })

        await expect(product.connect(user).settleAccount(user.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(user.address, 3, 3)

        expect(await product.isClosed(user.address)).to.equal(false)
        expect(await product.maintenance(user.address)).to.equal(utils.parseEther('615'))
        expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('615'))
        await expectPositionEq(await product.position(user.address), { maker: POSITION, taker: 0 })
        await expectPrePositionEq(await product['pre(address)'](user.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](user.address)).to.equal(3)

        await expect(product.connect(userB).settleAccount(userB.address))
          .to.emit(product, 'AccountSettle')
          .withArgs(userB.address, 3, 3)

        expect(await product.isClosed(userB.address)).to.equal(false)
        expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
        expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
        await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
        await expectPrePositionEq(await product['pre(address)'](userB.address), {
          oracleVersion: 0,
          openPosition: { maker: 0, taker: 0 },
          closePosition: { maker: 0, taker: 0 },
        })
        expect(await product['latestVersion(address)'](userB.address)).to.equal(3)
      })

      context('socialized', async () => {
        it('with socialization to zero', async () => {
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount.withArgs(userB.address, -1 * EXPECTED_FUNDING_WITH_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: 0, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)
        })

        it('with partial socialization', async () => {
          await product.connect(userC).openMake(POSITION.div(4))
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE / 2).returns()

          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount.withArgs(userC.address, EXPECTED_FUNDING_WITH_FEE / 2).returns()
          await collateral.mock.settleAccount
            .withArgs(userB.address, BigNumber.from(EXPECTED_FUNDING_WITH_FEE).mul(3).div(2).mul(-1))
            .returns()

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION.div(4), taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10 + EXPECTED_FUNDING_WITH_FEE / 5,
            taker: -1 * (EXPECTED_FUNDING_WITH_FEE / 5 + EXPECTED_FUNDING_WITH_FEE / 10),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.5').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('307.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('307.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)

          await expect(product.connect(userC).settleAccount(userC.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userC.address, 3, 4)

          expect(await product.isClosed(userC.address)).to.equal(false)
          expect(await product.maintenance(userC.address)).to.equal(utils.parseEther('153.75'))
          expect(await product.maintenanceNext(userC.address)).to.equal(utils.parseEther('153.75'))
          await expectPositionEq(await product.position(userC.address), { maker: POSITION.div(4), taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](userC.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userC.address)).to.equal(4)
        })

        it('with socialization to zero (price change)', async () => {
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()
          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount.withArgs(userB.address, -1 * EXPECTED_FUNDING_WITH_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(utils.parseEther('-121'))
          await productProvider.mock.rate.withArgs({ maker: 0, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: 0, taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('302.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('302.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)
        })

        it('with partial socialization (price change)', async () => {
          const EXPECTED_POSITION = utils.parseEther('-2').mul(5).div(2) // maker pnl

          await product.connect(userC).openMake(POSITION.div(4))
          await product.connect(collateralSigner).closeAll(user.address)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE).returns()

          await productProvider.mock.currentVersion.withArgs().returns(3)
          await productProvider.mock.timestampAtVersion.withArgs(3).returns(TIMESTAMP + 7200)
          await productProvider.mock.priceAtVersion.withArgs(3).returns(PRICE)
          await productProvider.mock.rate.withArgs({ maker: POSITION, taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(3, 3)

          await collateral.mock.settleProduct.withArgs(EXPECTED_FUNDING_FEE / 2).returns()

          await collateral.mock.settleAccount.withArgs(user.address, EXPECTED_FUNDING_WITH_FEE).returns()
          await collateral.mock.settleAccount
            .withArgs(userC.address, EXPECTED_POSITION.add(EXPECTED_FUNDING_WITH_FEE / 2))
            .returns()
          await collateral.mock.settleAccount
            .withArgs(
              userB.address,
              EXPECTED_POSITION.add(BigNumber.from(EXPECTED_FUNDING_WITH_FEE).mul(3).div(2)).mul(-1),
            )
            .returns()

          await productProvider.mock.currentVersion.withArgs().returns(4)
          await productProvider.mock.timestampAtVersion.withArgs(4).returns(TIMESTAMP + 10800)
          await productProvider.mock.priceAtVersion.withArgs(4).returns(utils.parseEther('-121'))
          await productProvider.mock.rate.withArgs({ maker: POSITION.div(4), taker: POSITION.div(2) }).returns(RATE)

          await expect(product.connect(user).settle()).to.emit(product, 'Settle').withArgs(4, 4)

          expect(await product['latestVersion()']()).to.equal(4)
          await expectPositionEq(await product.positionAtVersion(3), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPositionEq(await product.positionAtVersion(4), { maker: POSITION.div(4), taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre()'](), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          await expectPositionEq(await product.valueAtVersion(3), {
            maker: EXPECTED_FUNDING_WITH_FEE / 10,
            taker: (-1 * EXPECTED_FUNDING_WITH_FEE) / 5,
          })
          await expectPositionEq(await product.shareAtVersion(3), {
            maker: utils.parseEther('0.1').mul(3600),
            taker: utils.parseEther('0.2').mul(3600),
          })
          const MAKER_FUNDING = EXPECTED_FUNDING_WITH_FEE / 10 + EXPECTED_FUNDING_WITH_FEE / 5
          const TAKER_FUNDING = -1 * (EXPECTED_FUNDING_WITH_FEE / 5 + EXPECTED_FUNDING_WITH_FEE / 10)
          const MAKER_POSITION = EXPECTED_POSITION.mul(2).div(5)
          const TAKER_POSITION = EXPECTED_POSITION.div(-5)
          await expectPositionEq(await product.valueAtVersion(4), {
            maker: MAKER_POSITION.add(MAKER_FUNDING),
            taker: TAKER_POSITION.add(TAKER_FUNDING),
          })
          await expectPositionEq(await product.shareAtVersion(4), {
            maker: utils.parseEther('0.5').mul(3600),
            taker: utils.parseEther('0.2').mul(7200),
          })

          await expect(product.connect(user).settleAccount(user.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(user.address, 3, 4)

          expect(await product.isClosed(user.address)).to.equal(true)
          expect(await product.maintenance(user.address)).to.equal(utils.parseEther('0'))
          expect(await product.maintenanceNext(user.address)).to.equal(utils.parseEther('0'))
          await expectPositionEq(await product.position(user.address), { maker: 0, taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](user.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](user.address)).to.equal(4)

          await expect(product.connect(userB).settleAccount(userB.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userB.address, 4, 4)

          expect(await product.isClosed(userB.address)).to.equal(false)
          expect(await product.maintenance(userB.address)).to.equal(utils.parseEther('302.5'))
          expect(await product.maintenanceNext(userB.address)).to.equal(utils.parseEther('302.5'))
          await expectPositionEq(await product.position(userB.address), { maker: 0, taker: POSITION.div(2) })
          await expectPrePositionEq(await product['pre(address)'](userB.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userB.address)).to.equal(4)

          await expect(product.connect(userC).settleAccount(userC.address))
            .to.emit(product, 'AccountSettle')
            .withArgs(userC.address, 3, 4)

          expect(await product.isClosed(userC.address)).to.equal(false)
          expect(await product.maintenance(userC.address)).to.equal(utils.parseEther('151.25'))
          expect(await product.maintenanceNext(userC.address)).to.equal(utils.parseEther('151.25'))
          await expectPositionEq(await product.position(userC.address), { maker: POSITION.div(4), taker: 0 })
          await expectPrePositionEq(await product['pre(address)'](userC.address), {
            oracleVersion: 0,
            openPosition: { maker: 0, taker: 0 },
            closePosition: { maker: 0, taker: 0 },
          })
          expect(await product['latestVersion(address)'](userC.address)).to.equal(4)
        })
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).settle()).to.be.revertedWith('PausedError()')
      })

      it('reverts if paused', async () => {
        await factory.mock.isPaused.withArgs().returns(true)
        await expect(product.connect(user).settleAccount(user.address)).to.be.revertedWith('PausedError()')
      })
    })
  })
})
