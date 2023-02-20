import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { MockContract } from "ethereum-waffle";
import { BigNumber, Signer } from "ethers";
import { ethers } from "hardhat";
import { beforeEach, describe } from "mocha";
import ORACLE_MANAGER from "../artifacts/contracts/pricing/oracle/ChainlinkOracleManager.sol/ChainlinkOracleManager.json";
import { AssetsRegistry, OptionsFactory, OracleRegistry } from "../typechain";
import { CollateralToken } from "../typechain/CollateralToken";
import { MockERC20 } from "../typechain/MockERC20";
import { QuantConfig } from "../typechain/QuantConfig";
import { expect, provider } from "./setup";
import {
  deployAssetsRegistry,
  deployCollateralToken,
  deployOptionsFactory,
  deployOracleRegistry,
  deployQuantConfig,
  mockERC20,
} from "./testUtils";

describe("OptionsFactory", () => {
  let quantConfig: QuantConfig;
  let collateralToken: CollateralToken;
  let timelockController: Signer;
  let oracleManagerAccount: Signer;
  let secondAccount: Signer;
  let assetsRegistryManager: Signer;
  let WETH: MockERC20;
  let BUSD: MockERC20;
  let optionsFactory: OptionsFactory;
  let assetsRegistry: AssetsRegistry;
  let oracleRegistry: OracleRegistry;
  let mockOracleManager: MockContract;
  let futureTimestamp: number;
  let samplePutOptionParameters: [
    string,
    string,
    BigNumber,
    BigNumber,
    boolean
  ];
  let sampleCollateralTokenParameters: [
    string,
    string,
    string,
    BigNumber,
    BigNumber,
    boolean
  ];

  beforeEach(async () => {
    [
      timelockController,
      oracleManagerAccount,
      secondAccount,
      assetsRegistryManager,
    ] = provider.getWallets();

    quantConfig = await deployQuantConfig(timelockController, [
      {
        addresses: [await assetsRegistryManager.getAddress()],
        role: "ASSETS_REGISTRY_MANAGER_ROLE",
      },
      {
        addresses: [await oracleManagerAccount.getAddress()],
        role: "ORACLE_MANAGER_ROLE",
      },
    ]);

    WETH = await mockERC20(timelockController, "WETH", "Wrapped Ether");
    BUSD = await mockERC20(timelockController, "BUSD", "BUSD Token", 18);

    collateralToken = await deployCollateralToken(
      timelockController,
      quantConfig
    );

    mockOracleManager = await deployMockContract(
      timelockController,
      ORACLE_MANAGER.abi
    );

    assetsRegistry = await deployAssetsRegistry(
      timelockController,
      quantConfig
    );

    oracleRegistry = await deployOracleRegistry(
      timelockController,
      quantConfig
    );

    await assetsRegistry
      .connect(assetsRegistryManager)
      .addAsset(
        WETH.address,
        await WETH.name(),
        await WETH.symbol(),
        await WETH.decimals()
      );

    optionsFactory = await deployOptionsFactory(
      timelockController,
      BUSD.address,
      quantConfig,
      collateralToken
    );

    await quantConfig
      .connect(timelockController)
      .setProtocolRole("COLLATERAL_CREATOR_ROLE", optionsFactory.address);

    await quantConfig
      .connect(timelockController)
      .setProtocolRole("PRICE_SUBMITTER_ROLE", oracleRegistry.address);

    await quantConfig
      .connect(timelockController)
      .setProtocolRole("PRICE_SUBMITTER_ROLE_ADMIN", oracleRegistry.address);

    await quantConfig
      .connect(timelockController)
      .setRoleAdmin(
        ethers.utils.id("PRICE_SUBMITTER_ROLE"),
        ethers.utils.id("PRICE_SUBMITTER_ROLE_ADMIN")
      );

    await oracleRegistry
      .connect(oracleManagerAccount)
      .addOracle(mockOracleManager.address);

    await oracleRegistry
      .connect(oracleManagerAccount)
      .activateOracle(mockOracleManager.address);

    //Note: returning any address here to show existence of the oracle
    await mockOracleManager.mock.getAssetOracle.returns(
      mockOracleManager.address
    );

    await mockOracleManager.mock.isValidOption.returns(true);

    // 30 days from now
    futureTimestamp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

    samplePutOptionParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.utils.parseUnits("1400", await BUSD.decimals()),
      ethers.BigNumber.from(futureTimestamp),
      false,
    ];

    sampleCollateralTokenParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.constants.AddressZero,
      ethers.utils.parseUnits("1400", await BUSD.decimals()),
      ethers.BigNumber.from(futureTimestamp),
      false,
    ];
  });

  describe("createOption", () => {
    it("Anyone should be able to create new options", async () => {
      expect(await optionsFactory.getOptionsLength()).to.equal(
        ethers.BigNumber.from("0")
      );

      const qTokenAddress = await optionsFactory.getTargetQTokenAddress(
        ...samplePutOptionParameters
      );

      const collateralTokenId = await optionsFactory.getTargetCollateralTokenId(
        ...sampleCollateralTokenParameters
      );

      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(...samplePutOptionParameters)
      )
        .to.emit(optionsFactory, "OptionCreated")
        .withArgs(
          qTokenAddress,
          await secondAccount.getAddress(),
          ...samplePutOptionParameters.slice(0, 4),
          collateralTokenId,
          ethers.BigNumber.from("1"),
          false
        );

      expect(await optionsFactory.qTokens(ethers.BigNumber.from("0"))).to.equal(
        qTokenAddress
      );

      expect(
        await collateralToken.collateralTokenIds(ethers.BigNumber.from("0"))
      ).to.equal(collateralTokenId);
    });

    it("Should revert when trying to create an option if the oracle is not registered in the oracle registry", async () => {
      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            WETH.address,
            ethers.constants.AddressZero,
            ethers.utils.parseUnits("1400", await BUSD.decimals()),
            ethers.BigNumber.from(futureTimestamp),
            false
          )
      ).to.be.revertedWith(
        "OptionsFactory: Oracle is not registered in OracleRegistry"
      );
    });

    it("Should revert when trying to make an option for an asset not registered in the oracle", async () => {
      //Set the oracle to the zero address, signifying the asset not being registed
      await mockOracleManager.mock.getAssetOracle.returns(
        ethers.constants.AddressZero
      );

      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            WETH.address,
            mockOracleManager.address,
            ethers.utils.parseUnits("1400", await BUSD.decimals()),
            ethers.BigNumber.from(futureTimestamp),
            false
          )
      ).to.be.revertedWith("OptionsFactory: Asset does not exist in oracle");
    });

    it("Should revert when trying to create an option with a deactivated oracle", async () => {
      //Deactivate the oracle
      await oracleRegistry
        .connect(oracleManagerAccount)
        .deactivateOracle(mockOracleManager.address);

      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            WETH.address,
            mockOracleManager.address,
            ethers.utils.parseUnits("1400", await BUSD.decimals()),
            ethers.BigNumber.from(futureTimestamp),
            false
          )
      ).to.be.revertedWith(
        "OptionsFactory: Oracle is not active in the OracleRegistry"
      );
    });

    it("Should revert when trying to create an option that would have already expired", async () => {
      const pastTimestamp = "1582602164";
      await expect(
        optionsFactory.createOption(
          WETH.address,
          ethers.constants.AddressZero,
          ethers.utils.parseUnits("1400", await BUSD.decimals()),
          ethers.BigNumber.from(pastTimestamp),
          false
        )
      ).to.be.revertedWith("OptionsFactory: given expiry time is in the past");
    });

    it("Should revert when trying to create a duplicate option", async () => {
      await optionsFactory
        .connect(secondAccount)
        .createOption(...samplePutOptionParameters);

      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(...samplePutOptionParameters)
      ).to.be.revertedWith("option already created");
    });

    it("Should revert when trying to create a PUT option with a strike price of 0", async () => {
      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            WETH.address,
            mockOracleManager.address,
            ethers.BigNumber.from("0"),
            futureTimestamp,
            false
          )
      ).to.be.revertedWith("strike can't be 0");
    });

    it("Should revert when trying to create a CALL option with a strike price of 0", async () => {
      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            WETH.address,
            mockOracleManager.address,
            ethers.BigNumber.from("0"),
            futureTimestamp,
            true
          )
      ).to.be.revertedWith("strike can't be 0");
    });

    it("Should revert when trying to create an option with an underlying that's not in the assets registry", async () => {
      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            ethers.constants.AddressZero,
            mockOracleManager.address,
            ethers.utils.parseUnits("1400", await BUSD.decimals()),
            futureTimestamp,
            false
          )
      ).to.be.revertedWith("underlying not in the registry");
    });

    it("Should revert when trying to create an option that is considered invalid by the given oracle", async () => {
      await mockOracleManager.mock.isValidOption.returns(false);
      await expect(
        optionsFactory
          .connect(secondAccount)
          .createOption(
            ethers.constants.AddressZero,
            mockOracleManager.address,
            ethers.utils.parseUnits("1400", await BUSD.decimals()),
            futureTimestamp,
            false
          )
      ).to.be.revertedWith(
        "OptionsFactory: Oracle doesn't support the given option"
      );
    });
  });

  describe("getCollateralToken", () => {
    it("Should return the ID of the correct CollateralToken", async () => {
      const collateralTokenId = await optionsFactory.getTargetCollateralTokenId(
        ...sampleCollateralTokenParameters
      );

      await optionsFactory
        .connect(secondAccount)
        .createOption(...samplePutOptionParameters);

      expect(
        await optionsFactory.getCollateralToken(
          ...sampleCollateralTokenParameters
        )
      ).to.equal(collateralTokenId);
    });
  });

  describe("getQToken", () => {
    it("Should return the address of the correct QToken", async () => {
      const qTokenAddress = await optionsFactory.getTargetQTokenAddress(
        ...samplePutOptionParameters
      );

      await optionsFactory
        .connect(secondAccount)
        .createOption(...samplePutOptionParameters);

      expect(
        await optionsFactory.getQToken(...samplePutOptionParameters)
      ).to.equal(qTokenAddress);
    });
  });

  describe("getOptionsLength", () => {
    it("Should return the correct number of options created by the factory", async () => {
      expect(await optionsFactory.getOptionsLength()).to.equal(
        ethers.BigNumber.from("0")
      );

      await optionsFactory
        .connect(secondAccount)
        .createOption(...samplePutOptionParameters);

      expect(await optionsFactory.getOptionsLength()).to.equal(
        ethers.BigNumber.from("1")
      );
    });
  });
});
