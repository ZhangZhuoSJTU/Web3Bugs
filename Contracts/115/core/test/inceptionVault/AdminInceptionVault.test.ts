import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { INCEPTION_VAULT_CONFIG } from "../../config/deployment";
import {
  AccessController,
  ChainlinkInceptionPriceFeed,
  GovernanceAddressProvider,
  InceptionVaultFactory,
  MockChainlinkAggregator,
  MockERC20,
  MockMIMO,
  MockWETH,
  PAR,
  RatesManager,
  SupplyMiner,
  VaultsCore,
  VaultsCoreState,
  VaultsDataProvider,
} from "../../typechain-types";
import { VaultConfigStruct } from "../../typechain-types/IInceptionVaultFactory";

const { expectRevert } = require("@openzeppelin/test-helpers");
const { timeAndMine } = require("hardhat");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["Inception", "SetCore", "SetGovernance"]);
  const { deploy } = deployments;
  const vaultConfig: VaultConfigStruct = {
    liquidationRatio: INCEPTION_VAULT_CONFIG.liquidationRatio,
    minCollateralRatio: INCEPTION_VAULT_CONFIG.minCollateralRatio,
    borrowRate: INCEPTION_VAULT_CONFIG.borrowRate,
    originationFee: INCEPTION_VAULT_CONFIG.originationFee,
    liquidationBonus: INCEPTION_VAULT_CONFIG.liquidationBonus,
    liquidationFee: INCEPTION_VAULT_CONFIG.liquidationFee,
  };

  const vaultsCore: VaultsCore = await ethers.getContract("VaultsCore");
  const vaultsCoreState: VaultsCoreState = await ethers.getContract("VaultsCoreState");
  const ratesManager: RatesManager = await ethers.getContract("RatesManager");
  const inceptionVaultFactory: InceptionVaultFactory = await ethers.getContract("InceptionVaultFactory");
  const vaultsDataProvider: VaultsDataProvider = await ethers.getContract("VaultsDataProvider");
  const stableX: PAR = await ethers.getContract("PAR");
  const accessController: AccessController = await ethers.getContract("AccessController");
  const governanceAddressProvider: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const wethSupplyMiner: SupplyMiner = await ethers.getContract("WETHSupplyMiner");
  const inceptionCollateral: MockERC20 = await ethers.getContract("MockAAVE");
  const WETH: MockWETH = await ethers.getContract("MockWETH");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const chainlinkInceptionPriceFeed: ChainlinkInceptionPriceFeed = await ethers.getContract(
    "ChainlinkInceptionPriceFeed",
  );
  const wethOracle: MockChainlinkAggregator = await ethers.getContract("WETHUsdAggregator");
  const assetOracle: MockChainlinkAggregator = await ethers.getContract("AaveUsdAggregator");

  await inceptionVaultFactory.cloneInceptionVault(
    vaultConfig,
    inceptionCollateral.address,
    chainlinkInceptionPriceFeed.address,
    assetOracle.address,
  );

  const newInceptionVault = await inceptionVaultFactory.inceptionVaults(1);
  const adminInceptionVault = await ethers.getContractAt("AdminInceptionVault", newInceptionVault.adminInceptionVault);
  const inceptionVaultsCore = await ethers.getContractAt("InceptionVaultsCore", newInceptionVault.inceptionVaultsCore);

  const [nolan, leo] = await ethers.getSigners();

  await WETH.mint(nolan.address, ethers.utils.parseEther("10"));
  await WETH.approve(adminInceptionVault.address, ethers.utils.parseEther("10"));

  const latestBlock = await ethers.provider.getBlock("latest");
  const startTime = latestBlock.timestamp;

  const mimoDistributor = await deploy("MIMODistributor", {
    from: nolan.address,
    args: [governanceAddressProvider.address, startTime],
  });

  await deploy("MIMODistributorV2", {
    from: nolan.address,
    args: [governanceAddressProvider.address, startTime, mimoDistributor.address],
  });

  const mimoDistributorV2 = await ethers.getContract("MIMODistributorV2");

  await deploy("EthereumDistributor", {
    from: nolan.address,
    args: [governanceAddressProvider.address],
  });

  const hardhatDistributor = await ethers.getContract("EthereumDistributor");

  await mimoDistributorV2.changePayees([hardhatDistributor.address], [100]);

  await hardhatDistributor.changePayees([wethSupplyMiner.address], [100]);

  return {
    vaultsCore,
    vaultsDataProvider,
    adminInceptionVault,
    inceptionVaultsCore,
    WETH,
    mimo,
    stableX,
    accessController,
    leo,
    mimoDistributorV2,
    hardhatDistributor,
    wethSupplyMiner,
    vaultsCoreState,
    ratesManager,
    nolan,
    wethOracle,
  };
});

before(async () => {
  await setup();
});

describe("--- AdminInceptionVault ---", () => {
  describe("Deposit & Borrow", () => {
    it("should be able to deposit ETH on VaultsCore", async () => {
      const { adminInceptionVault, vaultsDataProvider, WETH } = await setup();
      await adminInceptionVault.depositETH({ value: ethers.utils.parseEther("10") });
      const vaultCount = await vaultsDataProvider.vaultCount();
      const vaultExists = await vaultsDataProvider.vaultExists(vaultCount.toNumber());
      const createdVaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      const vaultCollateralBalance = await vaultsDataProvider.vaultCollateralBalance(createdVaultId);
      expect(createdVaultId.toString()).to.be.equal(vaultCount.toString());
      expect(vaultExists).to.be.true;
      expect(vaultCollateralBalance.toString()).to.be.equal(ethers.utils.parseEther("10").toString());
    });
    it("should be able to deposit WETH on VaultsCore", async () => {
      const { adminInceptionVault, vaultsDataProvider, WETH } = await setup();
      await adminInceptionVault.deposit(WETH.address, ethers.utils.parseEther("5"));
      const vaultCount = await vaultsDataProvider.vaultCount();
      const vaultExists = await vaultsDataProvider.vaultExists(vaultCount.toNumber());
      const createdVaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      const vaultCollateralBalance = await vaultsDataProvider.vaultCollateralBalance(createdVaultId);
      expect(createdVaultId.toString()).to.be.equal(vaultCount.toString());
      expect(vaultExists).to.be.true;
      expect(vaultCollateralBalance.toString()).to.be.equal(ethers.utils.parseEther("5").toString());
    });
    it("should be able to deposit and borrow on VaultsCore", async () => {
      const { adminInceptionVault, vaultsDataProvider, WETH, stableX } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("4000"),
      );
      const vaultCount = await vaultsDataProvider.vaultCount();
      const vaultExists = await vaultsDataProvider.vaultExists(vaultCount.toNumber());
      const createdVaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      const parBalance = await stableX.balanceOf(adminInceptionVault.address);
      expect(createdVaultId.toString()).to.be.equal(vaultCount.toString());
      expect(vaultExists).to.be.true;
      expect(parBalance.toString()).to.be.equal(ethers.utils.parseEther("4000").toString());
    });
    it("should be able to deposit ETH and borrow on VaultsCore", async () => {
      const { adminInceptionVault, vaultsDataProvider, WETH, stableX } = await setup();
      await adminInceptionVault.depositETHAndBorrow(ethers.utils.parseEther("4000"), {
        value: ethers.utils.parseEther("5"),
      });
      const vaultCount = await vaultsDataProvider.vaultCount();
      const vaultExists = await vaultsDataProvider.vaultExists(vaultCount.toNumber());
      const createdVaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      const parBalance = await stableX.balanceOf(adminInceptionVault.address);
      expect(createdVaultId.toString()).to.be.equal(vaultCount.toString());
      expect(vaultExists).to.be.true;
      expect(parBalance.toString()).to.be.equal(ethers.utils.parseEther("4000").toString());
    });
    it("should update collateralCount, collaterals and collateralId when deposit and borrow called twice with the same collateral", async () => {
      const { adminInceptionVault, WETH } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("5000"),
      );
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("5000"),
      );
      const collateralCount = await adminInceptionVault.collateralCount();
      const collaterals = await adminInceptionVault.collaterals(1);
      const collateralId = await adminInceptionVault.collateralId(WETH.address);
      expect(collateralCount).to.be.equal(1);
      expect(collaterals).to.be.equal(WETH.address);
      expect(collateralId).to.be.equal(1);
    });
    it("should be able to borrow on VaultsCore", async () => {
      const { adminInceptionVault, stableX, vaultsDataProvider, WETH } = await setup();
      await adminInceptionVault.deposit(WETH.address, ethers.utils.parseEther("5"));
      const vaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      await adminInceptionVault.borrow(vaultId, ethers.utils.parseEther("4000"));
      const parBalance = await stableX.balanceOf(adminInceptionVault.address);
      expect(parBalance.toString()).to.be.equal(ethers.utils.parseEther("4000").toString());
    });
    it("should update collateralCount, collaterals and collateralId when borrow called twice with the same collateral", async () => {
      const { adminInceptionVault, WETH, vaultsDataProvider } = await setup();
      await adminInceptionVault.deposit(WETH.address, ethers.utils.parseEther("10"));
      const vaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      await adminInceptionVault.borrow(vaultId, ethers.utils.parseEther("5000"));
      await adminInceptionVault.borrow(vaultId, ethers.utils.parseEther("5000"));
      const collateralCount = await adminInceptionVault.collateralCount();
      const collaterals = await adminInceptionVault.collaterals(1);
      const collateralId = await adminInceptionVault.collateralId(WETH.address);
      expect(collateralCount).to.be.equal(1);
      expect(collaterals).to.be.equal(WETH.address);
      expect(collateralId).to.be.equal(1);
    });
    it("should not be able to deposit ETH if not owner", async () => {
      const { adminInceptionVault, leo } = await setup();
      await expectRevert(
        adminInceptionVault.connect(leo).depositETH({ value: ethers.utils.parseEther("10") }),
        "Ownable: caller is not the owner",
      );
    });
    it("should not be able to deposit WETH if not owner", async () => {
      const { adminInceptionVault, WETH, leo } = await setup();
      await expectRevert(
        adminInceptionVault.connect(leo).deposit(WETH.address, ethers.utils.parseEther("5")),
        "Ownable: caller is not the owner",
      );
    });
    it("should not be able to deposit and borrow if not owner", async () => {
      const { adminInceptionVault, WETH, leo } = await setup();
      await expectRevert(
        adminInceptionVault
          .connect(leo)
          .depositAndBorrow(WETH.address, ethers.utils.parseEther("5"), ethers.utils.parseEther("4000")),
        "Ownable: caller is not the owner",
      );
    });
    it("should not be able to deposit ETH and borrow if not owner", async () => {
      const { adminInceptionVault, leo } = await setup();
      await expectRevert(
        adminInceptionVault.connect(leo).depositETHAndBorrow(ethers.utils.parseEther("4000"), {
          value: ethers.utils.parseEther("5"),
        }),
        "Ownable: caller is not the owner",
      );
    });
    it("should not be able to borrow if not owner", async () => {
      const { adminInceptionVault, vaultsDataProvider, WETH, leo } = await setup();
      await adminInceptionVault.deposit(WETH.address, ethers.utils.parseEther("5"));
      const vaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      await expectRevert(
        adminInceptionVault.connect(leo).borrow(vaultId, ethers.utils.parseEther("4000")),
        "Ownable: caller is not the owner",
      );
    });
  });
  describe("Withdraw", () => {
    it("should be able to withdraw on VaultsCore", async () => {
      const { adminInceptionVault, vaultsDataProvider, WETH } = await setup();
      await adminInceptionVault.deposit(WETH.address, ethers.utils.parseEther("5"));
      const vaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      const vaultCount = await vaultsDataProvider.vaultCount();
      await adminInceptionVault.withdraw(vaultId, ethers.utils.parseEther("5"));
      const vaultExists = await vaultsDataProvider.vaultExists(vaultCount.toNumber());
      const vaultBalance = await vaultsDataProvider.vaultCollateralBalance(vaultId);
      expect(vaultExists).to.be.true;
      expect(vaultBalance.toString()).to.be.equal("0");
    });
    it("should not be able to withdraw if not owner", async () => {
      const { adminInceptionVault, leo, vaultsDataProvider, WETH } = await setup();
      await adminInceptionVault.deposit(WETH.address, ethers.utils.parseEther("5"));
      const vaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);
      await expectRevert(
        adminInceptionVault.connect(leo).withdraw(ethers.utils.parseEther("3"), vaultId),
        "Ownable: caller is not the owner",
      );
    });
  });
  describe("Claim & Lend", () => {
    it("should be able to claim MIMO liquidity mining", async () => {
      const { adminInceptionVault, mimo, mimoDistributorV2, hardhatDistributor, WETH } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10000"),
      );

      await timeAndMine.setTimeIncrease("1 year");
      await timeAndMine.mine(1);

      await mimoDistributorV2.release();
      await hardhatDistributor.release();
      await adminInceptionVault.claimMimo();

      const mimoBalance = await mimo.balanceOf(adminInceptionVault.address);

      expect(mimoBalance.toString()).to.not.be.equal("0");
    });
    it("should be able to transfer earned Mimo", async () => {
      const { adminInceptionVault, mimo, mimoDistributorV2, hardhatDistributor, leo, WETH } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10000"),
      );

      await timeAndMine.setTimeIncrease("1 year");
      await timeAndMine.mine(1);

      await mimoDistributorV2.release();
      await hardhatDistributor.release();
      await adminInceptionVault.claimMimo();

      const adminInceptionVaultMimoBalanceBeforeTransfer = await mimo.balanceOf(adminInceptionVault.address);
      await adminInceptionVault.transferMimo(ethers.utils.parseEther("1000000"), leo.address);
      const adminInceptionVaultMimoBalanceAfterTransfer = await mimo.balanceOf(adminInceptionVault.address);
      const leoMimoBalance = await mimo.balanceOf(leo.address);

      expect(leoMimoBalance.toString()).to.be.equal(ethers.utils.parseEther("1000000").toString());
      expect(adminInceptionVaultMimoBalanceAfterTransfer.toString()).to.be.equal(
        adminInceptionVaultMimoBalanceBeforeTransfer.sub(leoMimoBalance).toString(),
      );
    });
    it("should not call releaseMIMO on supplyMiner if no pending MIMO", async () => {
      const {
        adminInceptionVault,
        vaultsDataProvider,
        WETH,
        vaultsCore,
        mimoDistributorV2,
        hardhatDistributor,
        mimo,
        leo,
        wethOracle,
      } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10000"),
      );
      const vaultId = await vaultsDataProvider.vaultId(WETH.address, adminInceptionVault.address);

      await timeAndMine.setTimeIncrease("1 year");
      await timeAndMine.mine(1);

      await await mimoDistributorV2.release();
      await hardhatDistributor.release();
      await adminInceptionVault.claimMimo();

      const mimoBalanceBefore = await mimo.balanceOf(adminInceptionVault.address);

      const block = await ethers.provider.getBlock("latest");
      const { timestamp } = block;

      await wethOracle.setUpdatedAt(timestamp);
      await vaultsCore
        .connect(leo)
        .depositETHAndBorrow(ethers.utils.parseEther("20000"), { value: ethers.utils.parseEther("20") });
      await vaultsCore.connect(leo).repayAll(vaultId);
      await mimoDistributorV2.release();
      await hardhatDistributor.release();
      await adminInceptionVault.claimMimo();

      const mimoBalanceAfter = await mimo.balanceOf(adminInceptionVault.address);

      expect(mimoBalanceBefore.toString()).to.not.be.equal("0");
      expect(mimoBalanceBefore.toString()).be.equal(mimoBalanceAfter.toString());
    });
    it("should not be able to lendPAR if not InceptionVaultsCore", async () => {
      const { adminInceptionVault, leo, WETH } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("4000"),
      );
      await expectRevert(adminInceptionVault.lendPAR(ethers.utils.parseEther("4000"), leo.address), "IV011");
    });
    it("should be able to transfer PAR", async () => {
      const { adminInceptionVault, stableX, leo, WETH } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10000"),
      );
      const adminInceptionVaultParBalanceBeforeTransfer = await stableX.balanceOf(adminInceptionVault.address);
      await adminInceptionVault.transferPar(ethers.utils.parseEther("5000"), leo.address);
      const adminInceptionVaultParBalanceAfterTransfer = await stableX.balanceOf(adminInceptionVault.address);
      const leoParBalance = await stableX.balanceOf(leo.address);

      expect(leoParBalance.toString()).to.be.equal(ethers.utils.parseEther("5000").toString());
      expect(adminInceptionVaultParBalanceAfterTransfer.toString()).to.be.equal(
        adminInceptionVaultParBalanceBeforeTransfer.sub(leoParBalance).toString(),
      );
    });
    it("should not be able to transfer MIMO if not owner", async () => {
      const { adminInceptionVault, mimo, leo } = await setup();
      await mimo.mint(adminInceptionVault.address, 100);
      await expectRevert(
        adminInceptionVault.connect(leo).transferMimo(100, leo.address),
        "Ownable: caller is not the owner",
      );
    });
    it("should not be able to transfer PAR if not owner", async () => {
      const { adminInceptionVault, leo, WETH } = await setup();
      await adminInceptionVault.depositAndBorrow(
        WETH.address,
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10000"),
      );
      await expectRevert(
        adminInceptionVault.connect(leo).transferPar(ethers.utils.parseEther("5000"), leo.address),
        "Ownable: caller is not the owner",
      );
    });
  });
});
