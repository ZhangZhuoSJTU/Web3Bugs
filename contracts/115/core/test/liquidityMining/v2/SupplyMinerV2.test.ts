import { deployments, ethers } from "hardhat";
import { BOOST_CONFIG } from "../../../config/deployment";
import {
  AccessController,
  AddressProvider,
  ConfigProvider,
  DebtNotifier,
  GovernanceAddressProvider,
  MockChainlinkAggregator,
  MockMIMO,
  MockWETH,
  PAR,
  RatesManager,
  SupplyMinerV2,
  VaultsCore,
  VaultsDataProvider,
} from "../../../typechain-types";

const { expectRevert } = require("@openzeppelin/test-helpers");
const { timeAndMine } = require("hardhat");

const DEPOSIT_AMOUNT = ethers.utils.parseEther("1"); // 1 ETH
const BORROW_AMOUNT = ethers.utils.parseEther("100"); // 100 PAR
const WETH_AMOUNT = ethers.utils.parseEther("100"); // 100 ETH
const AMOUNT_ACCURACY = ethers.utils.parseEther("1");
const RATE_ACCURACY = ethers.BigNumber.from("1000000000000000000000000000");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "SetGovernance", "GovernanceV2"]);
  const [manager, alice] = await ethers.getSigners();
  const a: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const debtNotifier: DebtNotifier = await ethers.getContract("DebtNotifier");
  const weth: MockWETH = await ethers.getContract("MockWETH");
  const addresses: AddressProvider = await ethers.getContract("AddressProvider");
  const controller: AccessController = await ethers.getContract("AccessController");
  const config: ConfigProvider = await ethers.getContract("ConfigProvider");
  const stablex: PAR = await ethers.getContract("PAR");
  const core: VaultsCore = await ethers.getContract("VaultsCore");
  const vaultsData: VaultsDataProvider = await ethers.getContract("VaultsDataProvider");
  const ratesManager: RatesManager = await ethers.getContract("RatesManager");
  const supplyMiner: SupplyMinerV2 = await ethers.getContract("WETHSupplyMinerV2");
  const wethUsdAggregator: MockChainlinkAggregator = await ethers.getContract("WETHUsdAggregator");

  const managerRole = await controller.MANAGER_ROLE();
  const minterRole = await controller.MINTER_ROLE();
  await controller.grantRole(managerRole, manager.address);
  await controller.grantRole(minterRole, manager.address);

  await config.setCollateralConfig(
    weth.address,
    ethers.utils.parseUnits("100000", 18),
    ethers.utils.parseUnits("1.3", 18),
    ethers.utils.parseUnits("1.5", 18),
    RATE_ACCURACY,
    ethers.BigNumber.from("0"),
    ethers.utils.parseUnits("5", 16),
    ethers.constants.Zero,
  );

  await debtNotifier.setCollateralSupplyMiner(weth.address, supplyMiner.address);

  await weth.mint(alice.address, WETH_AMOUNT); // Mint some test WETH
  await weth.connect(alice).approve(core.address, DEPOSIT_AMOUNT);
  await core.connect(alice).deposit(weth.address, DEPOSIT_AMOUNT);

  const latestBlock = await ethers.provider.getBlock("latest");
  const latestTimestamp = latestBlock.timestamp;
  await wethUsdAggregator.setUpdatedAt(latestTimestamp);

  return {
    manager,
    alice,
    a,
    mimo,
    supplyMiner,
    debtNotifier,
    weth,
    addresses,
    core,
    controller,
    config,
    stablex,
    vaultsData,
    ratesManager,
  };
});

const setup2 = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "SetGovernance", "SupplyMinersV2"]);
  const [manager, alice] = await ethers.getSigners();
  const a: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const weth: MockWETH = await ethers.getContract("MockWETH");
  const stablex: PAR = await ethers.getContract("PAR");
  const core: VaultsCore = await ethers.getContract("VaultsCore");
  const vaultsData: VaultsDataProvider = await ethers.getContract("VaultsDataProvider");
  const config: ConfigProvider = await ethers.getContract("ConfigProvider");
  const supplyMiner: SupplyMinerV2 = await ethers.getContract("WETHSupplyMinerV2");
  const wethUsdAggregator: MockChainlinkAggregator = await ethers.getContract("WETHUsdAggregator");

  await config.setCollateralConfig(
    weth.address,
    ethers.utils.parseUnits("100000", 18),
    ethers.utils.parseUnits("1.3", 18),
    ethers.utils.parseUnits("1.5", 18),
    RATE_ACCURACY,
    ethers.BigNumber.from("0"),
    ethers.utils.parseUnits("5", 16),
    ethers.constants.Zero,
  );

  await weth.mint(alice.address, WETH_AMOUNT); // Mint some test WETH
  await weth.connect(alice).approve(core.address, WETH_AMOUNT);
  await core.connect(alice).deposit(weth.address, WETH_AMOUNT);

  const latestBlock = await ethers.provider.getBlock("latest");
  const latestTimestamp = latestBlock.timestamp;
  await wethUsdAggregator.setUpdatedAt(latestTimestamp);

  return {
    manager,
    alice,
    a,
    weth,
    core,
    config,
    stablex,
    vaultsData,
    supplyMiner,
  };
});

describe("--- SupplyMinerV2 ---", () => {
  describe("Config", () => {
    it("initialized Supply Miner correctly", async () => {
      const { mimo, supplyMiner, debtNotifier, weth } = await setup();
      const balance = await mimo.balanceOf(supplyMiner.address);
      assert.equal(balance.toString(), "0");

      const totalStake = await supplyMiner.totalStake();
      assert.equal(totalStake.toString(), "0");

      const mappedAddress = await debtNotifier.collateralSupplyMinerMapping(weth.address);
      assert.equal(mappedAddress, supplyMiner.address);

      const collateral = await supplyMiner.collateral();
      assert.equal(collateral, weth.address);
    });
    it("should revert if trying to set collateral to address 0", async () => {
      const { a, manager } = await setup();
      const { deploy } = deployments;
      await expectRevert(
        deploy("SupplyMinerV2", {
          from: manager.address,
          args: [a.address, BOOST_CONFIG, ethers.constants.AddressZero],
        }),
        "LM000",
      );
    });
    it("should be able to syncStake correctly", async () => {
      const { supplyMiner, alice, core, vaultsData } = await setup2();
      await core.connect(alice).borrow(1, ethers.utils.parseEther("10000"));
      const aliceBaseDebt = await vaultsData.vaultBaseDebt(1);
      const stakeBeforeRefresh = await supplyMiner.stake(alice.address);
      await supplyMiner.syncStake(alice.address);
      const stakeAfterRefresh = await supplyMiner.stake(alice.address);
      assert.equal(stakeBeforeRefresh.toString(), "0");
      assert.equal(stakeAfterRefresh.toString(), aliceBaseDebt.toString());
    });
  });
  describe("Stake and rewards management", () => {
    it("should allow to borrow and receive stake for a user", async () => {
      const { vaultsData, core, weth, supplyMiner, alice, ratesManager } = await setup();
      const vaultId = await vaultsData.connect(alice).vaultId(weth.address, alice.address);
      await core.connect(alice).borrow(vaultId, BORROW_AMOUNT);
      const cumulativeRate = await core.cumulativeRates(weth.address);
      const _totalStake = await ratesManager.calculateBaseDebt(BORROW_AMOUNT, cumulativeRate);
      const totalStake = await supplyMiner.totalStake();
      assert.equal(totalStake.toString(), _totalStake.toString()); // BaseDebt = debt for 0%
      const aliceStake = await supplyMiner.stake(alice.address);
      assert.equal(aliceStake.toString(), _totalStake.toString()); // BaseDebt = debt for 0%
    });
    it("vaults core borrow should work even when debtnotifier is not configured", async () => {
      const { debtNotifier, weth, vaultsData, alice, core } = await setup();
      await debtNotifier.setCollateralSupplyMiner(weth.address, "0x0000000000000000000000000000000000000000");

      const mappedAddress = await debtNotifier.collateralSupplyMinerMapping(weth.address);
      assert.equal(mappedAddress, "0x0000000000000000000000000000000000000000");

      const vaultId = await vaultsData.vaultId(weth.address, alice.address);
      await core.connect(alice).borrow(vaultId, BORROW_AMOUNT);
      const debt = await vaultsData.vaultDebt(vaultId);

      assert.equal(debt.toString(), BORROW_AMOUNT.toString());
    });
    it("repaying should send correct amount of MIMO and PAR to user", async () => {
      const { vaultsData, weth, alice, core, mimo, supplyMiner, stablex } = await setup();
      const vaultId = await vaultsData.vaultId(weth.address, alice.address);
      await core.connect(alice).borrow(vaultId, BORROW_AMOUNT);
      await mimo.mint(supplyMiner.address, 100);
      await stablex.mint(supplyMiner.address, 100);
      await core.connect(alice).repay(vaultId, BORROW_AMOUNT);

      const aliceStake = await supplyMiner.stake(alice.address);
      assert.equal(aliceStake.toString(), "0");

      const aliceMimoBalance = await mimo.balanceOf(alice.address);
      assert.equal(aliceMimoBalance.toString(), "100");

      const aliceParBalance = await stablex.balanceOf(alice.address);
      assert.equal(aliceParBalance.toString(), "100");
    });
    it("liquidation should send correct amount of MIMO and PAR to user", async () => {
      const { vaultsData, core, weth, alice, manager, mimo, supplyMiner, config, ratesManager, stablex } =
        await setup();
      const vaultId = await vaultsData.vaultId(weth.address, alice.address);
      await core.connect(alice).borrow(vaultId, BORROW_AMOUNT);

      // Let someone else borrow so they can pay off debt
      await weth.mint(manager.address, WETH_AMOUNT);
      await weth.connect(manager).approve(core.address, DEPOSIT_AMOUNT);
      await core.connect(manager).deposit(weth.address, DEPOSIT_AMOUNT);
      const managerVaultId = await vaultsData.vaultId(weth.address, manager.address);
      await core.connect(manager).borrow(managerVaultId, BORROW_AMOUNT);
      const cumulativeRate = await core.cumulativeRates(weth.address);
      const managerBaseDebt = await ratesManager.calculateBaseDebt(BORROW_AMOUNT, cumulativeRate);
      const aliceBaseDebt = await ratesManager.calculateBaseDebt(BORROW_AMOUNT, cumulativeRate);

      await mimo.mint(supplyMiner.address, AMOUNT_ACCURACY);
      await stablex.mint(supplyMiner.address, AMOUNT_ACCURACY);

      await config.setCollateralMinCollateralRatio(
        weth.address,
        String(400e18), // 400% to make sure vault is under collaterized
      );

      await config.setCollateralLiquidationRatio(
        weth.address,
        String(400e18), // 400% to make sure vault is under collaterized
      );

      const aliceStakeBefore = await supplyMiner.stake(alice.address);
      assert.equal(aliceStakeBefore.toString(), aliceBaseDebt.toString());

      const managerStakeBefore = await supplyMiner.stake(manager.address);
      assert.equal(managerStakeBefore.toString(), managerBaseDebt.toString());

      const totalStake = await supplyMiner.totalStake();
      assert.equal(totalStake.toString(), aliceBaseDebt.add(managerBaseDebt).toString());

      await core.connect(manager).liquidate(vaultId);

      const aliceStake = await supplyMiner.stake(alice.address);
      assert.equal(aliceStake.toString(), "0");

      const managerStake = await supplyMiner.stake(manager.address);
      assert.equal(managerStake.toString(), managerBaseDebt.toString());

      const aliceMimoBalance = await mimo.balanceOf(alice.address);
      assert.equal(aliceMimoBalance.toString(), AMOUNT_ACCURACY.div(ethers.BigNumber.from(2)).toString());

      await stablex.burn(alice.address, BORROW_AMOUNT);
      const aliceParBalance = await stablex.balanceOf(alice.address);
      assert.equal(aliceParBalance.toString(), AMOUNT_ACCURACY.div(ethers.BigNumber.from(2)).toString());
    });
    it("debtnotifier should handle non-0 interest rates correctly", async () => {
      const { config, manager, weth, alice, core, vaultsData, mimo, supplyMiner, stablex, ratesManager } =
        await setup();
      await config
        .connect(manager)
        .setCollateralBorrowRate(weth.address, ethers.BigNumber.from("1000000000158153903837946258"));
      const vaultId = await vaultsData.vaultId(weth.address, alice.address);
      await core.connect(alice).borrow(vaultId, BORROW_AMOUNT);

      await timeAndMine.increaseTime("1 year");
      await timeAndMine.mine(1);

      await mimo.mint(supplyMiner.address, 100);
      await stablex.mint(supplyMiner.address, 100);
      await stablex.mint(alice.address, BORROW_AMOUNT); // Mint extra stablex to allow paying back the loan
      const aliceBaseDebt = await vaultsData.vaultBaseDebt(vaultId);
      await core.connect(alice).repayAll(vaultId);
      const cumulativeRate = await core.cumulativeRates(weth.address);
      const aliceDebt = await ratesManager.calculateDebt(aliceBaseDebt, cumulativeRate);

      const aliceStake = await supplyMiner.stake(alice.address);
      assert.equal(aliceStake.toString(), "0");

      const aliceMimoBalance = await mimo.balanceOf(alice.address);
      assert.equal(aliceMimoBalance.toString(), "100");

      const aliceParBalance = await stablex.balanceOf(alice.address);
      assert.equal(aliceParBalance.toString(), BORROW_AMOUNT.mul(2).sub(aliceDebt).add(100).toString());
    });
    it("should revert if trying to call basDebtChanged by other than DebtNotifier", async () => {
      const { supplyMiner, alice } = await setup();
      await expectRevert(supplyMiner.baseDebtChanged(alice.address, 0), "LM020");
    });
  });
});
