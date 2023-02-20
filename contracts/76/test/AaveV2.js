const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

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

const usdcWhaleAddress = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0';
const USDC_AMOUNT = parseUnits('100000', 6);

describe('AaveV2 ─ Functional', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await timeTraveler.fork(13671132);

    await prepare(this, ['AaveV2Strategy', 'Sherlock']);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [usdcWhaleAddress],
    });

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
    this.usdc = await ethers.getContractAt('ERC20', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    this.aUSDC = await ethers.getContractAt('ERC20', '0xBcca60bB61934080951369a648Fb03DF4F96263C');

    this.mintUSDC = async (target, amount) => {
      const usdcWhale = await ethers.provider.getSigner(usdcWhaleAddress);
      await this.usdc.connect(usdcWhale).transfer(target, amount);
    };

    this.sherlock = this.alice;
    await deploy(this, [
      ['aaveStrategy', this.AaveV2Strategy, [this.aUSDC.address, this.bob.address]],
    ]);

    await deploy(this, [
      [
        'sherlock2',
        this.Sherlock,
        [
          this.usdc.address,
          this.usdc.address,
          'test',
          'tst',
          this.aaveStrategy.address,
          this.alice.address,
          this.alice.address,
          this.alice.address,
          this.alice.address,
          [1000],
        ],
      ],
    ]);

    this.aUsdcYield = BigNumber.from(50);
    this.aUsdcYieldError = BigNumber.from(10);
    this.aUsdcLM = parseUnits('78', 'gwei');
    this.aUsdcLMError = parseUnits('5', 'gwei');
    await this.mintUSDC(this.aaveStrategy.address, USDC_AMOUNT);
    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Zero aToken', async function () {
      await expect(
        this.AaveV2Strategy.deploy(this.bob.address, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero lmReceiver', async function () {
      await expect(
        this.AaveV2Strategy.deploy(constants.AddressZero, this.bob.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
  });
  it('Constructor state', async function () {
    expect(await this.aaveStrategy.aWant()).to.eq(this.aUSDC.address);
    expect(await this.aaveStrategy.want()).to.eq(this.usdc.address);
    expect(await this.aaveStrategy.aaveIncentivesController()).to.eq(this.incentives.address);
    expect(await this.aaveStrategy.aaveLmReceiver()).to.eq(this.bob.address);

    expect(await this.aaveStrategy.LP_ADDRESS_PROVIDER()).to.eq(this.lpAddProvider);

    expect(await this.usdc.allowance(this.aaveStrategy.address, this.lp)).to.eq(0);
  });
  it('Initial state', async function () {
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.eq(0);
    expect(await this.usdc.balanceOf(this.aaveStrategy.address)).to.eq(USDC_AMOUNT);
    expect(await this.aUSDC.balanceOf(this.aaveStrategy.address)).to.eq(0);
    expect(await this.aaveStrategy.balanceOf()).to.eq(0);

    expect(
      await this.incentives.getRewardsBalance([this.aUSDC.address], this.aaveStrategy.address),
    ).to.eq(0);
    expect(await this.stkAAVE.balanceOf(this.bob.address)).to.eq(0);
  });
  describe('deposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.aaveStrategy.setSherlockCoreAddress(this.sherlock.address);
    });
    it('Do', async function () {
      await this.aaveStrategy.deposit();

      expect(await this.usdc.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aaveStrategy.address)).to.eq(USDC_AMOUNT);

      expect(await this.aaveStrategy.balanceOf()).to.eq(USDC_AMOUNT);
      expect(await this.usdc.allowance(this.aaveStrategy.address, this.lp)).to.eq(
        constants.MaxUint256.sub(USDC_AMOUNT),
      );
    });
    it('Do again', async function () {
      await expect(this.aaveStrategy.deposit()).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('withdrawAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.aaveStrategy.setSherlockCoreAddress(this.sherlock.address);

      await this.aaveStrategy.deposit();
    });
    it('Do', async function () {
      await this.aaveStrategy.withdrawAll();

      expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
        USDC_AMOUNT.add(this.aUsdcYield.mul(2)),
        this.aUsdcYieldError,
      );
      expect(await this.usdc.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aaveStrategy.address)).to.eq(0);

      expect(await this.aaveStrategy.balanceOf()).to.eq(0);
    });
    it('Do again', async function () {
      await this.aaveStrategy.withdrawAll();

      expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
        USDC_AMOUNT.add(this.aUsdcYield.mul(2)),
        this.aUsdcYieldError,
      );
      expect(await this.usdc.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aaveStrategy.address)).to.eq(0);

      expect(await this.aaveStrategy.balanceOf()).to.eq(0);
    });
    it('Do wrong caller', async function () {
      await expect(this.aaveStrategy.connect(this.bob).withdrawAll()).to.be.revertedWith(
        'InvalidSender()',
      );
    });
  });
  describe('withdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.aaveStrategy.setSherlockCoreAddress(this.sherlock.address);

      await this.aaveStrategy.deposit();
    });
    it('Do', async function () {
      await this.aaveStrategy.withdraw(USDC_AMOUNT.div(2));

      expect(await this.usdc.balanceOf(this.sherlock.address)).to.eq(USDC_AMOUNT.div(2));
      expect(await this.usdc.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aaveStrategy.address)).to.be.closeTo(
        USDC_AMOUNT.div(2).add(this.aUsdcYield.mul(2)),
        this.aUsdcYieldError,
      );
    });
    it('Do again', async function () {
      await this.aaveStrategy.withdraw(USDC_AMOUNT.div(2));

      expect(await this.usdc.balanceOf(this.sherlock.address)).to.eq(USDC_AMOUNT);
      expect(await this.usdc.balanceOf(this.aaveStrategy.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aaveStrategy.address)).to.be.closeTo(
        this.aUsdcYield.mul(3),
        this.aUsdcYieldError,
      );
    });
    it('Do zero', async function () {
      await expect(this.aaveStrategy.withdraw(0)).to.be.revertedWith('1');
    });
    it('Do max', async function () {
      await expect(this.aaveStrategy.withdraw(constants.MaxUint256)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
    it('Do exceed', async function () {
      await expect(this.aaveStrategy.withdraw(constants.MaxUint256.sub(1))).to.be.revertedWith('5');
    });
    it('Do wrong caller', async function () {
      await expect(this.aaveStrategy.connect(this.bob).withdraw(1)).to.be.revertedWith(
        'InvalidSender()',
      );
    });
  });
  describe('claimRewards()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.aaveStrategy.setSherlockCoreAddress(this.sherlock.address);

      await this.aaveStrategy.deposit();
    });
    it('t=1, state', async function () {
      await timeTraveler.mine(1);

      expect(
        await this.incentives.getRewardsBalance([this.aUSDC.address], this.aaveStrategy.address),
      ).to.be.closeTo(this.aUsdcLM, this.aUsdcLMError);
      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.eq(0);
    });
    it('t=2, do', async function () {
      await this.aaveStrategy.claimRewards();

      expect(
        await this.incentives.getRewardsBalance([this.aUSDC.address], this.aaveStrategy.address),
      ).to.eq(0);

      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.be.closeTo(
        this.aUsdcLM.mul(2),
        this.aUsdcLMError,
      );
    });
    it('t=3, do again', async function () {
      await this.aaveStrategy.claimRewards();
      expect(
        await this.incentives.getRewardsBalance([this.aUSDC.address], this.aaveStrategy.address),
      ).to.eq(0);

      // NOTE: shows nconsistent result bases on cache files
      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.be.gt(this.aUsdcLM.mul(3));
    });
  });
  describe('sweep()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.aaveStrategy.setSherlockCoreAddress(this.sherlock2.address);
    });
    it('Initial state', async function () {
      expect(await this.aaveStrategy.isActive()).to.eq(true);
      await expect(this.aaveStrategy.sweep(this.bob.address, [])).to.be.revertedWith(
        'InvalidConditions()',
      );
      expect(await this.usdc.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do zero', async function () {
      await expect(
        this.aaveStrategy.sweep(constants.AddressZero, [this.usdc.address]),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Update', async function () {
      await this.sherlock2.updateYieldStrategy(this.alice.address);
    });
    it('Sweep', async function () {
      expect(await this.aaveStrategy.isActive()).to.eq(false);
      await this.aaveStrategy.sweep(this.bob.address, [this.usdc.address]);

      expect(await this.usdc.balanceOf(this.bob.address)).to.eq(USDC_AMOUNT);
    });
  });
});
