import { expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { INCEPTION_VAULT_CONFIG } from "../../config/deployment";
import {
  AdminInceptionVault,
  ChainlinkInceptionPriceFeed,
  InceptionVaultFactory,
  InceptionVaultsCore,
  InceptionVaultsDataProvider,
} from "../../typechain-types";
import { VaultConfigStruct } from "../../typechain-types/InceptionVaultFactory";
import { address0 } from "../../utils/helper";

const { expectRevert } = require("@openzeppelin/test-helpers");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["Inception", "SetCore", "SetGovernance"]);

  const adminInceptionVaultBase = await deployments.get("BaseAdminInceptionVault");
  const inceptionVaultsCoreBase = await deployments.get("BaseInceptionVaultsCore");
  const inceptionVaultsDataProviderBase = await deployments.get("BaseInceptionVaultsDataProvider");
  const addressProvider = await deployments.get("AddressProvider");
  const debtNotifier = await deployments.get("DebtNotifier");
  const chainlinkInceptionPriceFeed = await deployments.get("ChainlinkInceptionPriceFeed");
  const assetOracle = await deployments.get("AaveUsdAggregator");
  const inceptionCollateral = await deployments.get("MockAAVE");
  const WETH = await deployments.get("MockWETH");
  const mimo = await deployments.get("MockMIMO");
  const customPriceFeed = await deployments.get("PriceFeed");

  const vaultConfig: VaultConfigStruct = {
    liquidationRatio: INCEPTION_VAULT_CONFIG.liquidationRatio,
    minCollateralRatio: INCEPTION_VAULT_CONFIG.minCollateralRatio,
    borrowRate: INCEPTION_VAULT_CONFIG.borrowRate,
    originationFee: INCEPTION_VAULT_CONFIG.originationFee,
    liquidationBonus: INCEPTION_VAULT_CONFIG.liquidationBonus,
    liquidationFee: INCEPTION_VAULT_CONFIG.liquidationFee,
  };

  const inceptionVaultFactory: InceptionVaultFactory = await ethers.getContract("InceptionVaultFactory");

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
  const inceptionVaultPriceFeed: ChainlinkInceptionPriceFeed = await ethers.getContractAt(
    "ChainlinkInceptionPriceFeed",
    newInceptionVault.inceptionVaultPriceFeed,
  );

  return {
    inceptionVaultFactory,
    adminInceptionVault,
    inceptionVaultsCore,
    inceptionVaultsDataProvider,
    adminInceptionVaultBase,
    inceptionVaultsCoreBase,
    inceptionVaultsDataProviderBase,
    addressProvider,
    debtNotifier,
    WETH,
    mimo,
    inceptionCollateral,
    vaultConfig,
    chainlinkInceptionPriceFeed,
    assetOracle,
    customPriceFeed,
    inceptionVaultPriceFeed,
  };
});

before(async () => {
  await setup();
});

describe("--- InceptionVaultFactory ---", () => {
  // Tests InceptionVaultFactory variables setting
  describe("Config", () => {
    it("should set adminInceptionVaultBase correctly", async () => {
      const { inceptionVaultFactory } = await setup();
      const _adminInceptionVaultBase = await deployments.get("BaseAdminInceptionVault");
      const adminInceptionVaultBase = await inceptionVaultFactory.adminInceptionVaultBase();
      expect(adminInceptionVaultBase).to.be.equal(_adminInceptionVaultBase.address);
    });
    it("should set inceptionVaultsCoreBase correctly", async () => {
      const { inceptionVaultFactory } = await setup();
      const _inceptionVaultsCoreBase = await deployments.get("BaseInceptionVaultsCore");
      const inceptionVaultsCoreBase = await inceptionVaultFactory.inceptionVaultsCoreBase();
      expect(inceptionVaultsCoreBase).to.be.equal(_inceptionVaultsCoreBase.address);
    });
    it("should set inceptionVaultsDataProviderBase correctly", async () => {
      const { inceptionVaultFactory } = await setup();
      const _inceptionVaultsDataProviderBase = await deployments.get("BaseInceptionVaultsDataProvider");
      const inceptionVaultsDataProviderBase = await inceptionVaultFactory.inceptionVaultsDataProviderBase();
      expect(inceptionVaultsDataProviderBase).to.be.equal(_inceptionVaultsDataProviderBase.address);
    });
    it("should set addressProvider correctly", async () => {
      const { inceptionVaultFactory } = await setup();
      const _addressProvider = await deployments.get("AddressProvider");
      const addressProvider = await inceptionVaultFactory.a();
      expect(addressProvider).to.be.equal(_addressProvider.address);
    });
    it("should set debtNotifier correctly", async () => {
      const { inceptionVaultFactory } = await setup();
      const _debtNotifier = await deployments.get("DebtNotifier");
      const debtNotifier = await inceptionVaultFactory.debtNotifier();
      expect(debtNotifier).to.be.equal(_debtNotifier.address);
    });
    it("should set WETH corretly", async () => {
      const { inceptionVaultFactory, WETH } = await setup();
      const _WETH = await inceptionVaultFactory.weth();
      expect(_WETH).to.be.equal(WETH.address);
    });
    it("should set mimo correctly", async () => {
      const { inceptionVaultFactory, mimo } = await setup();
      const _mimo = await inceptionVaultFactory.mimo();
      expect(_mimo).to.be.equal(mimo.address);
    });
    it("should revert if trying to set adminInceptioVaultBase to address 0", async () => {
      const { inceptionVaultsCoreBase, inceptionVaultsDataProviderBase, addressProvider, debtNotifier, WETH, mimo } =
        await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            address0,
            inceptionVaultsCoreBase.address,
            inceptionVaultsDataProviderBase.address,
            addressProvider.address,
            debtNotifier.address,
            WETH.address,
            mimo.address,
          ],
        }),
        "IV000",
      );
    });
    it("should revert if trying to set inceptionVaultsCoreBase to address 0", async () => {
      const { adminInceptionVaultBase, inceptionVaultsDataProviderBase, addressProvider, debtNotifier, WETH, mimo } =
        await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert.unspecified(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            adminInceptionVaultBase.address,
            address0,
            inceptionVaultsDataProviderBase.address,
            addressProvider.address,
            debtNotifier.address,
            WETH.address,
            mimo.address,
          ],
        }),
        "IV000",
      );
    });
    it("should revert if trying to set inceptionVaultDataProviderBase to address 0", async () => {
      const { adminInceptionVaultBase, inceptionVaultsCoreBase, addressProvider, debtNotifier, WETH, mimo } =
        await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert.unspecified(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            adminInceptionVaultBase.address,
            inceptionVaultsCoreBase.address,
            address0,
            addressProvider.address,
            debtNotifier.address,
            WETH.address,
            mimo.address,
          ],
        }),
        "IV000",
      );
    });
    it("should revert if trying to set addressProvider to address 0", async () => {
      const {
        adminInceptionVaultBase,
        inceptionVaultsCoreBase,
        inceptionVaultsDataProviderBase,
        debtNotifier,
        WETH,
        mimo,
      } = await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert.unspecified(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            adminInceptionVaultBase.address,
            inceptionVaultsCoreBase.address,
            inceptionVaultsDataProviderBase.address,
            address0,
            debtNotifier.address,
            WETH.address,
            mimo.address,
          ],
        }),
        "IV000",
      );
    });
    it("should revert if trying to set debtNotifier to address 0", async () => {
      const {
        adminInceptionVaultBase,
        inceptionVaultsCoreBase,
        inceptionVaultsDataProviderBase,
        addressProvider,
        WETH,
        mimo,
      } = await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert.unspecified(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            adminInceptionVaultBase.address,
            inceptionVaultsCoreBase.address,
            inceptionVaultsDataProviderBase.address,
            addressProvider.address,
            address0,
            WETH.address,
            mimo.address,
          ],
        }),
        "IV000",
      );
    });
    it("should revert if trying to set WETH to address 0", async () => {
      const {
        adminInceptionVaultBase,
        inceptionVaultsCoreBase,
        inceptionVaultsDataProviderBase,
        addressProvider,
        debtNotifier,
        mimo,
      } = await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert.unspecified(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            adminInceptionVaultBase.address,
            inceptionVaultsCoreBase.address,
            inceptionVaultsDataProviderBase.address,
            addressProvider.address,
            debtNotifier.address,
            address0,
            mimo.address,
          ],
        }),
        "IV000",
      );
    });
    it("should revert if trying to set mimo to address 0", async () => {
      const {
        adminInceptionVaultBase,
        inceptionVaultsCoreBase,
        inceptionVaultsDataProviderBase,
        addressProvider,
        debtNotifier,
        WETH,
      } = await setup();
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      await expectRevert.unspecified(
        deploy("InceptionVaultFactory", {
          from: deployer,
          args: [
            adminInceptionVaultBase.address,
            inceptionVaultsCoreBase.address,
            inceptionVaultsDataProviderBase.address,
            addressProvider.address,
            debtNotifier.address,
            WETH.address,
            address0,
          ],
        }),
        "IV000",
      );
    });
  });
  // Test cloned contracts initialization and InceptionVaultFactory state variable update
  describe("Clone", () => {
    describe("AdminInceptionVault", () => {
      it("should set AddressProvider correctly", async () => {
        const { adminInceptionVault, addressProvider } = await setup();
        const a = await adminInceptionVault.a();
        expect(a).to.be.equal(addressProvider.address);
      });
      it("should set owner correctly", async () => {
        const { adminInceptionVault } = await setup();
        const { deployer } = await getNamedAccounts();
        const owner = await adminInceptionVault.owner();
        expect(owner).to.be.equal(deployer);
      });
      it("should set weth correctly", async () => {
        const { adminInceptionVault, WETH } = await setup();
        const _WETH = await adminInceptionVault.weth();
        expect(_WETH).to.be.equal(WETH.address);
      });
      it("should set debtNotifier correctly", async () => {
        const { adminInceptionVault, debtNotifier } = await setup();
        const _debtNotifier = await adminInceptionVault.debtNotifier();
        expect(_debtNotifier).to.be.equal(debtNotifier.address);
      });
      it("should set mimo correctly", async () => {
        const { adminInceptionVault, mimo } = await setup();
        const _mimo = await adminInceptionVault.mimo();
        expect(_mimo).to.be.equal(mimo.address);
      });
      it("should set InceptionVaultsCore correctly", async () => {
        const { adminInceptionVault, inceptionVaultsCore } = await setup();
        const _inceptionVaultsCore = await adminInceptionVault.inceptionCore();
        expect(_inceptionVaultsCore).to.be.equal(inceptionVaultsCore.address);
      });
    });
    describe("InceptionVaultsCore", () => {
      it("should set lastRefresh correctly", async () => {
        const { inceptionVaultsCore } = await setup();
        const lastRefresh = await inceptionVaultsCore.lastRefresh();
        expect(lastRefresh.toNumber()).to.be.greaterThan(0);
      });
      it("should set adminIncpetionVault", async () => {
        const { inceptionVaultsCore, adminInceptionVault } = await setup();
        const _adminIncpetionVault = await inceptionVaultsCore.adminInceptionVault();
        expect(_adminIncpetionVault).to.be.equal(adminInceptionVault.address);
      });
      it("should set inceptionVaultsDataorrectly", async () => {
        const { inceptionVaultsCore, inceptionVaultsDataProvider } = await setup();
        const inceptionVaultsData = await inceptionVaultsCore.inceptionVaultsData();
        expect(inceptionVaultsData).to.be.equal(inceptionVaultsDataProvider.address);
      });
      it("should set inceptionCollateral correctly", async () => {
        const { inceptionVaultsCore, inceptionCollateral } = await setup();
        const setInceptionCollateral = await inceptionVaultsCore.inceptionCollateral();
        expect(setInceptionCollateral).to.be.equal(inceptionCollateral.address);
      });
      it("should set AddressProvider correctly", async () => {
        const { inceptionVaultsCore, addressProvider } = await setup();
        const a = await inceptionVaultsCore.a();
        expect(a).to.be.equal(addressProvider.address);
      });
      it("should set VaultConfig correctly", async () => {
        const { inceptionVaultsCore } = await setup();
        const vaultConfig = await inceptionVaultsCore.vaultConfig();
        expect(vaultConfig.liquidationRatio.toString()).to.be.equal(INCEPTION_VAULT_CONFIG.liquidationRatio.toString());
        expect(vaultConfig.minCollateralRatio.toString()).to.be.equal(
          INCEPTION_VAULT_CONFIG.minCollateralRatio.toString(),
        );
        expect(vaultConfig.borrowRate.toString()).to.be.equal(INCEPTION_VAULT_CONFIG.borrowRate.toString());
        expect(vaultConfig.originationFee.toString()).to.be.equal(INCEPTION_VAULT_CONFIG.originationFee.toString());
        expect(vaultConfig.liquidationBonus.toString()).to.be.equal(INCEPTION_VAULT_CONFIG.liquidationBonus.toString());
        expect(vaultConfig.liquidationFee.toString()).to.be.equal(INCEPTION_VAULT_CONFIG.liquidationFee.toString());
      });
    });
    describe("InceptionVaultsDataProvider", () => {
      it("should set inceptionVaultsCore correctly", async () => {
        const { inceptionVaultsDataProvider, inceptionVaultsCore } = await setup();
        const _inceptionVaultsCore = await inceptionVaultsDataProvider.inceptionVaultsCore();
        expect(_inceptionVaultsCore).to.be.equal(inceptionVaultsCore.address);
      });
      it("should set addressProvider correctly", async () => {
        const { inceptionVaultsDataProvider, addressProvider } = await setup();
        const _addressProvider = await inceptionVaultsDataProvider.a();
        expect(_addressProvider).to.be.equal(addressProvider.address);
      });
    });
    describe("ChainlinkInceptionPriceFeed", () => {
      it("should set Address Provider correctly", async () => {
        const { inceptionVaultPriceFeed, addressProvider } = await setup();
        const a = await inceptionVaultPriceFeed.a();
        expect(a).to.be.equal(addressProvider.address);
      });
      it("should set assetOracle correctly", async () => {
        const { inceptionVaultPriceFeed, assetOracle } = await setup();
        const _assetOracle = await inceptionVaultPriceFeed.assetOracle();
        expect(_assetOracle).to.be.equal(assetOracle.address);
      });
      it("should set eurOracle correctly", async () => {
        const { inceptionVaultPriceFeed } = await setup();
        const corePriceFeed = await ethers.getContract("PriceFeed");
        const eurOracle = await corePriceFeed.eurOracle();
        const _eurOracle = await inceptionVaultPriceFeed.eurOracle();
        expect(_eurOracle).to.be.equal(eurOracle);
      });
    });
    describe("InceptionVaultFactory", () => {
      it("should revert if trying to set inceptionCollateral to address 0", async () => {
        const { inceptionVaultFactory, vaultConfig, chainlinkInceptionPriceFeed, assetOracle } = await setup();
        await expectRevert.unspecified(
          inceptionVaultFactory.cloneInceptionVault(
            vaultConfig,
            address0,
            chainlinkInceptionPriceFeed.address,
            assetOracle.address,
          ),
          "IV000",
        );
      });
      it("should revert if trying to set inceptionVaultPriceFeed to address 0", async () => {
        const { inceptionVaultFactory, vaultConfig, inceptionCollateral, assetOracle } = await setup();
        await expectRevert.unspecified(
          inceptionVaultFactory.cloneInceptionVault(
            vaultConfig,
            inceptionCollateral.address,
            address0,
            assetOracle.address,
          ),
          "IV000",
        );
      });
      it("should revert if trying to deploy with standard price feed but asset oracle set to address0", async () => {
        const { inceptionVaultFactory, vaultConfig, inceptionCollateral, chainlinkInceptionPriceFeed } = await setup();
        await expectRevert.unspecified(
          inceptionVaultFactory.cloneInceptionVault(
            vaultConfig,
            inceptionCollateral.address,
            chainlinkInceptionPriceFeed.address,
            address0,
          ),
          "IV000",
        );
      });
      it("should revert if trying to deploy with custom price feed but asset oracle set to other than address 0", async () => {
        const { inceptionVaultFactory, vaultConfig, inceptionCollateral, customPriceFeed, assetOracle } = await setup();
        await expectRevert.unspecified(
          inceptionVaultFactory.cloneInceptionVault(
            vaultConfig,
            inceptionCollateral.address,
            customPriceFeed.address,
            assetOracle.address,
          ),
          "IV001",
        );
      });
      it("should update state variable correctly with standard price feed", async () => {
        const { inceptionVaultFactory, adminInceptionVault, inceptionVaultsCore, inceptionVaultsDataProvider } =
          await setup();
        const { deployer } = await getNamedAccounts();
        const inceptionVaultCount = await inceptionVaultFactory.inceptionVaultCount();
        const inceptionVault = await inceptionVaultFactory.inceptionVaults(1);
        const inceptionVaultPriceFeed = await inceptionVaultsCore.inceptionPriceFeed();
        expect(inceptionVaultCount.toNumber()).to.be.equal(1);
        expect(inceptionVault.owner).to.be.equal(deployer);
        expect(inceptionVault.adminInceptionVault).to.be.equal(adminInceptionVault.address);
        expect(inceptionVault.inceptionVaultsCore).to.be.equal(inceptionVaultsCore.address);
        expect(inceptionVault.inceptionVaultPriceFeed).to.be.equal(inceptionVaultPriceFeed);
        expect(inceptionVault.inceptionVaultsDataProvider).to.be.equal(inceptionVaultsDataProvider.address);
        expect(inceptionVault.isCustomPriceFeed).to.be.false;
      });
      it("should update state variable correctly with custom price feed", async () => {
        const { inceptionVaultFactory, inceptionCollateral, customPriceFeed, vaultConfig } = await setup();
        const { deployer } = await getNamedAccounts();
        await inceptionVaultFactory.cloneInceptionVault(
          vaultConfig,
          inceptionCollateral.address,
          customPriceFeed.address,
          address0,
        );
        const inceptionVaultCount = await inceptionVaultFactory.inceptionVaultCount();
        const inceptionVault = await inceptionVaultFactory.inceptionVaults(2);
        expect(inceptionVaultCount.toNumber()).to.be.equal(2);
        expect(inceptionVault.owner).to.be.equal(deployer);
        expect(inceptionVault.isCustomPriceFeed).to.be.true;
      });
      it("should emit InceptionVaultDeployed event", async () => {
        const { inceptionVaultFactory, vaultConfig, inceptionCollateral, chainlinkInceptionPriceFeed, assetOracle } =
          await setup();
        const [, leo] = await ethers.getSigners();
        const tx = await inceptionVaultFactory
          .connect(leo)
          .cloneInceptionVault(
            vaultConfig,
            inceptionCollateral.address,
            chainlinkInceptionPriceFeed.address,
            assetOracle.address,
          );
        const newInceptionVault = await inceptionVaultFactory.inceptionVaults(2);
        const { adminInceptionVault, inceptionVaultsCore, inceptionVaultsDataProvider, inceptionVaultPriceFeed } =
          newInceptionVault;
        await expect(tx)
          .to.emit(inceptionVaultFactory, "InceptionVaultDeployed")
          .withArgs(
            leo.address,
            adminInceptionVault,
            inceptionVaultsCore,
            inceptionVaultsDataProvider,
            inceptionVaultPriceFeed,
          );
      });
    });
  });
  describe("Add Price Feed", () => {
    it("should be able to add price feed", async () => {
      const { inceptionVaultFactory, customPriceFeed } = await setup();
      await expect(inceptionVaultFactory.addPriceFeed(customPriceFeed.address))
        .to.emit(inceptionVaultFactory, "PriceFeedAdded")
        .withArgs(2, customPriceFeed.address);
      const priceFeedCount = await inceptionVaultFactory.priceFeedCount();
      const priceFeedId = await inceptionVaultFactory.priceFeedIds(customPriceFeed.address);
      const priceFeedAddress = await inceptionVaultFactory.priceFeeds(2);
      expect(priceFeedCount).to.be.equal(2);
      expect(priceFeedId).to.be.equal(2);
      expect(priceFeedAddress).to.be.equal(customPriceFeed.address);
    });
    it("should revert if trying to add address0 as price feed", async () => {
      const { inceptionVaultFactory } = await setup();
      await expectRevert.unspecified(inceptionVaultFactory.addPriceFeed(address0), "IV000");
    });
    it("should revert if trying to add price feed already listed", async () => {
      const { inceptionVaultFactory, chainlinkInceptionPriceFeed } = await setup();
      await expectRevert.unspecified(inceptionVaultFactory.addPriceFeed(chainlinkInceptionPriceFeed.address), "IV002");
    });
  });
});
