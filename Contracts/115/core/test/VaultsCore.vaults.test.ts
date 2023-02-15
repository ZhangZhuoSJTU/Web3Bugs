import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  USDXInstance,
  PriceFeedInstance,
  MockChainlinkAggregatorInstance,
  LiquidationManagerInstance,
  ConfigProviderInstance,
} from "../types/truffle-contracts/index";
import { assert, expect } from "chai";
import _ from "underscore";

const MockBuggyERC20 = artifacts.require("MockBuggyERC20");
const WBTC = artifacts.require("MockWBTC");

const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");
import { setCollateralConfig, cumulativeRateHelper, basicSetup, constants, getTxFee } from "./utils/helpers";

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 PAR
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH

// Tests for individual tests
contract("VaultsCore vaults", (accounts) => {
  const [owner, alice, other] = accounts;

  let c: {
    weth: MockWETHInstance;
    controller: AccessControllerInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    vaultsData: VaultsDataProviderInstance;
    rates: RatesManagerInstance;
    liquidator: LiquidationManagerInstance;
    feed: PriceFeedInstance;
    aggregatorEUR: MockChainlinkAggregatorInstance;
    config: ConfigProviderInstance;
  };

  beforeEach(async () => {
    c = await basicSetup();
    await c.weth.mint(alice, WETH_AMOUNT); // Mint some test WETH
  });

  it("user can open a vault via a deposit", async () => {
    await c.weth.approve(c.core.address, 1, { from: alice });
    await c.core.deposit(c.weth.address, 1, { from: alice });
    const newNumberVaults = await c.vaultsData.vaultCount();
    assert.equal(newNumberVaults.toNumber(), 1);

    const vault = await c.vaultsData.vaults(newNumberVaults);
    expect(vault.collateralType.toString()).to.equal(c.weth.address);
    expect(vault.owner.toString()).to.equal(alice);
    expect(vault.collateralBalance.toString()).to.equal("1"); // Truffle-contract bug?
    expect(vault.createdAt.toString()).to.not.equal("0");
  });

  it("depositing without sufficient allowance should fail", async () => {
    const allowance = await c.weth.allowance(alice, c.core.address);
    expect(allowance.toNumber()).to.equal(0);

    await expectRevert(
      c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice }),
      "ERC20: transfer amount exceeds allowance",
    );
  });

  it("depositing with sufficient allowance should add to vault balance", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });

    const allowance = await c.weth.allowance(alice, c.core.address);
    assert.equal(allowance.toString(), DEPOSIT_AMOUNT.toString());

    const txReceipt = await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, {
      from: alice,
    });

    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    expectEvent(txReceipt, "Deposited", {
      amount: DEPOSIT_AMOUNT.toString(),
      sender: alice,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    expect(vault.collateralBalance.toString()).to.equal(DEPOSIT_AMOUNT.toString());
  });

  it("non-owners of a vault cannot withdraw", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);

    await expectRevert.unspecified(c.core.withdraw(vaultId, 99, { from: other }));
  });

  it("vault owner cannot withdraw more than vault balance", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await expectRevert.unspecified(c.core.withdraw(vaultId, DEPOSIT_AMOUNT.add(new BN(1)), { from: alice }));
  });

  it("vault owner can withdraw part of his vault collateral", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const txReceipt = await c.core.withdraw(vaultId, DEPOSIT_AMOUNT.div(new BN(2)), { from: alice });

    expectEvent(txReceipt, "Withdrawn", {
      amount: DEPOSIT_AMOUNT.div(new BN(2)).toString(),
      sender: alice,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), DEPOSIT_AMOUNT.div(new BN(2)).toString());
  });

  it("vault owner can borrow", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const txReceipt = await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    expectEvent(txReceipt, "Borrowed", {
      amount: BORROW_AMOUNT.toString(),
      sender: alice,
      vaultId,
    });

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), BORROW_AMOUNT.toString());
  });

  it("vault owner can borrow with an origination fee", async () => {
    const originationFeePercentage = String(1e16); // 1%
    await c.config.setCollateralOriginationFee(c.weth.address, originationFeePercentage);

    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const txReceipt = await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    expectEvent(txReceipt, "Borrowed", {
      amount: BORROW_AMOUNT.toString(),
      sender: alice,
      vaultId,
    });

    const originationFee = BORROW_AMOUNT.mul(new BN(originationFeePercentage)).div(new BN(String(1e18)));
    const outstandingDebtPlusFee = BORROW_AMOUNT.add(originationFee);

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), outstandingDebtPlusFee.toString());
  });

  it("should calculate origination fee correctly after time has passed", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const originationFeePercentage = String(1e16); // 1%
    await c.config.setCollateralOriginationFee(c.weth.address, originationFeePercentage);

    const borrowReceipt = await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    expectEvent(borrowReceipt, "Borrowed", {
      amount: BORROW_AMOUNT.toString(),
      sender: alice,
      vaultId,
    });

    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });

    // Add 1 year in time
    const initialRateUpdateBlockTime = await time.latest();
    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);

    const txReceipt = await c.coreState.refresh({ from: other }); // Anyone should be able to call this
    const cumulativeRateUpdatedEvent = _.findWhere(txReceipt.logs, {
      event: "CumulativeRateUpdated",
    });
    // @ts-expect-error
    const elapsedTime = new BN(cumulativeRateUpdatedEvent.args.elapsedTime);
    const rateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);

    // Check outstanding debt
    const originationFee = BORROW_AMOUNT.mul(new BN(originationFeePercentage)).div(constants.AMOUNT_ACCURACY);
    const expectedVaultDebt = BORROW_AMOUNT.add(originationFee).mul(rateAnnualized).div(constants.RATE_ACCURACY);
    const actualVaultDebt = await c.vaultsData.vaultDebt(vaultId);

    assert.equal(actualVaultDebt.toString(), expectedVaultDebt.toString());
  });

  it.skip("should calculate income correctly with orignation fee");

  it("vault owner can repay partially", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    await c.vaultsData.vaults(vaultId);
    await c.core.repay(vaultId, 1, { from: alice });

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);

    const expectedBalanceOutstanding = BORROW_AMOUNT.sub(new BN("1"));
    assert.equal(outstandingVaultDebt.toString(), expectedBalanceOutstanding.toString());
  });

  it("vault owner can repay fully", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    await c.core.repay(vaultId, BORROW_AMOUNT, { from: alice });

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), "0");
  });

  it("vault owner can repay without specifying amount", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });

    await c.core.repayAll(vaultId, { from: alice });

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), "0");

    const newDebt = await c.vaultsData.debt();
    assert.equal(newDebt.toString(), "0");
  });

  it("vault owner cannot withdraw below the min collateralization ratio", async () => {
    const open_ratio = String(2e18);
    const deposit_amount = constants.AMOUNT_ACCURACY.mul(new BN(3)).div(new BN(10)); // 0.3 ETH -> 90 PAR value
    const borrow_amount = constants.AMOUNT_ACCURACY.mul(new BN(30)); // 0.2 ETH
    await c.config.setCollateralMinCollateralRatio(c.weth.address, open_ratio);
    await c.weth.approve(c.core.address, deposit_amount, { from: alice });
    await c.core.deposit(c.weth.address, deposit_amount, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await c.core.borrow(vaultId, borrow_amount, { from: alice });

    const min_deposit = borrow_amount.mul(new BN(2)).mul(constants.PRICE_ACCURACY).div(constants.WETH_PRICE); // Min = borrow * 1.6/ price
    const max_withdraw = deposit_amount.sub(min_deposit);

    await expectRevert.unspecified(c.core.withdraw(vaultId, deposit_amount, { from: alice }));

    // Try withdraw 1 too much
    await expectRevert.unspecified(c.core.withdraw(vaultId, max_withdraw.add(new BN(1)), { from: alice }));

    const minCollateralValue = await c.feed.convertFrom(c.weth.address, min_deposit);

    const healthFactor = await c.liquidator.calculateHealthFactor(minCollateralValue, borrow_amount, open_ratio);
    assert.equal(healthFactor.toString(), constants.AMOUNT_ACCURACY.toString());
    // Try withdraw max amount
    await c.core.withdraw(vaultId, max_withdraw, { from: alice });
    const vault = await c.vaultsData.vaults(vaultId);

    assert.equal(vault.collateralBalance.toString(), min_deposit.toString());
  });

  it("vault owner cannot borrow and let the health factor go below 1", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const maxBorrow = DEPOSIT_AMOUNT.mul(constants.WETH_PRICE)
      .div(constants.PRICE_ACCURACY)
      .div(new BN(16))
      .mul(new BN(10)); // Max = deposit * price / 1.6

    const collateralValue = await c.feed.convertFrom(c.weth.address, DEPOSIT_AMOUNT);
    const healthFactorLimit = await c.liquidator.calculateHealthFactor(
      collateralValue,
      maxBorrow,
      constants.MIN_COLLATERAL_RATIO,
    );
    assert.equal(healthFactorLimit.toString(), constants.AMOUNT_ACCURACY.toString());

    const healthFactorAboveLimit = await c.liquidator.calculateHealthFactor(
      collateralValue,
      maxBorrow.add(new BN(100)),
      constants.MIN_COLLATERAL_RATIO,
    );
    assert.equal(healthFactorAboveLimit.toString(), constants.AMOUNT_ACCURACY.sub(new BN("1")).toString());
    // Try borrow 1 too much
    await expectRevert.unspecified(c.core.borrow(vaultId, maxBorrow.add(new BN(100)), { from: alice }));

    // Try borrow max amount
    await c.core.borrow(vaultId, maxBorrow, { from: alice });
    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), maxBorrow.toString());
  });

  it("borrower should get half stable coin when 1 EUR = 2 USD", async () => {
    await c.aggregatorEUR.setLatestPrice(constants.PRICE_ACCURACY.muln(2));
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const maxBorrow = DEPOSIT_AMOUNT.mul(constants.WETH_PRICE).div(constants.PRICE_ACCURACY).divn(2).divn(16).muln(10); // Max = deposit * price / 1.6

    const collateralValue = await c.feed.convertFrom(c.weth.address, DEPOSIT_AMOUNT);
    const healthFactorLimit = await c.liquidator.calculateHealthFactor(
      collateralValue,
      maxBorrow,
      constants.MIN_COLLATERAL_RATIO,
    );
    assert.equal(healthFactorLimit.toString(), constants.AMOUNT_ACCURACY.toString());

    const healthFactorAboveLimit = await c.liquidator.calculateHealthFactor(
      collateralValue,
      maxBorrow.add(new BN(100)),
      constants.MIN_COLLATERAL_RATIO,
    );
    assert.equal(healthFactorAboveLimit.toString(), constants.AMOUNT_ACCURACY.sub(new BN("1")).toString());
    // Try borrow 1 too much
    await expectRevert.unspecified(c.core.borrow(vaultId, maxBorrow.add(new BN(100)), { from: alice }));

    // Try borrow max amount
    await c.core.borrow(vaultId, maxBorrow, { from: alice });
    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), maxBorrow.toString());
  });

  it("should support buggy ERC20 interface", async () => {
    const BUG = await MockBuggyERC20.new("Buggy ERC20", "BUG");
    await BUG.mint(other, WETH_AMOUNT);
    await setCollateralConfig(c.config, { collateralType: BUG.address, borrowRate: constants.RATE_0BPS });

    await BUG.approve(c.core.address, DEPOSIT_AMOUNT, { from: other });

    const allowance = await BUG.allowance(other, c.core.address);
    assert.equal(allowance.toString(), DEPOSIT_AMOUNT.toString());

    await c.core.deposit(BUG.address, DEPOSIT_AMOUNT, {
      from: other,
    });

    const vaultId = await c.vaultsData.vaultId(BUG.address, other);
    const vault = await c.vaultsData.vaults(vaultId);
    expect(vault.collateralType.toString()).to.equal(BUG.address);
    expect(vault.owner.toString()).to.equal(other);
    expect(vault.collateralBalance.toString()).to.equal(DEPOSIT_AMOUNT.toString());

    // Now withdraw some collateral to test `safeTransfer` works
    const withdrawTxReceipt = await c.core.withdraw(vaultId, DEPOSIT_AMOUNT.div(new BN(2)), { from: other });

    expectEvent(withdrawTxReceipt, "Withdrawn", {
      amount: DEPOSIT_AMOUNT.div(new BN(2)).toString(),
      sender: other,
      vaultId,
    });

    const vaultAfterWithdrawal = await c.vaultsData.vaults(vaultId);
    assert.equal(vaultAfterWithdrawal.collateralBalance.toString(), DEPOSIT_AMOUNT.div(new BN(2)).toString());
  });

  it("should be possible to deposit and borrow from a new vault", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    // Const vault = await c.vaultsData.vaults(vaultId);
    const txReceipt = await c.core.depositAndBorrow(c.weth.address, DEPOSIT_AMOUNT, BORROW_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);

    expectEvent(txReceipt, "Deposited", {
      amount: DEPOSIT_AMOUNT.toString(),
      sender: alice,
      vaultId,
    });

    expectEvent(txReceipt, "Borrowed", {
      amount: BORROW_AMOUNT.toString(),
      sender: alice,
      vaultId,
    });

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), BORROW_AMOUNT.toString());
  });

  it("should be possible to deposit and borrow from an existing vault", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT.mul(new BN(2)), { from: alice });
    // Const vault = await c.vaultsData.vaults(vaultId);
    await c.core.depositAndBorrow(c.weth.address, DEPOSIT_AMOUNT, BORROW_AMOUNT, { from: alice });
    await c.core.depositAndBorrow(c.weth.address, DEPOSIT_AMOUNT, BORROW_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);

    const vault = await c.vaultsData.vaults(vaultId);
    assert.strictEqual(
      vault.collateralBalance,
      DEPOSIT_AMOUNT.mul(new BN(2)).toString(),
      "expected double deposit amount as collateral",
    );

    const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(outstandingVaultDebt.toString(), BORROW_AMOUNT.mul(new BN(2)).toString());
  });

  it("should be possible to deposit by vault id by another account", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);

    await c.weth.mint(other, WETH_AMOUNT);
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: other });
    await c.core.depositByVaultId(vaultId, DEPOSIT_AMOUNT, { from: other });

    const vault = await c.vaultsData.vaults(vaultId);

    assert.equal(vault.collateralBalance.toString(), DEPOSIT_AMOUNT.mul(new BN(2)).toString());
  });

  it("should not allow non-WETH address send ETH directly", async () => {
    await expectRevert.unspecified(
      web3.eth.sendTransaction({ from: alice, to: c.core.address, value: DEPOSIT_AMOUNT }),
    );
  });

  describe("ETH support", () => {
    it("should allow to deposit ETH into a vault", async () => {
      const depositETHAmount = new BN("1000");
      const ethBalanceBefore = await web3.eth.getBalance(alice);

      const coreWethBalanceBefore = await c.weth.balanceOf(c.core.address);
      assert.equal(coreWethBalanceBefore.toString(), "0", "expected the core to have WETH now");

      const txReceipt = await c.core.depositETH({ from: alice, value: depositETHAmount });
      const txFee = await getTxFee(txReceipt);

      const wethETHBalance = await web3.eth.getBalance(c.weth.address);
      assert.strictEqual(
        wethETHBalance.toString(),
        depositETHAmount.toString(),
        "expected the WETH contract to have received the deposit amount",
      );

      const coreWethBalanceAfter = await c.weth.balanceOf(c.core.address);
      assert.equal(coreWethBalanceAfter.toString(), depositETHAmount.toString(), "expected the core to have WETH now");

      const ethBalanceAfter = await web3.eth.getBalance(alice);
      const expectedBalanceAfter = new BN(ethBalanceBefore).sub(txFee).sub(depositETHAmount);
      assert.equal(ethBalanceAfter, expectedBalanceAfter.toString());

      const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
      const vault = await c.vaultsData.vaults(vaultId);

      assert.strictEqual(vault.collateralBalance.toString(), depositETHAmount.toString());
    });

    it("should be possible to deposit by vault id by another account with ETH", async () => {
      await c.core.depositETH({ from: alice, value: DEPOSIT_AMOUNT });
      const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);

      await c.core.depositETHByVaultId(vaultId, { from: other, value: DEPOSIT_AMOUNT });

      const vault = await c.vaultsData.vaults(vaultId);

      assert.equal(vault.collateralBalance.toString(), DEPOSIT_AMOUNT.mul(new BN(2)).toString());
    });

    it("should allow withdrawal of ETH from a WETH vault", async () => {
      const depositETHAmount = new BN("1000");
      const ethBalanceBefore = await web3.eth.getBalance(alice);
      const txReceipt = await c.core.depositETH({ from: alice, value: depositETHAmount });
      const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
      const depositTxFee = await getTxFee(txReceipt);

      const coreWethBalanceAfterDeposit = await c.weth.balanceOf(c.core.address);
      assert.equal(
        coreWethBalanceAfterDeposit.toString(),
        depositETHAmount.toString(),
        "expected the core to have WETH now",
      );

      const withdrawTxReceipt = await c.core.withdrawETH(vaultId, depositETHAmount, { from: alice });
      const withdrawTxFee = await getTxFee(withdrawTxReceipt);

      const ethBalanceAfter = await web3.eth.getBalance(alice);

      const expectedEthBalancerAfter = new BN(ethBalanceBefore).sub(depositTxFee).sub(withdrawTxFee);
      assert.strictEqual(ethBalanceAfter, expectedEthBalancerAfter.toString());

      const coreWethBalanceAfterWithdrawal = await c.weth.balanceOf(c.core.address);
      assert.equal(coreWethBalanceAfterWithdrawal.toString(), "0", "expected to have withdrawn all ETH");
    });

    it("should not allow withdrawal of ETH from non WETH vault", async () => {
      const depositAmount = new BN("1000");
      const wbtc = await WBTC.new();
      await wbtc.mint(alice, depositAmount);
      await wbtc.approve(c.core.address, depositAmount, { from: alice });
      await setCollateralConfig(c.config, { collateralType: wbtc.address, borrowRate: constants.RATE_0BPS });

      await c.core.deposit(wbtc.address, depositAmount, { from: alice });

      // Make sure we have WETH in VaultsCore and ETH in WETH
      await c.core.depositETH({ from: alice, value: depositAmount });

      const vaultId = await c.vaultsData.vaultId(wbtc.address, alice);

      await expectRevert.unspecified(c.core.withdrawETH(vaultId, depositAmount, { from: alice }));
    });

    it("depositing WBTC while sending ETH should revert", async () => {
      const depositAmount = new BN("1000");
      const wbtc = await WBTC.new();
      await wbtc.mint(alice, depositAmount);
      await wbtc.approve(c.core.address, depositAmount, { from: alice });
      await setCollateralConfig(c.config, { collateralType: wbtc.address, borrowRate: constants.RATE_0BPS });

      await expectRevert.unspecified(c.core.deposit(wbtc.address, "1000", { from: alice, value: depositAmount }));

      // Doing a normal deposit to be sure that works
      await c.core.deposit(wbtc.address, depositAmount, { from: alice });
    });

    it("should be possible to deposit and borrow using ETH", async () => {
      const txReceipt = await c.core.depositETHAndBorrow(BORROW_AMOUNT, { from: alice, value: DEPOSIT_AMOUNT });
      const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);

      expectEvent(txReceipt, "Deposited", {
        amount: DEPOSIT_AMOUNT.toString(),
        sender: alice,
        vaultId,
      });

      expectEvent(txReceipt, "Borrowed", {
        amount: BORROW_AMOUNT.toString(),
        sender: alice,
        vaultId,
      });

      const outstandingVaultDebt = await c.vaultsData.vaultDebt(vaultId);
      assert.equal(outstandingVaultDebt.toString(), BORROW_AMOUNT.toString());
    });
  });

  it.skip("should properly account for over-repayment");
  it.skip("should not allow to open vault with not authorized collateral");

  // Enforce limits
  it.skip("Should not allow to borrow below the minimum to allow for efficient liquidiation (gas costs)");

  // Configuration
  it.skip("should throw proper error when accessing non-existant vault");
});
