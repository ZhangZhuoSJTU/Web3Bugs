import { MockContract } from '@ethereum-waffle/mock-contract'
import { utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import {
  Factory,
  Product,
  Collateral__factory,
  Factory__factory,
  Product__factory,
  Incentivizer__factory,
  ProductProviderBase__factory,
} from '../../../types/generated'

const { ethers } = HRE

describe('Factory', () => {
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let treasury: SignerWithAddress
  let controllerTreasury: SignerWithAddress
  let pauser: SignerWithAddress
  let collateral: MockContract
  let productProvider: MockContract
  let incentivizer: MockContract

  let factory: Factory
  let productBase: Product

  beforeEach(async () => {
    ;[owner, user, treasury, controllerTreasury, pauser] = await ethers.getSigners()
    collateral = await waffle.deployMockContract(owner, Collateral__factory.abi)
    productProvider = await waffle.deployMockContract(owner, ProductProviderBase__factory.abi)
    incentivizer = await waffle.deployMockContract(owner, Incentivizer__factory.abi)

    productBase = await new Product__factory(owner).deploy()
    factory = await new Factory__factory(owner).deploy()
    await factory.initialize(collateral.address, incentivizer.address, productBase.address, treasury.address)
  })

  describe('#initialize', async () => {
    it('initialize with the correct variables set', async () => {
      expect(await factory.collateral()).to.equal(collateral.address)
      expect(await factory.incentivizer()).to.equal(incentivizer.address)
      expect(await factory.productBase()).to.equal(productBase.address)
      expect(await factory['owner()']()).to.equal(owner.address)
      expect(await factory['owner(uint256)'](0)).to.equal(owner.address)
      expect(await factory['treasury()']()).to.equal(treasury.address)
      expect(await factory['treasury(uint256)'](0)).to.equal(treasury.address)
      expect(await factory.fee()).to.equal(utils.parseEther('0.5'))
      expect(await factory.minFundingFee()).to.equal(utils.parseEther('0.1'))
      expect(await factory.initialized()).to.equal(true)
    })

    it('reverts if already initialized', async () => {
      await expect(
        factory.initialize(collateral.address, incentivizer.address, productBase.address, treasury.address),
      ).to.be.revertedWith('AlreadyInitializedError()')
    })
  })

  describe('#createController', async () => {
    it('creates the controller', async () => {
      const returnValue = await factory.callStatic.createController(controllerTreasury.address)
      await expect(factory.createController(controllerTreasury.address))
        .to.emit(factory, 'ControllerCreated')
        .withArgs(1, owner.address, controllerTreasury.address)

      expect(returnValue).to.equal(1)
      expect((await factory.controllers(1)).owner).to.equal(owner.address)
      expect((await factory.controllers(1)).treasury).to.equal(controllerTreasury.address)
      expect(await factory['owner(uint256)'](1)).to.equal(owner.address)
      expect(await factory['treasury(uint256)'](1)).to.equal(controllerTreasury.address)
    })
  })

  describe('#updateController', async () => {
    beforeEach(async () => {
      await factory.connect(user).createController(controllerTreasury.address)

      expect((await factory.controllers(1)).owner).to.equal(user.address)
      expect((await factory.controllers(1)).treasury).to.equal(controllerTreasury.address)
      expect(await factory['owner(uint256)'](1)).to.equal(user.address)
      expect(await factory['treasury(uint256)'](1)).to.equal(controllerTreasury.address)
    })

    it('updates the controller', async () => {
      await expect(
        factory.connect(user).updateController(1, {
          owner: owner.address,
          treasury: treasury.address,
        }),
      )
        .to.emit(factory, 'ControllerUpdated')
        .withArgs(1, owner.address, treasury.address)

      expect((await factory.controllers(1)).owner).to.equal(owner.address)
      expect((await factory.controllers(1)).treasury).to.equal(treasury.address)
      expect(await factory['owner(uint256)'](1)).to.equal(owner.address)
      expect(await factory['treasury(uint256)'](1)).to.equal(treasury.address)
    })

    it('reverts if not owner', async () => {
      await expect(
        factory.connect(owner).updateController(1, {
          owner: user.address,
          treasury: treasury.address,
        }),
      ).to.be.revertedWith('FactoryNotOwnerError(1)')
    })
  })

  describe('#createProduct', async () => {
    beforeEach(async () => {
      await factory.connect(user).createController(controllerTreasury.address)
    })

    it('creates the controller', async () => {
      await factory.updateAllowed(1, true)
      const productAddress = await factory.connect(user).callStatic.createProduct(1, productProvider.address)
      await expect(factory.connect(user).createProduct(1, productProvider.address))
        .to.emit(factory, 'ProductCreated')
        .withArgs(productAddress, productProvider.address)

      const productInstance = Product__factory.connect(productAddress, owner)
      expect(await productInstance.factory()).to.equal(factory.address)

      expect(await factory.controllerFor(productAddress)).to.equal(1)
      expect(await factory.isProduct(productAddress)).to.equal(true)
      expect(await factory['owner(address)'](productAddress)).to.equal(user.address)
      expect(await factory['treasury(address)'](productAddress)).to.equal(controllerTreasury.address)
    })

    it('creates the controller if globally allowed', async () => {
      await factory.updateAllowed(0, true)
      await factory.connect(user).createProduct(1, productProvider.address)
    })

    it('reverts if zero controller', async () => {
      await expect(factory.connect(owner).createProduct(0, productProvider.address)).to.be.revertedWith(
        'FactoryNoZeroControllerError()',
      )
    })

    it('reverts if not whitelisted', async () => {
      await expect(factory.connect(user).createProduct(1, productProvider.address)).to.be.revertedWith(
        'FactoryNotAllowedError()',
      )
    })
  })

  describe('#updatePauser', async () => {
    it('updates is paused', async () => {
      await expect(factory.updatePauser(user.address)).to.emit(factory, 'PauserUpdated').withArgs(user.address)

      expect(await factory.pauser()).to.equal(user.address)
    })

    it('reverts if not owner', async () => {
      await expect(factory.connect(user).updatePauser(user.address)).to.be.revertedWith('NotOwnerError(0)')
    })
  })

  describe('#updateIsPaused', async () => {
    it('updates is paused owner', async () => {
      await expect(factory.updateIsPaused(true)).to.emit(factory, 'IsPausedUpdated').withArgs(true)

      expect(await factory.isPaused()).to.equal(true)
    })

    it('updates is paused pauser', async () => {
      await factory.connect(owner).updatePauser(pauser.address)

      await expect(factory.connect(pauser).updateIsPaused(true)).to.emit(factory, 'IsPausedUpdated').withArgs(true)

      expect(await factory.isPaused()).to.equal(true)
    })

    it('reverts if not owner', async () => {
      await expect(factory.connect(user).updateIsPaused(true)).to.be.revertedWith(
        `FactoryNotPauserError("${user.address}")`,
      )
    })
  })

  describe('#updateCollateral', async () => {
    it('updates the collateral address', async () => {
      const newCollateral = await waffle.deployMockContract(owner, Collateral__factory.abi)
      await expect(factory.updateCollateral(newCollateral.address))
        .to.emit(factory, 'CollateralUpdated')
        .withArgs(newCollateral.address)

      expect(await factory.collateral()).to.equal(newCollateral.address)
    })

    it('reverts if not owner', async () => {
      const newCollateral = await waffle.deployMockContract(owner, Collateral__factory.abi)
      await expect(factory.connect(user).updateCollateral(newCollateral.address)).to.be.revertedWith(
        'FactoryNotOwnerError(0)',
      )
    })
  })

  describe('#updateIncentivizer', async () => {
    it('updates the collateral address', async () => {
      const newIncentivizer = await waffle.deployMockContract(owner, Incentivizer__factory.abi)
      await expect(factory.updateIncentivizer(newIncentivizer.address))
        .to.emit(factory, 'IncentivizerUpdated')
        .withArgs(newIncentivizer.address)

      expect(await factory.incentivizer()).to.equal(newIncentivizer.address)
    })

    it('reverts if not owner', async () => {
      const newIncentivizer = await waffle.deployMockContract(owner, Incentivizer__factory.abi)
      await expect(factory.connect(user).updateIncentivizer(newIncentivizer.address)).to.be.revertedWith(
        'FactoryNotOwnerError(0)',
      )
    })
  })

  describe('#updateProductBase', async () => {
    it('updates the collateral address', async () => {
      const newProductBase = await waffle.deployMockContract(owner, Product__factory.abi)
      await expect(factory.updateProductBase(newProductBase.address))
        .to.emit(factory, 'ProductBaseUpdated')
        .withArgs(newProductBase.address)

      expect(await factory.productBase()).to.equal(newProductBase.address)
    })

    it('reverts if not owner', async () => {
      const newProductBase = await waffle.deployMockContract(owner, Product__factory.abi)
      await expect(factory.connect(user).updateProductBase(newProductBase.address)).to.be.revertedWith(
        'FactoryNotOwnerError(0)',
      )
    })
  })

  describe('#updateFee', async () => {
    it('updates the collateral address', async () => {
      const newFee = utils.parseEther('0.5')
      await expect(factory.updateFee(newFee)).to.emit(factory, 'FeeUpdated').withArgs(newFee)

      expect(await factory.fee()).to.equal(newFee)
    })

    it('reverts if not owner', async () => {
      const newFee = utils.parseEther('0.5')
      await expect(factory.connect(user).updateFee(newFee)).to.be.revertedWith('FactoryNotOwnerError(0)')
    })
  })

  describe('#updateMinFundingFee', async () => {
    it('updates the collateral address', async () => {
      const newMinFundingFee = utils.parseEther('0.1')
      await expect(factory.updateMinFundingFee(newMinFundingFee))
        .to.emit(factory, 'MinFundingFeeUpdated')
        .withArgs(newMinFundingFee)

      expect(await factory.minFundingFee()).to.equal(newMinFundingFee)
    })

    it('reverts if not owner', async () => {
      const newMinFundingFee = utils.parseEther('0.1')
      await expect(factory.connect(user).updateMinFundingFee(newMinFundingFee)).to.be.revertedWith(
        'FactoryNotOwnerError(0)',
      )
    })
  })

  describe('#updateMinCollateral', async () => {
    it('updates the collateral address', async () => {
      const newMinCollateral = utils.parseEther('1000')
      await expect(factory.updateMinCollateral(newMinCollateral))
        .to.emit(factory, 'MinCollateralUpdated')
        .withArgs(newMinCollateral)

      expect(await factory.minCollateral()).to.equal(newMinCollateral)
    })

    it('reverts if not owner', async () => {
      const newMinCollateral = utils.parseEther('1000')
      await expect(factory.connect(user).updateMinCollateral(newMinCollateral)).to.be.revertedWith(
        'FactoryNotOwnerError(0)',
      )
    })
  })

  describe('#updateAllowed', async () => {
    it('updates the collateral address', async () => {
      await expect(factory.updateAllowed(1, true)).to.emit(factory, 'AllowedUpdated').withArgs(1, true)

      expect(await factory.allowed(1)).to.equal(true)
    })

    it('reverts if not owner', async () => {
      await expect(factory.connect(user).updateAllowed(1, true)).to.be.revertedWith('FactoryNotOwnerError(0)')
    })
  })
})
