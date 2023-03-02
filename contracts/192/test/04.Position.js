const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");
const { parseEther } = ethers.utils;

describe("Position", function () {

  let position;

  let owner;
  let user;

  let StableToken;

  let Minter;

  beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, node, user, Minter] = await ethers.getSigners();
    StableToken = await deployments.get("StableToken");
    const Position = await deployments.get("Position");
    position = await ethers.getContractAt("Position", Position.address);
    await position.connect(owner).setMinter(Minter.address, true);
  });

  describe("Permissioned functions", function () {
    it("Non-minter calling mint should revert", async function () {
      await expect(position.connect(user).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          0,
          0,
          0,
          StableToken.address
        ]
      )).to.be.revertedWith("!Minter");
    });
    it("Non-owner setting baseURI should revert", async function () {
      await expect(position.connect(user).setBaseURI("")).to.be.revertedWith("Ownable");
    });
    it("Non-owner setting minter should revert", async function () {
      await expect(position.connect(user).setMinter(user.address, true)).to.be.revertedWith("Ownable");
    });
    it("Non-minter calling executeLimitOrder should revert", async function () {
      await expect(position.connect(user).executeLimitOrder(0, 0, 0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling modifyMargin should revert", async function () {
      await expect(position.connect(user).modifyMargin(0, 0, 0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling addToPosition should revert", async function () {
      await expect(position.connect(user).addToPosition(0, 0, 0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling setAccInterest should revert", async function () {
      await expect(position.connect(user).setAccInterest(0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling reducePosition should revert", async function () {
      await expect(position.connect(user).reducePosition(0, 0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling modifyTp should revert", async function () {
      await expect(position.connect(user).modifyTp(0, 0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling modifySl should revert", async function () {
      await expect(position.connect(user).modifySl(0, 0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling burn should revert", async function () {
      await expect(position.connect(user).burn(0)).to.be.revertedWith("!Minter");
    });
    it("Non-minter calling updateFunding should revert", async function () {
      await expect(position.connect(user).updateFunding(0, StableToken.address, 0, 0, 0, 0)).to.be.revertedWith("!Minter");
    });
  });
  describe("Setters", function () {
    it("Owner setting minter should set minter", async function () {
      expect(await position.isMinter(Minter.address)).to.equal(true);
    });
  });
  describe("Mint function", function () {
    it("Minting a market open position should place it in expected mappings and arrays and have correct values", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      let [_trade] = await position.openPositions();
      expect(_trade).to.equal(1);
      expect(await position.openPositionsIndexes(_trade)).to.equal(0);
      let [_assetTrade] = await position.assetOpenPositions(0);
      expect(_assetTrade).to.equal(1);
      expect(await position.assetOpenPositionsIndexes(0, _trade)).to.equal(0);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
      let [margin, leverage, asset, direction, price, tpPrice, slPrice, orderType, trader, id, tigAsset, accInterest] = await position.trades(1);
      expect(margin).to.equal(1000);
      expect(leverage).to.equal(1000);
      expect(asset).to.equal(0);
      expect(direction).to.equal(true);
      expect(price).to.equal(10000);
      expect(tpPrice).to.equal(11000);
      expect(slPrice).to.equal(9000);
      expect(orderType).to.equal(0);
      expect(trader).to.equal(user.address);
      expect(id).to.equal(1);
      expect(tigAsset).to.equal(StableToken.address);
      expect(accInterest).to.equal(0);
    });
    it("Minting a limit position should place it in expected mappings and arrays and have correct values", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          1,
          StableToken.address
        ]
      );
      let [_trade] = await position.limitOrders(0);
      expect(_trade).to.equal(1);
      expect(await position.limitOrderIndexes(0, _trade)).to.equal(0);
      expect(await position.limitOrdersLength(0)).to.equal(1);
      let [margin, leverage, asset, direction, price, tpPrice, slPrice, orderType, trader, id, tigAsset, accInterest] = await position.trades(1);
      expect(margin).to.equal(1000);
      expect(leverage).to.equal(1000);
      expect(asset).to.equal(0);
      expect(direction).to.equal(true);
      expect(price).to.equal(10000);
      expect(tpPrice).to.equal(11000);
      expect(slPrice).to.equal(9000);
      expect(orderType).to.equal(1);
      expect(trader).to.equal(user.address);
      expect(id).to.equal(1);
      expect(tigAsset).to.equal(StableToken.address);
      expect(accInterest).to.equal(0);
    });
  });
  describe("Executing limit order", function () {
    it("Should move position from limit order array to open position array correctly and set expected values", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          1,
          StableToken.address
        ]
      );
      expect(await position.limitOrdersLength(0)).to.equal(1);
      expect(await position.assetOpenPositionsLength(0)).to.equal(0);
      await position.connect(Minter).executeLimitOrder(
        1,
        9500,
        995
      );
      let [_trade] = await position.openPositions();
      expect(_trade).to.equal(1);
      expect(await position.openPositionsIndexes(_trade)).to.equal(0);
      let [_assetTrade] = await position.assetOpenPositions(0);
      expect(_assetTrade).to.equal(1);
      expect(await position.assetOpenPositionsIndexes(0, _trade)).to.equal(0);
      expect(await position.limitOrdersLength(0)).to.equal(0);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
      let [margin, leverage, asset, direction, price, tpPrice, slPrice, orderType, trader, id, tigAsset, accInterest] = await position.trades(1);
      expect(margin).to.equal(995);
      expect(leverage).to.equal(1000);
      expect(asset).to.equal(0);
      expect(direction).to.equal(true);
      expect(price).to.equal(9500);
      expect(tpPrice).to.equal(11000);
      expect(slPrice).to.equal(9000);
      expect(orderType).to.equal(0);
      expect(trader).to.equal(user.address);
      expect(id).to.equal(1);
      expect(tigAsset).to.equal(StableToken.address);
      expect(accInterest).to.equal(0);
    });
    it("Trying to execute an open position should simply return", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      let [_trade] = await position.openPositions();
      expect(_trade).to.equal(1);
      expect(await position.openPositionsIndexes(_trade)).to.equal(0);
      let [_assetTrade] = await position.assetOpenPositions(0);
      expect(_assetTrade).to.equal(1);
      expect(await position.assetOpenPositionsIndexes(0, _trade)).to.equal(0);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
      let [margin, leverage, asset, direction, price, tpPrice, slPrice, orderType, trader, id, tigAsset, accInterest] = await position.trades(1);
      expect(margin).to.equal(1000);
      expect(leverage).to.equal(1000);
      expect(asset).to.equal(0);
      expect(direction).to.equal(true);
      expect(price).to.equal(10000);
      expect(tpPrice).to.equal(11000);
      expect(slPrice).to.equal(9000);
      expect(orderType).to.equal(0);
      expect(trader).to.equal(user.address);
      expect(id).to.equal(1);
      expect(tigAsset).to.equal(StableToken.address);
      expect(accInterest).to.equal(0);
      await position.connect(Minter).executeLimitOrder(
        1,
        95e8,
        995
      );
      [_trade] = await position.openPositions();
      expect(_trade).to.equal(1);
      expect(await position.openPositionsIndexes(_trade)).to.equal(0);
      [_assetTrade] = await position.assetOpenPositions(0);
      expect(_assetTrade).to.equal(1);
      expect(await position.assetOpenPositionsIndexes(0, _trade)).to.equal(0);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
      [margin, leverage, asset, direction, price, tpPrice, slPrice, orderType, trader, id, tigAsset, accInterest] = await position.trades(1);
      expect(margin).to.equal(1000);
      expect(leverage).to.equal(1000);
      expect(asset).to.equal(0);
      expect(direction).to.equal(true);
      expect(price).to.equal(10000);
      expect(tpPrice).to.equal(11000);
      expect(slPrice).to.equal(9000);
      expect(orderType).to.equal(0);
      expect(trader).to.equal(user.address);
      expect(id).to.equal(1);
      expect(tigAsset).to.equal(StableToken.address);
      expect(accInterest).to.equal(0);
    });
  });
  describe("Burning function", function () {
    it("Burning an open position should delete trade info and burn the NFT", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
      await position.connect(Minter).burn(1);
      expect(await position.assetOpenPositionsLength(0)).to.equal(0);      
      await expect(position.trades(1)).to.be.revertedWith("ERC721: invalid token ID");
    });
    it("Burning a limit order should delete trade info and burn the NFT", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          1,
          StableToken.address
        ]
      );
      expect(await position.limitOrdersLength(0)).to.equal(1);
      await position.connect(Minter).burn(1);
      expect(await position.limitOrdersLength(0)).to.equal(0);      
      await expect(position.trades(1)).to.be.revertedWith("ERC721: invalid token ID");
    });
  });
  describe("Modification functions", function () {
    it("Modify margin", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).modifyMargin(1, 2000, 500);
      [margin, leverage,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(2000);
      expect(leverage).to.equal(500);
    });
    it("Reduce position", async function () {
      await position.connect(Minter).updateFunding(0, StableToken.address, 1000000, 0, 0, 0); // 1M longOi, 0 shortOi, 0% funding rate, 0% vault
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).updateFunding(0, StableToken.address, 600000, 0, 0, 0); // 600k longOi, 0 shortOi, 0% funding rate, 0% vault
      await position.connect(Minter).reducePosition(1, 4e9);
      [margin,,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(600);
    });
    it("Set TP and SL", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).modifyTp(1, 12000);
      await position.connect(Minter).modifySl(1, 8000);
      [,,,,,tpPrice,slPrice,,,,,] = await position.trades(1);
      expect(tpPrice).to.equal(12000);
      expect(slPrice).to.equal(8000);
    });
  });
  describe("Funding rate", function () {
    it("Long accInterest", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("1000"),
          0,
          true,
          parseEther("10000"),
          parseEther("11000"),
          parseEther("9000"),
          0,
          StableToken.address
        ]
      );
      await network.provider.send("evm_setNextBlockTimestamp", [1671408000]); // time
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("3000000"), parseEther("1000000"), 3e9, 0); // 3M longOi, 1M shortOi, 30% funding rate
      await network.provider.send("evm_setNextBlockTimestamp", [1702944010]); // time + 1 year
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest] = await position.trades(1);
      expect(parseInt(accInterest/1e18)).to.equal(-200000); // Not exactly 200_000e18 because of division by 31_536_000 (seconds in a year)
    });
    it("Short accInterest", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("1000"),
          0,
          false,
          parseEther("10000"),
          parseEther("11000"),
          parseEther("9000"),
          0,
          StableToken.address
        ]
      );
      await network.provider.send("evm_setNextBlockTimestamp", [1671408000]); // time
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("3000000"), parseEther("1000000"), 3e9, 0); // 3M longOi, 1M shortOi, 30% funding rate
      await network.provider.send("evm_setNextBlockTimestamp", [1702944010]); // time + 1 year
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest] = await position.trades(1);
      expect(parseInt(accInterest/1e18)).to.equal(600000); // Not exactly 600_000e18 because of division by 31_536_000 (seconds in a year)
    });
    it("accInterest change after partial close", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [1671408000]); // time
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("10000"), 0, 5e8, 0); // 10k longOi, 0 shortOi, 5% funding rate
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("10"),
          0,
          true,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterestFirst] = await position.trades(1);
      expect(parseInt(accInterestFirst/1e18)).to.equal(0);
      await network.provider.send("evm_setNextBlockTimestamp", [1702944000]); // time + 1 year
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("20000"), 0, 5e8, 0); // 20k longOi, 0 shortOi, 5% funding rate
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("10"),
          0,
          true,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterestBefore] = await position.trades(2);
      expect(parseInt(accInterestBefore/1e18)).to.equal(0); // Not exactly zero because a couple seconds pass during test
      await network.provider.send("evm_setNextBlockTimestamp", [1734490000]); // time + 2 years
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest] = await position.trades(2);
      expect(parseInt(accInterest/1e18)).to.equal(-500);
      await position.connect(Minter).setAccInterest(2);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), 0, 5e8, 0); // 12k longOi, 0 shortOi, 5% funding rate
      await position.connect(Minter).reducePosition(2, 8e9);
      [,,,,,,,,,,,accInterestAfter] = await position.trades(2);
      expect(parseInt(accInterestAfter/1e18)).to.equal(-100);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("10000"), 5e8, 0); // 12k longOi, 10k shortOi, 5% funding rate
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("10"),
          0,
          false,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterest2] = await position.trades(2);
      expect(parseInt(accInterest2/1e18)).to.equal(-100);
      [,,,,,,,,,,,accInterest3] = await position.trades(3);
      expect(parseInt(accInterest3/1e18)).to.equal(0);
      await network.provider.send("evm_setNextBlockTimestamp", [1766050000]); // time + 3 years
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest4] = await position.trades(2);
      expect(parseInt(accInterest4/1e18)).to.equal(-116);
      [,,,,,,,,,,,accInterest5] = await position.trades(3);
      expect(parseInt(accInterest5/1e18)).to.equal(100);

      await position.connect(Minter).setAccInterest(3);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("1000"), 5e8, 0); // 12k longOi, 1k shortOi, 5% funding rate
      await position.connect(Minter).reducePosition(3, 9e9);
      [,,,,,,,,,,,accInterest6] = await position.trades(3);
      expect(parseInt(accInterest6/1e18)).to.equal(10);
      await position.connect(Minter).setAccInterest(3);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("100"), 5e8, 0); // 12k longOi, 100 shortOi, 5% funding rate
      await position.connect(Minter).reducePosition(3, 9e9);
      [,,,,,,,,,,,accInterest7] = await position.trades(3);
      expect(parseInt(accInterest7/1e18)).to.equal(1);

      [,,,,,,,,,,,accInterest8] = await position.trades(2);
      expect(parseInt(accInterest8/1e18)).to.equal(-116);

      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("1000"), 5e8, 0); // 12k longOi, 1000 shortOi, 5% funding rate
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("90"),
          parseEther("10"),
          0,
          false,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterest7] = await position.trades(3);
      expect(parseInt(accInterest7/1e18)).to.equal(1);
      [,,,,,,,,,,,accInterest8] = await position.trades(2);
      expect(parseInt(accInterest8/1e18)).to.equal(-116);

      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("132000"), parseEther("1000"), 5e8, 0); // 132k longOi, 1000 shortOi, 5% funding rate
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1200"),
          parseEther("100"),
          0,
          true,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterest9] = await position.trades(3);
      expect(parseInt(accInterest9/1e18)).to.equal(1);
      [,,,,,,,,,,,accInterest10] = await position.trades(2);
      expect(parseInt(accInterest10/1e18)).to.equal(-116);
    });
  });
  describe("Funding rate with vault earning a percent", function () {
    it("Long accInterest", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("1000"),
          0,
          true,
          parseEther("10000"),
          parseEther("11000"),
          parseEther("9000"),
          0,
          StableToken.address
        ]
      );
      await network.provider.send("evm_setNextBlockTimestamp", [1671408000]); // time
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("3000000"), parseEther("1000000"), 3e9, 5e9); // 3M longOi, 1M shortOi, 30% funding rate, 50% vault
      await network.provider.send("evm_setNextBlockTimestamp", [1702944010]); // time + 1 year
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest] = await position.trades(1);
      expect(parseInt(accInterest/1e18)).to.equal(-200000); // Not exactly 200_000e18 because of division by 31_536_000 (seconds in a year)
    });
    it("Short accInterest", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("1000"),
          0,
          false,
          parseEther("10000"),
          parseEther("11000"),
          parseEther("9000"),
          0,
          StableToken.address
        ]
      );
      await network.provider.send("evm_setNextBlockTimestamp", [1671408000]); // time
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("3000000"), parseEther("1000000"), 3e9, 5e9); // 3M longOi, 1M shortOi, 30% funding rate, 50% vault
      await network.provider.send("evm_setNextBlockTimestamp", [1702944010]); // time + 1 year
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest] = await position.trades(1);
      expect(parseInt(accInterest/1e18)).to.equal(300000); // Not exactly 300_000e18 because of division by 31_536_000 (seconds in a year)
    });
    it("accInterest change after partial close", async function () {
      await network.provider.send("evm_setNextBlockTimestamp", [1671408000]); // time
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("10000"), 0, 5e8, 5e9); // 10k longOi, 0 shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("10"),
          0,
          true,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterestFirst] = await position.trades(1);
      expect(parseInt(accInterestFirst/1e18)).to.equal(0);
      await network.provider.send("evm_setNextBlockTimestamp", [1702944000]); // time + 1 year
      await network.provider.send("evm_mine");
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("20000"), 0, 5e8, 5e9); // 20k longOi, 0 shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("10"),
          0,
          true,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterestBefore] = await position.trades(2);
      expect(parseInt(accInterestBefore/1e18)).to.equal(0); // Not exactly zero because a couple seconds pass during test
      await network.provider.send("evm_setNextBlockTimestamp", [1734490000]); // time + 2 years
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest] = await position.trades(2);
      expect(parseInt(accInterest/1e18)).to.equal(-500);
      await position.connect(Minter).setAccInterest(2);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), 0, 5e8, 5e9); // 12k longOi, 0 shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).reducePosition(2, 8e9);
      [,,,,,,,,,,,accInterestAfter] = await position.trades(2);
      expect(parseInt(accInterestAfter/1e18)).to.equal(-100);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("10000"), 5e8, 5e9); // 12k longOi, 10k shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1000"),
          parseEther("10"),
          0,
          false,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterest2] = await position.trades(2);
      expect(parseInt(accInterest2/1e18)).to.equal(-100);
      [,,,,,,,,,,,accInterest3] = await position.trades(3);
      expect(parseInt(accInterest3/1e18)).to.equal(0);
      await network.provider.send("evm_setNextBlockTimestamp", [1766050000]); // time + 3 years
      await network.provider.send("evm_mine");
      [,,,,,,,,,,,accInterest4] = await position.trades(2);
      expect(parseInt(accInterest4/1e18)).to.equal(-116);
      [,,,,,,,,,,,accInterest5] = await position.trades(3);
      expect(parseInt(accInterest5/1e18)).to.equal(50);

      await position.connect(Minter).setAccInterest(3);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("1000"), 5e8, 5e9); // 12k longOi, 1k shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).reducePosition(3, 9e9);
      [,,,,,,,,,,,accInterest6] = await position.trades(3);
      expect(parseInt(accInterest6/1e18)).to.equal(5);
      await position.connect(Minter).setAccInterest(3);
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("100"), 5e8, 5e9); // 12k longOi, 100 shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).reducePosition(3, 9e9);
      [,,,,,,,,,,,accInterest7] = await position.trades(3);
      expect(parseInt(accInterest7/1e17)/10).to.equal(0.5);

      [,,,,,,,,,,,accInterest8] = await position.trades(2);
      expect(parseInt(accInterest8/1e18)).to.equal(-116);

      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("12000"), parseEther("1000"), 5e8, 5e9); // 12k longOi, 1000 shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("90"),
          parseEther("10"),
          0,
          false,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterest7] = await position.trades(3);
      expect(parseInt(accInterest7/1e17)/10).to.equal(0.5);
      [,,,,,,,,,,,accInterest8] = await position.trades(2);
      expect(parseInt(accInterest8/1e18)).to.equal(-116);

      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("132000"), parseEther("1000"), 5e8, 5e9); // 132k longOi, 1000 shortOi, 5% funding rate, 50% vault
      await position.connect(Minter).mint(
        [
          user.address,
          parseEther("1200"),
          parseEther("100"),
          0,
          true,
          parseEther("10000"),
          0,
          0,
          0,
          StableToken.address
        ]
      );
      [,,,,,,,,,,,accInterest9] = await position.trades(3);
      expect(parseInt(accInterest9/1e17)/10).to.equal(0.5);
      [,,,,,,,,,,,accInterest10] = await position.trades(2);
      expect(parseInt(accInterest10/1e18)).to.equal(-116);

      // Check that chaning vault % doesn't affect pending
      await position.connect(Minter).updateFunding(0, StableToken.address, parseEther("132000"), parseEther("1000"), 5e8, 0); // 132k longOi, 1000 shortOi, 5% funding rate, 0% vault
      [,,,,,,,,,,,accInterest11] = await position.trades(3);
      expect(parseInt(accInterest11/1e17)/10).to.equal(0.5);
      [,,,,,,,,,,,accInterest12] = await position.trades(2);
      expect(parseInt(accInterest12/1e18)).to.equal(-116);      
    });
  });
  describe("Useful view functions", function() {
    it("Open positions selection should return expected IDs", async function() {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      let [trade2, trade3] = await position.openPositionsSelection(1, 3);
      expect(trade2).to.equal(2);
      expect(trade3).to.equal(3);
    });
    it("User trades array should return expected IDs", async function() {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      let [trade1, trade2, trade3] = await position.userTrades(user.address);
      expect(trade1).to.equal(1);
      expect(trade2).to.equal(2);
      expect(trade3).to.equal(3);
    });
  });
  describe("Counter", function () {
    it("Should get expected counter value", async function () {
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      expect(await position.getCount()).to.equal(2);
    });
  });
  describe("BaseURI related functions", function () {
    it("Owner setting baseURI should set URI", async function () {
      await position.connect(owner).setBaseURI("ipfs://abc.xyz/");
      expect(await position.baseURI()).to.equal("ipfs://abc.xyz/");
    });
    it("TokenURI should use new baseURI", async function () {
      await position.connect(owner).setBaseURI("ipfs://abc.xyz/");
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      await position.connect(Minter).mint(
        [
          user.address,
          1000,
          1000,
          0,
          true,
          10000,
          11000,
          9000,
          0,
          StableToken.address
        ]
      );
      expect(await position.tokenURI(1)).to.equal("ipfs://abc.xyz/1");
      expect(await position.tokenURI(2)).to.equal("ipfs://abc.xyz/2");
    });
  });
});
