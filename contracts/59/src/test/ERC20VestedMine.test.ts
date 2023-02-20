import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { ERC20VestedMine } from "../type/ERC20VestedMine";
import { RewardDistributor } from "../type/RewardDistributor";
import { Bonding } from "../type/Bonding";
import { TransferService } from "../type/TransferService";
import { Malt } from "../type/Malt";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("ERC20 Vested Mine", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let miningService: Signer;

  let lpMine: ERC20VestedMine;
  let dai: ERC20;
  let snapshotId: string;

  let mockDistributor: RewardDistributor;
  let mockBonding: Bonding;
  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, miningService, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const miningServiceAddress = await miningService.getAddress();

    const ERC20Factory = await ethers.getContractFactory("Malt");

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    mockDistributor = ((await deployMockContract(owner, [
      "function totalDeclaredReward() returns (uint256)",
      "function decrementRewards(uint256)",
      "function forfeit(uint256)"
    ])) as any) as RewardDistributor;
    mockBonding = ((await deployMockContract(owner, [
      "function totalBonded() returns (uint256)",
      "function balanceOfBonded(address) returns(uint256)",
      "function forfeit(uint256)"
    ])) as any) as Bonding;

    // Deploy the Auction
    const ERC20VestedMineFactory = await ethers.getContractFactory("ERC20VestedMine");

    lpMine = (await ERC20VestedMineFactory.deploy()) as ERC20VestedMine;
    await lpMine.initialize(
      ownerAddress,
      adminAddress,
      miningServiceAddress,
      mockDistributor.address,
      mockBonding.address,
      dai.address,
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const miningServiceAddress = await miningService.getAddress();

    expect(await lpMine.distributor()).to.equal(mockDistributor.address);
    expect(await lpMine.bonding()).to.equal(mockBonding.address);
    expect(await lpMine.rewardToken()).to.equal(dai.address);
    expect(await lpMine.miningService()).to.equal(miningServiceAddress);
  });

  it("Correctly returns total bonded from bonding contract", async function() {
    const bondedAmount = utils.parseEther('23407');
    await mockBonding.mock.totalBonded.returns(bondedAmount);

    const totalBonded = await lpMine.totalBonded();
    expect(totalBonded).to.equal(bondedAmount);
  });

  it("Correctly returns balance of bonded from bonding contract", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondedAmount = utils.parseEther('23407');
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondedAmount);

    const userBonded = await lpMine.balanceOfBonded(userAddress);
    expect(userBonded).to.equal(bondedAmount);
  });

  it("Correctly returns total declared reward from distributor", async function() {
    const declaredReward = utils.parseEther('3729');
    await mockDistributor.mock.totalDeclaredReward.returns(declaredReward);

    const totalDeclared = await lpMine.totalDeclaredReward();
    expect(totalDeclared).to.equal(declaredReward);
  });

  it("Correctly returns total released reward", async function() {
    const totalReleased = await lpMine.totalReleasedReward();
    expect(totalReleased).to.equal(0);

    const releasedAmount = utils.parseEther('8234');
    await dai.mint(lpMine.address, releasedAmount);

    const finalTotalReleased = await lpMine.totalReleasedReward();
    expect(finalTotalReleased).to.equal(releasedAmount);
  });

  it("Disallows non-miningService from calling onBond", async function() {
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    const [user1, user2] = accounts;
    const userAddress = await user1.getAddress();
    const bondAmount = utils.parseEther('1000');

    await expect(lpMine.connect(user1).onBond(userAddress, bondAmount)).to.be.reverted;
  });

  it("Correctly handles initial bonding", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // This should fail as the required mocks are not present
    await expect(lpMine.connect(miningService).onBond(userAddress, bondAmount)).to.be.reverted;
    // Mock them
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const totalStakePadding = await lpMine.totalStakePadding();
    const userStakePadding = await lpMine.balanceOfStakePadding(userAddress);

    // Initial stake padding multiplier is 1e6
    expect(totalStakePadding).to.equal(bondAmount.mul(1e6));
    expect(userStakePadding).to.equal(totalStakePadding);
  });

  it("Correctly handles a second user bonding", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondOneAmount = utils.parseEther('1000');
    const bondTwoAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    // Initial bond
    await lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount);

    // Mock
    await mockBonding.mock.totalBonded.returns(bondOneAmount);
    await lpMine.connect(miningService).onBond(userTwoAddress, bondTwoAmount);

    const totalStakePadding = await lpMine.totalStakePadding();
    const userOneStakePadding = await lpMine.balanceOfStakePadding(userOneAddress);
    const userTwoStakePadding = await lpMine.balanceOfStakePadding(userTwoAddress);

    // Initial stake padding multiplier is 1e6
    const initialBonded = bondOneAmount.mul(1e6);
    expect(totalStakePadding).to.equal(initialBonded.mul(2));
    expect(userOneStakePadding).to.equal(initialBonded);
    expect(userTwoStakePadding).to.equal(initialBonded);
  });

  it("Correctly attributes all reward to the only bonded user", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // This should fail as the required mocks are not present
    await expect(lpMine.connect(miningService).onBond(userAddress, bondAmount)).to.be.reverted;
    // Mock them
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const userReward = await lpMine.balanceOfRewards(userAddress);
    expect(userReward).to.equal(reward);

    const userEarned = await lpMine.earned(userAddress);
    expect(userEarned).to.equal(0);

    await dai.mint(lpMine.address, reward.div(2));

    const secondUserEarned = await lpMine.earned(userAddress);
    expect(secondUserEarned).to.equal(reward.div(2));

    await dai.mint(lpMine.address, reward.div(2));

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);
  });

  it("Correctly attributes all reward to the only bonded user when another user bonds afterwards", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondOneAmount = utils.parseEther('1000');
    const bondTwoAmount = utils.parseEther('1000');

    // This should fail as the required mocks are not present
    await expect(lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount)).to.be.reverted;
    // Mock them
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount);

    // Declare reward before user 2 bonds
    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondOneAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(bondOneAmount);

    await lpMine.connect(miningService).onBond(userTwoAddress, bondTwoAmount);

    await mockBonding.mock.totalBonded.returns(bondOneAmount.add(bondTwoAmount));
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondTwoAmount);

    // User one should be allocated all the reward
    const userOneReward = await lpMine.balanceOfRewards(userOneAddress);
    expect(userOneReward).to.equal(reward);
    const userTwoReward = await lpMine.balanceOfRewards(userTwoAddress);
    expect(userTwoReward).to.equal(0);

    // Nothing has vested yet
    const userOneEarned = await lpMine.earned(userOneAddress);
    expect(userOneEarned).to.equal(0);
    const userTwoEarned = await lpMine.earned(userTwoAddress);
    expect(userTwoEarned).to.equal(0);

    await dai.mint(lpMine.address, reward.div(2));

    const secondUserOneEarned = await lpMine.earned(userOneAddress);
    expect(secondUserOneEarned).to.equal(reward.div(2));
    const secondUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(secondUserTwoEarned).to.equal(0);

    await dai.mint(lpMine.address, reward.div(2));

    const finalUserOneEarned = await lpMine.earned(userOneAddress);
    expect(finalUserOneEarned).to.equal(reward);
    const finalUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(finalUserTwoEarned).to.equal(0);
  });

  it("Allows user to withdraw their earned rewards after they have all vested", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest it all in one go
    await dai.mint(lpMine.address, reward);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);

    await lpMine.connect(user).withdraw(reward);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(reward));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(reward));
  });

  it("Allows user to partially withdraw their earned rewards after they have all vested", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    await expect(lpMine.connect(user).withdraw(reward)).to.be.reverted;

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest it all in one go
    await dai.mint(lpMine.address, reward);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);

    // Withdraw half
    await lpMine.connect(user).withdraw(reward.div(2));

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.be.near(initialBalance.add(reward.div(2)));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.be.near(initialMineBalance.sub(reward.div(2)));
  });

  it("Allows user to withdrawAll their earned rewards after they have all vested", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest it all in one go
    await dai.mint(lpMine.address, reward);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);

    await lpMine.connect(user).withdrawAll();

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(reward));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(reward));
  });

  it("Allows user to withdraw the full amount from their partially vested rewards", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    await expect(lpMine.connect(user).withdraw(reward)).to.be.reverted;

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    await expect(lpMine.connect(user).withdraw(reward)).to.be.reverted;

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(vestedAmount);

    await lpMine.connect(user).withdraw(vestedAmount);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(vestedAmount));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(vestedAmount));
  });

  it("Allows user to withdraw some from their partially vested rewards", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    await expect(lpMine.connect(user).withdraw(reward)).to.be.reverted;

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(vestedAmount);

    // Withdraw half
    await lpMine.connect(user).withdraw(vestedAmount.div(2));

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.be.near(initialBalance.add(vestedAmount.div(2)));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.be.near(initialMineBalance.sub(vestedAmount.div(2)));
  });

  it("Allows user to withdrawAll from partially vested rewards", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(vestedAmount);

    await lpMine.connect(user).withdrawAll();

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(vestedAmount));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(vestedAmount));
  });

  it("Allows multiple users to withdraw", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondOneAmount = utils.parseEther('1000');
    const bondTwoAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    // Initial bond
    await lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(bondOneAmount);

    // Mock
    await mockBonding.mock.totalBonded.returns(bondOneAmount);
    // Second user bonding
    await lpMine.connect(miningService).onBond(userTwoAddress, bondTwoAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondTwoAmount);
    await mockBonding.mock.totalBonded.returns(bondOneAmount.add(bondTwoAmount));

    // Declare a reward now both users are bonded
    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    const initialBalanceOne = await dai.balanceOf(userOneAddress);
    const initialBalanceTwo = await dai.balanceOf(userTwoAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const secondUserOneEarned = await lpMine.earned(userOneAddress);
    expect(secondUserOneEarned).to.equal(vestedAmount.div(2));
    const secondUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(secondUserTwoEarned).to.equal(vestedAmount.div(2));

    await lpMine.connect(user1).withdraw(vestedAmount.div(2));

    await lpMine.connect(user2).withdraw(vestedAmount.div(2));

    const secondBalanceOne = await dai.balanceOf(userOneAddress);
    expect(secondBalanceOne).to.equal(initialBalanceOne.add(vestedAmount.div(2)));
    const secondBalanceTwo = await dai.balanceOf(userOneAddress);
    expect(secondBalanceTwo).to.equal(initialBalanceTwo.add(vestedAmount.div(2)));

    const secondMineBalance = await dai.balanceOf(lpMine.address);
    expect(secondMineBalance).to.equal(0);

    // Vest the other half
    await dai.mint(lpMine.address, vestedAmount);

    const finalUserOneEarned = await lpMine.earned(userOneAddress);
    expect(finalUserOneEarned).to.equal(vestedAmount.div(2));
    const finalUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(finalUserTwoEarned).to.equal(vestedAmount.div(2));

    await lpMine.connect(user1).withdrawAll();
    await lpMine.connect(user2).withdrawAll();

    const finalBalanceOne = await dai.balanceOf(userOneAddress);
    expect(finalBalanceOne).to.equal(secondBalanceOne.add(vestedAmount.div(2)));
    const finalBalanceTwo = await dai.balanceOf(userOneAddress);
    expect(finalBalanceTwo).to.equal(secondBalanceTwo.add(vestedAmount.div(2)));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(0);
  });

  it("Allows multiple users to withdrawAll", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondOneAmount = utils.parseEther('1000');
    const bondTwoAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    // Initial bond
    await lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(bondOneAmount);

    // Mock
    await mockBonding.mock.totalBonded.returns(bondOneAmount);
    // Second user bonding
    await lpMine.connect(miningService).onBond(userTwoAddress, bondTwoAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondTwoAmount);
    await mockBonding.mock.totalBonded.returns(bondOneAmount.add(bondTwoAmount));

    // Declare a reward now both users are bonded
    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    const initialBalanceOne = await dai.balanceOf(userOneAddress);
    const initialBalanceTwo = await dai.balanceOf(userTwoAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const secondUserOneEarned = await lpMine.earned(userOneAddress);
    expect(secondUserOneEarned).to.equal(vestedAmount.div(2));
    const secondUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(secondUserTwoEarned).to.equal(vestedAmount.div(2));

    await lpMine.connect(user1).withdrawAll();
    await lpMine.connect(user2).withdrawAll();

    const secondBalanceOne = await dai.balanceOf(userOneAddress);
    expect(secondBalanceOne).to.equal(initialBalanceOne.add(vestedAmount.div(2)));
    const secondBalanceTwo = await dai.balanceOf(userOneAddress);
    expect(secondBalanceTwo).to.equal(initialBalanceTwo.add(vestedAmount.div(2)));

    const secondMineBalance = await dai.balanceOf(lpMine.address);
    expect(secondMineBalance).to.equal(0);

    // Vest the other half
    await dai.mint(lpMine.address, vestedAmount);

    const finalUserOneEarned = await lpMine.earned(userOneAddress);
    expect(finalUserOneEarned).to.equal(vestedAmount.div(2));
    const finalUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(finalUserTwoEarned).to.equal(vestedAmount.div(2));

    await lpMine.connect(user1).withdrawAll();
    await lpMine.connect(user2).withdrawAll();

    const finalBalanceOne = await dai.balanceOf(userOneAddress);
    expect(finalBalanceOne).to.equal(secondBalanceOne.add(vestedAmount.div(2)));
    const finalBalanceTwo = await dai.balanceOf(userOneAddress);
    expect(finalBalanceTwo).to.equal(secondBalanceTwo.add(vestedAmount.div(2)));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(0);
  });

  it("Only allows miningService to call onUnbond", async function() {
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    await expect(lpMine.connect(user).onUnbond(userAddress, bondAmount)).to.be.reverted;
    await expect(lpMine.connect(user2).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await lpMine.connect(miningService).onUnbond(userAddress, bondAmount);
  });

  it("Handles calling onUnbond", async function() {
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    await expect(lpMine.connect(miningService).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialStakePadding = await lpMine.balanceOfStakePadding(userAddress);
    expect(initialStakePadding).to.be.above(0);

    await lpMine.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalStakePadding = await lpMine.balanceOfStakePadding(userAddress);

    expect(finalStakePadding).to.equal(0);
    expect(await lpMine.balanceOfRewards(userAddress)).to.equal(0);
  });

  it("Handles a partial withdraw", async function() {
    const [user, user2] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    await expect(lpMine.connect(miningService).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialStakePadding = await lpMine.balanceOfStakePadding(userAddress);
    expect(initialStakePadding).to.be.above(0);

    await lpMine.connect(miningService).onUnbond(userAddress, bondAmount.div(2));

    const finalStakePadding = await lpMine.balanceOfStakePadding(userAddress);

    expect(finalStakePadding).to.be.above(0);
    expect(finalStakePadding).to.be.below(initialStakePadding);
    expect(await lpMine.balanceOfRewards(userAddress)).to.equal(0);
  });

  it("Withdraws all rewards when a user unbonds", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest it all in one go
    await dai.mint(lpMine.address, reward);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);

    await expect(lpMine.connect(miningService).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await mockDistributor.mock.decrementRewards.withArgs(reward).returns();

    await lpMine.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(reward));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(reward));
  });

  it("Forfeits all unvested reward when user unbonds all", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);
    expect(initialBalance).to.equal(0);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(0);

    await expect(lpMine.connect(miningService).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await mockDistributor.mock.forfeit.withArgs(reward).returns();

    await lpMine.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(0);

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(0);
  });

  it("Forfeits and decrements rewards when part of rewards have vested when a user unbonds", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    // Vest half
    await dai.mint(lpMine.address, reward.div(2));

    const initialBalance = await dai.balanceOf(userAddress);
    expect(initialBalance).to.equal(0);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward.div(2));

    await expect(lpMine.connect(miningService).onUnbond(userAddress, bondAmount)).to.be.reverted;

    await mockDistributor.mock.forfeit.withArgs(reward.div(2)).returns();
    await mockDistributor.mock.decrementRewards.withArgs(reward.div(2)).returns();

    await lpMine.connect(miningService).onUnbond(userAddress, bondAmount);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(reward.div(2));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(0);
  });

  it("Correctly handles other user's rewards when unbonding", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondOneAmount = utils.parseEther('1000');
    const bondTwoAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    // Initial bond
    await lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(bondOneAmount);

    // Mock
    await mockBonding.mock.totalBonded.returns(bondOneAmount);
    // Second user bonding
    await lpMine.connect(miningService).onBond(userTwoAddress, bondTwoAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondTwoAmount);
    await mockBonding.mock.totalBonded.returns(bondOneAmount.add(bondTwoAmount));

    // Declare a reward now both users are bonded
    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    const initialBalanceOne = await dai.balanceOf(userOneAddress);
    const initialBalanceTwo = await dai.balanceOf(userTwoAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const secondUserOneEarned = await lpMine.earned(userOneAddress);
    expect(secondUserOneEarned).to.equal(vestedAmount.div(2));
    const secondUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(secondUserTwoEarned).to.equal(vestedAmount.div(2));

    const userOneRewarded = await lpMine.balanceOfRewards(userOneAddress);
    const userTwoRewarded = await lpMine.balanceOfRewards(userTwoAddress);

    expect(userOneRewarded).to.equal(userTwoRewarded);
    expect(userOneRewarded).to.equal(vestedAmount);

    await mockDistributor.mock.forfeit.withArgs(vestedAmount.div(2)).returns();
    await mockDistributor.mock.decrementRewards.withArgs(vestedAmount.div(2)).returns();

    await lpMine.connect(miningService).onUnbond(userOneAddress, bondOneAmount);

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(reward.sub(vestedAmount));
    await mockBonding.mock.totalBonded.returns(bondTwoAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(0);

    const finalBalanceOne = await dai.balanceOf(userOneAddress);
    const finalBalanceTwo = await dai.balanceOf(userTwoAddress);
    expect(finalBalanceOne).to.equal(secondUserOneEarned);
    expect(finalBalanceTwo).to.equal(0);
    const secondMineBalance = await dai.balanceOf(lpMine.address);
    expect(secondMineBalance).to.equal(secondUserTwoEarned);

    const finalUserOneRewarded = await lpMine.balanceOfRewards(userOneAddress);
    const finalUserTwoRewarded = await lpMine.balanceOfRewards(userTwoAddress);
    expect(finalUserOneRewarded).to.equal(0);
    expect(finalUserTwoRewarded).to.equal(userTwoRewarded);

    const finalUserOneEarned = await lpMine.earned(userOneAddress);
    expect(finalUserOneEarned).to.equal(0);
    const finalUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(finalUserTwoEarned).to.equal(secondUserTwoEarned);
  });

  it("Allows multiple users to unbond", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondOneAmount = utils.parseEther('1000');
    const bondTwoAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    // Initial bond
    await lpMine.connect(miningService).onBond(userOneAddress, bondOneAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(bondOneAmount);

    // Mock
    await mockBonding.mock.totalBonded.returns(bondOneAmount);
    // Second user bonding
    await lpMine.connect(miningService).onBond(userTwoAddress, bondTwoAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondTwoAmount);
    await mockBonding.mock.totalBonded.returns(bondOneAmount.add(bondTwoAmount));

    // Declare a reward now both users are bonded
    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    const initialBalanceOne = await dai.balanceOf(userOneAddress);
    const initialBalanceTwo = await dai.balanceOf(userTwoAddress);

    // Vest half
    const vestedAmount = reward.div(2);
    await dai.mint(lpMine.address, vestedAmount);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const secondUserOneEarned = await lpMine.earned(userOneAddress);
    expect(secondUserOneEarned).to.equal(vestedAmount.div(2));
    const secondUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(secondUserTwoEarned).to.equal(vestedAmount.div(2));

    const userOneRewarded = await lpMine.balanceOfRewards(userOneAddress);
    const userTwoRewarded = await lpMine.balanceOfRewards(userTwoAddress);

    expect(userOneRewarded).to.equal(userTwoRewarded);
    expect(userOneRewarded).to.equal(vestedAmount);

    await mockDistributor.mock.forfeit.withArgs(vestedAmount.div(2)).returns();
    await mockDistributor.mock.decrementRewards.withArgs(vestedAmount.div(2)).returns();

    await lpMine.connect(miningService).onUnbond(userOneAddress, bondOneAmount);

    await mockDistributor.mock.totalDeclaredReward.returns(reward.sub(vestedAmount));
    await mockBonding.mock.totalBonded.returns(bondTwoAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(0);

    await lpMine.connect(miningService).onUnbond(userTwoAddress, bondTwoAmount);

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(0);

    const finalBalanceOne = await dai.balanceOf(userOneAddress);
    const finalBalanceTwo = await dai.balanceOf(userTwoAddress);
    expect(finalBalanceOne).to.equal(secondUserOneEarned);
    expect(finalBalanceTwo).to.equal(secondUserTwoEarned);
    const secondMineBalance = await dai.balanceOf(lpMine.address);
    expect(secondMineBalance).to.equal(0);

    const finalUserOneRewarded = await lpMine.balanceOfRewards(userOneAddress);
    const finalUserTwoRewarded = await lpMine.balanceOfRewards(userTwoAddress);
    expect(finalUserOneRewarded).to.equal(0);
    expect(finalUserTwoRewarded).to.equal(0);

    const finalUserOneEarned = await lpMine.earned(userOneAddress);
    expect(finalUserOneEarned).to.equal(0);
    const finalUserTwoEarned = await lpMine.earned(userTwoAddress);
    expect(finalUserTwoEarned).to.equal(0);
  });

  it("Only allows admin to set reward token", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(lpMine.connect(user).setRewardToken(newAddress)).to.be.reverted;
    await expect(lpMine.connect(miningService).setRewardToken(newAddress)).to.be.reverted;

    await lpMine.connect(admin).setRewardToken(newAddress);
    expect(await lpMine.rewardToken()).to.equal(newAddress);

    await lpMine.setRewardToken(new2Address);
    expect(await lpMine.rewardToken()).to.equal(new2Address);
  });

  it("Only allows admin to set Mining Service", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(lpMine.connect(user).setMiningService(newAddress)).to.be.reverted;
    await expect(lpMine.connect(miningService).setMiningService(newAddress)).to.be.reverted;

    await lpMine.connect(admin).setMiningService(newAddress);
    expect(await lpMine.miningService()).to.equal(newAddress);

    await lpMine.setMiningService(new2Address);
    expect(await lpMine.miningService()).to.equal(new2Address);
  });

  it("Only allows admin to set Distributor", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(lpMine.connect(user).setDistributor(newAddress)).to.be.reverted;
    await expect(lpMine.connect(miningService).setDistributor(newAddress)).to.be.reverted;

    await lpMine.connect(admin).setDistributor(newAddress);
    expect(await lpMine.distributor()).to.equal(newAddress);

    await lpMine.setDistributor(new2Address);
    expect(await lpMine.distributor()).to.equal(new2Address);
  });

  it("Only allows admin to set Bonding", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(lpMine.connect(user).setBonding(newAddress)).to.be.reverted;
    await expect(lpMine.connect(miningService).setBonding(newAddress)).to.be.reverted;

    await lpMine.connect(admin).setBonding(newAddress);
    expect(await lpMine.bonding()).to.equal(newAddress);

    await lpMine.setBonding(new2Address);
    expect(await lpMine.bonding()).to.equal(new2Address);
  });

  it("Handles second user bonding and unbonding", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    const bondAmount = utils.parseEther('1000');

    // USER 1 BOND
    let reward = utils.parseEther('100');
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);
    await lpMine.connect(miningService).onBond(userOneAddress, bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userOneAddress).returns(bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    // USER 2 BOND
    // Add another 200 in rewards
    reward = reward.add(utils.parseEther('200'));
    await lpMine.connect(miningService).onBond(userTwoAddress, bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount.mul(2));
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    // user 1 gets all 100 of original reward and half of the 200 additional.
    // Therefore of the 300 total reward, user 1 is owed 200 of it
    const desiredUserOneReward = utils.parseEther('200');
    const desiredUserTwoReward = utils.parseEther('100');
    let userOneReward = await lpMine.balanceOfRewards(userOneAddress);
    let userTwoReward = await lpMine.balanceOfRewards(userTwoAddress);
    expect(userOneReward).to.equal(desiredUserOneReward);
    expect(userTwoReward).to.equal(desiredUserTwoReward);

    // USER 2 BOND AGAIN
    await lpMine.connect(miningService).onBond(userTwoAddress, bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondAmount.mul(2));
    await mockBonding.mock.totalBonded.returns(bondAmount.mul(3));

    // No change to reward
    userOneReward = await lpMine.balanceOfRewards(userOneAddress);
    userTwoReward = await lpMine.balanceOfRewards(userTwoAddress);
    expect(userOneReward).to.equal(desiredUserOneReward);
    expect(userTwoReward).to.equal(desiredUserTwoReward);

    // USER 2 UNBONDS PREVIOUS AMOUNT
    // Half of user 2 LP is being removed, therefore half their 100 reward is forfeited
    const forfeitAmount = desiredUserTwoReward.div(2)
    await mockDistributor.mock.forfeit.withArgs(forfeitAmount).returns();
    await lpMine.connect(miningService).onUnbond(userTwoAddress, bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount.mul(2));
    reward = reward.sub(forfeitAmount);
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    // user 1 should still have 200 rewards and user 2 should have 50 due
    // to forfeiting half of their 100
    userOneReward = await lpMine.balanceOfRewards(userOneAddress);
    userTwoReward = await lpMine.balanceOfRewards(userTwoAddress);
    expect(userOneReward).to.equal(desiredUserOneReward);
    expect(userTwoReward).to.equal(desiredUserTwoReward.div(2));


    // USER 2 BOND AGAIN
    await lpMine.connect(miningService).onBond(userTwoAddress, bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondAmount.mul(2));
    await mockBonding.mock.totalBonded.returns(bondAmount.mul(3));

    // No change to reward
    userOneReward = await lpMine.balanceOfRewards(userOneAddress);
    userTwoReward = await lpMine.balanceOfRewards(userTwoAddress);
    expect(userOneReward).to.equal(desiredUserOneReward);
    expect(userTwoReward).to.equal(desiredUserTwoReward.div(2));

    // USER 2 UNBONDS PREVIOUS AMOUNT
    // Half of user 2 LP is being removed, therefore half their 50 reward is forfeited
    await mockDistributor.mock.forfeit.withArgs(desiredUserTwoReward.div(4)).returns();
    await lpMine.connect(miningService).onUnbond(userTwoAddress, bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userTwoAddress).returns(bondAmount);
    await mockBonding.mock.totalBonded.returns(bondAmount.mul(2));
    reward = reward.sub(desiredUserTwoReward.div(4));
    await mockDistributor.mock.totalDeclaredReward.returns(reward);

    // user 1 should still have 200 rewards and user 2 should have 25 due
    // to forfeiting half of their 50
    userOneReward = await lpMine.balanceOfRewards(userOneAddress);
    userTwoReward = await lpMine.balanceOfRewards(userTwoAddress);
    expect(userOneReward).to.equal(desiredUserOneReward);
    expect(userTwoReward).to.equal(desiredUserTwoReward.div(4));
  });

  it("Only allows miningService to call withdrawForAccount", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest it all in one go
    await dai.mint(lpMine.address, reward);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);

    await expect(lpMine.connect(admin).withdrawForAccount(userAddress, reward, userAddress)).to.be.reverted;
    await expect(lpMine.withdrawForAccount(userAddress, reward, userAddress)).to.be.reverted;

    await lpMine.connect(miningService).withdrawForAccount(userAddress, reward, userAddress);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(reward));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(reward));
  });

  it("Calling withdrawForAccount caps amount to available earned reward", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const bondAmount = utils.parseEther('1000');

    // Mock
    await mockDistributor.mock.totalDeclaredReward.returns(0);
    await mockBonding.mock.totalBonded.returns(0);

    await lpMine.connect(miningService).onBond(userAddress, bondAmount);

    const reward = utils.parseEther('2347')
    await mockDistributor.mock.totalDeclaredReward.returns(reward);
    await mockBonding.mock.totalBonded.returns(bondAmount);
    await mockBonding.mock.balanceOfBonded.withArgs(userAddress).returns(bondAmount);

    const initialBalance = await dai.balanceOf(userAddress);

    // Vest it all in one go
    await dai.mint(lpMine.address, reward);

    const initialMineBalance = await dai.balanceOf(lpMine.address);

    const finalUserEarned = await lpMine.earned(userAddress);
    expect(finalUserEarned).to.equal(reward);

    // Try withdrawing 10x more than available. Should get capped back down to `reward`
    await lpMine.connect(miningService).withdrawForAccount(userAddress, reward.mul(10), userAddress);

    const finalBalance = await dai.balanceOf(userAddress);
    expect(finalBalance).to.equal(initialBalance.add(reward));

    const finalMineBalance = await dai.balanceOf(lpMine.address);
    expect(finalMineBalance).to.equal(initialMineBalance.sub(reward));
  });
});
