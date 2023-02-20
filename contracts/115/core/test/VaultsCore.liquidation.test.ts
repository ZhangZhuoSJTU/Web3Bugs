import {
  VaultsCoreInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  USDXInstance,
  MockChainlinkAggregatorInstance,
  PriceFeedInstance,
  LiquidationManagerInstance,
  ConfigProviderInstance,
} from "../types/truffle-contracts";
import { expect } from "chai";

const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
import { depositAndBorrow, fullSetup, constants } from "./utils/helpers";

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("10")); // 10 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("220")); // 220 USDX
const WETH_PRICE = new BN("44067433087"); // Roughly 440 USDX

// tests for individual tests
contract("VaultsCore liquidation", (accounts) => {
  const [owner, alice, bob] = accounts;

  let c: {
    weth: MockWETHInstance;
    aggregator: MockChainlinkAggregatorInstance;
    config: ConfigProviderInstance;
    controller: AccessControllerInstance;
    feed: PriceFeedInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    vaultsData: VaultsDataProviderInstance;
    rates: RatesManagerInstance;
    liquidator: LiquidationManagerInstance;
  };

  beforeEach(async () => {
    c = await fullSetup({
      wethPrice: WETH_PRICE,
      payees: [],
      shares: [],
      insurance_shares: 1,
    });

    await c.weth.mint(owner, WETH_AMOUNT);
  });

  it("should not allow to liquidate when healthy", async () => {
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: owner,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: BORROW_AMOUNT,
    });
    await expectRevert.unspecified(c.core.liquidate(vaultId));
  });

  it("should allow liquidation when healthfactor below 1", async () => {
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: constants.AMOUNT_ACCURACY, // 1 ETH
      deposit: constants.AMOUNT_ACCURACY,
      borrow: BORROW_AMOUNT,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, BORROW_AMOUNT);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);

    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(300e8)); // $300

    const liquidationCall = await c.core.liquidate(vaultId, { from: alice });

    // $220 / $300 + 5% = 0.77 ETH
    const collateralToReceive = "770000000000000000";
    const collateralToRemain = "230000000000000000";

    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: BORROW_AMOUNT,
      sender: alice,
      owner: bob,
      collateralLiquidated: collateralToReceive,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), collateralToRemain.toString());

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    expect(vaultDebt.toString()).to.equal("0");

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(new BN(collateralToReceive));
    expect(expectedWethBalanceAfter.toString()).to.equal(wethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    const expectedUSDXBalanceAfter = new BN(usdxBalanceBefore).sub(BORROW_AMOUNT);
    expect(expectedUSDXBalanceAfter.toString()).to.equal(usdxBalanceAfter.toString());
  });

  it("Should NOT be able to liquidate vaults without debt", async () => {
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: owner,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: new BN(0),
    });
    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(325e8)); // $325

    await expectRevert.unspecified(c.core.liquidate(vaultId));
  });

  it("should allow liquidation with insurance fund", async () => {
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("200"));
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: constants.AMOUNT_ACCURACY, // 1 ETH
      deposit: constants.AMOUNT_ACCURACY,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, borrowAmount);
    // Give some USDX to insurance fund
    await c.stablex.mint(c.core.address, borrowAmount);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);

    const insuranceBalanceBefore = await c.stablex.balanceOf(c.core.address);
    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(105e8)); // $105

    const liquidationCall = await c.core.liquidate(vaultId, { from: alice });

    const collateralToReceive = constants.AMOUNT_ACCURACY; // 1 ETH

    const expectedInsuranceAmount = borrowAmount.div(new BN(2));
    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: borrowAmount.sub(expectedInsuranceAmount),
      sender: alice,
      owner: bob,
      collateralLiquidated: collateralToReceive,
      vaultId,
    });
    expectEvent(liquidationCall, "InsurancePaid", {
      insuranceAmount: expectedInsuranceAmount,
      sender: alice,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), "0");

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    expect(vaultDebt.toString()).to.equal("0");

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(new BN(collateralToReceive));
    assert.equal(wethBalanceAfter.toString(), expectedWethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    const expectedUSDXBalanceAfter = new BN(usdxBalanceBefore).sub(borrowAmount).add(expectedInsuranceAmount);
    assert.equal(usdxBalanceAfter.toString(), expectedUSDXBalanceAfter.toString());

    const insuranceBalanceAfter = await c.stablex.balanceOf(c.core.address);
    const expectedInsuranceBalanceAfter = insuranceBalanceBefore.sub(expectedInsuranceAmount);
    assert.equal(insuranceBalanceAfter.toString(), expectedInsuranceBalanceAfter.toString());
  });

  it("liquidation that requires insurance should fail if insurance fund is low/empty", async () => {
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("200"));
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: constants.AMOUNT_ACCURACY, // 1 ETH
      deposit: constants.AMOUNT_ACCURACY,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, borrowAmount);

    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(105e8)); // $105

    await expectRevert.unspecified(c.core.liquidate(vaultId));

    // Give some usdx to insurance fund
    await c.stablex.mint(alice, "1");
    await expectRevert.unspecified(c.core.liquidate(vaultId));
  });

  it("should allow a partial liquidate without using the insurance fund", async () => {
    const liquidate_amount = constants.AMOUNT_ACCURACY.mul(new BN("110"));
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: constants.AMOUNT_ACCURACY, // 1 ETH
      deposit: constants.AMOUNT_ACCURACY,
      borrow: BORROW_AMOUNT,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, BORROW_AMOUNT);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);

    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(300e8)); // $300

    const liquidationCall = await c.core.liquidatePartial(vaultId, liquidate_amount, { from: alice });

    // $110 / $300 + 5% = 0.385 ETH
    const collateralToReceive = new BN("385000000000000000");
    const collateralToRemain = constants.AMOUNT_ACCURACY.sub(collateralToReceive);

    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: liquidate_amount,
      sender: alice,
      owner: bob,
      collateralLiquidated: collateralToReceive,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), collateralToRemain.toString());

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    expect(vaultDebt.toString()).to.equal(BORROW_AMOUNT.sub(liquidate_amount).toString());

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(new BN(collateralToReceive));
    expect(expectedWethBalanceAfter.toString()).to.equal(wethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    const expectedUSDXBalanceAfter = new BN(usdxBalanceBefore).sub(liquidate_amount);
    expect(expectedUSDXBalanceAfter.toString()).to.equal(usdxBalanceAfter.toString());
  });

  it("should NOT allow a partial liquidate when healthy", async () => {
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: owner,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: BORROW_AMOUNT,
    });
    await expectRevert.unspecified(c.core.liquidatePartial(vaultId, "1"));
  });

  it("should NOT allow a partial liquidate when there is no debt", async () => {
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: owner,
      mint: DEPOSIT_AMOUNT,
      deposit: DEPOSIT_AMOUNT,
      borrow: new BN(0),
    });
    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(325e8)); // $325

    await expectRevert.unspecified(c.core.liquidatePartial(vaultId, "1"));
  });

  it("should allow a partial liquidate with using the insurance fund", async () => {
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("200"));
    const liquidate_amount = constants.AMOUNT_ACCURACY.mul(new BN("150"));

    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: constants.AMOUNT_ACCURACY, // 1 ETH
      deposit: constants.AMOUNT_ACCURACY,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, borrowAmount);
    // Give some USDX to insurance fund
    await c.stablex.mint(c.core.address, borrowAmount);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);

    const insuranceBalanceBefore = await c.stablex.balanceOf(c.core.address);
    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(105e8)); // $105

    const liquidationCall = await c.core.liquidatePartial(vaultId, liquidate_amount, { from: alice });

    const collateralToReceive = constants.AMOUNT_ACCURACY; // 1 ETH

    const expectedInsuranceAmount = borrowAmount.div(new BN(2));
    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: borrowAmount.sub(expectedInsuranceAmount),
      sender: alice,
      owner: bob,
      collateralLiquidated: collateralToReceive,
      vaultId,
    });
    expectEvent(liquidationCall, "InsurancePaid", {
      insuranceAmount: expectedInsuranceAmount,
      sender: alice,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), "0");

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    expect(vaultDebt.toString()).to.equal("0");

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(new BN(collateralToReceive));
    assert.equal(wethBalanceAfter.toString(), expectedWethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    const expectedUSDXBalanceAfter = new BN(usdxBalanceBefore).sub(borrowAmount).add(expectedInsuranceAmount);
    assert.equal(usdxBalanceAfter.toString(), expectedUSDXBalanceAfter.toString());

    const insuranceBalanceAfter = await c.stablex.balanceOf(c.core.address);
    const expectedInsuranceBalanceAfter = insuranceBalanceBefore.sub(expectedInsuranceAmount);
    assert.equal(insuranceBalanceAfter.toString(), expectedInsuranceBalanceAfter.toString());
  });

  it("should allow a partial liquidate that is below 100% collateral value without touching the insurance fund", async () => {
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("200"));
    const liquidate_amount = constants.AMOUNT_ACCURACY.mul(new BN("50"));

    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: constants.AMOUNT_ACCURACY, // 1 ETH
      deposit: constants.AMOUNT_ACCURACY,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, borrowAmount);
    // Give some USDX to insurance fund
    await c.stablex.mint(c.core.address, borrowAmount);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);

    const insuranceBalanceBefore = await c.stablex.balanceOf(c.core.address);
    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(105e8)); // $105

    const liquidationCall = await c.core.liquidatePartial(vaultId, liquidate_amount, { from: alice });

    const collateralToReceive = constants.AMOUNT_ACCURACY.div(new BN(2)); // 0.5 ETH

    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: liquidate_amount,
      sender: alice,
      owner: bob,
      collateralLiquidated: collateralToReceive,
      vaultId,
    });

    expectEvent.notEmitted(liquidationCall, "InsurancePaid");

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), collateralToReceive);

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    expect(vaultDebt.toString()).to.equal(borrowAmount.sub(liquidate_amount).toString());

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(new BN(collateralToReceive));
    assert.equal(wethBalanceAfter.toString(), expectedWethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    const expectedUSDXBalanceAfter = new BN(usdxBalanceBefore).sub(liquidate_amount);
    assert.equal(usdxBalanceAfter.toString(), expectedUSDXBalanceAfter.toString());

    const insuranceBalanceAfter = await c.stablex.balanceOf(c.core.address);
    assert.equal(insuranceBalanceAfter.toString(), insuranceBalanceBefore.toString());
  });

  it("liquidation should charge liquidationFee", async () => {
    await c.config.setCollateralLiquidationFee(c.weth.address, constants.RATE_2PCT);
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("196"));
    const debtWithLiquidationFee = borrowAmount
      .div(constants.AMOUNT_ACCURACY.sub(constants.RATE_2PCT))
      .mul(constants.AMOUNT_ACCURACY);
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: DEPOSIT_AMOUNT, // 1 ETH
      deposit: DEPOSIT_AMOUNT,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, debtWithLiquidationFee);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);
    console.log("usdxBalanceBefore:", usdxBalanceBefore.toString());

    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(250e8)); // $250

    const liquidationCall = await c.core.liquidate(vaultId, { from: alice });

    // ($196 / 0.98) / $250 * 1.05 = 0.7 ETH
    const collateralToReceive = "840000000000000000";
    const collateralToRemain = "160000000000000000";

    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: borrowAmount,
      sender: alice,
      owner: bob,
      collateralLiquidated: collateralToReceive,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), collateralToRemain.toString());

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(vaultDebt.toString(), "0");

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(new BN(collateralToReceive));
    assert.equal(expectedWethBalanceAfter.toString(), wethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    assert.equal(usdxBalanceAfter.toString(), "0");
  });

  it("should allow liquidate with less liquidationFee when collateralValueToReceive is equal to collateralValue ", async () => {
    await c.config.setCollateralLiquidationFee(c.weth.address, constants.RATE_2PCT);
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("99"));
    // $100 / 0.98
    const debtWithLiquidationFee = constants.AMOUNT_ACCURACY.mul(new BN("100"));
    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: DEPOSIT_AMOUNT, // 1 ETH
      deposit: DEPOSIT_AMOUNT,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, debtWithLiquidationFee);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);
    console.log("usdxBalanceBefore:", usdxBalanceBefore.toString());

    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(105e8)); // $108

    const liquidationCall = await c.core.liquidate(vaultId, { from: alice });

    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: borrowAmount,
      sender: alice,
      owner: bob,
      collateralLiquidated: DEPOSIT_AMOUNT,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), "0");

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(vaultDebt.toString(), "0");

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(DEPOSIT_AMOUNT);
    assert.equal(expectedWethBalanceAfter.toString(), wethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    assert.equal(usdxBalanceAfter.toString(), "0");
  });

  it("should allow a partial liquidate with liquidationFee using the insurance fund", async () => {
    const borrowAmount = constants.AMOUNT_ACCURACY.mul(new BN("200"));
    const liquidateAmount = constants.AMOUNT_ACCURACY.mul(new BN("150"));

    const { vaultId } = await depositAndBorrow(c, {
      vaultOwner: bob,
      mint: DEPOSIT_AMOUNT, // 1 ETH
      deposit: DEPOSIT_AMOUNT,
      borrow: borrowAmount,
    });
    // Give some usdx to alice
    await c.stablex.mint(alice, liquidateAmount);
    // Give some USDX to insurance fund
    await c.stablex.mint(c.core.address, borrowAmount);

    // Check my WETH balance before liquidation
    const wethBalanceBefore = await c.weth.balanceOf(alice);
    const usdxBalanceBefore = await c.stablex.balanceOf(alice);
    const insuranceBalanceBefore = await c.stablex.balanceOf(c.core.address);

    // @ts-ignore it's expecting the AggregatorV3Interface interface but we added this ourselves
    await c.aggregator.setLatestPrice(String(105e8)); // $105
    const liquidationCall = await c.core.liquidatePartial(vaultId, liquidateAmount, { from: alice });

    const expectedInsuranceAmount = borrowAmount.div(new BN(2));
    expectEvent(liquidationCall, "Liquidated", {
      debtRepaid: borrowAmount.sub(expectedInsuranceAmount),
      sender: alice,
      owner: bob,
      collateralLiquidated: DEPOSIT_AMOUNT,
      vaultId,
    });
    expectEvent(liquidationCall, "InsurancePaid", {
      insuranceAmount: expectedInsuranceAmount,
      sender: alice,
      vaultId,
    });

    const vault = await c.vaultsData.vaults(vaultId);
    assert.equal(vault.collateralBalance.toString(), "0");

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(vaultDebt.toString(), "0");

    // Check my balances after, I should've received collateral
    const wethBalanceAfter = await c.weth.balanceOf(alice);
    const expectedWethBalanceAfter = new BN(wethBalanceBefore).add(DEPOSIT_AMOUNT);
    assert.equal(wethBalanceAfter.toString(), expectedWethBalanceAfter.toString());

    const usdxBalanceAfter = await c.stablex.balanceOf(alice);
    const expectedUSDXBalanceAfter = new BN(usdxBalanceBefore).sub(borrowAmount).add(expectedInsuranceAmount);
    assert.equal(usdxBalanceAfter.toString(), expectedUSDXBalanceAfter.toString());

    const insuranceBalanceAfter = await c.stablex.balanceOf(c.core.address);
    const expectedInsuranceBalanceAfter = insuranceBalanceBefore.sub(expectedInsuranceAmount);
    assert.equal(insuranceBalanceAfter.toString(), expectedInsuranceBalanceAfter.toString());
  });

  it.skip("allow liquidation after setMinCollateralizationRatio has reduced the ratio");
});
