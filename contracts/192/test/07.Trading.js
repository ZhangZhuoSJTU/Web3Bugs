const { expect } = require("chai");
const { deployments, ethers, waffle } = require("hardhat");
const { parseEther } = ethers.utils;
const { signERC2612Permit } = require('eth-permit');

describe("Trading", function () {

  let owner;
  let node;
  let user;
  let node2;
  let node3;
  let proxy;

  let Trading;
  let trading;

  let TradingExtension;
  let tradingExtension;

  let TradingLibrary;
  let tradinglibrary;

  let StableToken;
  let stabletoken;

  let StableVault;
  let stablevault;

  let position;

  let pairscontract;
  let referrals;

  let permitSig;
  let permitSigUsdc;

  let MockDAI;
  let MockUSDC;
  let mockusdc;

  let badstablevault;

  let chainlink;

  beforeEach(async function () {
    await deployments.fixture(['test']);
    [owner, node, user, node2, node3, proxy] = await ethers.getSigners();
    StableToken = await deployments.get("StableToken");
    stabletoken = await ethers.getContractAt("StableToken", StableToken.address);
    Trading = await deployments.get("Trading");
    trading = await ethers.getContractAt("Trading", Trading.address);
    TradingExtension = await deployments.get("TradingExtension");
    tradingExtension = await ethers.getContractAt("TradingExtension", TradingExtension.address);
    const Position = await deployments.get("Position");
    position = await ethers.getContractAt("Position", Position.address);
    MockDAI = await deployments.get("MockDAI");
    MockUSDC = await deployments.get("MockUSDC");
    mockusdc = await ethers.getContractAt("MockERC20", MockUSDC.address);
    const PairsContract = await deployments.get("PairsContract");
    pairscontract = await ethers.getContractAt("PairsContract", PairsContract.address);
    const Referrals = await deployments.get("Referrals");
    referrals = await ethers.getContractAt("Referrals", Referrals.address);
    StableVault = await deployments.get("StableVault");
    stablevault = await ethers.getContractAt("StableVault", StableVault.address);
    await stablevault.connect(owner).listToken(MockDAI.address);
    await stablevault.connect(owner).listToken(MockUSDC.address);
    await tradingExtension.connect(owner).setAllowedMargin(StableToken.address, true);
    await tradingExtension.connect(owner).setMinPositionSize(StableToken.address, parseEther("1"));
    await tradingExtension.connect(owner).setNode(node.address, true);
    await tradingExtension.connect(owner).setNode(node2.address, true);
    await tradingExtension.connect(owner).setNode(node3.address, true);
    await network.provider.send("evm_setNextBlockTimestamp", [2000000000]);
    await network.provider.send("evm_mine");
    permitSig = await signERC2612Permit(owner, MockDAI.address, owner.address, Trading.address, ethers.constants.MaxUint256);
    permitSigUsdc = await signERC2612Permit(owner, MockUSDC.address, owner.address, Trading.address, ethers.constants.MaxUint256);

    const BadStableVault = await ethers.getContractFactory("BadStableVault");
    badstablevault = await BadStableVault.deploy(StableToken.address);

    const ChainlinkContract = await ethers.getContractFactory("MockChainlinkFeed");
    chainlink = await ChainlinkContract.deploy();

    TradingLibrary = await deployments.get("TradingLibrary");
    tradinglibrary = await ethers.getContractAt("TradingLibrary", TradingLibrary.address);
    await trading.connect(owner).setLimitOrderPriceRange(1e10);
  });
  describe("Check onlyOwner and onlyProtocol", function () {
    it("Set max win percent", async function () {
      await expect(trading.connect(user).setMaxWinPercent(1e10)).to.be.revertedWith("Ownable");
    });
    it("Set fees", async function () {
      await expect(trading.connect(user).setFees(true,3e8,1e8,1e8,1e8,1e8)).to.be.revertedWith("Ownable");
    });
    it("Set trading extenstion", async function () {
      await expect(trading.connect(user).setTradingExtension(user.address)).to.be.revertedWith("Ownable");
    });
    it("Set block delay", async function () {
      await expect(trading.connect(user).setBlockDelay(1)).to.be.revertedWith("Ownable");
    });
    it("Set allowed vault", async function () {
      await expect(trading.connect(user).setAllowedVault(StableVault.address, true)).to.be.revertedWith("Ownable");
    });
    it("Set limit order execution price range", async function () {
      await expect(trading.connect(user).setLimitOrderPriceRange(0)).to.be.revertedWith("Ownable");
    });
    it("Set valid signature timer", async function () {
      await expect(tradingExtension.connect(user).setValidSignatureTimer(100)).to.be.revertedWith("Ownable");
    });
    it("Set paused", async function () {
      await expect(tradingExtension.connect(user).setPaused(true)).to.be.revertedWith("Ownable");
    });
    it("Set max gas price", async function () {
      await expect(tradingExtension.connect(user).setMaxGasPrice(10)).to.be.revertedWith("Ownable");
    });
    it("Set chainlink enabled", async function () {
      await expect(tradingExtension.connect(user).setChainlinkEnabled(true)).to.be.revertedWith("Ownable");
    });
    it("Set node", async function () {
      await expect(tradingExtension.connect(user).setNode(user.address, true)).to.be.revertedWith("Ownable");
    });
    it("Set allowed margin", async function () {
      await expect(tradingExtension.connect(user).setAllowedMargin(user.address, true)).to.be.revertedWith("Ownable");
    });
    it("Set min position size", async function () {
      await expect(tradingExtension.connect(user).setMinPositionSize(user.address, 0)).to.be.revertedWith("Ownable");
    });
    it("Modify short oi", async function () {
      await expect(tradingExtension.connect(user).modifyShortOi(0, user.address, true, 0)).to.be.revertedWith("!protocol");
    });
    it("Modify long oi", async function () {
      await expect(tradingExtension.connect(user).modifyLongOi(0, user.address, true, 0)).to.be.revertedWith("!protocol");
    });
    it("Set referral", async function () {
      await expect(tradingExtension.connect(user)._setReferral(ethers.constants.HashZero, user.address)).to.be.revertedWith("!protocol");
    });
  });
  describe("Setters", function () {
    it("Set max win percent", async function () {
      await trading.connect(owner).setMaxWinPercent(1e11);
      expect(await trading.maxWinPercent()).to.equal(1e11);
      await trading.connect(owner).setMaxWinPercent(0);
      expect(await trading.maxWinPercent()).to.equal(0);
    });
    it("Set valid signature timer", async function () {
      await tradingExtension.connect(owner).setValidSignatureTimer(100);
      expect(await tradingExtension.validSignatureTimer()).to.equal(100);
    });
    it("Set paused", async function () {
      await tradingExtension.connect(owner).setPaused(true);
      expect(await tradingExtension.paused()).to.equal(true);
      await tradingExtension.connect(owner).setPaused(false);
      expect(await tradingExtension.paused()).to.equal(false);
    });
    it("Set max gas price", async function () {
      await tradingExtension.connect(owner).setMaxGasPrice(10);
      expect(await tradingExtension.maxGasPrice()).to.equal(10);
    });
    it("Set fees", async function () {
      await expect(trading.connect(owner).setFees(true,1e8,1e8,1e8,1e8,1e8)).to.be.revertedWith("");
      await expect(trading.connect(owner).setFees(false,1e8,1e8,1e8,1e8,1e8)).to.be.revertedWith("");
      await expect(trading.connect(owner).setFees(true,3e8,1e8,1e8,1e8,(1e10+1))).to.be.revertedWith("");
      await expect(trading.connect(owner).setFees(false,3e8,1e8,1e8,1e8,(1e10+1))).to.be.revertedWith("");
      await trading.connect(owner).setFees(true,3e8,1e8,1e8,1e8,1e8);
      await trading.connect(owner).setFees(false,3e8,1e8,1e8,1e8,1e8);
      expect((await trading.openFees()).toString()).to.equal('300000000,100000000,100000000,100000000');
      expect((await trading.closeFees()).toString()).to.equal('300000000,100000000,100000000,100000000');
    });
  });
  describe("Signature verification", function () {
    it("Valid signature should work as expected", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
    });
    it("Using an expired signature should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      network.provider.send("evm_setNextBlockTimestamp", [2100000000]);
      network.provider.send("evm_mine");
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("ExpSig");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Using an invalid signature should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 9999999999999, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("BadSig");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Using a signature from a non-node address should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [user.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [user.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await user.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!Node");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Using a future signature should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 3000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 3000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("FutSig");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Trying to trade a closed market should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, true];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, true]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("Closed");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Trying to trade with asset that doesn't match signed message should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 1, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!Asset");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Trying to trade an asset with zero price should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("0"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("0"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("NoPrice");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
  });
  describe("Market trading", function () {
    it("Opening a market long with a bad SL should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("30000")/* SL>price*/, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("3");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened      
    });
    it("Opening a market short with a bad SL should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("10000"), parseEther("10000")/* SL<price*/, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("3");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened      
    });
    it("Opening a market short with no SL should open position", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("10000"), parseEther("0")/* SL = 0*/, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
    });
    it("Opening a position while trading is paused should revert", async function () {
      await tradingExtension.connect(owner).setPaused(true);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("paused");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a position with < min leverage should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("0.5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!lev");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a position with > min leverage should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("1000"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!lev");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a position with a non-allowed margin asset should revert", async function () {
      await tradingExtension.connect(owner).setAllowedMargin(StableToken.address, false);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!margin");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a position on a non-allowed pair should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 99, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!allowed");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a position with < min position size should revert", async function () {
      let TradeInfo = [parseEther("0.1"), MockDAI.address, StableVault.address, parseEther("2"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("!size");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a position with an unapproved stablevault should revert", async function () {
      await trading.connect(owner).setAllowedVault(StableVault.address, false);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("Unapproved stablevault");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Trading should revert if margin asset isn't listed in stablevault", async function () {
      await stablevault.connect(owner).delistToken(MockDAI.address);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address)).to.be.revertedWith("Token not approved in vault");
    });
    it("Opening a position with a bad stablevault should revert", async function () {
      await badstablevault.connect(owner).listToken(MockDAI.address);
      await trading.connect(owner).setAllowedVault(badstablevault.address, true);
      let TradeInfo = [parseEther("1000"), MockDAI.address, badstablevault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("BadDeposit");
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade not opened
    });
    it("Opening a market position with tigAsset", async function () {
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("1000"));
      let TradeInfo = [parseEther("1000"), StableToken.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("0")); // Should no tigAsset left
    });
    it("Closing over 100% should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      await expect(trading.connect(owner).initiateCloseOrder(1, 1e10+1, PriceData, sig, StableVault.address, StableToken.address, owner.address)).to.be.revertedWith("BadClosePercent");
    });
    it("Closing 0% should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      await expect(trading.connect(owner).initiateCloseOrder(1, 0, PriceData, sig, StableVault.address, StableToken.address, owner.address)).to.be.revertedWith("BadClosePercent");
    });
    it("Closing with a bad stablevault should revert", async function () {
      await badstablevault.connect(owner).listToken(MockDAI.address);
      await trading.connect(owner).setAllowedVault(badstablevault.address, true);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      await expect(trading.connect(owner).initiateCloseOrder(1, 1e10, PriceData, sig, badstablevault.address, MockDAI.address, owner.address)).to.be.revertedWith("BadWithdraw");
    });
    it("Closing a limit order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);

      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
            
      await expect(trading.connect(owner).initiateCloseOrder(1, 1e10, PriceData, sig, StableVault.address, StableToken.address, owner.address)).to.be.revertedWith("4");
    });
    it("Closing someone else's position should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      await expect(trading.connect(user).initiateCloseOrder(1, 1e10, PriceData, sig, StableVault.address, StableToken.address, user.address)).to.be.revertedWith("2");
    });
    it("Partially closing a position should revert if position size would go below minimum position size, fully closing should not revert", async function () {
      await tradingExtension.connect(owner).setMinPositionSize(StableToken.address, parseEther("3000"));
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false]; // Price 10% higher
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await expect(trading.connect(owner).initiateCloseOrder(1, 5e9, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address)).to.be.revertedWith("!size");
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Trade has closed
    });
    it("Partially closing a position should have correct payout and new margin", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("11000"), 0, 2000000000, false]; // Price 10% higher
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("11000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 5e9, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("750")); // Margin * 50% + 10% * 5 * Margin * 50% = $750
      let [margin,,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("500"));
    });
  });
  describe("Trading using <18 decimal token", async function () {
    it("Opening and closing a position with tigUSD output", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockUSDC.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSigUsdc.deadline, ethers.constants.MaxUint256, permitSigUsdc.v, permitSigUsdc.r, permitSigUsdc.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("9000"), 0, 2000000000, false]; // Price down 10%
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("9000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("500"));
    });
    it("Opening and closing a position with <18 decimal token output", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockUSDC.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSigUsdc.deadline, ethers.constants.MaxUint256, permitSigUsdc.v, permitSigUsdc.r, permitSigUsdc.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await mockusdc.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("9000"), 0, 2000000000, false]; // Price down 10%
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("9000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, MockUSDC.address, owner.address);
      expect(await mockusdc.balanceOf(owner.address)).to.equal(500000000);
    });
  });
  describe("Limit orders and liquidations", function () {
    /**
     * Non-reverting limit order tests
     */
    it("Creating and executing limit buy order, should have correct price and bot fees", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");

      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 10000000, 2000000000, false]; // 0.1% spread
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 10000000, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await trading.connect(user).executeLimitOrder(1, PriceData, sig);
      expect(await position.limitOrdersLength(0)).to.equal(0); // Limit order executed
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Creates open position
      expect((await trading.openFees()).botFees).to.equal(2000000);
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("2"));
      let [,,,,price,,,,,,,] = await position.trades(1);
      expect(price).to.equal(parseEther("20020")); // Should have guaranteed execution price with spread
    });
    it("Creating and executing limit sell order, should have correct price and bot fees", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("10000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");

      // Execute limit order
      let PriceData = [node.address, 0, parseEther("20000"), 10000000, 2000000000, false]; // 0.1% spread
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 10000000, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
            
      await trading.connect(user).executeLimitOrder(1, PriceData, sig);
      expect(await position.limitOrdersLength(0)).to.equal(0); // Limit order executed
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Creates open position
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("2"));
      let [,,,,price,,,,,,,] = await position.trades(1);
      expect(price).to.equal(parseEther("9990")); // Should have guaranteed execution price with spread
    });
    it("Creating and executing buy stop order, should have correct price and bot fees", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 2, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");

      // Execute limit order
      let PriceData = [node.address, 0, parseEther("30000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("30000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
            
      await trading.connect(user).executeLimitOrder(1, PriceData, sig);
      expect(await position.limitOrdersLength(0)).to.equal(0); // Limit order executed
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Creates open position
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("2"));
      let [,,,,price,,,,,,,] = await position.trades(1);
      expect(price).to.equal(parseEther("30000")); // Should have market execution price
    });
    it("Creating and executing sell stop order, should have correct price and bot fees", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 2, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");

      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
            
      await trading.connect(user).executeLimitOrder(1, PriceData, sig);
      expect(await position.limitOrdersLength(0)).to.equal(0); // Limit order executed
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Creates open position
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("2"));
      let [,,,,price,,,,,,,] = await position.trades(1);
      expect(price).to.equal(parseEther("10000")); // Should have market execution price
    });
    /**
     * Reverting limit order tests
     */
    it("Executing a limit order should revert if limit delay hasn't passed", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("");
    });
    it("Creating a limit with zero price should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateLimitOrder(TradeInfo, 1, 0, PermitData, owner.address)).to.be.revertedWith("NoPrice");
    });
    it("Creating a limit with orderType 0 should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateLimitOrder(TradeInfo, 0, parseEther("20000"), PermitData, owner.address)).to.be.revertedWith("5");
    });
    it("Executing an open position should revert", async function () {
      // Open market position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);    
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("5");
    });
    it("Creating and executing an unmet limit buy order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");
      
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("30000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("30000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
            
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Creating and executing an unmet limit sell order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");
      
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
            
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Creating and executing an unmet buy stop order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 2, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");
      
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Creating and executing an unmet sell stop order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 2, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");
      
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("30000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("30000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Creating and executing a limit order with price out of range (too low) should revert", async function () {
      await trading.connect(owner).setLimitOrderPriceRange(0);
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 2, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");
      
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Creating and executing a limit order with price out of range (too high) should revert", async function () {
      await trading.connect(owner).setLimitOrderPriceRange(0);
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 2, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened

      // Limit order delay
      await network.provider.send("evm_increaseTime", [10]);
      await network.provider.send("evm_mine");
      
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("30000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("30000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("6");
    });
    /**
     * Reverting SL/TP tests
     */
    it("Executing an unmet long TP should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("30000"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // Attempt TP execution
      await expect(trading.connect(user).limitClose(1, true, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Executing an unmet short TP should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("10000"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // Attempt SL execution
      await expect(trading.connect(user).limitClose(1, true, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Executing an unmet long SL should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("10000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // Attempt TP execution
      await expect(trading.connect(user).limitClose(1, false, PriceData, sig)).to.be.revertedWith("6");
    });
    it("Executing an unmet short SL should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("0"), parseEther("30000"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // Attempt SL execution
      await expect(trading.connect(user).limitClose(1, false, PriceData, sig)).to.be.revertedWith("6");
    });
    /**
     * No TP/SL tests
     */
    it("Executing a TP on an open position with no TP should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // Attempt TP execution
      await expect(trading.connect(user).limitClose(1, true, PriceData, sig)).to.be.revertedWith("7");
    });
    it("Executing an SL on an open position with no SL should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // Attempt SL execution
      await expect(trading.connect(user).limitClose(1, false, PriceData, sig)).to.be.revertedWith("7");
    });
    it("Limit closing a limit order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order has been created
      // Attempt limit close
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).limitClose(1, true, PriceData, sig)).to.be.revertedWith("4");
    });
    it("Using too much gas should revert", async function () {
      await tradingExtension.connect(owner).setMaxGasPrice(100000000);
      // Attempt limit close (non-existing position is OK for this test) with high gas
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).limitClose(1, true, PriceData, sig, {gasPrice: 100000001})).to.be.revertedWith("1");
    });
    /**
     * Non-reverting SL/TP tests
     */
    it("Executing a long TP should have correct fees and payout", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Set fees to zero for easier calculation
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Set fees to zero for easier calculation
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("22000"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // TP execution
      await trading.connect(owner).setFees(true,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      await trading.connect(owner).setFees(false,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      let closePriceData = [node.address, 0, parseEther("22000"), 0, 2000000000, false];
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("22000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(user).limitClose(1, true, closePriceData, closeSig);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("1989"));
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("11"));
    });
    it("Executing a short TP should have correct fees and payout", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Set fees to zero for easier calculation
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Set fees to zero for easier calculation
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, parseEther("18000"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // TP execution
      await trading.connect(owner).setFees(true,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      await trading.connect(owner).setFees(false,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      let closePriceData = [node.address, 0, parseEther("18000"), 0, 2000000000, false];
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("18000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(user).limitClose(1, true, closePriceData, closeSig);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("1991"));
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("9"));
    });
    it("Executing a long SL should have correct fees and payout", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Set fees to zero for easier calculation
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Set fees to zero for easier calculation
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("18000"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // SL execution
      await trading.connect(owner).setFees(true,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      await trading.connect(owner).setFees(false,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      let closePriceData = [node.address, 0, parseEther("18000"), 0, 2000000000, false];
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("18000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(user).limitClose(1, false, closePriceData, closeSig);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("495.5"));
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("4.5"));
    });
    it("Executing a short SL should have correct fees and payout", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Set fees to zero for easier calculation
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Set fees to zero for easier calculation
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("22000"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      // SL execution
      await trading.connect(owner).setFees(true,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      await trading.connect(owner).setFees(false,1e7,0,0,1e7,0); // Easier to calculate with only bot fees
      let closePriceData = [node.address, 0, parseEther("22000"), 0, 2000000000, false];
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("22000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(user).limitClose(1, false, closePriceData, closeSig);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("494.5"));
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("5.5"));
    });
    it("Executing limit order while trading is paused should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened
      // Execute limit order
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await tradingExtension.connect(owner).setPaused(true); // Set paused
      await expect(trading.connect(user).executeLimitOrder(1, PriceData, sig)).to.be.revertedWith("Paused");
    });
    it("Cancelling a an open position should revert", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Set fees to zero for easier calculation
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Set fees to zero for easier calculation
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("18000"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await expect(trading.connect(owner).cancelLimitOrder(1, owner.address)).to.be.revertedWith("");
    });
    it("Cancelling a limit order should give collateral back", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened
      await trading.connect(owner).cancelLimitOrder(1, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(0); // Limit order cancelled
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // No open positions
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("1000")); // Should have gotten collateral back
    });
    it("Opening a limit order with tigAsset", async function () {
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("1000"));
      // Create limit order
      let TradeInfo = [parseEther("1000"), StableToken.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("0")); // Should no tigAsset left
    });
    it("Liquidating a limit order should revert", async function () {
      // Create limit order
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      expect(await position.limitOrdersLength(0)).to.equal(1); // Limit order has been created
      // Attempt liquidation
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).liquidatePosition(1, PriceData, sig)).to.be.revertedWith("4");
    });
    it("Liquidating a non-liquidatable position should revert", async function () {
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("22000"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      // Attempt liquidation
      let closePriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await expect(trading.connect(user).liquidatePosition(1, closePriceData, closeSig)).to.be.revertedWith("NotLiquidatable");
    });
    it("Liquidating long position, should have correct rewards", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      // Attempt liquidation
      let closePriceData = [node.address, 0, parseEther("2000"), 0, 2000000000, false]; // Position size down 90%
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("2000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).setFees(true,1e7,0,0,2e6,0); // Set fees back
      await trading.connect(owner).setFees(false,1e7,0,0,2e6,0); // Set fees back
      await trading.connect(user).liquidatePosition(1, closePriceData, closeSig);
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("0.1"));
    });
    it("Liquidating short position, should have correct rewards", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      // Open position
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      // Attempt liquidation
      let closePriceData = [node.address, 0, parseEther("30000"), 0, 2000000000, false]; // Position size up 50%
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("30000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).setFees(true,1e7,0,0,2e6,0); // Set fees back
      await trading.connect(owner).setFees(false,1e7,0,0,2e6,0); // Set fees back
      await trading.connect(user).liquidatePosition(1, closePriceData, closeSig);
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("1.5"));
    });
  });
  describe("Modifying functions", function () {
    it("Updating TP/SL on a limit order should revert", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      await expect(trading.connect(owner).updateTpSl(true, 1, parseEther("22000"), [ethers.constants.AddressZero, 0, 0, 0, 0, false], "0x", owner.address)).to.be.revertedWith("4");
    });
    it("Updating TP", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await trading.connect(owner).updateTpSl(true, 1, parseEther("22000"), [ethers.constants.AddressZero, 0, 0, 0, 0, false], "0x", owner.address);
      let [,,,,,tpPrice,,,,,,] = await position.trades(1);
      expect(tpPrice).to.equal(parseEther("22000"));
    });
    it("Updating SL", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await trading.connect(owner).updateTpSl(false, 1, parseEther("18000"), openPriceData, openSig, owner.address);
      let [,,,,,,slPrice,,,,,] = await position.trades(1);
      expect(slPrice).to.equal(parseEther("18000"));
    });
    it("Add margin should revert if on limit order", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      await expect(trading.connect(owner).addMargin(1, StableToken.address, StableVault.address, parseEther("1000"), PermitData, owner.address)).to.be.revertedWith("");
    });
    it("Add margin should revert if leverage goes below min leverage", async function () {
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("1000000"));
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await expect(trading.connect(owner).addMargin(1, StableToken.address, StableVault.address, parseEther("1000000"), PermitData, owner.address)).to.be.revertedWith("!lev");
    });
    it("Add margin with non-tigAsset", async function () {
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await trading.connect(owner).addMargin(1, MockDAI.address, StableVault.address, parseEther("1000"), [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false], owner.address);
      let [margin,leverage,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("2000"));
      expect(leverage).to.equal(parseEther("5"));
    });
    it("Add margin with tigAsset", async function () {
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("1000"));
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await trading.connect(owner).addMargin(1, StableToken.address, StableVault.address, parseEther("1000"), [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false], owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("0")); // Should no tigAsset left
      let [margin,leverage,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("2000"));
      expect(leverage).to.equal(parseEther("5"));
    });
    it("Add margin with non-tigAsset with permit", async function () {
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("1000"));
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      let PermitSig = await signERC2612Permit(owner, MockDAI.address, owner.address, Trading.address, ethers.constants.MaxUint256);
      await trading.connect(owner).addMargin(1, MockDAI.address, StableVault.address, parseEther("1000"), [PermitSig.deadline, ethers.constants.MaxUint256, PermitSig.v, PermitSig.r, PermitSig.s, true], owner.address);
      let [margin,leverage,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("2000"));
      expect(leverage).to.equal(parseEther("5"));
    });
    it("Remove margin should revert if on limit order", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);
      await expect(trading.connect(owner).removeMargin(1, StableVault.address, StableToken.address, parseEther("100"), [ethers.constants.AddressZero, 0, 0, 0, 0, false], ethers.constants.HashZero, owner.address)).to.be.revertedWith("");
    });
    it("Remove margin should revert if leverage goes above max leverage", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await expect(trading.connect(owner).removeMargin(1, StableVault.address, StableToken.address, parseEther("994.9"), openPriceData, openSig, owner.address)).to.be.revertedWith("!lev");
    });
    it("Remove margin should revert if it would go into liquidation threshold", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      

      let removeMarginPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let removeMarginMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let removeMarginSig = await node.signMessage(
        Buffer.from(removeMarginMessage.substring(2), 'hex')
      );

      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await expect(trading.connect(owner).removeMargin(1, StableVault.address, StableToken.address, parseEther("900"), removeMarginPriceData, removeMarginSig, owner.address)).to.be.revertedWith("LiqThreshold");
    });
    it("Remove margin with non-tigAsset output", async function () {
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await trading.connect(owner).removeMargin(1, StableVault.address, MockDAI.address, parseEther("500"), openPriceData, openSig, owner.address);
      let [margin,leverage,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("500"));
      expect(leverage).to.equal(parseEther("20"));
    });
    it("Remove margin with tigAsset output", async function () {
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await trading.connect(owner).removeMargin(1, StableVault.address, StableToken.address, parseEther("500"), openPriceData, openSig, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("500"));
      let [margin,leverage,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("500"));
      expect(leverage).to.equal(parseEther("20"));
    });
    it("Adding to position should revert on limit order", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateLimitOrder(TradeInfo, 1, parseEther("20000"), PermitData, owner.address);

      let addPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let addMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let addSig = await node.signMessage(
        Buffer.from(addMessage.substring(2), 'hex')
      );

      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("3000"));
      await expect(trading.connect(owner).addToPosition(1, parseEther("3000"), addPriceData, addSig, StableVault.address, StableToken.address, PermitData, owner.address)).to.be.revertedWith("4");
    });
    it("Adding to position on long should combine margin and open price proportionally, accInterest should work as expected", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 1e9); // 10% Annual rate
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      

      let addPriceData = [node.address, 0, parseEther("10000"), 0, 2031538000, false];
      let addMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2031538000, false]
        )
      );
      let addSig = await node.signMessage(
        Buffer.from(addMessage.substring(2), 'hex')
      );

      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("3030"));
      await network.provider.send("evm_setNextBlockTimestamp", [2031538000]); // 1 year passes
      await network.provider.send("evm_mine");
      let [,,,,,,,,,,,accInterest] = await position.trades(1);
      expect(Math.round(parseInt(accInterest/1e18))).to.equal(-497);
      await trading.connect(owner).addToPosition(1, parseEther("3000"), addPriceData, addSig, StableVault.address, StableToken.address, PermitData, owner.address);
      let [margin,leverage,,,openPrice,,,,,,,accInterestAfter] = await position.trades(1);
      expect(Math.round(parseInt(accInterestAfter/1e18))).to.equal(-497); // accInterest stays the same
      expect(margin).to.equal(parseEther("3980")); // Margin combined
      expect(leverage).to.equal(parseEther("5")); // Leverage stays the same
      expect(openPrice).to.equal(parseEther("12500")); // Open price combined proportionally
    });
    it("Adding to position on short should combine margin and open price proportionally, accInterest should work as expected", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 1e9); // 10% Annual rate
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      

      let addPriceData = [node.address, 0, parseEther("10000"), 0, 2031538000, false];
      let addMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2031538000, false]
        )
      );
      let addSig = await node.signMessage(
        Buffer.from(addMessage.substring(2), 'hex')
      );

      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await stabletoken.connect(owner).setMinter(owner.address, true);
      await stabletoken.connect(owner).mintFor(owner.address, parseEther("3000"));
      await network.provider.send("evm_setNextBlockTimestamp", [2031538000]); // 1 year passes
      await network.provider.send("evm_mine");
      let [,,,,,,,,,,,accInterest] = await position.trades(1);
      expect(Math.round(parseInt(accInterest/1e18))).to.equal(-497);
      await trading.connect(owner).addToPosition(1, parseEther("3000"), addPriceData, addSig, StableVault.address, StableToken.address, PermitData, owner.address);
      let [margin,leverage,,,openPrice,,,,,,,accInterestAfter] = await position.trades(1);
      expect(Math.round(parseInt(accInterestAfter/1e18))).to.equal(-497); // accInterest stays the same
      expect(margin).to.equal(parseEther("3980")); // Margin combined
      expect(leverage).to.equal(parseEther("5")); // Leverage stays the same
      expect(openPrice).to.equal(parseEther("12500")); // Open price combined proportionally
    });
  });
  describe("PnL calculations", function () {
    it("Long and PnL is positive", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("11000"), 0, 2000000000, false]; // Price 10% higher
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("11000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("1500")); // Margin + 10% * 5 * Margin = $1500
    });
    it("Short and PnL is positive", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("9000"), 0, 2000000000, false]; // Price 10% lower
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("9000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("1500")); // Margin + 10% * 5 * Margin = $1500
    });
    it("Long and PnL is negative", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("9000"), 0, 2000000000, false]; // Price 10% lower
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("9000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("500")); // Margin - 10% * 5 * Margin = $500
    });
    it("Short and PnL is negative", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("11000"), 0, 2000000000, false]; // Price 10% higher
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("11000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("500")); // Margin - 10% * 5 * Margin = $500
    });
    it("Max win should be capped to 10x", async function () {
      await trading.connect(owner).setMaxWinPercent(1e11);
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("100000"), 0, 2000000000, false]; // Price 1000% higher
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("100000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("10000")); // Max win is Margin * 10 = $10,000
    });
    it("Max win should be unlimited if max win is set to zero", async function () {
      await trading.connect(owner).setMaxWinPercent(0);
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let [margin,,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("1000")); // Should be 1000 without fees

      let closePriceData = [node.address, 0, parseEther("100000"), 0, 2000000000, false]; // Price 10x higher
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("100000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("91000"));
    });
    it("Total loss should pay out zero", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("1000"), 0, 2000000000, false]; // Price 90% lower
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("1000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("0")); // Margin - 90% * 5 * Margin = -$3500, therefore zero
    });
    it("Fees calculations", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,5e6,5e6,1e6,2e6,0);
      await trading.connect(owner).setFees(false,5e6,5e6,1e6,2e6,0);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      expect(await stabletoken.balanceOf(owner.address)).to.equal(0); // Starts with zero balance

      let closePriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false]; // Price is same
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address);
      expect(await stabletoken.balanceOf(owner.address)).to.equal(parseEther("980.1")); // Margin after opening and closing fees and no price change
    });
  });
  describe("Order minimum delay check", function () {
    it("CheckDelay on opening + interaction should work as expected", async function () {
      trading.connect(owner).setBlockDelay(1000); // 1000 block delay
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);

      let closePriceData = [node.address, 0, parseEther("11000"), 0, 2000000000, false];
      let closeMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("11000"), 0, 2000000000, false]
        )
      );
      let closeSig = await node.signMessage(
        Buffer.from(closeMessage.substring(2), 'hex')
      );
      
      await expect(trading.connect(owner).initiateCloseOrder(1, 1e10, closePriceData, closeSig, StableVault.address, StableToken.address, owner.address)).to.be.revertedWith("0");
    });
  });
  describe("Spread calculations", function () {
    it("Open price should be correct after spread", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await trading.connect(owner).setFees(true,0,0,0,0,0); // Easier to calculate without fees
      await trading.connect(owner).setFees(false,0,0,0,0,0); // Easier to calculate without fees

      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, 0, 0, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("10000"), 100000000, 2000000000, false]; // 1% spread
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 100000000, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];

      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      let [,,,,price,,,,,,,] = await position.trades(1);
      expect(price).to.be.equal(parseEther("10100"));

      PermitData = [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false]; // Permit not needed anymore
      let TradeInfo2 = [parseEther("10000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, 0, 0, ethers.constants.HashZero];
      await trading.connect(owner).initiateMarketOrder(TradeInfo2, PriceData, sig, PermitData, owner.address);
      let [,,,,price_short,,,,,,,] = await position.trades(2);
      expect(price_short).to.be.equal(parseEther("9900"));
    });
  });
  describe("Liquidation price view calculations", function () {
    it("Long liquidation price without funding rate", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);      
      expect(await tradinglibrary.getLiqPrice(position.address, 1, 8e9)).to.equal(parseEther("8400"));
    });
    it("Short liquidation price without funding rate", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);      
      expect(await tradinglibrary.getLiqPrice(position.address, 1, 8e9)).to.equal(parseEther("11600"));
    });
    it("Long liquidation price with funding rate", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 1e9); // 10% Annual rate
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await network.provider.send("evm_setNextBlockTimestamp", [2031537000]); // 1 year passes
      await network.provider.send("evm_mine");
      expect(parseInt((await tradinglibrary.getLiqPrice(position.address, 1, 8e9))/1e18)).to.equal(9200); // Small variation from realistic 9200e18 because of Solidity division
    });
    it("Short liquidation price with funding rate", async function () {
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 1e9); // 10% Annual rate
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, false, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      await network.provider.send("evm_setNextBlockTimestamp", [2031536000]); // 1 year passes
      await network.provider.send("evm_mine");
      expect(parseInt((await tradinglibrary.getLiqPrice(position.address, 1, 8e9))/1e18)).to.equal(10800); // Small variation from realistic 10800e18 because of Solidity division
    });
  });
  describe("Referral calculations", function () {
    it("Using a non-created referral code shouldn't refer a trader", async function() {
      // "testcode" not created as a referral code
      let TradeInfo = [parseEther("10000"), MockDAI.address, StableVault.address, parseEther("100"), 0, false, parseEther("0"), parseEther("0"), ethers.utils.id("testcode")];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await referrals.getReferred(owner.address)).to.equal(ethers.constants.HashZero); // Trader not referred
    });
    it("Referrer should receive the correct amount of referral rewards and decreased trading fee should be correct on both opening and closing and referral should be locked", async function () {
      // await trading.connect(owner).setFees(true,3e8,1e8,1e8,1e8,1e8);
      // await trading.connect(owner).setFees(false,3e8,1e8,1e8,1e8,1e8);
      await pairscontract.connect(owner).setAssetBaseFundingRate(0, 0); // Funding rate messes with results because of time
      await referrals.connect(user).createReferralCode(ethers.utils.id("testcode"));
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("0"));

      
      let TradeInfo = [parseEther("10000"), MockDAI.address, StableVault.address, parseEther("100"), 0, false, parseEther("0"), parseEther("0"), ethers.utils.id("testcode")];
      let PriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      

      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // Trade has opened
      let [margin,,,,,,,,,,,] = await position.trades(1);
      expect(margin).to.equal(parseEther("9200")); // No fees taken after opening

      // Referral should be locked for the trader after being used once
      await referrals.connect(user).createReferralCode(ethers.utils.id("testcode2"));

      let TradeInfo2 = [parseEther("10000"), MockDAI.address, StableVault.address, parseEther("100"), 0, true, parseEther("0"), parseEther("0"), ethers.utils.id("testcode2")];
      let PriceData2 = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message2 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig2 = await node.signMessage(
        Buffer.from(message2.substring(2), 'hex')
      );
      let sigs2 = [sig2];
      let PermitData2 = [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false]; // No permit needed

      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("100"));
      await trading.connect(owner).initiateMarketOrder(TradeInfo2, PriceData2, sig2, PermitData2, owner.address);
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("200")); 
      expect(await position.assetOpenPositionsLength(0)).to.equal(2); // Trade has opened
      let [margin2,,,,,,,,,,,] = await position.trades(2);
      expect(margin2).to.equal(parseEther("9200")); // No opening fees taken

      // Referrer should earn fees upon closing
      let PriceData3 = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message3 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig3 = await node.signMessage(
        Buffer.from(message3.substring(2), 'hex')
      );
      let sigs3 = [sig3];
      await trading.connect(owner).initiateCloseOrder(2, 1e10, PriceData3, sig3, StableVault.address, MockDAI.address, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1); // One trade has closed
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("292"));

      // Closing last position
      let PriceData4 = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let message4 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let sig4 = await node.signMessage(
        Buffer.from(message4.substring(2), 'hex')
      );
      let sigs4 = [sig4];
      await trading.connect(owner).initiateCloseOrder(1, 1e10, PriceData4, sig4, StableVault.address, StableToken.address, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(0); // Both trades have closed
      expect(await stabletoken.balanceOf(user.address)).to.equal(parseEther("384")); // Closing: 2 * $1,000,000 * 0.01% = $200
    });
  });
  describe("Comparing node's prices to Chainlink price feed", function () {
    it("Setting Chainlink feed for an asset and enabling Chainlink should work as expected", async function () {
      await pairscontract.connect(owner).setAssetChainlinkFeed(0, chainlink.address);
      expect(await tradingExtension.chainlinkEnabled()).to.equal(false);
      await tradingExtension.connect(owner).setChainlinkEnabled(true);
      expect(await tradingExtension.chainlinkEnabled()).to.equal(true);
    });
    it("Opening a trade with a price that doesn't match Chainlink's price should revert", async function () {
      await pairscontract.connect(owner).setAssetChainlinkFeed(0, chainlink.address);
      await tradingExtension.connect(owner).setChainlinkEnabled(true);
      await chainlink.connect(owner).setPrice(100000000000000); // 10000e10
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address)).to.be.revertedWith("!chainlinkPrice");      
    });
    it("Opening a trade when Chainlink price feed returns zero shouldn't revert", async function () {
      await pairscontract.connect(owner).setAssetChainlinkFeed(0, chainlink.address);
      await tradingExtension.connect(owner).setChainlinkEnabled(true);
      await chainlink.connect(owner).setPrice(0);
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
    });
    it("Opening a trade with a price that matches Chainlink's price shouldn't revert", async function () {
      await pairscontract.connect(owner).setAssetChainlinkFeed(0, chainlink.address);
      await tradingExtension.connect(owner).setChainlinkEnabled(true);
      await chainlink.connect(owner).setPrice(200000000000000); // 20000e10
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("5"), 0, true, parseEther("0"), parseEther("0"), ethers.constants.HashZero];
      let openPriceData = [node.address, 0, parseEther("20000"), 0, 2000000000, false];
      let openMessage = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("20000"), 0, 2000000000, false]
        )
      );
      let openSig = await node.signMessage(
        Buffer.from(openMessage.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, openPriceData, openSig, PermitData, owner.address);
      expect(await position.assetOpenPositionsLength(0)).to.equal(1);
    });
  });
  describe("Open interest calculations", function () {
    it("Should work correctly on long, short, full and partial close", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, 0, 0, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await trading.connect(owner).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      PermitData = [0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero, false]; // Permit not needed anymore
      let [longOi, shortOi] = await pairscontract.idToOi(0, StableToken.address);
      expect(longOi).to.equal(parseEther("9900"));
      expect(shortOi).to.equal(parseEther("0"));
      let TradeInfo2 = [parseEther("10000"), MockDAI.address, StableVault.address, parseEther("10"), 0, false, 0, 0, ethers.constants.HashZero];
      await trading.connect(owner).initiateMarketOrder(TradeInfo2, PriceData, sig, PermitData, owner.address);
      [longOi, shortOi] = await pairscontract.idToOi(0, StableToken.address);
      expect(longOi).to.equal(parseEther("9900"));
      expect(shortOi).to.equal(parseEther("99000"));
      await trading.connect(owner).initiateCloseOrder(1, 5e9, PriceData, sig, StableVault.address, StableToken.address, owner.address);
      [longOi, shortOi] = await pairscontract.idToOi(0, StableToken.address);
      expect(longOi).to.equal(parseEther("4950"));
      expect(shortOi).to.equal(parseEther("99000"));
      await trading.connect(owner).initiateCloseOrder(2, 5e9, PriceData, sig, StableVault.address, StableToken.address, owner.address);
      [longOi, shortOi] = await pairscontract.idToOi(0, StableToken.address);
      expect(longOi).to.equal(parseEther("4950"));
      expect(shortOi).to.equal(parseEther("49500"));
      await trading.connect(owner).initiateCloseOrder(1, 1e10, PriceData, sig, StableVault.address, StableToken.address, owner.address);
      await trading.connect(owner).initiateCloseOrder(2, 1e10, PriceData, sig, StableVault.address, StableToken.address, owner.address);
      [longOi, shortOi] = await pairscontract.idToOi(0, StableToken.address);
      expect(longOi).to.equal(parseEther("0"));
      expect(shortOi).to.equal(parseEther("0"));
    });
  });
  describe("Trading through a proxy", function () {
    it("Should revert if proxy isn't approved", async function () {
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, 0, 0, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(proxy).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("Proxy not approved");
    });
    it("Should revert if proxy approval is expired", async function () {
      await trading.connect(owner).approveProxy(proxy.address, 1, {value: parseEther("1")});
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, 0, 0, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      await expect(trading.connect(proxy).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address)).to.be.revertedWith("Proxy not approved");
    });
    it("Should work as expected if proxy is approved", async function () {
      await trading.connect(owner).approveProxy(proxy.address, 10000000000, {value: parseEther("1")}); // Approved for a very long time
      let TradeInfo = [parseEther("1000"), MockDAI.address, StableVault.address, parseEther("10"), 0, true, 0, 0, ethers.constants.HashZero];
      let PriceData = [node.address, 0, parseEther("10000"), 0, 2000000000, false];
      let message = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool'],
          [node.address, 0, parseEther("10000"), 0, 2000000000, false]
        )
      );
      let sig = await node.signMessage(
        Buffer.from(message.substring(2), 'hex')
      );
      
      let PermitData = [permitSig.deadline, ethers.constants.MaxUint256, permitSig.v, permitSig.r, permitSig.s, true];
      expect(await position.balanceOf(owner.address)).to.be.equals(0);
      await trading.connect(proxy).initiateMarketOrder(TradeInfo, PriceData, sig, PermitData, owner.address);
      expect(await position.balanceOf(owner.address)).to.be.equals(1);
    });
  });
});
