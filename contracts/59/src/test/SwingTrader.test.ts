import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { UniswapHandler } from "../type/UniswapHandler";
import { SwingTrader } from "../type/SwingTrader";
import { RewardThrottle } from "../type/RewardThrottle";
import { Malt } from "../type/Malt";
import { ERC20 } from "../type/ERC20";
import { TransferService } from "../type/TransferService";
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

describe("Swing Trader", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let stabilizerNode: Signer;

  let uniswapHandler: UniswapHandler;
  let swingTrader: SwingTrader;
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;
  let mockRewardThrottle: RewardThrottle;
  let mockTransferService: TransferService;

  let weth: Contract;
  let router: any;
  let factory: any;

  let maltReserves = utils.parseEther('10000000');
  let daiReserves = utils.parseEther('10000000');

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
    [owner, admin, stabilizerNode, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

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

    // Deploy the SwingTrader
    const SwingTraderFactory = await ethers.getContractFactory("SwingTrader");

    swingTrader = (await SwingTraderFactory.deploy()) as SwingTrader;
    await swingTrader.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      malt.address,
      uniswapHandler.address,
      stabilizerNodeAddress,
      mockRewardThrottle.address
    );
    await uniswapHandler.deployed();

    await malt.mint(uniswapHandler.address, maltReserves);
    await dai.mint(uniswapHandler.address, daiReserves);
    await uniswapHandler.addLiquidity();

    await uniswapHandler.connect(admin).addNewBuyer(swingTrader.address);
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await swingTrader.malt()).to.equal(malt.address);
    expect(await swingTrader.collateralToken()).to.equal(dai.address);
    expect(await swingTrader.dexHandler()).to.equal(uniswapHandler.address);
    expect(await swingTrader.rewardThrottle()).to.equal(mockRewardThrottle.address);
    expect(await swingTrader.lpProfitCut()).to.equal(500);
  });

  it("Disallows non stabilizer calling buyMalt", async function() {
    const [user1, user2, ...rest] = accounts;

    const amountDai = utils.parseEther('2000');
    await expect(
      swingTrader.connect(user1).buyMalt(amountDai)
    ).to.be.reverted;

    await expect(
      swingTrader.connect(user2).buyMalt(amountDai)
    ).to.be.reverted;

    await expect(
      swingTrader.connect(admin).buyMalt(amountDai)
    ).to.be.reverted;
  });

  it("Can buy malt using all capital", async function() {
    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.equal(0);
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.equal(0);

    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.be.above(utils.parseEther('1990'));
    expect(finalDaiBalance).to.equal(0);
    expect(finalCostBasis).to.be.above(utils.parseEther('1'));
    expect(finalCostBasis).to.be.below(utils.parseEther('1.005'));
    expect(decimals).to.equal(18);
  });

  it("Can buy malt using less than all capital", async function() {
    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.equal(0);
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.equal(0);

    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai.div(2));

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.be.above(utils.parseEther('995'));
    expect(finalDaiBalance).to.near(amountDai.div(2), 100);
    expect(finalCostBasis).to.be.above(utils.parseEther('1'));
    expect(finalCostBasis).to.be.below(utils.parseEther('1.005'));
    expect(decimals).to.equal(18);
  });

  it("Handles 0 capital purchase correctly", async function() {
    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.equal(0);
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.equal(0);

    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(0);

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.equal(0);
    expect(finalDaiBalance).to.equal(amountDai);
    expect(finalCostBasis).to.equal(0);
    expect(decimals).to.equal(18);
  });

  it("It handles having no funds when requesting purchasing Malt", async function() {
    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.equal(0);
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.equal(0);

    const amountDai = utils.parseEther('2000');
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.equal(0);
    expect(finalDaiBalance).to.equal(0);
    expect(finalCostBasis).to.equal(0);
    expect(decimals).to.equal(18);
  });

  it("It handles maxCapital being larger than available funds when buying Malt", async function() {
    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.equal(0);
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.equal(0);

    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai.mul(10));

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.be.above(utils.parseEther('1990'));
    expect(finalDaiBalance).to.equal(0);
    expect(finalCostBasis).to.be.above(utils.parseEther('1'));
    expect(finalCostBasis).to.be.below(utils.parseEther('1.005'));
    expect(decimals).to.equal(18);
  });

  it("Disallows non stabilizer calling sellMalt", async function() {
    const [user1, user2, ...rest] = accounts;

    const amountMalt = utils.parseEther('2000');
    await expect(
      swingTrader.connect(user1).sellMalt(amountMalt)
    ).to.be.reverted;

    await expect(
      swingTrader.connect(user2).sellMalt(amountMalt)
    ).to.be.reverted;

    await expect(
      swingTrader.connect(admin).sellMalt(amountMalt)
    ).to.be.reverted;
  });

  it("Can sell all the malt it has", async function() {
    // Purchase some Malt so there is some to sell + a valid cost basis
    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.be.above(utils.parseEther('1990'));
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.be.above(utils.parseEther('1'));
    expect(initialCostBasis).to.be.below(utils.parseEther('1.005'));

    await swingTrader.connect(stabilizerNode).sellMalt(initialMaltBalance);

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.be.equal(0);
    expect(finalDaiBalance).to.be.above(utils.parseEther('1985'));
    expect(finalCostBasis).to.equal(0);
    expect(decimals).to.equal(18);
  });

  it("Can sell less than all available Malt", async function() {
    // Purchase some Malt so there is some to sell + a valid cost basis
    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.be.above(utils.parseEther('1990'));
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.be.above(utils.parseEther('1'));
    expect(initialCostBasis).to.be.below(utils.parseEther('1.005'));

    await swingTrader.connect(stabilizerNode).sellMalt(initialMaltBalance.div(2));

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.be.above(utils.parseEther('995'));
    expect(finalDaiBalance).to.be.above(utils.parseEther('992'));
    expect(finalCostBasis).to.be.above(utils.parseEther('1.005'));
    expect(finalCostBasis).to.be.below(utils.parseEther('1.01'));
    expect(decimals).to.equal(18);
  });

  it("Handles passing 0 as maxAmount to sellMalt correctly", async function() {
    // Purchase some Malt so there is some to sell + a valid cost basis
    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.be.above(utils.parseEther('1990'));
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.be.above(utils.parseEther('1'));
    expect(initialCostBasis).to.be.below(utils.parseEther('1.005'));

    await swingTrader.connect(stabilizerNode).sellMalt(0);

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.equal(initialMaltBalance);
    expect(finalDaiBalance).to.equal(0);
    expect(finalCostBasis).to.be.above(utils.parseEther('1'));
    expect(finalCostBasis).to.be.below(utils.parseEther('1.005'));
    expect(decimals).to.equal(18);
  });

  it("It handles having no funds when requesting purchasing Malt", async function() {
    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.equal(0);
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.equal(0);

    const amountDai = utils.parseEther('2000');
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.equal(0);
    expect(finalDaiBalance).to.equal(0);
    expect(finalCostBasis).to.equal(0);
    expect(decimals).to.equal(18);
  });

  it("It handles maxAmount being larger than available funds when selling Malt", async function() {
    // Purchase some Malt so there is some to sell + a valid cost basis
    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai);
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const initialMaltBalance = await malt.balanceOf(swingTrader.address);
    expect(initialMaltBalance).to.be.above(utils.parseEther('1990'));
    const [initialCostBasis] = await swingTrader.costBasis();
    expect(initialCostBasis).to.be.above(utils.parseEther('1'));
    expect(initialCostBasis).to.be.below(utils.parseEther('1.005'));

    await swingTrader.connect(stabilizerNode).sellMalt(initialMaltBalance.mul(10));

    const finalMaltBalance = await malt.balanceOf(swingTrader.address);
    const finalDaiBalance = await dai.balanceOf(swingTrader.address);
    const [finalCostBasis, decimals] = await swingTrader.costBasis();

    expect(finalMaltBalance).to.equal(0);
    expect(finalDaiBalance).to.be.above(utils.parseEther('1985'));
    expect(finalCostBasis).to.equal(0);
    expect(decimals).to.equal(18);
  });

  it("It correctly calculates cost basis", async function() {
    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai.mul(10));
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    let costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('1'));
    expect(costBasis[0]).to.be.below(utils.parseEther('1.005'));

    // Purchase Malt from a different account to push price upwards
    await buyMalt(utils.parseEther('100000'));

    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);
    costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('1.01'));
    expect(costBasis[0]).to.be.below(utils.parseEther('1.015'));

    // Purchase Malt from a different account to push price upwards
    await buyMalt(utils.parseEther('100000'));

    await swingTrader.connect(stabilizerNode).buyMalt(amountDai.mul(3));
    costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('1.03'));
    expect(costBasis[0]).to.be.below(utils.parseEther('1.035'));

    // Purchase Malt from a different account to push price upwards
    await buyMalt(utils.parseEther('1000000'));

    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);
    costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('1.06'));
    expect(costBasis[0]).to.be.below(utils.parseEther('1.065'));

    // Purchase Malt from a different account to push price upwards
    await buyMalt(utils.parseEther('1000000'));

    // Sell some amount of Malt and verify the cost basis drops
    await swingTrader.connect(stabilizerNode).sellMalt(amountDai);
    costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('0.97'));
    expect(costBasis[0]).to.be.below(utils.parseEther('0.975'));
  });

  it("It a portion of profits to rewardThrottle", async function() {
    const amountDai = utils.parseEther('2000');
    await dai.mint(swingTrader.address, amountDai.mul(10));
    await swingTrader.connect(stabilizerNode).buyMalt(amountDai);

    const throttleBalance = await dai.balanceOf(mockRewardThrottle.address);
    expect(throttleBalance).to.equal(0);

    let costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('1'));
    expect(costBasis[0]).to.be.below(utils.parseEther('1.005'));

    // Purchase Malt from a different account to push price upwards
    await buyMalt(utils.parseEther('1000000'));

    // Sell some amount of Malt and verify the cost basis drops
    await swingTrader.connect(stabilizerNode).sellMalt(amountDai.div(3));
    costBasis = await swingTrader.costBasis();
    expect(costBasis[0]).to.be.above(utils.parseEther('0.90'));
    expect(costBasis[0]).to.be.below(utils.parseEther('0.905'));

    // This is based on the default lpProfitCut of 50%
    const finalThrottleBalance = await dai.balanceOf(mockRewardThrottle.address);
    expect(finalThrottleBalance).to.be.above(utils.parseEther('67.7'));
    expect(finalThrottleBalance).to.be.below(utils.parseEther('67.8'));
  });

  it("It only allows admins to update lpProfitCut", async function() {
    expect(await swingTrader.lpProfitCut()).to.equal(500);

    const [user] = accounts;

    await expect(swingTrader.connect(user).setLpProfitCut(10)).to.be.reverted;
    await expect(swingTrader.connect(stabilizerNode).setLpProfitCut(10)).to.be.reverted;

    await swingTrader.connect(admin).setLpProfitCut(200);
    expect(await swingTrader.lpProfitCut()).to.equal(200);

    // Default signer has the Timelock role
    await swingTrader.setLpProfitCut(400);
    expect(await swingTrader.lpProfitCut()).to.equal(400);
  });

  it("It only allows values up to 100% for lpProfitCut", async function() {
    await expect(swingTrader.connect(admin).setLpProfitCut(1001)).to.be.reverted;
    await expect(swingTrader.setLpProfitCut(3001)).to.be.reverted;
  });
});
