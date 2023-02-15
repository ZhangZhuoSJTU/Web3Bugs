const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const TroveManagerRedemptions = artifacts.require("./TroveManagerRedemptions.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
// const PriceFeedTestnetAVAX = artifacts.require("./PriceFeedTestnet.sol")
// const PriceFeedTestnetETH = artifacts.require("./PriceFeedTestnet.sol")

const YUSDToken = artifacts.require("./YUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const Whitelist = artifacts.require("./Whitelist.sol")

const TeamAllocation = artifacts.require("./TeamAllocation.sol")

// const ERC20TokenETH = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")
// const ERC20TokenAVAX = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")
// const ERC20TokenBTC = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")

const ERC20Token = artifacts.require("./TestContracts/TestAssets/ERC20Token.sol")
// const WJLP = artifacts.require("./WJLP.sol")

const LinearPriceCurve = artifacts.require("./PriceCurves/ThreePieceWiseLinearPriceCurve.sol");
const ERC20Router = artifacts.require("./Routers/ERC20Router.sol")

const SYETI = artifacts.require("./sYETIToken.sol")
const SYETITester = artifacts.require("./sYETITokenTester.sol")
const YETIToken = artifacts.require("./YETIToken.sol"); // @KingYeti: changed to Yeti token
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")
const YetiFinanceTreasury = artifacts.require("./YetiFinanceTreasury.sol")

const Unipool =  artifacts.require("./Unipool.sol")

const WJLP = artifacts.require("./AssetWrappers/WJLP.sol");
const WBQI = artifacts.require("./AssetWrappers/WBQI.sol");
const WAAVE = artifacts.require("./AssetWrappers/WAAVE.sol");

const YETITokenTester = artifacts.require("./YETITokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const LiquityMathTester = artifacts.require("./LiquityMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const SYETIScript = artifacts.require('SYETIScript')

// const { artifacts } = require('hardhat')
const { contractSizer } = require('../hardhat.config.js')
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  SYETIProxy
} = require('../utils/proxyHelpers.js')

/* "Liquity core" consists of all contracts in the core Liquity system.

YETI contracts consist of only those contracts related to the YETI Token:

-the YETI token
-the Lockup factory and lockup contracts
-the sYETI contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployAssetWrappers() {
    const wJLP_WETH_WAVAX = await WJLP.new(
          "wJLP_WETH_WAVAX",
          "Wrapped JLP WETH WAVAX",
          18,
          "0xfe15c2695f1f920da45c30aae47d11de51007af9", // WETH-WAVAX JLP Address
          "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd", // JOE
          // "0x2C7B8e971c704371772eDaf16e0dB381A8D02027", // Zap
          "0xd6a4F121CA35509aF06A0Be99093d08462f53052", // MasterChef
          26 // pid
        )
    const wBQI_WAVAX = await WBQI.new(
          "wBQI_AVAX",
          "Wrapped qiAVAX",
          18,
          "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c", //qiAVAX
          "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5", //QI
          '0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4'//Comptroller
        )
    const wAAVE_WAVAX = await WAAVE.new(
          "wAAVE_aWAVAX",
          "Wrapped aWAVAX",
          18,
          "0xDFE521292EcE2A4f44242efBcD66Bc594CA9714B",
        )
    const WRAPPERS={
      wJLP_WETH_WAVAX,
      wBQI_WAVAX,
      wAAVE_WAVAX
    }
    return WRAPPERS
  }

  // static async deployAssetWrappersHardhat() {
  //   const wJLP_WETH_WAVAX = await WJLP.new(
  //     "wJLP_WETH_WAVAX",
  //     "Wrapped JLP WETH WAVAX",
  //     18,
  //     "0xfe15c2695f1f920da45c30aae47d11de51007af9", // WETH-WAVAX JLP Address
  //     "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd", // JOE
  //     // "0x2C7B8e971c704371772eDaf16e0dB381A8D02027", // Zap
  //     "0xd6a4F121CA35509aF06A0Be99093d08462f53052", // MasterChef
  //     26 // pid
  //   )
  //   return wJLP_WETH_WAVAX
    
  // }

  static async deployLiquityCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]

    if (frameworkPath.includes("hardhat")) {
      return this.deployLiquityCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployLiquityCoreTruffle()
    }
  }

  static async deployYETIContracts(bountyAddress, lpRewardsAddress, multisigAddress) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployYETIContractsHardhat(
        bountyAddress,
        lpRewardsAddress,
        multisigAddress
      )
    } else if (frameworkPath.includes("truffle")) {
      return this.deployYETIContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress)
    }
  }

  static async deployYETIRightNow(sYETIAddress) {
    const yetiFinanceTreasury = await YetiFinanceTreasury.new()
    const teamAllocation = await TeamAllocation.new();
    const yetiToken = await YETIToken.new(
      sYETIAddress,
      yetiFinanceTreasury.address,
      teamAllocation.address
    );

    return {
      yetiFinanceTreasury,
      teamAllocation,
      yetiToken
    }
  }

  static async deployLiquityCoreHardhat() {
    //const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const troveManagerLiquidations = await TroveManagerLiquidations.new()
    const troveManagerRedemptions = await TroveManagerRedemptions.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const yusdToken = await YUSDToken.new(
      troveManager.address,
      troveManagerLiquidations.address,
      troveManagerRedemptions.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const whitelist = await Whitelist.new()
    // const wJLP = await WJLP.new();

    
    const weth = await ERC20Token.new("WETH", "Wrapped Ether", 18)
    // ERC20TokenETH.setAsDeployed(weth);

    const wavax = await ERC20Token.new("WAVAX", "Wrapped AVAX", 18)
    // ERC20TokenAVAX.setAsDeployed(wavax);

    const wbtc = await ERC20Token.new("WBTC", "Wrapped Bitcoin", 18);
    // ERC20TokenBTC.setAsDeployed(wbtc);

    const dec8 = await ERC20Token.new("DEC8", "Token With 8DEC", 8);

    const JLP = await ERC20Token.new("JLP", "JLP", 18)

    const wJLP = await WJLP.new(
      "wJLP_WETH_WAVAX",
      "Wrapped JLP WETH WAVAX",
      18,
      "0xFE15c2695F1F920da45C30AAE47d11dE51007AF9", // WETH-WAVAX JLP Address
      "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd", // JOE
      "0xd6a4F121CA35509aF06A0Be99093d08462f53052", // MasterChef
      26 // pid
    )

    const priceFeedDEC8 = await PriceFeedTestnet.new();

    const priceFeedAVAX = await PriceFeedTestnet.new();
    // PriceFeedTestnetAVAX.setAsDeployed(priceFeedAVAX);

    const priceFeedETH = await PriceFeedTestnet.new();

    const priceFeedJLP = await PriceFeedTestnet.new();

    // PriceFeedTestnetETH.setAsDeployed(priceFeedETH);

    const PriceCurveDEC8 = await LinearPriceCurve.new();

    const PriceCurveAVAX = await LinearPriceCurve.new();
    // PriceCurveLiquidAVAX.setAsDeployed(PriceCurveAVAX);

    const PriceCurveETH = await LinearPriceCurve.new();

    const PriceCurveJLP = await LinearPriceCurve.new();

    // PriceCurveLiquidETH.setAsDeployed(PriceCurveETH);
    WJLP.setAsDeployed(wJLP)
    Whitelist.setAsDeployed(whitelist)
    YUSDToken.setAsDeployed(yusdToken)
    DefaultPool.setAsDeployed(defaultPool)
    // PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedTroves.setAsDeployed(sortedTroves)
    TroveManager.setAsDeployed(troveManager)
    TroveManagerLiquidations.setAsDeployed(troveManagerLiquidations)
    TroveManagerRedemptions.setAsDeployed(troveManagerRedemptions)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)

    const coreContracts = {
      priceFeedAVAX,
      priceFeedETH,
      priceFeedDEC8,
      priceFeedJLP,
      yusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers, 
      whitelist, 
      weth,
      wavax,
      wbtc,
      dec8,
      JLP,
      PriceCurveAVAX,
      PriceCurveETH,
      PriceCurveDEC8,
      PriceCurveJLP,
      troveManagerLiquidations, 
      troveManagerRedemptions, 
      wJLP
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    testerContracts.whitelist = await Whitelist.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await LiquityMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.troveManagerLiquidations = await TroveManagerLiquidations.new()
    testerContracts.troveManagerRedemptions = await TroveManagerRedemptions.new()
    testerContracts.yusdToken =  await YUSDTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.troveManagerLiquidations.address,
      testerContracts.troveManagerRedemptions.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    testerContracts.whitelist = await Whitelist.new()

    testerContracts.weth = await ERC20Token.new("WETH", "Wrapped Ether", 18)

    testerContracts.wavax = await ERC20Token.new("WAVAX", "Wrapped AVAX", 18)

    testerContracts.wbtc = await ERC20Token.new("WBTC", "Wrapped Bitcoin", 18);
    // ERC20TokenBTC.setAsDeployed(wbtc);

    testerContracts.priceFeedAVAX = await PriceFeedTestnet.new();
    // PriceFeedTestnetAVAX.setAsDeployed(priceFeedAVAX);

    testerContracts.priceFeedETH = await PriceFeedTestnet.new();
    // PriceFeedTestnetETH.setAsDeployed(priceFeedETH);

    testerContracts.PriceCurveAVAX = await LinearPriceCurve.new();
    // PriceCurveLiquidAVAX.setAsDeployed(PriceCurveAVAX);

    testerContracts.PriceCurveETH = await LinearPriceCurve.new();

    testerContracts.priceCurveJLP = await LinearPriceCurve.new();

    return testerContracts
  }

  static async deployYETIContractsHardhat() {
    const sYETI = await SYETI.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()
    const yetiFinanceTreasury =  await YetiFinanceTreasury.new();
    
    SYETI.setAsDeployed(sYETI)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)
    YetiFinanceTreasury.setAsDeployed(yetiFinanceTreasury)

    // Deploy YETI Token, passing Community Issuance and Factory addresses to the constructor
    const yetiToken = await YETIToken.new(
      sYETI.address,
      communityIssuance.address,
      communityIssuance.address
    )

    YETIToken.setAsDeployed(yetiToken)

    const YETIContracts = {
      sYETI,
      lockupContractFactory,
      communityIssuance,
      yetiToken,
      yetiFinanceTreasury
    }
    return YETIContracts
  }

  static async deployYETITesterContractsHardhat() {
    const sYETI = await SYETITester.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()
    const yetiFinanceTreasury =  await YetiFinanceTreasury.new();

    SYETITester.setAsDeployed(sYETI)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)
    YetiFinanceTreasury.setAsDeployed(yetiFinanceTreasury)

    // Deploy YETI Token, passing Community Issuance and Factory addresses to the constructor
    const yetiToken = await YETITokenTester.new(
      sYETI.address,
      yetiFinanceTreasury.address,
      communityIssuance.address
    )
    YETITokenTester.setAsDeployed(yetiToken)

    const YETIContracts = {
      sYETI,
      lockupContractFactory,
      communityIssuance,
      yetiToken,
      yetiFinanceTreasury
    }
    return YETIContracts
  }

  static async deployLiquityCoreTruffle() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const yusdToken = await YUSDToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const coreContracts = {
      priceFeedTestnet,
      yusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployYETIContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress, yetiTokenAddress, yusdTokenAddress) {
    const sYETI = await sYETI.new(yetiTokenAddress, yusdTokenAddress)
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    /* Deploy YETI Token, passing Community Issuance,  sYETI, and Factory addresses
    to the constructor  */
    const yetiToken = await YETIToken.new(
      sYETI.address,
      communityIssuance.address,
      communityIssuance.address
    )

    const YETIContracts = {
      sYETI,
      lockupContractFactory,
      communityIssuance,
      yetiToken
    }
    return YETIContracts
  }

  static async deployYUSDToken(contracts) {
    contracts.yusdToken = await YUSDToken.new(
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployYUSDTokenTester(contracts) {
    contracts.yusdToken = await YUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, YETIContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      YETIContracts.sYETI.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const yusdTokenScript = await TokenScript.new(contracts.yusdToken.address)
    contracts.yusdToken = new TokenProxy(owner, proxies, yusdTokenScript.address, contracts.yusdToken)

    const yetiTokenScript = await TokenScript.new(YETIContracts.yetiToken.address)
    YETIContracts.yetiToken = new TokenProxy(owner, proxies, yetiTokenScript.address, YETIContracts.yetiToken)

    const sYETIScript = await SYETIScript.new(YETIContracts.sYETI.address)
    YETIContracts.sYETI = new SYETIProxy(owner, proxies, sYETIScript.address, YETIContracts.sYETI)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, YETIContracts) {
    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address, 
      contracts.troveManagerRedemptions.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.yusdToken.address,
      contracts.sortedTroves.address,
      YETIContracts.yetiToken.address,
      YETIContracts.sYETI.address,
      contracts.whitelist.address,
      contracts.troveManagerRedemptions.address,
      contracts.troveManagerLiquidations.address,
    )

    await contracts.troveManagerRedemptions.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.yusdToken.address,
      contracts.sortedTroves.address,
      YETIContracts.yetiToken.address,
      YETIContracts.sYETI.address,
      contracts.whitelist.address,
      contracts.troveManager.address
    )

    await contracts.troveManagerLiquidations.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.yusdToken.address,
      contracts.sortedTroves.address,
      YETIContracts.yetiToken.address,
      YETIContracts.sYETI.address,
      contracts.whitelist.address,
      contracts.troveManager.address,
      YETIContracts.yetiFinanceTreasury.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.sortedTroves.address,
      contracts.yusdToken.address,
      YETIContracts.sYETI.address,
      contracts.whitelist.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.yusdToken.address,
      contracts.sortedTroves.address,
      YETIContracts.communityIssuance.address,
      contracts.whitelist.address,
      contracts.troveManagerLiquidations.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address, 
      contracts.whitelist.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.collSurplusPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.whitelist.address,
      YETIContracts.yetiFinanceTreasury.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.troveManagerRedemptions.address,
      contracts.activePool.address,
      contracts.whitelist.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.whitelist.address
    )

    // set contracts in Whitelist
    await contracts.whitelist.setAddresses(
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.collSurplusPool.address,
      contracts.borrowerOperations.address,
    )

    await contracts.wJLP.setAddresses(
      contracts.activePool.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      YETIContracts.yetiFinanceTreasury.address,
      contracts.borrowerOperations.address,
      contracts.collSurplusPool.address
    )

    await contracts.PriceCurveAVAX.setAddresses(contracts.whitelist.address)
    await contracts.PriceCurveAVAX.adjustParams("AVAX", "0", "0", "0", "0", "0", "0", "0",);
    await contracts.PriceCurveETH.setAddresses(contracts.whitelist.address)
    await contracts.PriceCurveETH.adjustParams("ETH", "0", "0", "0", "0", "0", "0", "0");
    await contracts.PriceCurveJLP.setAddresses(contracts.whitelist.address)
    await contracts.PriceCurveJLP.adjustParams("JLP", "0", "0", "0", "0", "0", "0", "0");

    const newERC20Router = await ERC20Router.new("tester", contracts.activePool.address, ZERO_ADDRESS, contracts.yusdToken.address)

    await contracts.whitelist.addCollateral(contracts.weth.address, "1000000000000000000", contracts.priceFeedETH.address, 18, contracts.PriceCurveETH.address, false, newERC20Router.address);
    await contracts.whitelist.addCollateral(contracts.wavax.address, "1000000000000000000", contracts.priceFeedAVAX.address, 18, contracts.PriceCurveAVAX.address, false, newERC20Router.address);
    await contracts.whitelist.addCollateral(contracts.wJLP.address, "1000000000000000000", contracts.priceFeedJLP.address, 18, contracts.PriceCurveJLP.address, true, newERC20Router.address);
  }

  // Deploys a new whitelist collateral. 
  // Creates a corresponding price feed, price curve, adjusts the params, and adds it to the whitelist.
  // Call this function after the normal connect core contracts.  
  static async deployExtraCollateral(contracts, params) {

    const {
      name, 
      symbol,
      decimals,
      ratio, 
    } = params

    const newToken = await ERC20Token.new(symbol, name, decimals);

    const newPriceFeed = await PriceFeedTestnet.new();

    const newPriceCurve = await LinearPriceCurve.new();
    await newPriceCurve.setAddresses(contracts.whitelist.address)
    await newPriceCurve.adjustParams(name, "0", "0", "0", "0", "0", "0", "0");

    const newERC20Router = await ERC20Router.new("tester", contracts.activePool.address, ZERO_ADDRESS, contracts.yusdToken.address)

    await contracts.whitelist.addCollateral(newToken.address, ratio, newPriceFeed.address, decimals, newPriceCurve.address, false, newERC20Router.address);

    return {
      token: newToken,
      priceFeed: newPriceFeed,
      priceCurve: newPriceCurve
    }
  }

  static async deployNewRouter(contracts, params) {
    const {
      name, 
      joeRouter, 
      whitelistCollateral
    } = params

    const newERC20Router = await ERC20Router.new(name, contracts.activePool.address, joeRouter.address, contracts.yusdToken.address)

    await contracts.whitelist.setDefaultRouter(whitelistCollateral.address, newERC20Router.address)

    return {
      router: newERC20Router
    }
  }

  static async connectYETIContracts(YETIContracts) {
    // Set YETIToken address in LCF
    await YETIContracts.lockupContractFactory.setYETITokenAddress(YETIContracts.yetiToken.address)
  }

  static async connectYETIContractsToCore(YETIContracts, coreContracts) {
    await YETIContracts.sYETI.setAddresses(
      YETIContracts.yetiToken.address,
      coreContracts.yusdToken.address,
    )
  
    await YETIContracts.communityIssuance.setAddresses(
      YETIContracts.yetiToken.address,
      coreContracts.stabilityPool.address
    )
  }

  static async connectUnipool(uniPool, YETIContracts, uniswapPairAddr, duration) {
    await uniPool.setParams(YETIContracts.yetiToken.address, uniswapPairAddr, duration)
  }
}
module.exports = DeploymentHelper
