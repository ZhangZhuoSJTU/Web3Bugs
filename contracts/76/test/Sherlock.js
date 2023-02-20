const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const maxTokens2 = parseEther('100000000000', 18);

const weeks1 = 60 * 60 * 24 * 7 * 1;
const weeks2 = 60 * 60 * 24 * 7 * 2;
const weeks12 = 60 * 60 * 24 * 7 * 12;

describe('Sherlock ─ Stateless', function () {
  before(async function () {
    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['strategy2', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['protmanager2', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [
      ['sherdist', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);
    await deploy(this, [
      ['sherdist2', this.SherDistributionMock, [this.token.address, this.sher.address]],
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
  });
  describe('constructor', function () {
    it('Zero token', async function () {
      await expect(
        this.Sherlock.deploy(
          constants.AddressZero,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero sher', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          constants.AddressZero,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero strategy', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          constants.AddressZero,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero sherDistributionManager', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          constants.AddressZero,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero nostaker', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          constants.AddressZero,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero protocol manager', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          constants.AddressZero,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero claim manager', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          constants.AddressZero,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero periods', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [0, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same periods', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [20, 20],
        ),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('enableStakingPeriod()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).enableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Zero period', async function () {
      await expect(this.sherlock.enableStakingPeriod(0)).to.be.revertedWith('ZeroArgument()');
    });
    it('Invalid period', async function () {
      await expect(this.sherlock.enableStakingPeriod(10)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('disableStakingPeriod()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).disableStakingPeriod(10)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid period', async function () {
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateSherDistributionManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateSherDistributionManager(this.sherdist2.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero manager', async function () {
      await expect(
        this.sherlock.updateSherDistributionManager(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same manager', async function () {
      await expect(
        this.sherlock.updateSherDistributionManager(this.sherdist.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('removeSherDistributionManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).removeSherDistributionManager(),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Success', async function () {
      await this.sherlock.removeSherDistributionManager();
    });
    it('Do again', async function () {
      await expect(this.sherlock.removeSherDistributionManager()).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
  });
  describe('updateNonStakersAddress()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateNonStakersAddress(this.carol.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(this.sherlock.updateNonStakersAddress(constants.AddressZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Same argument', async function () {
      await expect(
        this.sherlock.updateNonStakersAddress(this.nonStaker.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateSherlockProtocolManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateSherlockProtocolManager(this.protmanager2.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(
        this.sherlock.updateSherlockProtocolManager(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same argument', async function () {
      await expect(
        this.sherlock.updateSherlockProtocolManager(this.protmanager.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateSherlockClaimManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateSherlockClaimManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(
        this.sherlock.updateSherlockClaimManager(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same argument', async function () {
      await expect(
        this.sherlock.updateSherlockClaimManager(this.claimManager.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateYieldStrategy()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateYieldStrategy(this.strategy2.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(this.sherlock.updateYieldStrategy(constants.AddressZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Same argument', async function () {
      await expect(this.sherlock.updateYieldStrategy(this.strategy.address)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
  });
  describe('yieldStrategyDeposit()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).yieldStrategyDeposit(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid amount', async function () {
      await expect(this.sherlock.yieldStrategyDeposit(0)).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('yieldStrategyWithdraw()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).yieldStrategyWithdraw(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid amount', async function () {
      await expect(this.sherlock.yieldStrategyWithdraw(0)).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('yieldStrategyWithdrawAll()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).yieldStrategyWithdrawAll()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('payoutClaim()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.payoutClaim(this.alice.address, 1)).to.be.revertedWith(
        'Unauthorized()',
      );
    });
  });
  describe('initialStake()', async function () {
    it('Invalid amount', async function () {
      await expect(this.sherlock.initialStake(0, 10, this.alice.address)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Invalid period', async function () {
      await expect(this.sherlock.initialStake(1, 9, this.alice.address)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
    it('Invalid receiver', async function () {
      await expect(this.sherlock.initialStake(1, 10, constants.AddressZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
  });
  describe('redeemNFT()', async function () {
    it('Non existent', async function () {
      await expect(this.sherlock.redeemNFT(1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
  describe('ownerRestake()', async function () {
    it('Non existent', async function () {
      await expect(this.sherlock.ownerRestake(1, 10)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
  describe('arbRestake()', async function () {
    it('Non existent', async function () {
      await expect(this.sherlock.arbRestake(1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
});

describe('Sherlock ─ Functional', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
      'SherlockTest',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens2]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['strategy2', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['protmanager2', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [
      ['sherdist', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);
    await deploy(this, [
      ['sherdist2', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);

    await deploy(this, [
      [
        'sherlock',
        this.SherlockTest,
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

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Deploy', async function () {
      this.d = await this.Sherlock.deploy(
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
      );
      this.d = await meta(this.d.deployTransaction);
      expect(this.d.events.length).to.eq(8);
    });
    it('Ownership', async function () {
      expect(this.d.events[0].event).to.eq('OwnershipTransferred');
    });
    it('setPeriod', async function () {
      expect(this.d.events[1].event).to.eq('StakingPeriodEnabled');
      expect(this.d.events[1].args.period).to.eq(10);
    });
    it('setPeriod', async function () {
      expect(this.d.events[2].event).to.eq('StakingPeriodEnabled');
      expect(this.d.events[2].args.period).to.eq(20);
    });
    it('YieldStrategyUpdated', async function () {
      expect(this.d.events[3].event).to.eq('YieldStrategyUpdated');
      expect(this.d.events[3].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[3].args.current).to.eq(this.strategy.address);
    });
    it('SherDistributionManagerUpdated', async function () {
      expect(this.d.events[4].event).to.eq('SherDistributionManagerUpdated');
      expect(this.d.events[4].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[4].args.current).to.eq(this.sherdist.address);
    });
    it('NonStakerAddressUpdated', async function () {
      expect(this.d.events[5].event).to.eq('NonStakerAddressUpdated');
      expect(this.d.events[5].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[5].args.current).to.eq(this.nonStaker.address);
    });
    it('ProtocolManagerUpdated', async function () {
      expect(this.d.events[6].event).to.eq('ProtocolManagerUpdated');
      expect(this.d.events[6].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[6].args.current).to.eq(this.protmanager.address);
    });
    it('ClaimManagerUpdated', async function () {
      expect(this.d.events[7].event).to.eq('ClaimManagerUpdated');
      expect(this.d.events[7].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[7].args.current).to.eq(this.claimManager.address);
    });
  });
  describe('enableStakingPeriod()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.stakingPeriods(100)).to.eq(false);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.enableStakingPeriod(100));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('StakingPeriodEnabled');
      expect(this.t0.events[0].args.period).to.eq(100);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.stakingPeriods(100)).to.eq(true);
    });
  });
  describe('disableStakingPeriod()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.stakingPeriods(10)).to.eq(true);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.disableStakingPeriod(10));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('StakingPeriodDisabled');
      expect(this.t0.events[0].args.period).to.eq(10);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.stakingPeriods(10)).to.eq(false);
    });
  });
  describe('updateSherDistributionManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(this.sherdist.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateSherDistributionManager(this.sherdist2.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('SherDistributionManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.sherdist.address);
      expect(this.t0.events[0].args.current).to.eq(this.sherdist2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(this.sherdist2.address);
    });
  });
  describe('removeSherDistributionManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(this.sherdist.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.removeSherDistributionManager());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('SherDistributionManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.sherdist.address);
      expect(this.t0.events[0].args.current).to.eq(constants.AddressZero);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(constants.AddressZero);
    });
  });
  describe('updateNonStakersAddress()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.nonStakersAddress()).to.eq(this.nonStaker.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateNonStakersAddress(this.alice.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('NonStakerAddressUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.nonStaker.address);
      expect(this.t0.events[0].args.current).to.eq(this.alice.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.nonStakersAddress()).to.eq(this.alice.address);
    });
  });
  describe('updateSherlockProtocolManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherlockProtocolManager()).to.eq(this.protmanager.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateSherlockProtocolManager(this.protmanager2.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ProtocolManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.protmanager.address);
      expect(this.t0.events[0].args.current).to.eq(this.protmanager2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherlockProtocolManager()).to.eq(this.protmanager2.address);
    });
  });
  describe('updateSherlockClaimManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherlockClaimManager()).to.eq(this.claimManager.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateSherlockClaimManager(this.alice.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ClaimManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.claimManager.address);
      expect(this.t0.events[0].args.current).to.eq(this.alice.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherlockClaimManager()).to.eq(this.alice.address);
    });
  });
  describe('updateYieldStrategy()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.yieldStrategy()).to.eq(this.strategy.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateYieldStrategy(this.strategy2.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('YieldStrategyUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.strategy.address);
      expect(this.t0.events[0].args.current).to.eq(this.strategy2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.yieldStrategy()).to.eq(this.strategy2.address);
    });
  });
  describe('updateYieldStrategy(), failing', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      await this.strategy.setFail();

      expect(await this.sherlock.yieldStrategy()).to.eq(this.strategy.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateYieldStrategy(this.strategy2.address));

      expect(this.t0.events.length).to.eq(2);
      expect(this.t0.events[0].event).to.eq('YieldStrategyUpdateWithdrawAllError');
      expect(this.t0.events[0].args.error).to.not.eq(constants.HashZero);
      expect(this.t0.events[1].event).to.eq('YieldStrategyUpdated');
      expect(this.t0.events[1].args.previous).to.eq(this.strategy.address);
      expect(this.t0.events[1].args.current).to.eq(this.strategy2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.yieldStrategy()).to.eq(this.strategy2.address);
    });
  });
  describe('yieldStrategyDeposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.sherlock.address, this.amount);
      await this.token.transfer(this.protmanager.address, this.amount.mul(2));
      await this.protmanager.setAmount(this.amount.mul(2));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.protmanager.address)).to.eq(this.amount.mul(2));
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.protmanager.claimCalled()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.yieldStrategyDeposit(this.amount));
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount.mul(2));
      expect(await this.token.balanceOf(this.protmanager.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.protmanager.claimCalled()).to.eq(1);
    });
  });
  describe('yieldStrategyWithdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.strategy.address, this.amount);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.yieldStrategyWithdraw(this.amount.div(2)));
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount.div(2));
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount.div(2));

      expect(await this.strategy.withdrawCalled()).to.eq(1);
    });
    it('Do and verify state', async function () {
      this.t1 = await meta(this.sherlock.yieldStrategyWithdraw(this.amount.div(2)));

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(0);

      expect(await this.strategy.withdrawCalled()).to.eq(2);
    });
  });
  describe('yieldStrategyWithdrawAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.strategy.address, this.amount);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);

      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.yieldStrategyWithdrawAll());
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(0);

      expect(await this.strategy.withdrawAllCalled()).to.eq(1);
    });
  });
  describe('payoutClaim()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.sherlock.address, this.amount);
      await this.token.transfer(this.strategy.address, this.amount);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(0);

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do zero', async function () {
      this.t0 = await meta(
        this.sherlock.connect(this.claimManager).payoutClaim(this.bob.address, 0),
      );

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ClaimPayout');
      expect(this.t0.events[0].args.receiver).to.eq(this.bob.address);
      expect(this.t0.events[0].args.amount).to.eq(0);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(0);

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do small', async function () {
      this.t1 = await meta(
        this.sherlock.connect(this.claimManager).payoutClaim(this.bob.address, this.amount.div(10)),
      );

      expect(this.t1.events.length).to.eq(3);
      expect(this.t1.events[2].event).to.eq('ClaimPayout');
      expect(this.t1.events[2].args.receiver).to.eq(this.bob.address);
      expect(this.t1.events[2].args.amount).to.eq(this.amount.div(10));

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(
        this.amount.sub(this.amount.div(10)),
      );
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(this.amount.div(10));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do big', async function () {
      this.t1 = await meta(
        this.sherlock.connect(this.claimManager).payoutClaim(this.bob.address, this.amount),
      );

      expect(this.t1.events.length).to.eq(4);
      expect(this.t1.events[3].event).to.eq('ClaimPayout');
      expect(this.t1.events[3].args.receiver).to.eq(this.bob.address);
      expect(this.t1.events[3].args.amount).to.eq(this.amount);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(
        this.amount.sub(this.amount.div(10)),
      );
      expect(await this.token.balanceOf(this.bob.address)).to.eq(
        this.amount.add(this.amount.div(10)),
      );

      expect(await this.strategy.withdrawCalled()).to.eq(1);
    });
  });
  describe('initialStake(), _stake() no sher distribution manager', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sherlock.removeSherDistributionManager();
      await this.token.approve(this.sherlock.address, maxTokens);
    });
    it('Initial state', async function () {
      await expect(this.sherlock.lockupEnd(1)).to.be.revertedWith('NonExistent()');
      await expect(this.sherlock.sherRewards(1)).to.be.revertedWith('NonExistent()');
      await expect(this.sherlock.tokenBalanceOf(1)).to.be.revertedWith('NonExistent()');
    });
    it('Do', async function () {
      this.amount = parseUnits('100', 6);

      this.t0 = await meta(this.sherlock.initialStake(this.amount, 10, this.bob.address));
    });
    it('Verify state', async function () {
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t0.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
  });
  describe('initialStake(), _stake()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.token.approve(this.sherlock.address, maxTokens);

      await this.sher.transfer(this.sherdist.address, parseEther('1000'));
      this.amount = parseUnits('100', 6);
    });
    it('Do zero', async function () {
      this.t0 = await meta(this.sherlock.initialStake(this.amount, 10, this.bob.address));

      expect(await this.sherdist.lastAmount()).to.eq(this.amount);
      expect(await this.sherdist.lastPeriod()).to.eq(10);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t0.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
      expect(await this.sher.balanceOf(this.sherlock.address)).to.eq(0);
    });
    it('Do one', async function () {
      await this.sherdist.setReward(parseEther('1'));
      this.t1 = await meta(this.sherlock.initialStake(this.amount, 20, this.bob.address));

      expect(await this.sherdist.lastAmount()).to.eq(this.amount);
      expect(await this.sherdist.lastPeriod()).to.eq(20);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.lockupEnd(2)).to.eq(this.t1.time.add(20));
      expect(await this.sherlock.sherRewards(2)).to.eq(parseEther('1'));
      expect(await this.sherlock.tokenBalanceOf(2)).to.eq(this.amount);
      expect(await this.sher.balanceOf(this.sherlock.address)).to.eq(parseEther('1'));
    });
    it('Do two', async function () {
      await this.sherdist.setReward(parseEther('2'));
      this.t2 = await meta(this.sherlock.initialStake(this.amount, 20, this.bob.address));

      expect(await this.sherdist.lastAmount()).to.eq(this.amount);
      expect(await this.sherdist.lastPeriod()).to.eq(20);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.lockupEnd(3)).to.eq(this.t2.time.add(20));
      expect(await this.sherlock.sherRewards(3)).to.eq(parseEther('2'));
      expect(await this.sherlock.tokenBalanceOf(3)).to.eq(this.amount);
      expect(await this.sher.balanceOf(this.sherlock.address)).to.eq(parseEther('3'));
    });
    it('Do wrong return value', async function () {
      await this.sherdist.setReward(parseEther('2'));
      await this.sherdist.setCustomRewardReturnValue(parseEther('2').sub(1));

      await expect(
        this.sherlock.initialStake(this.amount, 20, this.bob.address),
      ).to.be.revertedWith(
        'InvalidSherAmount(' + parseEther('2').sub(1) + ', ' + parseEther('2') + ')',
      );
    });
    it('Do exception', async function () {
      await this.sherdist.setCustomRewardReturnValue(constants.MaxUint256);
      await this.sherdist.setRewardRevert(true);

      await expect(
        this.sherlock.initialStake(this.amount, 20, this.bob.address),
      ).to.be.revertedWith('REV');
    });
  });
  describe('initialStake(), multi', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.token.approve(this.sherlock.address, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.sherlock.viewStakeShares(1)).to.eq(0);
      expect(await this.sherlock.viewStakeShares(2)).to.eq(0);
      expect(await this.sherlock.viewStakeShares(3)).to.eq(0);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(0);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
    });
    it('Do', async function () {
      this.amount = parseUnits('100', 6);

      this.t0 = await meta(this.sherlock.initialStake(this.amount, 10, this.bob.address));
    });
    it('Verify state', async function () {
      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewStakeShares(2)).to.eq(0);
      expect(await this.sherlock.viewStakeShares(3)).to.eq(0);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);

      expect(await this.sherlock.ownerOf(1)).to.eq(this.bob.address);
    });
    it('Do again', async function () {
      this.amount = parseUnits('100', 6);

      this.t0 = await meta(this.sherlock.initialStake(this.amount, 10, this.bob.address));
    });
    it('Verify state', async function () {
      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewStakeShares(2)).to.eq(this.amount);
      expect(await this.sherlock.viewStakeShares(3)).to.eq(0);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount.mul(2));

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount.mul(2));

      expect(await this.sherlock.ownerOf(1)).to.eq(this.bob.address);
      expect(await this.sherlock.ownerOf(2)).to.eq(this.bob.address);
    });
    it('Do again', async function () {
      this.amount = parseUnits('100', 6);

      this.t0 = await meta(this.sherlock.initialStake(this.amount, 10, this.bob.address));
    });
    it('Verify state', async function () {
      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewStakeShares(2)).to.eq(this.amount);
      expect(await this.sherlock.viewStakeShares(3)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount.mul(3));

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount.mul(3));

      expect(await this.sherlock.ownerOf(1)).to.eq(this.bob.address);
      expect(await this.sherlock.ownerOf(2)).to.eq(this.bob.address);
      expect(await this.sherlock.ownerOf(2)).to.eq(this.bob.address);
    });
  });
  describe('redeemNFT(), invalid conditions and 0amount, 0sher', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);

      await this.token.approve(this.sherlock.address, maxTokens);

      this.t1 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t1.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
    it('Non owner', async function () {
      await expect(this.sherlock.connect(this.bob).redeemNFT(1)).to.be.revertedWith(
        'Unauthorized()',
      );
    });
    it('invalid conditions', async function () {
      await expect(this.sherlock.connect(this.carol).redeemNFT(1)).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('zero amount redeem', async function () {
      await timeTraveler.mine(10);

      await this.sherlock.transfer(this.alice.address, this.amount);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);

      await this.sherlock.connect(this.carol).redeemNFT(1);
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(0);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(0);
      await expect(this.sherlock.ownerOf(1)).to.be.reverted;
      await expect(this.sherlock.lockupEnd(1)).to.be.revertedWith('NonExistent()');
      await expect(this.sherlock.sherRewards(1)).to.be.revertedWith('NonExistent()');
      await expect(this.sherlock.tokenBalanceOf(1)).to.be.revertedWith('NonExistent()');
    });
  });
  describe('redeemNFT(), !0amount, !0sher', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      this.reward = parseEther('2');

      await this.token.approve(this.sherlock.address, maxTokens);
      await this.sher.transfer(this.sherdist.address, parseEther('1000'));
      await this.sherdist.setReward(this.reward);

      this.t1 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t1.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
    it('Do', async function () {
      await timeTraveler.mine(10);

      await this.sherlock.connect(this.carol).redeemNFT(1);
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(this.amount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(this.reward);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(0);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(0);
      await expect(this.sherlock.ownerOf(1)).to.be.reverted;
      await expect(this.sherlock.lockupEnd(1)).to.be.revertedWith('NonExistent()');
      await expect(this.sherlock.sherRewards(1)).to.be.revertedWith('NonExistent()');
      await expect(this.sherlock.tokenBalanceOf(1)).to.be.revertedWith('NonExistent()');
    });
  });
  describe('ownerRestake(), zero rewards', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);

      await this.token.approve(this.sherlock.address, maxTokens);

      this.t1 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t1.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
    it('Non owner', async function () {
      await expect(this.sherlock.connect(this.bob).ownerRestake(1, 10)).to.be.revertedWith(
        'Unauthorized()',
      );
    });
    it('invalid conditions', async function () {
      await expect(this.sherlock.connect(this.carol).ownerRestake(1, 10)).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('Invalid period', async function () {
      await timeTraveler.mine(10);

      await expect(this.sherlock.connect(this.carol).ownerRestake(1, 5)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
    it('zero amount ownerRestake', async function () {
      await this.sherlock.transfer(this.alice.address, this.amount);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);

      this.t2 = await meta(this.sherlock.connect(this.carol).ownerRestake(1, 10));

      expect(this.t2.events.length).to.eq(1);
      expect(this.t2.events[0].event).to.eq('Restaked');
      expect(this.t2.events[0].args.tokenID).to.eq(1);
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t2.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(0);
    });
  });
  describe('ownerRestake()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      this.reward = parseEther('2');

      await this.token.approve(this.sherlock.address, maxTokens);
      await this.sher.transfer(this.sherdist.address, parseEther('1000'));
      await this.sherdist.setReward(this.reward);

      this.t1 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t1.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
    it('Do', async function () {
      await timeTraveler.mine(10);

      this.t2 = await meta(this.sherlock.connect(this.carol).ownerRestake(1, 20));

      expect(this.t2.events.length).to.eq(3);
      expect(this.t2.events[2].event).to.eq('Restaked');
      expect(this.t2.events[2].args.tokenID).to.eq(1);

      expect(await this.sherdist.lastAmount()).to.eq(this.amount);
      expect(await this.sherdist.lastPeriod()).to.eq(20);
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(this.reward);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t2.time.add(20));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
  });
  describe('arbRestake(), calcs and after 2 weeks', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      this.reward = parseEther('2');

      await this.token.approve(this.sherlock.address, maxTokens);
      await this.sher.transfer(this.sherdist.address, parseEther('1000'));
      await this.sherdist.setReward(this.reward);

      this.t1 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t1.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
    it('Fail, within lockup', async function () {
      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      expect(res[0]).to.eq(0);
      expect(res[1]).to.eq(false);

      await expect(this.sherlock.connect(this.bob).arbRestake(1)).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('Fail, block before deadline', async function () {
      await timeTraveler.setNextBlockTimestamp(Number(this.t1.time.add(10).add(weeks2).sub(2)));
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      expect(res[0]).to.eq(0);
      expect(res[1]).to.eq(false);

      await expect(this.sherlock.connect(this.bob).arbRestake(1)).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('First block', async function () {
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      expect(res[0]).to.eq(0);
      expect(res[1]).to.eq(true);
    });
    it('10 percent', async function () {
      await timeTraveler.increaseTime(weeks1 / 10);
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      // 10 percent of max reward
      // = 10% of 20% = 2 percent of total
      expect(res[0]).to.eq(this.amount.div(100).mul(2));
      expect(res[1]).to.eq(true);
    });
    it('20 percent', async function () {
      await timeTraveler.increaseTime(weeks1 / 10);
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      // 20 percent of max reward
      // = 20% of 20% = 4 percent of total
      expect(res[0]).to.eq(this.amount.div(100).mul(4));
      expect(res[1]).to.eq(true);
    });
    it('90 percent', async function () {
      await timeTraveler.increaseTime((weeks1 / 10) * 7);
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      // 20 percent of max reward
      // = 90% of 20% = 18 percent of total
      expect(res[0]).to.eq(this.amount.div(100).mul(18));
      expect(res[1]).to.eq(true);
    });
    it('100 percent', async function () {
      await timeTraveler.increaseTime(weeks1 / 10);
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      // 20 percent of max reward
      // = 100% of 20% = 20 percent of total
      expect(res[0]).to.eq(this.amount.div(100).mul(20));
      expect(res[1]).to.eq(true);
    });
    it('Stays 100 percent', async function () {
      await timeTraveler.increaseTime(weeks1 / 10);
      await timeTraveler.mine(1);

      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      // 20 percent of max reward
      // = 100% of 20% = 20 percent of total
      expect(res[0]).to.eq(this.amount.div(100).mul(20));
      expect(res[1]).to.eq(true);
    });
    it('Do', async function () {
      await this.sherdist.setReward(this.reward.mul(2));
      this.arbAmount = this.amount.div(10).mul(2);
      this.t2 = await meta(this.sherlock.connect(this.bob).arbRestake(1));

      expect(this.t2.events.length).to.eq(6);
      expect(this.t2.events[4].event).to.eq('Restaked');
      expect(this.t2.events[4].args.tokenID).to.eq(1);
      expect(this.t2.events[5].event).to.eq('ArbRestaked');
      expect(this.t2.events[5].args.tokenID).to.eq(1);
      expect(this.t2.events[5].args.reward).to.eq(this.arbAmount);

      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(
        this.amount.sub(this.arbAmount),
      );
      expect(await this.token.balanceOf(this.bob.address)).to.eq(this.arbAmount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(this.reward);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount.div(10).mul(8));
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount.div(10).mul(8));
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t2.time.add(weeks12));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward.mul(2));
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount.div(10).mul(8));
    });
    it('Verify disabled', async function () {
      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      expect(res[0]).to.eq(0);
      expect(res[1]).to.eq(false);
    });
    it('Verify share price', async function () {
      this.t3 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount.div(10).mul(8));
      expect(await this.sherlock.viewStakeShares(2)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(
        this.amount.add(this.amount.div(10).mul(8)),
      );
    });
  });
  describe('arbRestake(), mid range execute', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      this.reward = parseEther('2');

      await this.token.approve(this.sherlock.address, maxTokens);
      await this.sher.transfer(this.sherdist.address, parseEther('1000'));
      await this.sherdist.setReward(this.reward);

      this.t1 = await meta(this.sherlock.initialStake(this.amount, 10, this.carol.address));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount);
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount);
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t1.time.add(10));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount);
    });
    it('Fail, block before deadline', async function () {
      await timeTraveler.setNextBlockTimestamp(
        Number(
          this.t1.time
            .add(10)
            .add(weeks2)
            .add(weeks1 / 2)
            .sub(1),
        ),
      );

      await timeTraveler.mine(1);

      // 50% of total rewards = 10% of total amount
      this.arbAmount = this.amount.div(10);
      this.t2 = await meta(this.sherlock.connect(this.bob).arbRestake(1));

      expect(this.t2.events.length).to.eq(6);
      expect(this.t2.events[4].event).to.eq('Restaked');
      expect(this.t2.events[4].args.tokenID).to.eq(1);
      expect(this.t2.events[5].event).to.eq('ArbRestaked');
      expect(this.t2.events[5].args.tokenID).to.eq(1);
      expect(this.t2.events[5].args.reward).to.eq(this.arbAmount);
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(
        this.amount.sub(this.arbAmount),
      );
      expect(await this.token.balanceOf(this.bob.address)).to.eq(this.arbAmount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(this.reward);

      expect(await this.sherlock.viewStakeShares(1)).to.eq(this.amount.div(10).mul(9));
      expect(await this.sherlock.viewTotalStakeShares()).to.eq(this.amount.div(10).mul(9));
      expect(await this.sherlock.ownerOf(1)).to.eq(this.carol.address);
      expect(await this.sherlock.lockupEnd(1)).to.eq(this.t2.time.add(weeks12));
      expect(await this.sherlock.sherRewards(1)).to.eq(this.reward);
      expect(await this.sherlock.tokenBalanceOf(1)).to.eq(this.amount.div(10).mul(9));
    });
    it('Verify disabled', async function () {
      const res = await this.sherlock.connect(this.bob).viewRewardForArbRestake(1);
      expect(res[0]).to.eq(0);
      expect(res[1]).to.eq(false);
    });
  });
  describe('tokenBalanceOfAddress()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);

      await this.token.approve(this.sherlock.address, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(0);
    });
    it('t=0, stake', async function () {
      await this.sherlock.initialStake(this.amount, 10, this.carol.address);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(this.amount);
    });
    it('t=1, stake', async function () {
      await this.sherlock.initialStake(this.amount, 10, this.carol.address);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(
        this.amount.mul(2),
      );
    });
    it('t=2, stake', async function () {
      await this.sherlock.initialStake(this.amount.mul(3), 10, this.bob.address);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(this.amount.mul(3));
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(
        this.amount.mul(2),
      );
    });
    it('t=3, transfer', async function () {
      await this.sherlock
        .connect(this.carol)
        .transferFrom(this.carol.address, this.alice.address, 2);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(this.amount);
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(this.amount.mul(3));
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(this.amount);
    });
    it('t=4, transfer', async function () {
      await this.sherlock.connect(this.bob).transferFrom(this.bob.address, this.alice.address, 3);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(
        this.amount.mul(4),
      );
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(this.amount);
    });
    it('redeem 1', async function () {
      await timeTraveler.mine(10);

      await this.sherlock.connect(this.carol).redeemNFT(1);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(
        this.amount.mul(4),
      );
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(0);
    });
    it('redeem 2', async function () {
      await this.sherlock.connect(this.alice).redeemNFT(2);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(
        this.amount.mul(3),
      );
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(0);
    });
    it('redeem 3', async function () {
      await this.sherlock.connect(this.alice).redeemNFT(3);

      expect(await this.sherlock.tokenBalanceOfAddress(this.alice.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.bob.address)).to.eq(0);
      expect(await this.sherlock.tokenBalanceOfAddress(this.carol.address)).to.eq(0);
    });
  });
  7;
});
