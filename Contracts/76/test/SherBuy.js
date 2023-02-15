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

describe('SherBuy', function () {
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

    this.claimableAt = ts.time.add(weeks1 + 60).toNumber(); // 1 week and 60 seconds after now
    await deploy(this, [['sherClaim', this.SherClaim, [this.sher.address, this.claimableAt]]]);

    await deploy(this, [
      [
        'sherBuySimple',
        this.SherBuy,
        [
          this.sher.address,
          this.token.address,
          parseUnits('1', 6),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ],
      ],
    ]);
    await deploy(this, [
      [
        'sherBuyComplex',
        this.SherBuy,
        [
          this.sher.address,
          this.token.address,
          parseUnits('10', 6),
          parseUnits('0.1', 6),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ],
      ],
    ]);

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Zero sher', async function () {
      await expect(
        this.SherBuy.deploy(
          constants.AddressZero,
          this.token.address,
          parseUnits('1', 6),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero token', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          constants.AddressZero,
          parseUnits('1', 6),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero rate', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          0,
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero rate', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 6),
          0,
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero sherlock', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 6),
          parseUnits('1', 6),
          constants.AddressZero,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero receiver', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 6),
          parseUnits('1', 6),
          this.sherlock.address,
          constants.AddressZero,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero claim', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 6),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
          constants.AddressZero,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Invalid stake rate', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 6).add(9999),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('InvalidState()');
    });
    it('Invalid buy rate', async function () {
      await expect(
        this.SherBuy.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 6),
          parseUnits('1', 6).add(9999),
          this.sherlock.address,
          this.carol.address,
          this.sherClaim.address,
        ),
      ).to.be.revertedWith('InvalidState()');
    });
  });
  describe('active()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('default', async function () {
      expect(await this.sherBuySimple.active()).to.eq(true);
    });
    it('skip time t-1', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt - 1);
      await timeTraveler.mine(1);

      expect(await this.sherBuySimple.active()).to.eq(true);
    });
    it('skip time t', async function () {
      await timeTraveler.mine(1);

      expect(await this.sherBuySimple.active()).to.eq(false);
    });
    it('skip time t+1', async function () {
      await timeTraveler.mine(1);

      expect(await this.sherBuySimple.active()).to.eq(false);
    });
  });
  describe('viewCapitalRequirements() - Simple', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('zero amount', async function () {
      await expect(this.sherBuySimple.viewCapitalRequirements(0)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('zero sher in contract', async function () {
      await expect(this.sherBuySimple.viewCapitalRequirements(parseUnits('1'))).to.be.revertedWith(
        'SoldOut()',
      );
    });
    it('10 sher in contract, test 1', async function () {
      await this.sher.transfer(this.sherBuySimple.address, parseEther('10'));

      const data = await this.sherBuySimple.viewCapitalRequirements(parseUnits('1'));
      expect(data.sherAmount).to.eq(parseUnits('1'));
      expect(data.stake).to.eq(parseUnits('1', 6));
      expect(data.price).to.eq(parseUnits('1', 6));
    });
    it('10 sher in contract, test 100', async function () {
      const data = await this.sherBuySimple.viewCapitalRequirements(parseUnits('100'));
      expect(data.sherAmount).to.eq(parseUnits('10'));
      expect(data.stake).to.eq(parseUnits('10', 6));
      expect(data.price).to.eq(parseUnits('10', 6));
    });
    it('Test invalid', async function () {
      await expect(
        this.sherBuySimple.viewCapitalRequirements(parseUnits('1.001', 18)),
      ).to.be.revertedWith('InvalidAmount()');
    });
    it('Test admin error', async function () {
      await this.sher.transfer(this.sherBuySimple.address, parseEther('0.00001'));

      await expect(
        this.sherBuySimple.viewCapitalRequirements(parseUnits('100', 18)),
      ).to.be.revertedWith('InvalidAmount()');
    });
    it('not active', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt);
      await timeTraveler.mine(1);

      await expect(this.sherBuySimple.viewCapitalRequirements(1)).to.be.revertedWith(
        'InvalidState()',
      );
    });
  });
  describe('viewCapitalRequirements() - Complex', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sher.transfer(this.sherBuyComplex.address, parseEther('10'));
    });
    it('10 sher in contract, test 1', async function () {
      const data = await this.sherBuyComplex.viewCapitalRequirements(parseUnits('1'));
      expect(data.sherAmount).to.eq(parseUnits('1'));
      expect(data.stake).to.eq(parseUnits('10', 6));
      expect(data.price).to.eq(parseUnits('0.1', 6));
    });
    it('10 sher in contract, test 100', async function () {
      const data = await this.sherBuyComplex.viewCapitalRequirements(parseUnits('100'));
      expect(data.sherAmount).to.eq(parseUnits('10'));
      expect(data.stake).to.eq(parseUnits('100', 6));
      expect(data.price).to.eq(parseUnits('1', 6));
    });
  });
  describe('execute() - simple', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sher.transfer(this.sherBuySimple.address, parseEther('10'));
      await this.token.approve(this.sherBuySimple.address, maxTokens);
    });
    it('zero amount', async function () {
      await expect(this.sherBuySimple.execute(0)).to.be.revertedWith('ZeroArgument()');
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherBuySimple.address)).to.eq(0);
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.alice.address)).to.eq(maxTokens);

      await expect(this.sherlock.ownerOf(1)).to.be.reverted;
      expect(await this.sherClaim.userClaims(this.alice.address)).to.be.eq(0);
    });
    it('Do', async function () {
      const SHER = parseUnits('5');
      const USDC_STAKE = parseUnits('5', 6);
      const USDC_BUY = parseUnits('5', 6);
      this.t0 = await meta(this.sherBuySimple.execute(SHER));

      expect(this.t0.events.length).to.eq(13);
      expect(this.t0.events[12].event).to.eq('Purchase');
      expect(this.t0.events[12].args.buyer).to.eq(this.alice.address);
      expect(this.t0.events[12].args.amount).to.eq(SHER);
      expect(this.t0.events[12].args.staked).to.eq(USDC_STAKE);
      expect(this.t0.events[12].args.paid).to.eq(USDC_BUY);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(USDC_STAKE);
      expect(await this.token.balanceOf(this.sherBuySimple.address)).to.eq(0);
      expect(await this.token.balanceOf(this.carol.address)).to.eq(USDC_BUY);
      expect(await this.token.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(USDC_STAKE).sub(USDC_BUY),
      );

      expect(await this.sherlock.ownerOf(1)).to.be.eq(this.alice.address);
      expect(await this.sherClaim.userClaims(this.alice.address)).to.be.eq(SHER);
    });
    it('not active', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt);

      await expect(this.sherBuySimple.execute(1)).to.be.revertedWith('InvalidState()');
    });
  });
  describe('execute() - complex', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sher.transfer(this.sherBuyComplex.address, parseEther('1000'));
      await this.token.approve(this.sherBuyComplex.address, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherBuyComplex.address)).to.eq(0);
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.alice.address)).to.eq(maxTokens);

      await expect(this.sherlock.ownerOf(1)).to.be.reverted;
      expect(await this.sherClaim.userClaims(this.alice.address)).to.be.eq(0);
    });
    it('Do', async function () {
      const SHER = parseUnits('500');
      const USDC_STAKE = parseUnits('5000', 6);
      const USDC_BUY = parseUnits('50', 6);
      this.t0 = await meta(this.sherBuyComplex.execute(SHER));

      expect(this.t0.events.length).to.eq(13);
      expect(this.t0.events[12].event).to.eq('Purchase');
      expect(this.t0.events[12].args.buyer).to.eq(this.alice.address);
      expect(this.t0.events[12].args.amount).to.eq(SHER);
      expect(this.t0.events[12].args.staked).to.eq(USDC_STAKE);
      expect(this.t0.events[12].args.paid).to.eq(USDC_BUY);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(USDC_STAKE);
      expect(await this.token.balanceOf(this.sherBuyComplex.address)).to.eq(0);
      expect(await this.token.balanceOf(this.carol.address)).to.eq(USDC_BUY);
      expect(await this.token.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(USDC_STAKE).sub(USDC_BUY),
      );

      expect(await this.sherlock.ownerOf(1)).to.be.eq(this.alice.address);
      expect(await this.sherClaim.userClaims(this.alice.address)).to.be.eq(SHER);
    });
  });
  describe('sweepTokens()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sher.transfer(this.sherBuyComplex.address, parseEther('1000'));
    });
    it('Initial state', async function () {
      await expect(
        this.sherBuyComplex.connect(this.carol).sweepTokens([this.sher.address]),
      ).to.be.revertedWith('InvalidState()');
      await expect(
        this.sherBuyComplex.connect(this.bob).sweepTokens([this.sher.address]),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Do', async function () {
      await timeTraveler.setNextBlockTimestamp(this.claimableAt);

      expect(await this.sher.balanceOf(this.sherBuyComplex.address)).to.eq(parseEther('1000'));
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);

      await this.sherBuyComplex.connect(this.carol).sweepTokens([this.sher.address]);

      expect(await this.sher.balanceOf(this.sherBuyComplex.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(parseEther('1000'));
    });
  });
});
