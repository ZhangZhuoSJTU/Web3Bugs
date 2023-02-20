import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { AuctionParticipant } from "../type/AuctionParticipant";
import { Malt } from "../type/Malt";
import { Auction } from "../type/Auction";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";
import AuctionArtifacts from "../artifacts/contracts/Auction.sol/Auction.json";

const { deployMockContract } = waffle;

describe("Auction Participant", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let impliedCollateralService: Signer;

  let auctionParticipant: AuctionParticipant;
  let dai: ERC20;
  let snapshotId: string;
  let mockAuction: Auction;
  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, impliedCollateralService, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [], []);
    await dai.deployed();

    // Create the mock reward throttle
    mockAuction = ((await deployMockContract(owner, AuctionArtifacts.abi)) as any) as Auction;

    // Deploy the AuctionParticipant
    const AuctionParticipantFactory = await ethers.getContractFactory("AuctionParticipant");

    auctionParticipant = (await AuctionParticipantFactory.deploy()) as AuctionParticipant;
    await auctionParticipant.setupParticipant(
      impliedCollateralServiceAddress,
      dai.address,
      mockAuction.address
    );
    await auctionParticipant.deployed();
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await auctionParticipant.auction()).to.equal(mockAuction.address);
    expect(await auctionParticipant.auctionRewardToken()).to.equal(dai.address);
    expect(await auctionParticipant.replenishingIndex()).to.equal(0);
    expect(await auctionParticipant.claimableRewards()).to.equal(0);
  });

  it("Disallows non-impliedCollateralService from calling purchaseArbitrageTokens", async function() {
    const [user] = accounts;
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();

    await expect(auctionParticipant.purchaseArbitrageTokens(amountDai)).to.be.reverted;
    await expect(auctionParticipant.connect(user).purchaseArbitrageTokens(amountDai)).to.be.reverted;
  });

  it("Handles calling purchaseArbitrageTokens", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    // Should revert due to not having mocks in place
    await expect(auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai)).to.be.reverted;

    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();

    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    const auctionIds = await auctionParticipant.getAllAuctionIds();
    expect(auctionIds.length).to.equal(1);
    expect(auctionIds[0]).to.equal(0);
  });

  it("Handles calling claim before any rewards are claimable", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    // Purchase arb tokens
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();
    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // Should revert due to not having mocks in place
    await expect(auctionParticipant.connect(impliedCollateralService).claim()).to.be.reverted;

    await mockAuction.mock.replenishingAuctionId.returns(0);
    await mockAuction.mock.claimArbitrage.withArgs(0).returns();
    await mockAuction.mock.userClaimableArbTokens.returns(0);

    const initialBalance = await dai.balanceOf(auctionParticipant.address);

    // There is nothing to claim so should not do anything. 
    await auctionParticipant.claim();

    expect(await auctionParticipant.replenishingIndex()).to.equal(0);

    const finalBalance = await dai.balanceOf(auctionParticipant.address);
    expect(finalBalance).to.equal(initialBalance);

    expect(await auctionParticipant.claimableRewards()).to.equal(0);
  });

  it("Correctly avoids incrementing replenishingIndex when there are more claimable rewards", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    // Purchase arb tokens
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();
    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // Should revert due to not having mocks in place
    await expect(auctionParticipant.connect(impliedCollateralService).claim()).to.be.reverted;

    await mockAuction.mock.replenishingAuctionId.returns(1);
    await mockAuction.mock.claimArbitrage.withArgs(0).returns();
    // None 0 amount
    await mockAuction.mock.userClaimableArbTokens.returns(100);

    const initialBalance = await dai.balanceOf(auctionParticipant.address);

    expect(await auctionParticipant.replenishingIndex()).to.equal(0);

    // There is nothing to claim so should not do anything. 
    await auctionParticipant.claim();

    expect(await auctionParticipant.replenishingIndex()).to.equal(0);
  });

  it("Correctly returns usable Balance", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);
    expect(await auctionParticipant.usableBalance()).to.equal(amountDai);
  });

  it("Correctly returns outstanding arb tokens with no auction activity", async function() {
    expect(await auctionParticipant.outstandingArbTokens()).to.equal(0);
  });

  it("Correctly appends currentAuctionId when purchaseArbitrageTokens", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    // Purchase arb tokens
    const currentAuction = 234;
    await mockAuction.mock.currentAuctionId.returns(currentAuction);
    await mockAuction.mock.auctionActive.withArgs(currentAuction).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();
    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    expect(await auctionParticipant.auctionIds(0)).to.equal(currentAuction);
  });

  it("Correctly returns outstanding arb tokens after auction pledge", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    // Purchase arb tokens
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();
    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // The sum of return values from balanceOfArbTokens
    // is what defines the return from outstandingArbTokens
    // So we mock the return for auction 0
    const auctionOneTokens = utils.parseEther('2340');
    await mockAuction.mock.balanceOfArbTokens.withArgs(0, auctionParticipant.address).returns(auctionOneTokens);

    expect(await auctionParticipant.outstandingArbTokens()).to.equal(auctionOneTokens);
  });

  it("Correctly returns outstanding arb tokens after two auction pledges", async function() {
    const amountDai = utils.parseEther('1000');
    await dai.mint(auctionParticipant.address, amountDai);

    // Purchase arb tokens
    await mockAuction.mock.currentAuctionId.returns(0);
    await mockAuction.mock.auctionActive.withArgs(0).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();
    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // Purchase arb tokens
    await mockAuction.mock.currentAuctionId.returns(12);
    await mockAuction.mock.auctionActive.withArgs(12).returns(true);
    await mockAuction.mock.purchaseArbitrageTokens.withArgs(amountDai).returns();
    await auctionParticipant.connect(impliedCollateralService).purchaseArbitrageTokens(amountDai);

    // The sum of return values from balanceOfArbTokens
    // is what defines the return from outstandingArbTokens
    // So we mock the return for auction 0
    const auctionOneTokens = utils.parseEther('2340');
    await mockAuction.mock.balanceOfArbTokens.withArgs(0, auctionParticipant.address).returns(auctionOneTokens);
    const auctionTwoTokens = utils.parseEther('934');
    await mockAuction.mock.balanceOfArbTokens.withArgs(12, auctionParticipant.address).returns(auctionTwoTokens);

    expect(await auctionParticipant.outstandingArbTokens()).to.equal(auctionOneTokens.add(auctionTwoTokens));
  });
});
