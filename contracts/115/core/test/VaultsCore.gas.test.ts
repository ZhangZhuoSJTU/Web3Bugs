import {
  VaultsCoreInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  USDXInstance,
  MockChainlinkAggregatorInstance,
  ConfigProviderInstance,
  VaultsCoreStateInstance,
  AddressProviderInstance,
  MockWBTCInstance,
} from "../types/truffle-contracts";

const { BN, time } = require("@openzeppelin/test-helpers");
import { basicSetup, constants, setCollateralConfig } from "./utils/helpers";

const VaultsCore = artifacts.require("VaultsCore");
const VaultsCoreState = artifacts.require("VaultsCoreState");
const WBTC = artifacts.require("MockWBTC");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 USDX
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH

// tests for individual tests
contract("VaultsCore GAS costs", (accounts) => {
  const [, alice] = accounts;

  let c: {
    addresses: AddressProviderInstance;
    weth: MockWETHInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    vaultsData: VaultsDataProviderInstance;
    aggregator: MockChainlinkAggregatorInstance;
    aggregatorEUR: MockChainlinkAggregatorInstance;
    config: ConfigProviderInstance;
  };

  beforeEach(async () => {
    c = await basicSetup({
      wethRate: constants.RATE_50BPS,
    });
    await c.weth.mint(alice, WETH_AMOUNT); // Mint some test WETH
    await c.stablex.mint(alice, BORROW_AMOUNT); // Mint some extra stablex to be able to pay interest fees
  });

  // Gas tests
  it("GAS for depositing collateral should not exceed 240k GAS", async () => {
    await time.increase(time.duration.years(1));

    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    const txReceipt = await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const balance = await c.vaultsData.vaultCollateralBalance(vaultId);
    assert.equal(balance.toString(), DEPOSIT_AMOUNT.toString());

    const { gasUsed } = txReceipt.receipt;
    console.log("gasUsed deposit: %s", gasUsed);
    assert.isTrue(gasUsed < 240000);
  });

  it("GAS for withdrawing collateral from no debt vault should not exceed 180k GAS", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await time.increase(time.duration.years(1));
    const txReceipt = await c.core.withdraw(vaultId, DEPOSIT_AMOUNT, { from: alice });
    const balance = await c.vaultsData.vaultCollateralBalance(vaultId);
    assert.equal(balance.toString(), "0");

    const { gasUsed } = txReceipt.receipt;
    console.log("gasUsed withdraw: %s", gasUsed);
    assert.isTrue(gasUsed < 180000);
  });

  it("GAS for withdrawing collateral from vault with debt should not exceed 280k GAS", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    await time.increase(time.duration.years(1));
    await c.aggregator.setUpdatedAt(await time.latest());
    await c.aggregatorEUR.setUpdatedAt(await time.latest());

    const txReceipt = await c.core.withdraw(vaultId, 1, { from: alice });
    const balance = await c.vaultsData.vaultCollateralBalance(vaultId);
    assert.equal(balance.toString(), DEPOSIT_AMOUNT.sub(new BN(1)));

    const { gasUsed } = txReceipt.receipt;
    console.log("gasUsed withdraw: %s", gasUsed);
    assert.isTrue(gasUsed < 280000);
  });

  it("GAS for borrowing should not exceed 380k GAS", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    await time.increase(time.duration.years(1));
    await c.aggregator.setUpdatedAt(await time.latest());
    await c.aggregatorEUR.setUpdatedAt(await time.latest());

    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    const txReceipt = await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(vaultDebt.toString(), BORROW_AMOUNT.toString());

    const { gasUsed } = txReceipt.receipt;
    console.log("gasUsed borrow %s", gasUsed);
    assert.isTrue(gasUsed < 380000);
  });

  it("GAS for repayment should not exceed 260k GAS", async () => {
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: alice });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: alice });
    const vaultId = await c.vaultsData.vaultId(c.weth.address, alice);
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    await time.increase(time.duration.years(1));
    const txReceipt = await c.core.repayAll(vaultId, { from: alice });

    const vaultDebt = await c.vaultsData.vaultDebt(vaultId);
    assert.equal(vaultDebt.toString(), "0");

    const { gasUsed } = txReceipt.receipt;
    console.log("gasUsed repay: %s", gasUsed);
    assert.isTrue(gasUsed < 260000);
  });

  describe("Upgrade gas cost", async () => {
    let c2: {
      addresses: AddressProviderInstance;
      weth: MockWETHInstance;
      stablex: USDXInstance;
      core: VaultsCoreInstance;
      coreState: VaultsCoreStateInstance;
      vaultsData: VaultsDataProviderInstance;
      aggregator: MockChainlinkAggregatorInstance;
      aggregatorEUR: MockChainlinkAggregatorInstance;
      config: ConfigProviderInstance;
    };
    let wbtc: MockWBTCInstance;

    const gasUsed1: Record<string, number> = {};
    const gasUsed2: Record<string, number> = {};

    function getCallGasUsed(tx: any) {
      return tx.receipt.gasUsed;
    }

    function calculateGasUsageStats(txName: string) {
      const diff = gasUsed2[txName] - gasUsed1[txName];
      console.log(`Each collateral cost extra ${diff} gas`);

      const maxCollateral = 12481555 / diff;
      console.log(`We can have max ${maxCollateral} collateral for ${txName}`);
    }

    beforeEach(async () => {
      c2 = { ...c };
      c2.coreState = await VaultsCoreState.new(c.addresses.address);
      c2.core = await VaultsCore.new(c.addresses.address, c.weth.address, c2.coreState.address);
      wbtc = await WBTC.new();
    });

    it("upgrade with 1 collateral", async () => {
      const upgradeReceipt = await c.core.upgrade(c2.core.address);
      gasUsed1.upgrade = getCallGasUsed(upgradeReceipt);

      const acceptUpgradeReceipt = await c2.core.acceptUpgrade(c.core.address);
      gasUsed1.acceptUpgrade = getCallGasUsed(acceptUpgradeReceipt);

      const syncStatereceipt = await c2.coreState.syncState(c.coreState.address);
      gasUsed1.syncState = getCallGasUsed(syncStatereceipt);
    });

    it("upgrade with 2 collaterals", async () => {
      await setCollateralConfig(c2.config, { collateralType: wbtc.address });

      const upgradeReceipt = await c.core.upgrade(c2.core.address);
      gasUsed2.upgrade = getCallGasUsed(upgradeReceipt);

      const acceptUpgradeReceipt = await c2.core.acceptUpgrade(c.core.address);
      gasUsed2.acceptUpgrade = getCallGasUsed(acceptUpgradeReceipt);

      const syncStatereceipt = await c2.coreState.syncState(c.coreState.address);
      gasUsed2.syncState = getCallGasUsed(syncStatereceipt);

      calculateGasUsageStats("upgrade");
      calculateGasUsageStats("acceptUpgrade");
      calculateGasUsageStats("syncState");
    });
  });
});
