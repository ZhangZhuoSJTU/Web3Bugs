const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

const maxTokens = parseUnits('100000000000', 6);
const billie = parseUnits('1000000000', 6);
describe('SherDistributionManager, 6 dec', function () {
  timeTraveler = new TimeTraveler(network.provider);

  before(async function () {
    await prepare(this, ['SherDistributionManager', 'ERC20Mock6d', 'SherlockMock']);

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [
      ['sher', this.ERC20Mock6d, ['USDC Token', 'USDC', parseEther('100000000')]],
    ]);
    await deploy(this, [
      [
        'sdm',
        this.SherDistributionManager,
        [parseUnits('100', 6), parseUnits('600', 6), parseUnits('5', 18), this.sher.address],
      ],
    ]);
    await deploy(this, [
      [
        'sdmMAX',
        this.SherDistributionManager,
        [billie.mul(100), billie.mul(10000), parseUnits('500', 18), this.sher.address],
      ],
    ]);
    await deploy(this, [['sherlock', this.SherlockMock, []]]);

    await timeTraveler.snapshot();
  });
  describe('constructor', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Success', async function () {
      await this.SherDistributionManager.deploy(100, 1000, 1, this.sher.address);
    });
    it('Invalid argument', async function () {
      await expect(
        this.SherDistributionManager.deploy(1000, 1000, 1, this.sher.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero rate', async function () {
      await expect(
        this.SherDistributionManager.deploy(100, 1000, 0, this.sher.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero sher', async function () {
      await expect(
        this.SherDistributionManager.deploy(100, 1000, 1, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('calcReward()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      // @note in production _amount will be super small and period way larger
      expect(await this.sdm.calcReward(0, 0, 1)).to.eq(0);
      expect(await this.sdm.calcReward(parseUnits('600', 6), parseUnits('50', 6), 1)).to.eq(0);
      expect(await this.sdm.calcReward(parseUnits('1000', 6), parseUnits('50', 6), 1)).to.eq(0);

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('50', 6), 1)).to.eq(
        parseUnits('250', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('50', 6), 2)).to.eq(
        parseUnits('500', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('100', 6), 1)).to.eq(
        parseUnits('500', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('200', 6), 1)).to.eq(
        parseUnits('950', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('100', 6), parseUnits('100', 6), 1)).to.eq(
        parseUnits('450', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('500', 6), parseUnits('100', 6), 1)).to.eq(
        parseUnits('50', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('10000', 6), 1)).to.eq(
        parseUnits('1750', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('10000', 6), 2)).to.eq(
        parseUnits('3500', 18),
      );

      expect(await this.sdm.calcReward(parseUnits('0', 6), parseUnits('10000', 6), 20)).to.eq(
        parseUnits('35000', 18),
      );

      // nowwhere near overflow
      expect(await this.sdmMAX.calcReward(parseUnits('0', 6), billie.mul(10000), 1)).to.eq(
        parseUnits('2525000000000000', 18),
      );
    });
  });
  describe('pullReward()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sherlock.setToken(this.erc20.address);
    });
    it('Initial', async function () {
      await expect(
        this.sdm.pullReward(parseUnits('100', 6), 1, 1, this.bob.address),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Set', async function () {
      await this.sherlock.updateSherDistributionManager(this.sdm.address);
      await this.sdm.setSherlockCoreAddress(this.sherlock.address);

      await expect(
        this.sdm.pullReward(parseUnits('100', 6), 1, 1, this.bob.address),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Set', async function () {
      this.amount = parseUnits('100', 6);

      // deposit into sherlock
      await this.erc20.transfer(this.sherlock.address, this.amount);
      // deposit into sher distribution manager
      await this.sher.transfer(this.sdm.address, parseEther('500'));
      // calc reward
      expect(await this.sdm.calcReward(0, this.amount, 1)).to.eq(parseEther('500'));

      expect(await this.sher.balanceOf(this.sherlock.address)).to.eq(0);
      await this.sherlock.pullSherReward(this.amount, 1, 1, this.bob.address);
      expect(await this.sher.balanceOf(this.sherlock.address)).to.eq(parseEther('500'));
    });
    it('Do illuiqid', async function () {
      await expect(this.sherlock.pullSherReward(1, 1, 1, this.bob.address)).to.be.reverted;
    });
  });
  describe('sweep, eol', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      this.balance = parseUnits('10000', 6);
      this.erc20.transfer(this.sdm.address, this.balance);

      await expect(this.sdm.isActive()).to.be.revertedWith(
        'Transaction reverted: function returned an unexpected amount of data',
      );
      await expect(this.sdm.sweep(this.bob.address, [this.erc20.address])).to.be.revertedWith(
        'Transaction reverted: function returned an unexpected amount of data',
      );

      expect(await this.erc20.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do zero', async function () {
      await expect(this.sdm.sweep(constants.AddressZero, [this.erc20.address])).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Set core', async function () {
      await this.sherlock.updateSherDistributionManager(this.sdm.address);
      await this.sdm.setSherlockCoreAddress(this.sherlock.address);

      expect(await this.sdm.isActive()).to.eq(true);
      await expect(this.sdm.sweep(this.bob.address, [this.erc20.address])).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('Do', async function () {
      await this.sherlock.updateSherDistributionManager(constants.AddressZero);

      expect(await this.sdm.isActive()).to.eq(false);
      await this.sdm.sweep(this.bob.address, [this.erc20.address]);

      expect(await this.erc20.balanceOf(this.bob.address)).to.eq(this.balance);
    });
  });
});
