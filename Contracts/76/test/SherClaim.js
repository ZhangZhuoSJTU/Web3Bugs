const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const maxTokens2 = parseUnits('100000000000', 18);

const weeks1 = 60 * 60 * 24 * 7 * 1;
const weeks2 = 60 * 60 * 24 * 7 * 2;
const weeks12 = 60 * 60 * 24 * 7 * 12;

describe('SherClaim', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
      'SherBuy',
      'SherClaim',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens2]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [
      ['sherdist', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);

    await deploy(this, [
      [
        'sherlock',
        this.Sherlock,
        [
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ],
      ],
    ]);
    var ts = await meta(this.sherlock.enableStakingPeriod(weeks1 * 26));

    this.claimableAtBottom = ts.time.add(weeks1 + 60).toNumber();
    this.claimableAtCeiling = ts.time.add(weeks2 + 60).toNumber();

    this.claimableAt = ts.time.add(weeks1 + 60).toNumber(); // 1 week and 60 seconds after now
    await deploy(this, [['sherClaim', this.SherClaim, [this.sher.address, this.claimableAt]]]);

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Zero sher', async function () {
      await expect(
        this.SherClaim.deploy(constants.AddressZero, this.claimableAt),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Period bottom', async function () {
      await expect(
        this.SherClaim.deploy(this.sher.address, this.claimableAtBottom - 100),
      ).to.be.revertedWith('InvalidState()');
    });
    it('Period ceiling', async function () {
      await expect(
        this.SherClaim.deploy(this.sher.address, this.claimableAtCeiling + 100),
      ).to.be.revertedWith('InvalidState()');
    });
  });
  describe('active()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('default', async function () {
      expect(await this.sherClaim.active()).to.eq(false);
    });
    it('skip time t-1', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt - 1);
      await timeTraveler.mine(1);

      expect(await this.sherClaim.active()).to.eq(false);
    });
    it('skip time t', async function () {
      await timeTraveler.mine(1);

      expect(await this.sherClaim.active()).to.eq(true);
    });
    it('skip time t+1', async function () {
      await timeTraveler.mine(1);

      expect(await this.sherClaim.active()).to.eq(true);
    });
  });
  describe('add()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sher.approve(this.sherClaim.address, maxTokens2);
    });
    it('Zero user', async function () {
      await expect(this.sherClaim.add(constants.AddressZero, 1)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Zero amount', async function () {
      await expect(this.sherClaim.add(this.alice.address, 0)).to.be.revertedWith('ZeroArgument()');
    });
    it('Do', async function () {
      const amount = parseEther('10');
      expect(await this.sher.balanceOf(this.alice.address)).to.eq(maxTokens2);
      expect(await this.sher.balanceOf(this.sherClaim.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sherClaim.userClaims(this.carol.address)).to.eq(0);

      this.t0 = await meta(this.sherClaim.add(this.carol.address, amount));
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[2].event).to.eq('Add');
      expect(this.t0.events[2].args.sender).to.eq(this.alice.address);
      expect(this.t0.events[2].args.account).to.eq(this.carol.address);
      expect(this.t0.events[2].args.amount).to.eq(amount);

      expect(await this.sher.balanceOf(this.alice.address)).to.eq(maxTokens2.sub(amount));
      expect(await this.sher.balanceOf(this.sherClaim.address)).to.eq(amount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sherClaim.userClaims(this.carol.address)).to.eq(amount);
    });
    it('Do again', async function () {
      const amount = parseEther('10');

      this.t0 = await meta(this.sherClaim.add(this.carol.address, amount));
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[2].event).to.eq('Add');
      expect(this.t0.events[2].args.sender).to.eq(this.alice.address);
      expect(this.t0.events[2].args.account).to.eq(this.carol.address);
      expect(this.t0.events[2].args.amount).to.eq(amount);

      expect(await this.sher.balanceOf(this.alice.address)).to.eq(
        maxTokens2.sub(amount).sub(amount),
      );
      expect(await this.sher.balanceOf(this.sherClaim.address)).to.eq(amount.mul(2));
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sherClaim.userClaims(this.carol.address)).to.eq(amount.mul(2));
    });
    it('Invalid state', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt);

      await expect(this.sherClaim.add(this.carol.address, 1)).to.be.revertedWith('InvalidState()');
    });
  });
  describe('claim()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sher.approve(this.sherClaim.address, maxTokens2);

      this.amount = parseEther('10');
      await this.sherClaim.add(this.carol.address, this.amount);
    });
    it('Invalid state', async function () {
      await expect(this.sherClaim.connect(this.carol).claim()).to.be.revertedWith('InvalidState()');
    });
    it('Zero amount', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt);
      await expect(this.sherClaim.connect(this.alice).claim()).to.be.revertedWith(
        'InvalidAmount()',
      );
    });
    it('Do', async function () {
      expect(await this.sher.balanceOf(this.alice.address)).to.eq(maxTokens2.sub(this.amount));
      expect(await this.sher.balanceOf(this.sherClaim.address)).to.eq(this.amount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sherClaim.userClaims(this.carol.address)).to.eq(this.amount);

      this.t0 = await meta(this.sherClaim.connect(this.carol).claim());
      expect(this.t0.events.length).to.eq(2);
      expect(this.t0.events[1].event).to.eq('Claim');
      expect(this.t0.events[1].args.account).to.eq(this.carol.address);
      expect(this.t0.events[1].args.amount).to.eq(this.amount);

      expect(await this.sher.balanceOf(this.alice.address)).to.eq(maxTokens2.sub(this.amount));
      expect(await this.sher.balanceOf(this.sherClaim.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(this.amount);
      expect(await this.sherClaim.userClaims(this.carol.address)).to.eq(0);
    });
    it('Zero amount', async function () {
      await expect(this.sherClaim.connect(this.carol).claim()).to.be.revertedWith(
        'InvalidAmount()',
      );
    });
  });
});
