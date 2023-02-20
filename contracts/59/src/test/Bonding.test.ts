import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { UniswapHandler } from "../type/UniswapHandler";
import { Bonding } from "../type/Bonding";
import { MaltDAO } from "../type/MaltDAO";
import { MiningService } from "../type/MiningService";
import { TransferService } from "../type/TransferService";
import { Malt } from "../type/Malt";
import { MaltDataLab } from "../type/MaltDataLab";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, setNextBlockTime } from "./helpers";
import MaltDaoArtifacts from "../artifacts/contracts/DAO.sol/MaltDAO.json";
import UniswapV2RouterBuild from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import UniswapV2FactoryBuild from "@uniswap/v2-core/build/UniswapV2Factory.json";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import WETHBuild from "@uniswap/v2-periphery/build/WETH9.json";
import MiningServiceArtifacts from "../artifacts/contracts/MiningService.sol/MiningService.json";

const UniswapV2FactoryBytecode = UniswapV2FactoryBuild.bytecode;
const UniswapV2FactoryAbi = UniswapV2FactoryBuild.abi;

const UniswapV2RouterBytecode = UniswapV2RouterBuild.bytecode;
const UniswapV2RouterAbi = UniswapV2RouterBuild.abi;
const WETHBytecode = WETHBuild.bytecode;
const WETHAbi = WETHBuild.abi;

const { deployMockContract } = waffle;

describe("Bonding", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let offering: Signer;
  let lpFaucet: Signer;

  let bonding: Bonding;
  let lpToken: ERC20;
  let malt: ERC20;
  let dai: ERC20;
  let uniswapHandler: UniswapHandler;
  let snapshotId: string;
  let mockDAO: MaltDAO;
  let mockMiningService: MiningService;
  let mockTransferService: TransferService;
  let mockDataLab: MaltDataLab;
  const initialEpoch = 0;
  const epochLength = 30 * 60; // 30 minutes

  let weth: Contract;
  let router: any;
  let factory: any;

  let initialTime: number;
  let currentTime: number;

  let maltReserves = utils.parseEther('10000000');
  let daiReserves = utils.parseEther('10000000');

  async function increaseNextBlockTime(amount: number) {
    currentTime += amount;
    await setNextBlockTime(currentTime);
  }

  async function resetBlockTime() {
    initialTime = Math.floor((new Date().getTime()) / 1000) + 100;
    currentTime = initialTime;
    await setNextBlockTime(currentTime);
  }

  async function addInitialLiquidity() {
    await malt.mint(uniswapHandler.address, maltReserves);
    await dai.mint(uniswapHandler.address, daiReserves);
    await uniswapHandler.connect(lpFaucet).addLiquidity();
  }

  async function addLiquidity(user: string, amount: BigNumber) {
    await lpToken.connect(lpFaucet).transfer(user, amount);
  }

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, offering, lpFaucet, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const offeringAddress = await offering.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    // Deploy Uniswap Contracts
    const routerContract = new ContractFactory(UniswapV2RouterAbi, UniswapV2RouterBytecode, owner);
    const wethContract = new ContractFactory(WETHAbi, WETHBytecode, owner);

    const factoryContract = new ContractFactory(UniswapV2FactoryAbi, UniswapV2FactoryBytecode, owner);
    factory = await factoryContract.deploy(constants.AddressZero);

    weth = await wethContract.deploy();
    await weth.deployed();
    router = await routerContract.deploy(factory.address, weth.address);
    await router.deployed();

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await malt.deployed();

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    await factory.createPair(malt.address, dai.address);
    const lpTokenAddress = await factory.getPair(malt.address, dai.address);
    lpToken = (new Contract(lpTokenAddress, IERC20.abi, owner)) as Malt;

    // Deploy the UniswapHandler
    const UniswapHandlerFactory = await ethers.getContractFactory("UniswapHandler");

    uniswapHandler = (await UniswapHandlerFactory.deploy()) as UniswapHandler;
    await uniswapHandler.initialize(
      ownerAddress,
      adminAddress,
      malt.address,
      dai.address,
      lpToken.address,
      router.address,
      factory.address
    );
    await uniswapHandler.deployed();

    // Create the mock dao and mining service
    mockDAO = ((await deployMockContract(owner, MaltDaoArtifacts.abi)) as any) as MaltDAO;
    await mockDAO.mock.epoch.returns(initialEpoch);
    await mockDAO.mock.epochLength.returns(epochLength);

    mockMiningService = ((await deployMockContract(owner, MiningServiceArtifacts.abi)) as any) as MiningService;
    mockDataLab = ((await deployMockContract(owner, [
      "function realValueOfLPToken(uint256) returns (uint256)",
    ])) as any) as MaltDataLab;

    // Deploy the Bonding contract
    const BondingFactory = await ethers.getContractFactory("Bonding");

    bonding = (await BondingFactory.deploy()) as Bonding;
    await bonding.initialize(
      ownerAddress,
      adminAddress,
      malt.address,
      dai.address,
      lpToken.address,
      mockDAO.address,
      mockMiningService.address,
      offeringAddress,
      uniswapHandler.address,
      mockDataLab.address,
    );

    await addInitialLiquidity();
    await resetBlockTime();

    for (let i = 0; i < 10; i++) {
      await mockDAO.mock.getEpochStartTime.withArgs(i).returns(initialTime + i * epochLength);
    }
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await bonding.stakeToken()).to.equal(lpToken.address);
    expect(await bonding.dao()).to.equal(mockDAO.address);
    expect(await bonding.miningService()).to.equal(mockMiningService.address);
    expect(await bonding.totalBonded()).to.equal(0);
  });

  it("Fails to bond zero LP tokens", async function() {
    await expect(bonding.bond(0)).to.be.reverted;
  });

  it("Allows a user to bond", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);

    // mining service methods aren't mocked yet so should revert
    await expect(bonding.connect(user).bond(lpAmount)).to.be.reverted;

    // Try again with those methods added
    await mockMiningService.mock.onBond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);
  });

  it("Allows bonding to another account", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();
    const user1Address = await user1.getAddress();

    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);

    // mining service methods aren't mocked yet so should revert
    await expect(bonding.connect(user).bondToAccount(user1Address, lpAmount)).to.be.reverted;

    // Try again with those methods added
    await mockMiningService.mock.onBond.returns();
    await bonding.connect(user).bondToAccount(user1Address, lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(0);
    expect(await bonding.balanceOfBonded(user1Address)).to.equal(lpAmount);
  });

  it("Disallows unbond 0", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);

    await expect(bonding.connect(user).unbond(0)).to.be.reverted;
  });

  it("Disallows unbonding when user has nothing bonded", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    await mockMiningService.mock.onUnbond.returns();

    await expect(bonding.connect(user).unbond(10)).to.be.reverted;
  });

  it("Disallows unbonding more than bonded balance", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    await expect(bonding.connect(user).unbond(lpAmount.mul(2))).to.be.reverted;
  });

  it("Allows user to unbond full balance", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);

    await bonding.connect(user).unbond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(0);
  });

  it("Allows user to unbond partial balance", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);

    // Unbond 1/5 = 20% of bonded balance
    await bonding.connect(user).unbond(lpAmount.mul(1).div(5));

    // Should have 4/5 = 80% of bonded balance remaining
    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount.mul(4).div(5));
  });

  it("Allows user to unbond and break half balance", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);

    expect(await malt.balanceOf(userAddress)).to.equal(0);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await bonding.connect(user).unbondAndBreak(lpAmount.div(2));

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount.div(2));

    expect(await malt.balanceOf(userAddress)).to.equal(utils.parseEther('500'));
    expect(await dai.balanceOf(userAddress)).to.equal(utils.parseEther('500'));
  });

  it("Allows user to unbond and break full balance", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);

    expect(await malt.balanceOf(userAddress)).to.equal(0);
    expect(await dai.balanceOf(userAddress)).to.equal(0);

    await bonding.connect(user).unbondAndBreak(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(0);

    expect(await malt.balanceOf(userAddress)).to.equal(utils.parseEther('1000'));
    expect(await dai.balanceOf(userAddress)).to.equal(utils.parseEther('1000'));
  });

  it("Correctly returns totalBonded", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();
    const user1Address = await user1.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    const bal = await lpToken.balanceOf(userAddress);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);

    let totalBonded = await bonding.totalBonded();

    expect(totalBonded).to.equal(lpAmount);

    // Bond to user1 account
    const nextLpAmount = utils.parseEther('5523');
    await addLiquidity(user1Address, nextLpAmount);
    await lpToken.connect(user1).approve(bonding.address, nextLpAmount);
    await bonding.connect(user1).bond(nextLpAmount);

    expect(await bonding.balanceOfBonded(userAddress)).to.equal(lpAmount);
    expect(await bonding.balanceOfBonded(user1Address)).to.equal(nextLpAmount);

    totalBonded = await bonding.totalBonded();

    expect(totalBonded).to.equal(lpAmount.add(nextLpAmount));
  });

  it("Allows admins to set new mining service contract", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(bonding.connect(user).setMiningService(newAddress)).to.be.reverted;
    await expect(bonding.connect(offering).setMiningService(newAddress)).to.be.reverted;

    await bonding.connect(admin).setMiningService(newAddress);
    expect(await bonding.miningService()).to.equal(newAddress);

    await bonding.setMiningService(new2Address);
    expect(await bonding.miningService()).to.equal(new2Address);
  });

  it("Allows admins to set new dao contract", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(bonding.connect(user).setDAO(newAddress)).to.be.reverted;
    await expect(bonding.connect(offering).setDAO(newAddress)).to.be.reverted;

    await bonding.connect(admin).setDAO(newAddress);
    expect(await bonding.dao()).to.equal(newAddress);

    await bonding.setDAO(new2Address);
    expect(await bonding.dao()).to.equal(new2Address);
  });

  it("Allows admins to set new dex handler contract", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(bonding.connect(user).setDexHandler(newAddress)).to.be.reverted;
    await expect(bonding.connect(offering).setDexHandler(newAddress)).to.be.reverted;

    await bonding.connect(admin).setDexHandler(newAddress);
    expect(await bonding.dexHandler()).to.equal(newAddress);

    await bonding.setDexHandler(new2Address);
    expect(await bonding.dexHandler()).to.equal(new2Address);
  });

  it("Can correctly calculate the basic averageBondedValue", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();
    const user1Address = await user1.getAddress();

    // Bond to user account in epoch 1
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    await mockDAO.mock.epoch.returns(initialEpoch + 1);
    await increaseNextBlockTime(epochLength); // 30 minutes

    // Bond to user1 account in epoch 2
    const nextLpAmount = utils.parseEther('2000');
    await addLiquidity(user1Address, nextLpAmount);
    await lpToken.connect(user1).approve(bonding.address, nextLpAmount);
    await bonding.connect(user1).bond(nextLpAmount);

    const lpValue = utils.parseEther('1934');
    await mockDataLab.mock.realValueOfLPToken.withArgs(utils.parseEther('992.222222222222222222')).returns(lpValue);
    let averageBonded = await bonding.averageBondedValue(initialEpoch);

    expect(averageBonded).to.equal(lpValue);

    await increaseNextBlockTime(epochLength); // 30 minutes
    await mockDAO.mock.epoch.returns(initialEpoch + 2);

    const nextLpValue = utils.parseEther('3924');
    await mockDataLab.mock.realValueOfLPToken.withArgs(utils.parseEther('2997.777777777777777777')).returns(nextLpValue);

    averageBonded = await bonding.averageBondedValue(initialEpoch + 1);

    expect(averageBonded).to.equal(nextLpValue);
  });

  it("Can correctly calculate averageBondedValue with multiple actions in the same epoch", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();
    const user1Address = await user1.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    await increaseNextBlockTime(epochLength / 3); // 10 minutes

    // Bond to user1 account
    const nextLpAmount = utils.parseEther('2000');
    await addLiquidity(user1Address, nextLpAmount);
    await lpToken.connect(user1).approve(bonding.address, nextLpAmount);
    await bonding.connect(user1).bond(nextLpAmount);

    await increaseNextBlockTime(epochLength / 3); // 10 minutes

    // Unbond from user1 account
    const unbondLpAmount = utils.parseEther('400');
    await bonding.connect(user1).unbond(unbondLpAmount);

    await increaseNextBlockTime(epochLength / 3); // 10 minutes
    await mockDAO.mock.epoch.returns(initialEpoch + 1);

    let lpValue = utils.parseEther('4203');
    await mockDataLab.mock.realValueOfLPToken.withArgs(utils.parseEther('2190')).returns(lpValue);

    let averageBonded = await bonding.averageBondedValue(initialEpoch);

    expect(averageBonded).to.equal(lpValue);
  });

  it("Can correctly calculate averageBondedValue with actions separated by multiple epochs", async function() {
    const [user, user1] = accounts;
    const userAddress = await user.getAddress();
    const user1Address = await user1.getAddress();

    // Bond to user account
    const lpAmount = utils.parseEther('1000');
    await addLiquidity(userAddress, lpAmount);
    await lpToken.connect(user).approve(bonding.address, lpAmount);
    await mockMiningService.mock.onBond.returns();
    await mockMiningService.mock.onUnbond.returns();
    await bonding.connect(user).bond(lpAmount);

    await increaseNextBlockTime(epochLength * 2); // 60 minutes
    await mockDAO.mock.epoch.returns(initialEpoch + 2);

    // Bond to user1 account
    const nextLpAmount = utils.parseEther('2000');
    await addLiquidity(user1Address, nextLpAmount);
    await lpToken.connect(user1).approve(bonding.address, nextLpAmount);
    await bonding.connect(user1).bond(nextLpAmount);

    await increaseNextBlockTime(epochLength); // 30 minutes
    await mockDAO.mock.epoch.returns(initialEpoch + 3);

    let lpValue = utils.parseEther('2203');
    await mockDataLab.mock.realValueOfLPToken.withArgs(utils.parseEther('992.222222222222222222')).returns(lpValue);

    let averageBonded = await bonding.averageBondedValue(initialEpoch);
    expect(averageBonded).to.equal(lpValue);

    lpValue = utils.parseEther('2344');
    await mockDataLab.mock.realValueOfLPToken.withArgs(utils.parseEther('1000')).returns(lpValue);

    averageBonded = await bonding.averageBondedValue(initialEpoch + 1);
    expect(averageBonded).to.equal(lpValue);

    lpValue = utils.parseEther('4372');
    await mockDataLab.mock.realValueOfLPToken.withArgs(utils.parseEther('2996.666666666666666666')).returns(lpValue);

    averageBonded = await bonding.averageBondedValue(initialEpoch + 2);
    expect(averageBonded).to.equal(lpValue);
  });
});
