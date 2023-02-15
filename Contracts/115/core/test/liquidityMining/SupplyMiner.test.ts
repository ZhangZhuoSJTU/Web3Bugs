import {
  SupplyMinerInstance,
  VaultsCoreInstance,
  DebtNotifierInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  AccessControllerInstance,
  USDXInstance,
  AddressProviderInstance,
  MIMOInstance,
  GovernanceAddressProviderInstance,
  ConfigProviderInstance,
} from "../../types/truffle-contracts";

import { basicSetup, constants, setupMIMO } from "../utils/helpers";
const { BN, time } = require("@openzeppelin/test-helpers");

const SupplyMiner = artifacts.require("SupplyMiner");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 PAR
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH

contract("Supply Miner", (accounts) => {
  const [manager, alice] = accounts;

  let a: GovernanceAddressProviderInstance;
  let mimo: MIMOInstance;
  let supplyMiner: SupplyMinerInstance;
  let debtNotifier: DebtNotifierInstance;

  let parallel: {
    weth: MockWETHInstance;
    addresses: AddressProviderInstance;
    controller: AccessControllerInstance;
    config: ConfigProviderInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    vaultsData: VaultsDataProviderInstance;
    debtNotifier: DebtNotifierInstance;
    lmAddresses: GovernanceAddressProviderInstance;
  };

  beforeEach(async () => {
    // Setup parallel protocol
    parallel = await basicSetup();
    await parallel.weth.mint(alice, WETH_AMOUNT); // Mint some test WETH
    await parallel.weth.approve(parallel.core.address, DEPOSIT_AMOUNT, { from: alice });
    await parallel.core.deposit(parallel.weth.address, DEPOSIT_AMOUNT, { from: alice });

    // Setup liquidity mining for borrowing
    a = parallel.lmAddresses;
    debtNotifier = parallel.debtNotifier;
    mimo = await setupMIMO(a.address, parallel.controller, manager);
    await a.setMIMO(mimo.address);

    supplyMiner = await SupplyMiner.new(a.address);

    await debtNotifier.setCollateralSupplyMiner(parallel.weth.address, supplyMiner.address);
  });

  it("initialized Supply Miner correctly", async () => {
    const balance = await mimo.balanceOf(supplyMiner.address);
    assert.equal(balance.toString(), "0");

    const totalStake = await supplyMiner.totalStake();
    assert.equal(totalStake.toString(), "0");

    const mappedAddress = await debtNotifier.collateralSupplyMinerMapping(parallel.weth.address);
    assert.equal(mappedAddress, supplyMiner.address);
  });

  it("should allow to borrow and receive stake for a user", async () => {
    const vaultId = await parallel.vaultsData.vaultId(parallel.weth.address, alice);
    await parallel.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    const totalStake = await supplyMiner.totalStake();
    assert.equal(totalStake.toString(), BORROW_AMOUNT.toString()); // BaseDebt = debt for 0%

    const aliceStake = await supplyMiner.stake(alice);
    assert.equal(aliceStake.toString(), BORROW_AMOUNT.toString()); // BaseDebt = debt for 0%
  });

  it("vaults core borrow should work even when debtnotifier is not configured", async () => {
    await debtNotifier.setCollateralSupplyMiner(parallel.weth.address, "0x0000000000000000000000000000000000000000");

    const mappedAddress = await debtNotifier.collateralSupplyMinerMapping(parallel.weth.address);
    assert.equal(mappedAddress, "0x0000000000000000000000000000000000000000");

    const vaultId = await parallel.vaultsData.vaultId(parallel.weth.address, alice);
    await parallel.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    const debt = await parallel.vaultsData.vaultDebt(vaultId);

    assert.equal(debt.toString(), BORROW_AMOUNT.toString());
  });

  it("repaying should send correct amount of MIMO to user", async () => {
    const vaultId = await parallel.vaultsData.vaultId(parallel.weth.address, alice);
    await parallel.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });
    await mimo.mint(supplyMiner.address, 100);
    await parallel.core.repay(vaultId, BORROW_AMOUNT, { from: alice });

    const aliceStake = await supplyMiner.stake(alice);
    assert.equal(aliceStake.toString(), "0");

    const aliceMimoBalance = await mimo.balanceOf(alice);
    assert.equal(aliceMimoBalance.toString(), "100");
  });

  it("liquidation should send correct amount of MIMO to user", async () => {
    const vaultId = await parallel.vaultsData.vaultId(parallel.weth.address, alice);
    await parallel.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });

    // Let someone else borrow so they can pay off debt
    await parallel.weth.mint(manager, WETH_AMOUNT);
    await parallel.weth.approve(parallel.core.address, DEPOSIT_AMOUNT, { from: manager });
    await parallel.core.deposit(parallel.weth.address, DEPOSIT_AMOUNT, { from: manager });
    const managerVaultId = await parallel.vaultsData.vaultId(parallel.weth.address, manager);
    await parallel.core.borrow(managerVaultId, BORROW_AMOUNT, { from: manager });

    await mimo.mint(supplyMiner.address, constants.AMOUNT_ACCURACY);

    await parallel.config.setCollateralMinCollateralRatio(
      parallel.weth.address,
      String(400e18), // 400% to make sure vault is under collaterized
    );

    await parallel.config.setCollateralLiquidationRatio(
      parallel.weth.address,
      String(400e18), // 400% to make sure vault is under collaterized
    );

    const aliceStakeBefore = await supplyMiner.stake(alice);
    assert.equal(aliceStakeBefore.toString(), BORROW_AMOUNT.toString());

    const managerStakeBefore = await supplyMiner.stake(manager);
    assert.equal(managerStakeBefore.toString(), BORROW_AMOUNT.toString());

    const totalStake = await supplyMiner.totalStake();
    assert.equal(totalStake.toString(), BORROW_AMOUNT.add(BORROW_AMOUNT));

    await parallel.core.liquidate(vaultId, { from: manager });

    const aliceStake = await supplyMiner.stake(alice);
    assert.equal(aliceStake.toString(), "0");

    const managerStake = await supplyMiner.stake(manager);
    assert.equal(managerStake.toString(), BORROW_AMOUNT.toString());

    const aliceMimoBalance = await mimo.balanceOf(alice);
    assert.equal(aliceMimoBalance.toString(), constants.AMOUNT_ACCURACY.div(new BN(2)));
  });

  it("debtnotifier should handle non-0 interest rates correctly", async () => {
    await parallel.config.setCollateralBorrowRate(parallel.weth.address, constants.RATE_50BPS, { from: manager });
    const vaultId = await parallel.vaultsData.vaultId(parallel.weth.address, alice);
    await parallel.core.borrow(vaultId, BORROW_AMOUNT, { from: alice });

    const now = await time.latest();
    const oneYearLater = time.duration.years(1).add(now);
    await time.increaseTo(oneYearLater);

    await mimo.mint(supplyMiner.address, 100);
    await parallel.stablex.mint(alice, BORROW_AMOUNT, { from: manager }); // Mint extra stablex to allow paying back the loan
    await parallel.core.repayAll(vaultId, { from: alice });

    const aliceStake = await supplyMiner.stake(alice);
    assert.equal(aliceStake.toString(), "0");

    const aliceMimoBalance = await mimo.balanceOf(alice);
    assert.equal(aliceMimoBalance.toString(), "100");
  });
});
