import { AccessControllerInstance, RatesManagerInstance } from "../types/truffle-contracts";
import { cumulativeRateHelper, newRay, constants } from "./utils/helpers";

const { BN } = require("@openzeppelin/test-helpers");

const AccessController = artifacts.require("AccessController");
const RatesManager = artifacts.require("RatesManager");
const AddressProvider = artifacts.require("AddressProvider");

const ONE_BILLION = new BN("1000000000");
const RATE_50BPS_ANNUALIZED = new BN("1004999999999999999993941765"); //
const RATE_150BPS_ANNUALIZED = new BN("1014999999999999999996414611");

let controller: AccessControllerInstance;

contract("RatesManager calculations", () => {
  let rates: RatesManagerInstance;
  before(async () => {
    controller = await AccessController.new();
    const a = await AddressProvider.new(controller.address);

    rates = await RatesManager.new(a.address);
  });

  it("test helpder function cumulativeRateHelper should calculate correctly", async () => {
    const x1 = cumulativeRateHelper(newRay("2"), new BN(3));
    const r1 = newRay("8");
    assert.equal(x1.toString(), r1.toString(), "2^3==8");

    const x2 = cumulativeRateHelper(newRay("3"), new BN(2));
    const r2 = newRay("9");
    assert.equal(x2.toString(), r2.toString(), "3^2==9");

    const x3 = cumulativeRateHelper(new BN("1000000000158153903837946258"), new BN(2));
    const r3 = new BN("1000000000316307807700905173");
    assert.equal(x3.toString(), r3.toString());

    const x4 = cumulativeRateHelper(new BN("1000000000158153903837946258"), new BN(10));
    const r4 = new BN("1000000001581539039505032157");
    assert.equal(x4.toString(), r4.toString());

    const x5 = cumulativeRateHelper(constants.RATE_50BPS, new BN(31536000));
    const r5 = RATE_50BPS_ANNUALIZED;
    assert.equal(x5.toString(), r5.toString());

    const x6 = cumulativeRateHelper(constants.RATE_150BPS, new BN(31536000));
    const r6 = RATE_150BPS_ANNUALIZED;
    assert.equal(x6.toString(), r6.toString());
  });

  it("debt should equal baseDebt at rate 1", async () => {
    const debt = await rates.calculateDebt(ONE_BILLION, constants.RATE_0BPS);
    assert.equal(debt.toString(), ONE_BILLION.toString());

    const baseDebt = await rates.calculateBaseDebt(ONE_BILLION, constants.RATE_0BPS);
    assert.equal(baseDebt.toString(), ONE_BILLION.toString());
  });

  it.skip("lastRefresh should be set correctly");

  it.skip("Cumulative Rate should be correctly calculated for an interval as small as 1 second");

  it.skip(
    "Base Debt should be correctly calculated and rounded up to make sure totaldebt is never below withdrawn amount",
  );

  it.skip("Incremental cumulativeRate updates should be the same as infrequent updates");

  it.skip("Should not allow for buffer overflow on interest rates");

  it.skip("Should not allow for buffer overflow on debt calculations");

  it.skip("Cumulative Rate update function should work with 0 time has passed");

  it.skip("Updating the borrow rate should correctly calculate previous rate increase");
});
