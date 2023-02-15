const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);

describe('Pausable', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await timeTraveler.fork(13671132);

    this.aUSDC = await ethers.getContractAt('ERC20', '0xBcca60bB61934080951369a648Fb03DF4F96263C');

    await prepare(this, [
      'AaveV2Strategy',
      'SherlockProtocolManager',
      'SherDistributionManager',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'SherlockClaimManager',
      'SherlockTest',
      'PausableMock',
    ]);

    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens]]]);

    await deploy(this, [['strategy', this.AaveV2Strategy, [this.aUSDC.address, this.bob.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManager, [this.token.address]]]);
    await deploy(this, [
      ['sherdist', this.SherDistributionManager, [100, 200, 2, this.sher.address]],
    ]);
    await deploy(this, [
      ['claimManager', this.SherlockClaimManager, [this.bob.address, this.bob.address]],
    ]);

    await deploy(this, [['strategyMock', this.PausableMock, []]]);
    await deploy(this, [['protmanagerMock', this.PausableMock, []]]);
    await deploy(this, [['sherdistMock', this.PausableMock, []]]);
    await deploy(this, [['claimManagerMock', this.PausableMock, []]]);

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
    await deploy(this, [
      [
        'sherlockM',
        this.SherlockTest,
        [
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategyMock.address,
          this.sherdistMock.address,
          this.nonStaker.address,
          this.protmanagerMock.address,
          this.claimManagerMock.address,
          [10, 20],
        ],
      ],
    ]);

    await this.strategy.setSherlockCoreAddress(this.sherlock.address);
    await this.sherdist.setSherlockCoreAddress(this.sherlock.address);
    await this.protmanager.setSherlockCoreAddress(this.sherlock.address);
    await this.claimManager.setSherlockCoreAddress(this.sherlock.address);

    await timeTraveler.snapshot();
  });
  describe('Pause errors', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do pause twice', async function () {
      await this.sherlock.pause();
      await expect(this.sherlock.pause()).to.be.revertedWith('Pausable: paused');
    });
    it('Do unpause twice', async function () {
      await this.sherlock.unpause();
      await expect(this.sherlock.unpause()).to.be.revertedWith('Pausable: not paused');
    });
  });
  describe('core', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sherlock.transferOwnership(this.bob.address);
    });
    it('Initial state', async function () {
      await expect(this.sherlock.enableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );

      await expect(
        this.sherlock.updateSherDistributionManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.removeSherDistributionManager()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.updateNonStakersAddress(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        this.sherlock.updateSherlockProtocolManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.sherlock.updateSherlockClaimManager(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.updateYieldStrategy(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyDeposit(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyWithdraw(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyWithdrawAll()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.payoutClaim(this.bob.address, 1)).to.be.revertedWith(
        'Unauthorized()',
      );
      await expect(this.sherlock.initialStake(0, 1, this.bob.address)).to.be.revertedWith(
        'ZeroArgument()',
      );
      await expect(this.sherlock.redeemNFT(1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
      await expect(this.sherlock.ownerRestake(1, 1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
      await expect(this.sherlock.arbRestake(1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
    it('Do pause', async function () {
      await this.sherlock.connect(this.bob).pause();
    });
    it('Verify state', async function () {
      await expect(this.sherlock.enableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );

      await expect(
        this.sherlock.updateSherDistributionManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.removeSherDistributionManager()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.updateNonStakersAddress(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        this.sherlock.updateSherlockProtocolManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.sherlock.updateSherlockClaimManager(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.updateYieldStrategy(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyDeposit(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyWithdraw(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyWithdrawAll()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.payoutClaim(this.bob.address, 1)).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(this.sherlock.initialStake(0, 1, this.bob.address)).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(this.sherlock.redeemNFT(1)).to.be.revertedWith('Pausable: paused');
      await expect(this.sherlock.ownerRestake(1, 1)).to.be.revertedWith('Pausable: paused');
      await expect(this.sherlock.arbRestake(1)).to.be.revertedWith('Pausable: paused');
    });
    it('Do unpause', async function () {
      await this.sherlock.connect(this.bob).unpause();
    });
    it('Verify state', async function () {
      await expect(this.sherlock.enableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );

      await expect(
        this.sherlock.updateSherDistributionManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.sherlock.disableStakingPeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.removeSherDistributionManager()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.updateNonStakersAddress(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        this.sherlock.updateSherlockProtocolManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.sherlock.updateSherlockClaimManager(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.updateYieldStrategy(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyDeposit(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyWithdraw(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.yieldStrategyWithdrawAll()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.sherlock.payoutClaim(this.bob.address, 1)).to.be.revertedWith(
        'Unauthorized()',
      );
      await expect(this.sherlock.initialStake(0, 1, this.bob.address)).to.be.revertedWith(
        'ZeroArgument()',
      );
      await expect(this.sherlock.redeemNFT(1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
      await expect(this.sherlock.ownerRestake(1, 1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
      await expect(this.sherlock.arbRestake(1)).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
  });
  describe('strategy', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.strategy.transferOwnership(this.bob.address);
    });
    it('Initial state', async function () {
      await expect(this.strategy.deposit()).to.be.revertedWith('InvalidConditions()');
      await expect(this.strategy.withdrawAll()).to.be.revertedWith('InvalidSender()');
      await expect(this.strategy.withdraw(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.strategy.claimRewards()).to.not.be.reverted;
      await expect(this.strategy.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do pause', async function () {
      await this.sherlock.pause();
    });
    it('Verify state', async function () {
      await expect(this.strategy.deposit()).to.be.revertedWith('Pausable: paused');
      await expect(this.strategy.withdrawAll()).to.be.revertedWith('InvalidSender()');
      await expect(this.strategy.withdraw(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.strategy.claimRewards()).to.be.revertedWith('Pausable: paused');
      await expect(this.strategy.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do unpause', async function () {
      await this.sherlock.unpause();
    });
    it('Verify state', async function () {
      await expect(this.strategy.deposit()).to.be.revertedWith('InvalidConditions()');
      await expect(this.strategy.withdrawAll()).to.be.revertedWith('InvalidSender()');
      await expect(this.strategy.withdraw(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.strategy.claimRewards()).to.not.be.reverted;
      await expect(this.strategy.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('sherdist', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sherdist.transferOwnership(this.bob.address);
    });
    it('Initial state', async function () {
      await expect(this.sherdist.pullReward(1, 1, 1, this.bob.address)).to.be.revertedWith(
        'InvalidSender()',
      );
      await expect(this.sherdist.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do pause', async function () {
      await this.sherlock.pause();
    });
    it('Verify state', async function () {
      await expect(this.sherdist.pullReward(1, 1, 1, this.bob.address)).to.be.revertedWith(
        'InvalidSender()',
      );
      await expect(this.sherdist.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do unpause', async function () {
      await this.sherlock.unpause();
    });
    it('Verify state', async function () {
      await expect(this.sherdist.pullReward(1, 1, 1, this.bob.address)).to.be.revertedWith(
        'InvalidSender()',
      );
      await expect(this.sherdist.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('protmanager', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.protmanager.transferOwnership(this.bob.address);
    });
    it('Initial state', async function () {
      await expect(this.protmanager.setMinActiveBalance(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        this.protmanager.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');
      await expect(this.protmanager.claimPremiumsForStakers()).to.not.be.reverted;
      await expect(
        this.protmanager.protocolAdd(
          this.protocolX,
          this.alice.address,
          id('t'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        this.protmanager.protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.protmanager.protocolRemove(this.protocolX)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.forceRemoveByActiveBalance(this.protocolX)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(
        this.protmanager.forceRemoveBySecondsOfCoverage(this.protocolX),
      ).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.protmanager.setProtocolPremium(this.protocolX, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.setProtocolPremiums([this.protocolX], [1])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.depositToActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.protmanager.withdrawActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(
        this.protmanager.transferProtocolAgent(this.protocolX, this.bob.address),
      ).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.protmanager.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do pause', async function () {
      await this.sherlock.pause();
    });
    it('Verify state', async function () {
      await expect(this.protmanager.setMinActiveBalance(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        this.protmanager.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Pausable: paused');
      await expect(this.protmanager.claimPremiumsForStakers()).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(
        this.protmanager.protocolAdd(
          this.protocolX,
          this.alice.address,
          id('t'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        this.protmanager.protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.protmanager.protocolRemove(this.protocolX)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.forceRemoveByActiveBalance(this.protocolX)).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(
        this.protmanager.forceRemoveBySecondsOfCoverage(this.protocolX),
      ).to.be.revertedWith('Pausable: paused');
      await expect(this.protmanager.setProtocolPremium(this.protocolX, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.setProtocolPremiums([this.protocolX], [1])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.depositToActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(this.protmanager.withdrawActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(
        this.protmanager.transferProtocolAgent(this.protocolX, this.bob.address),
      ).to.be.revertedWith('Pausable: paused');
      await expect(this.protmanager.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do unpause', async function () {
      await this.sherlock.unpause();
    });
    it('Verify state', async function () {
      await expect(this.protmanager.setMinActiveBalance(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        this.protmanager.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');
      await expect(this.protmanager.claimPremiumsForStakers()).to.not.be.reverted;
      await expect(
        this.protmanager.protocolAdd(
          this.protocolX,
          this.alice.address,
          id('t'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        this.protmanager.protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(this.protmanager.protocolRemove(this.protocolX)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.forceRemoveByActiveBalance(this.protocolX)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(
        this.protmanager.forceRemoveBySecondsOfCoverage(this.protocolX),
      ).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.protmanager.setProtocolPremium(this.protocolX, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.setProtocolPremiums([this.protocolX], [1])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.protmanager.depositToActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.protmanager.withdrawActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(
        this.protmanager.transferProtocolAgent(this.protocolX, this.bob.address),
      ).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.protmanager.sweep(this.bob.address, [])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('claimManager', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.claimManager.transferOwnership(this.bob.address);

      this.requestData = {
        proposer: this.sherlock.address,
        disputer: this.carol.address,
        currency: this.bob.address,
        settled: false,
        proposedPrice: BigNumber.from(0),
        resolvedPrice: BigNumber.from(1000),
        expirationTime: 7300,
        reward: BigNumber.from(0),
        finalFee: parseUnits('400', 6),
        bond: parseUnits('5000', 6),
        customLiveness: BigNumber.from(7200),
      };
    });
    it('Initial state', async function () {
      await expect(this.claimManager.renounceUmaHaltOperator()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.addCallback(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.removeCallback(this.bob.address, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.cleanUp(this.protocolX, 1)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(
        this.claimManager.startClaim(this.protocolX, 1, this.bob.address, 1, '0x1212'),
      ).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.claimManager.spccApprove(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.claimManager.spccRefuse(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.claimManager.escalate(1, 1)).to.be.revertedWith('InvalidArgument()');
      await expect(this.claimManager.payoutClaim(1)).to.be.revertedWith('InvalidArgument()');
      await expect(this.claimManager.executeHalt(1)).to.be.revertedWith('InvalidSender()');
      await expect(
        this.claimManager.priceProposed(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
      await expect(
        this.claimManager.priceDisputed(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
      await expect(
        this.claimManager.priceSettled(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Do pause', async function () {
      await this.sherlock.pause();
    });
    it('Verify state', async function () {
      await expect(this.claimManager.renounceUmaHaltOperator()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.addCallback(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.removeCallback(this.bob.address, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.cleanUp(this.protocolX, 1)).to.be.revertedWith(
        'Pausable: paused',
      );
      await expect(
        this.claimManager.startClaim(this.protocolX, 1, this.bob.address, 1, '0x1212'),
      ).to.be.revertedWith('Pausable: paused');
      await expect(this.claimManager.spccApprove(1)).to.be.revertedWith('Pausable: paused');
      await expect(this.claimManager.spccRefuse(1)).to.be.revertedWith('Pausable: paused');
      await expect(this.claimManager.escalate(1, 1)).to.be.revertedWith('Pausable: paused');
      await expect(this.claimManager.payoutClaim(1)).to.be.revertedWith('Pausable: paused');
      await expect(this.claimManager.executeHalt(1)).to.be.revertedWith('Pausable: paused');
      await expect(
        this.claimManager.priceProposed(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        this.claimManager.priceDisputed(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        this.claimManager.priceSettled(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Do unpause', async function () {
      await this.sherlock.unpause();
    });
    it('Verify state', async function () {
      await expect(this.claimManager.renounceUmaHaltOperator()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.addCallback(this.bob.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.removeCallback(this.bob.address, 1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(this.claimManager.cleanUp(this.protocolX, 1)).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(
        this.claimManager.startClaim(this.protocolX, 1, this.bob.address, 1, '0x1212'),
      ).to.be.revertedWith(
        'ProtocolNotExists("0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7")',
      );
      await expect(this.claimManager.spccApprove(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.claimManager.spccRefuse(1)).to.be.revertedWith('InvalidSender()');
      await expect(this.claimManager.escalate(1, 1)).to.be.revertedWith('InvalidArgument()');
      await expect(this.claimManager.payoutClaim(1)).to.be.revertedWith('InvalidArgument()');
      await expect(this.claimManager.executeHalt(1)).to.be.revertedWith('InvalidSender()');
      await expect(
        this.claimManager.priceProposed(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
      await expect(
        this.claimManager.priceDisputed(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
      await expect(
        this.claimManager.priceSettled(id('x'), 1, '0x1212', this.requestData),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('strategy - pause checks', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do already paused', async function () {
      await this.strategyMock.pause();
      expect(await this.strategyMock.paused()).to.eq(true);

      await this.sherlockM.pause();

      expect(await this.sherlockM.paused()).to.eq(true);
      expect(await this.strategyMock.paused()).to.eq(true);
      expect(await this.sherdistMock.paused()).to.eq(true);
      expect(await this.protmanagerMock.paused()).to.eq(true);
      expect(await this.claimManagerMock.paused()).to.eq(true);
    });
    it('Do already unpaused', async function () {
      await this.strategyMock.unpause();
      expect(await this.strategyMock.paused()).to.eq(false);

      await this.sherlockM.unpause();

      expect(await this.sherlockM.paused()).to.eq(false);
      expect(await this.strategyMock.paused()).to.eq(false);
      expect(await this.sherdistMock.paused()).to.eq(false);
      expect(await this.protmanagerMock.paused()).to.eq(false);
      expect(await this.claimManagerMock.paused()).to.eq(false);
    });
  });
  describe('sherdist - pause checks', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do already paused', async function () {
      await this.sherdistMock.pause();
      expect(await this.sherdistMock.paused()).to.eq(true);

      await this.sherlockM.pause();

      expect(await this.sherlockM.paused()).to.eq(true);
      expect(await this.strategyMock.paused()).to.eq(true);
      expect(await this.sherdistMock.paused()).to.eq(true);
      expect(await this.protmanagerMock.paused()).to.eq(true);
      expect(await this.claimManagerMock.paused()).to.eq(true);
    });
    it('Do already unpaused', async function () {
      await this.sherdistMock.unpause();
      expect(await this.sherdistMock.paused()).to.eq(false);

      await this.sherlockM.unpause();

      expect(await this.sherlockM.paused()).to.eq(false);
      expect(await this.strategyMock.paused()).to.eq(false);
      expect(await this.sherdistMock.paused()).to.eq(false);
      expect(await this.protmanagerMock.paused()).to.eq(false);
      expect(await this.claimManagerMock.paused()).to.eq(false);
    });
    it('Do remove & pause', async function () {
      await this.sherlockM.removeSherDistributionManager();

      await this.sherlockM.pause();

      expect(await this.sherlockM.paused()).to.eq(true);
      expect(await this.strategyMock.paused()).to.eq(true);
      expect(await this.sherdistMock.paused()).to.eq(false);
      expect(await this.protmanagerMock.paused()).to.eq(true);
      expect(await this.claimManagerMock.paused()).to.eq(true);
    });
    it('Do remove & unpause', async function () {
      await this.sherlockM.unpause();

      expect(await this.sherlockM.paused()).to.eq(false);
      expect(await this.strategyMock.paused()).to.eq(false);
      expect(await this.sherdistMock.paused()).to.eq(false);
      expect(await this.protmanagerMock.paused()).to.eq(false);
      expect(await this.claimManagerMock.paused()).to.eq(false);
    });
  });
  describe('protmanager - pause checks', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do already paused', async function () {
      await this.protmanagerMock.pause();
      expect(await this.protmanagerMock.paused()).to.eq(true);

      await this.sherlockM.pause();

      expect(await this.sherlockM.paused()).to.eq(true);
      expect(await this.strategyMock.paused()).to.eq(true);
      expect(await this.sherdistMock.paused()).to.eq(true);
      expect(await this.protmanagerMock.paused()).to.eq(true);
      expect(await this.claimManagerMock.paused()).to.eq(true);
    });
    it('Do already unpaused', async function () {
      await this.protmanagerMock.unpause();
      expect(await this.protmanagerMock.paused()).to.eq(false);

      await this.sherlockM.unpause();

      expect(await this.sherlockM.paused()).to.eq(false);
      expect(await this.strategyMock.paused()).to.eq(false);
      expect(await this.sherdistMock.paused()).to.eq(false);
      expect(await this.protmanagerMock.paused()).to.eq(false);
      expect(await this.claimManagerMock.paused()).to.eq(false);
    });
  });
  describe('claim manager - pause checks', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do already paused', async function () {
      await this.claimManagerMock.pause();
      expect(await this.claimManagerMock.paused()).to.eq(true);

      await this.sherlockM.pause();

      expect(await this.sherlockM.paused()).to.eq(true);
      expect(await this.strategyMock.paused()).to.eq(true);
      expect(await this.sherdistMock.paused()).to.eq(true);
      expect(await this.protmanagerMock.paused()).to.eq(true);
      expect(await this.claimManagerMock.paused()).to.eq(true);
    });
    it('Do already unpaused', async function () {
      await this.claimManagerMock.unpause();
      expect(await this.claimManagerMock.paused()).to.eq(false);

      await this.sherlockM.unpause();

      expect(await this.sherlockM.paused()).to.eq(false);
      expect(await this.strategyMock.paused()).to.eq(false);
      expect(await this.sherdistMock.paused()).to.eq(false);
      expect(await this.protmanagerMock.paused()).to.eq(false);
      expect(await this.claimManagerMock.paused()).to.eq(false);
    });
  });
});
