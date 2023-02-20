const { expect } = require('chai');
const { parseEther, parseUnits, hexConcat } = require('ethers/lib/utils');

const {
  prepare,
  deploy,
  solution,
  timestamp,
  Uint16Max,
  meta,
  fork,
  unfork,
} = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id, formatBytes32String, keccak256 } = require('ethers/lib/utils');

const RANDOM_ADDRESS = '0xD4Ae0DD720f1690AB506A22c6e7da6408c5e2313';

const maxTokens = parseUnits('100000000000', 6);
describe('Manager', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ManagerTest', 'ERC20Mock6d', 'PayableFail']);

    await deploy(this, [['manager', this.ManagerTest, []]]);
    await deploy(this, [['payableFail', this.PayableFail, []]]);

    await deploy(this, [['token1', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['token2', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await timeTraveler.snapshot();
  });
  describe('Test set core', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Not setup', async function () {
      expect(await this.manager.viewSherlockCore()).to.eq(constants.AddressZero);
      await expect(this.manager.revertsIfNotCore()).to.be.revertedWith('InvalidSender()');
    });
    it('Set core fail', async function () {
      await expect(this.manager.setSherlockCoreAddress(constants.AddressZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Set core', async function () {
      this.t1 = await meta(this.manager.setSherlockCoreAddress(this.alice.address));

      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('SherlockCoreSet');
      expect(this.t1.events[0].args.sherlock).to.eq(this.alice.address);
    });
    it('Setup', async function () {
      expect(await this.manager.viewSherlockCore()).to.eq(this.alice.address);
      await this.manager.revertsIfNotCore();
      await expect(this.manager.connect(this.bob).revertsIfNotCore()).to.be.revertedWith(
        'InvalidSender()',
      );
    });
    it('Set core again', async function () {
      await expect(this.manager.setSherlockCoreAddress(this.alice.address)).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
  });
  describe('Test sweep', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseEther('1');
      await network.provider.send('hardhat_setBalance', [
        this.manager.address,
        '0xDE0B6B3A7640000',
      ]);
      await this.token1.transfer(this.manager.address, maxTokens);
      await this.token2.transfer(this.manager.address, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.token1.balanceOf(RANDOM_ADDRESS)).to.eq(0);
      expect(await this.token2.balanceOf(RANDOM_ADDRESS)).to.eq(0);
      expect(await ethers.provider.getBalance(RANDOM_ADDRESS)).to.eq(0);
    });
    it('Do', async function () {
      await this.manager.sweep(RANDOM_ADDRESS, [this.token1.address]);
    });
    it('Verify state', async function () {
      expect(await this.token1.balanceOf(RANDOM_ADDRESS)).to.eq(maxTokens);
      expect(await this.token2.balanceOf(RANDOM_ADDRESS)).to.eq(0);
      expect(await ethers.provider.getBalance(RANDOM_ADDRESS)).to.eq(this.amount);
    });
    it('Do again', async function () {
      await this.manager.sweep(RANDOM_ADDRESS, [this.token2.address]);
    });
    it('Verify state', async function () {
      expect(await this.token1.balanceOf(RANDOM_ADDRESS)).to.eq(maxTokens);
      expect(await this.token2.balanceOf(RANDOM_ADDRESS)).to.eq(maxTokens);
      expect(await ethers.provider.getBalance(RANDOM_ADDRESS)).to.eq(this.amount);
    });
    it('Do fail', async function () {
      await expect(this.manager.sweep(this.payableFail.address, [])).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
  });
});
