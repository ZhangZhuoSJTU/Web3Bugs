import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { CollateralConfig, INCEPTION_VAULT_CONFIG } from "../../config/deployment";
import {
  AccessController,
  AddressProvider,
  AdminInceptionVault,
  ChainlinkInceptionPriceFeed,
  InceptionVaultFactory,
  InceptionVaultsCore,
  InceptionVaultsDataProvider,
  MockChainlinkAggregator,
  MockChainlinkFeed,
  MockERC20,
  PAR,
  RatesManager,
} from "../../typechain-types";
import { VaultConfigStruct } from "../../typechain-types/InceptionVaultFactory";

const { expectRevert } = require("@openzeppelin/test-helpers");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["Inception", "SetCore", "SetGovernance"]);
  const chainlinkInceptionPriceFeed: ChainlinkInceptionPriceFeed = await ethers.getContract(
    "ChainlinkInceptionPriceFeed",
  );
  const inceptionVaultFactory: InceptionVaultFactory = await ethers.getContract("InceptionVaultFactory");
  const stableX: PAR = await ethers.getContract("PAR");
  const addressProvider: AddressProvider = await ethers.getContract("AddressProvider");
  const accessController: AccessController = await ethers.getContract("AccessController");
  const ratesManager: RatesManager = await ethers.getContract("RatesManager");
  const [nolan, leo] = await ethers.getSigners();

  const vaultConfig: VaultConfigStruct = {
    liquidationRatio: INCEPTION_VAULT_CONFIG.liquidationRatio,
    minCollateralRatio: INCEPTION_VAULT_CONFIG.minCollateralRatio,
    borrowRate: INCEPTION_VAULT_CONFIG.borrowRate,
    originationFee: INCEPTION_VAULT_CONFIG.originationFee,
    liquidationBonus: INCEPTION_VAULT_CONFIG.liquidationBonus,
    liquidationFee: INCEPTION_VAULT_CONFIG.liquidationFee,
  };

  const inceptionCollateral: MockERC20 = await ethers.getContract("MockAAVE");
  const assetOracle: MockChainlinkAggregator = await ethers.getContract("AaveUsdAggregator");
  const eurUsdAggregator: MockChainlinkFeed = await ethers.getContract("EurUsdAggregator");

  await inceptionVaultFactory.cloneInceptionVault(
    vaultConfig,
    inceptionCollateral.address,
    chainlinkInceptionPriceFeed.address,
    assetOracle.address,
  );

  const newInceptionVault = await inceptionVaultFactory.inceptionVaults(1);
  const adminInceptionVault: AdminInceptionVault = await ethers.getContractAt(
    "AdminInceptionVault",
    newInceptionVault.adminInceptionVault,
  );
  const inceptionVaultsCore: InceptionVaultsCore = await ethers.getContractAt(
    "InceptionVaultsCore",
    newInceptionVault.inceptionVaultsCore,
  );
  const inceptionVaultsDataProvider: InceptionVaultsDataProvider = await ethers.getContractAt(
    "InceptionVaultsDataProvider",
    newInceptionVault.inceptionVaultsDataProvider,
  );
  const priceFeed: ChainlinkInceptionPriceFeed = await ethers.getContractAt(
    "ChainlinkInceptionPriceFeed",
    newInceptionVault.inceptionVaultPriceFeed,
  );

  await adminInceptionVault.depositETHAndBorrow(ethers.utils.parseEther("10000"), {
    value: ethers.utils.parseEther("10"),
  });

  await inceptionCollateral.mint(nolan.address, ethers.utils.parseEther("1000"));

  const minterRole = await accessController.MINTER_ROLE();
  await accessController.grantRole(minterRole, nolan.address);

  assetOracle.setLatestPrice(ethers.utils.parseUnits("250", 8));

  return {
    adminInceptionVault,
    inceptionVaultsCore,
    inceptionVaultsDataProvider,
    inceptionCollateral,
    addressProvider,
    nolan,
    stableX,
    priceFeed,
    assetOracle,
    accessController,
    leo,
    ratesManager,
    eurUsdAggregator,
    vaultConfig,
  };
});

// Second setup is required to deploy inception vault with origination = 0 and liquidation fee > 0
const setup_newConfig = deployments.createFixture(async () => {
  await deployments.fixture(["Inception", "SetCore", "SetGovernance"]);
  const [nolan, leo] = await ethers.getSigners();
  const inceptionVaultFactory: InceptionVaultFactory = await ethers.getContract("InceptionVaultFactory");
  const inceptionCollateral: MockERC20 = await ethers.getContract("MockAAVE");
  const stableX: PAR = await ethers.getContract("PAR");
  const assetOracle: MockChainlinkAggregator = await ethers.getContract("AaveUsdAggregator");
  const eurUsdAggregator: MockChainlinkFeed = await ethers.getContract("EurUsdAggregator");
  const chainlinkInceptionPriceFeed: ChainlinkInceptionPriceFeed = await ethers.getContract(
    "ChainlinkInceptionPriceFeed",
  );
  const accessController: AccessController = await ethers.getContract("AccessController");

  const newInceptionVaultConfig: CollateralConfig = {
    parDebtLimit: ethers.utils.parseUnits("3000000", 18), // 3,000,000 PAR
    liquidationRatio: ethers.utils.parseUnits("1.3", 18), // 130%
    minCollateralRatio: ethers.utils.parseUnits("1.5", 18), // 150%
    borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
    originationFee: ethers.constants.Zero, // 0%
    liquidationBonus: ethers.utils.parseUnits("5", 16), // 5%
    liquidationFee: ethers.utils.parseUnits("3", 16), // 3%
  };

  await inceptionVaultFactory.cloneInceptionVault(
    newInceptionVaultConfig,
    inceptionCollateral.address,
    chainlinkInceptionPriceFeed.address,
    assetOracle.address,
  );

  const newInceptionVault = await inceptionVaultFactory.inceptionVaults(1);
  const adminInceptionVault: AdminInceptionVault = await ethers.getContractAt(
    "AdminInceptionVault",
    newInceptionVault.adminInceptionVault,
  );
  const inceptionVaultsCore: InceptionVaultsCore = await ethers.getContractAt(
    "InceptionVaultsCore",
    newInceptionVault.inceptionVaultsCore,
  );
  const inceptionVaultsDataProvider: InceptionVaultsDataProvider = await ethers.getContractAt(
    "InceptionVaultsDataProvider",
    newInceptionVault.inceptionVaultsDataProvider,
  );
  const priceFeed: ChainlinkInceptionPriceFeed = await ethers.getContractAt(
    "ChainlinkInceptionPriceFeed",
    newInceptionVault.inceptionVaultPriceFeed,
  );

  await adminInceptionVault.depositETHAndBorrow(ethers.utils.parseEther("10000"), {
    value: ethers.utils.parseEther("10"),
  });

  const minterRole = await accessController.MINTER_ROLE();
  await accessController.grantRole(minterRole, nolan.address);
  await inceptionCollateral.mint(nolan.address, ethers.utils.parseEther("1000"));

  assetOracle.setLatestPrice(ethers.utils.parseUnits("250", 8));

  return {
    inceptionVaultsCore,
    adminInceptionVault,
    inceptionVaultsDataProvider,
    inceptionCollateral,
    stableX,
    nolan,
    assetOracle,
    leo,
    eurUsdAggregator,
    priceFeed,
  };
});

before(async () => {
  await setup();
});

describe("--- InceptionVaultsCore ---", async () => {
  describe("Deposit", async () => {
    it("should revert if deposit amount is 0", async () => {
      const { inceptionVaultsCore } = await setup();
      await expectRevert(inceptionVaultsCore.deposit(0), "IV100");
    });
    it("should be able to create vault", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      const tx = await inceptionVaultsCore.deposit(ethers.utils.parseEther("1000"));
      const receipt = await tx.wait(1);
      const { blockHash } = receipt;
      const block = await ethers.provider.getBlock(blockHash);
      const timeStamp = block.timestamp;
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const inceptionVaultCount = await inceptionVaultsDataProvider.inceptionVaultCount();
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      const nolanVault = await inceptionVaultsDataProvider.vaults(nolanVaultId);
      expect(nolanAaveBalance.toNumber()).to.be.equal(0);
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
      expect(inceptionVaultCount.toNumber()).to.be.equal(1);
      expect(nolanVaultId.toNumber()).to.be.equal(1);
      expect(nolanVault.owner).to.be.equal(nolan.address);
      expect(nolanVault.collateralBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
      expect(nolanVault.baseDebt.toNumber()).to.be.equal(0);
      expect(nolanVault.createdAt.toNumber()).to.be.equal(timeStamp);
    });
    it("should be able to deposit in existing vault", async () => {
      const { inceptionVaultsCore, inceptionCollateral, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("500"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("500"));
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      expect(nolanAaveBalance.toNumber()).to.be.equal(0);
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
    });
    it("should be able to desposit by vault id", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("500"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await expect(inceptionVaultsCore.depositByVaultId(nolanVaultId, ethers.utils.parseEther("500")))
        .to.emit(inceptionVaultsCore, "Deposited")
        .withArgs(1, ethers.utils.parseEther("500"), nolan.address);
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const nolanVault = await inceptionVaultsDataProvider.vaults(nolanVaultId);
      expect(nolanAaveBalance.toNumber()).to.be.equal(0);
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
      expect(nolanVault.collateralBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
    });
    it("should be able to deposit and borrow", async () => {
      const { inceptionVaultsCore, adminInceptionVault, inceptionCollateral, nolan, stableX } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await expect(
        inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("1000"), ethers.utils.parseEther("10000")),
      )
        .to.emit(inceptionVaultsCore, "Borrowed")
        .withArgs(1, ethers.utils.parseEther("10000"), nolan.address);
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const nolanParBalance = await stableX.balanceOf(nolan.address);
      const adminInceptionVaultParBalance = await stableX.balanceOf(adminInceptionVault.address);
      expect(nolanAaveBalance.toNumber()).to.be.equal(0);
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
      expect(nolanParBalance.toString()).to.be.equal(ethers.utils.parseEther("10000").toString());
      expect(adminInceptionVaultParBalance.toNumber()).to.be.equal(0);
    });
    it("should revert if create vault called by other than InceptionVaultsCore", async () => {
      const { inceptionVaultsDataProvider, nolan } = await setup();
      await expectRevert(inceptionVaultsDataProvider.createVault(nolan.address), "IV011");
    });
    it("should revert if trying to deposit of an unexisting vault", async () => {
      const { inceptionVaultsCore, inceptionCollateral } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await expectRevert(inceptionVaultsCore.depositByVaultId(1, ethers.utils.parseEther("100")), "IV105");
    });
  });
  describe("Borrow", () => {
    it("should be able to borrow if origination fees is 0", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        adminInceptionVault,
        stableX,
        nolan,
        inceptionVaultsDataProvider,
      } = await setup_newConfig();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("1000"), ethers.utils.parseEther("10000"));
      const vaultDebt = await inceptionVaultsDataProvider.vaultDebt(1);
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const nolanParBalance = await stableX.balanceOf(nolan.address);
      const adminInceptionVaultParBalance = await stableX.balanceOf(adminInceptionVault.address);
      expect(vaultDebt.toString()).to.be.equal(ethers.utils.parseEther("10000").toString());
      expect(nolanAaveBalance.toNumber()).to.be.equal(0);
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("1000").toString());
      expect(nolanParBalance.toString()).to.be.equal(ethers.utils.parseEther("10000").toString());
      expect(adminInceptionVaultParBalance.toNumber()).to.be.equal(0);
    });
    it("should not be able to borrow if not vault owner", async () => {
      const { inceptionVaultsCore, leo, inceptionCollateral } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, 100);
      await inceptionVaultsCore.deposit(100);
      await expectRevert(inceptionVaultsCore.connect(leo).borrow(1, 10), "IV010");
    });
    it("should revert if borrow amount > available PAR", async () => {
      const { inceptionVaultsCore, inceptionCollateral, nolan, leo } = await setup();
      await inceptionCollateral.mint(nolan.address, ethers.utils.parseEther("100"));
      await inceptionCollateral.mint(leo.address, ethers.utils.parseEther("100"));
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionCollateral.connect(leo).approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("100"), ethers.utils.parseEther("10000"));
      await expectRevert(
        inceptionVaultsCore
          .connect(leo)
          .depositAndBorrow(ethers.utils.parseEther("100"), ethers.utils.parseEther("10000")),
        "IV104",
      );
    });
    it("should revert borrow if vault health factor < 1", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        adminInceptionVault,
        stableX,
        inceptionVaultsDataProvider,
        nolan,
      } = await setup();
      await stableX.mint(adminInceptionVault.address, ethers.utils.parseEther("50000"));
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("100"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await expectRevert(inceptionVaultsCore.borrow(nolanVaultId, ethers.utils.parseEther("25000")), "IV102");
    });
  });
  describe("Withdraw", () => {
    it("should be able to withdraw if vaultDebt is 0", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("1000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await expect(inceptionVaultsCore.withdraw(nolanVaultId, ethers.utils.parseEther("500")))
        .to.emit(inceptionVaultsCore, "Withdrawn")
        .withArgs(1, ethers.utils.parseEther("500"), nolan.address);
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const nolanVaultBalance = await inceptionVaultsDataProvider.vaultCollateralBalance(nolanVaultId);
      expect(nolanAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("500").toString());
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("500").toString());
      expect(nolanVaultBalance.toString()).to.be.equal(ethers.utils.parseEther("500").toString());
    });
    it("should be able ablt to withdraw if vaultDebt > 0 and health factor > 1", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("1000"), ethers.utils.parseEther("10000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await inceptionVaultsCore.withdraw(nolanVaultId, ethers.utils.parseEther("100"));
      const nolanAaveBalance = await inceptionCollateral.balanceOf(nolan.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const nolanVaultBalance = await inceptionVaultsDataProvider.vaultCollateralBalance(nolanVaultId);
      expect(nolanAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("100").toString());
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("900").toString());
      expect(nolanVaultBalance.toString()).to.be.equal(ethers.utils.parseEther("900").toString());
    });
    it("should revert if withdraw amount greater than collateralBalance", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("1000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await inceptionVaultsCore.withdraw(nolanVaultId, ethers.utils.parseEther("500"));
      await expectRevert(inceptionVaultsCore.withdraw(nolanVaultId, ethers.utils.parseEther("2000")), "IV101");
    });
    it("should revert withdraw if vault is health factor < 1", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("100"), ethers.utils.parseEther("10000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await expectRevert(inceptionVaultsCore.withdraw(nolanVaultId, ethers.utils.parseEther("90")), "IV102");
    });
    it("should revert withdraw if not called by vault owner", async () => {
      const { inceptionVaultsCore, inceptionCollateral, nolan, leo, inceptionVaultsDataProvider } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionVaultsCore.deposit(ethers.utils.parseEther("100"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await expectRevert(
        inceptionVaultsCore.connect(leo).withdraw(nolanVaultId, ethers.utils.parseEther("100")),
        "IV010",
      );
    });
  });
  describe("Repay", () => {
    it("should be able to repay", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        inceptionVaultsDataProvider,
        nolan,
        stableX,
        adminInceptionVault,
      } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("1000"), ethers.utils.parseEther("10000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await stableX.approve(inceptionVaultsCore.address, ethers.utils.parseEther("5000"));
      await expect(inceptionVaultsCore.repay(nolanVaultId, ethers.utils.parseEther("5000")))
        .to.emit(inceptionVaultsCore, "Repaid")
        .withArgs(1, ethers.utils.parseEther("5000"), nolan.address);
      const nolanParBalance = await stableX.balanceOf(nolan.address);
      const adminInceptionVaultParBalance = await stableX.balanceOf(adminInceptionVault.address);
      expect(nolanParBalance.toString()).to.be.equal(ethers.utils.parseEther("5000").toString());
      expect(adminInceptionVaultParBalance.toString()).to.be.equal(ethers.utils.parseEther("5000").toString());
    });
    it("should be able to repay all", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan, stableX } = await setup();
      await stableX.mint(nolan.address, ethers.utils.parseEther("1000"));
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("1000"), ethers.utils.parseEther("10000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      const nolanParBalance = await stableX.balanceOf(nolan.address);
      await stableX.approve(inceptionVaultsCore.address, nolanParBalance);
      await inceptionVaultsCore.repayAll(nolanVaultId);
      const nolanVaultDebt = await inceptionVaultsDataProvider.vaultBaseDebt(nolanVaultId);
      expect(nolanVaultDebt.toNumber()).to.be.equal(0);
    });
  });
  describe("Liquidation", () => {
    it("should revert if health factor is above 1", async () => {
      const { inceptionVaultsCore, inceptionCollateral, inceptionVaultsDataProvider, nolan } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("1000"), ethers.utils.parseEther("10000"));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await expectRevert(inceptionVaultsCore.liquidate(nolanVaultId), "IV103");
    });
    it("should allow liquidation when healthfactor below 1", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        assetOracle,
        nolan,
        leo,
        inceptionVaultsDataProvider,
        stableX,
        adminInceptionVault,
        priceFeed,
      } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("100"), ethers.utils.parseEther("8000"));
      await assetOracle.setLatestPrice(ethers.utils.parseUnits("90", 8));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await stableX.mint(leo.address, ethers.utils.parseEther("3000"));
      const liquidationAmount = ethers.utils.parseEther("3000");
      await stableX.connect(leo).approve(inceptionVaultsCore.address, liquidationAmount);
      const repayAmout = await priceFeed.convertTo(ethers.utils.parseEther("3150"));
      await expect(inceptionVaultsCore.connect(leo).liquidatePartial(nolanVaultId, liquidationAmount))
        .to.emit(inceptionVaultsCore, "Liquidated")
        .withArgs(1, liquidationAmount, repayAmout, nolan.address, leo.address);
      const collateralValueToReceive = ethers.utils.parseEther((3000 * 1.05).toString());
      const collateralToReceive = await priceFeed.convertTo(collateralValueToReceive);
      const leoParBalance = await stableX.balanceOf(leo.address);
      const adminInceptionVaultParBalance = await stableX.balanceOf(adminInceptionVault.address);
      const leoAaveBalance = await inceptionCollateral.balanceOf(leo.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      expect(leoAaveBalance.toString()).to.be.equal(collateralToReceive.toString());
      expect(inceptionVaultsCoreAaveBalance.toString()).to.be.equal(
        ethers.utils.parseEther("100").sub(collateralToReceive).toString(),
      );
      expect(leoParBalance.toNumber()).to.be.equal(0);
      expect(adminInceptionVaultParBalance.toString()).to.be.equal(
        ethers.utils.parseEther("2000").add(liquidationAmount).toString(),
      );
    });
    it("should allow liquidation with insurance fund", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        assetOracle,
        nolan,
        leo,
        inceptionVaultsDataProvider,
        stableX,
        adminInceptionVault,
        priceFeed,
        eurUsdAggregator,
      } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("100"), ethers.utils.parseEther("10000"));
      const eurUsdLatestRound = await eurUsdAggregator.latestRoundData();
      const eurUsdRate = eurUsdLatestRound.answer;
      const newInceptionCollateralPrice = (102 * eurUsdRate.toNumber()) / 1e8;
      assetOracle.setLatestPrice(ethers.utils.parseUnits(newInceptionCollateralPrice.toString(), 8));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await stableX.mint(leo.address, ethers.utils.parseEther("15000"));
      await stableX.connect(leo).approve(inceptionVaultsCore.address, ethers.utils.parseEther("11000"));
      await stableX.mint(adminInceptionVault.address, ethers.utils.parseEther("1000"));
      await inceptionVaultsCore.connect(leo).liquidate(nolanVaultId);
      const collateralValue = await priceFeed.convertFrom(ethers.utils.parseEther("100"));

      // BigNumbers only handle int, need to use FixedNumbers for float
      const fixedCollateralValue = ethers.FixedNumber.from(collateralValue, "fixed256x18");
      const fixedLiquidationBonus = ethers.FixedNumber.from(ethers.utils.parseEther("1.05"), "fixed256x18");
      const fixedDiscountedCollateralValue = fixedCollateralValue.divUnsafe(fixedLiquidationBonus);
      const discountedCollateralValue = ethers.utils.parseEther(fixedDiscountedCollateralValue.toString());

      const leoParBalance = await stableX.balanceOf(leo.address);
      const adminInceptionVaultParBalance = await stableX.balanceOf(adminInceptionVault.address);
      const leoAaveBalance = await inceptionCollateral.balanceOf(leo.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const vaultBalance = await inceptionVaultsDataProvider.vaultCollateralBalance(nolanVaultId);
      const vaultDebt = await inceptionVaultsDataProvider.vaultDebt(nolanVaultId);

      expect(vaultBalance.toNumber()).to.be.equal(0);
      expect(vaultDebt.toNumber()).to.be.equal(0);
      expect(leoAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("100").toString());
      expect(inceptionVaultsCoreAaveBalance.toNumber()).to.be.equal(0);
      expect(leoParBalance.toString()).to.be.equal(
        ethers.utils.parseEther("15000").sub(discountedCollateralValue).toString(),
      );
      expect(adminInceptionVaultParBalance.toString()).to.be.equal(
        ethers.utils.parseEther("1000").add(discountedCollateralValue).toString(),
      );
    });
    it("should revert if adminInceptionVault cannot cover insuranceAmount", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        assetOracle,
        nolan,
        leo,
        inceptionVaultsDataProvider,
        stableX,
      } = await setup();
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      const liquidationAmount = ethers.utils.parseEther("10000");
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("100"), liquidationAmount);
      await assetOracle.setLatestPrice(ethers.utils.parseUnits("84", 8));
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      await stableX.mint(leo.address, liquidationAmount);
      await stableX.connect(leo).approve(inceptionVaultsCore.address, liquidationAmount);
      await expectRevert(inceptionVaultsCore.connect(leo).liquidate(nolanVaultId), "IV104");
    });
    it("should allow liquidation when collateralValueToReceive >= collateralValue and currentVaultDebt <= discountedCollateralValue", async () => {
      const {
        inceptionVaultsCore,
        inceptionCollateral,
        adminInceptionVault,
        assetOracle,
        nolan,
        leo,
        inceptionVaultsDataProvider,
        eurUsdAggregator,
        stableX,
        priceFeed,
      } = await setup_newConfig();
      await stableX.mint(leo.address, ethers.utils.parseEther("15000"));
      inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      const borrowAmount = ethers.utils.parseEther("10000");
      await inceptionCollateral.approve(inceptionVaultsCore.address, ethers.utils.parseEther("100"));
      await inceptionVaultsCore.depositAndBorrow(ethers.utils.parseEther("100"), borrowAmount);
      const nolanVaultId = await inceptionVaultsDataProvider.vaultId(nolan.address);
      const eurUsdLatestRound = await eurUsdAggregator.latestRoundData();
      const eurUsdRate = eurUsdLatestRound.answer;
      const newInceptionCollateralPrice = (106 * eurUsdRate.toNumber()) / 1e8;
      assetOracle.setLatestPrice(ethers.utils.parseUnits(newInceptionCollateralPrice.toString(), 8));
      await stableX.connect(leo).approve(inceptionVaultsCore.address, ethers.utils.parseEther("11000"));
      await inceptionVaultsCore.connect(leo).liquidate(nolanVaultId);
      const collateralValue = await priceFeed.convertFrom(ethers.utils.parseEther("100"));

      // BigNumbers only handle int, need to use FixedNumbers for float
      const fixedCollateralValue = ethers.FixedNumber.from(collateralValue, "fixed256x18");
      const fixedLiquidationBonus = ethers.FixedNumber.from(ethers.utils.parseEther("1.05"), "fixed256x18");
      const fixedDiscountedCollateralValue = fixedCollateralValue.divUnsafe(fixedLiquidationBonus);
      const discountedCollateralValue = ethers.utils.parseEther(fixedDiscountedCollateralValue.toString());

      const leoParBalance = await stableX.balanceOf(leo.address);
      const adminInceptionVaultParBalance = await stableX.balanceOf(adminInceptionVault.address);
      const leoAaveBalance = await inceptionCollateral.balanceOf(leo.address);
      const inceptionVaultsCoreAaveBalance = await inceptionCollateral.balanceOf(inceptionVaultsCore.address);
      const vaultBalance = await inceptionVaultsDataProvider.vaultCollateralBalance(nolanVaultId);
      const vaultDebt = await inceptionVaultsDataProvider.vaultDebt(nolanVaultId);

      expect(vaultBalance.toNumber()).to.be.equal(0);
      expect(vaultDebt.toNumber()).to.be.equal(0);
      expect(leoAaveBalance.toString()).to.be.equal(ethers.utils.parseEther("100").toString());
      expect(inceptionVaultsCoreAaveBalance.toNumber()).to.be.equal(0);
      expect(leoParBalance.toString()).to.be.equal(
        ethers.utils.parseEther("15000").sub(discountedCollateralValue).toString(),
      );
      expect(adminInceptionVaultParBalance.toString()).to.be.equal(discountedCollateralValue.toString());
    });
  });
});
