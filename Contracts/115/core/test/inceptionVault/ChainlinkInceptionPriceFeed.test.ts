import { assert, expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { MockChainlinkAggregator, MockERC20 } from "../../typechain-types";
import { getTimestamp } from "../../utils/helper";

const { expectRevert } = require("@openzeppelin/test-helpers");
const { timeAndMine } = require("hardhat");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["Inception", "SetCore", "SetGovernance"]);

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainlinkInceptionPriceFeed = await ethers.getContract("ChainlinkInceptionPriceFeed");
  const addressProvider = await ethers.getContract("AddressProvider");
  const EUR_PRICE = 118033500; // 1 EUR = 1.18 USD
  const AAVE_PRICE = 44067433087; // 440 USD
  await deploy("AaveAggregator", {
    contract: "MockChainlinkAggregator",
    from: deployer,
    args: [8, AAVE_PRICE, "AAVE / USD"],
  });
  const assetOracle: MockChainlinkAggregator = await ethers.getContract("AaveAggregator");
  const inceptionCollateral: MockERC20 = await ethers.getContract("MockAAVE");
  await deploy("MockEurUsdAggregator", {
    contract: "MockChainlinkAggregator",
    from: deployer,
    args: [8, EUR_PRICE, "EUR / USD"],
  });
  const eurOracle: MockChainlinkAggregator = await ethers.getContract("MockEurUsdAggregator");
  // Await assetOracle.setUpdatedAt(latestTime);
  // await eurOracle.setUpdatedAt(latestTime);
  await chainlinkInceptionPriceFeed.initialize(
    addressProvider.address,
    inceptionCollateral.address,
    assetOracle.address,
    eurOracle.address,
  );

  return {
    chainlinkInceptionPriceFeed,
    assetOracle,
    eurOracle,
    EUR_PRICE,
    deploy,
    deployer,
    addressProvider,
    inceptionCollateral,
  };
});

before(async () => {
  await setup();
});

describe("--- ChainlinkInceptionPriceFeed ---", () => {
  describe("Get Asset Price", () => {
    it("should return correct asset price", async () => {
      const { chainlinkInceptionPriceFeed, assetOracle, eurOracle } = await setup();
      const assetOraclePrice = await assetOracle.latestRoundData();
      const eurPrice = await eurOracle.latestRoundData();
      const assetPrice = await chainlinkInceptionPriceFeed.getAssetPrice();
      expect(assetOraclePrice[1].toString()).to.be.equal("44067433087");
      expect(eurPrice[1].toString()).to.be.equal("118033500");
      expect(assetPrice.toString()).to.be.equal("37334683023"); // 373.346830239 EUR
    });
    it("should revert when the aggregater returns stale data", async () => {
      const { chainlinkInceptionPriceFeed, eurOracle } = await setup();
      await timeAndMine.increaseTime("1 week");
      await timeAndMine.mine(1);
      const latestTime = await getTimestamp();
      await eurOracle.setUpdatedAt(latestTime);
      await expectRevert(chainlinkInceptionPriceFeed.getAssetPrice(), "Price data is stale");
    });
    it("should revert when the EUR aggregater returns stale data", async () => {
      const { chainlinkInceptionPriceFeed } = await setup();
      await timeAndMine.increaseTime("1 week");
      await timeAndMine.mine(1);
      await expectRevert(chainlinkInceptionPriceFeed.getAssetPrice(), "EUR price data is stale");
    });
    it("should revert if eurOrcale price = 0", async () => {
      const { chainlinkInceptionPriceFeed, eurOracle } = await setup();
      await eurOracle.setLatestPrice(0);
      await expectRevert(chainlinkInceptionPriceFeed.getAssetPrice(), "EUR price data not valid");
    });
    it("should revert if assetOracle price = 0", async () => {
      const { chainlinkInceptionPriceFeed, assetOracle } = await setup();
      await assetOracle.setLatestPrice(0);
      await expectRevert(chainlinkInceptionPriceFeed.getAssetPrice(), "Price data not valid");
    });
  });
  describe("Convert", () => {
    it("should convert stablecoin to collateral", async () => {
      const { chainlinkInceptionPriceFeed, assetOracle, eurOracle } = await setup();
      await assetOracle.setLatestPrice(String(400e8)); // 1 ETH = 400 USD
      await eurOracle.setLatestPrice(String(1e8)); // 1 USD = 1 EUR
      const result = await chainlinkInceptionPriceFeed.convertTo(String(100e18)); // 100 PAR
      expect(result.toString()).to.equal(String(25e16)); // 100 PAR / 400 = 0.25 ETH
    });
    it("should convert collateral to stablecoin", async () => {
      const { chainlinkInceptionPriceFeed, assetOracle, eurOracle } = await setup();
      await assetOracle.setLatestPrice(String(400e8)); // 1 ETH = 400 USD
      await eurOracle.setLatestPrice(String(1e8)); // 1 USD = 1 EUR
      const result = await chainlinkInceptionPriceFeed.convertFrom(String(1e18)); // 100 ETH
      expect(result.toString()).to.equal(String(400e18)); // 100 PAR / 400 = 0.25 ETH
    });
    it("should convert collateral to stablecoin correctly accounting for different decimals in the oracles correctly", async () => {
      const { deploy, deployer, addressProvider, inceptionCollateral } = await setup();
      const aggregatorEUR = await deploy("AggregatorEUR", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [6, 1e6, "EUR / USD"],
      });
      const aggregatorAAVE = await deploy("AggregatorInceptionCollateral", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [8, 400e8, "AAVE / USD"],
      });
      await deploy("NewChainlinkInceptionPriceFeed", {
        contract: "ChainlinkInceptionPriceFeed",
        from: deployer,
        args: [],
      });
      const newChainlinInceptionPriceFeed = await ethers.getContract("NewChainlinkInceptionPriceFeed");
      await newChainlinInceptionPriceFeed.initialize(
        addressProvider.address,
        inceptionCollateral.address,
        aggregatorAAVE.address,
        aggregatorEUR.address,
      );
      const result = await newChainlinInceptionPriceFeed.convertFrom(String(1e18));
      assert.equal(result.toString(), String(400e18)); //
    });
    it("should convert collateral to stablecoin correctly accounting for different decimals in the oracles correctly", async () => {
      const { deploy, deployer, addressProvider, inceptionCollateral } = await setup();
      const aggregatorEUR = await deploy("AggregatorEUR", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [8, 1e8, "EUR / USD"],
      });
      const aggregatorAAVE = await deploy("AggregatorInceptionCollateral", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [6, 400e6, "AAVE / USD"],
      });
      await deploy("NewChainlinkInceptionPriceFeed", {
        contract: "ChainlinkInceptionPriceFeed",
        from: deployer,
        args: [],
      });
      const newChainlinInceptionPriceFeed = await ethers.getContract("NewChainlinkInceptionPriceFeed");
      await newChainlinInceptionPriceFeed.initialize(
        addressProvider.address,
        inceptionCollateral.address,
        aggregatorAAVE.address,
        aggregatorEUR.address,
      );
      const result = await newChainlinInceptionPriceFeed.convertFrom(String(1e18));
      assert.equal(result.toString(), String(400e18)); //
    });
    it("should handle ERC20 decimals of below 18 correctly", async () => {
      const { deploy, deployer, addressProvider } = await setup();
      const aggregatorEUR = await deploy("AggregatorEUR", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [6, "1250000", "EUR / USD"], // 1 EUR = 1.25 USD
      });
      const aggregatorWBTC = await deploy("AggregatorInceptionCollateral", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [8, 40000e8, "BTC / USD"], // 1 BTC = 40k USD
      });
      const wbtc = await deploy("WBTC", {
        contract: "MockERC20",
        from: deployer,
        args: ["Wrapped Bitcoin", "WBTC", 8],
      });
      await deploy("NewChainlinkInceptionPriceFeed", {
        contract: "ChainlinkInceptionPriceFeed",
        from: deployer,
        args: [],
      });
      const newChainlinInceptionPriceFeed = await ethers.getContract("NewChainlinkInceptionPriceFeed");
      await newChainlinInceptionPriceFeed.initialize(
        addressProvider.address,
        wbtc.address,
        aggregatorWBTC.address,
        aggregatorEUR.address,
      );
      const wbtc_amount = ethers.utils.parseUnits("1", 8); // 1 WBTC with 8 decimals
      const result1 = await newChainlinInceptionPriceFeed.convertFrom(wbtc_amount);
      const par_amount = ethers.utils.parseEther("32000"); // 32k PAR
      const result2 = await newChainlinInceptionPriceFeed.convertTo(par_amount);
      assert.equal(result1.toString(), par_amount.toString());
      assert.equal(result2.toString(), wbtc_amount.toString());
    });
    it("should handle ERC20 decimals above 18 correctly", async () => {
      const { deploy, deployer, addressProvider } = await setup();
      const aggregatorEUR = await deploy("AggregatorEUR", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [6, "1250000", "EUR / USD"], // 1 EUR = 1.25 USD
      });
      const aggregatorXRP = await deploy("AggregatorInceptionCollateral", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [8, 4e6, "XRP / USD"], // 1 BTC = 40k USD
      });
      const wxrp = await deploy("WXRP", {
        contract: "MockERC20",
        from: deployer,
        args: ["Wrapped XRP", "WXRP", "27"],
      });
      await deploy("NewChainlinkInceptionPriceFeed", {
        contract: "ChainlinkInceptionPriceFeed",
        from: deployer,
        args: [],
      });
      const newChainlinInceptionPriceFeed = await ethers.getContract("NewChainlinkInceptionPriceFeed");
      await newChainlinInceptionPriceFeed.initialize(
        addressProvider.address,
        wxrp.address,
        aggregatorXRP.address,
        aggregatorEUR.address,
      );
      const wxrp_amount = ethers.utils.parseUnits("1000", 27); // 1000 XRP with 8 decimals
      const result1 = await newChainlinInceptionPriceFeed.convertFrom(wxrp_amount);
      const par_amount = ethers.utils.parseEther("32");
      const result2 = await newChainlinInceptionPriceFeed.convertTo(par_amount);
      assert.equal(result1.toString(), par_amount.toString());
      assert.equal(result2.toString(), wxrp_amount.toString());
    });
  });
});
