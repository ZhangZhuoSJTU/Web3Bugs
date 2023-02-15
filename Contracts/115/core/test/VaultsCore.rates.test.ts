const _ = require("underscore");
import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  LiquidationManagerInstance,
  USDXInstance,
  ConfigProviderInstance,
} from "../types/truffle-contracts";

const { BN, expectEvent, time } = require("@openzeppelin/test-helpers");
const truffleEvent = require("./utils/truffle-events.js");

import { cumulativeRateHelper, constants, basicSetup, depositAndBorrow } from "./utils/helpers";

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 USDX

contract("VaultsCore rates", (accounts) => {
  const [owner, other] = accounts;

  let c: {
    weth: MockWETHInstance;
    controller: AccessControllerInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    vaultsData: VaultsDataProviderInstance;
    rates: RatesManagerInstance;
    liquidator: LiquidationManagerInstance;
    config: ConfigProviderInstance;
  };

  beforeEach(async () => {
    c = await basicSetup();
    await c.weth.mint(other, WETH_AMOUNT); // Mint some test WETH
  });

  it("should initialize cumulative and current rate to 1", async () => {
    const cumulativeRate = await c.coreState.cumulativeRates(c.weth.address);
    assert.equal(cumulativeRate.toString(), constants.RATE_ACCURACY.toString());

    const borrowRate = await c.config.collateralBorrowRate(c.weth.address);
    assert.equal(borrowRate.toString(), constants.RATE_ACCURACY.toString());
  });

  it("should initialize the last rate update timestamp to deployment timestamp", async () => {
    const lastRefresh = await c.coreState.lastRefresh(c.weth.address);
    const latestTime = await time.latest();

    assert.isBelow(
      latestTime.sub(lastRefresh).toNumber(),
      10,
      "deployment timestamp should not be off by more than 10 sec",
    );
  });

  it("should be able to set a new rate", async () => {
    const txReceipt = await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, {
      from: owner,
    });

    expectEvent(txReceipt, "CollateralUpdated", {
      borrowRate: constants.RATE_50BPS.toString(),
    });

    const borrowRate = await c.config.collateralBorrowRate(c.weth.address);
    assert.equal(borrowRate.toString(), constants.RATE_50BPS.toString());

    const cumulativeRate = await c.coreState.cumulativeRates(c.weth.address);

    assert.equal(
      cumulativeRate.toString(),
      constants.RATE_0BPS.toString(),
      "cumulative rate should not have changed yet",
    );
  });

  it("Cumulative Rate should change as time passes", async () => {
    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });
    const initialRateUpdateBlockTime = await time.latest();
    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);

    const txReceipt2 = await c.coreState.refresh({ from: other }); // Anyone should be able to call this

    const cumulativeRateUpdatedEvent = _.findWhere(txReceipt2.logs, {
      event: "CumulativeRateUpdated",
    });

    const elapsedTime = new BN(cumulativeRateUpdatedEvent.args.elapsedTime);
    assert.isBelow(
      elapsedTime.sub(time.duration.years(1)).toNumber(),
      10,
      "elapsedTime should not be off by more than 10 sec",
    );

    const lastRateUpdate = await c.coreState.lastRefresh(c.weth.address);
    assert.isBelow(
      lastRateUpdate.sub(oneYearLater).toNumber(),
      10,
      "update timestamp should not be off by more than 10 sec",
    );

    const rateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);
    assert.equal(cumulativeRateUpdatedEvent.args.newCumulativeRate, rateAnnualized.toString());

    const cumulativeRate = await c.coreState.cumulativeRates(c.weth.address);
    assert.equal(
      cumulativeRate.toString(),
      rateAnnualized.toString(),
      "cumulative rate should increase by the annualized target rate over a 1 year timeframe",
    );
  });

  it("setBorrowRate should emit CumulativeRateUpdated event if time has passed", async () => {
    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });
    const initialRateUpdateBlockTime = await time.latest();
    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);

    const txReceipt = await c.config.setCollateralBorrowRate(c.weth.address, 0, {
      from: owner,
    });
    const decodedEvents = truffleEvent.decodeEvents(txReceipt, "VaultsCoreState");
    const cumulativeRateUpdated = _.findWhere(decodedEvents, { event: "CumulativeRateUpdated" });
    const elapsedTime = new BN(cumulativeRateUpdated.args.elapsedTime);
    const expectedRate = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);
    assert.equal(cumulativeRateUpdated.args.newCumulativeRate, expectedRate);
  });

  it("setBorrowRate should update income", async () => {
    await depositAndBorrow(c, {
      vaultOwner: owner,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: BORROW_AMOUNT,
    });

    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });
    const initialRateUpdateBlockTime = await time.latest();
    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);

    await c.config.setCollateralBorrowRate(c.weth.address, 0, { from: owner });

    const availableIncome = await c.coreState.availableIncome();
    assert.isTrue(availableIncome.gt(new BN(0)), "Income should not be 0 anymore");
  });
});
