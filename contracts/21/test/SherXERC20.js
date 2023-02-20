const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { parse } = require('dotenv');

describe('SherXERC20', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await prepare(this, []);
    await solution(this, 'sl', this.gov);
    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    expect(await this.sl.name()).to.eq('SHERX Token');
    expect(await this.sl.symbol()).to.eq('SHERX');
    expect(await this.sl.decimals()).to.eq(18);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(0);
    expect(await this.sl.balanceOf(this.alice.address)).to.eq(0);
    expect(await this.sl.totalSupply()).to.eq(0);
  });
  it('initializeSherXERC20()', async function () {
    await this.sl.c(this.gov).initializeSherXERC20('Sherlock ETF 2', 'SHERX 2');
    expect(await this.sl.name()).to.eq('Sherlock ETF 2');
    expect(await this.sl.symbol()).to.eq('SHERX 2');
  });
  it('increaseApproval()', async function () {
    await this.sl.increaseApproval(this.bob.address, 10);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(10);
    await this.sl.increaseApproval(this.bob.address, 10);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(20);
  });
  it('decreaseApproval()', async function () {
    await this.sl.decreaseApproval(this.bob.address, 5);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(15);
    await this.sl.decreaseApproval(this.bob.address, 25);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(0);
  });
  it('approve()', async function () {
    await this.sl.approve(this.bob.address, 10);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(10);
    await this.sl.approve(this.bob.address, 10);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(10);
  });
});

describe('SherXERC20 - Active', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'ERC20Mock6d', 'ERC20Mock8d', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]]]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockX', this.NativeLock, ['Lock TokenX', 'lockX', this.sl.address]],
    ]);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    // Add SherX token as valid tokens
    await this.sl
      .c(this.gov)
      .tokenInit(this.sl.address, this.gov.address, this.lockX.address, true);

    // Add protocol and allow to pay in tokenA
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    // Deposit tokenA for protocolX
    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);

    // Distribute SherX to tokenA stakers
    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

    // Stake token A
    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    // Start the initial SherX minting
    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
        this.protocolX,
        [this.tokenA.address],
        [parseEther('1')],
        [parseEther('1')],
      );

    // Stop the minting
    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
        this.protocolX,
        [this.tokenA.address],
        [0],
        [parseEther('1')],
      );

    // Harvest SherX tokens
    await this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);
    // Unstake SherX tokens
    await this.sl.c(this.gov).setUnstakeWindow(10);
    await this.lockX.approve(this.sl.address, parseEther('10000'));
    await this.sl.activateCooldown(parseEther('1'), this.sl.address);
    await this.sl.unstake(0, this.alice.address, this.sl.address);
    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    expect(await this.sl.name()).to.eq('SHERX Token');
    expect(await this.sl.symbol()).to.eq('SHERX');
    expect(await this.sl.decimals()).to.eq(18);
    expect(await this.sl.allowance(this.alice.address, this.bob.address)).to.eq(0);
    expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('1'));
    expect(await this.sl.balanceOf(this.bob.address)).to.eq(0);
    expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
  });
  describe('transfer()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl.transfer(this.bob.address, parseEther('0.2'));
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('0.8'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0.2'));
    });
  });
  describe('transferFrom()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Fail', async function () {
      await expect(
        this.sl.c(this.carol).transferFrom(this.alice.address, this.bob.address, parseEther('0.2')),
      ).to.be.reverted;
    });
    it('Fail again', async function () {
      await this.sl.approve(this.carol.address, parseEther('0.1'));
      await expect(
        this.sl.c(this.carol).transferFrom(this.alice.address, this.bob.address, parseEther('0.2')),
      ).to.be.reverted;
    });
    it('Do', async function () {
      await this.sl.approve(this.carol.address, parseEther('0.3'));
      await this.sl
        .c(this.carol)
        .transferFrom(this.alice.address, this.bob.address, parseEther('0.1'));

      expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('0.9'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0.1'));
      expect(await this.sl.allowance(this.alice.address, this.carol.address)).to.eq(
        parseEther('0.2'),
      );
    });
    it('Do again', async function () {
      await this.sl.approve(this.carol.address, constants.MaxUint256);
      await this.sl
        .c(this.carol)
        .transferFrom(this.alice.address, this.bob.address, parseEther('0.05'));

      expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('0.85'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0.15'));
      expect(await this.sl.allowance(this.alice.address, this.carol.address)).to.eq(
        constants.MaxUint256,
      );
    });
  });
});
