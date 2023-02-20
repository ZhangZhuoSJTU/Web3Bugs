import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { RewardOverflowPool } from "../type/RewardOverflowPool";
import { Malt } from "../type/Malt";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("Reward Overflow Pool", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let throttleContract: Signer;
  let auctionContract: Signer;
  let impliedCollateralService: Signer;

  let rewardOverflow: RewardOverflowPool;
  let dai: ERC20;
  let snapshotId: string;
  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, throttleContract, auctionContract, impliedCollateralService, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const throttlerAddress = await throttleContract.getAddress();
    const auctionAddress = await auctionContract.getAddress();
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    // Deploy the SwingTrader
    const RewardOverflowPoolFactory = await ethers.getContractFactory("RewardOverflowPool");

    rewardOverflow = (await RewardOverflowPoolFactory.deploy()) as RewardOverflowPool;
    await rewardOverflow.initialize(
      ownerAddress,
      adminAddress,
      throttlerAddress,
      dai.address,
      auctionAddress,
      impliedCollateralServiceAddress,
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  /*
   * These tests do not touch on the auction participant functionality within the overflow contract
   * as all of that functionality will be tested individually on the AuctionParticipant contract
   */

  it("Has correct initial conditions", async function() {
    const auctionAddress = await auctionContract.getAddress();
    const throttlerAddress = await throttleContract.getAddress();

    expect(await rewardOverflow.auctionRewardToken()).to.equal(dai.address);
    expect(await rewardOverflow.auction()).to.equal(auctionAddress);
    expect(await rewardOverflow.maxFulfillment()).to.equal(500);
    expect(await rewardOverflow.throttler()).to.equal(throttlerAddress);
  });

  it("Disallows non throttler from requesting capital", async function() {
    const daiAmount = utils.parseEther('1000000');
    await dai.mint(rewardOverflow.address, daiAmount);

    const [user1, user2] = accounts;

    await expect(rewardOverflow.connect(auctionContract).requestCapital(daiAmount.div(10))).to.be.reverted;
    await expect(rewardOverflow.connect(impliedCollateralService).requestCapital(daiAmount.div(10))).to.be.reverted;
    await expect(rewardOverflow.connect(user1).requestCapital(daiAmount.div(10))).to.be.reverted;
    await expect(rewardOverflow.connect(user2).requestCapital(daiAmount.div(10))).to.be.reverted;
    await expect(rewardOverflow.connect(admin).requestCapital(daiAmount.div(10))).to.be.reverted;
  });

  it("Allows timelock or reward throttle contract to request capital", async function() {
    const ownerAddress = await owner.getAddress();
    const throttleAddress = await throttleContract.getAddress();

    const daiAmount = utils.parseEther('1000000');
    await dai.mint(rewardOverflow.address, daiAmount);

    let requestAmount = daiAmount.div(10);
    
    // Assert initial balances are 0
    let timelockBalance = await dai.balanceOf(ownerAddress);
    expect(timelockBalance).to.equal(0);
    let throttleBalance = await dai.balanceOf(throttleAddress);
    expect(throttleBalance).to.equal(0);

    await rewardOverflow.requestCapital(requestAmount);

    let newTimelockBalance = await dai.balanceOf(ownerAddress);
    expect(newTimelockBalance).to.equal(0);

    let newThrottleBalance = await dai.balanceOf(throttleAddress);
    expect(newThrottleBalance).to.equal(requestAmount);

    let newRequestAmount = daiAmount.div(5);

    await rewardOverflow.connect(throttleContract).requestCapital(newRequestAmount);

    let finalTimelockBalance = await dai.balanceOf(ownerAddress);
    expect(finalTimelockBalance).to.equal(0);

    let finalThrottleBalance = await dai.balanceOf(throttleAddress);
    expect(finalThrottleBalance).to.equal(requestAmount.add(newRequestAmount));
  });

  it("Correctly handles when the overflow has no reward tokens", async function() {
    const throttleAddress = await throttleContract.getAddress();

    // Assert initial balances are 0
    let throttleBalance = await dai.balanceOf(throttleAddress);
    expect(throttleBalance).to.equal(0);

    await rewardOverflow.requestCapital(100000);

    let finalThrottleBalance = await dai.balanceOf(throttleAddress);
    expect(finalThrottleBalance).to.equal(0);
  });

  it("It correctly caps returned amount to no more than maxFulfillment %", async function() {
    const throttleAddress = await throttleContract.getAddress();

    const daiAmount = utils.parseEther('1000000');
    await dai.mint(rewardOverflow.address, daiAmount);

    // Assert initial balances are 0
    let throttleBalance = await dai.balanceOf(throttleAddress);
    expect(throttleBalance).to.equal(0);

    await rewardOverflow.requestCapital(daiAmount);

    let finalThrottleBalance = await dai.balanceOf(throttleAddress);
    expect(finalThrottleBalance).to.be.near(daiAmount.div(2));
    let finalOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(finalOverflowBalance).to.be.near(daiAmount.div(2));
  });

  it("It correctly caps large amount to no more than maxFulfillment %", async function() {
    const throttleAddress = await throttleContract.getAddress();

    const daiAmount = utils.parseEther('1000000');
    await dai.mint(rewardOverflow.address, daiAmount);

    // Assert initial balances are 0
    let throttleBalance = await dai.balanceOf(throttleAddress);
    expect(throttleBalance).to.equal(0);

    await rewardOverflow.requestCapital(daiAmount.mul(10));

    let finalThrottleBalance = await dai.balanceOf(throttleAddress);
    expect(finalThrottleBalance).to.be.near(daiAmount.div(2));
    let finalOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(finalOverflowBalance).to.be.near(daiAmount.div(2));
  });

  it("Allows admins to set new max fulfillment", async function() {
    const [user] = accounts;
    const newMaxFulfillment = 20;
    await expect(rewardOverflow.connect(user).setMaxFulfillment(newMaxFulfillment)).to.be.reverted;
    await expect(rewardOverflow.connect(auctionContract).setMaxFulfillment(newMaxFulfillment)).to.be.reverted;

    await rewardOverflow.connect(admin).setMaxFulfillment(newMaxFulfillment);
    expect(await rewardOverflow.maxFulfillment()).to.equal(newMaxFulfillment);

    const newReserveRatio2 = 40;
    await rewardOverflow.setMaxFulfillment(newReserveRatio2);
    expect(await rewardOverflow.maxFulfillment()).to.equal(newReserveRatio2);
  });

  it("Allows admins to set new throttler contract", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(rewardOverflow.connect(user).setThrottler(newAddress)).to.be.reverted;
    await expect(rewardOverflow.connect(auctionContract).setThrottler(newAddress)).to.be.reverted;

    await rewardOverflow.connect(admin).setThrottler(newAddress);
    expect(await rewardOverflow.throttler()).to.equal(newAddress);

    await rewardOverflow.setThrottler(new2Address);
    expect(await rewardOverflow.throttler()).to.equal(new2Address);
  });
});
