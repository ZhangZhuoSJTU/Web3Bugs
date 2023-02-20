import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { StabilizerNode } from "../type/StabilizerNode";
import { Auction } from "../type/Auction";
import { UniswapHandler } from "../type/UniswapHandler";
import { MaltDataLab } from "../type/MaltDataLab";
import { AuctionBurnReserveSkew } from "../type/AuctionBurnReserveSkew";
import { RewardThrottle } from "../type/RewardThrottle";
import { ImpliedCollateralService } from "../type/ImpliedCollateralService";
import { SwingTrader } from "../type/SwingTrader";
import { LiquidityExtension } from "../type/LiquidityExtension";
import { Malt } from "../type/Malt";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";
import AuctionArtifacts from "../artifacts/contracts/Auction.sol/Auction.json";
import UniswapV2FactoryBuild from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniswapV2RouterBuild from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import WETHBuild from "@uniswap/v2-periphery/build/WETH9.json";

const UniswapV2FactoryBytecode = UniswapV2FactoryBuild.bytecode;
const UniswapV2FactoryAbi = UniswapV2FactoryBuild.abi;

const UniswapV2RouterBytecode = UniswapV2RouterBuild.bytecode;
const UniswapV2RouterAbi = UniswapV2RouterBuild.abi;
const WETHBytecode = WETHBuild.bytecode;
const WETHAbi = WETHBuild.abi;

const { deployMockContract } = waffle;

describe("Stabilizer Node", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let dao: Signer;
  let treasury: Signer;
  let auctionPool: Signer;

  let stabilizerNode: StabilizerNode;
  let uniswapHandler: UniswapHandler;
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;

  let mockAuction: Auction;
  let mockDataLab: MaltDataLab;
  let mockAuctionBurnReserveSkew: AuctionBurnReserveSkew;
  let mockRewardThrottle: RewardThrottle;
  let mockSwingTrader: SwingTrader;
  let mockLiquidityExtension: LiquidityExtension;
  let mockTransferService: TransferService;
  let mockImpliedCollateralService: ImpliedCollateralService;

  let weth: Contract;
  let router: any;
  let factory: any;

  let maltReserves = utils.parseEther('10000000');
  let daiReserves = utils.parseEther('10000000');

  let pegPrice = utils.parseEther('1');

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, treasury, auctionPool, dao, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const daoAddress = await dao.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy Uniswap Contracts
    const routerContract = new ContractFactory(UniswapV2RouterAbi, UniswapV2RouterBytecode, owner);
    const wethContract = new ContractFactory(WETHAbi, WETHBytecode, owner);

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;

    // Deploy the StabilizerNode
    const StabilizerNodeFactory = await ethers.getContractFactory("StabilizerNode");

    stabilizerNode = (await StabilizerNodeFactory.deploy()) as StabilizerNode;

    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress, stabilizerNode.address], []);
    await malt.deployed();
    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    const factoryContract = new ContractFactory(UniswapV2FactoryAbi, UniswapV2FactoryBytecode, owner);
    factory = await factoryContract.deploy(constants.AddressZero);

    weth = await wethContract.deploy();
    await weth.deployed();
    router = await routerContract.deploy(factory.address, weth.address);
    await router.deployed();

    await factory.createPair(malt.address, dai.address);
    const lpTokenAddress = await factory.getPair(malt.address, dai.address);

    mockAuction = ((await deployMockContract(owner, AuctionArtifacts.abi)) as any) as Auction;
    mockDataLab = ((await deployMockContract(owner, [
      "function maltPriceAverage(uint256) returns(uint256)",
      "function trackReserveRatio()",
      "function priceTarget() returns(uint256)"
    ])) as any) as MaltDataLab;
    mockAuctionBurnReserveSkew = ((await deployMockContract(owner, [
      "function addAbovePegObservation(uint256)",
      "function addBelowPegObservation(uint256)"
    ])) as any) as AuctionBurnReserveSkew;
    mockRewardThrottle = ((await deployMockContract(owner, [
      "function handleReward()",
      "function checkRewardUnderflow()",
    ])) as any) as RewardThrottle;
    mockSwingTrader = ((await deployMockContract(owner, ["function sellMalt(uint256) returns(uint256)", "function buyMalt(uint256) returns(uint256)"])) as any) as SwingTrader;
    mockLiquidityExtension = ((await deployMockContract(owner, [
      "function hasMinimumReserves() returns(bool)",
      "function collateralDeficit() returns(uint256, uint256)",
    ])) as any) as LiquidityExtension;
    mockImpliedCollateralService = ((await deployMockContract(owner, [
      "function claim()",
    ])) as any) as ImpliedCollateralService;

    await mockDataLab.mock.priceTarget.returns(pegPrice);
    await mockDataLab.mock.trackReserveRatio.returns();
    await mockImpliedCollateralService.mock.claim.returns();
    await mockRewardThrottle.mock.checkRewardUnderflow.returns();

    // Deploy the UniswapHandler
    const UniswapHandlerFactory = await ethers.getContractFactory("UniswapHandler");

    uniswapHandler = (await UniswapHandlerFactory.deploy()) as UniswapHandler;
    await uniswapHandler.initialize(
      ownerAddress,
      adminAddress,
      malt.address,
      dai.address,
      lpTokenAddress,
      router.address,
      factory.address
    );
    await uniswapHandler.deployed();

    await stabilizerNode.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      malt.address,
      mockAuction.address,
      factory.address,
      treasuryAddress,
      auctionPoolAddress
    );

    await stabilizerNode.setupContracts(
      uniswapHandler.address,
      mockDataLab.address,
      mockAuctionBurnReserveSkew.address,
      mockRewardThrottle.address,
      daoAddress,
      mockSwingTrader.address,
      mockLiquidityExtension.address,
      mockImpliedCollateralService.address
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const daoAddress = await dao.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();

    expect(await stabilizerNode.stabilizeBackoffPeriod()).to.equal(5 * 60);
    expect(await stabilizerNode.upperStabilityThreshold()).to.equal(utils.parseEther('0.01'));
    expect(await stabilizerNode.lowerStabilityThreshold()).to.equal(utils.parseEther('0.01'));
    expect(await stabilizerNode.maxContributionBps()).to.equal(70);
    expect(await stabilizerNode.priceAveragePeriod()).to.equal(5 * 60); // 5 minutes
    expect(await stabilizerNode.expansionDampingFactor()).to.equal(1);
    expect(await stabilizerNode.defaultIncentive()).to.equal(100);
    expect(await stabilizerNode.daoRewardCut()).to.equal(0);
    expect(await stabilizerNode.lpRewardCut()).to.equal(417);
    expect(await stabilizerNode.auctionPoolRewardCut()).to.equal(113);
    expect(await stabilizerNode.swingTraderRewardCut()).to.equal(417);
    expect(await stabilizerNode.treasuryRewardCut()).to.equal(50);
    expect(await stabilizerNode.callerRewardCut()).to.equal(3);
    expect(await stabilizerNode.rewardToken()).to.equal(dai.address);
    expect(await stabilizerNode.malt()).to.equal(malt.address);
    expect(await stabilizerNode.auction()).to.equal(mockAuction.address);
    expect(await stabilizerNode.dexHandler()).to.equal(uniswapHandler.address);
    expect(await stabilizerNode.dao()).to.equal(daoAddress);
    expect(await stabilizerNode.uniswapV2Factory()).to.equal(factory.address);
    expect(await stabilizerNode.liquidityExtension()).to.equal(mockLiquidityExtension.address);
    expect(await stabilizerNode.maltDataLab()).to.equal(mockDataLab.address);
    expect(await stabilizerNode.auctionBurnReserveSkew()).to.equal(mockAuctionBurnReserveSkew.address);
    expect(await stabilizerNode.rewardThrottle()).to.equal(mockRewardThrottle.address);
    expect(await stabilizerNode.swingTrader()).to.equal(mockSwingTrader.address);
    expect(await stabilizerNode.auctionPool()).to.equal(auctionPoolAddress);
    expect(await stabilizerNode.treasuryMultisig()).to.equal(treasuryAddress);
  });

  it("Handles calling stabilize when price is at peg", async function() {
    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(false);
    await mockDataLab.mock.maltPriceAverage.returns(pegPrice);

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);
  });

  it("Starts an auction when price is below peg", async function() {
    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.triggerAuction.returns();
    await mockAuction.mock.auctionActive.withArgs(0).returns(false);
    // below peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('0.9'));
    await mockSwingTrader.mock.buyMalt.withArgs(utils.parseEther('47.401408456185201195')).returns(utils.parseEther('1'));
    await mockAuctionBurnReserveSkew.mock.addBelowPegObservation.returns();
    await malt.mint(stabilizerNode.address, utils.parseEther('100'));

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('900'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);
  });

  it("Avoids creating an auction when swing trader covers the trade", async function() {
    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(false);
    // below peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('0.9'));
    // Swing trader uses all of the required size
    await mockSwingTrader.mock.buyMalt.withArgs(utils.parseEther('47.401408456185201195')).returns(utils.parseEther('47.401408456185201195'));

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('900'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    // Because there are no mocks for triggerAuction and other auction related methods
    // This would fail if it tries to create an auction.
    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);
  });

  it("Distributes supply when price is above peg", async function() {
    const ownerAddress = await owner.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const daoAddress = await dao.getAddress();

    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockLiquidityExtension.mock.hasMinimumReserves.returns(true);
    // Don't use it all
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('1'));
    // Mint trade size ahead of time due to stabilizer being mocked
    await malt.mint(stabilizerNode.address, utils.parseEther('48.613437016565175687'));
    // Returns full amount. IE 0 allocated to auction
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('48.613437016565175687'));
    await mockRewardThrottle.mock.handleReward.returns();

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    expect(await dai.balanceOf(ownerAddress)).to.be.above(0);
    expect(await dai.balanceOf(auctionPoolAddress)).to.be.above(0);
    expect(await dai.balanceOf(treasuryAddress)).to.be.above(0);
    expect(await dai.balanceOf(daoAddress)).to.equal(0);
    expect(await dai.balanceOf(mockRewardThrottle.address)).to.be.above(0);

    const [price] = await uniswapHandler.maltMarketPrice();
    expect(price).to.be.withinPercent(pegPrice, 0.005); // within 0.5% of peg
  });

  it("Avoids distributing supply when swing trader can cover the full above peg trade", async function() {
    const ownerAddress = await owner.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const daoAddress = await dao.getAddress();

    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('47.376582963642643588'));

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    // This would fail if it tried to distribute supply due to lack of mocks
    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    expect(await dai.balanceOf(ownerAddress)).to.equal(0);
    expect(await dai.balanceOf(auctionPoolAddress)).to.equal(0);
    expect(await dai.balanceOf(treasuryAddress)).to.equal(0);
    expect(await dai.balanceOf(daoAddress)).to.equal(0);
    expect(await dai.balanceOf(mockRewardThrottle.address)).to.equal(0);
  });

  it("Does not distribute any supply when the auction takes all rewards for replenishing", async function() {
    const ownerAddress = await owner.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const daoAddress = await dao.getAddress();

    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockLiquidityExtension.mock.hasMinimumReserves.returns(true);
    // Don't use it all
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('1'));
    // Mint trade size ahead of time due to stabilizer being mocked
    await malt.mint(stabilizerNode.address, utils.parseEther('48.613437016565175687'));
    // Returns 0. IE all allocated to replenish auction
    await mockAuction.mock.allocateArbRewards.returns(0);

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    expect(await dai.balanceOf(ownerAddress)).to.equal(0);
    expect(await dai.balanceOf(auctionPoolAddress)).to.equal(0);
    expect(await dai.balanceOf(treasuryAddress)).to.equal(0);
    expect(await dai.balanceOf(daoAddress)).to.equal(0);
    expect(await dai.balanceOf(mockRewardThrottle.address)).to.equal(0);

    const [price] = await uniswapHandler.maltMarketPrice();
    expect(price).to.be.withinPercent(pegPrice, 0.005); // within 0.5% of peg
  });

  it("Partially distributes supply when the auction takes some rewards for replenishing", async function() {
    const ownerAddress = await owner.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const daoAddress = await dao.getAddress();

    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockLiquidityExtension.mock.hasMinimumReserves.returns(true);
    // Don't use it all
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('1'));
    // Mint trade size ahead of time due to stabilizer being mocked
    await malt.mint(stabilizerNode.address, utils.parseEther('48.613437016565175687'));
    // Returns something in between. IE auction took some reward to replenish
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('20'));
    await mockRewardThrottle.mock.handleReward.returns();

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    expect(await dai.balanceOf(ownerAddress)).to.be.above(0);
    expect(await dai.balanceOf(auctionPoolAddress)).to.be.above(0);
    expect(await dai.balanceOf(treasuryAddress)).to.be.above(0);
    expect(await dai.balanceOf(daoAddress)).to.equal(0);
    expect(await dai.balanceOf(mockRewardThrottle.address)).to.be.above(0);

    const [price] = await uniswapHandler.maltMarketPrice();
    expect(price).to.be.withinPercent(pegPrice, 0.005); // within 0.5% of peg
  });

  it("Disallows calling stabilize before end of stabilization backoff window", async function() {
    const [user] = accounts;
    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockLiquidityExtension.mock.hasMinimumReserves.returns(true);
    // Don't use it all
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('1'));
    // Mint trade size ahead of time due to stabilizer being mocked
    await malt.mint(stabilizerNode.address, utils.parseEther('48.613437016565175687'));
    // Returns something in between. IE auction took some reward to replenish
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('48.613437016565175687'));
    await mockRewardThrottle.mock.handleReward.returns();

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.connect(user).stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    await expect(stabilizerNode.connect(user).stabilize()).to.be.revertedWith("Can't call stabilize");

    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.01'));
    await increaseTime(4 * 60) // 4 minutes. Not past end of stabilize period

    await expect(stabilizerNode.connect(user).stabilize()).to.be.revertedWith("Can't call stabilize");

    await increaseTime(4 * 60) // Past end of stabilize window. Should work now

    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('0.930289971767951405')).returns(utils.parseEther('0.930289971767951405'));
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('0.930289971767951405'));
    await mockRewardThrottle.mock.handleReward.returns();

    await stabilizerNode.connect(user).stabilize();
  });

  it("Overrides stabilize window when price is too far above peg", async function() {
    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.withArgs(1800).returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockLiquidityExtension.mock.hasMinimumReserves.returns(true);
    // Don't use it all
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('1'));
    // Mint trade size ahead of time due to stabilizer being mocked
    await malt.mint(stabilizerNode.address, utils.parseEther('48.613437016565175687'));
    // Returns something in between. IE auction took some reward to replenish
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('48.613437016565175687'));
    await mockRewardThrottle.mock.handleReward.returns();
    await mockDataLab.mock.maltPriceAverage.returns(pegPrice);

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    // Needs to be at least 30 seconds
    await increaseTime(35);

    await mockDataLab.mock.maltPriceAverage.withArgs(30).returns(utils.parseEther('1.1'));
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('0.930289971767951405')).returns(utils.parseEther('0.930289971767951405'));
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('0.930289971767951405'));
    await mockRewardThrottle.mock.handleReward.returns();

    // Despite not being at end of stabilizeWindow, maltPriceAverage is returning 1.1
    // which is more than 4% above peg so it should stabilize anyway
    await stabilizerNode.stabilize();
  });

  it("Replenishes liquidity extension with profit when there is a collateral deficit", async function() {
    const ownerAddress = await owner.getAddress();
    const auctionPoolAddress = await auctionPool.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const daoAddress = await dao.getAddress();

    await expect(stabilizerNode.stabilize()).to.be.reverted;

    await mockAuction.mock.checkAuctionFinalization.returns();
    // above peg
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1.1'));
    await mockAuctionBurnReserveSkew.mock.addAbovePegObservation.returns();
    await mockLiquidityExtension.mock.hasMinimumReserves.returns(false);
    // Larger deficit than we have in rewards
    await mockLiquidityExtension.mock.collateralDeficit.returns(utils.parseEther('1000'), 18);
    // Don't use it all
    await mockSwingTrader.mock.sellMalt.withArgs(utils.parseEther('47.376582963642643588')).returns(utils.parseEther('1'));
    // Mint trade size ahead of time due to stabilizer being mocked
    await malt.mint(stabilizerNode.address, utils.parseEther('48.613437016565175687'));

    await malt.mint(uniswapHandler.address, utils.parseEther('1000'));
    await dai.mint(uniswapHandler.address, utils.parseEther('1100'));
    await uniswapHandler.addLiquidity();
    await mockAuction.mock.allocateArbRewards.returns(utils.parseEther('14.584031104969552707'));
    await mockRewardThrottle.mock.handleReward.returns();

    const initialStabilizeTime = await stabilizerNode.lastStabilize();

    await stabilizerNode.stabilize();

    const finalStabilizeTime = await stabilizerNode.lastStabilize();
    expect(finalStabilizeTime).to.be.above(initialStabilizeTime);

    expect(await dai.balanceOf(ownerAddress)).to.be.above(0);
    expect(await dai.balanceOf(auctionPoolAddress)).to.be.above(0);
    expect(await dai.balanceOf(treasuryAddress)).to.be.above(0);
    expect(await dai.balanceOf(daoAddress)).to.equal(0);
    expect(await dai.balanceOf(mockRewardThrottle.address)).to.be.above(0);
    expect(await dai.balanceOf(mockLiquidityExtension.address)).to.equal(utils.parseEther('34.029405911595622980'));

    const [price] = await uniswapHandler.maltMarketPrice();
    expect(price).to.be.withinPercent(pegPrice, 0.005); // within 0.5% of peg
  });

  it("Only allows admin to set AuctionBurnReserveSkew", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setAuctionBurnSkew(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setAuctionBurnSkew(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setAuctionBurnSkew(newAddress);
    expect(await stabilizerNode.auctionBurnReserveSkew()).to.equal(newAddress);

    await stabilizerNode.setAuctionBurnSkew(new2Address);
    expect(await stabilizerNode.auctionBurnReserveSkew()).to.equal(new2Address);
  });

  it("Only allows timelock to set Treasury", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setTreasury(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setTreasury(newAddress)).to.be.reverted;
    // Admin is also disallowed from this method
    await expect(stabilizerNode.connect(admin).setTreasury(newAddress)).to.be.reverted;

    await stabilizerNode.setTreasury(new2Address);
    expect(await stabilizerNode.treasuryMultisig()).to.equal(new2Address);
  });

  it("Only allows admin to set MaltDataLab", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setNewDataLab(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setNewDataLab(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setNewDataLab(newAddress);
    expect(await stabilizerNode.maltDataLab()).to.equal(newAddress);

    await stabilizerNode.setNewDataLab(new2Address);
    expect(await stabilizerNode.maltDataLab()).to.equal(new2Address);
  });

  it("Only allows admin to set Auction", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setAuctionContract(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setAuctionContract(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setAuctionContract(newAddress);
    expect(await stabilizerNode.auction()).to.equal(newAddress);

    await stabilizerNode.setAuctionContract(new2Address);
    expect(await stabilizerNode.auction()).to.equal(new2Address);
  });

  it("Only allows admin to set Auction Pool", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setAuctionPool(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setAuctionPool(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setAuctionPool(newAddress);
    expect(await stabilizerNode.auctionPool()).to.equal(newAddress);

    await stabilizerNode.setAuctionPool(new2Address);
    expect(await stabilizerNode.auctionPool()).to.equal(new2Address);
  });

  it("Only allows admin to set Dex Handler", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setDexHandler(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setDexHandler(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setDexHandler(newAddress);
    expect(await stabilizerNode.dexHandler()).to.equal(newAddress);

    await stabilizerNode.setDexHandler(new2Address);
    expect(await stabilizerNode.dexHandler()).to.equal(new2Address);
  });

  it("Only allows admin to set DAO", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setDao(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setDao(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setDao(newAddress);
    expect(await stabilizerNode.dao()).to.equal(newAddress);

    await stabilizerNode.setDao(new2Address);
    expect(await stabilizerNode.dao()).to.equal(new2Address);
  });

  it("Only allows admin to set LiquidityExtension", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setLiquidityExtension(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setLiquidityExtension(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setLiquidityExtension(newAddress);
    expect(await stabilizerNode.liquidityExtension()).to.equal(newAddress);

    await stabilizerNode.setLiquidityExtension(new2Address);
    expect(await stabilizerNode.liquidityExtension()).to.equal(new2Address);
  });

  it("Only allows admin to set Reward Throttle", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setRewardThrottle(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setRewardThrottle(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setRewardThrottle(newAddress);
    expect(await stabilizerNode.rewardThrottle()).to.equal(newAddress);

    await stabilizerNode.setRewardThrottle(new2Address);
    expect(await stabilizerNode.rewardThrottle()).to.equal(new2Address);
  });

  it("Only allows admin to set swing trader", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(stabilizerNode.connect(user).setSwingTrader(newAddress)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setSwingTrader(newAddress)).to.be.reverted;

    await stabilizerNode.connect(admin).setSwingTrader(newAddress);
    expect(await stabilizerNode.swingTrader()).to.equal(newAddress);

    await stabilizerNode.setSwingTrader(new2Address);
    expect(await stabilizerNode.swingTrader()).to.equal(new2Address);
  });

  it("It only allows admins to update stabilizer backoff period", async function() {
    expect(await stabilizerNode.stabilizeBackoffPeriod()).to.equal(5 * 60);

    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setStabilizeBackoff(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setStabilizeBackoff(10)).to.be.reverted;

    const newValue = 356;
    await stabilizerNode.connect(admin).setStabilizeBackoff(newValue);
    expect(await stabilizerNode.stabilizeBackoffPeriod()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setStabilizeBackoff(422);
    expect(await stabilizerNode.stabilizeBackoffPeriod()).to.equal(422);
  });

  it("It only allows admins to update reward cut", async function() {
    const [user] = accounts;

    let dao = 0;
    let lp = 950;
    let caller = 5;
    let treasuryCut = 5;
    let auctionPoolCut = 40;
    let swingTraderCut = 0;

    await expect(stabilizerNode.connect(user).setRewardCut(dao, lp, caller, auctionPoolCut, swingTraderCut)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setRewardCut(dao, lp, caller, auctionPoolCut, swingTraderCut)).to.be.reverted;

    await stabilizerNode.connect(admin).setRewardCut(dao, lp, caller, auctionPoolCut, swingTraderCut);
    expect(await stabilizerNode.daoRewardCut()).to.equal(dao);
    expect(await stabilizerNode.lpRewardCut()).to.equal(lp);
    expect(await stabilizerNode.callerRewardCut()).to.equal(caller);
    expect(await stabilizerNode.treasuryRewardCut()).to.equal(treasuryCut);
    expect(await stabilizerNode.auctionPoolRewardCut()).to.equal(auctionPoolCut);
    expect(await stabilizerNode.swingTraderRewardCut()).to.equal(swingTraderCut);

    dao = 10;
    lp = 930;
    caller = 10;
    treasuryCut = 20;
    auctionPoolCut = 30;
    swingTraderCut = 0;

    await stabilizerNode.connect(admin).setRewardCut(dao, lp, caller, auctionPoolCut, swingTraderCut);
    expect(await stabilizerNode.daoRewardCut()).to.equal(dao);
    expect(await stabilizerNode.lpRewardCut()).to.equal(lp);
    expect(await stabilizerNode.callerRewardCut()).to.equal(caller);
    expect(await stabilizerNode.treasuryRewardCut()).to.equal(treasuryCut);
    expect(await stabilizerNode.auctionPoolRewardCut()).to.equal(auctionPoolCut);
    expect(await stabilizerNode.swingTraderRewardCut()).to.equal(swingTraderCut);
  });

  it("It only allows admins to update defaultIncentive", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setDefaultIncentive(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setDefaultIncentive(10)).to.be.reverted;

    const newValue = 356;
    await stabilizerNode.connect(admin).setDefaultIncentive(newValue);
    expect(await stabilizerNode.defaultIncentive()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setDefaultIncentive(422);
    expect(await stabilizerNode.defaultIncentive()).to.equal(422);
  });

  it("It only allows admins to update expansion damping", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setExpansionDamping(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setExpansionDamping(10)).to.be.reverted;

    const newValue = 356;
    await stabilizerNode.connect(admin).setExpansionDamping(newValue);
    expect(await stabilizerNode.expansionDampingFactor()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setExpansionDamping(422);
    expect(await stabilizerNode.expansionDampingFactor()).to.equal(422);
  });

  it("It only allows admins to update stability thresholds", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setStabilityThresholds(10, 23)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setStabilityThresholds(10, 23)).to.be.reverted;

    const newValue = 35;
    const newValueTwo = 36;
    await stabilizerNode.connect(admin).setStabilityThresholds(newValue, newValueTwo);
    expect(await stabilizerNode.upperStabilityThreshold()).to.equal(newValue);
    expect(await stabilizerNode.lowerStabilityThreshold()).to.equal(newValueTwo);

    // Default signer has the Timelock role
    await stabilizerNode.setStabilityThresholds(422, 88);
    expect(await stabilizerNode.upperStabilityThreshold()).to.equal(422);
    expect(await stabilizerNode.lowerStabilityThreshold()).to.equal(88);
  });

  it("It only allows admins to update max contribution", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setMaxContribution(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setMaxContribution(10)).to.be.reverted;

    const newValue = 35;
    await stabilizerNode.connect(admin).setMaxContribution(newValue);
    expect(await stabilizerNode.maxContributionBps()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setMaxContribution(42);
    expect(await stabilizerNode.maxContributionBps()).to.equal(42);
  });

  it("It only allows admins to update price average period", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setPriceAveragePeriod(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setPriceAveragePeriod(10)).to.be.reverted;

    const newValue = 35;
    await stabilizerNode.connect(admin).setPriceAveragePeriod(newValue);
    expect(await stabilizerNode.priceAveragePeriod()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setPriceAveragePeriod(42);
    expect(await stabilizerNode.priceAveragePeriod()).to.equal(42);
  });

  it("It only allows admins to update fast average period", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setFastAveragePeriod(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setFastAveragePeriod(10)).to.be.reverted;

    const newValue = 35;
    await stabilizerNode.connect(admin).setFastAveragePeriod(newValue);
    expect(await stabilizerNode.fastAveragePeriod()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setFastAveragePeriod(42);
    expect(await stabilizerNode.fastAveragePeriod()).to.equal(42);
  });

  it("It only allows admins to update override distance", async function() {
    const [user] = accounts;

    await expect(stabilizerNode.connect(user).setOverrideDistance(10)).to.be.reverted;
    await expect(stabilizerNode.connect(treasury).setOverrideDistance(10)).to.be.reverted;

    const newValue = 35;
    await stabilizerNode.connect(admin).setOverrideDistance(newValue);
    expect(await stabilizerNode.overrideDistance()).to.equal(newValue);

    // Default signer has the Timelock role
    await stabilizerNode.setOverrideDistance(42);
    expect(await stabilizerNode.overrideDistance()).to.equal(42);
  });
});
