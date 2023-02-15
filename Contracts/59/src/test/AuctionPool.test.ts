import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { AuctionPool } from "../type/AuctionPool";
import { Bonding } from "../type/Bonding";
import { Auction } from "../type/Auction";
import { RewardDistributor } from "../type/RewardDistributor";
import { TransferService } from "../type/TransferService";
import { MaltDataLab } from "../type/MaltDataLab";
import { LiquidityExtension } from "../type/LiquidityExtension";
import { ImpliedCollateralService } from "../type/ImpliedCollateralService";
import { UniswapHandler } from "../type/UniswapHandler";
import { AuctionBurnReserveSkew } from "../type/AuctionBurnReserveSkew";
import { Malt } from "../type/Malt";
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

describe("AuctionPool", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let impliedCollateralService: Signer;
  let miningService: Signer;
  let stabilizerNode: Signer;
  let forfeitDest: Signer;
  let amender: Signer;

  let uniswapHandler: UniswapHandler;
  let auctionPool: AuctionPool;
  let auction: Auction;
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;

  let weth: Contract;
  let router: any;
  let factory: any;

  let mockBonding: Bonding;
  let mockDataLab: MaltDataLab;
  let mockLiquidityExtension: LiquidityExtension;
  let mockImpliedCollateralService: ImpliedCollateralService;
  let mockAuctionBurnReserveSkew: AuctionBurnReserveSkew;
  let mockTransferService: TransferService;

  let maltReserves = utils.parseEther('10000000');
  let daiReserves = utils.parseEther('10000000');

  const auctionLength = 600; // 10 minutes

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, impliedCollateralService, miningService, stabilizerNode, forfeitDest, amender, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();
    const miningServiceAddress = await miningService.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();
    const forfeitDestinationAddress = await forfeitDest.getAddress();
    const amenderAddress = await amender.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;

    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await malt.deployed();
    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    mockBonding = ((await deployMockContract(owner, [
      "function totalBonded() returns (uint256)",
      "function balanceOfBonded(address) returns(uint256)",
    ])) as any) as Bonding;
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

    // Deploy Uniswap Contracts
    const routerContract = new ContractFactory(UniswapV2RouterAbi, UniswapV2RouterBytecode, owner);
    const wethContract = new ContractFactory(WETHAbi, WETHBytecode, owner);

    const factoryContract = new ContractFactory(UniswapV2FactoryAbi, UniswapV2FactoryBytecode, owner);
    factory = await factoryContract.deploy(constants.AddressZero);

    weth = await wethContract.deploy();
    await weth.deployed();
    router = await routerContract.deploy(factory.address, weth.address);
    await router.deployed();

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

    // Deploy the AuctionPool
    const AuctionPoolFactory = await ethers.getContractFactory("AuctionPool");

    auctionPool = (await AuctionPoolFactory.deploy()) as AuctionPool;
    await auctionPool.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      auction.address,
      impliedCollateralServiceAddress,
      mockBonding.address,
      miningServiceAddress,
      forfeitDestinationAddress,
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
    const miningServiceAddress = await miningService.getAddress();

    expect(await auctionPool.bonding()).to.equal(mockBonding.address);
    expect(await auctionPool.auction()).to.equal(auction.address);
    expect(await auctionPool.auctionRewardToken()).to.equal(dai.address);
    expect(await auctionPool.replenishingIndex()).to.equal(0);
    expect(await auctionPool.claimableRewards()).to.equal(0);
    expect(await auctionPool.rewardToken()).to.equal(dai.address);
    expect(await auctionPool.miningService()).to.equal(miningServiceAddress);
    expect(await auctionPool.totalDeclaredReward()).to.equal(0);
    expect(await auctionPool.totalReleasedReward()).to.equal(0);
    expect(await auctionPool.usableBalance()).to.equal(0);
  });

  it("Returns totalBonded from the bonding contract", async function() {
    // Should revert due to lack of mock on bondingContract
    await expect(auctionPool.totalBonded()).to.be.reverted;

    const amountBonded = utils.parseEther('2357');
    await mockBonding.mock.totalBonded.returns(amountBonded);

    expect(await auctionPool.totalBonded()).to.equal(amountBonded);
  });

  it("Returns balanceOfBonded from the bonding contract", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();
    // Should revert due to lack of mock on bondingContract
    await expect(auctionPool.balanceOfBonded(userAddress)).to.be.reverted;

    const amountBonded = utils.parseEther('2357');
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(amountBonded);

    expect(await auctionPool.balanceOfBonded(userAddress)).to.equal(amountBonded);
  });

  it("Only allows miningService to call onUnbond", async function() {
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockBonding.mock.totalBonded.returns(0);

    await auctionPool.connect(miningService).onBond(userAddress, bondAmount);

    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    await expect(auctionPool.connect(user).onUnbond(userAddress, bondAmount)).to.be.reverted;
    await expect(auctionPool.connect(user2).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await auctionPool.connect(miningService).onUnbond(userAddress, bondAmount);
  });

  it("Handles calling onUnbond", async function() {
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockBonding.mock.totalBonded.returns(0);

    await auctionPool.connect(miningService).onBond(userAddress, bondAmount);

    await expect(auctionPool.connect(miningService).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialStakePadding = await auctionPool.balanceOfStakePadding(userAddress);
    expect(initialStakePadding).to.be.above(0);

    await auctionPool.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalStakePadding = await auctionPool.balanceOfStakePadding(userAddress);

    expect(finalStakePadding).to.equal(0);
    expect(await auctionPool.balanceOfRewards(userAddress)).to.equal(0);
  });

  it("Correctly returns usable Balance with 0 claimableRewards", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionPool.address, amountDai);
    expect(await auctionPool.usableBalance()).to.equal(amountDai);
  });

  it("Correctly returns outstanding arb tokens after auction pledge", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const amountDai = utils.parseEther('600');
    await dai.mint(auctionPool.address, amountDai);
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();

    // Start auction
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    // handleDeficit should get called with 0.6 of purchaseAmount
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(amountDai).returns(amountDai);

    // Purchase arb tokens
    await auctionPool.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    const arbTokens = await auction.unclaimedArbTokens();

    expect(await auctionPool.outstandingArbTokens()).to.equal(arbTokens);
    expect(await auctionPool.totalDeclaredReward()).to.equal(arbTokens);
  });

  it("Forfeits unclaimed rewards when unbonding", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const amountDai = utils.parseEther('600');
    await dai.mint(auctionPool.address, amountDai);
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // BOND USER
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();
    const bondAmount = utils.parseEther('1000');
    await mockBonding.mock.totalBonded.returns(0);
    await auctionPool.connect(miningService).onBond(userAddress, bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    // Start auction
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    // handleDeficit should get called with 0.6 of purchaseAmount
    const burnBudget = utils.parseEther('400');
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(amountDai).returns(amountDai);

    // Purchase arb tokens
    await auctionPool.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // Finalize auction
    const finalPurchased = utils.parseEther('800');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);
    await auction.checkAuctionFinalization();

    const unclaimed = await auction.unclaimedArbTokens();
    expect(unclaimed).to.be.withinPercent(amountDai);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(initialBalance).to.equal(0);
    expect(await auctionPool.claimableRewards()).to.equal(0);
    expect(await auctionPool.forfeitedRewards()).to.equal(0);

    await auctionPool.connect(miningService).onUnbond(userAddress, bondAmount);

    // They still haven't been claimed, but they have been forfeited
    expect(await auction.unclaimedArbTokens()).to.equal(unclaimed);
    expect(await auctionPool.forfeitedRewards()).to.equal(unclaimed);
    expect(await auctionPool.claimableRewards()).to.equal(0);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(0)
  });

  it("Additional reward replenishes forfeited", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const amountDai = utils.parseEther('600');
    await dai.mint(auctionPool.address, amountDai);
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();
    const forfeitDestinationAddress = await forfeitDest.getAddress();

    // BOND USER
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();
    const bondAmount = utils.parseEther('1000');
    await mockBonding.mock.totalBonded.returns(0);
    await auctionPool.connect(miningService).onBond(userAddress, bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    // Start auction
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    // handleDeficit should get called with 0.6 of purchaseAmount
    const burnBudget = utils.parseEther('400');
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(amountDai).returns(amountDai);

    // Purchase arb tokens
    await auctionPool.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // Finalize auction
    const finalPurchased = utils.parseEther('800');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);
    await auction.checkAuctionFinalization();

    const unclaimed = await auction.unclaimedArbTokens();
    expect(unclaimed).to.be.withinPercent(amountDai);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(initialBalance).to.equal(0);
    expect(await auctionPool.claimableRewards()).to.equal(0);
    expect(await auctionPool.forfeitedRewards()).to.equal(0);
    expect(await auctionPool.totalDeclaredReward()).to.equal(unclaimed);
    expect(await auctionPool.totalReleasedReward()).to.equal(0);

    await auctionPool.connect(miningService).onUnbond(userAddress, bondAmount);

    // They still haven't been claimed, but they have been forfeited
    expect(await auction.unclaimedArbTokens()).to.equal(unclaimed);
    expect(await auctionPool.forfeitedRewards()).to.equal(unclaimed);
    expect(await auctionPool.claimableRewards()).to.equal(0);
    expect(await auctionPool.totalDeclaredReward()).to.equal(0);
    expect(await auctionPool.totalReleasedReward()).to.equal(0);
    expect(await dai.balanceOf(auctionPool.address)).to.equal(0);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(0)

    /*
     * REPLENISH AUCTION
     */
    // More than required
    const amount = utils.parseEther('1000');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    // CLAIM REWARDS
    await auctionPool.claim();

    expect(await auction.unclaimedArbTokens()).to.equal(0);
    expect(await auctionPool.forfeitedRewards()).to.equal(0);
    expect(await auctionPool.claimableRewards()).to.equal(0);
    expect(await auctionPool.totalDeclaredReward()).to.be.near(BigNumber.from(0), 1);
    expect(await auctionPool.totalReleasedReward()).to.equal(0);
    expect(await dai.balanceOf(auctionPool.address)).to.equal(0);
    // DAI should have been sent to forfeit address
    expect(await dai.balanceOf(forfeitDestinationAddress)).to.equal(unclaimed);
    expect(await auctionPool.usableBalance()).to.equal(0);
  });

  it("Withdraws claimable rewards when unbonding", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const amountDai = utils.parseEther('600');
    await dai.mint(auctionPool.address, amountDai);
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    // BOND USER
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();
    const bondAmount = utils.parseEther('1000');
    await mockBonding.mock.totalBonded.returns(0);
    await auctionPool.connect(miningService).onBond(userAddress, bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    // Start auction
    await mockLiquidityExtension.mock.reserveRatio.returns(utils.parseEther('0.4'), 18);
    // handleDeficit should get called with 0.6 of purchaseAmount
    const burnBudget = utils.parseEther('400');
    await mockImpliedCollateralService.mock.handleDeficit.withArgs(purchaseAmount).returns();
    await mockAuctionBurnReserveSkew.mock.getRealBurnBudget.returns(burnBudget);

    await auction.connect(stabilizerNode).triggerAuction(pegPrice, purchaseAmount);
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(amountDai).returns(amountDai);

    // Purchase arb tokens
    await auctionPool.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // Finalize auction
    const finalPurchased = utils.parseEther('800');
    await mockLiquidityExtension.mock.purchaseAndBurn.withArgs(burnBudget).returns(finalPurchased);
    await dai.mint(auction.address, burnBudget);
    await auction.checkAuctionFinalization();

    /*
     * REPLENISH AUCTION
     */
    // More than required
    const amount = utils.parseEther('1000');
    await dai.mint(stabilizerNodeAddress, amount);
    await dai.connect(stabilizerNode).approve(auction.address, amount);
    await auction.connect(stabilizerNode).allocateArbRewards(amount);

    // CLAIM REWARDS
    await auctionPool.claim();

    const claimable = await auctionPool.claimableRewards();
    expect(claimable).to.be.withinPercent(amountDai)
    expect(await auction.unclaimedArbTokens()).to.equal(0);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(initialBalance).to.equal(0);

    await auctionPool.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(claimable)
  });

  it("Handles unbonding with no bonded balance", async function() {
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockBonding.mock.totalBonded.returns(0);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(0);

    const initialStakePadding = await auctionPool.balanceOfStakePadding(userAddress);
    expect(initialStakePadding).to.equal(0);

    await auctionPool.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalStakePadding = await auctionPool.balanceOfStakePadding(userAddress);

    expect(finalStakePadding).to.equal(0);
    expect(await auctionPool.balanceOfRewards(userAddress)).to.equal(0);
  });

  // TODO copy some tests from ERC20VestedMine Tue 26 Oct 2021 14:31:28 BST

  it("Only allows admin to set bonding", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auctionPool.connect(user).setBonding(newAddress)).to.be.reverted;
    await expect(auctionPool.connect(impliedCollateralService).setBonding(newAddress)).to.be.reverted;

    await auctionPool.connect(admin).setBonding(newAddress);
    expect(await auctionPool.bonding()).to.equal(newAddress);

    await auctionPool.setBonding(new2Address);
    expect(await auctionPool.bonding()).to.equal(new2Address);
  });

  it("Only allows admin to set forfeit destination", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(auctionPool.connect(user).setForfeitDestination(newAddress)).to.be.reverted;
    await expect(auctionPool.connect(impliedCollateralService).setForfeitDestination(newAddress)).to.be.reverted;

    await auctionPool.connect(admin).setForfeitDestination(newAddress);
    expect(await auctionPool.forfeitDestination()).to.equal(newAddress);

    await auctionPool.setForfeitDestination(new2Address);
    expect(await auctionPool.forfeitDestination()).to.equal(new2Address);
  });
});
