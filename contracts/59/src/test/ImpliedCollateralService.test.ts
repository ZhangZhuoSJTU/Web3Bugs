import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { RewardOverflowPool } from "../type/RewardOverflowPool";
import { AuctionPool } from "../type/AuctionPool";
import { ImpliedCollateralService } from "../type/ImpliedCollateralService";
import { MaltDataLab } from "../type/MaltDataLab";
import { ERC20VestedMine } from "../type/ERC20VestedMine";
import { TransferService } from "../type/TransferService";
import { Malt } from "../type/Malt";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("ImpliedCollateralService", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let auction: Signer;
  let swingTrader: Signer;
  let liquidityExtension: Signer;

  let impliedCollateralService: ImpliedCollateralService;
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;

  let mockAuctionPool: AuctionPool;
  let mockRewardOverflow: RewardOverflowPool;
  let mockDataLab: MaltDataLab;
  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, auction, swingTrader, liquidityExtension, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const auctionAddress = await auction.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();
    const liquidityExtensionAddress = await liquidityExtension.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();
    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await malt.deployed();

    mockAuctionPool = ((await deployMockContract(owner, [
      "function purchaseArbitrageTokens(uint256) returns(uint256)",
      "function claim()"
    ])) as any) as AuctionPool;
    mockRewardOverflow = ((await deployMockContract(owner, [
      "function purchaseArbitrageTokens(uint256) returns(uint256)",
      "function claim()"
    ])) as any) as RewardOverflowPool;
    mockDataLab = ((await deployMockContract(owner, [
      "function smoothedMaltPrice() returns(uint256)",
      "function priceTarget() returns(uint256)",
    ])) as any) as MaltDataLab;
    await mockDataLab.mock.priceTarget.returns(utils.parseEther('1'));

    // Deploy the MiningService
    const ImpliedCollateralServiceFactory = await ethers.getContractFactory("ImpliedCollateralService");

    impliedCollateralService = (await ImpliedCollateralServiceFactory.deploy()) as ImpliedCollateralService;
    await impliedCollateralService.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      malt.address,
      auctionAddress,
      mockAuctionPool.address,
      mockRewardOverflow.address,
      swingTraderAddress,
      liquidityExtensionAddress,
      mockDataLab.address
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await impliedCollateralService.collateralToken()).to.equal(dai.address);
    expect(await impliedCollateralService.malt()).to.equal(malt.address);
    expect(await impliedCollateralService.auctionPool()).to.equal(mockAuctionPool.address);
    expect(await impliedCollateralService.rewardOverflow()).to.equal(mockRewardOverflow.address);
  });

  it("Handles deficit entirely using the auctionPool", async function() {
    const [user] = accounts;
    const amount = utils.parseEther('1000');
    await mockAuctionPool.mock.purchaseArbitrageTokens.withArgs(amount).returns(0);

    await expect(impliedCollateralService.connect(user).handleDeficit(amount)).to.be.reverted;

    // Reward Overflow isn't mocked so if this succeeds it isn't called
    await impliedCollateralService.connect(auction).handleDeficit(amount);
  });

  it("Handles deficit entirely using the rewardOverflow", async function() {
    const amount = utils.parseEther('1000');
    // Returns the entire amount again, meaning it couldn't purchase any
    await mockAuctionPool.mock.purchaseArbitrageTokens.withArgs(amount).returns(amount);

    // Fails due to overflow method not being mocked
    await expect(impliedCollateralService.connect(auction).handleDeficit(amount)).to.be.reverted;

    await mockRewardOverflow.mock.purchaseArbitrageTokens.withArgs(amount).returns(0);

    // Reward Overflow isn't mocked so if this succeeds it isn't called
    await impliedCollateralService.connect(auction).handleDeficit(amount);
  });

  it("Splits deficit between rewardOverflow and auctionPool", async function() {
    const amount = utils.parseEther('1000');
    // Returns the half amount
    await mockAuctionPool.mock.purchaseArbitrageTokens.withArgs(amount).returns(amount.div(2));
    await mockRewardOverflow.mock.purchaseArbitrageTokens.withArgs(amount.div(2)).returns(0);

    await impliedCollateralService.connect(auction).handleDeficit(amount);
  });

  it("Handles calling claim on auction participants", async function() {
    await expect(impliedCollateralService.connect(auction).claim()).to.be.reverted;

    await mockAuctionPool.mock.claim.returns();
    await mockRewardOverflow.mock.claim.returns();

    await impliedCollateralService.connect(auction).claim();
  });

  it("Allows admins to set new reward overflow contract", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(impliedCollateralService.connect(user).setRewardOverflow(newAddress)).to.be.reverted;
    await expect(impliedCollateralService.connect(auction).setRewardOverflow(newAddress)).to.be.reverted;

    await impliedCollateralService.connect(admin).setRewardOverflow(newAddress);
    expect(await impliedCollateralService.rewardOverflow()).to.equal(newAddress);

    await impliedCollateralService.setRewardOverflow(new2Address);
    expect(await impliedCollateralService.rewardOverflow()).to.equal(new2Address);
  });

  it("Allows admins to set new reward auction pool", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(impliedCollateralService.connect(user).setAuctionPool(newAddress)).to.be.reverted;
    await expect(impliedCollateralService.connect(auction).setAuctionPool(newAddress)).to.be.reverted;

    await impliedCollateralService.connect(admin).setAuctionPool(newAddress);
    expect(await impliedCollateralService.auctionPool()).to.equal(newAddress);

    await impliedCollateralService.setAuctionPool(new2Address);
    expect(await impliedCollateralService.auctionPool()).to.equal(new2Address);
  });

  it("Returns collateral value in malt when malt is at peg", async function() {
    const liquidityExtensionAddress = await liquidityExtension.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();

    await mockDataLab.mock.smoothedMaltPrice.returns(utils.parseEther('1'));

    // Mint to all implied collateral locations
    const auctionPoolBalance = utils.parseEther('12348');
    const overflowBalance = utils.parseEther('2723');
    const liquidityExtensionBalance = utils.parseEther('82738');
    const swingTraderBalance = utils.parseEther('3283');
    const swingTraderMaltBalance = utils.parseEther('9292');
    await dai.mint(mockAuctionPool.address, auctionPoolBalance);
    await dai.mint(mockRewardOverflow.address, overflowBalance);
    await dai.mint(liquidityExtensionAddress, liquidityExtensionBalance);
    await dai.mint(swingTraderAddress, swingTraderBalance);
    await malt.mint(swingTraderAddress, swingTraderMaltBalance);

    const total = auctionPoolBalance.add(overflowBalance).add(liquidityExtensionBalance).add(swingTraderBalance).add(swingTraderMaltBalance);

    const collateral = await impliedCollateralService.getCollateralValueInMalt();
    expect(collateral).to.equal(total);
  });

  it("Returns collateral value in malt when malt is below peg", async function() {
    const liquidityExtensionAddress = await liquidityExtension.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();

    await mockDataLab.mock.smoothedMaltPrice.returns(utils.parseEther('0.5'));

    // Mint to all implied collateral locations
    const auctionPoolBalance = utils.parseEther('12348');
    const overflowBalance = utils.parseEther('2723');
    const liquidityExtensionBalance = utils.parseEther('82738');
    const swingTraderBalance = utils.parseEther('3283');
    const swingTraderMaltBalance = utils.parseEther('9292');
    await dai.mint(mockAuctionPool.address, auctionPoolBalance);
    await dai.mint(mockRewardOverflow.address, overflowBalance);
    await dai.mint(liquidityExtensionAddress, liquidityExtensionBalance);
    await dai.mint(swingTraderAddress, swingTraderBalance);
    await malt.mint(swingTraderAddress, swingTraderMaltBalance);

    // Double all the malt values as the price of malt is halved now, so the dai is worth twice as much malt
    const total = (auctionPoolBalance.add(overflowBalance).add(liquidityExtensionBalance).add(swingTraderBalance)).mul(2).add(swingTraderMaltBalance);

    const collateral = await impliedCollateralService.getCollateralValueInMalt();
    expect(collateral).to.equal(total);
  });

  it("Returns collateral value in malt when malt is above peg", async function() {
    const liquidityExtensionAddress = await liquidityExtension.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();

    await mockDataLab.mock.smoothedMaltPrice.returns(utils.parseEther('2'));

    // Mint to all implied collateral locations
    const auctionPoolBalance = utils.parseEther('12348');
    const overflowBalance = utils.parseEther('2723');
    const liquidityExtensionBalance = utils.parseEther('82738');
    const swingTraderBalance = utils.parseEther('3283');
    const swingTraderMaltBalance = utils.parseEther('9292');
    await dai.mint(mockAuctionPool.address, auctionPoolBalance);
    await dai.mint(mockRewardOverflow.address, overflowBalance);
    await dai.mint(liquidityExtensionAddress, liquidityExtensionBalance);
    await dai.mint(swingTraderAddress, swingTraderBalance);
    await malt.mint(swingTraderAddress, swingTraderMaltBalance);

    // Halve all the malt values as the price of malt is doubled now, so the dai is worth half as much malt
    const total = (auctionPoolBalance.add(overflowBalance).add(liquidityExtensionBalance).add(swingTraderBalance)).div(2).add(swingTraderMaltBalance);

    const collateral = await impliedCollateralService.getCollateralValueInMalt();
    expect(collateral).to.equal(total);
  });
});
