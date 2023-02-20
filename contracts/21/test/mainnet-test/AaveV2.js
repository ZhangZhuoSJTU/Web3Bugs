const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, fork, unfork } = require('../utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('../utilities/snapshot');

describe('Mainnet - AaveV2 [ @skip-on-coverage ]', function () {
  before(async function () {
    // MAINNET fork
    await fork(12650000);

    // MAINNET contracts
    this.lpAddProvider = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
    this.lp = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
    this.incentives = await ethers.getContractAt(
      'IAaveIncentivesController',
      '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
    );
    this.stkAAVE = await ethers.getContractAt(
      'ERC20',
      '0x4da27a545c0c5b758a6ba100e3a049001de870f5',
    );
    this.dai = await ethers.getContractAt('ERC20', '0x6B175474E89094C44Da98b954EedeAC495271d0F');
    this.aDAI = await ethers.getContractAt('ERC20', '0x028171bCA77440897B824Ca71D1c56caC55b68A3');

    timeTraveler = new TimeTraveler(network.provider);
    await prepare(this, ['AaveV2']);
    // Use EOA as Sherlock address for testing
    this.sherlock = this.alice;
    await deploy(this, [
      ['aaveStrategy', this.AaveV2, [this.aDAI.address, this.sherlock.address, this.bob.address]],
    ]);
    await timeTraveler.snapshot();

    // Transfer MAINNET DAI, is not included in snapshot
    this.aDaiYield = parseUnits('40500', 'gwei');
    this.aDaiYieldError = parseUnits('10000', 'gwei');
    this.aDaiLM = parseUnits('103', 'gwei');
    this.aDaiLMError = parseUnits('5', 'gwei');
    this.mintDAI = async () => {
      const daiWhaleAddress = '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';
      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [daiWhaleAddress],
      });
      const daiWhale = await ethers.provider.getSigner(daiWhaleAddress);
      this.daiAmount = parseEther('100000');
      this.dai.connect(daiWhale).transfer(this.aaveStrategy.address, this.daiAmount);
    };
    this.reset = async () => {
      await timeTraveler.revertSnapshot();
      await this.mintDAI();
    };
    await this.reset();
  });
  it('Constructor state', async function () {
    expect(await this.aaveStrategy.aWant()).to.eq(this.aDAI.address);
    expect(await this.aaveStrategy.want()).to.eq(this.dai.address);
    expect(await this.aaveStrategy.aaveIncentivesController()).to.eq(this.incentives.address);
    expect(await this.aaveStrategy.sherlock()).to.eq(this.sherlock.address);
    expect(await this.aaveStrategy.aaveLmReceiver()).to.eq(this.bob.address);

    expect(await this.aaveStrategy.lpAddressProvider()).to.eq(this.lpAddProvider);

    expect(await this.dai.allowance(this.aaveStrategy.address, this.lp)).to.eq(
      constants.MaxUint256,
    );
  });
  it('Initial state', async function () {
    expect(await this.dai.balanceOf(this.sherlock.address)).to.eq(0);
    expect(await this.dai.balanceOf(this.aaveStrategy.address)).to.eq(this.daiAmount);
    expect(await this.aDAI.balanceOf(this.aaveStrategy.address)).to.eq(0);
    expect(await this.aaveStrategy.balanceOf()).to.eq(0);

    expect(
      await this.incentives.getRewardsBalance([this.aDAI.address], this.aaveStrategy.address),
    ).to.eq(0);
    expect(await this.stkAAVE.balanceOf(this.bob.address)).to.eq(0);
  });
  describe('deposit()', function () {
    before(async function () {
      await this.reset();
    });
    it('Do', async function () {
      await this.aaveStrategy.deposit();

      expect(await this.dai.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.dai.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aDAI.balanceOf(this.aaveStrategy.address)).to.eq(this.daiAmount);

      expect(await this.aaveStrategy.balanceOf()).to.eq(this.daiAmount);
    });
    it('Do again', async function () {
      await expect(this.aaveStrategy.deposit()).to.be.revertedWith('ZERO_AMOUNT');
    });
  });
  describe('withdrawAll()', function () {
    before(async function () {
      await this.reset();
      await this.aaveStrategy.deposit();
    });
    it('Do', async function () {
      await this.aaveStrategy.withdrawAll();

      expect(await this.dai.balanceOf(this.sherlock.address)).to.be.closeTo(
        this.daiAmount.add(this.aDaiYield.mul(2)),
        this.aDaiYieldError,
      );
      expect(await this.dai.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aDAI.balanceOf(this.aaveStrategy.address)).to.eq(0);

      expect(await this.aaveStrategy.balanceOf()).to.eq(0);
    });
    it('Do again', async function () {
      await this.aaveStrategy.withdrawAll();

      expect(await this.dai.balanceOf(this.sherlock.address)).to.be.closeTo(
        this.daiAmount.add(this.aDaiYield.mul(2)),
        this.aDaiYieldError,
      );
      expect(await this.dai.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aDAI.balanceOf(this.aaveStrategy.address)).to.eq(0);

      expect(await this.aaveStrategy.balanceOf()).to.eq(0);
    });
    it('Do wrong caller', async function () {
      await expect(this.aaveStrategy.connect(this.bob).withdrawAll()).to.be.revertedWith(
        'sherlock',
      );
    });
  });
  describe('withdraw()', function () {
    before(async function () {
      await this.reset();
      await this.aaveStrategy.deposit();
    });
    it('Do', async function () {
      await this.aaveStrategy.withdraw(this.daiAmount.div(2));

      expect(await this.dai.balanceOf(this.sherlock.address)).to.eq(this.daiAmount.div(2));
      expect(await this.dai.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aDAI.balanceOf(this.aaveStrategy.address)).to.be.closeTo(
        this.daiAmount.div(2).add(this.aDaiYield.mul(2)),
        this.aDaiYieldError,
      );
    });
    it('Do again', async function () {
      await this.aaveStrategy.withdraw(this.daiAmount.div(2));

      expect(await this.dai.balanceOf(this.sherlock.address)).to.eq(this.daiAmount);
      expect(await this.dai.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aDAI.balanceOf(this.aaveStrategy.address)).to.be.closeTo(
        this.aDaiYield.mul(3),
        this.aDaiYieldError,
      );
    });
    it('Do zero', async function () {
      await expect(this.aaveStrategy.withdraw(0)).to.be.revertedWith('revert 1');
    });
    it('Do max', async function () {
      await expect(this.aaveStrategy.withdraw(constants.MaxUint256)).to.be.revertedWith('MAX');
    });
    it('Do exceed', async function () {
      await expect(this.aaveStrategy.withdraw(constants.MaxUint256.sub(1))).to.be.revertedWith(
        'revert 5',
      );
    });
    it('Do wrong caller', async function () {
      await expect(this.aaveStrategy.connect(this.bob).withdraw(1)).to.be.revertedWith('sherlock');
    });
  });
  describe('claimRewards()', function () {
    before(async function () {
      await this.reset();
      await this.aaveStrategy.deposit();
    });
    it('t=1, state', async function () {
      await timeTraveler.mine(1);

      expect(
        await this.incentives.getRewardsBalance([this.aDAI.address], this.aaveStrategy.address),
      ).to.be.closeTo(this.aDaiLM, this.aDaiLMError);
      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.eq(0);
    });
    it('t=2, do', async function () {
      await this.aaveStrategy.claimRewards();

      expect(
        await this.incentives.getRewardsBalance([this.aDAI.address], this.aaveStrategy.address),
      ).to.eq(0);

      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.be.closeTo(
        this.aDaiLM.mul(2),
        this.aDaiLMError,
      );
    });
    it('t=3, do again', async function () {
      await this.aaveStrategy.claimRewards();
      expect(
        await this.incentives.getRewardsBalance([this.aDAI.address], this.aaveStrategy.address),
      ).to.eq(0);

      // NOTE: shows nconsistent result bases on cache files
      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.be.gt(this.aDaiLM.mul(3));
    });
  });
  after(async function () {
    await unfork();
  });
});
