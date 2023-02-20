const _ = require("underscore");
import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  USDXInstance,
  FeeDistributorInstance,
  ConfigProviderInstance,
  AddressProviderInstance,
} from "../types/truffle-contracts";
import { assert } from "chai";
import { constants, fullSetup, depositAndBorrow, cumulativeRateHelper } from "./utils/helpers";

const FeeDistributor = artifacts.require("FeeDistributor");

const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 USDX
const ORIGINATION_FEE = constants.AMOUNT_ACCURACY.div(new BN("100")); // 1% fee

contract("FeeDistributor", (accounts) => {
  const [owner, A, B, borrower, other] = accounts;
  const PAYEES = [A, B];
  const SHARES = [10, 80];

  let all_payees: string[];
  let all_shares: number[];

  let c: {
    weth: MockWETHInstance;
    controller: AccessControllerInstance;
    vaultsData: VaultsDataProviderInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    rates: RatesManagerInstance;
    fees: FeeDistributorInstance;
    config: ConfigProviderInstance;
    addresses: AddressProviderInstance;
  };

  beforeEach(async () => {
    c = await fullSetup({
      payees: PAYEES,
      shares: SHARES,
      insurance_shares: 10,
    });
    all_payees = [...PAYEES, c.core.address];
    all_shares = [...SHARES, 10];
  });

  it("should initialize fee distributor as minter", async () => {
    const minterRole = await c.controller.MINTER_ROLE();
    const isMinter = await c.controller.hasRole(minterRole, c.fees.address);
    assert.equal(isMinter, true);
  });

  it("should initialize with total shares", async () => {
    const totalShares = await c.fees.totalShares();
    assert.equal(totalShares.toString(), "100");
  });

  it("should initialize with payees and shares", async () => {
    const payees: string[] = await c.fees.getPayees();
    await Promise.all(
      payees.map(async (_: string, index: number) => {
        const payee = await c.fees.payees(index);
        assert.equal(payee, all_payees[index]);
      }),
    );

    await Promise.all(
      payees.map(async (payee: string, index: number) => {
        const share = await c.fees.shares(payee);
        assert.equal(share.toString(), all_shares[index].toString());
      }),
    );
  });

  it("should initialize cumulative and current rate to 1", async () => {
    const cumulativeRate = await c.core.cumulativeRates(c.weth.address);
    assert.equal(cumulativeRate.toString(), constants.RATE_ACCURACY.toString());

    const borrowRate = await c.config.collateralBorrowRate(c.weth.address);
    assert.equal(borrowRate.toString(), constants.RATE_ACCURACY.toString());
  });

  it("available income should be 0 after initialize", async () => {
    const availableIncome = await c.coreState.availableIncome();
    assert.equal(availableIncome.toString(), "0");
  });

  it("should be able to accrue fees", async () => {
    // Setup vault & borrow 100 USDX
    await depositAndBorrow(c, {
      vaultOwner: borrower,
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

    await c.coreState.refresh({ from: other });

    // Income calculation is tested in VaultsCore.income.test, here it's just a simple check of > 0
    const availableIncome = await c.coreState.availableIncome();
    assert.notEqual(availableIncome.toString(), "0");
  });

  it("should be able to release accrued fees to payees", async () => {
    await depositAndBorrow(c, {
      vaultOwner: borrower,
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

    const txReceipt1 = await c.coreState.refresh({ from: other });

    const payees: string[] = await c.fees.getPayees();

    // Check USDX balance of A and B before
    await Promise.all(
      payees.map(async (payee) => {
        const payeeBalanceBefore = await c.stablex.balanceOf(payee);
        assert.equal(payeeBalanceBefore.toString(), "0");
      }),
    );

    const cumulativeRateUpdatedEvent = _.findWhere(txReceipt1.logs, {
      event: "CumulativeRateUpdated",
    });
    const elapsedTime = new BN(cumulativeRateUpdatedEvent.args.elapsedTime);
    const rateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);
    const expectedTotalDebt = BORROW_AMOUNT.mul(rateAnnualized).div(constants.RATE_ACCURACY);
    const expectedIncome = expectedTotalDebt.sub(BORROW_AMOUNT);
    ///
    const availableIncome: BN = await c.coreState.availableIncome();
    const tokenSupplyBefore: BN = await c.stablex.totalSupply();
    const txReceipt2 = await c.fees.release({ from: other }); // Anyone can call this
    expectEvent(txReceipt2, "FeeReleased", {
      income: availableIncome,
    });
    const tokenSupplyAfter: BN = await c.stablex.totalSupply();
    // Check USDX balance of A and B after
    const totalShares = await c.fees.totalShares();
    await Promise.all(
      payees.map(async (payee) => {
        const payeeShare = await c.fees.shares(payee);
        const newPayeeIncome = availableIncome.mul(payeeShare).div(totalShares);
        const payeeBalanceAfter = await c.stablex.balanceOf(payee);
        assert.equal(payeeBalanceAfter.toString(), newPayeeIncome.toString());
      }),
    );

    const remainingAvailableIncome = await c.coreState.availableIncome();
    // Should mint USDX equal to available income
    const totalMinted = tokenSupplyAfter.sub(tokenSupplyBefore);
    assert.equal(totalMinted.add(remainingAvailableIncome).toString(), expectedIncome.toString());
  });

  it("should allow updating payees", async () => {
    await c.fees.changePayees([owner], [1]);
    const payees: string[] = await c.fees.getPayees();
    assert.deepEqual(payees, [owner]);

    const totalShares = await c.fees.totalShares();
    assert.equal(totalShares.toString(), "1");
  });

  it("release without any payees configured should fail", async () => {
    await c.config.setCollateralOriginationFee(c.weth.address, ORIGINATION_FEE);

    c.fees = await FeeDistributor.new(c.addresses.address);
    const payees: string[] = await c.fees.getPayees();
    assert.deepEqual(payees, []);

    await depositAndBorrow(c, {
      vaultOwner: borrower,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: BORROW_AMOUNT,
    });
    const expectedIncome = BORROW_AMOUNT.div(new BN(100));

    const availableIncomeBefore = await c.coreState.availableIncome();
    assert.equal(availableIncomeBefore.toString(), expectedIncome.toString());
    await expectRevert(c.fees.release(), "Payees not configured yet");
    const availableIncomeAfter = await c.coreState.availableIncome();
    assert.equal(availableIncomeAfter.toString(), expectedIncome.toString());
  });

  it.skip("changePayees should distribute existing income");
  it.skip("updating payees should work correctly");
});
