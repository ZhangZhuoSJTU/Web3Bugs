import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { MockContract } from "ethereum-waffle";
import { ContractFactory, Signer } from "ethers";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { beforeEach, describe, it } from "mocha";
import AGGREGATOR from "../artifacts/contracts/interfaces/external/chainlink/IEACAggregatorProxy.sol/IEACAggregatorProxy.json";
import PRICE_REGISTRY from "../artifacts/contracts/pricing/PriceRegistry.sol/PriceRegistry.json";
import CONFIG from "../artifacts/contracts/QuantConfig.sol/QuantConfig.json";
import {
  ChainlinkFixedTimeOracleManager,
  ChainlinkOracleManager,
  MockAggregatorProxy,
  PriceRegistry,
} from "../typechain";
import { expect, provider } from "./setup";

export const testProviderOracleManager = async (
  testDescription: string,
  deployOracleManager: (
    mockConfig: MockContract,
    strikeAssetDecimals: number,
    fallBackPriceInSeconds: number
  ) => Promise<ChainlinkOracleManager | ChainlinkFixedTimeOracleManager>
): Promise<void> => {
  let mockConfig: MockContract;
  let mockPriceRegistry: MockContract;
  let owner: Signer;
  let oracleManagerAccount: Signer;
  let normalUserAccount: Signer;
  let oracleManager: ChainlinkOracleManager | ChainlinkFixedTimeOracleManager;

  const assetOne = "0x0000000000000000000000000000000000000001";
  const assetTwo = "0x0000000000000000000000000000000000000002";
  const oracleOne = "0x0000000000000000000000000000000000000010";
  const oracleTwo = "0x0000000000000000000000000000000000000020";
  const oracleThree = "0x0000000000000000000000000000000000000030";

  async function setUpTests() {
    [owner, oracleManagerAccount, normalUserAccount] = provider.getWallets();

    mockConfig = await deployMockContract(owner, CONFIG.abi);

    oracleManager = await deployOracleManager(mockConfig, 18, 0);

    mockPriceRegistry = await deployMockContract(owner, PRICE_REGISTRY.abi);

    // await mockConfig.mock.protocolAddresses.withArgs("ora")
    await mockConfig.mock.quantRoles
      .withArgs("ORACLE_MANAGER_ROLE")
      .returns(ethers.utils.id("ORACLE_MANAGER_ROLE"));
    await mockConfig.mock.quantRoles
      .withArgs("FALLBACK_PRICE_ROLE")
      .returns(ethers.utils.id("FALLBACK_PRICE_ROLE"));
    await mockConfig.mock.quantRoles
      .withArgs("PRICE_SUBMITTER_ROLE")
      .returns(ethers.utils.id("PRICE_SUBMITTER_ROLE"));

    await mockConfig.mock.protocolAddresses
      .withArgs(ethers.utils.id("priceRegistry"))
      .returns(mockPriceRegistry.address);
  }

  describe(`ProviderOracleManager - ${testDescription}`, function () {
    beforeEach(async function () {
      await setUpTests();
    });

    it("Should allow the addition of asset oracles, get number of assets and fetch prices", async function () {
      await mockConfig.mock.hasRole.returns(true);

      expect(await oracleManager.getAssetsLength()).to.be.equal(0);

      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetOne, oracleOne)
      )
        .to.emit(oracleManager, "OracleAdded")
        .withArgs(assetOne, oracleOne);

      expect(await oracleManager.getAssetsLength()).to.be.equal(1);

      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetTwo, oracleTwo)
      )
        .to.emit(oracleManager, "OracleAdded")
        .withArgs(assetTwo, oracleTwo);

      expect(await oracleManager.getAssetsLength()).to.be.equal(2);

      expect(await oracleManager.assets(0)).to.be.equal(assetOne);
      expect(await oracleManager.assets(1)).to.be.equal(assetTwo);
      expect(await oracleManager.getAssetOracle(assetOne)).to.be.equal(
        oracleOne
      );
      expect(await oracleManager.getAssetOracle(assetTwo)).to.be.equal(
        oracleTwo
      );
      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetTwo, oracleTwo)
      ).to.be.revertedWith(
        "ProviderOracleManager: Oracle already set for asset"
      );
      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetTwo, oracleThree)
      ).to.be.revertedWith(
        "ProviderOracleManager: Oracle already set for asset"
      );
    });

    it("Should not allow a non oracle manager account to add an asset", async function () {
      await mockConfig.mock.hasRole.returns(false);

      expect(await oracleManager.getAssetsLength()).to.be.equal(0);
      await expect(
        oracleManager
          .connect(normalUserAccount)
          .addAssetOracle(assetOne, oracleOne)
      ).to.be.revertedWith(
        "ProviderOracleManager: Only an oracle admin can add an oracle"
      );
    });
  });
};

export const testChainlinkOracleManager = async (
  testDescription: string,
  deployOracleManager: (
    mockConfig: MockContract,
    strikeAssetDecimals: number,
    fallBackPriceInSeconds: number
  ) => Promise<ChainlinkOracleManager | ChainlinkFixedTimeOracleManager>
): Promise<void> => {
  let MockAggregatorProxy: ContractFactory;
  let mockAggregatorProxy: MockAggregatorProxy;
  let PriceRegistry: ContractFactory;
  let priceRegistry: PriceRegistry;
  let mockConfig: MockContract;
  let mockAggregator: MockContract;
  let mockAggregatorTwo: MockContract;
  let mockPriceRegistry: MockContract;
  let owner: Signer;
  let oracleManagerAccount: Signer;
  let fallbackPriceAccount: Signer;
  let normalUserAccount: Signer;
  let fallbackPriceAccountAddress: Address;
  let oracleManager: ChainlinkOracleManager | ChainlinkFixedTimeOracleManager;

  const assetOne = "0x0000000000000000000000000000000000000001";
  const assetTwo = "0x0000000000000000000000000000000000000002";
  const oracleOne = "0x0000000000000000000000000000000000000010";

  async function setUpTests() {
    [owner, oracleManagerAccount, normalUserAccount, fallbackPriceAccount] =
      provider.getWallets();

    mockConfig = await deployMockContract(owner, CONFIG.abi);

    oracleManager = await deployOracleManager(mockConfig, 18, 0);

    mockAggregator = await deployMockContract(owner, AGGREGATOR.abi);
    mockAggregatorTwo = await deployMockContract(owner, AGGREGATOR.abi);
    mockPriceRegistry = await deployMockContract(owner, PRICE_REGISTRY.abi);

    await mockConfig.mock.quantRoles
      .withArgs("ORACLE_MANAGER_ROLE")
      .returns(ethers.utils.id("ORACLE_MANAGER_ROLE"));
    await mockConfig.mock.quantRoles
      .withArgs("FALLBACK_PRICE_ROLE")
      .returns(ethers.utils.id("FALLBACK_PRICE_ROLE"));
    await mockConfig.mock.quantRoles
      .withArgs("PRICE_SUBMITTER_ROLE")
      .returns(ethers.utils.id("PRICE_SUBMITTER_ROLE"));

    await mockConfig.mock.protocolAddresses
      .withArgs(ethers.utils.id("priceRegistry"))
      .returns(mockPriceRegistry.address);

    fallbackPriceAccountAddress = await fallbackPriceAccount.getAddress();

    MockAggregatorProxy = await ethers.getContractFactory(
      "MockAggregatorProxy"
    );

    mockAggregatorProxy = <MockAggregatorProxy>(
      await MockAggregatorProxy.deploy()
    );

    PriceRegistry = await ethers.getContractFactory("PriceRegistry");

    priceRegistry = <PriceRegistry>(
      await PriceRegistry.deploy(mockConfig.address, 18)
    );
  }

  describe(`ChainlinkOracleManager - ${testDescription}`, function () {
    beforeEach(async () => {
      await setUpTests();
    });
    it("Fallback method should allow a fallback submitter to submit only after the fallback period", async function () {
      //time in the past
      const expiryTimestamp = Math.round(Date.now() / 1000) - 100;
      const price = 5000;

      await mockConfig.mock.hasRole.returns(true);

      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetOne, oracleOne)
      )
        .to.emit(oracleManager, "OracleAdded")
        .withArgs(assetOne, oracleOne);

      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(mockPriceRegistry.address);

      await mockPriceRegistry.mock.setSettlementPrice.returns();

      await expect(
        oracleManager
          .connect(fallbackPriceAccount)
          .setExpiryPriceInRegistryFallback(assetOne, expiryTimestamp, price)
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(
          assetOne,
          expiryTimestamp,
          price,
          0,
          fallbackPriceAccountAddress,
          true
        );

      await mockPriceRegistry.mock.setSettlementPrice.revertsWithReason(
        "PriceRegistry: Settlement price has already been set"
      );

      await expect(
        oracleManager
          .connect(fallbackPriceAccount)
          .setExpiryPriceInRegistryFallback(assetOne, expiryTimestamp, price)
      ).to.be.revertedWith(
        "PriceRegistry: Settlement price has already been set"
      );
    });

    it("Fallback method should not allow a fallback submitter to submit before the fallback period", async function () {
      const oracleManager = await deployOracleManager(mockConfig, 18, 5000);
      await oracleManager.deployed();

      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      await mockConfig.mock.hasRole.returns(true);

      await oracleManager.addAssetOracle(assetOne, oracleOne);

      await expect(
        oracleManager
          .connect(fallbackPriceAccount)
          .setExpiryPriceInRegistryFallback(
            assetOne,
            Math.round(Date.now() / 1000) + 3600,
            5000
          )
      ).to.be.revertedWith(
        "ChainlinkOracleManager: The fallback price period has not passed since the timestamp"
      );

      await mockConfig.mock.hasRole.returns(false);

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryFallback(assetOne, 10, 5000)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: Only the fallback price submitter can submit a fallback price"
      );
    });

    it("Should fetch the current price of the asset provided correctly", async function () {
      await mockAggregator.mock.latestAnswer.returns(0);
      await mockAggregatorTwo.mock.latestAnswer.returns(
        ethers.utils.parseUnits("2", 8)
      );

      await expect(
        oracleManager.getCurrentPrice(mockAggregator.address)
      ).to.be.revertedWith(
        "ProviderOracleManager: Oracle doesn't exist for that asset"
      );

      await mockConfig.mock.hasRole.returns(true);

      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetOne, mockAggregator.address)
      )
        .to.emit(oracleManager, "OracleAdded")
        .withArgs(assetOne, mockAggregator.address);

      await expect(
        oracleManager
          .connect(oracleManagerAccount)
          .addAssetOracle(assetTwo, mockAggregatorTwo.address)
      )
        .to.emit(oracleManager, "OracleAdded")
        .withArgs(assetTwo, mockAggregatorTwo.address);

      await expect(oracleManager.getCurrentPrice(assetOne)).to.be.revertedWith(
        "ChainlinkOracleManager: No pricing data available"
      );

      expect(await oracleManager.getCurrentPrice(assetTwo)).to.be.equal(
        ethers.utils.parseUnits("2", 18)
      );
    });

    it("Should fail to fetch the round if the latest timestamp is equal to the expiry timestamp", async function () {
      await mockConfig.mock.hasRole.returns(true);

      const expiryTimestamp = Math.round(Date.now() / 1000) - 100;

      await mockAggregatorProxy.setLatestTimestamp(expiryTimestamp);

      await oracleManager
        .connect(oracleManagerAccount)
        .addAssetOracle(assetOne, mockAggregatorProxy.address);

      expect(
        oracleManager.searchRoundToSubmit(assetOne, expiryTimestamp)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: The latest round timestamp is not after the expiry timestamp"
      );
    });

    it("Should not search if there is only 1 round of data", async function () {
      await mockConfig.mock.hasRole.returns(true);

      const expiryTimestamp = Math.round(Date.now() / 1000) - 100;

      await mockAggregatorProxy.setLatestTimestamp(expiryTimestamp + 1);
      await mockAggregatorProxy.setLatestRoundData({
        roundId: 1,
        answer: 1,
        startedAt: 1,
        updatedAt: 1,
        answeredInRound: 1,
      });

      await oracleManager
        .connect(oracleManagerAccount)
        .addAssetOracle(assetOne, mockAggregatorProxy.address);

      expect(
        oracleManager.searchRoundToSubmit(assetOne, expiryTimestamp)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: Not enough rounds to find round after"
      );
    });
  });
};
