const _ = require("underscore");
import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  USDXInstance,
  ConfigProviderInstance,
  MockChainlinkAggregatorInstance,
} from "../types/truffle-contracts";

const { BN, time } = require("@openzeppelin/test-helpers");
import { cumulativeRateHelper, basicSetup, depositAndBorrow, constants } from "./utils/helpers";
const truffleEvent = require("./utils/truffle-events.js");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 USDX

contract("VaultsCore income", (accounts) => {
  const [owner, other] = accounts;

  let c: {
    weth: MockWETHInstance;
    controller: AccessControllerInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    vaultsData: VaultsDataProviderInstance;
    rates: RatesManagerInstance;
    config: ConfigProviderInstance;
    aggregator: MockChainlinkAggregatorInstance;
    aggregatorEUR: MockChainlinkAggregatorInstance;
  };

  beforeEach(async () => {
    c = await basicSetup();

    await c.weth.mint(other, WETH_AMOUNT); // Mint some test WETH
  });

  it("should calculate income correctly for a single vault", async () => {
    // Setup vault & borrow 100 USDX
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: other });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: other });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, other);

    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: other });

    // Change borrow rate to 0.5%
    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });
    const initialRateUpdateBlockTime = await time.latest();

    // 1 year passes
    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);

    const txReceipt = await c.coreState.refresh({ from: other }); // Anyone should be able to call this

    const cumulativeRateUpdatedEvent = _.findWhere(txReceipt.logs, {
      event: "CumulativeRateUpdated",
    });

    const elapsedTime = new BN(cumulativeRateUpdatedEvent.args.elapsedTime);
    assert.isBelow(
      elapsedTime.sub(time.duration.years(1)).toNumber(),
      10,
      "elapsedTime should not be off by more than 10 sec",
    );

    // Test income calculation
    const rateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);
    const expectedIncome = rateAnnualized.mul(BORROW_AMOUNT).div(constants.RATE_ACCURACY).sub(BORROW_AMOUNT);

    const debt = await c.vaultsData.debt();
    const incomeFromDebt = debt.sub(BORROW_AMOUNT);
    assert.equal(incomeFromDebt.toString(), expectedIncome.toString());

    const availableIncome = await c.coreState.availableIncome();
    assert.equal(availableIncome.toString(), expectedIncome.toString());
  });

  it("should add origination fee to income when borrowing", async () => {
    const originationFeePercentage = String(1e16); // 1%
    await c.config.setCollateralOriginationFee(c.weth.address, originationFeePercentage);

    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: other });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: other });

    const vaultId = await c.vaultsData.vaultId(c.weth.address, other);
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: other });

    const originationFee = BORROW_AMOUNT.mul(new BN(originationFeePercentage)).div(new BN(String(1e18)));
    const outstandingDebtPlusFee = BORROW_AMOUNT.add(originationFee);

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), outstandingDebtPlusFee.toString());

    const availableIncome = await c.coreState.availableIncome();
    assert.equal(availableIncome.toString(), originationFee.toString());
  });

  it("withdraw should update income and cumulative rate", async () => {
    // Setup vault & borrow 100 USDX
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: other,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: BORROW_AMOUNT,
    });

    // Change borrow rate to 0.5%
    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });
    const initialRateUpdateBlockTime = await time.latest();

    // 1 year passes
    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);
    await c.aggregator.setUpdatedAt(await time.latest());
    await c.aggregatorEUR.setUpdatedAt(await time.latest());

    const txReceipt = await c.core.withdraw(vaultId, 1, { from: other });

    const decodedEvents = truffleEvent.decodeEvents(txReceipt, "VaultsCoreState");
    const cumulativeRateUpdated = _.findWhere(decodedEvents, { event: "CumulativeRateUpdated" });
    const elapsedTime = new BN(cumulativeRateUpdated.args.elapsedTime);

    // Test income calculation
    const rateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);
    const expectedIncome = rateAnnualized.mul(BORROW_AMOUNT).div(constants.RATE_ACCURACY).sub(BORROW_AMOUNT);

    const debt = await c.vaultsData.debt();
    const incomeFromDebt = debt.sub(BORROW_AMOUNT);
    assert.equal(incomeFromDebt.toString(), expectedIncome.toString());

    const availableIncome = await c.coreState.availableIncome();
    assert.equal(availableIncome.toString(), expectedIncome.toString());
  });

  it.skip("should calculate income correctly for multiple vaults");
  it.skip("should calculate income correctly with changing interest rates");
  it.skip("should calculate income correctly when repaying");
  it.skip("should calculate income correctly when liquidating");
  it.skip("should calculate income correctly when borrowing more");
});
