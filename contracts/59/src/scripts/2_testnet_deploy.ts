import dotenv from 'dotenv';
import { run, ethers, network, artifacts } from "hardhat";
import { Signer, ContractFactory, constants, utils, Contract, BigNumber } from "ethers";
import { Timelock } from "../type/Timelock";
import { ERC20 } from "../type/ERC20";
import { StabilizerNode } from "../type/StabilizerNode";
import { Malt } from "../type/Malt";
import { MaltDAO } from "../type/MaltDAO";
import { Auction } from "../type/Auction";
import { AuctionBurnReserveSkew } from "../type/AuctionBurnReserveSkew";
import { AuctionEscapeHatch } from "../type/AuctionEscapeHatch";
import { AuctionPool } from "../type/AuctionPool";
import { Bonding } from "../type/Bonding";
import { ERC20VestedMine } from "../type/ERC20VestedMine";
import { TestFaucet } from "../type/TestFaucet";
import { ForfeitHandler } from "../type/ForfeitHandler";
import { ImpliedCollateralService } from "../type/ImpliedCollateralService";
import { LiquidityExtension } from "../type/LiquidityExtension";
import { MaltDataLab } from "../type/MaltDataLab";
import { MiningService } from "../type/MiningService";
import { MovingAverage } from "../type/MovingAverage";
import { PoolTransferVerification } from "../type/PoolTransferVerification";
import { RewardReinvestor } from "../type/RewardReinvestor";
import { SwingTrader } from "../type/SwingTrader";
import { TransferService } from "../type/TransferService";
import { UniswapHandler } from "../type/UniswapHandler";
import { RewardDistributor } from "../type/RewardDistributor";
import { RewardOverflowPool } from "../type/RewardOverflowPool";
import { RewardThrottle } from "../type/RewardThrottle";

import UniswapV2RouterBuild from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import UniswapV2FactoryBuild from "@uniswap/v2-core/build/UniswapV2Factory.json";
import WETHBuild from "@uniswap/v2-periphery/build/WETH9.json";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";

const faucetArtifacts = artifacts.readArtifactSync("TestFaucet");
const faucetTwoArtifacts = artifacts.readArtifactSync("TestFaucetTwo");
const faucetAbi = faucetArtifacts.abi;
const faucetTwoAbi = faucetTwoArtifacts.abi;

import { promises, existsSync } from 'fs'

const result = dotenv.config()

if (result.error) {
  throw result.error;
}

const UniswapV2FactoryBytecode = UniswapV2FactoryBuild.bytecode;
const UniswapV2FactoryAbi = UniswapV2FactoryBuild.abi;

const UniswapV2RouterBytecode = UniswapV2RouterBuild.bytecode;
const UniswapV2RouterAbi = UniswapV2RouterBuild.abi;
const WETHBytecode = WETHBuild.bytecode;
const WETHAbi = WETHBuild.abi;

async function deploy() {
  await run("typechain");

  const [signer, treasury] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log(signerAddress);

  let treasuryAddress;

  if (process.env.MALT_TESTNET_TREASURY_ADDRESS) {
    treasuryAddress = process.env.MALT_TESTNET_TREASURY_ADDRESS;
  } else if (treasury) {
    treasuryAddress = await treasury.getAddress();
  } else {
    throw new Error("No treasury address given");
  }

  const now = Math.floor(new Date().getTime() / 1000);

  // Initial variables
  const epochLength = 60 * 30; // 30 minutes
  // const genesisTime = now - (now % epochLength);
  const genesisTime = now;
  const priceTarget = utils.parseEther('1');

  // Fetch contract factories
  const AuctionFactory = await ethers.getContractFactory("Auction");
  const BurnReserveSkewFactory = await ethers.getContractFactory("AuctionBurnReserveSkew");
  const AuctionEscapeHatchFactory = await ethers.getContractFactory("AuctionEscapeHatch");
  const AuctionPoolFactory = await ethers.getContractFactory("AuctionPool");
  const BondingFactory = await ethers.getContractFactory("Bonding");
  const DAOFactory = await ethers.getContractFactory("MaltDAO");
  const ERC20VestedMineFactory = await ethers.getContractFactory("ERC20VestedMine");
  const ForfeitHandlerFactory = await ethers.getContractFactory("ForfeitHandler");
  const ImpliedCollateralServiceFactory = await ethers.getContractFactory("ImpliedCollateralService");
  const LiquidityExtensionFactory = await ethers.getContractFactory("LiquidityExtension");
  const MaltFactory = await ethers.getContractFactory("Malt");
  const MaltDataLabFactory = await ethers.getContractFactory("MaltDataLab");
  const MiningServiceFactory = await ethers.getContractFactory("MiningService");
  const MovingAverageFactory = await ethers.getContractFactory("MovingAverage");
  const PoolTransferVerificationFactory = await ethers.getContractFactory("PoolTransferVerification");
  const RewardReinvestorFactory = await ethers.getContractFactory("RewardReinvestor");
  const StabilizerNodeFactory = await ethers.getContractFactory("StabilizerNode");
  const SwingTraderFactory = await ethers.getContractFactory("SwingTrader");
  const TimelockFactory = await ethers.getContractFactory("Timelock");
  const TransferServiceFactory = await ethers.getContractFactory("TransferService");
  const UniswapHandlerFactory = await ethers.getContractFactory("UniswapHandler");
  const RewardDistributorFactory = await ethers.getContractFactory("RewardDistributor");
  const RewardOverflowPoolFactory = await ethers.getContractFactory("RewardOverflowPool");
  const RewardThrottleFactory = await ethers.getContractFactory("RewardThrottle");

  const dai = new Contract("0xaFf77C74E2a3861225173C2325314842338b73e6", IERC20.abi, signer);
  const faucet = new Contract("0xd70730F34E16449Cfc51f8E7E9B0C5aB9b4D2e5C", faucetAbi, signer);
  // Faucet 2 allows asking for how much you want
  const faucetTwo = new Contract("0xf4aDC436532eeD1c2fDDe86300D76C44a953DC19", faucetTwoAbi, signer);
  const routerContract = new ContractFactory(UniswapV2RouterAbi, UniswapV2RouterBytecode, signer);
  const wethContract = new ContractFactory(WETHAbi, WETHBytecode, signer);
  const factoryContract = new ContractFactory(UniswapV2FactoryAbi, UniswapV2FactoryBytecode, signer);

  try {
    // Local Uniswap deploy
    const factory = await factoryContract.deploy(constants.AddressZero);
    const weth = await wethContract.deploy();
    const router = await routerContract.deploy(factory.address, weth.address);

    // Deploy the contracts
    const auction = (await AuctionFactory.deploy()) as Auction;
    const burnReserveSkew = (await BurnReserveSkewFactory.deploy()) as AuctionBurnReserveSkew;
    const escapeHatch = (await AuctionEscapeHatchFactory.deploy()) as AuctionEscapeHatch;
    const auctionPool = (await AuctionPoolFactory.deploy()) as AuctionPool;
    const bonding = (await BondingFactory.deploy()) as Bonding;
    const dao = (await DAOFactory.deploy()) as MaltDAO;
    const erc20Mine = (await ERC20VestedMineFactory.deploy()) as ERC20VestedMine;
    const forfeitHandler = (await ForfeitHandlerFactory.deploy()) as ForfeitHandler;
    const impliedCollateralService = (await ImpliedCollateralServiceFactory.deploy()) as ImpliedCollateralService;
    const liquidityExtension = (await LiquidityExtensionFactory.deploy()) as LiquidityExtension;
    const malt = (await MaltFactory.deploy("Malt Stablecoin", "MALT")) as Malt;
    const maltDataLab = (await MaltDataLabFactory.deploy()) as MaltDataLab;
    const miningService = (await MiningServiceFactory.deploy()) as MiningService;
    const reserveRatioMA = (await MovingAverageFactory.deploy()) as MovingAverage;
    const maltPriceMA = (await MovingAverageFactory.deploy()) as MovingAverage;
    const poolMaltReserveMA = (await MovingAverageFactory.deploy()) as MovingAverage;
    const transferVerification = (await PoolTransferVerificationFactory.deploy()) as PoolTransferVerification;
    const rewardReinvestor = (await RewardReinvestorFactory.deploy()) as RewardReinvestor;
    const stabilizerNode = (await StabilizerNodeFactory.deploy()) as StabilizerNode;
    const swingTrader = (await SwingTraderFactory.deploy()) as SwingTrader;
    const timelock = (await TimelockFactory.deploy()) as Timelock;
    const transferService = (await TransferServiceFactory.deploy()) as TransferService;
    const daiTransferService = (await TransferServiceFactory.deploy()) as TransferService;
    const uniswapHandler = (await UniswapHandlerFactory.deploy()) as UniswapHandler;
    const rewardDistributor = (await RewardDistributorFactory.deploy()) as RewardDistributor;
    const rewardOverflow = (await RewardOverflowPoolFactory.deploy()) as RewardOverflowPool;
    const rewardThrottle = (await RewardThrottleFactory.deploy()) as RewardThrottle;

    let gasUsed = auction.deployTransaction.gasLimit;
    gasUsed = gasUsed.add(burnReserveSkew.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(escapeHatch.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(auctionPool.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(bonding.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(dao.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(erc20Mine.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(forfeitHandler.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(impliedCollateralService.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(liquidityExtension.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(malt.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(maltDataLab.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(miningService.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(reserveRatioMA.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(maltPriceMA.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(poolMaltReserveMA.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(transferVerification.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(rewardReinvestor.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(stabilizerNode.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(swingTrader.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(timelock.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(transferService.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(uniswapHandler.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(rewardDistributor.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(rewardOverflow.deployTransaction.gasLimit)
    gasUsed = gasUsed.add(rewardThrottle.deployTransaction.gasLimit)

    await auction.deployTransaction.wait();
    await burnReserveSkew.deployTransaction.wait();
    await escapeHatch.deployTransaction.wait();
    await auctionPool.deployTransaction.wait();
    await bonding.deployTransaction.wait();
    await dao.deployTransaction.wait();
    await erc20Mine.deployTransaction.wait();
    await forfeitHandler.deployTransaction.wait();
    await impliedCollateralService.deployTransaction.wait();
    await liquidityExtension.deployTransaction.wait();
    await malt.deployTransaction.wait();
    await maltDataLab.deployTransaction.wait();
    await miningService.deployTransaction.wait();
    await reserveRatioMA.deployTransaction.wait();
    await maltPriceMA.deployTransaction.wait();
    await poolMaltReserveMA.deployTransaction.wait();
    await transferVerification.deployTransaction.wait();
    await rewardReinvestor.deployTransaction.wait();
    await stabilizerNode.deployTransaction.wait();
    await swingTrader.deployTransaction.wait();
    await timelock.deployTransaction.wait();
    await transferService.deployTransaction.wait();
    await uniswapHandler.deployTransaction.wait();
    await rewardDistributor.deployTransaction.wait();
    await rewardOverflow.deployTransaction.wait();
    await rewardThrottle.deployTransaction.wait();

    const createPair = await factory.createPair(malt.address, dai.address);
    await createPair.wait();

    const lpTokenAddress = await factory.getPair(malt.address, dai.address);
    const offeringAddress = "0x0000000000000000000000000000000000000000";

    console.log(`Total gas usage for deploy: ${gasUsed}`);

    // Use 100Gwei as a benchmar
    const deployGasCost = gasUsed.mul(utils.parseEther('0.000000050'));
    console.log(`Gas cost @ 50Gwei: ${utils.formatEther(deployGasCost)}`);

    let auctionInit = await auction.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      malt.address,
      60 * 10, // 10 mins auction length
      stabilizerNode.address,
      maltDataLab.address,
      uniswapHandler.address,
      liquidityExtension.address,
      impliedCollateralService.address,
      burnReserveSkew.address,
      escapeHatch.address
    );

    let burnReserveSkewInit = await burnReserveSkew.initialize(
      timelock.address,
      signerAddress,
      stabilizerNode.address,
      auction.address,
      10,
    );

    let escapeHatchInit = await escapeHatch.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      malt.address,
      auction.address,
      uniswapHandler.address,
    );

    let auctionPoolInit = await auctionPool.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      auction.address,
      impliedCollateralService.address,
      bonding.address,
      miningService.address,
      swingTrader.address
    );

    let bondingInit = await bonding.initialize(
      timelock.address,
      signerAddress,
      malt.address,
      dai.address,
      lpTokenAddress,
      dao.address,
      miningService.address,
      offeringAddress,
      uniswapHandler.address,
      maltDataLab.address
    );

    let daoInit = await dao.initialize(
      timelock.address,
      signerAddress,
      malt.address,
      epochLength,
      genesisTime,
      offeringAddress,
      utils.parseEther('0'),
    );

    let erc20MineInit = await erc20Mine.initialize(
      timelock.address,
      signerAddress,
      miningService.address,
      rewardDistributor.address,
      bonding.address,
      dai.address
    );

    let forfeitHandlerInit = await forfeitHandler.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      treasuryAddress,
      swingTrader.address
    );

    let impliedCollateralServiceInit = await impliedCollateralService.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      malt.address,
      auction.address,
      auctionPool.address,
      rewardOverflow.address,
      swingTrader.address,
      liquidityExtension.address,
      maltDataLab.address
    );

    let liquidityExtensionInit = await liquidityExtension.initialize(
      timelock.address,
      signerAddress,
      auction.address,
      dai.address,
      malt.address,
      uniswapHandler.address,
      maltDataLab.address,
      factory.address
    );

    let maltInit = await malt.initialize(
      timelock.address,
      signerAddress,
      transferService.address,
      [dao.address, escapeHatch.address, stabilizerNode.address, signerAddress],
      [liquidityExtension.address],
    );

    let maltDataLabInit = await maltDataLab.initialize(
      timelock.address,
      signerAddress,
      malt.address,
      dai.address,
      lpTokenAddress,
      priceTarget,
      liquidityExtension.address,
      reserveRatioMA.address,
      maltPriceMA.address,
      poolMaltReserveMA.address,
      signerAddress,
    );

    let miningServiceInit = await miningService.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      rewardReinvestor.address,
      bonding.address,
    );

    let reserveRatioMAInit = await reserveRatioMA.initialize(
      timelock.address,
      signerAddress,
      120, // 2 minutes
      30, // 1 hour worth
      maltDataLab.address,
      0
    );

    let maltPriceMAInit = await maltPriceMA.initialize(
      timelock.address,
      signerAddress,
      30, // 30 secs
      60, // 30 mins worth
      maltDataLab.address,
      utils.parseEther('2')
    );

    let poolMaltReserveMAInit = await poolMaltReserveMA.initialize(
      timelock.address,
      signerAddress,
      30, // 30 secs
      60, // 30 mins worth
      maltDataLab.address,
      0
    );

    let transferVerificationInit = await transferVerification.initialize(
      timelock.address,
      signerAddress,
      1000, // 10%
      maltDataLab.address,
      60 * 5, // 5 minutes
      lpTokenAddress,
    );

    let rewardReinvestorInit = await rewardReinvestor.initialize(
      timelock.address,
      signerAddress,
      malt.address,
      dai.address,
      uniswapHandler.address,
      bonding.address,
      miningService.address,
      factory.address,
      treasuryAddress
    );

    let stabilizerNodeInit = await stabilizerNode.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      malt.address,
      auction.address,
      factory.address,
      treasuryAddress,
      auctionPool.address
    );

    await stabilizerNodeInit.wait();

    let stabilizerNodeContractSetup = await stabilizerNode.setupContracts(
      uniswapHandler.address,
      maltDataLab.address,
      burnReserveSkew.address,
      rewardThrottle.address,
      dao.address,
      swingTrader.address,
      liquidityExtension.address,
      impliedCollateralService.address
    );

    let swingTraderInit = await swingTrader.initialize(
      timelock.address,
      signerAddress,
      dai.address,
      malt.address,
      uniswapHandler.address,
      stabilizerNode.address,
      rewardThrottle.address
    );

    let timelockInit = await timelock.initialize(
      dao.address,
      signerAddress
    );

    let transferServiceInit = await transferService.initialize(
      timelock.address,
      signerAddress,
    );
    await transferServiceInit.wait();
    const addVerifierTx = await transferService.addVerifier(lpTokenAddress, transferVerification.address);

    let daiTransferServiceInit = await daiTransferService.initialize(
      timelock.address,
      signerAddress,
    );

    let uniswapHandlerInit = await uniswapHandler.initialize(
      timelock.address,
      signerAddress,
      malt.address,
      dai.address,
      lpTokenAddress,
      router.address,
      factory.address
    );

    let rewardDistributorInit = await rewardDistributor.initialize(
      timelock.address,
      signerAddress,
      erc20Mine.address,
      bonding.address,
      rewardThrottle.address,
      forfeitHandler.address,
      dai.address,
    );

    let rewardOverflowInit = await rewardOverflow.initialize(
      timelock.address,
      signerAddress,
      rewardThrottle.address,
      dai.address,
      auction.address,
      impliedCollateralService.address
    );

    let rewardThrottleInit = await rewardThrottle.initialize(
      timelock.address,
      signerAddress,
      dao.address,
      rewardOverflow.address,
      bonding.address,
      rewardDistributor.address,
      dai.address,
    );

    await auctionInit.wait();
    await burnReserveSkewInit.wait();
    await escapeHatchInit.wait();
    await auctionPoolInit.wait();
    await bondingInit.wait();
    await daoInit.wait();
    await daoInit.wait();
    await forfeitHandlerInit.wait();
    await impliedCollateralServiceInit.wait();
    await liquidityExtensionInit.wait();
    await maltInit.wait();
    await miningServiceInit.wait();
    await reserveRatioMAInit.wait();
    await maltPriceMAInit.wait();
    await poolMaltReserveMAInit.wait();
    await transferVerificationInit.wait();
    await rewardReinvestorInit.wait();
    await stabilizerNodeInit.wait();
    await swingTraderInit.wait();
    await timelockInit.wait();
    await transferServiceInit.wait();
    await addVerifierTx.wait();
    await daiTransferServiceInit.wait();
    await uniswapHandlerInit.wait();
    await rewardDistributorInit.wait();
    await rewardOverflowInit.wait();
    await rewardThrottleInit.wait();
    await stabilizerNodeContractSetup.wait();

    const dexTransferWhitelistTx = await transferVerification.addToWhitelist(uniswapHandler.address);
    const rewardInvestorBuyerTx = await uniswapHandler.addNewBuyer(rewardReinvestor.address);
    const vestedMineAddTx = await miningService.addRewardMine(erc20Mine.address);
    await rewardInvestorBuyerTx.wait();
    await dexTransferWhitelistTx.wait();
    await vestedMineAddTx.wait();

    const auctionPoolAddTx = await miningService.addRewardMine(auctionPool.address);
    const liquidityExtensionBuyerTx = await uniswapHandler.addNewBuyer(liquidityExtension.address);
    await liquidityExtensionBuyerTx.wait();
    const swingTraderBuyerTx = await uniswapHandler.addNewBuyer(swingTrader.address);
    await swingTraderBuyerTx.wait();
    await auctionPoolAddTx.wait();

    gasUsed = gasUsed.add(auctionInit.gasLimit)
    gasUsed = gasUsed.add(burnReserveSkewInit.gasLimit)
    gasUsed = gasUsed.add(escapeHatchInit.gasLimit)
    gasUsed = gasUsed.add(auctionPoolInit.gasLimit)
    gasUsed = gasUsed.add(bondingInit.gasLimit)
    gasUsed = gasUsed.add(daoInit.gasLimit)
    gasUsed = gasUsed.add(erc20MineInit.gasLimit)
    gasUsed = gasUsed.add(forfeitHandlerInit.gasLimit)
    gasUsed = gasUsed.add(impliedCollateralServiceInit.gasLimit)
    gasUsed = gasUsed.add(liquidityExtensionInit.gasLimit)
    gasUsed = gasUsed.add(maltInit.gasLimit)
    gasUsed = gasUsed.add(maltDataLabInit.gasLimit)
    gasUsed = gasUsed.add(miningServiceInit.gasLimit)
    gasUsed = gasUsed.add(reserveRatioMAInit.gasLimit)
    gasUsed = gasUsed.add(maltPriceMAInit.gasLimit)
    gasUsed = gasUsed.add(poolMaltReserveMAInit.gasLimit)
    gasUsed = gasUsed.add(transferVerificationInit.gasLimit)
    gasUsed = gasUsed.add(rewardReinvestorInit.gasLimit)
    gasUsed = gasUsed.add(stabilizerNodeInit.gasLimit)
    gasUsed = gasUsed.add(swingTraderInit.gasLimit)
    gasUsed = gasUsed.add(timelockInit.gasLimit)
    gasUsed = gasUsed.add(transferServiceInit.gasLimit)
    gasUsed = gasUsed.add(uniswapHandlerInit.gasLimit)
    gasUsed = gasUsed.add(rewardDistributorInit.gasLimit)
    gasUsed = gasUsed.add(rewardOverflowInit.gasLimit)
    gasUsed = gasUsed.add(rewardThrottleInit.gasLimit)
    gasUsed = gasUsed.add(addVerifierTx.gasLimit)
    gasUsed = gasUsed.add(rewardInvestorBuyerTx.gasLimit)
    gasUsed = gasUsed.add(liquidityExtensionBuyerTx.gasLimit)
    gasUsed = gasUsed.add(swingTraderBuyerTx.gasLimit)
    gasUsed = gasUsed.add(dexTransferWhitelistTx.gasLimit)

    console.log(`Total gas usage: ${gasUsed}`);

    // Use 100Gwei as a benchmar
    const gasCost = gasUsed.mul(utils.parseEther('0.000000100'));
    console.log(`Gas cost @ 100Gwei: ${utils.formatEther(gasCost)}`);

    const contractAddresses = {
      auction: {
        address: auction.address,
        artifacts: artifacts.readArtifactSync("Auction"),
      },
      burnReserveSkew: {
        address: burnReserveSkew.address,
        artifacts: artifacts.readArtifactSync("AuctionBurnReserveSkew"),
      },
      escapeHatch: {
        address: escapeHatch.address,
        artifacts: artifacts.readArtifactSync("AuctionEscapeHatch"),
      },
      auctionPool: {
        address: auctionPool.address,
        artifacts: artifacts.readArtifactSync("AuctionPool"),
      },
      bonding: {
        address: bonding.address,
        artifacts: artifacts.readArtifactSync("Bonding"),
      },
      dao: {
        address: dao.address,
        artifacts: artifacts.readArtifactSync("MaltDAO"),
      },
      daiVestedMine: {
        address: erc20Mine.address,
        artifacts: artifacts.readArtifactSync("ERC20VestedMine"),
      },
      faucet: {
        address: faucet.address,
        artifacts: artifacts.readArtifactSync("TestFaucet"),
      },
      faucetTwo: {
        address: faucetTwo.address,
        artifacts: artifacts.readArtifactSync("TestFaucetTwo"),
      },
      forfeitHandler: {
        address: forfeitHandler.address,
        artifacts: artifacts.readArtifactSync("ForfeitHandler"),
      },
      impliedCollateralService: {
        address: impliedCollateralService.address,
        artifacts: artifacts.readArtifactSync("ImpliedCollateralService"),
      },
      liquidityExtension: {
        address: liquidityExtension.address,
        artifacts: artifacts.readArtifactSync("LiquidityExtension"),
      },
      malt: {
        address: malt.address,
        artifacts: artifacts.readArtifactSync("Malt"),
      },
      rewardToken: {
        address: dai.address,
        artifacts: artifacts.readArtifactSync("Malt"),
      },
      maltDataLab: {
        address: maltDataLab.address,
        artifacts: artifacts.readArtifactSync("MaltDataLab"),
      },
      miningService: {
        address: miningService.address,
        artifacts: artifacts.readArtifactSync("MiningService"),
      },
      reserveRatioMA: {
        address: reserveRatioMA.address,
        artifacts: artifacts.readArtifactSync("MovingAverage"),
      },
      maltPriceMA: {
        address: maltPriceMA.address,
        artifacts: artifacts.readArtifactSync("MovingAverage"),
      },
      poolMaltReserveMA: {
        address: poolMaltReserveMA.address,
        artifacts: artifacts.readArtifactSync("MovingAverage"),
      },
      transferVerification: {
        address: transferVerification.address,
        artifacts: artifacts.readArtifactSync("PoolTransferVerification"),
      },
      rewardReinvestor: {
        address: rewardReinvestor.address,
        artifacts: artifacts.readArtifactSync("RewardReinvestor"),
      },
      stabilizerNode: {
        address: stabilizerNode.address,
        artifacts: artifacts.readArtifactSync("StabilizerNode"),
      },
      swingTrader: {
        address: swingTrader.address,
        artifacts: artifacts.readArtifactSync("SwingTrader"),
      },
      timelock: {
        address: timelock.address,
        artifacts: artifacts.readArtifactSync("Timelock"),
      },
      transferService: {
        address: transferService.address,
        artifacts: artifacts.readArtifactSync("TransferService"),
      },
      uniswapHandler: {
        address: uniswapHandler.address,
        artifacts: artifacts.readArtifactSync("UniswapHandler"),
      },
      rewardDistributor: {
        address: rewardDistributor.address,
        artifacts: artifacts.readArtifactSync("RewardDistributor"),
      },
      rewardOverflow: {
        address: rewardOverflow.address,
        artifacts: artifacts.readArtifactSync("RewardOverflowPool"),
      },
      rewardThrottle: {
        address: rewardThrottle.address,
        artifacts: artifacts.readArtifactSync("RewardThrottle"),
      },
      maltPair: {
        address: lpTokenAddress,
        artifacts: artifacts.readArtifactSync("@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol:IUniswapV2Pair"),
      },
      router: {
        address: router.address,
        artifacts: artifacts.readArtifactSync("@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol:IUniswapV2Router02"),
      },
      factory: {
        address: factory.address,
        artifacts: artifacts.readArtifactSync("@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol:IUniswapV2Factory"),
      },
    }

    if (existsSync('./deployments')) {
      await promises.writeFile(
        `./deployments/contracts.${network.name}.json`,
        JSON.stringify(contractAddresses, undefined, 2)
      );
    }
    if (existsSync('../ui')) {
      await promises.writeFile(
        `../ui/src/contracts/contracts.${network.name}.json`,
        JSON.stringify(contractAddresses, undefined, 2)
      );
    }
    if (existsSync('../launch')) {
      await promises.writeFile(
        `../launch/contracts.${network.name}.json`,
        JSON.stringify(contractAddresses, undefined, 2)
      );
    }
  } catch (error) {
    console.error(error);
  }
}

                                                                    
deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

