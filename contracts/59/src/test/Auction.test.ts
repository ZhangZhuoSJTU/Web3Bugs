import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { UniswapHandler } from "../type/UniswapHandler";
import { SwingTrader } from "../type/SwingTrader";
import { RewardThrottle } from "../type/RewardThrottle";
import { Auction } from "../type/Auction";
import { MaltDataLab } from "../type/MaltDataLab";
import { LiquidityExtension } from "../type/LiquidityExtension";
import { ImpliedCollateralService } from "../type/ImpliedCollateralService";
import { AuctionBurnReserveSkew } from "../type/AuctionBurnReserveSkew";
import { Malt } from "../type/Malt";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";
import UniswapV2RouterBuild from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import UniswapV2FactoryBuild from "@uniswap/v2-core/build/UniswapV2Factory.json";
import WETHBuild from "@uniswap/v2-periphery/build/WETH9.json";
import RewardThrottleArtifacts from "../artifacts/contracts/RewardSystem/RewardThrottle.sol/RewardThrottle.json";

const UniswapV2FactoryBytecode = UniswapV2FactoryBuild.bytecode;
const UniswapV2FactoryAbi = UniswapV2FactoryBuild.abi;

const UniswapV2RouterBytecode = UniswapV2RouterBuild.bytecode;
const UniswapV2RouterAbi = UniswapV2RouterBuild.abi;
const WETHBytecode = WETHBuild.bytecode;
const WETHAbi = WETHBuild.abi;

const { deployMockContract } = waffle;

describe("Auction", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let stabilizerNode: Signer;
  let amender: Signer;

  let uniswapHandler: UniswapHandler;
  let auction: Auction
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;
  let mockRewardThrottle: RewardThrottle;
  let mockDataLab: MaltDataLab;
  let mockLiquidityExtension: LiquidityExtension;
  let mockImpliedCollateralService: ImpliedCollateralService;
  let mockAuctionBurnReserveSkew: AuctionBurnReserveSkew;
  let mockTransferService: TransferService;

  let weth: Contract;
  let router: any;
  let factory: any;

  let maltReserves = utils.parseEther('10000000');
  let daiReserves = utils.parseEther('10000000');

  const auctionLength = 600; // 10 minutes

  async function buyMalt(amount: BigNumber) {
    const [user] = accounts;
    const to = await user.getAddress();
    const path = [dai.address, malt.address];

    await dai.mint(to, amount);
    await dai.connect(user).approve(router.address, amount);

    await router.connect(user).swapExactTokensForTokens(amount, 0, path, to, new Date().getTime() + 10000);
  }

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, stabilizerNode, amender, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();
    const amenderAddress = await amender.getAddress();

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy Uniswap Contracts
    const routerContract = new ContractFactory(UniswapV2RouterAbi, UniswapV2RouterBytecode, owner);
    const wethContract = new ContractFactory(WETHAbi, WETHBytecode, owner);

    const factoryContract = new ContractFactory(UniswapV2FactoryAbi, UniswapV2FactoryBytecode, owner);
    factory = await factoryContract.deploy(constants.AddressZero);

    weth = await wethContract.deploy();
    await weth.deployed();
    router = await routerContract.deploy(factory.address, weth.address);
    await router.deployed();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    // Deploy ERC20 tokens
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await malt.deployed();

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    await factory.createPair(malt.address, dai.address);

    const lpTokenAddress = await factory.getPair(malt.address, dai.address);

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

    // Create the mock reward throttle
    mockRewardThrottle = ((await deployMockContract(owner, RewardThrottleArtifacts.abi)) as any) as RewardThrottle;
    await mockRewardThrottle.mock.handleReward.returns();
    mockDataLab = ((await deployMockContract(owner, [
      "function priceTarget() returns (uint256)",
      "function reserveRatioAverage(uint256) returns (uint256)",
      "function maltPriceAverage(uint256) returns (uint256)"
    ])) as any) as MaltDataLab;
    mockLiquidityExtension = ((await deployMockContract(owner, [
      "function purchaseAndBurn(uint256) returns (uint256)",
      "function reserveRatio() returns (uint256, uint256)"
    ])) as any) as LiquidityExtension;
    mockImpliedCollateralService = ((await deployMockContract(owner, [
      "function handleDeficit(uint256)"
    ])) as any) as ImpliedCollateralService;
    mockAuctionBurnReserveSkew = ((await deployMockContract(owner, [
      "function getRealBurnBudget(uint256, uint256) returns (uint256)"
    ])) as any) as AuctionBurnReserveSkew;

    await mockDataLab.mock.priceTarget.returns(utils.parseEther('1'));
    await mockDataLab.mock.reserveRatioAverage.returns(utils.parseEther('0.4'));
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1'));

    // Deploy the Auction
    const AuctionFactory = await ethers.getContractFactory("Auction");

    auction = (await AuctionFactory.deploy()) as Auction;
    await auction.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      malt.address,
      auctionLength,
      stabilizerNodeAddress,
      mockDataLab.address,
      uniswapHandler.address,
      mockLiquidityExtension.address,
      mockImpliedCollateralService.address,
      mockAuctionBurnReserveSkew.address,
      amenderAddress
    );
    await uniswapHandler.deployed();

    await malt.mint(uniswapHandler.address, maltReserves);
    await dai.mint(uniswapHandler.address, daiReserves);
    await uniswapHandler.addLiquidity();
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    expect(await auction.stabilizerNode()).to.equal(stabilizerNodeAddress);
    expect(await auction.maltDataLab()).to.equal(mockDataLab.address);
    expect(await auction.collateralToken()).to.equal(dai.address);
    expect(await auction.malt()).to.equal(malt.address);
    expect(await auction.dexHandler()).to.equal(uniswapHandler.address);
    expect(await auction.liquidityExtension()).to.equal(mockLiquidityExtension.address);
    expect(await auction.impliedCollateralService()).to.equal(mockImpliedCollateralService.address);
    expect(await auction.auctionBurnReserveSkew()).to.equal(mockAuctionBurnReserveSkew.address);

    expect(await auction.unclaimedArbTokens()).to.equal(0);
    expect(await auction.replenishingAuctionId()).to.equal(0);
    expect(await auction.currentAuctionId()).to.equal(0);
    expect(await auction.claimableArbitrageRewards()).to.equal(0);
    expect(await auction.nextCommitmentId()).to.equal(0);
    expect(await auction.auctionLength()).to.equal(auctionLength);
    expect(await auction.arbTokenReplenishSplit()).to.equal(7000);
    expect(await auction.maxAuctionEnd()).to.equal(900);
  });

  it("Disallows non-stabilizerNode from triggering an auction", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    // handleDeficit should get called with purchaseAmount initially
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();

    await expect(auction.connect(user1).triggerAuction(pegPrice, purchaseAmount)).to.be.reverted;
    await expect(auction.connect(user2).triggerAuction(pegPrice, purchaseAmount)).to.be.reverted;
    await expect(auction.connect(admin).triggerAuction(pegPrice, purchaseAmount)).to.be.reverted;

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);
  });

  it("Allows stabilizerNode to trigger an auction", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;

    // Should revert because mock methods are not in place
    await expect(auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount)).to.be.reverted;

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    // handleDeficit should get called with purchaseAmount initially
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    expect(await auction.isAuctionFinished(0)).to.equal(false);
    expect(await auction.auctionActive(0)).to.equal(true);
    expect(await auction.isAuctionFinalized(0)).to.equal(false);
    expect(await auction.auctionExists(0)).to.equal(true);
    expect(await auction.currentPrice(0)).to.equal(utils.parseEther('1'));

    const [commitments, maxCommitments] = await auction.getAuctionCommitments(0);
    expect(commitments).to.equal(0);
    // 0.6 of purchaseAmount
    expect(maxCommitments).to.equal(utils.parseEther('600'));

    const [startingPrice, endingPrice, finalPrice] = await auction.getAuctionPrices(0);
    expect(startingPrice).to.equal(utils.parseEther('1'));

    expect(endingPrice).to.equal(utils.parseEther('0.6'));
    expect(finalPrice).to.equal(0);

    const auctionZero = await auction.getAuction(0);
    expect(auctionZero.maxCommitments).to.equal(utils.parseEther('600'));
    expect(auctionZero.commitments).to.equal(0);
    expect(auctionZero.startingPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.endingPrice).to.equal(utils.parseEther('0.6'));
    expect(auctionZero.finalPrice).to.equal(0);
    expect(auctionZero.pegPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.startingTime).to.be.above(0);
    expect(auctionZero.endingTime).to.equal(auctionZero.startingTime.add(BigNumber.from(auctionLength)));
    expect(auctionZero.finalBurnBudget).to.equal(0);
    expect(auctionZero.finalPurchased).to.equal(0);

    // Should all be the same
    const activeAuction = await auction.getActiveAuction();
    expect(activeAuction.auctionId).to.equal(0);
    expect(activeAuction.maxCommitments).to.equal(utils.parseEther('600'));
    expect(activeAuction.commitments).to.equal(0);
    expect(activeAuction.maltPurchased).to.equal(0);
    expect(activeAuction.startingPrice).to.equal(utils.parseEther('1'));
    expect(activeAuction.endingPrice).to.equal(utils.parseEther('0.6'));
    expect(activeAuction.finalPrice).to.equal(0);
    expect(activeAuction.pegPrice).to.equal(utils.parseEther('1'));
    expect(activeAuction.startingTime).to.be.above(0);
    expect(activeAuction.endingTime).to.equal(activeAuction.startingTime.add(BigNumber.from(auctionLength)));
    expect(activeAuction.finalBurnBudget).to.equal(0);
    expect(activeAuction.finalPurchased).to.equal(0);
  });

  it("Ends the auction after auction length has elapsed", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(0);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    expect(await auction.isAuctionFinished(0)).to.equal(false);

    await increaseTime(auctionLength / 2);

    expect(await auction.isAuctionFinished(0)).to.equal(false);

    await increaseTime(auctionLength / 2);

    // Auction Period has elapsed, so auction should be marked as finished
    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(true);
    expect(await auction.isAuctionFinalized(0)).to.equal(false);

    await auction.checkAuctionFinalization();

    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(false);
    expect(await auction.isAuctionFinalized(0)).to.equal(true);

    const [_, endingPrice, finalPrice] = await auction.getAuctionPrices(0);
    expect(finalPrice).to.equal(endingPrice)
  });

  it("It linearly reduces price of auction over time", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    const [startingPrice, endingPrice, finalPrice] = await auction.getAuctionPrices(0);

    expect(await auction.currentPrice(0)).to.equal(startingPrice);

    // We are going to check in 20% increments through the auction period
    const priceDecrement = startingPrice.sub(endingPrice).div(5);

    await increaseTime(auctionLength * 0.2);

    let currentPrice = startingPrice.sub(priceDecrement);
    expect(await auction.currentPrice(0)).to.be.withinPercent(currentPrice);

    await increaseTime(auctionLength * 0.2);
    currentPrice = currentPrice.sub(priceDecrement);
    expect(await auction.currentPrice(0)).to.be.withinPercent(currentPrice);

    await increaseTime(auctionLength * 0.2);
    currentPrice = currentPrice.sub(priceDecrement);
    expect(await auction.currentPrice(0)).to.be.withinPercent(currentPrice);

    await increaseTime(auctionLength * 0.2);
    currentPrice = currentPrice.sub(priceDecrement);
    expect(await auction.currentPrice(0)).to.be.withinPercent(currentPrice);

    await increaseTime(auctionLength * 0.2);
    currentPrice = currentPrice.sub(priceDecrement);
    expect(await auction.currentPrice(0)).to.equal(currentPrice);
    expect(await auction.currentPrice(0)).to.equal(endingPrice)

    expect(await auction.isAuctionFinished(0)).to.equal(true);
  });

  it("Disallows purchasing arb tokens where there isn't an active auction", async function() {
    const amount = utils.parseEther('1000');
    await expect(auction.purchaseArbitrageTokens(amount)).to.be.reverted;
  });

  it("Disallows purchasing arb tokens after auction finishes", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(0);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    await increaseTime(auctionLength);

    await expect(auction.purchaseArbitrageTokens(purchaseAmount)).to.be.reverted;
  });

  it("Allows pledging full amount to active auction", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user] = accounts;
    const userAddress = await user.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // This is actually the max desired raise
    const userCommitment = utils.parseEther('600');
    await dai.mint(userAddress, userCommitment);
    await dai.connect(user).approve(auction.address, userCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user).purchaseArbitrageTokens(userCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userCommitment).returns(userCommitment);

    await auction.connect(user).purchaseArbitrageTokens(userCommitment);

    const currentPrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    let [
      commitments,
      maxCommitments
    ] = await auction.getAuctionCommitments(0);

    expect(commitments).to.equal(maxCommitments);
    expect(commitments).to.equal(userCommitment);

    // Because maxCommitments ends the auction this value gets populated
    const expectedArbTokens = utils.parseEther((600 / currentPrice).toString());
    expect(await auction.unclaimedArbTokens()).to.be.withinPercent(expectedArbTokens);

    // Move past end of auction
    await increaseTime(auctionLength);

    const arbTokens = await auction.balanceOfArbTokens(0, userAddress);
    expect(arbTokens).to.be.withinPercent(expectedArbTokens);
    expect(await auction.unclaimedArbTokens()).to.be.withinPercent(expectedArbTokens); 
    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(false);
    expect(await auction.claimableArbitrageRewards()).to.equal(0);
    // This was hard coded into a mock of purchaseAndBurn. Each $1 bought 1 malt
    expect(await auction.averageMaltPrice(0)).to.equal(utils.parseEther('1'));
    expect(await auction.userClaimableArbTokens(userAddress, 0)).to.equal(0);

    const {
      auctions,
      commitments: userCommitments,
      awardedTokens,
      redeemedTokens,
      finalPrice,
      claimable,
      finished,
    } = await auction.getAccountCommitments(userAddress);
    expect(auctions.length).to.equal(1)
    expect(auctions[0]).to.equal(0);
    expect(userCommitments[0]).to.equal(userCommitment);
    expect(awardedTokens[0]).to.be.withinPercent(expectedArbTokens);
    expect(redeemedTokens[0]).to.equal(0);
    expect(finalPrice[0]).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(claimable[0]).to.equal(0);
    expect(finished[0]).to.equal(true);

    const accountAuctions = await auction.getAccountCommitmentAuctions(userAddress);
    expect(accountAuctions.length).to.equal(1);
    expect(accountAuctions[0]).to.equal(0);

    await dai.mint(auction.address, burnBudget);
    // This should fails as the call to purchaseAndBurn with burnBudget isn't mocked yet
    await expect(auction.checkAuctionFinalization()).to.be.reverted;

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);

    await auction.checkAuctionFinalization();

    const auctionZero = await auction.getAuction(0);
    expect(auctionZero.maxCommitments).to.equal(utils.parseEther('600'));
    expect(auctionZero.commitments).to.equal(auctionZero.maxCommitments);
    expect(auctionZero.startingPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.endingPrice).to.equal(utils.parseEther('0.6'));
    expect(auctionZero.finalPrice).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(auctionZero.pegPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.finalBurnBudget).to.equal(burnBudget);
    expect(auctionZero.finalPurchased).to.equal(finalPurchased);
  });

  it("Allows pledging half amount to active auction", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user] = accounts;
    const userAddress = await user.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // This is half desired raise
    const userCommitment = utils.parseEther('300');
    await dai.mint(userAddress, userCommitment);
    await dai.connect(user).approve(auction.address, userCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user).purchaseArbitrageTokens(userCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userCommitment).returns(userCommitment);

    await auction.connect(user).purchaseArbitrageTokens(userCommitment);

    let [
      commitments,
      maxCommitments
    ] = await auction.getAuctionCommitments(0);

    expect(commitments).to.equal(maxCommitments.div(2));
    expect(commitments).to.equal(userCommitment);

    // This only gets populated at the end of the auction
    expect(await auction.unclaimedArbTokens()).to.equal(0);

    // Move past end of auction
    await increaseTime(auctionLength);

    // User bid half way through but the auction price continued to
    // drop down to endingPrice because the auction wasn't over.
    // user should have received $300 worth of tokens at 0.6. 
    // So 500 arb tokens
    const expectedArbTokens = utils.parseEther((300 / 0.6).toString());
    const arbTokens = await auction.balanceOfArbTokens(0, userAddress);
    expect(arbTokens).to.be.withinPercent(expectedArbTokens);
    // The auction hasn't been ended yet
    expect(await auction.unclaimedArbTokens()).to.equal(0); 
    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(true);
    expect(await auction.claimableArbitrageRewards()).to.equal(0);
    // This was hard coded into a mock of purchaseAndBurn. Each $1 bought 1 malt
    expect(await auction.averageMaltPrice(0)).to.equal(utils.parseEther('1'));
    expect(await auction.userClaimableArbTokens(userAddress, 0)).to.equal(0);

    const {
      auctions,
      commitments: userCommitments,
      awardedTokens,
      redeemedTokens,
      finalPrice,
      claimable,
      finished,
    } = await auction.getAccountCommitments(userAddress);
    expect(auctions.length).to.equal(1)
    expect(auctions[0]).to.equal(0);
    expect(userCommitments[0]).to.equal(userCommitment);
    expect(awardedTokens[0]).to.be.withinPercent(expectedArbTokens);
    expect(redeemedTokens[0]).to.equal(0);
    expect(finalPrice[0]).to.be.withinPercent(utils.parseEther('0.6'));
    expect(claimable[0]).to.equal(0);
    expect(finished[0]).to.equal(true);

    const accountAuctions = await auction.getAccountCommitmentAuctions(userAddress);
    expect(accountAuctions.length).to.equal(1);
    expect(accountAuctions[0]).to.equal(0);

    await dai.mint(auction.address, burnBudget);
    // This should fails as the call to purchaseAndBurn with burnBudget isn't mocked yet
    await expect(auction.checkAuctionFinalization()).to.be.reverted;

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);

    await auction.checkAuctionFinalization();

    // Now the auction is finalized unclaimedArbTokens should return correctly
    expect(await auction.unclaimedArbTokens()).to.equal(expectedArbTokens); 
    expect(await auction.auctionActive(0)).to.equal(false);

    const auctionZero = await auction.getAuction(0);
    expect(auctionZero.maxCommitments).to.equal(utils.parseEther('600'));
    expect(auctionZero.commitments).to.equal(userCommitment);
    expect(auctionZero.startingPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.endingPrice).to.equal(utils.parseEther('0.6'));
    expect(auctionZero.finalPrice).to.be.withinPercent(utils.parseEther('0.6'));
    expect(auctionZero.pegPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.finalBurnBudget).to.equal(burnBudget);
    expect(auctionZero.finalPurchased).to.equal(finalPurchased);
  });

  it("Handles a user trying to pledge more than full amount", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user] = accounts;
    const userAddress = await user.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // This is more than the desired raise of 600
    const userCommitment = utils.parseEther('1000');
    const realUserCommitment = utils.parseEther('600');
    await dai.mint(userAddress, userCommitment);
    await dai.connect(user).approve(auction.address, userCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user).purchaseArbitrageTokens(userCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(realUserCommitment).returns(realUserCommitment);

    await auction.connect(user).purchaseArbitrageTokens(userCommitment);

    const currentPrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    let [
      commitments,
      maxCommitments
    ] = await auction.getAuctionCommitments(0);

    expect(commitments).to.equal(maxCommitments);
    expect(commitments).to.equal(realUserCommitment);

    // Because maxCommitments ends the auction this value gets populated
    const expectedArbTokens = utils.parseEther((600 / currentPrice).toString());
    expect(await auction.unclaimedArbTokens()).to.be.withinPercent(expectedArbTokens);

    // Move past end of auction
    await increaseTime(auctionLength);

    const arbTokens = await auction.balanceOfArbTokens(0, userAddress);
    expect(arbTokens).to.be.withinPercent(expectedArbTokens);
    expect(await auction.unclaimedArbTokens()).to.be.withinPercent(expectedArbTokens); 
    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(false);
    expect(await auction.claimableArbitrageRewards()).to.equal(0);
    // This was hard coded into a mock of purchaseAndBurn. Each $1 bought 1 malt
    expect(await auction.averageMaltPrice(0)).to.equal(utils.parseEther('1'));
    expect(await auction.userClaimableArbTokens(userAddress, 0)).to.equal(0);

    const {
      auctions,
      commitments: userCommitments,
      awardedTokens,
      redeemedTokens,
      finalPrice,
      claimable,
      finished,
    } = await auction.getAccountCommitments(userAddress);
    expect(auctions.length).to.equal(1)
    expect(auctions[0]).to.equal(0);
    expect(userCommitments[0]).to.equal(realUserCommitment);
    expect(awardedTokens[0]).to.be.withinPercent(expectedArbTokens);
    expect(redeemedTokens[0]).to.equal(0);
    expect(finalPrice[0]).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(claimable[0]).to.equal(0);
    expect(finished[0]).to.equal(true);

    const accountAuctions = await auction.getAccountCommitmentAuctions(userAddress);
    expect(accountAuctions.length).to.equal(1);
    expect(accountAuctions[0]).to.equal(0);

    await dai.mint(auction.address, burnBudget);
    // This should fails as the call to purchaseAndBurn with burnBudget isn't mocked yet
    await expect(auction.checkAuctionFinalization()).to.be.reverted;

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);

    await auction.checkAuctionFinalization();

    const auctionZero = await auction.getAuction(0);
    expect(auctionZero.maxCommitments).to.equal(utils.parseEther('600'));
    expect(auctionZero.commitments).to.equal(auctionZero.maxCommitments);
    expect(auctionZero.startingPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.endingPrice).to.equal(utils.parseEther('0.6'));
    expect(auctionZero.finalPrice).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(auctionZero.pegPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.finalBurnBudget).to.equal(burnBudget);
    expect(auctionZero.finalPurchased).to.equal(finalPurchased);
  });

  it("Handles multiple users pledging", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to quarter way through the auction
    await increaseTime(auctionLength / 4);

    // Less than total of 600
    const userOneCommitment = utils.parseEther('450');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user1).purchaseArbitrageTokens(userOneCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 4);

    // Makes up total of 600
    const userTwoCommitment = utils.parseEther('150');
    await dai.mint(userTwoAddress, userTwoCommitment);
    await dai.connect(user2).approve(auction.address, userTwoCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user2).purchaseArbitrageTokens(userTwoCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userTwoCommitment).returns(userTwoCommitment);
    await auction.connect(user2).purchaseArbitrageTokens(userTwoCommitment);

    const currentPrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    // Assertions at the end
    let [
      commitments,
      maxCommitments
    ] = await auction.getAuctionCommitments(0);

    expect(commitments).to.equal(maxCommitments);
    expect(commitments).to.equal(userOneCommitment.add(userTwoCommitment));

    // Move past end of auction
    await increaseTime(auctionLength);

    // Because maxCommitments ends the auction this value gets populated
    const expectedTotalArbTokens = utils.parseEther((600 / currentPrice).toString());
    expect(await auction.unclaimedArbTokens()).to.be.withinPercent(expectedTotalArbTokens);

    const expectedUserOneArbTokens = utils.parseEther((450 / currentPrice).toString());
    const expectedUserTwoArbTokens = utils.parseEther((150 / currentPrice).toString());

    const userOneArbTokens = await auction.balanceOfArbTokens(0, userOneAddress);
    expect(userOneArbTokens).to.be.withinPercent(expectedUserOneArbTokens);
    const userTwoArbTokens = await auction.balanceOfArbTokens(0, userTwoAddress);
    expect(userTwoArbTokens).to.be.withinPercent(expectedUserTwoArbTokens);

    expect(await auction.unclaimedArbTokens()).to.be.withinPercent(expectedTotalArbTokens); 
    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(false);
    expect(await auction.claimableArbitrageRewards()).to.equal(0);
    // This was hard coded into a mock of purchaseAndBurn. Each $1 bought 1 malt
    expect(await auction.averageMaltPrice(0)).to.equal(utils.parseEther('1'));
    expect(await auction.userClaimableArbTokens(userOneAddress, 0)).to.equal(0);
    expect(await auction.userClaimableArbTokens(userTwoAddress, 0)).to.equal(0);

    const {
      auctions,
      commitments: userCommitments,
      awardedTokens,
      redeemedTokens,
      finalPrice,
      claimable,
      finished,
    } = await auction.getAccountCommitments(userOneAddress);
    expect(auctions.length).to.equal(1)
    expect(auctions[0]).to.equal(0);
    expect(userCommitments[0]).to.equal(userOneCommitment);
    expect(awardedTokens[0]).to.be.withinPercent(expectedUserOneArbTokens);
    expect(redeemedTokens[0]).to.equal(0);
    expect(finalPrice[0]).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(claimable[0]).to.equal(0);
    expect(finished[0]).to.equal(true);

    const {
      auctions: userTwoAuctions,
      commitments: userTwoCommitments,
      awardedTokens: userTwoAwardedTokens,
      redeemedTokens: userTwoRedeemedTokens,
      finalPrice: userTwoFinalPrice,
      claimable: userTwoClaimable,
      finished: userTwoFinished,
    } = await auction.getAccountCommitments(userTwoAddress);
    expect(userTwoAuctions.length).to.equal(1)
    expect(userTwoAuctions[0]).to.equal(0);
    expect(userTwoCommitments[0]).to.equal(userTwoCommitment);
    expect(userTwoAwardedTokens[0]).to.be.withinPercent(expectedUserTwoArbTokens);
    expect(userTwoRedeemedTokens[0]).to.equal(0);
    expect(userTwoFinalPrice[0]).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(userTwoClaimable[0]).to.equal(0);
    expect(userTwoFinished[0]).to.equal(true);

    const accountOneAuctions = await auction.getAccountCommitmentAuctions(userOneAddress);
    expect(accountOneAuctions.length).to.equal(1);
    expect(accountOneAuctions[0]).to.equal(0);
    const accountTwoAuctions = await auction.getAccountCommitmentAuctions(userTwoAddress);
    expect(accountTwoAuctions.length).to.equal(1);
    expect(accountTwoAuctions[0]).to.equal(0);

    await dai.mint(auction.address, burnBudget);
    // This should fails as the call to purchaseAndBurn with burnBudget isn't mocked yet
    await expect(auction.checkAuctionFinalization()).to.be.reverted;

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);

    await auction.checkAuctionFinalization();

    const auctionZero = await auction.getAuction(0);
    expect(auctionZero.maxCommitments).to.equal(utils.parseEther('600'));
    expect(auctionZero.commitments).to.equal(auctionZero.maxCommitments);
    expect(auctionZero.startingPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.endingPrice).to.equal(utils.parseEther('0.6'));
    expect(auctionZero.finalPrice).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(auctionZero.pegPrice).to.equal(utils.parseEther('1'));
    expect(auctionZero.finalBurnBudget).to.equal(burnBudget);
    expect(auctionZero.finalPurchased).to.equal(finalPurchased);
  });

  it("Allows stabilizerNode to allocate arb rewards", async function() {
    const amount = utils.parseEther('1000');
    await auction.connect(stabilizerNode).allocateArbRewards(amount);
  });

  it("Disalllows non-stabilizerNode from allocating arb rewards", async function() {
    const amount = utils.parseEther('1000');
    const [user1, user2] = accounts;

    await expect(auction.connect(user1).allocateArbRewards(amount)).to.be.reverted;
    await expect(auction.connect(user2).allocateArbRewards(amount)).to.be.reverted;
  });

  it("Correctly handles stabilizerNode allocating it more than required", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user1).purchaseArbitrageTokens(userOneCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);
    const currentPrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await increaseTime(auctionLength);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    const initialAuctionBalance = await dai.balanceOf(auction.address);

    expect(await auction.replenishingAuctionId()).to.equal(0);

    const expectedArbTokens = utils.parseEther((600 / currentPrice).toString());
    /*
     * REPLENISH AUCTION
     */
    // More than required
    const amount = utils.parseEther('10000');
    await dai.mint(stabilizerNodeAddress, amount);
    const initialStabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    const stabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    expect(stabilizerBalance).to.be.near(initialStabilizerBalance.sub(expectedArbTokens), 100000);

    const finalAuctionBalance = await dai.balanceOf(auction.address);

    expect(finalAuctionBalance).to.be.near(initialAuctionBalance.add(expectedArbTokens), 100000);

    expect(await auction.replenishingAuctionId()).to.equal(1);
  });

  it("Correctly handles stabilizerNode allocating it less than required", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user1).purchaseArbitrageTokens(userOneCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const currentPrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await increaseTime(auctionLength);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    const initialAuctionBalance = await dai.balanceOf(auction.address);

    expect(await auction.replenishingAuctionId()).to.equal(0);

    const expectedArbTokens = utils.parseEther((600 / currentPrice).toString());
    /*
     * REPLENISH AUCTION
     */
    // Less than required
    const amount = utils.parseEther('100');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    const initialStabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    const stabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    // 100 was awarded but arbTokenReplenishSplit ensures only max of 70% gets used
    expect(stabilizerBalance).to.equal(utils.parseEther('30'));

    const finalAuctionBalance = await dai.balanceOf(auction.address);

    // Again, only 70 gets used out of the 100 due to arbTokenReplenishSplit
    expect(finalAuctionBalance).to.be.near(initialAuctionBalance.add(utils.parseEther('70')), 100000);

    // Haven't replenished the full balance for auction 0 yet
    expect(await auction.replenishingAuctionId()).to.equal(0);

    /*
     * FINISH REPLENISH
     */
    const secondAmount = utils.parseEther('1000');
    await dai.mint(stabilizerNodeAddress, secondAmount);
    await dai.connect(stabilizerNode).approve(auction.address, secondAmount);
    await auction.connect(stabilizerNode).allocateArbRewards(secondAmount);

    expect(await auction.replenishingAuctionId()).to.equal(1);
  });

  it("Handles replenishing multiple consecutive auctions", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount.mul(2)).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    /*
     * Auction 1
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await increaseTime(auctionLength);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    /*
     * Auction 2
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount.mul(2));

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 1200
    const userTwoCommitment = utils.parseEther('1200');
    await dai.mint(userTwoAddress, userTwoCommitment);
    await dai.connect(user2).approve(auction.address, userTwoCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userTwoCommitment).returns(userTwoCommitment);
    await auction.connect(user2).purchaseArbitrageTokens(userTwoCommitment);

    const auctionTwoPrice = parseFloat(utils.formatEther(await auction.currentPrice(1)));

    await increaseTime(auctionLength);

    // Mock it
    await dai.mint(auction.address, burnBudget);
    await auction.checkAuctionFinalization();

    const initialAuctionBalance = await dai.balanceOf(auction.address);

    expect(await auction.replenishingAuctionId()).to.equal(0);

    const expectedArbTokensOne = utils.parseEther((600 / auctionOnePrice).toString());
    const expectedArbTokensTwo = utils.parseEther((1200 / auctionTwoPrice).toString());
    /*
     * REPLENISH AUCTION
     */
    // Less than required
    const amount = utils.parseEther('100');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    const initialStabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    const stabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    // 100 was awarded but arbTokenReplenishSplit ensures only max of 70% gets used
    expect(stabilizerBalance).to.equal(utils.parseEther('30'));

    const finalAuctionBalance = await dai.balanceOf(auction.address);

    // Again, only 70 gets used out of the 100 due to arbTokenReplenishSplit
    expect(finalAuctionBalance).to.be.near(initialAuctionBalance.add(utils.parseEther('70')), 100000);

    // Haven't replenished the full balance for auction 0 yet
    expect(await auction.replenishingAuctionId()).to.equal(0);

    /*
     * SECOND REPLENISH
     */
    const secondAmount = utils.parseEther('1000');
    await dai.mint(stabilizerNodeAddress, secondAmount);
    await dai.connect(stabilizerNode).approve(auction.address, secondAmount);
    await auction.connect(stabilizerNode).allocateArbRewards(secondAmount);

    expect(await auction.replenishingAuctionId()).to.equal(1);

    /*
     * FINAL REPLENISH
     */
    const finalAmount = utils.parseEther('10000');
    await dai.mint(stabilizerNodeAddress, finalAmount);
    await dai.connect(stabilizerNode).approve(auction.address, finalAmount);
    await auction.connect(stabilizerNode).allocateArbRewards(finalAmount);

    expect(await auction.replenishingAuctionId()).to.equal(2);

    expect(await auction.userClaimableArbTokens(userOneAddress, 0)).to.be.withinPercent(expectedArbTokensOne);
    expect(await auction.userClaimableArbTokens(userTwoAddress, 1)).to.be.withinPercent(expectedArbTokensTwo);
  });

  it("Handles skipping replenishing an auction that got 0 bids", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount.mul(2)).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    /*
     * Auction 1
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await increaseTime(auctionLength);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    /*
     * Auction 2
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount.mul(2));
    await increaseTime(auctionLength);

    // This auction got 0 bids so realBurnBudget = 0
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(0);
    await auction.checkAuctionFinalization();

    const initialAuctionBalance = await dai.balanceOf(auction.address);

    expect(await auction.replenishingAuctionId()).to.equal(0);

    const expectedArbTokensOne = utils.parseEther((600 / auctionOnePrice).toString());
    /*
     * REPLENISH AUCTION
     */
    // Less than required
    const amount = utils.parseEther('100');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    const initialStabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    const stabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    // 100 was awarded but arbTokenReplenishSplit ensures only max of 70% gets used
    expect(stabilizerBalance).to.equal(utils.parseEther('30'));

    const finalAuctionBalance = await dai.balanceOf(auction.address);

    // Again, only 70 gets used out of the 100 due to arbTokenReplenishSplit
    expect(finalAuctionBalance).to.be.near(initialAuctionBalance.add(utils.parseEther('70')), 100000);

    // Haven't replenished the full balance for auction 0 yet
    expect(await auction.replenishingAuctionId()).to.equal(0);

    /*
     * SECOND REPLENISH
     */
    const secondAmount = utils.parseEther('1000');
    await dai.mint(stabilizerNodeAddress, secondAmount);
    await dai.connect(stabilizerNode).approve(auction.address, secondAmount);
    await auction.connect(stabilizerNode).allocateArbRewards(secondAmount);

    // Should skip ID 1 as that had no bids
    expect(await auction.replenishingAuctionId()).to.equal(2);
  });

  it("Disallows redemption of arb tokens for auction that hasn't happened yet", async function() {
    const [user1, user2] = accounts;

    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;
    await expect(auction.connect(user2).claimArbitrage(0)).to.be.reverted;
  });

  it("Disallows redemption of arb tokens before they are available", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount.mul(2)).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    /*
     * Auction 1
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await increaseTime(auctionLength);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;
  });

  it("Allows a user to redeem all arb tokens when available", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount.mul(2)).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    /*
     * Auction 1
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;
    await increaseTime(auctionLength);
    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;

    const totalArbBalance = await auction.balanceOfArbTokens(0, userOneAddress);
    const totalUserClaimable = await auction.userClaimableArbTokens(userOneAddress, 0);
    expect(totalUserClaimable).to.equal(0);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    const expectedArbTokensOne = utils.parseEther((600 / auctionOnePrice).toString());

    expect(totalArbBalance).to.be.withinPercent(expectedArbTokensOne);
    /*
     * REPLENISH AUCTION
     */
    // More than required
    const amount = utils.parseEther('10000');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);
    
    const finalUserClaimable = await auction.userClaimableArbTokens(userOneAddress, 0);
    expect(finalUserClaimable).to.equal(totalArbBalance);

    const initialBalance = await dai.balanceOf(userOneAddress);

    await auction.connect(user1).claimArbitrage(0);

    const finalBalance = await dai.balanceOf(userOneAddress);

    expect(finalBalance).to.be.withinPercent(initialBalance.add(expectedArbTokensOne));
  });

  it("Allows a user to partially redeem some arb tokens when available", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount.mul(2)).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    /*
     * Auction 1
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;
    await increaseTime(auctionLength);
    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;

    const totalArbBalance = await auction.balanceOfArbTokens(0, userOneAddress);
    const totalUserClaimable = await auction.userClaimableArbTokens(userOneAddress, 0);
    expect(totalUserClaimable).to.equal(0);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    const expectedArbTokensOne = utils.parseEther((600 / auctionOnePrice).toString());

    expect(totalArbBalance).to.be.withinPercent(expectedArbTokensOne);
    /*
     * REPLENISH AUCTION
     */
    // Less than required
    const amount = utils.parseEther('100');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);
    
    // Only 70% of the 100 is used to replenish due to arbTokenReplenishSplit
    const realClaimable = utils.parseEther('70');
    const finalUserClaimable = await auction.userClaimableArbTokens(userOneAddress, 0);
    expect(finalUserClaimable).to.be.near(realClaimable);

    const initialBalance = await dai.balanceOf(userOneAddress);

    await auction.connect(user1).claimArbitrage(0);

    const finalBalance = await dai.balanceOf(userOneAddress);

    expect(finalBalance).to.be.withinPercent(initialBalance.add(realClaimable));
    expect(await auction.userClaimableArbTokens(userOneAddress, 0)).to.be.near(BigNumber.from(0));
    expect(await auction.claimableArbitrageRewards()).to.be.near(BigNumber.from(0));
  });

  it("Allows multiple users to claim a pro-rata share of a partial auction replenish", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to quarter way through the auction
    await increaseTime(auctionLength / 4);

    // Less than total of 600
    const userOneCommitment = utils.parseEther('400');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user1).purchaseArbitrageTokens(userOneCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 4);

    // Makes up total of 600
    const userTwoCommitment = utils.parseEther('200');
    await dai.mint(userTwoAddress, userTwoCommitment);
    await dai.connect(user2).approve(auction.address, userTwoCommitment);

    // This call should fail because we haven't mocked purchaseAndBurn
    await expect(auction.connect(user2).purchaseArbitrageTokens(userTwoCommitment)).to.be.reverted;
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userTwoCommitment).returns(userTwoCommitment);
    await auction.connect(user2).purchaseArbitrageTokens(userTwoCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;
    await expect(auction.connect(user2).claimArbitrage(0)).to.be.reverted;
    await increaseTime(auctionLength);
    await expect(auction.connect(user1).claimArbitrage(0)).to.be.reverted;
    await expect(auction.connect(user2).claimArbitrage(0)).to.be.reverted;

    const totalArbBalanceOne = await auction.balanceOfArbTokens(0, userOneAddress);
    const totalUserClaimableOne = await auction.userClaimableArbTokens(userOneAddress, 0);
    expect(totalUserClaimableOne).to.equal(0);

    const totalArbBalanceTwo = await auction.balanceOfArbTokens(0, userTwoAddress);
    const totalUserClaimableTwo = await auction.userClaimableArbTokens(userTwoAddress, 0);
    expect(totalUserClaimableTwo).to.equal(0);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    const expectedArbTokensOne = utils.parseEther((400 / auctionOnePrice).toString());
    const expectedArbTokensTwo = utils.parseEther((200 / auctionOnePrice).toString());

    expect(totalArbBalanceOne).to.be.withinPercent(expectedArbTokensOne);
    expect(totalArbBalanceTwo).to.be.withinPercent(expectedArbTokensTwo);
    /*
     * REPLENISH AUCTION
     */
    // Less than required
    const amount = utils.parseEther('100');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);
    
    // Only 70% of the 100 is used to replenish due to arbTokenReplenishSplit
    const realClaimable = utils.parseEther('70');
    const finalUserClaimableOne = await auction.userClaimableArbTokens(userOneAddress, 0);
    const finalUserClaimableTwo = await auction.userClaimableArbTokens(userTwoAddress, 0);
    // Each user gets a pro-rata share of the replenished amount
    // user 1 gets 2/3rds and user 2 gets 1/3rd
    expect(finalUserClaimableOne).to.be.near(realClaimable.mul(2).div(3));
    expect(finalUserClaimableTwo).to.be.near(realClaimable.mul(1).div(3));

    const initialBalanceOne = await dai.balanceOf(userOneAddress);
    const initialBalanceTwo = await dai.balanceOf(userTwoAddress);

    await auction.connect(user1).claimArbitrage(0);

    const finalBalanceOne = await dai.balanceOf(userOneAddress);
    expect(finalBalanceOne).to.be.withinPercent(initialBalanceOne.add(finalUserClaimableOne));

    expect(await auction.userClaimableArbTokens(userOneAddress, 0)).to.be.near(BigNumber.from(0));
    expect(await auction.userClaimableArbTokens(userTwoAddress, 0)).to.equal(finalUserClaimableTwo);

    await auction.connect(user2).claimArbitrage(0);

    const finalBalanceTwo = await dai.balanceOf(userTwoAddress);
    expect(finalBalanceTwo).to.be.withinPercent(initialBalanceTwo.add(finalUserClaimableTwo));

    expect(await auction.userClaimableArbTokens(userOneAddress, 0)).to.be.near(BigNumber.from(0));
    expect(await auction.userClaimableArbTokens(userTwoAddress, 0)).to.be.near(BigNumber.from(0));
    expect(await auction.claimableArbitrageRewards()).to.be.near(BigNumber.from(0));
  });

  it("Allows redemption of arb tokens for auctions that are covered but disallows others", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount.mul(2)).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    /*
     * Auction 1
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 600
    const userOneCommitment = utils.parseEther('600');
    await dai.mint(userOneAddress, userOneCommitment);
    await dai.connect(user1).approve(auction.address, userOneCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userOneCommitment).returns(userOneCommitment);
    await auction.connect(user1).purchaseArbitrageTokens(userOneCommitment);

    const auctionOnePrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    await increaseTime(auctionLength);

    // Mock it
    const finalPurchased = utils.parseEther('500');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);

    await auction.checkAuctionFinalization();

    /*
     * Auction 2
     */
    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount.mul(2));

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // Exactly total of 1200
    const userTwoCommitment = utils.parseEther('1200');
    await dai.mint(userTwoAddress, userTwoCommitment);
    await dai.connect(user2).approve(auction.address, userTwoCommitment);

    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userTwoCommitment).returns(userTwoCommitment);
    await auction.connect(user2).purchaseArbitrageTokens(userTwoCommitment);

    const auctionTwoPrice = parseFloat(utils.formatEther(await auction.currentPrice(1)));

    await increaseTime(auctionLength);

    // Mock it
    await dai.mint(auction.address, burnBudget);
    await auction.checkAuctionFinalization();

    expect(await auction.replenishingAuctionId()).to.equal(0);

    const expectedArbTokensOne = utils.parseEther((600 / auctionOnePrice).toString());
    const expectedArbTokensTwo = utils.parseEther((1200 / auctionTwoPrice).toString());
    /*
     * REPLENISH AUCTION
     */
    // More than required
    const amount = utils.parseEther('10000');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    const initialStabilizerBalance = await dai.balanceOf(stabilizerNodeAddress);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    expect(await auction.replenishingAuctionId()).to.equal(1);

    const finalUserClaimable = await auction.userClaimableArbTokens(userOneAddress, 0);
    expect(finalUserClaimable).to.be.withinPercent(expectedArbTokensOne);

    const initialBalance = await dai.balanceOf(userOneAddress);
    expect(await auction.balanceOfArbTokens(0, userOneAddress)).to.be.withinPercent(expectedArbTokensOne)

    await auction.connect(user1).claimArbitrage(0);

    const finalBalance = await dai.balanceOf(userOneAddress);

    expect(finalBalance).to.be.withinPercent(initialBalance.add(expectedArbTokensOne));
    expect(await auction.userClaimableArbTokens(userOneAddress, 0)).to.be.near(BigNumber.from(0));
    expect(await auction.claimableArbitrageRewards()).to.be.near(BigNumber.from(0));

    // User 2 was involved in auction 1 not 0
    const finalUserTwoClaimable = await auction.userClaimableArbTokens(userTwoAddress, 1);
    expect(finalUserTwoClaimable).to.equal(0);
    expect(await auction.balanceOfArbTokens(1, userTwoAddress)).to.be.withinPercent(expectedArbTokensTwo)

    await expect(auction.connect(user2).claimArbitrage(1)).to.be.reverted;
  });

  it("Only allows the amender to amend an account's auction participation", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user] = accounts;
    const userAddress = await user.getAddress();

    // Add mocks
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    const burnBudget = utils.parseEther('400');
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);

    // Go to half way through the auction
    // Price will be around the mid point between 0.6 and 1 = 0.8
    await increaseTime(auctionLength / 2);

    // This is actually the max desired raise
    const userCommitment = utils.parseEther('600');
    await dai.mint(userAddress, userCommitment);
    await dai.connect(user).approve(auction.address, userCommitment);
    // Mock it
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(userCommitment).returns(userCommitment);
    await auction.connect(user).purchaseArbitrageTokens(userCommitment);

    const [initialUserCommitment, initialUserRedeemed, initialUserMaltPurchased] = await auction.getAuctionParticipationForAccount(userAddress, 0);
    expect(initialUserCommitment).to.equal(userCommitment);
    expect(initialUserRedeemed).to.equal(0);
    expect(initialUserMaltPurchased).to.equal(userCommitment);

    await expect(auction.amendAccountParticipation(userAddress, 0, userCommitment, userCommitment.div(2))).to.be.reverted;

    await auction.connect(amender).amendAccountParticipation(userAddress, 0, userCommitment, userCommitment.div(2));

    const [finalUserCommitment, finalUserRedeemed, finalUserMaltPurchased] = await auction.getAuctionParticipationForAccount(userAddress, 0);
    expect(finalUserCommitment).to.equal(0);
    expect(finalUserRedeemed).to.equal(0);
    expect(finalUserMaltPurchased).to.equal(userCommitment.div(2));

    const currentPrice = parseFloat(utils.formatEther(await auction.currentPrice(0)));

    let [
      commitments,
      maxCommitments
    ] = await auction.getAuctionCommitments(0);

    expect(commitments).to.equal(0);
    expect(commitments).to.equal(0);

    // Because maxCommitments ends the auction this value gets populated
    expect(await auction.unclaimedArbTokens()).to.equal(0);

    // Move past end of auction
    await increaseTime(auctionLength);

    const arbTokens = await auction.balanceOfArbTokens(0, userAddress);
    expect(arbTokens).to.equal(0);
    expect(await auction.unclaimedArbTokens()).to.equal(0); 
    expect(await auction.isAuctionFinished(0)).to.equal(true);
    expect(await auction.auctionActive(0)).to.equal(false);
    expect(await auction.claimableArbitrageRewards()).to.equal(0);
    expect(await auction.averageMaltPrice(0)).to.equal(0);
    expect(await auction.userClaimableArbTokens(userAddress, 0)).to.equal(0);

    const {
      auctions,
      commitments: userCommitments,
      awardedTokens,
      redeemedTokens,
      finalPrice,
      claimable,
      finished,
    } = await auction.getAccountCommitments(userAddress);
    expect(auctions.length).to.equal(1)
    expect(auctions[0]).to.equal(0);
    expect(userCommitments[0]).to.equal(0);
    expect(awardedTokens[0]).to.equal(0);
    expect(redeemedTokens[0]).to.equal(0);
    expect(finalPrice[0]).to.be.withinPercent(utils.parseEther(currentPrice.toString()));
    expect(claimable[0]).to.equal(0);
    expect(finished[0]).to.equal(true);

    const accountAuctions = await auction.getAccountCommitmentAuctions(userAddress);
    expect(accountAuctions.length).to.equal(1);
    expect(accountAuctions[0]).to.equal(0);
  });

  it("It only allows admins to update auction length", async function() {
    expect(await auction.auctionLength()).to.equal(auctionLength);

    const [user] = accounts;

    await expect(auction.connect(user).setAuctionLength(10)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setAuctionLength(10)).to.be.reverted;

    await auction.connect(admin).setAuctionLength(200);
    expect(await auction.auctionLength()).to.equal(200);

    // Default signer has the Timelock role
    await auction.setAuctionLength(400);
    expect(await auction.auctionLength()).to.equal(400);
  });

  it("It only allows admins to update replenish ID", async function() {
    expect(await auction.replenishingAuctionId()).to.equal(0);

    const [user] = accounts;

    await expect(auction.connect(user).setAuctionReplenishId(10)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setAuctionReplenishId(10)).to.be.reverted;

    await auction.connect(admin).setAuctionReplenishId(200);
    expect(await auction.replenishingAuctionId()).to.equal(200);

    // Default signer has the Timelock role
    await auction.setAuctionReplenishId(400);
    expect(await auction.replenishingAuctionId()).to.equal(400);
  });

  it("It only allows admins to update auction replenish split", async function() {
    expect(await auction.arbTokenReplenishSplit()).to.equal(7000);

    const [user] = accounts;

    await expect(auction.connect(user).setTokenReplenishSplit(10)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setTokenReplenishSplit(10)).to.be.reverted;

    await auction.connect(admin).setTokenReplenishSplit(200);
    expect(await auction.arbTokenReplenishSplit()).to.equal(200);

    // Default signer has the Timelock role
    await auction.setTokenReplenishSplit(400);
    expect(await auction.arbTokenReplenishSplit()).to.equal(400);
  });

  it("It only allows admins to update max auction end", async function() {
    expect(await auction.maxAuctionEnd()).to.equal(900);

    const [user] = accounts;

    await expect(auction.connect(user).setMaxAuctionEnd(10)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setMaxAuctionEnd(10)).to.be.reverted;

    await auction.connect(admin).setMaxAuctionEnd(200);
    expect(await auction.maxAuctionEnd()).to.equal(200);

    // Default signer has the Timelock role
    await auction.setMaxAuctionEnd(400);
    expect(await auction.maxAuctionEnd()).to.equal(400);
  });

  it("Only allows admin to set stabilizerNode", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auction.connect(user).setStabilizerNode(newAddress)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setStabilizerNode(newAddress)).to.be.reverted;

    await auction.connect(admin).setStabilizerNode(newAddress);
    expect(await auction.stabilizerNode()).to.equal(newAddress);

    await auction.setStabilizerNode(new2Address);
    expect(await auction.stabilizerNode()).to.equal(new2Address);
  });

  it("Only allows admin to set maltDataLab", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auction.connect(user).setMaltDataLab(newAddress)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setMaltDataLab(newAddress)).to.be.reverted;

    await auction.connect(admin).setMaltDataLab(newAddress);
    expect(await auction.maltDataLab()).to.equal(newAddress);

    await auction.setMaltDataLab(new2Address);
    expect(await auction.maltDataLab()).to.equal(new2Address);
  });

  it("Only allows admin to set dexHanlder", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auction.connect(user).setDexHandler(newAddress)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setDexHandler(newAddress)).to.be.reverted;

    await auction.connect(admin).setDexHandler(newAddress);
    expect(await auction.dexHandler()).to.equal(newAddress);

    await auction.setDexHandler(new2Address);
    expect(await auction.dexHandler()).to.equal(new2Address);
  });

  it("Only allows admin to set liquidity Extension", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auction.connect(user).setLiquidityExtension(newAddress)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setLiquidityExtension(newAddress)).to.be.reverted;

    await auction.connect(admin).setLiquidityExtension(newAddress);
    expect(await auction.liquidityExtension()).to.equal(newAddress);

    await auction.setLiquidityExtension(new2Address);
    expect(await auction.liquidityExtension()).to.equal(new2Address);
  });

  it("Only allows admin to set implied collateral", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auction.connect(user).setImpliedCollateralService(newAddress)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setImpliedCollateralService(newAddress)).to.be.reverted;

    await auction.connect(admin).setImpliedCollateralService(newAddress);
    expect(await auction.impliedCollateralService()).to.equal(newAddress);

    await auction.setImpliedCollateralService(new2Address);
    expect(await auction.impliedCollateralService()).to.equal(new2Address);
  });

  it("Only allows admin to set auction burn reserve skew", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auction.connect(user).setAuctionBurnReserveSkew(newAddress)).to.be.reverted;
    await expect(auction.connect(stabilizerNode).setAuctionBurnReserveSkew(newAddress)).to.be.reverted;

    await auction.connect(admin).setAuctionBurnReserveSkew(newAddress);
    expect(await auction.auctionBurnReserveSkew()).to.equal(newAddress);

    await auction.setAuctionBurnReserveSkew(new2Address);
    expect(await auction.auctionBurnReserveSkew()).to.equal(new2Address);
  });
});
