import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { RewardThrottle } from "../type/RewardThrottle";
import { RewardOverflowPool } from "../type/RewardOverflowPool";
import { RewardDistributor } from "../type/RewardDistributor";
import { MaltDAO } from "../type/MaltDAO";
import { Bonding } from "../type/Bonding";
import { Malt } from "../type/Malt";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";
import BondingArtifacts from "../artifacts/contracts/Bonding.sol/Bonding.json";

const { deployMockContract } = waffle;

describe("Reward Throttle", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let auctionContract: Signer;
  let impliedCollateralService: Signer;

  let rewardThrottle: RewardThrottle;
  let rewardOverflow: RewardOverflowPool;
  let rewardDistributor: RewardDistributor;
  let dai: ERC20;
  let snapshotId: string;

  let mockBonding: Bonding;
  let mockDAO: MaltDAO;
  let mockDistributor: RewardDistributor;
  let mockTransferService: TransferService;

  const epochsPerYear = 17532;
  const epochLength = 30 * 60; // 30 minutes

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, impliedCollateralService, auctionContract, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const impliedCollateralServiceAddress = await impliedCollateralService.getAddress();
    const auctionAddress = await auctionContract.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    mockBonding = ((await deployMockContract(owner, BondingArtifacts.abi)) as any) as Bonding;
    mockDAO = ((await deployMockContract(owner, ["function epoch() returns(uint256)", "function epochsPerYear() returns(uint256)"])) as any) as MaltDAO;
    mockDistributor = ((await deployMockContract(owner, ["function declareReward(uint256)"])) as any) as RewardDistributor;

    await mockDAO.mock.epochsPerYear.returns(BigNumber.from(epochsPerYear));

    const RewardOverflowFactory = await ethers.getContractFactory("RewardOverflowPool");
    rewardOverflow = (await RewardOverflowFactory.deploy()) as RewardOverflowPool;

    // Deploy the SwingTrader
    const RewardThrottleFactory = await ethers.getContractFactory("RewardThrottle");

    rewardThrottle = (await RewardThrottleFactory.deploy()) as RewardThrottle;

    await rewardOverflow.initialize(
      ownerAddress,
      adminAddress,
      rewardThrottle.address,
      dai.address,
      auctionAddress,
      impliedCollateralServiceAddress,
    );
    await rewardThrottle.initialize(
      ownerAddress,
      adminAddress,
      mockDAO.address,
      rewardOverflow.address,
      mockBonding.address,
      mockDistributor.address,
      dai.address
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await rewardThrottle.rewardToken()).to.equal(dai.address);
    expect(await rewardThrottle.dao()).to.equal(mockDAO.address);
    expect(await rewardThrottle.bonding()).to.equal(mockBonding.address);
    expect(await rewardThrottle.overflowPool()).to.equal(rewardOverflow.address);
    expect(await rewardThrottle.distributor()).to.equal(mockDistributor.address);
    expect(await rewardThrottle.throttle()).to.equal(200);
    expect(await rewardThrottle.smoothingPeriod()).to.equal(48);
  });

  it("Can call getTargets with 0 epoch", async function() {
    await mockDAO.mock.epoch.returns(0);
    const [targetApr, targetEpochProfit] = await rewardThrottle.getTargets(0, 48);
    expect(targetApr).to.equal(0);
    expect(targetEpochProfit).to.equal(0);
  });

  it("Sends all rewards to distributor in epoch 0", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);

    await dai.mint(rewardThrottle.address, amountDai);

    // Without mock declareReward on the distributor this should throw
    await expect(rewardThrottle.handleReward()).to.be.reverted;

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(initialDistributorBalance).to.equal(0);
    const initialThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(initialThrottleBalance).to.equal(amountDai);

    await mockDistributor.mock.declareReward.returns();
    await rewardThrottle.handleReward();

    const finalDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(finalDistributorBalance).to.equal(amountDai);
    const finalThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(finalThrottleBalance).to.equal(0);

    const targetAPR = await rewardThrottle.targetAPR();
    const epochTargetProfit = await rewardThrottle.targetEpochProfit();

    // Epoch 0 has no target APR
    expect(targetAPR).to.equal(0);
    expect(epochTargetProfit).to.equal(0)

    const epochAPR = await rewardThrottle.epochAPR(0);
    // Realized APR in epoch 1 wasn't throttled
    expect(epochAPR).to.equal(epochsPerYear * 10000)

    const {
      profit,
      rewarded,
      bondedValue,
      throttleAmount
    } = await rewardThrottle.epochData(0);
    expect(profit).to.equal(amountDai);
    expect(rewarded).to.equal(amountDai);
    expect(bondedValue).to.equal(amountDai);
    expect(throttleAmount).to.equal(200);
  });

  it("Handles rewards across epoch boundaries", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    /*
     * EPOCH 0
     */
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(initialDistributorBalance).to.equal(amountDai);
    const initialThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(initialThrottleBalance).to.equal(0);
    const initialOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(initialOverflowBalance).to.equal(0);

    /*
     * EPOCH 1
     */
    await increaseTime(epochLength);
    await mockDAO.mock.epoch.returns(1);
    // Double bonded amount
    const secondEpochBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(secondEpochBonded);

    // Handle another reward in epoch 1
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();

    // Because this is past epoch 0, the APR is throttled to 20% of full APR.
    // Full desired APR is 100% per epoch. But that is throttled to 20%
    // Therefore 20% of the bonded amount is the reward
    const secondEpochReward = secondEpochBonded.mul(2).div(10);

    const secondDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(secondDistributorBalance).to.equal(amountDai.add(secondEpochReward));
    const secondThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(secondThrottleBalance).to.equal(0);

    // Overflow got the rest
    const secondOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(secondOverflowBalance).to.equal(amountDai.sub(secondEpochReward));

    // We overflowed so target reward should be the actual rewarded
    const secondTargetProfit = await rewardThrottle.targetEpochProfit();
    expect(secondTargetProfit).to.equal(secondEpochReward)

    // 800 reward in an epoch into 4000 of bondedValue
    // (800 * epochsPerYear) / 4000 = 3506.4
    // Multiplied by 10000 to rescue some decimals = 35064000
    const secondEpochDesiredAPR = 35064000;

    const secondTargetAPR = await rewardThrottle.targetAPR();
    expect(secondTargetAPR).to.equal(secondEpochDesiredAPR);

    /*
     * EPOCH 2
     */
    await increaseTime(epochLength);
    await mockDAO.mock.epoch.returns(2);
    // Double bonded amount again
    const thirdEpochBonded = secondEpochBonded.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(thirdEpochBonded);

    // Handle another reward in epoch 2
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();

    // Target APR now averages epoch 1 and 2 then throttles
    // This is ((2000 + 2000) / 2) / ((2000 + 4000) / 2)
    // == 2000 / 3000 = 66.66% return per epoch
    // 8000 bonded multiplied by 66.66% = 5333
    // Then throttled down to 20% = 1066.66
    const thirdEpochReward = utils.parseEther((8000 * 2/3 * 0.2).toString())

    const thirdDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(thirdDistributorBalance).to.be.withinPercent(amountDai.add(secondEpochReward).add(thirdEpochReward));
    const thirdThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(thirdThrottleBalance).to.equal(0);

    // Overflow got the rest
    const thirdOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(thirdOverflowBalance).to.be.withinPercent(secondOverflowBalance.add(amountDai.sub(thirdEpochReward)));

    // Full APR required 100% return per epoch. So throttled requires 20%
    // We overflowed so target profit is what was actually rewarded
    const epochTargetProfit = await rewardThrottle.targetEpochProfit();
    expect(epochTargetProfit).to.be.withinPercent(thirdEpochReward);

    // (1066.66 * epochsPerYear) / 8000 = 2337.6
    // Multiplied by 10000 to rescue some decimals = 23376000
    const thirdEpochDesiredAPR = 23376000;

    // Because we overflowed, epochAPR == targetAPR
    const thirdTargetAPR = await rewardThrottle.targetAPR();
    expect(thirdTargetAPR).to.equal(thirdEpochDesiredAPR);

    /*
     * EPOCH ASSERTIONS
     */
    // First epoch is not throttled
    let epochAPR = await rewardThrottle.epochAPR(0);
    const firstEpochDesiredAPR = epochsPerYear * 10000;
    expect(epochAPR).to.equal(firstEpochDesiredAPR)

    // Because we overflowed, epochAPR == targetAPR
    epochAPR = await rewardThrottle.epochAPR(1);
    expect(epochAPR).to.equal(secondEpochDesiredAPR);

    // Because we overflowed, epochAPR == targetAPR
    epochAPR = await rewardThrottle.epochAPR(2);
    expect(epochAPR).to.be.near(BigNumber.from(thirdEpochDesiredAPR), 1);

    const {
      profit,
      rewarded,
      bondedValue,
      throttleAmount
    } = await rewardThrottle.epochData(0);
    expect(profit).to.equal(amountDai);
    expect(rewarded).to.equal(amountDai);
    expect(bondedValue).to.equal(amountDai);
    expect(throttleAmount).to.equal(200);

    const {
      profit: profitTwo,
      rewarded: rewardedTwo,
      bondedValue: bondedValueTwo,
      throttleAmount: throttleAmountTwo
    } = await rewardThrottle.epochData(1);
    expect(profitTwo).to.equal(amountDai);
    expect(rewardedTwo).to.equal(secondEpochReward);
    expect(bondedValueTwo).to.equal(secondEpochBonded);
    expect(throttleAmountTwo).to.equal(200);

    const {
      profit: profitThree,
      rewarded: rewardedThree,
      bondedValue: bondedValueThree,
      throttleAmount: throttleAmountThree
    } = await rewardThrottle.epochData(2);
    expect(profitThree).to.equal(amountDai);
    expect(rewardedThree).to.be.withinPercent(thirdEpochReward);
    expect(bondedValueThree).to.equal(thirdEpochBonded);
    expect(throttleAmountThree).to.equal(200);
  });

  it("Handles rewards with many epoch gap", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    for (let i = 0; i < 10; i++) {
      await mockBonding.mock.averageBondedValue.withArgs(i).returns(amountDai);
    }
    await mockDistributor.mock.declareReward.returns();

    /*
     * EPOCH 0
     */
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(initialDistributorBalance).to.equal(amountDai);
    const initialThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(initialThrottleBalance).to.equal(0);
    const initialOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(initialOverflowBalance).to.equal(0);

    /*
     * EPOCH 10
     */
    await increaseTime(epochLength * 10);
    await mockDAO.mock.epoch.returns(10);
    // Double bonded amount
    const secondEpochBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(10).returns(secondEpochBonded);

    // Handle another reward in epoch 10
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();

    // The first epoch created a desired profit of 100% per epoch.
    // It then went forward 10 epochs with no additional reward.
    // This dilures the desired profit to 10% per epoch.
    // Because this is past epoch 0, the APR is throttled to 20% of full APR.
    // Full desired APR is 10% per epoch. But that is throttled to 20%
    // Therefore 2% of the bonded amount is the reward
    const secondEpochReward = secondEpochBonded.mul(2).div(100);

    const secondDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(secondDistributorBalance).to.equal(amountDai.add(secondEpochReward));
    const secondThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(secondThrottleBalance).to.equal(0);

    // Overflow got the rest
    const secondOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(secondOverflowBalance).to.equal(amountDai.sub(secondEpochReward));

    // We overflowed so target reward should be the actual rewarded
    const secondTargetProfit = await rewardThrottle.targetEpochProfit();
    expect(secondTargetProfit).to.equal(secondEpochReward)

    // 80 reward in an epoch into 4000 of bondedValue
    // (80 * epochsPerYear) / 4000 = 350.64
    // Multiplied by 10000 to rescue some decimals = 3506400
    const secondEpochDesiredAPR = 3506400;

    const secondTargetAPR = await rewardThrottle.targetAPR();
    expect(secondTargetAPR).to.equal(secondEpochDesiredAPR);
  });

  it("Handles multiple small declarations in epoch 0", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Total of 2000
    const firstReward = utils.parseEther('830');
    const secondReward = utils.parseEther('220');
    const thirdReward = utils.parseEther('950');

    /*
     * REWARD 1
     */
    await dai.mint(rewardThrottle.address, firstReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);
    /*
     * REWARD 2
     */
    await dai.mint(rewardThrottle.address, secondReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);
    /*
     * REWARD 3
     */
    await dai.mint(rewardThrottle.address, thirdReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);

    const secondDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(secondDistributorBalance).to.equal(amountDai);
    const secondThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(secondThrottleBalance).to.equal(0);
    const secondOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(secondOverflowBalance).to.equal(0);
  });

  it("Handles multiple small declarations in epoch 1", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();

    await increaseTime(epochLength);

    /*
     * EPOCH 1
     */
    await mockDAO.mock.epoch.returns(1);
    // Twice as much bonded in epoch 1
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);

    // Total of 2000
    const firstReward = utils.parseEther('830');
    const secondReward = utils.parseEther('220');
    const thirdReward = utils.parseEther('950');

    /*
     * REWARD 1
     */
    await dai.mint(rewardThrottle.address, firstReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);
    /*
     * REWARD 2
     */
    await dai.mint(rewardThrottle.address, secondReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);
    /*
     * REWARD 3
     */
    await dai.mint(rewardThrottle.address, thirdReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);

    // Expects 100% return per epoch. Then throttled to 20%
    const epochOneRewarded = epochOneBonded.mul(2).div(10);
    const secondDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(secondDistributorBalance).to.equal(amountDai.add(epochOneRewarded));
    const secondThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(secondThrottleBalance).to.equal(0);
    const secondOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(secondOverflowBalance).to.equal(amountDai.sub(epochOneRewarded));
  });

  it("Handles multiple small declarations in epoch 2", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    // Epoch 1 gets 50% reward
    await mockDAO.mock.epoch.returns(1);
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    /*
     * EPOCH 2
     */
    await mockDAO.mock.epoch.returns(2);
    // Twice as much bonded in epoch 1
    const epochTwoBonded = epochOneBonded.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(epochTwoBonded);

    // Total of 2000
    const firstReward = utils.parseEther('830');
    const secondReward = utils.parseEther('220');
    const thirdReward = utils.parseEther('950');

    /*
     * REWARD 1
     */
    await dai.mint(rewardThrottle.address, firstReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);
    /*
     * REWARD 2
     */
    await dai.mint(rewardThrottle.address, secondReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);
    /*
     * REWARD 3
     */
    await dai.mint(rewardThrottle.address, thirdReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 4);

    // Expects 100% return per epoch. Then throttled to 20%
    const epochOneRewarded = epochOneBonded.mul(2).div(10);

    // Target APR now averages epoch 1 and 2 then throttles
    // This is ((2000 + 2000) / 2) / ((2000 + 4000) / 2)
    // == 2000 / 3000 = 66.66% return per epoch
    // 8000 bonded multiplied by 66.66% = 5333
    // Then throttled down to 20% = 1066.66
    const epochTwoRewarded = utils.parseEther((8000 * 2/3 * 0.2).toString())

    const distributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(distributorBalance).to.be.withinPercent(amountDai.add(epochOneRewarded).add(epochTwoRewarded));

    const secondThrottleBalance = await dai.balanceOf(rewardThrottle.address);
    expect(secondThrottleBalance).to.equal(0);

    // Overflow got the rest
    const thirdOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(thirdOverflowBalance).to.be.withinPercent(amountDai.sub(epochOneRewarded).add(amountDai.sub(epochTwoRewarded)));
  });

  it("All reward goes to distributor when we are below desired APR", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    // Epoch 1 gets 50% reward
    await mockDAO.mock.epoch.returns(1);
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    await mockDAO.mock.epoch.returns(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(epochOneBonded);

    /*
     * SMALL REWARD
     */
    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);

    const smallReward = utils.parseEther('83');
    await dai.mint(rewardThrottle.address, smallReward);
    await rewardThrottle.handleReward();

    const finalDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(finalDistributorBalance).to.equal(initialDistributorBalance.add(smallReward));
  });

  it("All reward goes to the overflow when we are above desired APR", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    // Epoch 1 gets 50% reward
    await mockDAO.mock.epoch.returns(1);
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    await mockDAO.mock.epoch.returns(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(epochOneBonded);

    /*
     * LARGE REWARD THAT MEETS APR
     */
    const largeReward = utils.parseEther('10000');
    await dai.mint(rewardThrottle.address, largeReward);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength / 2);

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);
    const initialOverflowBalance = await dai.balanceOf(rewardOverflow.address);

    // New reward should all go to overflow
    const newReward = utils.parseEther('2384');
    await dai.mint(rewardThrottle.address, newReward);
    await rewardThrottle.handleReward();

    // Distributor balance should be unchanged
    const finalDistributorBalance = await dai.balanceOf(mockDistributor.address);
    expect(finalDistributorBalance).to.equal(initialDistributorBalance);

    // Overflow received all the new reward
    const finalOverflowBalance = await dai.balanceOf(rewardOverflow.address);
    expect(finalOverflowBalance).to.equal(initialOverflowBalance.add(newReward));
  });

  it("If an epoch underflows it will pull all it needs from the overflow pool", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    // Epoch 1 gets 50% reward
    await mockDAO.mock.epoch.returns(1);
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    await mockDAO.mock.epoch.returns(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(epochOneBonded);

    /*
     * EPOCH 2 gets 0 reward
     */
    await rewardThrottle.handleReward();
    const epochTwoTargetAPR = await rewardThrottle.targetAPR();
    const epochTwoTargetProfit = await rewardThrottle.targetEpochProfit();
    await increaseTime(epochLength);
    await mockDAO.mock.epoch.returns(3);
    await mockBonding.mock.averageBondedValue.withArgs(3).returns(epochOneBonded);

    expect(await rewardThrottle.epochAPR(2)).to.equal(0);

    const {
      profit,
      rewarded,
      bondedValue,
      throttleAmount
    } = await rewardThrottle.epochData(2);
    expect(profit).to.equal(0);
    expect(rewarded).to.equal(0);
    expect(bondedValue).to.equal(epochOneBonded);
    expect(throttleAmount).to.equal(200);

    // Mint a lot to overflow to ensure it has balance to fulfill entire reward
    await dai.mint(rewardOverflow.address, utils.parseEther('1000000'));

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);
    const initialOverflowBalance = await dai.balanceOf(rewardOverflow.address);

    // Triggering this now we are in epoch 3 should fulfill epoch 2 from the overflow pool
    await rewardThrottle.handleReward();

    expect(await rewardThrottle.epochAPR(2)).to.be.near(epochTwoTargetAPR, 1); // within 1 to avoid rounding

    const {
      profit: finalProfit,
      rewarded: finalRewarded,
      bondedValue: finalBondedValue,
      throttleAmount: finalThrottleAmount
    } = await rewardThrottle.epochData(2);
    // Profit is 0 to indicate no natural profit was generated
    expect(finalProfit).to.equal(0);
    // Rewarded is above 0. Because rewarded > profit it implies underflow
    expect(finalRewarded).to.equal(epochTwoTargetProfit);
    expect(finalBondedValue).to.equal(epochOneBonded);
    expect(finalThrottleAmount).to.equal(200);

    const finalDistributorBalance = await dai.balanceOf(mockDistributor.address);
    const finalOverflowBalance = await dai.balanceOf(rewardOverflow.address);

    expect(finalOverflowBalance).to.equal(initialOverflowBalance.sub(finalRewarded));
    expect(finalDistributorBalance).to.equal(initialDistributorBalance.add(finalRewarded));
  });

  it("Can handle underflow when overflow pool has 0 balance", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    // Epoch 1 gets 50% reward
    await mockDAO.mock.epoch.returns(1);
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    await mockDAO.mock.epoch.returns(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(epochOneBonded);

    /*
     * EPOCH 2 gets 0 reward
     */
    await rewardThrottle.handleReward();
    const epochTwoTargetAPR = await rewardThrottle.targetAPR();
    const epochTwoTargetProfit = await rewardThrottle.targetEpochProfit();
    await increaseTime(epochLength);
    await mockDAO.mock.epoch.returns(3);
    await mockBonding.mock.averageBondedValue.withArgs(3).returns(epochOneBonded);

    expect(await rewardThrottle.epochAPR(2)).to.equal(0);

    const {
      profit,
      rewarded,
      bondedValue,
      throttleAmount
    } = await rewardThrottle.epochData(2);
    expect(profit).to.equal(0);
    expect(rewarded).to.equal(0);
    expect(bondedValue).to.equal(epochOneBonded);
    expect(throttleAmount).to.equal(200);

    const overflowBalance = await dai.balanceOf(rewardOverflow.address);
    // Burn everything so overflow has no capital
    await dai.burn(rewardOverflow.address, overflowBalance);

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);
    const initialOverflowBalance = await dai.balanceOf(rewardOverflow.address);

    // Triggering this now we are in epoch 3 should try to use overflow but there is nothing available
    // This call should still succeed
    await rewardThrottle.handleReward();

    // APR is 0 because overflow couldn't make up the diff
    expect(await rewardThrottle.epochAPR(2)).to.equal(0);

    const {
      profit: finalProfit,
      rewarded: finalRewarded,
      bondedValue: finalBondedValue,
      throttleAmount: finalThrottleAmount
    } = await rewardThrottle.epochData(2);
    // Profit is 0 to indicate no natural profit was generated
    expect(finalProfit).to.equal(0);
    // No reward could be given
    expect(finalRewarded).to.equal(0);
    expect(finalBondedValue).to.equal(epochOneBonded);
    expect(finalThrottleAmount).to.equal(200);

    const finalDistributorBalance = await dai.balanceOf(mockDistributor.address);
    const finalOverflowBalance = await dai.balanceOf(rewardOverflow.address);

    expect(finalOverflowBalance).to.equal(initialOverflowBalance);
    expect(finalDistributorBalance).to.equal(initialDistributorBalance);
  });

  it("Can handle underflow when overflow pool has less than required", async function() {
    const amountDai = utils.parseEther('2000');

    await mockDAO.mock.epoch.returns(0);
    await mockBonding.mock.averageBondedValue.withArgs(0).returns(amountDai);
    await mockDistributor.mock.declareReward.returns();

    // Epoch 0 gets 100% reward
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    // Epoch 1 gets 50% reward
    await mockDAO.mock.epoch.returns(1);
    const epochOneBonded = amountDai.mul(2);
    await mockBonding.mock.averageBondedValue.withArgs(1).returns(epochOneBonded);
    await dai.mint(rewardThrottle.address, amountDai);
    await rewardThrottle.handleReward();
    await increaseTime(epochLength);

    await mockDAO.mock.epoch.returns(2);
    await mockBonding.mock.averageBondedValue.withArgs(2).returns(epochOneBonded);

    /*
     * EPOCH 2 gets 0 reward
     */
    await rewardThrottle.handleReward();
    const epochTwoTargetAPR = await rewardThrottle.targetAPR();
    const epochTwoTargetProfit = await rewardThrottle.targetEpochProfit();
    await increaseTime(epochLength);
    await mockDAO.mock.epoch.returns(3);
    await mockBonding.mock.averageBondedValue.withArgs(3).returns(epochOneBonded);

    expect(await rewardThrottle.epochAPR(2)).to.equal(0);

    const {
      profit,
      rewarded,
      bondedValue,
      throttleAmount
    } = await rewardThrottle.epochData(2);
    expect(profit).to.equal(0);
    expect(rewarded).to.equal(0);
    expect(bondedValue).to.equal(epochOneBonded);
    expect(throttleAmount).to.equal(200);

    let overflowBalance = await dai.balanceOf(rewardOverflow.address);
    // Burn everything so overflow has no capital
    await dai.burn(rewardOverflow.address, overflowBalance);
    // Required overflow capital is 533.33 so mint 500
    overflowBalance = utils.parseEther('500');
    await dai.mint(rewardOverflow.address, overflowBalance);

    const initialDistributorBalance = await dai.balanceOf(mockDistributor.address);

    // Triggering this now we are in epoch 3 should try to use overflow.
    // It should use as much as it can, which is half of the 500 due to
    // the maxFulfillment property being 50%
    await rewardThrottle.handleReward();

    // APR is should be non 0 but below the target as overflow couldn't fulfill it all
    const epochTwoAPR = await rewardThrottle.epochAPR(2);
    expect(epochTwoAPR).to.be.above(0);
    expect(epochTwoAPR).to.be.below(epochTwoTargetAPR);

    const {
      profit: finalProfit,
      rewarded: finalRewarded,
      bondedValue: finalBondedValue,
      throttleAmount: finalThrottleAmount
    } = await rewardThrottle.epochData(2);
    // Profit is 0 to indicate no natural profit was generated
    expect(finalProfit).to.equal(0);
    // Half overflow should have been used
    expect(finalRewarded).to.equal(overflowBalance.div(2));
    expect(finalBondedValue).to.equal(epochOneBonded);
    expect(finalThrottleAmount).to.equal(200);

    const finalDistributorBalance = await dai.balanceOf(mockDistributor.address);
    const finalOverflowBalance = await dai.balanceOf(rewardOverflow.address);

    expect(finalOverflowBalance).to.equal(overflowBalance.div(2));
    expect(finalDistributorBalance).to.equal(initialDistributorBalance.add(overflowBalance.div(2)));
  });

  it("Only allows admin to set DAO", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(rewardThrottle.connect(user).setDao(newAddress)).to.be.reverted;
    await expect(rewardThrottle.connect(auctionContract).setDao(newAddress)).to.be.reverted;

    await rewardThrottle.connect(admin).setDao(newAddress);
    expect(await rewardThrottle.dao()).to.equal(newAddress);

    await rewardThrottle.setDao(new2Address);
    expect(await rewardThrottle.dao()).to.equal(new2Address);
  });

  it("Only allows admin to set Bonding", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(rewardThrottle.connect(user).setBonding(newAddress)).to.be.reverted;
    await expect(rewardThrottle.connect(auctionContract).setBonding(newAddress)).to.be.reverted;

    await rewardThrottle.connect(admin).setBonding(newAddress);
    expect(await rewardThrottle.bonding()).to.equal(newAddress);

    await rewardThrottle.setBonding(new2Address);
    expect(await rewardThrottle.bonding()).to.equal(new2Address);
  });

  it("Only allows admin to set Distributor", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(rewardThrottle.connect(user).setDistributor(newAddress)).to.be.reverted;
    await expect(rewardThrottle.connect(auctionContract).setDistributor(newAddress)).to.be.reverted;

    await rewardThrottle.connect(admin).setDistributor(newAddress);
    expect(await rewardThrottle.distributor()).to.equal(newAddress);

    await rewardThrottle.setDistributor(new2Address);
    expect(await rewardThrottle.distributor()).to.equal(new2Address);
  });

  it("Only allows admin to set Overflow pool", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(rewardThrottle.connect(user).setOverflowPool(newAddress)).to.be.reverted;
    await expect(rewardThrottle.connect(auctionContract).setOverflowPool(newAddress)).to.be.reverted;

    await rewardThrottle.connect(admin).setOverflowPool(newAddress);
    expect(await rewardThrottle.overflowPool()).to.equal(newAddress);

    await rewardThrottle.setOverflowPool(new2Address);
    expect(await rewardThrottle.overflowPool()).to.equal(new2Address);
  });

  it("It only allows admins to update throttle amount", async function() {
    expect(await rewardThrottle.throttle()).to.equal(200);

    const [user] = accounts;

    await expect(rewardThrottle.connect(user).setThrottle(10)).to.be.reverted;
    await expect(rewardThrottle.connect(auctionContract).setThrottle(10)).to.be.reverted;

    const newThrottle = 356;
    await rewardThrottle.connect(admin).setThrottle(newThrottle);
    expect(await rewardThrottle.throttle()).to.equal(newThrottle);

    // Default signer has the Timelock role
    await rewardThrottle.setThrottle(422);
    expect(await rewardThrottle.throttle()).to.equal(422);
  });

  it("It only allows admins to update smoothing period", async function() {
    expect(await rewardThrottle.smoothingPeriod()).to.equal(48);

    const [user] = accounts;

    await expect(rewardThrottle.connect(user).setSmoothingPeriod(10)).to.be.reverted;
    await expect(rewardThrottle.connect(auctionContract).setSmoothingPeriod(10)).to.be.reverted;

    const newThrottle = 356;
    await rewardThrottle.connect(admin).setSmoothingPeriod(newThrottle);
    expect(await rewardThrottle.smoothingPeriod()).to.equal(newThrottle);

    // Default signer has the Timelock role
    await rewardThrottle.setSmoothingPeriod(422);
    expect(await rewardThrottle.smoothingPeriod()).to.equal(422);
  });

  // TODO tests for longer periods Sun 17 Oct 2021 17:49:41 BST
  // gas concerns for full period? Maybe store cumulative values for profit and bonded?
  // Use moving average contract?
});
