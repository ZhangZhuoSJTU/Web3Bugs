const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");

describe("PairsContract", function () {

  let pairscontract;

  let owner;
  let trader;
  let user;
  let Trading;
  let TradingExtension;
  let StableToken;
  let NewTrading;
  let ChainlinkFeed;

  beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, trader, user, NewTrading, ChainlinkFeed] = await ethers.getSigners();
    Trading = await deployments.get("Trading");
    TradingExtension = await deployments.get("TradingExtension");
    StableToken = await deployments.get("StableToken");
    const PairsContract = await deployments.get("PairsContract");
    pairscontract = await ethers.getContractAt("PairsContract", PairsContract.address);
  });

  describe("Check onlyOwner", function () {
    it("Non-owner setting a chainlink price feed should revert", async function () {
      await expect(pairscontract.connect(user).setAssetChainlinkFeed(0, ChainlinkFeed.address)).to.be.revertedWith("Ownable");
    });
    it("Non-owner adding an asset should revert", async function () {
      await expect(pairscontract.connect(user).addAsset(99, "XYZ/ABC", ChainlinkFeed.address, 0, 0, 0, 0)).to.be.revertedWith("Ownable");
    });
    it("Non-owner updating asset leverage should revert", async function () {
      await expect(pairscontract.connect(user).updateAssetLeverage(0, 0, 0)).to.be.revertedWith("Ownable");
    });
    it("Non-owner setting asset base funding rate should revert", async function () {
      await expect(pairscontract.connect(user).setAssetBaseFundingRate(0, 0)).to.be.revertedWith("Ownable");
    });
    it("Non-owner setting asset fee multiplier should revert", async function () {
      await expect(pairscontract.connect(user).updateAssetFeeMultiplier(0, 0)).to.be.revertedWith("Ownable");
    });
    it("Non-owner pausing an asset should revert", async function () {
      await expect(pairscontract.connect(user).pauseAsset(0, true)).to.be.revertedWith("Ownable");
    });
    it("Non-owner setting max funding rate should revert", async function () {
      await expect(pairscontract.connect(user).setMaxBaseFundingRate(0)).to.be.revertedWith("Ownable");
    });
    it("Non-owner setting protocol should revert", async function () {
      await expect(pairscontract.connect(user).setProtocol(user.address)).to.be.revertedWith("Ownable");
    });
    it("Non-owner setting max open interest should revert", async function () {
      await expect(pairscontract.connect(user).setMaxOi(0, StableToken.address, 0)).to.be.revertedWith("Ownable");
    });
  });

  describe("Deployment", function () {
    it("Should deploy with expected state", async function () {
      expect(await pairscontract.protocol()).to.equal(TradingExtension.address);
    });
  });

  describe("Asset functions", function () {
    it("Owner adding an asset with no name should revert", async function () {
      await expect(pairscontract.connect(owner).addAsset(99, "", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9)).to.be.revertedWith("No name");
    });
    it("Owner adding an asset with min leverage higher than max leverage should revert", async function() {
      await expect(pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("100"), ethers.utils.parseEther("1"), 1e10, 3e9)).to.be.revertedWith("Wrong leverage values");
    });
    it("Owner adding an asset with min leverage zero should revert", async function() {
      await expect(pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("0"), ethers.utils.parseEther("100"), 1e10, 3e9)).to.be.revertedWith("Wrong leverage values");
    });
    it("Owner attempting to add a new asset with the same ID as an existing asset should revert", async function () {
      await expect(pairscontract.connect(owner).addAsset(0, "BTC/USD", ethers.constants.AddressZero, ethers.utils.parseEther("2"), ethers.utils.parseEther("150"), 1e10, 3e9)).to.be.revertedWith("Already exists");
    });    
    it("Owner adding an asset should add the asset with correct values", async function() {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ChainlinkFeed.address, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      let [name, chainlinkFeed, minLeverage, maxLeverage, feeMultiplier, baseFundingRate] = await pairscontract.idToAsset(99);
      expect(await name).to.equal("XYZ/ABC");
      expect(await chainlinkFeed).to.equal(ChainlinkFeed.address);
      expect(await minLeverage).to.equal(ethers.utils.parseEther("1"));
      expect(await maxLeverage).to.equal(ethers.utils.parseEther("100"));
      expect(await feeMultiplier).to.equal(1e10);
      expect(await baseFundingRate).to.equal(3e9);
      expect(await pairscontract.allowedAsset(99)).to.equal(true);
    });
    it("Owner updating a non-existing asset's Chainlink price feed address should revert", async function () {
      await expect(pairscontract.connect(owner).setAssetChainlinkFeed(99, ChainlinkFeed.address)).to.be.revertedWith("!Asset");
    });
    it("Owner updating a non-existing asset's min and max leverage should revert", async function () {
      await expect(pairscontract.connect(owner).updateAssetLeverage(99, ethers.utils.parseEther("2"), ethers.utils.parseEther("50"))).to.be.revertedWith("!Asset");
    });
    it("Owner updating a non-existing asset's fee multiplier should revert", async function () {
      await expect(pairscontract.connect(owner).updateAssetFeeMultiplier(99, 5000)).to.be.revertedWith("!Asset");
    });
    it("Owner updating a non-existing asset's base funding rate should revert", async function () {
      await expect(pairscontract.connect(owner).setAssetBaseFundingRate(99, 1000)).to.be.revertedWith("!Asset");
    });
    it("Owner setting an asset's base funding rate too high should revert", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await expect(pairscontract.connect(owner).setAssetBaseFundingRate(99, 1e10+1)).to.be.revertedWith("baseFundingRate too high");
    });
    it("Owner setting an asset's base funding rate should set it to the expected amount", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setAssetBaseFundingRate(99, 1e10);
      let [,,,,,baseFundingRate] = await pairscontract.idToAsset(99);
      expect(baseFundingRate).to.equal(1e10);
    });
    it("Owner setting max base funding rate should set it to the expected amount", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await expect(pairscontract.connect(owner).setAssetBaseFundingRate(99, 1e10+1)).to.be.revertedWith("baseFundingRate too high");
      await pairscontract.connect(owner).setMaxBaseFundingRate(1e10+1);
      await pairscontract.connect(owner).setAssetBaseFundingRate(99, 1e10+1);
      let [,,,,,baseFundingRate] = await pairscontract.idToAsset(99);
      expect(baseFundingRate).to.equal(1e10+1);
    });
    it("Owner updating an existing asset's Chainlink price feed", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setAssetChainlinkFeed(99, ChainlinkFeed.address);
      let [,chainlinkFeed,,,,] = await pairscontract.idToAsset(99);
      expect(chainlinkFeed).to.equal(ChainlinkFeed.address);
    });
    it("Owner updating an asset's min and max leverage should revert if min>max", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await expect(pairscontract.connect(owner).updateAssetLeverage(99, ethers.utils.parseEther("100"), ethers.utils.parseEther("50"))).to.be.revertedWith("Wrong leverage values");
    });    
    it("Owner updating an existing asset's min and max leverage", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).updateAssetLeverage(99, ethers.utils.parseEther("2"), ethers.utils.parseEther("50"));
      let [,,minLeverage, maxLeverage,,] = await pairscontract.idToAsset(99);
      expect(minLeverage).to.equal(ethers.utils.parseEther("2"));
      expect(maxLeverage).to.equal(ethers.utils.parseEther("50"));
    });
    it("Owner updating an existing asset's min and max leverage with values zero shouldn't change leverage values", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).updateAssetLeverage(99, ethers.utils.parseEther("0"), ethers.utils.parseEther("0"));
      let [,,minLeverage, maxLeverage,,] = await pairscontract.idToAsset(99);
      expect(minLeverage).to.equal(ethers.utils.parseEther("1"));
      expect(maxLeverage).to.equal(ethers.utils.parseEther("100"));
    });
    it("Owner updating an existing asset's fee multiplier", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).updateAssetFeeMultiplier(99, 5000);
      let [,,,, feeMultiplier,] = await pairscontract.idToAsset(99);
      expect(feeMultiplier).to.equal(5000);
    });
    it("Owner pausing a non-existing asset should revert", async function () {
      await expect(pairscontract.connect(owner).pauseAsset(99, true)).to.be.revertedWith("!Asset");
    });
    it("Owner pausing an existing asset", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).pauseAsset(99, true);
      expect(await pairscontract.allowedAsset(99)).to.equal(false);
      await pairscontract.connect(owner).pauseAsset(99, false);
      expect(await pairscontract.allowedAsset(99)).to.equal(true);
    });
    it("Owner setting max open interest of a non-existing asset should revert", async function () {
      await expect(pairscontract.connect(owner).setMaxOi(99, StableToken.address, 1)).to.be.revertedWith("!Asset");
    });
  });

  describe("Protocol-only functions", function () {
    it("Only trading contract should change open interest", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setProtocol(NewTrading.address);
      await expect(pairscontract.connect(owner).modifyLongOi(99, StableToken.address, true, 1000)).to.be.revertedWith("!Protocol");
      await expect(pairscontract.connect(owner).modifyShortOi(99, StableToken.address, true, 1000)).to.be.revertedWith("!Protocol");
    });
    it("Trading contract should increase and decrease open interest the expected amount", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setProtocol(NewTrading.address);
      await pairscontract.connect(NewTrading).modifyLongOi(99, StableToken.address, true, ethers.utils.parseEther("500"));
      await pairscontract.connect(NewTrading).modifyShortOi(99, StableToken.address, true, ethers.utils.parseEther("2000"));
      let [longOi,shortOi] = await pairscontract.idToOi(99, StableToken.address);
      expect(longOi).to.equal(ethers.utils.parseEther("500"));
      expect(shortOi).to.equal(ethers.utils.parseEther("2000"));
      await pairscontract.connect(NewTrading).modifyLongOi(99, StableToken.address, false, ethers.utils.parseEther("300"));
      await pairscontract.connect(NewTrading).modifyShortOi(99, StableToken.address, false, ethers.utils.parseEther("1000"));
      [longOi,shortOi] = await pairscontract.idToOi(99, StableToken.address);
      expect(longOi).to.equal(ethers.utils.parseEther("200"));
      expect(shortOi).to.equal(ethers.utils.parseEther("1000"));
    });
    it("Trading contract should increase and decrease open interest the expected amount with capped OI", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setMaxOi(99, StableToken.address, ethers.utils.parseEther("1000000"));
      await pairscontract.connect(owner).setProtocol(NewTrading.address);
      await pairscontract.connect(NewTrading).modifyLongOi(99, StableToken.address, true, ethers.utils.parseEther("500"));
      await pairscontract.connect(NewTrading).modifyShortOi(99, StableToken.address, true, ethers.utils.parseEther("2000"));
      let [longOi,shortOi] = await pairscontract.idToOi(99, StableToken.address);
      expect(longOi).to.equal(ethers.utils.parseEther("500"));
      expect(shortOi).to.equal(ethers.utils.parseEther("2000"));
      await pairscontract.connect(NewTrading).modifyLongOi(99, StableToken.address, false, ethers.utils.parseEther("300"));
      await pairscontract.connect(NewTrading).modifyShortOi(99, StableToken.address, false, ethers.utils.parseEther("1000"));
      [longOi,shortOi] = await pairscontract.idToOi(99, StableToken.address);
      expect(longOi).to.equal(ethers.utils.parseEther("200"));
      expect(shortOi).to.equal(ethers.utils.parseEther("1000"));
    });
    it("Adding long open interest past max open interest limit should revert", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setProtocol(NewTrading.address);
      await pairscontract.connect(owner).setMaxOi(99, StableToken.address, 1);
      await expect(pairscontract.connect(NewTrading).modifyLongOi(99, StableToken.address, true, 1000)).to.be.revertedWith("MaxLongOi");
    });
    it("Adding short open interest past max open interest limit should revert", async function () {
      await pairscontract.connect(owner).addAsset(99, "XYZ/ABC", ethers.constants.AddressZero, ethers.utils.parseEther("1"), ethers.utils.parseEther("100"), 1e10, 3e9);
      await pairscontract.connect(owner).setProtocol(NewTrading.address);
      await pairscontract.connect(owner).setMaxOi(99, StableToken.address, 1);
      await expect(pairscontract.connect(NewTrading).modifyShortOi(99, StableToken.address, true, 1000)).to.be.revertedWith("MaxShortOi");
    });
  });
});
