import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { MockContract } from "ethereum-waffle";
import { BigNumber, ContractFactory, Signer } from "ethers";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";
import { beforeEach, describe } from "mocha";
import PRICE_REGISTRY from "../artifacts/contracts/pricing/PriceRegistry.sol/PriceRegistry.json";
import CONFIG from "../artifacts/contracts/QuantConfig.sol/QuantConfig.json";
import {
  ChainlinkFixedTimeOracleManager,
  ChainlinkOracleManager,
  MockAggregatorProxy,
  PriceRegistry,
} from "../typechain";
import { expect, provider } from "./setup";
import {
  testChainlinkOracleManager,
  testProviderOracleManager,
} from "./testOracleManagers";

describe("Chainlink Oracle Manager", async function () {
  let ChainlinkOracleManager: ContractFactory;
  let chainlinkOracleManager: ChainlinkOracleManager;
  let MockAggregatorProxy: ContractFactory;
  let mockAggregatorProxy: MockAggregatorProxy;
  let PriceRegistry: ContractFactory;
  let priceRegistry: PriceRegistry;
  let mockConfig: MockContract;
  let mockPriceRegistry: MockContract;
  let owner: Signer;
  let oracleManagerAccount: Signer;
  let normalUserAccount: Signer;
  let normalUserAccountAddress: Address;

  const assetOne = "0x0000000000000000000000000000000000000001";
  const assetTwo = "0x0000000000000000000000000000000000000002";

  async function setUpTests() {
    [owner, oracleManagerAccount, normalUserAccount] = provider.getWallets();

    mockConfig = await deployMockContract(owner, CONFIG.abi);
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

    normalUserAccountAddress = await normalUserAccount.getAddress();

    ChainlinkOracleManager = await ethers.getContractFactory(
      "ChainlinkOracleManager"
    );

    chainlinkOracleManager = <ChainlinkOracleManager>(
      await ChainlinkOracleManager.deploy(mockConfig.address, 6, 0)
    );

    MockAggregatorProxy = await ethers.getContractFactory(
      "MockAggregatorProxy"
    );

    mockAggregatorProxy = <MockAggregatorProxy>(
      await MockAggregatorProxy.deploy()
    );

    PriceRegistry = await ethers.getContractFactory("PriceRegistry");

    priceRegistry = <PriceRegistry>(
      await PriceRegistry.deploy(mockConfig.address, 6)
    );
  }

  beforeEach(async function () {
    await setUpTests();
  });

  const deployChainlinkOracleManager = async (
    mockConfig: MockContract,
    strikeAssetDecimals: number,
    fallBackPriceInSeconds: number
  ): Promise<ChainlinkOracleManager> => {
    ChainlinkOracleManager = await ethers.getContractFactory(
      "ChainlinkOracleManager"
    );

    chainlinkOracleManager = <ChainlinkOracleManager>(
      await ChainlinkOracleManager.deploy(
        mockConfig.address,
        strikeAssetDecimals,
        fallBackPriceInSeconds
      )
    );

    return chainlinkOracleManager;
  };

  const deployChainlinkFixedTimeOracleManager = async (
    mockConfig: MockContract,
    strikeAssetDecimals: number,
    fallBackPriceInSeconds: number
  ): Promise<ChainlinkFixedTimeOracleManager> => {
    const ChainlinkFixedTimeOracleManager = await ethers.getContractFactory(
      "ChainlinkFixedTimeOracleManager"
    );

    const chainlinkFixedTimeOracleManager = <ChainlinkFixedTimeOracleManager>(
      await ChainlinkFixedTimeOracleManager.deploy(
        mockConfig.address,
        strikeAssetDecimals,
        fallBackPriceInSeconds
      )
    );

    return chainlinkFixedTimeOracleManager;
  };

  const setUpTestWithMockAggregator = async (
    deployOracleManager: (
      mockConfig: MockContract,
      strikeAssetDecimals: number,
      fallBackPriceInSeconds: number
    ) => Promise<ChainlinkOracleManager | ChainlinkFixedTimeOracleManager>,
    mockConfig: MockContract,
    strikeAssetDecimals: number,
    fallBackPriceInSeconds: number
  ): Promise<ChainlinkOracleManager | ChainlinkFixedTimeOracleManager> => {
    const oracleManager = await deployOracleManager(
      mockConfig,
      strikeAssetDecimals,
      fallBackPriceInSeconds
    );
    await mockConfig.mock.hasRole.returns(true);

    await mockAggregatorProxy.setLatestTimestamp(51);
    await mockAggregatorProxy.setLatestRoundData({
      roundId: 4,
      answer: 1,
      startedAt: 1,
      updatedAt: 1,
      answeredInRound: 1,
    });

    await mockAggregatorProxy.setLatestRound(4);

    await mockAggregatorProxy.setTimestamp(0, 10);
    await mockAggregatorProxy.setTimestamp(1, 20);
    await mockAggregatorProxy.setTimestamp(2, 30);
    await mockAggregatorProxy.setTimestamp(3, 40);
    await mockAggregatorProxy.setTimestamp(4, 50);
    await mockAggregatorProxy.setLatestAnswer(42001);

    //set the price of the round that'll get picked
    await mockAggregatorProxy.setRoundIdAnswer(2, 42001);

    await oracleManager
      .connect(oracleManagerAccount)
      .addAssetOracle(assetOne, mockAggregatorProxy.address);

    return oracleManager;
  };

  describe("ChainlinkOracleManager", () => {
    it("Should search timestamps successfully and return the round after the timestamp passed", async function () {
      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkOracleManager,
        mockConfig,
        6,
        0
      );

      expect(await oracleManager.searchRoundToSubmit(assetOne, 32)).to.be.equal(
        3
      );

      expect(await oracleManager.searchRoundToSubmit(assetOne, 40)).to.be.equal(
        4
      );
    });

    it("Integration Test: Should submit the correct price to the price registry", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkOracleManager,
        mockConfig,
        6,
        0
      );

      //price should not be set initially
      await expect(
        priceRegistry.getSettlementPrice(oracleManager.address, assetOne, 32)
      ).to.be.revertedWith("PriceRegistry: No settlement price has been set");

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistry(assetOne, 32, ethers.utils.randomBytes(32))
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(assetOne, 32, 42001, 2, normalUserAccountAddress, false);

      //price should be set after we set it through the oracle (with loss of precision when casting to 6 decimals)
      expect(
        await priceRegistry.getSettlementPrice(
          oracleManager.address,
          assetOne,
          32
        )
      ).to.equal(420);

      //price should be set after we set it through the oracle with full precision
      const priceWithDecimals =
        await priceRegistry.getSettlementPriceWithDecimals(
          oracleManager.address,
          assetOne,
          32
        );

      expect(priceWithDecimals[0]).to.equal(BigNumber.from("42001"));
      expect(priceWithDecimals[1]).to.equal(BigNumber.from("8"));
    });

    it("Integration Test: Should submit the correct price to the price registry when submitting a round directly", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkOracleManager,
        mockConfig,
        6,
        0
      );

      //price should not be set initially
      await expect(
        priceRegistry.getSettlementPrice(oracleManager.address, assetOne, 32)
      ).to.be.revertedWith("PriceRegistry: No settlement price has been set");

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetOne, 32, 3)
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(assetOne, 32, 42001, 2, normalUserAccountAddress, false);

      //price should be set after we set it through the oracle (with loss of precision when casting to 6 decimals)
      expect(
        await priceRegistry.getSettlementPrice(
          oracleManager.address,
          assetOne,
          32
        )
      ).to.equal(420);

      //price should be set after we set it through the oracle with full precision
      const priceWithDecimals =
        await priceRegistry.getSettlementPriceWithDecimals(
          oracleManager.address,
          assetOne,
          32
        );

      expect(priceWithDecimals[0]).to.equal(BigNumber.from("42001"));
      expect(priceWithDecimals[1]).to.equal(BigNumber.from("8"));

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetOne, 22, 1)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: The round posted is not after the expiry timestamp"
      );

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetOne, 10, 4)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: Expiry round prior to the one posted is after the expiry timestamp"
      );
    });

    it("Integration Test: Should fail to submit a round for an asset that doesn't exist in the oracle", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkOracleManager,
        mockConfig,
        6,
        0
      );

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetTwo, 22, 1)
      ).to.be.revertedWith(
        "ProviderOracleManager: Oracle doesn't exist for that asset"
      );
    });

    it("Integration Test: Should submit the correct price to the price registry when there's a price submission at exactly the given timestamp", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkOracleManager,
        mockConfig,
        6,
        0
      );

      //price should not be set initially
      await expect(
        priceRegistry.getSettlementPrice(oracleManager.address, assetOne, 30)
      ).to.be.revertedWith("PriceRegistry: No settlement price has been set");

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistry(assetOne, 30, ethers.utils.randomBytes(22))
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(assetOne, 30, 42001, 2, normalUserAccountAddress, false);

      //price should be set after we set it through the oracle (with loss of precision when casting to 6 decimals)
      expect(
        await priceRegistry.getSettlementPrice(
          oracleManager.address,
          assetOne,
          30
        )
      ).to.equal(420);

      //price should be set after we set it through the oracle with full precision
      const priceWithDecimals =
        await priceRegistry.getSettlementPriceWithDecimals(
          oracleManager.address,
          assetOne,
          30
        );

      expect(priceWithDecimals[0]).to.equal(BigNumber.from("42001"));
      expect(priceWithDecimals[1]).to.equal(BigNumber.from("8"));
    });

    it("Should pass the ProviderOracleManager tests", async () => {
      await testProviderOracleManager(
        "Regular ChainlinkOracleManager",
        deployChainlinkOracleManager
      );
    });

    it("Should pass the ChainlinkOracleManager tests", async () => {
      await testChainlinkOracleManager(
        "Regular ChainlinkOracleManager",
        deployChainlinkOracleManager
      );
    });

    describe("isValidOption", () => {
      it("Should return true regardless of the parameters that are passed", async () => {
        const oracleManager = <ChainlinkOracleManager>(
          await setUpTestWithMockAggregator(
            deployChainlinkOracleManager,
            mockConfig,
            6,
            0
          )
        );

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            ethers.constants.Zero,
            ethers.constants.Zero
          )
        ).to.equal(true);

        expect(
          await oracleManager.isValidOption(
            ethers.Wallet.createRandom().address,
            Math.floor(Math.random() * 1000000 + 1),
            Math.floor(Math.random() * 1000000 + 1)
          )
        ).to.equal(true);
      });
    });
  });

  describe("ChainlinkFixedTimeOracleManager", () => {
    it("Should search timestamps successfully and return the round after the timestamp passed", async function () {
      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkFixedTimeOracleManager,
        mockConfig,
        6,
        0
      );

      expect(await oracleManager.searchRoundToSubmit(assetOne, 32)).to.be.equal(
        3
      );

      expect(await oracleManager.searchRoundToSubmit(assetOne, 40)).to.be.equal(
        4
      );
    });
    it("Integration Test: Should submit the correct price to the price registry", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkFixedTimeOracleManager,
        mockConfig,
        6,
        0
      );

      //price should not be set initially
      await expect(
        priceRegistry.getSettlementPrice(oracleManager.address, assetOne, 22)
      ).to.be.revertedWith("PriceRegistry: No settlement price has been set");

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistry(assetOne, 22, ethers.utils.randomBytes(22))
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(assetOne, 22, 42001, 2, normalUserAccountAddress, false);

      //price should be set after we set it through the oracle (with loss of precision when casting to 6 decimals)
      expect(
        await priceRegistry.getSettlementPrice(
          oracleManager.address,
          assetOne,
          22
        )
      ).to.equal(420);

      //price should be set after we set it through the oracle with full precision
      const priceWithDecimals =
        await priceRegistry.getSettlementPriceWithDecimals(
          oracleManager.address,
          assetOne,
          22
        );

      expect(priceWithDecimals[0]).to.equal(BigNumber.from("42001"));
      expect(priceWithDecimals[1]).to.equal(BigNumber.from("8"));
    });

    it("Integration Test: Should submit the correct price to the price registry when submitting a round directly", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkFixedTimeOracleManager,
        mockConfig,
        6,
        0
      );

      //price should not be set initially
      await expect(
        priceRegistry.getSettlementPrice(oracleManager.address, assetOne, 22)
      ).to.be.revertedWith("PriceRegistry: No settlement price has been set");

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetOne, 22, 2)
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(assetOne, 22, 42001, 2, normalUserAccountAddress, false);

      //price should be set after we set it through the oracle (with loss of precision when casting to 6 decimals)
      expect(
        await priceRegistry.getSettlementPrice(
          oracleManager.address,
          assetOne,
          22
        )
      ).to.equal(420);

      //price should be set after we set it through the oracle with full precision
      const priceWithDecimals =
        await priceRegistry.getSettlementPriceWithDecimals(
          oracleManager.address,
          assetOne,
          22
        );

      expect(priceWithDecimals[0]).to.equal(BigNumber.from("42001"));
      expect(priceWithDecimals[1]).to.equal(BigNumber.from("8"));

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetOne, 22, 1)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: The round posted is not after the expiry timestamp"
      );

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetOne, 10, 4)
      ).to.be.revertedWith(
        "ChainlinkOracleManager: Expiry round prior to the one posted is after the expiry timestamp"
      );
    });

    it("Integration Test: Should fail to submit a round for an asset that doesn't exist in the oracle", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkFixedTimeOracleManager,
        mockConfig,
        6,
        0
      );

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistryByRound(assetTwo, 22, 1)
      ).to.be.revertedWith(
        "ProviderOracleManager: Oracle doesn't exist for that asset"
      );
    });

    it("Integration Test: Should submit the correct price to the price registry when there's a price submission at exactly the given timestamp", async function () {
      //use the real price registry instead of the mock
      await mockConfig.mock.protocolAddresses
        .withArgs(ethers.utils.id("priceRegistry"))
        .returns(priceRegistry.address);

      const oracleManager = await setUpTestWithMockAggregator(
        deployChainlinkFixedTimeOracleManager,
        mockConfig,
        6,
        0
      );

      //price should not be set initially
      await expect(
        priceRegistry.getSettlementPrice(oracleManager.address, assetOne, 30)
      ).to.be.revertedWith("PriceRegistry: No settlement price has been set");

      await expect(
        oracleManager
          .connect(normalUserAccount)
          .setExpiryPriceInRegistry(assetOne, 30, ethers.utils.randomBytes(22))
      )
        .to.emit(oracleManager, "PriceRegistrySubmission")
        .withArgs(assetOne, 30, 42001, 2, normalUserAccountAddress, false);

      //price should be set after we set it through the oracle (with loss of precision when casting to 6 decimals)
      expect(
        await priceRegistry.getSettlementPrice(
          oracleManager.address,
          assetOne,
          30
        )
      ).to.equal(420);

      //price should be set after we set it through the oracle with full precision
      const priceWithDecimals =
        await priceRegistry.getSettlementPriceWithDecimals(
          oracleManager.address,
          assetOne,
          30
        );

      expect(priceWithDecimals[0]).to.equal(BigNumber.from("42001"));
      expect(priceWithDecimals[1]).to.equal(BigNumber.from("8"));
    });

    describe("isValidOption", () => {
      let oracleManager: ChainlinkFixedTimeOracleManager;

      const fixedTimeUpdate = 28800; // 8 A.M.

      beforeEach(async () => {
        oracleManager = <ChainlinkFixedTimeOracleManager>(
          await setUpTestWithMockAggregator(
            deployChainlinkFixedTimeOracleManager,
            mockConfig,
            6,
            0
          )
        );
      });

      it("Should revert when an accout without the oracle manager role tries to add a valid fixed time for updates", async () => {
        await mockConfig.mock.hasRole.returns(false);
        await expect(
          oracleManager
            .connect(normalUserAccount)
            .setFixedTimeUpdate(fixedTimeUpdate, true)
        ).to.be.revertedWith(
          "ChainlinkFixedTimeOracleManager: Only an oracle admin can add a fixed time for updates"
        );
      });
      it("Should allow the addition of valid option expiry timestamps", async () => {
        const firstValidExpiry = 2412144000; // Sat Jun 09 2046 08:00:00 GMT+0000
        const secondValidExpiry = 2412230400; // Sun Jun 10 2046 08:00:00 GMT+0000
        const invalidExpiry = 2412165600; // Sat Jun 09 2046 14:00:00 GMT+0000

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            firstValidExpiry,
            ethers.constants.Zero
          )
        ).to.equal(false);

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            secondValidExpiry,
            ethers.constants.Zero
          )
        ).to.equal(false);

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            invalidExpiry,
            ethers.constants.Zero
          )
        ).to.equal(false);

        // Add 8 A.M. to the chainlinkFixedTimeUpdates mapping
        await oracleManager
          .connect(oracleManagerAccount)
          .setFixedTimeUpdate(fixedTimeUpdate, true);

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            firstValidExpiry,
            ethers.constants.Zero
          )
        ).to.equal(true);

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            secondValidExpiry,
            ethers.constants.Zero
          )
        ).to.equal(true);

        expect(
          await oracleManager.isValidOption(
            ethers.constants.AddressZero,
            invalidExpiry,
            ethers.constants.Zero
          )
        ).to.equal(false);
      });

      it("Should pass the ProviderOracleManager tests", async () => {
        await testProviderOracleManager(
          "ChainlinkFixedTimeOracleManager",
          deployChainlinkFixedTimeOracleManager
        );
      });
      it("Should pass the ChainlinkOracleManager tests", async () => {
        await testChainlinkOracleManager(
          "ChainlinkFixedTimeOracleManager",
          deployChainlinkFixedTimeOracleManager
        );
      });
    });
  });
});
