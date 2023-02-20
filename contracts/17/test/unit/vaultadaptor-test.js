const VaultAdaptorV0_1_3 = artifacts.require('VaultAdaptorYearnV2_032')
const MockController = artifacts.require('MockController')
const MockInsurance = artifacts.require('MockInsurance')
const MockDAI = artifacts.require('MockDAI')
const MockUSDC = artifacts.require('MockUSDC')
const MockVault = artifacts.require('MockYearnV2Vault')
const MockStrategy = artifacts.require('MockYearnV2Strategy')
const { BN } = web3.utils
const chai = require('../utils/common-utils').chai
const expect = chai.expect
chai.should()

contract('Vault Adaptor Test', function (accounts) {
  const admin = accounts[0]
  const governance = accounts[1]
  const pool = accounts[5]
  const investor1 = accounts[8]
  const investor2 = accounts[9]
  const amount = new BN(10000)
  const zero = new BN(0)
  const decimal = new BN(10).pow(new BN(15))
  const mockDAIDecimal = new BN(10).pow(new BN(18))
  let daiAdaptor, mockController, mockInsurance,
    mockDAI,
    mockUSDC,
    mockDAIVault,
    mockDAIS1,
    mockDAIS2,
    arrayStrategy,
    arrayStrategyAddresses,
    estimatedTotalAssets,
    triggers,
    percents,
    thresholds,
    strategiesQueue,
    limitArray
  beforeEach(async function () {
    mockController = await MockController.new();
    mockInsurance = await MockInsurance.new();
    await mockController.setInsurance(mockInsurance.address);

    // init underlying tokens
    mockDAI = await MockDAI.new()
    mockUSDC = await MockUSDC.new()
    // init vault
    mockDAIVault = await MockVault.new(mockDAI.address)
    // init strategy
    mockDAIS1 = await MockStrategy.new(mockDAI.address)
    await mockDAIS1.setVault(mockDAIVault.address)
    mockDAIS2 = await MockStrategy.new(mockDAI.address)
    await mockDAIS2.setVault(mockDAIVault.address);
    // init adaptor
    daiAdaptor = await VaultAdaptorV0_1_3.new(mockDAIVault.address, mockDAI.address);
    await daiAdaptor.setController(mockController.address)
    // await daiAdaptor.setWithdrawHandler(mockController.address)
    // await daiAdaptor.setInsurance(mockController.address)
    // await daiAdaptor.setLifeGuard(mockLifeGuard.address)
  })

  const calculateTrigger = function (
    uninvestedTotal,
    strategies,
    estimatedTotalAssets,
    triggers,
    percents,
    thresholds,
    decimal,
  ) {
    const totalAssets = estimatedTotalAssets
      .reduce((accumulator, currentValue) => accumulator.add(currentValue))
      .add(uninvestedTotal)
    const queue = [],
      lastQueue = []
    const expectedAsset = [],
      lastExpectedAsset = []
    strategies.forEach((s, i) => {
      const asset = estimatedTotalAssets[i]
      const trigger = triggers[i]
      const p = percents[i]
      const t = thresholds[i]
      const ratio = asset.mul(decimal).divRound(totalAssets)
      const expected = totalAssets.mul(p).divRound(decimal)
      const upper = p.add(t)
      const lower = p.lt(t) ? 0 : p.sub(t)
      if (ratio.gt(upper)) {
        queue.push(s)
        expectedAsset.push(expected)
      } else if (ratio.lt(lower)) {
        lastQueue.push(s)
        lastExpectedAsset.push(expected)
      } else {
        if (trigger) {
          queue.push(s)
          expectedAsset.push(expected)
        }
      }
    })
    return {
      queue: queue.concat(lastQueue),
      limits: expectedAsset.concat(lastExpectedAsset),
    }
  }

  const verifyTrigger = function (
    result,
    expectedStrategiesArray,
    expectedLimitArray,
  ) {
    const queue = result[0]
    const limits = result[1]
    queue.forEach((item, i) => {
      expect(item).to.be.equal(expectedStrategiesArray[i])
    })
    limits.forEach((item, i) => {
      expect(item).to.be.a.bignumber.equal(expectedLimitArray[i])
    })
    expect(queue.length).to.be.equal(expectedStrategiesArray.length)
    return expect(limits.length).to.be.equal(expectedLimitArray.length)
  }

  const verifyVault = function (
    expectedAirlock,
    expectedAdaptorAsset,
    expectedDebtLimits,
    expectedTotalDebt,
  ) {
    expect(mockDAIVault.airlock()).to.eventually.be.a.bignumber.equal(
      expectedAirlock,
    )
    expect(mockDAIVault.totalAssets()).to.eventually.be.a.bignumber.equal(
      expectedAdaptorAsset,
    )
    expect(
      mockDAIVault.strategiesTotalDebt(mockDAIS1.address),
    ).to.eventually.be.a.bignumber.equal(expectedTotalDebt[0])
    expect(
      mockDAIVault.strategiesTotalDebt(mockDAIS2.address),
    ).to.eventually.be.a.bignumber.equal(expectedTotalDebt[1])
    expect(
      mockDAIVault.strategiesTotalDebt(mockDAIS3.address),
    ).to.eventually.be.a.bignumber.equal(expectedTotalDebt[2])
    expect(
      mockDAIVault.strategiesTotalDebt(mockDAIS4.address),
    ).to.eventually.be.a.bignumber.equal(expectedTotalDebt[3])
    expect(
      mockDAIVault.strategiesDebtLimit(mockDAIS1.address),
    ).to.eventually.be.a.bignumber.equal(expectedDebtLimits[0])
    expect(
      mockDAIVault.strategiesDebtLimit(mockDAIS2.address),
    ).to.eventually.be.a.bignumber.equal(expectedDebtLimits[1])
    expect(
      mockDAIVault.strategiesDebtLimit(mockDAIS3.address),
    ).to.eventually.be.a.bignumber.equal(expectedDebtLimits[2])
    return expect(
      mockDAIVault.strategiesDebtLimit(mockDAIS4.address),
    ).to.eventually.be.a.bignumber.equal(expectedDebtLimits[3])
  }

  const initAirlock = async function (amount) {
    await mockDAI.mint(daiAdaptor.address, amount, { from: admin })
    await mockDAIVault.setAirlock(amount)
  }

  const toBN = function (amount, decimal) {
    return new BN(amount).mul(new BN(10).pow(new BN(decimal)))
  }

  const initStrategies = async function (
    strategies,
    estimatedTotalAssets,
    triggers,
    percents,
    thresholds,
  ) {
    // let promises = []
    // strategies.forEach((s, i) => {
    //     promises.push(daiAdaptor
    //       .setStrategyConfig(s.address, zero, percents[i], thresholds[i], { from: governance }));
    //     promises.push(s.setEstimatedAmount(estimatedTotalAssets[i]));
    //     promises.push(s.setWorthHarvest(triggers[i]));
    // })
    // await Promise.all(promises);
  }

  describe('withdraw', function () {
    beforeEach(async function () {
      await mockController.setLifeGuard(investor1);
      const amount = toBN(1000).mul(mockDAIDecimal);
      await mockDAI.mint(investor1, amount);
      await mockDAI.approve(daiAdaptor.address, amount, { from: investor1 });
      await daiAdaptor.deposit(amount, { from: investor1 });
    });

    it('withdraw', async () => {
      const amount = toBN(1000).mul(mockDAIDecimal);
      await mockController.setInsurance(investor1);
      await daiAdaptor.withdraw(amount, investor1, { from: investor1 });
      await expect(mockDAI.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(amount);
      return expect(daiAdaptor.totalAssets()).to.eventually.be.a.bignumber.equal(toBN(0));
    })

    it('withdrawByStrategyOrder', async () => {
      const amount = toBN(1000).mul(mockDAIDecimal);
      await mockController.setInsurance(investor1);
      await daiAdaptor.withdrawByStrategyOrder(amount, investor1, false, { from: investor1 });
      await expect(mockDAI.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(amount);
      return expect(daiAdaptor.totalAssets()).to.eventually.be.a.bignumber.equal(toBN(0));
    })

    it('withdrawByStrategyIndex', async () => {
      const amount = toBN(1000).mul(mockDAIDecimal);
      await mockController.setInsurance(investor1);
      await daiAdaptor.withdrawByStrategyIndex(amount, investor1, 0, { from: investor1 });
      await expect(mockDAI.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(amount);
      return expect(daiAdaptor.totalAssets()).to.eventually.be.a.bignumber.equal(toBN(0));
    })

    it("Should be possible to migrate to a new vault", async function () {
      const newAdaptor = await VaultAdaptorV0_1_3.new(mockDAIVault.address, mockDAI.address);
      await expect(mockDAI.balanceOf(daiAdaptor.address)).to.eventually.be.a.bignumber.greaterThan(toBN(0));
      await expect(mockDAI.balanceOf(newAdaptor.address)).to.eventually.be.a.bignumber.equal(toBN(0));
      await daiAdaptor.migrate(newAdaptor.address);
      await expect(mockDAI.balanceOf(daiAdaptor.address)).to.eventually.be.a.bignumber.equal(toBN(0));
      await expect(mockDAI.balanceOf(newAdaptor.address)).to.eventually.be.a.bignumber.greaterThan(toBN(0));
    })
  });

  describe('deposit', function () {
    it('deposit', async () => {
      const amount = toBN(1000).mul(mockDAIDecimal);
      await mockController.setLifeGuard(investor1);
      await mockDAI.mint(investor1, amount);
      await mockDAI.approve(daiAdaptor.address, amount, { from: investor1 });
      await daiAdaptor.deposit(amount, { from: investor1 });
      await expect(mockDAI.balanceOf(investor1)).to.eventually.be.a.bignumber.equal(toBN(0));
      return expect(daiAdaptor.totalAssets()).to.eventually.be.a.bignumber.equal(amount);
    })
  });

  describe("invest", function () {
    beforeEach(async function () {
      await daiAdaptor.setInvestThreshold(new BN(10000));
      await daiAdaptor.addToWhitelist(investor1);
      await daiAdaptor.addToWhitelist(governance);
    });

    it("Should return false when no assets in adaptor", async function () {
      return expect(
        daiAdaptor.investTrigger({ from: governance })
      ).to.eventually.be.equal(false);
    });

    // invest Trigger and invest
    it("Should return false when assets is below threshold", async function () {
      const amount = new BN(1000).mul(mockDAIDecimal);
      await mockDAI.mint(daiAdaptor.address, amount, { from: admin });
      return expect(
        daiAdaptor.investTrigger({ from: governance })
      ).to.eventually.be.false;
    });

    it("Should return false when assets is above threshold", async function () {
      const amount = new BN(100000).mul(mockDAIDecimal);
      await mockDAI.mint(daiAdaptor.address, amount, { from: admin });
      return expect(
        daiAdaptor.investTrigger({ from: governance })
      ).to.eventually.be.true;
    });

    it("Should send all assets to vault", async function () {
      const amount = new BN(100000).mul(mockDAIDecimal);
      await mockDAI.mint(daiAdaptor.address, amount, { from: admin });
      await daiAdaptor.invest({ from: governance });
      const afterInvestAdaptor = await mockDAI.balanceOf(daiAdaptor.address);
      const afterInvestVault = await mockDAI.balanceOf(mockDAIVault.address);
      expect(afterInvestAdaptor).to.be.bignumber.equal(new BN(0));
      return expect(afterInvestVault).to.be.bignumber.equal(amount);
    });

    it("Should send all assets to vault and set target ratio", async function () {
      const amount = new BN(100000).mul(mockDAIDecimal);
      await mockDAI.mint(daiAdaptor.address, amount, { from: admin });

      await daiAdaptor.setStrategiesLength(2);
      await mockDAIVault.setStrategies([mockDAIS1.address, mockDAIS2.address]);
      await mockDAIVault.setStrategyDebtRatio(mockDAIS1.address, 4000);
      await mockDAIVault.setStrategyDebtRatio(mockDAIS2.address, 6000);

      await daiAdaptor.invest({ from: governance });

      const ratios = await mockDAIVault.getStrategiesDebtRatio();

      const afterInvestAdaptor = await mockDAI.balanceOf(daiAdaptor.address);
      const afterInvestVault = await mockDAI.balanceOf(mockDAIVault.address);
      expect(afterInvestAdaptor).to.be.bignumber.equal(new BN(0));
      expect(afterInvestVault).to.be.bignumber.equal(amount);
      return expect(ratios.toString()).equal('5000,5000');
    });

    it("Should send all assets to vault and not set target ratio", async function () {
      const amount = new BN(100000).mul(mockDAIDecimal);
      await mockDAI.mint(daiAdaptor.address, amount, { from: admin });

      await daiAdaptor.setStrategiesLength(2);
      await mockDAIVault.setStrategies([mockDAIS1.address, mockDAIS2.address]);
      await mockDAIVault.setStrategyDebtRatio(mockDAIS1.address, 4000);
      await mockDAIVault.setStrategyDebtRatio(mockDAIS2.address, 6000);
      await daiAdaptor.setStrategyRatioBuffer(2000);

      await daiAdaptor.invest({ from: governance });

      const ratios = await mockDAIVault.getStrategiesDebtRatio();

      const afterInvestAdaptor = await mockDAI.balanceOf(daiAdaptor.address);
      const afterInvestVault = await mockDAI.balanceOf(mockDAIVault.address);
      expect(afterInvestAdaptor).to.be.bignumber.equal(new BN(0));
      expect(afterInvestVault).to.be.bignumber.equal(amount);
      return expect(ratios.toString()).equal('4000,6000');
    });
  });
})
