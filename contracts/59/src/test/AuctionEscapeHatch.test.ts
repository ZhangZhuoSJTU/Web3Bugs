import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { UniswapHandler } from "../type/UniswapHandler";
import { SwingTrader } from "../type/SwingTrader";
import { RewardThrottle } from "../type/RewardThrottle";
import { Auction } from "../type/Auction";
import { AuctionEscapeHatch } from "../type/AuctionEscapeHatch";
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

describe("AuctionEscapeHatch", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;

  let auctionEscapeHatch: AuctionEscapeHatch;
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;

  let mockAuction: Auction;
  let mockTransferService: TransferService;
  let mockUniswapHandler: UniswapHandler;

  const cooloffPeriod = 60 * 60 * 24; // 24 hours

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();

    const ERC20Factory = await ethers.getContractFactory("Malt");

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    // Deploy ERC20 tokens
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    // Deploy the Auction
    const AuctionEscapeHatchFactory = await ethers.getContractFactory("AuctionEscapeHatch");
    auctionEscapeHatch = (await AuctionEscapeHatchFactory.deploy()) as AuctionEscapeHatch;

    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress, auctionEscapeHatch.address], []);
    await malt.deployed();

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    // Create the mock auction
    mockAuction = ((await deployMockContract(owner, [
      "function getAuctionCore(uint256) returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)",
      "function getAuctionParticipationForAccount(address, uint256) returns (uint256, uint256, uint256)",
      "function amendAccountParticipation(address, uint256, uint256, uint256)"
    ])) as any) as Auction;
    mockUniswapHandler = ((await deployMockContract(owner, [
      "function maltMarketPrice() returns (uint256, uint256)",
      "function sellMalt() returns (uint256)",
    ])) as any) as UniswapHandler;


    await auctionEscapeHatch.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      malt.address,
      mockAuction.address,
      mockUniswapHandler.address
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await auctionEscapeHatch.auction()).to.equal(mockAuction.address);
    expect(await auctionEscapeHatch.dexHandler()).to.equal(mockUniswapHandler.address);
    expect(await auctionEscapeHatch.collateralToken()).to.equal(dai.address);
    expect(await auctionEscapeHatch.malt()).to.equal(malt.address);
    expect(await auctionEscapeHatch.maxEarlyExitBps()).to.equal(200);
  });

  it("Reverts when calling exit early on an active auction", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('1200');
    const isActive = true;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    expect(expectedReturn).to.equal(0);
    await expect(auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0)).to.be.revertedWith("Cannot exit early on an active auction");
  });

  it("Reverts when calling exit early with 0 amount", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('1000');
    const isActive = false;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );
    // For convenience this is set to 1 and maltPurchased == purchaseAmount
    await mockUniswapHandler.mock.maltMarketPrice.returns(pegPrice, 18);

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    expect(expectedReturn).to.equal(purchaseAmount);
    await expect(auctionEscapeHatch.connect(user1).exitEarly(0, 0, 0)).to.be.revertedWith("Nothing to claim");
  });

  it("Reverts when calling exit early on an auction you didn't participate in", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('1000');
    const isActive = false;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    // No user participation
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      0, 0, 0
    );
    // For convenience this is set to 1 and maltPurchased == purchaseAmount
    await mockUniswapHandler.mock.maltMarketPrice.returns(pegPrice, 18);

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    expect(expectedReturn).to.equal(0);
    await expect(auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0)).to.be.revertedWith("Nothing to claim");
  });

  it("Returns correct amount when exiting early above the entry", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('2000'); // implies price of $0.5
    const isActive = false;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    // No user participation
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );
    const maltQuantity = utils.parseEther('1200');
    const amountRewarded = utils.parseEther('1200');
    // Purchase price during the auction was $0.5. Now its $1
    await mockUniswapHandler.mock.maltMarketPrice.returns(pegPrice, 18);
    await mockAuction.mock.amendAccountParticipation.withArgs(userAddress, 0, purchaseAmount, maltQuantity).returns();
    await mockUniswapHandler.mock.sellMalt.returns(amountRewarded);

    // Mint a bunch to the contract so it has enough to do what it needs to
    // This is necessary because the requestMint and dexHandler are both mocked
    // so will not return any tokens
    await malt.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));
    await dai.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    // Full return is $2000 as 2000 malt was purchased that is worth $1 each now.
    // That is $1000 profit. Profit is throttled to 20% therefore $200 profit. So $1200 returned
    expect(expectedReturn).to.equal(amountRewarded);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0);

    expect(await dai.balanceOf(userAddress)).to.equal(amountRewarded);

    const [auctionExitedEarly, auctionExitReturn, auctionMaltUsed] = await auctionEscapeHatch.globalAuctionExits(0);
    expect(auctionExitedEarly).to.equal(purchaseAmount);
    expect(auctionExitReturn).to.equal(amountRewarded);
    expect(auctionMaltUsed).to.equal(maltQuantity);
    const [accountExitedEarly, accountExitReturn, accountMaltUsed] = await auctionEscapeHatch.accountAuctionExits(userAddress, 0);
    expect(accountExitedEarly).to.equal(purchaseAmount);
    expect(accountExitReturn).to.equal(amountRewarded);
    expect(accountMaltUsed).to.equal(maltQuantity);
  });

  it("Returns correct amount when exiting early below the entry", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('2000'); // implies price of $0.5
    const isActive = false;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    // No user participation
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );
    const amountRewarded = utils.parseEther('500');
    // Purchase price during the auction was $0.5. Now its $0.25
    await mockUniswapHandler.mock.maltMarketPrice.returns(utils.parseEther('0.25'), 18);
    await mockAuction.mock.amendAccountParticipation.withArgs(userAddress, 0, purchaseAmount, maltPurchased).returns();
    await mockUniswapHandler.mock.sellMalt.returns(amountRewarded);

    // Mint a bunch to the contract so it has enough to do what it needs to
    // This is necessary because the requestMint and dexHandler are both mocked
    // so will not return any tokens
    await malt.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));
    await dai.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    // Full return is 2000 malt at the current price of $0.25 therefore $500 returned for -$500 loss
    expect(expectedReturn).to.equal(amountRewarded);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0);

    expect(await dai.balanceOf(userAddress)).to.equal(amountRewarded);

    const [auctionExitedEarly, auctionExitReturn, auctionMaltUsed] = await auctionEscapeHatch.globalAuctionExits(0);
    expect(auctionExitedEarly).to.equal(purchaseAmount);
    expect(auctionExitReturn).to.equal(amountRewarded);
    expect(auctionMaltUsed).to.equal(maltPurchased);
    const [accountExitedEarly, accountExitReturn, accountMaltUsed] = await auctionEscapeHatch.accountAuctionExits(userAddress, 0);
    expect(accountExitedEarly).to.equal(purchaseAmount);
    expect(accountExitReturn).to.equal(amountRewarded);
    expect(accountMaltUsed).to.equal(maltPurchased);
  });

  it("Returns correct amount when exiting early at entry", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('2000'); // implies price of $0.5
    const isActive = false;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    // No user participation
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );
    // Purchase price during the auction was $0.5. Price hasn't moved
    await mockUniswapHandler.mock.maltMarketPrice.returns(utils.parseEther('0.5'), 18);
    await mockAuction.mock.amendAccountParticipation.withArgs(userAddress, 0, purchaseAmount, maltPurchased).returns();
    await mockUniswapHandler.mock.sellMalt.returns(purchaseAmount);

    // Mint a bunch to the contract so it has enough to do what it needs to
    // This is necessary because the requestMint and dexHandler are both mocked
    // so will not return any tokens
    await malt.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));
    await dai.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    // Full return is $2000 as 2000 malt was purchased that is worth $1 each now.
    // That is $1000 profit. Profit is throttled to 20% therefore $200 profit. So $1200 returned
    expect(expectedReturn).to.equal(purchaseAmount);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0);

    expect(await dai.balanceOf(userAddress)).to.equal(purchaseAmount);

    const [auctionExitedEarly, auctionExitReturn, auctionMaltUsed] = await auctionEscapeHatch.globalAuctionExits(0);
    expect(auctionExitedEarly).to.equal(purchaseAmount);
    expect(auctionExitReturn).to.equal(purchaseAmount);
    expect(auctionMaltUsed).to.equal(maltPurchased);
    const [accountExitedEarly, accountExitReturn, accountMaltUsed] = await auctionEscapeHatch.accountAuctionExits(userAddress, 0);
    expect(accountExitedEarly).to.equal(purchaseAmount);
    expect(accountExitReturn).to.equal(purchaseAmount);
    expect(accountMaltUsed).to.equal(maltPurchased);
  });

  it("Returns nothing when calling exit early after all reward has been redeemed", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('2000'); // implies price of $0.5
    const isActive = false;
    // endingTime is set to 0 to ensure we are after cooloff period
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, 0, isActive);
    // Full purchaseAmount has been redeemed
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, purchaseAmount, maltPurchased
    );

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    // All reward has already been redeemed so it cannot be exited early
    expect(expectedReturn).to.equal(0);

    await expect(auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0)).to.be.revertedWith("Nothing to claim");

    const [auctionExitedEarly, auctionExitReturn, auctionMaltUsed] = await auctionEscapeHatch.globalAuctionExits(0);
    expect(auctionExitedEarly).to.equal(0);
    expect(auctionExitReturn).to.equal(0);
    expect(auctionMaltUsed).to.equal(0);
    const [accountExitedEarly, accountExitReturn, accountMaltUsed] = await auctionEscapeHatch.accountAuctionExits(userAddress, 0);
    expect(accountExitedEarly).to.equal(0);
    expect(accountExitReturn).to.equal(0);
    expect(accountMaltUsed).to.equal(0);
  });

  it("Returns 0 profit when exiting early at the end of the auction despite price being well above entry", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('2000'); // implies price of $0.5
    const isActive = false;
    const endingTime = Math.floor(new Date().getTime() / 1000)
    // endingTime is set to 0 to ensure we are after cooloff period
    // price is also at peg but the profit won't be realisable yet
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, endingTime, isActive);
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );
    await mockUniswapHandler.mock.maltMarketPrice.returns(pegPrice, 18);
    await mockAuction.mock.amendAccountParticipation.withArgs(userAddress, 0, purchaseAmount, purchaseAmount).returns();
    await mockUniswapHandler.mock.sellMalt.returns(purchaseAmount);

    // Mint a bunch to the contract so it has enough to do what it needs to
    // This is necessary because the requestMint and dexHandler are both mocked
    // so will not return any tokens
    await malt.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));
    await dai.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    // Because we are right at the end of the auction the max profit is close to 0 despite price being double entry
    expect(expectedReturn).to.equal(purchaseAmount);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0);

    expect(await dai.balanceOf(userAddress)).to.equal(purchaseAmount);

    // Just returns initial investment, despite price being significantly into profit
    const [auctionExitedEarly, auctionExitReturn, auctionMaltUsed] = await auctionEscapeHatch.globalAuctionExits(0);
    expect(auctionExitedEarly).to.equal(purchaseAmount);
    expect(auctionExitReturn).to.equal(purchaseAmount);
    expect(auctionMaltUsed).to.equal(purchaseAmount);

    const [accountExitedEarly, accountExitReturn, accountMaltUsed] = await auctionEscapeHatch.accountAuctionExits(userAddress, 0);
    expect(accountExitedEarly).to.equal(purchaseAmount);
    expect(accountExitReturn).to.equal(purchaseAmount);
    expect(accountMaltUsed).to.equal(purchaseAmount);
  });

  it("Returns half max profit when exiting early half way through cooloff period", async function() {
    const pegPrice = utils.parseEther('1');
    const purchaseAmount = utils.parseEther('1000');
    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();

    // Add mocks
    const maltPurchased = utils.parseEther('2000'); // implies price of $0.5
    const isActive = false;
    // Max profit is 20%. Real profit is $1000 therefore max is $200. However we are only
    // half way through the cooloff period so the actual profit is $100 + original $1000
    const desiredReturn = utils.parseEther('1100');
    const now = Math.floor(new Date().getTime() / 1000)
    const endingTime = now - (cooloffPeriod / 2); // puts us 1/2 way into cooloff period
    // endingTime is set to 0 to ensure we are after cooloff period
    // price is also at peg but the profit won't be realisable yet
    await mockAuction.mock.getAuctionCore.withArgs(0).returns(
      0, purchaseAmount, maltPurchased, 0, 0, pegPrice, 0, endingTime, isActive);
    await mockAuction.mock.getAuctionParticipationForAccount.withArgs(userAddress, 0).returns(
      purchaseAmount, 0, maltPurchased
    );
    await mockUniswapHandler.mock.maltMarketPrice.returns(pegPrice, 18);
    await mockAuction.mock.amendAccountParticipation.withArgs(userAddress, 0, purchaseAmount, desiredReturn).returns();
    await mockUniswapHandler.mock.sellMalt.returns(desiredReturn);

    // Mint a bunch to the contract so it has enough to do what it needs to
    // This is necessary because the requestMint and dexHandler are both mocked
    // so will not return any tokens
    await malt.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));
    await dai.mint(auctionEscapeHatch.address, utils.parseEther('1000000'));

    const expectedReturn = await auctionEscapeHatch.earlyExitReturn(userAddress, 0, purchaseAmount);
    expect(expectedReturn).to.equal(desiredReturn);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await auctionEscapeHatch.connect(user1).exitEarly(0, purchaseAmount, 0);

    expect(await dai.balanceOf(userAddress)).to.equal(desiredReturn);

    // Just returns initial investment, despite price being significantly into profit
    const [auctionExitedEarly, auctionExitReturn, auctionMaltUsed] = await auctionEscapeHatch.globalAuctionExits(0);
    expect(auctionExitedEarly).to.equal(purchaseAmount);
    expect(auctionExitReturn).to.equal(desiredReturn);
    expect(auctionMaltUsed).to.equal(desiredReturn);

    const [accountExitedEarly, accountExitReturn, accountMaltUsed] = await auctionEscapeHatch.accountAuctionExits(userAddress, 0);
    expect(accountExitedEarly).to.equal(purchaseAmount);
    expect(accountExitReturn).to.equal(desiredReturn);
    expect(accountMaltUsed).to.equal(desiredReturn);
  });
});
