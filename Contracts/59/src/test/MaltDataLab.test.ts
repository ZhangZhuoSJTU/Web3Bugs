import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { UniswapHandler } from "../type/UniswapHandler";
import { LiquidityExtension } from "../type/LiquidityExtension";
import { MaltDataLab } from "../type/MaltDataLab";
import { MovingAverage } from "../type/MovingAverage";
import { Malt } from "../type/Malt";
import { ERC20 } from "../type/ERC20";
import { TransferService } from "../type/TransferService";
import { IUniswapV2Pair } from "../type/IUniswapV2Pair";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, setNextBlockTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";
import UniswapV2RouterBuild from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import UniswapV2FactoryBuild from "@uniswap/v2-core/build/UniswapV2Factory.json";
import WETHBuild from "@uniswap/v2-periphery/build/WETH9.json";
import DataLabArtifacts from "../artifacts/contracts/MaltDataLab.sol/MaltDataLab.json";

const UniswapV2FactoryBytecode = UniswapV2FactoryBuild.bytecode;
const UniswapV2FactoryAbi = UniswapV2FactoryBuild.abi;

const UniswapV2RouterBytecode = UniswapV2RouterBuild.bytecode;
const UniswapV2RouterAbi = UniswapV2RouterBuild.abi;
const WETHBytecode = WETHBuild.bytecode;
const WETHAbi = WETHBuild.abi;

const { deployMockContract } = waffle;

describe("MaltDataLab", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let updater: Signer;

  let maltDataLab: MaltDataLab;
  let dai: ERC20;
  let malt: ERC20;
  let snapshotId: string;

  let mockLiquidityExtension: LiquidityExtension;
  let mockReserveRatioMA: MovingAverage;
  let mockMaltPriceMA: MovingAverage;
  let mockPoolMaltReserveMA: MovingAverage;
  let mockTransferService: TransferService;
  let mockStakeToken: IUniswapV2Pair;

  const priceTarget = utils.parseEther('1');

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, updater, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const updaterAddress = await updater.getAddress();

    const ERC20Factory = await ethers.getContractFactory("Malt");

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

    mockLiquidityExtension = ((await deployMockContract(owner, [
      "function reserveRatio() returns (uint256, uint256)"
    ])) as any) as LiquidityExtension;
    mockReserveRatioMA = ((await deployMockContract(owner, [
      "function getValueWithLookback(uint256) returns (uint256)",
      "function getValue() returns (uint256)",
      "function update(uint256)",
      "function updateCumulative(uint256)"
    ])) as any) as MovingAverage;
    mockMaltPriceMA = ((await deployMockContract(owner, [
      "function getValueWithLookback(uint256) returns (uint256)",
      "function getValue() returns (uint256)",
      "function update(uint256)",
      "function updateCumulative(uint256)"
    ])) as any) as MovingAverage;
    mockPoolMaltReserveMA = ((await deployMockContract(owner, [
      "function getValueWithLookback(uint256) returns (uint256)",
      "function getValue() returns (uint256)",
      "function update(uint256)",
      "function updateCumulative(uint256)"
    ])) as any) as MovingAverage;
    mockStakeToken = ((await deployMockContract(owner, [
      "function totalSupply() returns (uint256)",
      "function getReserves() returns (uint256, uint256, uint256)",
      "function price0CumulativeLast() returns (uint256)",
      "function price1CumulativeLast() returns (uint256)",
    ])) as any) as IUniswapV2Pair;

    // Deploy the MaltDataLab
    const MaltDataLabFactory = await ethers.getContractFactory("MaltDataLab");

    maltDataLab = (await MaltDataLabFactory.deploy()) as MaltDataLab;
    await maltDataLab.initialize(
      ownerAddress,
      adminAddress,
      malt.address,
      dai.address,
      mockStakeToken.address,
      priceTarget,
      mockLiquidityExtension.address,
      mockReserveRatioMA.address,
      mockMaltPriceMA.address,
      mockPoolMaltReserveMA.address,
      updaterAddress
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await maltDataLab.stakeToken()).to.equal(mockStakeToken.address);
    expect(await maltDataLab.rewardToken()).to.equal(dai.address);
    expect(await maltDataLab.malt()).to.equal(malt.address);
    expect(await maltDataLab.liquidityExtension()).to.equal(mockLiquidityExtension.address);
    expect(await maltDataLab.reserveRatioMA()).to.equal(mockReserveRatioMA.address);
    expect(await maltDataLab.maltPriceMA()).to.equal(mockMaltPriceMA.address);
    expect(await maltDataLab.poolMaltReserveMA()).to.equal(mockPoolMaltReserveMA.address);
    expect(await maltDataLab.priceTarget()).to.equal(priceTarget);
    expect(await maltDataLab.reserveRatioLookback()).to.equal(60 * 10); // 10 minutes
    expect(await maltDataLab.maltPriceLookback()).to.equal(60 * 10); // 10 minutes
    expect(await maltDataLab.reserveLookback()).to.equal(60 * 10); // 10 minutes
  });

  it("Returns correct value from reserveRatioMA when calling smoothedReserveRatio", async function() {
    // Should revert due to lack of mocks
    await expect(maltDataLab.smoothedReserveRatio()).to.be.reverted;

    const value = utils.parseEther('35425');
    await mockReserveRatioMA.mock.getValueWithLookback.withArgs(600).returns(value);

    const reserveRatio = await maltDataLab.smoothedReserveRatio();
    expect(reserveRatio).to.equal(value);
  });

  it("Returns correct value from maltPriceMA when calling smoothedMaltPrice", async function() {
    // Should revert due to lack of mocks
    await expect(maltDataLab.smoothedMaltPrice()).to.be.reverted;

    const value = utils.parseEther('0.984');
    await mockMaltPriceMA.mock.getValueWithLookback.withArgs(600).returns(value);

    const maltPrice = await maltDataLab.smoothedMaltPrice();
    expect(maltPrice).to.equal(value);
  });

  it("Returns correct value from poolMaltReserveMA when calling smoothedMaltInPool", async function() {
    // Should revert due to lack of mocks
    await expect(maltDataLab.smoothedMaltInPool()).to.be.reverted;

    const value = utils.parseEther('824902');
    await mockPoolMaltReserveMA.mock.getValueWithLookback.withArgs(600).returns(value);

    const maltReserves = await maltDataLab.smoothedMaltInPool();
    expect(maltReserves).to.equal(value);
  });

  it("Returns correct values using average malt price and reserves when calling smoothedReserves", async function() {
    // Should revert due to lack of mocks
    await expect(maltDataLab.smoothedReserves()).to.be.reverted;

    const mockPrice = utils.parseEther('0.824902');
    await mockMaltPriceMA.mock.getValueWithLookback.withArgs(600).returns(mockPrice);

    // Should still revert because reserve mock isn't set
    await expect(maltDataLab.smoothedReserves()).to.be.reverted;

    const mockMaltReserves = utils.parseEther('28348');
    await mockPoolMaltReserveMA.mock.getValueWithLookback.withArgs(600).returns(mockMaltReserves);

    const [maltReserves, rewardReserves] = await maltDataLab.smoothedReserves();
    expect(maltReserves).to.equal(mockMaltReserves);
    expect(rewardReserves).to.equal(mockMaltReserves.mul(mockPrice).div(utils.parseEther('1')));
  });
  
  it("Returns correct value from reserveRatioMA when calling reserveRatioAverage", async function() {
    const lookback = 300;
    // Should revert due to lack of mocks
    await expect(maltDataLab.reserveRatioAverage(lookback)).to.be.reverted;

    const value = utils.parseEther('0.34');
    await mockReserveRatioMA.mock.getValueWithLookback.withArgs(lookback).returns(value);

    const reserveRatioAverage = await maltDataLab.reserveRatioAverage(lookback);
    expect(reserveRatioAverage).to.equal(value);
  });

  it("Returns correct value from maltPriceMA when calling maltPriceAverage", async function() {
    const lookback = 300;
    // Should revert due to lack of mocks
    await expect(maltDataLab.maltPriceAverage(lookback)).to.be.reverted;

    const value = utils.parseEther('0.97');
    await mockMaltPriceMA.mock.getValueWithLookback.withArgs(lookback).returns(value);

    const priceAverage = await maltDataLab.maltPriceAverage(lookback);
    expect(priceAverage).to.equal(value);
  });

  it("Returns correct value from poolMaltReserveMA when calling maltInPoolAverage", async function() {
    const lookback = 300;
    // Should revert due to lack of mocks
    await expect(maltDataLab.maltInPoolAverage(lookback)).to.be.reverted;

    const value = utils.parseEther('4568024');
    await mockPoolMaltReserveMA.mock.getValueWithLookback.withArgs(lookback).returns(value);

    const maltInPool = await maltDataLab.maltInPoolAverage(lookback);
    expect(maltInPool).to.equal(value);
  });

  it("Correctly handles calculating realValueOfLPToken", async function() {
    const amount = utils.parseEther('100');
    // No mocks
    await expect(maltDataLab.realValueOfLPToken(amount)).to.be.reverted;

    const mockPrice = utils.parseEther('0.82');
    await mockMaltPriceMA.mock.getValueWithLookback.withArgs(600).returns(mockPrice);
    const mockMaltReserves = utils.parseEther('10000');
    await mockPoolMaltReserveMA.mock.getValueWithLookback.withArgs(600).returns(mockMaltReserves);

    const totalSupply = utils.parseEther('10000');
    await mockStakeToken.mock.totalSupply.returns(totalSupply);

    expect(await maltDataLab.realValueOfLPToken(amount)).to.equal(utils.parseEther('164'));
  });

  it("Disallows non updater from calling trackPool", async function() {
    const [user] = accounts;

    await expect(maltDataLab.connect(user).trackPool()).to.be.reverted;
  });

  it("Correctly handles tracking the pool", async function() {
    const updaterAddress = await updater.getAddress();

    const now = Math.floor(new Date().getTime() / 1000) + 100;
    await setNextBlockTime(now)
    await mockStakeToken.mock.price0CumulativeLast.returns(utils.parseEther('1'));
    await mockStakeToken.mock.price1CumulativeLast.returns(utils.parseEther('1'));
    await mockStakeToken.mock.getReserves.returns(utils.parseEther('8023'), utils.parseEther('8344'), now);
    await mockMaltPriceMA.mock.update.returns();
    await mockPoolMaltReserveMA.mock.update.withArgs(utils.parseEther('8023')).returns();

    await maltDataLab.connect(updater).trackPool();
  });

  it("Returns 0 when there are no maltReserves", async function() {
    const amount = utils.parseEther('100');
    // No mocks
    await expect(maltDataLab.realValueOfLPToken(amount)).to.be.reverted;

    await mockMaltPriceMA.mock.getValueWithLookback.withArgs(600).returns(utils.parseEther('1'));
    // 0 malt Reserves
    await mockPoolMaltReserveMA.mock.getValueWithLookback.withArgs(600).returns(0);

    const lpValue = await maltDataLab.realValueOfLPToken(amount);
    expect(lpValue).to.equal(0);
  });

  it("Correctly handles tracking reserve ratio with reserveRatioMA contract", async function() {
    await expect(maltDataLab.trackReserveRatio()).to.be.reverted;

    const ratio = utils.parseEther('0.37');
    await mockLiquidityExtension.mock.reserveRatio.returns(ratio, 18);
    await expect(maltDataLab.trackReserveRatio()).to.be.reverted;
    await mockReserveRatioMA.mock.update.withArgs(ratio).returns();

    await maltDataLab.trackReserveRatio();
  });
  
  it("Only allows admin to set liquidity extension", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(maltDataLab.connect(user).setLiquidityExtension(newAddress)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setLiquidityExtension(newAddress)).to.be.reverted;

    await maltDataLab.connect(admin).setLiquidityExtension(newAddress);
    expect(await maltDataLab.liquidityExtension()).to.equal(newAddress);

    await maltDataLab.setLiquidityExtension(new2Address);
    expect(await maltDataLab.liquidityExtension()).to.equal(new2Address);
  });

  it("Only allows admin to set reserve ratio average contract", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(maltDataLab.connect(user).setReserveAverageContract(newAddress)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setReserveAverageContract(newAddress)).to.be.reverted;

    await maltDataLab.connect(admin).setReserveAverageContract(newAddress);
    expect(await maltDataLab.reserveRatioMA()).to.equal(newAddress);

    await maltDataLab.setReserveAverageContract(new2Address);
    expect(await maltDataLab.reserveRatioMA()).to.equal(new2Address);
  });

  it("Only allows admin to set malt price average contract", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(maltDataLab.connect(user).setMaltPriceAverageContract(newAddress)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setMaltPriceAverageContract(newAddress)).to.be.reverted;

    await maltDataLab.connect(admin).setMaltPriceAverageContract(newAddress);
    expect(await maltDataLab.maltPriceMA()).to.equal(newAddress);

    await maltDataLab.setMaltPriceAverageContract(new2Address);
    expect(await maltDataLab.maltPriceMA()).to.equal(new2Address);
  });

  it("Only allows admin to set reserves average contract", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(maltDataLab.connect(user).setMaltReservesAverageContract(newAddress)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setMaltReservesAverageContract(newAddress)).to.be.reverted;

    await maltDataLab.connect(admin).setMaltReservesAverageContract(newAddress);
    expect(await maltDataLab.poolMaltReserveMA()).to.equal(newAddress);

    await maltDataLab.setMaltReservesAverageContract(new2Address);
    expect(await maltDataLab.poolMaltReserveMA()).to.equal(new2Address);
  });

  it("It only allows admins to update price target", async function() {
    expect(await maltDataLab.priceTarget()).to.equal(priceTarget);

    const [user, user2] = accounts;

    let newTarget = utils.parseEther('2');
    await expect(maltDataLab.connect(user).setPriceTarget(newTarget)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setPriceTarget(newTarget)).to.be.reverted;

    await maltDataLab.connect(admin).setPriceTarget(newTarget);
    expect(await maltDataLab.priceTarget()).to.equal(newTarget);

    newTarget = utils.parseEther('3');
    // Default signer has the Timelock role
    await maltDataLab.setPriceTarget(newTarget);
    expect(await maltDataLab.priceTarget()).to.equal(newTarget);
  });

  it("It only allows admins to update reserve lookback", async function() {
    expect(await maltDataLab.reserveLookback()).to.equal(600);

    const [user, user2] = accounts;

    let newLookback = 230;
    await expect(maltDataLab.connect(user).setReserveLookback(newLookback)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setReserveLookback(newLookback)).to.be.reverted;

    await maltDataLab.connect(admin).setReserveLookback(newLookback);
    expect(await maltDataLab.reserveLookback()).to.equal(newLookback);

    newLookback = 389;
    // Default signer has the Timelock role
    await maltDataLab.setReserveLookback(newLookback);
    expect(await maltDataLab.reserveLookback()).to.equal(newLookback);
  });

  it("It only allows admins to update malt price lookback", async function() {
    expect(await maltDataLab.maltPriceLookback()).to.equal(600);

    const [user, user2] = accounts;

    let newLookback = 230;
    await expect(maltDataLab.connect(user).setMaltPriceLookback(newLookback)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setMaltPriceLookback(newLookback)).to.be.reverted;

    await maltDataLab.connect(admin).setMaltPriceLookback(newLookback);
    expect(await maltDataLab.maltPriceLookback()).to.equal(newLookback);

    newLookback = 389;
    // Default signer has the Timelock role
    await maltDataLab.setMaltPriceLookback(newLookback);
    expect(await maltDataLab.maltPriceLookback()).to.equal(newLookback);
  });

  it("It only allows admins to update reserve ratio lookback", async function() {
    expect(await maltDataLab.reserveRatioLookback()).to.equal(600);

    const [user, user2] = accounts;

    let newLookback = 230;
    await expect(maltDataLab.connect(user).setReserveRatioLookback(newLookback)).to.be.reverted;
    await expect(maltDataLab.connect(user2).setReserveRatioLookback(newLookback)).to.be.reverted;

    await maltDataLab.connect(admin).setReserveRatioLookback(newLookback);
    expect(await maltDataLab.reserveRatioLookback()).to.equal(newLookback);

    newLookback = 389;
    // Default signer has the Timelock role
    await maltDataLab.setReserveRatioLookback(newLookback);
    expect(await maltDataLab.reserveRatioLookback()).to.equal(newLookback);
  });
});
