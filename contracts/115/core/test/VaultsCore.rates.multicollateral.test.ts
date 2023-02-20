const _ = require("underscore");
import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  MockWBTCInstance,
  RatesManagerInstance,
  LiquidationManagerInstance,
  AccessControllerInstance,
  MockChainlinkAggregatorInstance,
  PriceFeedInstance,
  USDXInstance,
  ConfigProviderInstance,
} from "../types/truffle-contracts";

const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");
const { setCollateralConfig, cumulativeRateHelper, constants, basicSetup } = require("./utils/helpers");

const WBTC = artifacts.require("MockWBTC");

const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH
const WBTC_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("2")); // 2 BTC

contract("VaultsCore rates multi collateral", (accounts) => {
  const [owner, other] = accounts;

  let c: {
    weth: MockWETHInstance;
    wbtc: MockWBTCInstance;
    config: ConfigProviderInstance;
    aggregator: MockChainlinkAggregatorInstance;
    controller: AccessControllerInstance;
    feed: PriceFeedInstance;
    usdx: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    vaultsData: VaultsDataProviderInstance;
    rates: RatesManagerInstance;
    liquidator: LiquidationManagerInstance;
  };

  beforeEach(async () => {
    const cSetup = await basicSetup({
      wethRate: constants.RATE_50BPS,
    });

    await cSetup.weth.mint(owner, WETH_AMOUNT);
    const wbtc = await WBTC.new();
    await wbtc.mint(other, WBTC_AMOUNT); // Mint some test WBTC
    await setCollateralConfig(cSetup.config, { collateralType: wbtc.address, borrowRate: constants.RATE_150BPS });

    c = { ...cSetup, wbtc };
  });

  it("interest rate for WETH and WBTC should be properly initialized", async () => {
    const wethRate = await c.config.collateralBorrowRate(c.weth.address);
    const wbtcRate = await c.config.collateralBorrowRate(c.wbtc.address);

    assert.equal(wethRate.toString(), constants.RATE_50BPS.toString());
    assert.equal(wbtcRate.toString(), constants.RATE_150BPS.toString());
  });

  it("Cumulative Rates for each collateral should change as time passes", async () => {
    const initialBlockTime = await time.latest();

    const oneYearLater = time.duration.years(1).add(initialBlockTime);
    await time.increaseTo(oneYearLater);

    const txReceipt2 = await c.coreState.refresh({ from: other }); // Anyone should be able to call this

    const updatevents = _.where(txReceipt2.logs, { event: "CumulativeRateUpdated" });
    const updateventWETH = updatevents[0];
    const updateventWBTC = updatevents[1];

    const elapsedTimeWETH = new BN(updateventWETH.args.elapsedTime);
    const elapsedTimeWBTC = new BN(updateventWBTC.args.elapsedTime);

    for (const elapsedTime of [elapsedTimeWETH, elapsedTimeWBTC]) {
      assert.isBelow(
        elapsedTime.sub(time.duration.years(1)).toNumber(),
        10,
        "elapsedTime should not be off by more than 10 sec",
      );
    }

    const wethRateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTimeWETH);
    const wbtcRateAnnualized = cumulativeRateHelper(constants.RATE_150BPS, elapsedTimeWBTC);

    const wethCumulativeRate = await c.coreState.cumulativeRates(c.weth.address);
    const wbtcCumulativeRate = await c.coreState.cumulativeRates(c.wbtc.address);
    assert.equal(wethCumulativeRate.toString(), wethRateAnnualized.toString());
    assert.equal(wbtcCumulativeRate.toString(), wbtcRateAnnualized.toString());
  });

  it("should be possible to remove collateral type", async () => {
    const wbtcRate = await c.config.collateralBorrowRate(c.wbtc.address);
    assert.strictEqual(wbtcRate.toString(), constants.RATE_150BPS.toString());

    const numberSupportedCollateralTypesBefore = await c.config.numCollateralConfigs();
    assert.equal(
      numberSupportedCollateralTypesBefore.toNumber(),
      2,
      "expected two collateral types before removing one",
    );

    const wbtcCollateralTypeBefore = (await c.config.collateralConfigs(2)).collateralType;
    assert.strictEqual(wbtcCollateralTypeBefore, c.wbtc.address);

    await c.config.removeCollateral(c.weth.address);

    const numberCollateralConfigsAfter = await c.config.numCollateralConfigs();
    assert.equal(numberCollateralConfigsAfter.toNumber(), 1, "expected numCollateralConfigsAfter to decrease");

    await expectRevert(c.config.collateralConfigs(2), "Invalid config id");

    const wethRateAfter = await c.config.collateralBorrowRate(c.weth.address);
    assert.strictEqual(wethRateAfter.toString(), "0", "expected rate to be set to 0");

    const wbtcRateAfter = await c.config.collateralBorrowRate(c.wbtc.address);
    assert.strictEqual(wbtcRateAfter.toString(), constants.RATE_150BPS.toString());
  });

  it("should be possible to remove the last collateral type and add it back", async () => {
    const wbtcRate = await c.config.collateralBorrowRate(c.wbtc.address);
    assert.strictEqual(wbtcRate.toString(), constants.RATE_150BPS.toString());

    const numberSupportedCollateralTypesBefore = await c.config.numCollateralConfigs();
    assert.equal(
      numberSupportedCollateralTypesBefore.toNumber(),
      2,
      "expected two collateral types before removing one",
    );

    const wbtcCollateralTypeBefore = (await c.config.collateralConfigs(2)).collateralType;
    assert.strictEqual(wbtcCollateralTypeBefore, c.wbtc.address);

    await c.config.removeCollateral(c.wbtc.address);

    assert.strictEqual((await c.config.collateralIds(c.weth.address)).toNumber(), 1, "expected weth id to be 1");
    assert.strictEqual((await c.config.collateralIds(c.wbtc.address)).toNumber(), 0, "expected wbtc id to be 0");

    const numberCollateralConfigsAfter = await c.config.numCollateralConfigs();
    assert.equal(numberCollateralConfigsAfter.toNumber(), 1, "expected numCollateralConfigsAfter to decrease");

    await expectRevert(c.config.collateralConfigs(2), "Invalid config id");

    await setCollateralConfig(c.config, { collateralType: c.wbtc.address, borrowRate: constants.RATE_150BPS });

    const numberCollateralConfigsAfterAgain = await c.config.numCollateralConfigs();
    assert.equal(numberCollateralConfigsAfterAgain.toNumber(), 2);

    assert.strictEqual((await c.config.collateralIds(c.weth.address)).toNumber(), 1, "expected weth id to be 1");
    assert.strictEqual((await c.config.collateralIds(c.wbtc.address)).toNumber(), 2, "expected wbtc id to be 2");
  });

  it("should be possible to remove the first collateral type and add it back", async () => {
    const wbtcRate = await c.config.collateralBorrowRate(c.wbtc.address);
    assert.strictEqual(wbtcRate.toString(), constants.RATE_150BPS.toString());

    const numberSupportedCollateralTypesBefore = await c.config.numCollateralConfigs();
    assert.equal(
      numberSupportedCollateralTypesBefore.toNumber(),
      2,
      "expected two collateral types before removing one",
    );

    const wbtcCollateralTypeBefore = (await c.config.collateralConfigs(2)).collateralType;
    assert.strictEqual(wbtcCollateralTypeBefore, c.wbtc.address);

    await c.config.removeCollateral(c.weth.address);

    assert.strictEqual((await c.config.collateralIds(c.weth.address)).toNumber(), 0, "expected weth id to be 0");
    assert.strictEqual((await c.config.collateralIds(c.wbtc.address)).toNumber(), 1, "expected wbtc id to be 1");

    const numberCollateralConfigsAfter = await c.config.numCollateralConfigs();
    assert.equal(numberCollateralConfigsAfter.toNumber(), 1, "expected numCollateralConfigsAfter to decrease");

    await expectRevert(c.config.collateralConfigs(2), "Invalid config id");

    await setCollateralConfig(c.config, { collateralType: c.weth.address, borrowRate: constants.RATE_150BPS });

    const numberCollateralConfigsAfterAgain = await c.config.numCollateralConfigs();
    assert.equal(numberCollateralConfigsAfterAgain.toNumber(), 2);

    assert.strictEqual((await c.config.collateralIds(c.weth.address)).toNumber(), 2, "expected weth id to be 2");
    assert.strictEqual((await c.config.collateralIds(c.wbtc.address)).toNumber(), 1, "expected wbtc id to be 1");
  });

  it.skip("should be able to configure different margin limits for each collateral");
  it.skip("margin limits should be enforced correctly for different collateral types");
  it.skip("total debt for 2 vaults with different colalteral should be calculated correctly");
});
