const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('PoolStrategy', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, [
      'ERC20Mock',
      'ERC20Mock6d',
      'ERC20Mock8d',
      'NativeLock',
      'ForeignLock',
      'StrategyMock',
    ]);

    await solution(this, 'sl', this.gov);
    await deploy(this, [['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]]]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['strategyMockA', this.StrategyMock, [this.tokenA.address, this.sl.address]],
      ['strategyMockA2', this.StrategyMock, [this.tokenA.address, this.sl.address]],
    ]);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    await timeTraveler.snapshot();
  });
  describe('strategyRemove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.sl.getStrategy(this.tokenA.address)).to.eq(this.strategyMockA.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).strategyRemove(this.tokenA.address);
      expect(await this.sl.getStrategy(this.tokenA.address)).to.eq(constants.AddressZero);
    });
    it('Do again', async function () {
      await expect(this.sl.c(this.gov).strategyRemove(this.tokenA.address)).to.be.revertedWith(
        'ZERO',
      );
    });
  });
  describe('strategyUpdate()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getStrategy(this.tokenA.address)).to.eq(constants.AddressZero);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address);
      expect(await this.sl.getStrategy(this.tokenA.address)).to.eq(this.strategyMockA.address);
    });
    it('Do again', async function () {
      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA2.address, this.tokenA.address);
      expect(await this.sl.getStrategy(this.tokenA.address)).to.eq(this.strategyMockA2.address);
    });
    it('Do again (active balance)', async function () {
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      await this.sl.c(this.gov).strategyDeposit(parseEther('3'), this.tokenA.address);

      await expect(
        this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address),
      ).to.be.revertedWith('NOT_EMPTY');
    });
  });
  describe('strategyDeposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.sl.getUnactivatedStakersPoolBalance(this.tokenA.address)).to.eq(
        parseEther('10'),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.strategyMockA.balanceOf()).to.eq(0);

      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.tokenA.balanceOf(this.strategyMockA.address)).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).strategyDeposit(parseEther('3'), this.tokenA.address);

      expect(await this.sl.getUnactivatedStakersPoolBalance(this.tokenA.address)).to.eq(
        parseEther('7'),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.strategyMockA.balanceOf()).to.eq(parseEther('3'));

      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('7'));
      expect(await this.tokenA.balanceOf(this.strategyMockA.address)).to.eq(parseEther('3'));
    });
  });
  describe('strategyWithdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).strategyDeposit(parseEther('3'), this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.sl.getUnactivatedStakersPoolBalance(this.tokenA.address)).to.eq(
        parseEther('7'),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.strategyMockA.balanceOf()).to.eq(parseEther('3'));

      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('7'));
      expect(await this.tokenA.balanceOf(this.strategyMockA.address)).to.eq(parseEther('3'));
    });
    it('Do', async function () {
      await this.sl.c(this.gov).strategyWithdraw(parseEther('2'), this.tokenA.address);

      expect(await this.sl.getUnactivatedStakersPoolBalance(this.tokenA.address)).to.eq(
        parseEther('9'),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.strategyMockA.balanceOf()).to.eq(parseEther('1'));

      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('9'));
      expect(await this.tokenA.balanceOf(this.strategyMockA.address)).to.eq(parseEther('1'));
    });
  });
  describe('strategyWithdrawAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).strategyDeposit(parseEther('3'), this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.sl.getUnactivatedStakersPoolBalance(this.tokenA.address)).to.eq(
        parseEther('7'),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.strategyMockA.balanceOf()).to.eq(parseEther('3'));

      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('7'));
      expect(await this.tokenA.balanceOf(this.strategyMockA.address)).to.eq(parseEther('3'));
    });
    it('Do', async function () {
      await this.sl.c(this.gov).strategyWithdrawAll(this.tokenA.address);

      expect(await this.sl.getUnactivatedStakersPoolBalance(this.tokenA.address)).to.eq(
        parseEther('10'),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.strategyMockA.balanceOf()).to.eq(parseEther('0'));

      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.tokenA.balanceOf(this.strategyMockA.address)).to.eq(0);
    });
  });
});
