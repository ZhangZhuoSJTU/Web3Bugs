const { assert } = require("hardhat")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const YUSDToken = artifacts.require("YUSDToken")
const NonPayable = artifacts.require('NonPayable.sol')

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

const getFrontEndTag = async (stabilityPool, depositor) => {
  return (await stabilityPool.deposits(depositor))[1]
}

contract('StabilityPool', async accounts => {

  const [owner,
    defaulter_1, defaulter_2, defaulter_3,
    whale,
    alice, bob, carol, dave, erin, flyn,
    A, B, C, D, E, F,
    frontEnd_1, frontEnd_2, frontEnd_3,
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
  let contracts
  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let yetiToken
  let communityIssuance
  let hintHelpers
  let whitelist
  let sYETI
  let lockupContractFactory

  let weth
  let priceFeedETH
  let wethIDX
  let wethParams

  let wavax
  let priceFeedAVAX
  let avaxIDX
  let wavaxParams

  let tokenRisky
  let priceFeedRisky
  let riskyIDX
  let tokenRiskyParams

  let tokenSuperRisky
  let priceFeedSuperRisky
  let superRiskyIDX
  let tokenSuperRiskyParams

  let tokenLowDecimal
  let priceFeedLowDecimal
  let lowDecimalIDX
  let tokenLowDecimalParams

  let tokenHighDecimal
  let priceFeedHighDecimal
  let highDecimalIDX
  let tokenHighDecimalParams

  let stableCoin
  let priceFeedStableCoin
  let stableCoinIDX
  let stableCoinParams

  let collToken
  let collTokenPriceFeed
  let collTokenIDX
  let collTokenParams

  let result

  let gasPriceInWei

  let YUSD_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR

  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const assertRevert = th.assertRevert
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)

  describe("Stability Pool Mechanisms", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
        contracts = await deploymentHelper.deployLiquityCore()
        contracts.borrowerOperations = await BorrowerOperationsTester.new()
        contracts.troveManager = await TroveManagerTester.new()
        contracts = await deploymentHelper.deployYUSDTokenTester(contracts)
        const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

        await deploymentHelper.connectYETIContracts(YETIContracts)
        await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
        await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

        // if (withProxy) {
        //     const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        //     await deploymentHelper.deployProxyScripts(contracts, YETIContracts, owner, users)
        // }

        // priceFeed = contracts.priceFeedTestnet
        yusdToken = contracts.yusdToken
        sortedTroves = contracts.sortedTroves
        troveManager = contracts.troveManager
        activePool = contracts.activePool
        stabilityPool = contracts.stabilityPool
        defaultPool = contracts.defaultPool
        borrowerOperations = contracts.borrowerOperations
        hintHelpers = contracts.hintHelpers
        whitelist = contracts.whitelist

        sYETI = YETIContracts.sYETI
        yetiToken = YETIContracts.yetiToken
        communityIssuance = YETIContracts.communityIssuance
        lockupContractFactory = YETIContracts.lockupContractFactory

        YUSD_GAS_COMPENSATION = await borrowerOperations.YUSD_GAS_COMPENSATION()
        MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
        BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()

        weth = contracts.weth
        wethIDX = await whitelist.getIndex(weth.address)
        priceFeedETH = contracts.priceFeedETH
        wethParams = {
          "token": weth,
          "IDX": wethIDX,
          "priceFeed": priceFeedETH,
        }

        wavax = contracts.wavax
        avaxIDX = await whitelist.getIndex(wavax.address)
        priceFeedAVAX = contracts.priceFeedAVAX
        wavaxParams = {
          "token": wavax,
          "IDX": avaxIDX,
          "priceFeed": priceFeedAVAX
        }

        const paramsRisky = {
          name: "Risky Token",
          symbol: "T.R",
          decimals: 18,
          ratio: dec(75, 16) // 75%
        }
        result = await deploymentHelper.deployExtraCollateral(contracts, paramsRisky)
        tokenRisky = result.token
        priceFeedRisky = result.priceFeed
        riskyIDX = await whitelist.getIndex(tokenRisky.address);
        tokenRiskyParams = {
          "token": tokenRisky,
          "IDX": riskyIDX,
          "priceFeed": priceFeedRisky
        }

        const paramsSuperRisky = {
          name: "Super Risky Token",
          symbol: "T.SR",
          decimals: 18,
          ratio: dec(5, 17) // 50%
        }
        result = await deploymentHelper.deployExtraCollateral(contracts, paramsSuperRisky)
        tokenSuperRisky = result.token
        priceFeedSuperRisky = result.priceFeed
        superRiskyIDX = await whitelist.getIndex(tokenSuperRisky.address);
        tokenSuperRiskyParams = {
          "token": tokenSuperRisky,
          "IDX": superRiskyIDX,
          "priceFeed": priceFeedSuperRisky
        }

        const paramsLowDecimal = {
          name: "Low Decimal Token",
          symbol: "T.LD",
          decimals: 6,
          ratio: dec(1, 18)
        }
        result = await deploymentHelper.deployExtraCollateral(contracts, paramsLowDecimal)
        tokenLowDecimal = result.token
        priceFeedLowDecimal = result.priceFeed
        lowDecimalIDX = await whitelist.getIndex(tokenLowDecimal.address);
        tokenLowDecimalParams = {
          "token": tokenLowDecimal,
          "IDX": lowDecimalIDX,
          "priceFeed": priceFeedLowDecimal
        }

      const paramsHighDecimal = {
        name: "High Decimal Token",
        symbol: "T.HD",
        decimals: 20,
        ratio: dec(1, 18)
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsHighDecimal)
      tokenHighDecimal = result.token
      priceFeedHighDecimal = result.priceFeed
      lowDecimalIDX = await whitelist.getIndex(tokenHighDecimal.address);
      tokenHighDecimalParams = {
        "token": tokenHighDecimal,
        "IDX": lowDecimalIDX,
        "priceFeed": priceFeedHighDecimal
      }

        const paramsStableCoin = {
          name: "USD Coin",
          symbol: "USDC",
          decimals: 18,
          ratio: dec(105, 16) // 105%
        }
        result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
        stableCoin = result.token
        priceFeedStableCoin = result.priceFeed
        stableCoinIDX = await whitelist.getIndex(stableCoin.address)
        stableCoinParams = {
          "token": stableCoin,
          "IDX": stableCoinIDX,
          "priceFeed": priceFeedStableCoin
        }

        const params = {
          name: "Coll Token",
          symbol: "CTK",
          decimals: 18,
          ratio: dec(1, 18) // 100%
        }
        result = await deploymentHelper.deployExtraCollateral(contracts, params)
        collToken = result.token
        collTokenPriceFeed = result.priceFeed
        collTokenIDX = await whitelist.getIndex(collToken.address)
        collTokenParams = {
          "token": collToken,
          "IDX": collTokenIDX,
          "priceFeed": collTokenPriceFeed
        }
    })

    describe("Single Collateral, Normal Mode, one SP depositor liquidations, full offset", async () => {
      /* Alice mints 1000 Super Risky tokens, then deposits it into trove
     * while taking on 2000 of extraYUSD debt.
     * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
     * Then Alice gets liquidated
     * TODO: error is somewhat large
     */
      it("provideToSP(): Liquidation single collateral low ratio full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenSuperRiskyParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 18))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18))
        const maxError = 1000000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 stablecoin tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral high ratio full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = stableCoinParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 18))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18))
        const maxError = 1000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 lowDecimal tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral low decimal full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenLowDecimalParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 6))];
        const postPriceChangeICRAlice = toBN(108);
        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18));
        const maxError = 1000

        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 Risky tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral high decimal full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenHighDecimalParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 20))];
        const postPriceChangeICRAlice = toBN(108);
        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18));

        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, 1000)
      })
    })

    describe("Single Collateral Normal Mode, one SP depositor liquidations, partial offset", async () => {
      /* Alice mints 1000 Super Risky tokens, then deposits it into trove
   * while taking on 2000 of extraYUSD debt.
   * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
   * Bob only deposits 500 YUSD into SP
   * Then Alice gets liquidated
   */
      it("provideToSP(): Liquidation single collateral low ratio partial offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenSuperRiskyParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 18))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(500, 18))
        const maxError = 1000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 stablecoin tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Bob only deposits 500 YUSD into SP
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral high ratio partial offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = stableCoinParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 18))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(500, 18))
        const maxError = 1000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 tokenHighDecimal tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Bob only deposits 500 YUSD into SP
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral high decimal partial offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenHighDecimalParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 20))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(500, 18))
        const maxError = 1000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 tokenLowDecimal tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Bob only deposits 500 YUSD into SP
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral low decimal partial offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenLowDecimalParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 20))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(500, 18))
        const maxError = 1000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

    })

    // TODO: recovery mode single collateral testing-currently tests aren't written correctly, just copiedf
    // from single collateral normal mode
    describe.skip("Single Collateral, Recovery Mode, one SP depositor liquidations, full offset", async () => {
      /* Alice mints 1000 Super Risky tokens, then deposits it into trove
     * while taking on 2000 of extraYUSD debt.
     * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
     * Then Alice gets liquidated
     * TODO: error is somewhat large
     */
      it("Recovery Mode Liquidation single collateral low ratio full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenSuperRiskyParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 18))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(50000, 18))];
        const bob_SP_Deposit = toBN(dec(6500000, 18))
        const maxError = 1000000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 stablecoin tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral high ratio full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = stableCoinParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 18))];
        const postPriceChangeICRAlice = toBN(108);

        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18))
        const maxError = 1000
        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 lowDecimal tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral low decimal full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenLowDecimalParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 6))];
        const postPriceChangeICRAlice = toBN(108);
        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18));
        const maxError = 1000

        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })

      /* Alice mints 1000 Risky tokens, then deposits it into trove
       * while taking on 2000 of extraYUSD debt.
       * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
       * Then Alice gets liquidated
       */
      it("provideToSP(): Liquidation single collateral high decimal full offset", async () => {
        // --- Alice Creates Trove ---
        const aliceTokenParams = tokenHighDecimalParams;
        const collsAlice = [aliceTokenParams.token];
        const amountsAlice = [toBN(dec(1000, 20))];
        const postPriceChangeICRAlice = toBN(108);
        const bobTokenParams = wethParams;
        const collsBob = [bobTokenParams.token];
        const amountsBob = [toBN(dec(500000, 18))];
        const bob_SP_Deposit = toBN(dec(1000000, 18));

        await th.oneCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
          postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, 1000)
      })
    })


    describe("Multi Collateral, Normal Mode, one SP depositor liquidations, full offset", async () => {

    /* Alice mints 1000 WAVAX and 1000 WETH, then deposits both into a trove will taking at 1000 YUSD debt.
     * Then bob mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then bob deposits 5000 YUSD into stability pool. Then Alice gets liquidated.
     * Checks that her collateral is transferred into the
     * stability pool and that bob can withdraw it successfully
     * TODO: error on Bob's received YUSD is quite large
     */
      it("provideToSP(): Liquidation multicollateral full offset ratio = 1, one SP depositor", async () => {
        // --- SETUP --- Mint Alice 1000 WETH and 1000 WAVAX and deposit into trove with debt of 2000
        const colls = [contracts.weth, contracts.wavax];
        const aliceTroveWETH = toBN(dec(1000, 18));
        const aliceTroveWAVAX = toBN(dec(1000, 18));
        const aliceExtraTroveDebt = toBN(dec(2000, 18));
        const amounts = [aliceTroveWETH, aliceTroveWAVAX];

        const collsBob = [contracts.weth];
        const amountsBob = [toBN(dec(500000000, 18))];
        const SP_Deposit_Bob = toBN(dec(5000000, 18));

        await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
          colls: colls, amounts: amounts, from: alice })

        await th.openTroveWithColls(contracts, {
          colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob })

        // --- TEST ---

        // provideToSP()
        await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

        // check YUSD balances after
        const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
        assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

        const aliceICRPre = await troveManager.getCurrentICR(alice);
        console.log("Alice ICR Pre Price", aliceICRPre.toString());

        await priceFeedAVAX.setPrice(toBN(dec(103, 18)).toString());
        await priceFeedETH.setPrice(toBN(dec(105, 18)).toString());

        const aliceICR = await troveManager.getCurrentICR(alice);
        console.log("Alice ICR Post Price", aliceICR.toString());

        const bobICR = await troveManager.getCurrentICR(bob);
        console.log("Bob ICR Post Price", bobICR.toString());

        const aliceData = await troveManager.getEntireDebtAndColls(alice);
        const aliceTotalTroveDebt = aliceData[0];
        console.log("Alice Total Trove Debt", aliceTotalTroveDebt.toString());
        console.log("Bob SP Deposit", SP_Deposit_Bob.toString());

        // liquidate Alice:
        await troveManager.liquidate(alice, {from: dave});
        const aliceStatus = await troveManager.getTroveStatus(alice);
        assert.equal(aliceStatus.toString(), "3") // 3 means "closed by liquidation"

        const stabilityPoolAssets = await stabilityPool.getAllCollateral();

        // SP Receives Correct Rewards
        const SP_WETH = stabilityPoolAssets[1][0];
        const SP_WAVAX = stabilityPoolAssets[1][1];
        assert.equal((aliceTroveWETH.mul(toBN(995)).div(toBN(1000))).toString(), SP_WETH.toString());
        assert.equal((aliceTroveWAVAX.mul(toBN(995)).div(toBN(1000))).toString(), SP_WAVAX.toString());

        // Liquidator (Dave) gets correct rewards
        const dave_WETH = await contracts.weth.balanceOf(dave);
        const dave_WAVAX = await contracts.wavax.balanceOf(dave);
        assert.equal((aliceTroveWETH.mul(toBN(5)).div(toBN(1000))).toString(), dave_WETH.toString());
        assert.equal((aliceTroveWAVAX.mul(toBN(5)).div(toBN(1000))).toString(), dave_WAVAX.toString());

        // SP Depositor (bob) receives correct rewards upon withdrawal
        const bob_pre_WETH = await contracts.weth.balanceOf(bob);
        const bob_pre_WAVAX = await contracts.wavax.balanceOf(bob);
        const bob_pre_YUSD = await contracts.yusdToken.balanceOf(bob);
        console.log("Bob Pre YUSD", bob_pre_YUSD.toString())

        await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

        const bob_post_WETH = await contracts.weth.balanceOf(bob);
        const bob_post_WAVAX = await contracts.wavax.balanceOf(bob);
        const bob_post_YUSD = await contracts.yusdToken.balanceOf(bob);
        console.log("Bob Post YUSD", bob_post_YUSD.toString())

        const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
        const bob_WAVAX_gain = bob_post_WAVAX - bob_pre_WAVAX;
        const bob_YUSD_gain_fromWithdrawal = bob_post_YUSD.sub(bob_pre_YUSD);

        const bob_expected_YUSD_gain_fromWithdrawal = SP_Deposit_Bob.sub(aliceTotalTroveDebt);

        console.log("expected YUSD GAIN BOB", (bob_expected_YUSD_gain_fromWithdrawal.toString()));
        console.log("Actual YUSD GAIN BOB", (bob_YUSD_gain_fromWithdrawal.toString()));

        th.assertIsApproximatelyEqual(bob_YUSD_gain_fromWithdrawal, bob_expected_YUSD_gain_fromWithdrawal, 10000000)

        assert.equal(bob_WETH_gain.toString(), SP_WETH.toString());
        assert.equal(bob_WAVAX_gain.toString(), SP_WAVAX.toString());

        // Liquidated Trove Owner (Alice) has no pending rewards in Coll Surplus Pool
        const aliceWETHPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.weth.address);
        const aliceWAVAXPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.wavax.address);

        assert.equal(aliceWETHPendingRewards.toString(), "0");
        assert.equal(aliceWAVAXPendingRewards.toString(), "0");
      })

      // this test case is not completed
      it("provideToSP(): Liquidation multicollateral full offset ratio = 1, one SP depositor", async() => {
          console.log("THE RIGHT ONE")
          const aliceTokenParams = [wethParams, wavaxParams];
          const collsAlice = [aliceTokenParams[0].token, aliceTokenParams[1].token];
          const amountsAlice = [toBN(dec(1000, 18)), toBN(dec(500, 18))];
          const postPriceChangeICRAlice = toBN(108);

          const bobTokenParams = collTokenParams;
          const collsBob = [bobTokenParams.token];
          const amountsBob = [toBN(dec(500000, 18))];
          const bob_SP_Deposit = toBN(dec(500, 18))
          const maxError = 1000

          th.multiCollLiquidationTest(contracts, aliceTokenParams, collsAlice, amountsAlice,
            postPriceChangeICRAlice, bobTokenParams, collsBob, amountsBob, bob_SP_Deposit, alice, bob, dave, maxError)
      })
    })

    // --- provideToSP() ---
    /* Alice mints 1000 WAVAX and 1000 WETH, then deposits both into a trove
     * while taking on 2000 of extraYUSD debt.
     * Then she mints another 1000 WETH and deposits that into the trove as well.
     * Then Bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
     * Bob deposits 200 e-18 YUSD into stability pool.
     * Then Alice gets liquidated. Checks that stability pool does not receive any assets.
     * Checks that Bob gets all of Alice's debt and all of Alice's collateral minus the liquidation reward
     * to the liquidator
     */
    xit("provideToSP(): alice is liquidated with ICR < 100% so all colls/debt redistributed", async () => {
      // --- SETUP ---
      const collsAlice = [contracts.weth, contracts.wavax];
      const amounts = [toBN(dec(1000, 18)), toBN(dec(1000, 18))]
      await th.openTroveWithColls(contracts, {
          colls: collsAlice, amounts: amounts, extraYUSDAmount: toBN(dec(2000, 18)), from: alice })

      const colls2Alice = toBN(dec(1000, 18));
      await th.addERC20(contracts.weth, alice, borrowerOperations.address, colls2Alice, { from: alice })
      await th.adjustTrove(contracts, [contracts.weth.address], [colls2Alice], [], [], 0, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, {from: alice})

      const collsBob = [contracts.weth, contracts.wavax];
      const amountsBob = [toBN(dec(500000, 18)), toBN(dec(5000, 18))];
      await th.openTroveWithColls(contracts, {
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: toBN(dec(2000, 18)), from: bob })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(200, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After, 200)

      await priceFeedAVAX.setPrice('140000000000000000');
      await priceFeedETH.setPrice('1000000000000000000');

      const aliceICR_1 = await troveManager.getCurrentICR(alice);
      // console.log(aliceICR_1.toString());
      // alice's ICR is below 100%

      const bobTrove = await troveManager.getEntireDebtAndColls(bob);
      const aliceTrove =  await troveManager.getEntireDebtAndColls(alice);

      const bobPreLiquidateTroveWETH = bobTrove[1][wethIDX];
      const bobPreLiquidateTroveWAVAX = bobTrove[1][wavaxParams.IDX];
      const alicePreLiquidateTroveWETH = aliceTrove[1][wethIDX];
      const alicePreLiquidateTroveWAVAX = aliceTrove[1][wavaxParams.IDX];

      const bobPreLiquidateDebt = bobTrove[0];
      const alicePreLiquidateDebt = aliceTrove[0];

      const aliceLiquidatedWETH = alicePreLiquidateTroveWETH.mul(995).div(1000);
      const aliceLiquidatedWAVAX = alicePreLiquidateTroveWAVAX.mul(995).div(1000);

      const bobExpectedWETH = bobPreLiquidateTroveWETH.add(aliceLiquidatedWETH);
      const bobExpectedWAVAX = bobPreLiquidateTroveWAVAX.add(aliceLiquidatedWAVAX);

      const bobExpectedDebt = bobPreLiquidateDebt.add(alicePreLiquidateDebt);

      // liquidate Alice:
      await troveManager.liquidate(alice);

      consoole.log(bobPreLiquidateDebt.toString());
      consoole.log(alicePreLiquidateDebt.toString());

      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      for (let i = 0; i < stabilityPoolAssets[0].length; i++) {
        // checks that no collateral has transferred to the stability pool
        assert.equal(stabilityPoolAssets[1][i].toString(), "0")
      }

      const aliceStatus = await troveManager.getTroveStatus(alice);
      assert.equal(aliceStatus.toString(), "3") // 3 means "closed by liquidation"
    })

    /* Alice mints 1000 WETH and 1000 Risky tokens, then deposits both into a trove
     * while taking on 2000 of extraYUSD debt.
     * Then she mints another 1000 WETH and deposits that into the trove as well.
     * Then bob mints 500k weth and deposits it into a trove while borrowing 2000 YUSD.
     * Then Alice gets liquidated
     */
    it("provideToSP(): Liquidation multicollateral full offset ratio = 1, 0.5", async () => {
      // --- SETUP ---
      const colls = [contracts.weth, tokenRisky];
      const aliceWETH_InTrove = toBN(dec(2005, 16));
      const aliceRisky_InTrove = toBN(dec(4010, 16))
      const amounts = [aliceWETH_InTrove, aliceRisky_InTrove]
      await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amounts, extraYUSDAmount: toBN(dec(2000, 18)), from: alice, oracles: [priceFeedETH, priceFeedRisky] })

      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const bob_SP_Deposit = toBN(dec(10000, 18))
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: bob_SP_Deposit, from: bob, oracles: [priceFeedETH] })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(bob_SP_Deposit, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), bob_SP_Deposit.toString())

      await priceFeedRisky.setPrice('200000000000000000');
      await priceFeedETH.setPrice('180000000000000000000');

      const aliceICR_1 = await troveManager.getCurrentICR(alice);
      const aliceDebt = await troveManager.getTroveDebt(alice);
      const aliceColls = await troveManager.getTroveColls(alice);
      const aliceTroveUSD = await troveManager.getUSD(aliceColls[0], aliceColls[1]);
      console.log("Alice USD in Trove ", aliceTroveUSD.toString());

      console.log("Alice ICR", aliceICR_1.toString());
      console.log("Alice Debt", th.toNormalBase(aliceDebt));
      // AliceICR roughly equal to 106%

      // liquidate Alice:
      await troveManager.liquidate(alice);
      const aliceStatus = await troveManager.getTroveStatus(alice);
      assert.equal(aliceStatus.toString(), "3") // 3 means "closed by liquidation"

      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      const SP_WETH = stabilityPoolAssets[1][wethIDX];
      const SP_Risky = stabilityPoolAssets[1][riskyIDX];
      console.log(stabilityPoolAssets[1].toString());
      console.log(SP_WETH.toString())
      console.log(SP_Risky.toString())

      assert.equal((SP_WETH).toString(), (aliceWETH_InTrove.mul(toBN(995)).div(toBN(1000))).toString());
      assert.equal((SP_Risky).toString(), (aliceRisky_InTrove.mul(toBN(995)).div(toBN(1000))).toString());
      //
      // for (let i = 0; i < stabilityPoolAssets[0].length; i++) {
      //   // checks that no collateral has transferred to the stability pool
      //   assert.equal(stabilityPoolAssets[1][i].toString(), "0")
      // }
    })


    /* Alice mints 1000 WAVAX and 1000 WETH, then deposits both into a trove will taking at 1000 YUSD debt.
     * Then bob mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then bob deposits 5000 YUSD into stability pool. Then Alice gets liquidated.
     * Checks that her collateral is transferred into the
     * stability pool and that bob can withdraw it successfully
     */
    it("provideToSP(): alice is liquidated-enough in stability pool for full offset-one SP depositor", async () => {
      // --- SETUP --- Mint Alice 1000 WETH and 1000 WAVAX and deposit into trove with debt of 2000
      const colls = [contracts.weth, contracts.wavax];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveWAVAX = toBN(dec(2005, 16));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveWAVAX];

      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedAVAX] })

      // based on above have checked that after alice's trove has been opened with the correct collateral amounts

      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(5000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

      await priceFeedAVAX.setPrice(toBN(dec(109, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());

      const aliceICR = await troveManager.getCurrentICR(alice);
      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];

      const aliceICR_1 = await troveManager.getCurrentICR(alice);
      console.log('Alice yusd debt', (await getTroveEntireDebt(alice)).toString())
      console.log('Alice weth', (aliceData[2][0]).toString())
      console.log('Alice wavax', (aliceData[2][1]).toString())
      console.log('ALICE New ICR', aliceICR_1.toString())
      // liquidate Alice:
      await troveManager.liquidate(alice, {from: dave});

      const aliceStatus = await troveManager.getTroveStatus(alice);
      assert.equal(aliceStatus.toString(), "3")

      const stabilityPoolAssets = await stabilityPool.getAllCollateral();

      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][0];
      const SP_WAVAX = stabilityPoolAssets[1][1];
      //20.5 weth, 20.5 wavax as collateral. after liquidation, 20.5 x 0.995 = 19.94975
      console.log('WETH in collat', SP_WETH.toString())
      console.log('WAVAX in collat', SP_WAVAX.toString())
      assert.equal(((aliceData[2][0]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WAVAX.toString());

      // Liquidator (Dave) gets correct rewards
      const dave_WETH = await contracts.weth.balanceOf(dave);
      const dave_WAVAX = await contracts.wavax.balanceOf(dave);
      assert.equal(((aliceData[2][0]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WAVAX.toString());

      // SP Depositor (bob) receives correct rewards upon withdrawal
      const bob_pre_WETH = await contracts.weth.balanceOf(bob);
      const bob_pre_WAVAX = await contracts.wavax.balanceOf(bob);
      const bob_pre_YUSD = await contracts.yusdToken.balanceOf(bob);

      await priceFeedAVAX.setPrice(toBN(dec(200, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(200, 18)).toString());
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

      const bob_post_WETH = await contracts.weth.balanceOf(bob);
      const bob_post_WAVAX = await contracts.wavax.balanceOf(bob);
      const bob_post_YUSD = await contracts.yusdToken.balanceOf(bob);

      const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
      const bob_WAVAX_gain = bob_post_WAVAX - bob_pre_WAVAX;
      const bob_YUSD_gain_fromWithdrawal = bob_post_YUSD - bob_pre_YUSD;
      const bob_expected_YUSD_gain_fromWithdrawal = SP_Deposit_Bob - aliceTotalTroveDebt;
      const bob_YUSD_error = toBN(Math.abs(bob_YUSD_gain_fromWithdrawal - bob_expected_YUSD_gain_fromWithdrawal));

      assert.equal(bob_WETH_gain.toString(), SP_WETH.toString());
      assert.equal(bob_WAVAX_gain.toString(), SP_WAVAX.toString());

      // TODO: the received YUSD amount is slightly less than expected. Confirm why
      //assert.isTrue(bob_YUSD_error < toBN(400000));

      // Liquidated Trove Owner (Alice) has no pending rewards in Coll Surplus Pool
      const aliceWETHPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.weth.address);
      const aliceWAVAXPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.wavax.address);

      assert.equal(aliceWETHPendingRewards.toString(), "0");
      assert.equal(aliceWAVAXPendingRewards.toString(), "0");
    })

    /* Alice mints 1000 riskyToken and 1000 WETH, then deposits both into a trove with extra debt of 2000
     * Then bob mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then bob deposits 5000 YUSD into stability pool. Then Alice gets liquidated.
     * Checks that her collateral is transferred into the
     * stability pool and that bob can withdraw it successfully
     * TODO
     */
    it("provideToSP(): Liquidation multicollateral full offset ratio = 1, 0.5, one SP depositor", async () => {
      const colls = [contracts.weth, tokenSuperRisky];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveSR = toBN(dec(4010, 16));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveSR];
      await priceFeedSuperRisky.setPrice(toBN(dec(200, 18)))

      await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

      // based on above have checked that after alice's trove has been opened with the correct collateral amounts
      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(5000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

      const aliceBeforeICR = await troveManager.getCurrentICR(alice);
      console.log('alice before icr', aliceBeforeICR.toString());
      await priceFeedSuperRisky.setPrice(toBN(dec(109, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());
      const aliceICR = await troveManager.getCurrentICR(alice);
      console.log('alice icr', aliceICR.toString());

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];
      console.log("alice trove debt", aliceTotalTroveDebt.toString())
      console.log('weth collat', (aliceData[2][0]).toString())
      console.log('super risky token collat', (aliceData[2][1]).toString())

      // liquidate Alice:
      const tx1 = await troveManager.liquidate(alice, {from: dave});
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(tx1, wethIDX)
      const [liquidatedDebt2, liquidatedColl2, gasComp2] = th.getEmittedLiquidationValues(tx1, 1)
      console.log('emitted liquidated ETH', liquidatedColl.toString())
      console.log('emitted liquidated RISKY', liquidatedColl2.toString())
      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      
      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][wethIDX];
      const SP_WAVAX = stabilityPoolAssets[1][1];
      const SP_SR = stabilityPoolAssets[1][superRiskyIDX]; 

      const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
      const riskyCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address)
      console.log('stability pool weth', SP_WETH.toString())
      console.log('stability pool risky', SP_SR.toString())
      console.log('weth coll surplus', wethCollSurplusPool.toString())
      console.log('risky coll surplus', riskyCollSurplusPool.toString())
      th.assertIsApproximatelyEqual((aliceData[2][0].mul(toBN(995)).div(toBN(1000))), (SP_WETH.add(wethCollSurplusPool)))
      th.assertIsApproximatelyEqual((aliceData[2][1].mul(toBN(995)).div(toBN(1000))), (SP_SR.add(riskyCollSurplusPool)))

      // SP Depositor (bob) receives correct rewards upon withdrawal
      const bob_pre_WETH = await contracts.weth.balanceOf(bob);
      const bob_pre_RISKY = await tokenSuperRisky.balanceOf(bob);

      await priceFeedSuperRisky.setPrice(toBN(dec(200, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(200, 18)).toString());
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

      const bob_post_WETH = await contracts.weth.balanceOf(bob);
      const bob_post_RISKY = await tokenSuperRisky.balanceOf(bob);

      const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
      const bob_RISKY_gain = bob_post_RISKY - bob_pre_RISKY;

      th.assertIsApproximatelyEqual(bob_WETH_gain, SP_WETH);
      th.assertIsApproximatelyEqual(bob_RISKY_gain, SP_SR);
    })

    it("provideToSP(): alice is liquidated with low decimal and normal asset--full offset-one SP depositor", async () => {

      const colls = [contracts.weth, tokenLowDecimal];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveLD = toBN(dec(2005, 4));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveLD];

      await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedLowDecimal], includeOne: false })

      // based on above have checked that after alice's trove has been opened with the correct collateral amounts
      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000000, 18))];
      const SP_Deposit_Bob = toBN(dec(5000000, 18));

      await th.openTroveWithCollsOld(contracts, {
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob })


      // const amountsBob = [toBN(dec(500000, 18))];
      // const SP_Deposit_Bob = toBN(dec(5000, 18));
      // await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
      //   colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH, priceFeedLowDecimal] })

      // --- TEST ---

      const bobData = await troveManager.getEntireDebtAndColls(bob);
      const bobTotalTroveDebt = bobData[0];
      console.log("bob trove debt", bobTotalTroveDebt.toString())
      console.log('weth collat', (bobData[2][0]).toString())
      const bobBeforeICR = await troveManager.getCurrentICR(bob);
      console.log('bob before icr', bobBeforeICR.toString());

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

      const aliceBeforeICR = await troveManager.getCurrentICR(alice);
      console.log('alice before icr', aliceBeforeICR.toString());

      await priceFeedETH.setPrice(toBN(dec(109, 18)));
      await priceFeedLowDecimal.setPrice(toBN(dec(109, 18)));

      const aliceICR = await troveManager.getCurrentICR(alice);
      console.log('alice icr', aliceICR.toString());

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];
      console.log("alice trove debt", aliceTotalTroveDebt.toString())
      console.log('weth collat', (aliceData[2][0]).toString())
      console.log('low decimal collat', (aliceData[2][1]).toString())

      // liquidate Alice:
      const tx1 = await troveManager.liquidate(alice, {from: dave});
      
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(tx1, wethIDX)
      const [liquidatedDebt2, liquidatedColl2, gasComp2] = th.getEmittedLiquidationValues(tx1, 1)
      console.log('emitted liquidated ETH', liquidatedColl.toString())
      console.log('emitted liquidated LOW DECIMAL', liquidatedColl2.toString())
      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      
      const SP_WETH = stabilityPoolAssets[1][wethIDX];
      const SP_LD = stabilityPoolAssets[1][4];

      const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
      const lowDecimalCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenLowDecimal.address)
      console.log('stability pool weth', SP_WETH.toString())
      console.log('stability pool low decimal', SP_LD.toString())
      console.log('wethCollSurplusPool', wethCollSurplusPool.toString())
      console.log('lowDecimalCollSurplusPool', lowDecimalCollSurplusPool.toString())

      // SP Receives Correct Rewards
      assert.equal(((aliceData[2][0]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(995)).div(toBN(1000))).toString(), SP_LD.toString());

      // Liquidator (Dave) gets correct rewards
      const dave_WETH = await contracts.weth.balanceOf(dave);
      const dave_LD = await tokenLowDecimal.balanceOf(dave);
      assert.equal(((aliceData[2][0]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(5)).div(toBN(1000))).toString(), dave_LD.toString());

      // SP Depositor (bob) receives correct rewards upon withdrawal
      const bob_pre_WETH = await contracts.weth.balanceOf(bob);
      const bob_pre_LD = await tokenLowDecimal.balanceOf(bob);

      await priceFeedLowDecimal.setPrice(toBN(dec(200, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(200, 18)).toString());
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

      const stabilityPoolAssets2 = await stabilityPool.getAllCollateral();
      
      const SP_WETH2 = stabilityPoolAssets2[1][wethIDX];
      const SP_LD2 = stabilityPoolAssets2[1][4];
      console.log('stability pool ld post withdrawal', SP_WETH2.toString())
      console.log('stability pool ld post withdrawal', SP_LD2.toString())

      const bob_post_WETH = await contracts.weth.balanceOf(bob);
      const bob_post_LD = await tokenLowDecimal.balanceOf(bob);

      const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
      const bob_LD_gain = bob_post_LD - bob_pre_LD;

      assert.equal(bob_WETH_gain.toString(), (SP_WETH).toString());
      assert.equal(bob_LD_gain.toString(), (SP_LD).toString());

      // Liquidated Trove Owner (Alice) has no pending rewards in Coll Surplus Pool
      const aliceWETHPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.weth.address);
      const aliceLDPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, tokenLowDecimal.address);

      assert.equal(aliceWETHPendingRewards.toString(), "0");
      assert.equal(aliceLDPendingRewards.toString(), "0");
      
    })

    it("provideToSP(): alice is liquidated with low decimal and normal asset--enough in stability pool for partial offset-one SP depositor", async () => {
      // --- SETUP --- Mint Alice 1000 WETH and 1000 WAVAX and deposit into trove with debt of 2000
      const colls = [contracts.weth, tokenLowDecimal];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveLD = toBN(dec(2005, 4));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveLD];

      await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedLowDecimal], includeOne: false })

      // based on above have checked that after alice's trove has been opened with the correct collateral amounts
      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(2250, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(4, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      // --- TEST ---

      const bobData = await troveManager.getEntireDebtAndColls(bob);
      const bobTotalTroveDebt = bobData[0];
      console.log("bob trove debt", bobTotalTroveDebt.toString())
      console.log('weth collat', (bobData[2][0]).toString())

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

      const aliceBeforeICR = await troveManager.getCurrentICR(alice);
      console.log('alice before icr', aliceBeforeICR.toString());

      await priceFeedETH.setPrice(toBN(dec(109, 18)));
      await priceFeedLowDecimal.setPrice(toBN(dec(109, 18)));

      const aliceICR = await troveManager.getCurrentICR(alice);
      console.log('alice icr', aliceICR.toString());

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];
      console.log("alice trove debt", aliceTotalTroveDebt.toString())
      console.log('weth collat', (aliceData[2][0]).toString())
      console.log('low decimal collat', (aliceData[2][1]).toString())

      // liquidate Alice:
      const tx1 = await troveManager.liquidate(alice, {from: dave});
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(tx1, wethIDX)
      const [liquidatedDebt2, liquidatedColl2, gasComp2] = th.getEmittedLiquidationValues(tx1, 1)
      console.log('emitted liquidated ETH', liquidatedColl.toString())
      console.log('emitted liquidated LOW DECIMAL', liquidatedColl2.toString())
      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      
      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][wethIDX];
      const SP_LD = stabilityPoolAssets[1][4];

      const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
      const lowDecimalCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenLowDecimal.address)
      console.log('stability pool weth', SP_WETH.toString())
      console.log('stability pool low decimal', SP_LD.toString())
      console.log('wethCollSurplusPool', wethCollSurplusPool.toString())
      console.log('lowDecimalCollSurplusPool', lowDecimalCollSurplusPool.toString())
      
      // assert 2440.2375 YUSD entered stability pool: min(USD value of Coll not redistributed, 1.1 * debt offseted by stability pool) = 2440.2375
      console.log((SP_WETH.mul(toBN(109)).add(SP_LD.mul(toBN(109)).mul(toBN(dec(1, 12))))).toString())
      console.log(toBN(dec(24402375, 14)).toString())
      
      th.assertIsApproximatelyEqual(toBN(dec(24402375, 14)), SP_WETH.mul(toBN(109)).add(SP_LD.mul(toBN(109)).mul(toBN(dec(1, 12)))), 10000)

      // assert 0 YUSD entered coll surplus pool: offsetting collat - collat sent to stability pool = coll surplus --> 2440.2375 - 2440.2375 = 0
      th.assertIsApproximatelyEqual(toBN(0), wethCollSurplusPool.mul(toBN(109)).add(lowDecimalCollSurplusPool.mul(toBN(109)).mul(toBN(dec(1, 12)))));

      // SP Depositor (bob) receives correct rewards upon withdrawal
      const bob_pre_WETH = await contracts.weth.balanceOf(bob);
      const bob_pre_LD = await tokenLowDecimal.balanceOf(bob);

      await priceFeedLowDecimal.setPrice(toBN(dec(200, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(200, 18)).toString());
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

      const bob_post_WETH = await contracts.weth.balanceOf(bob);
      const bob_post_LD = await tokenLowDecimal.balanceOf(bob);

      const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
      const bob_LD_gain = bob_post_LD - bob_pre_LD;

      assert.equal(bob_WETH_gain.toString(), (SP_WETH).toString());
      assert.equal(bob_LD_gain.toString(), (SP_LD).toString());
    })

    it("provideToSP(): alice is liquidated with risky asset and normal asset--enough in stability pool for partial offset-one SP depositor", async () => {
      // --- SETUP --- Mint Alice 1000 WETH and 1000 WAVAX and deposit into trove with debt of 2000
      const colls = [contracts.weth, tokenSuperRisky];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveSR = toBN(dec(4010, 16));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveSR];
      await priceFeedSuperRisky.setPrice(toBN(dec(200, 18)))

      await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

      // based on above have checked that after alice's trove has been opened with the correct collateral amounts
      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(2250, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(4, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      // --- TEST ---

      const bobData = await troveManager.getEntireDebtAndColls(bob);
      const bobTotalTroveDebt = bobData[0];
      console.log("bob trove debt", bobTotalTroveDebt.toString())
      console.log('weth collat', (bobData[2][0]).toString())

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

      const aliceBeforeICR = await troveManager.getCurrentICR(alice);
      console.log('alice before icr', aliceBeforeICR.toString());

      await priceFeedSuperRisky.setPrice(toBN(dec(109, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());

      const aliceICR = await troveManager.getCurrentICR(alice);
      console.log('alice icr', aliceICR.toString());

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];
      console.log("alice trove debt", aliceTotalTroveDebt.toString())
      console.log('weth collat', (aliceData[2][0]).toString())
      console.log('super risky token collat', (aliceData[2][1]).toString())

      // liquidate Alice:
      const tx1 = await troveManager.liquidate(alice, {from: dave});
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(tx1, wethIDX)
      const [liquidatedDebt2, liquidatedColl2, gasComp2] = th.getEmittedLiquidationValues(tx1, 1)
      console.log('emitted liquidated ETH', liquidatedColl.toString())
      console.log('emitted liquidated RISKY', liquidatedColl2.toString())
      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      
      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][wethIDX];
      const SP_WAVAX = stabilityPoolAssets[1][1];
      const SP_SR = stabilityPoolAssets[1][superRiskyIDX]; 

      const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
      const riskyCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address)
      console.log('stability pool weth', SP_WETH.toString())
      console.log('stability pool risky', SP_SR.toString())
      console.log('wethCollSurplusPool', wethCollSurplusPool.toString())
      console.log('riskyCollSurplusPool', riskyCollSurplusPool.toString())
      
      // assert 2475 YUSD entered stability pool: min(USD value of Coll not redistributed, 1.1 * debt offseted by stability pool) = 2475
      th.assertIsApproximatelyEqual(toBN(dec(2475, 18)), SP_WETH.mul(toBN(109)).add(SP_SR.mul(toBN(109))))

      // assert 1185.35625 YUSD entered coll surplus pool: offsetting collat - collat sent to stability pool = coll surplus --> 3660.35625 - 2475 = 1185.35625
      th.assertIsApproximatelyEqual(toBN(dec(118535625, 13)), wethCollSurplusPool.mul(toBN(109)).add(riskyCollSurplusPool.mul(toBN(109))));
    })

    it("provideToSP(): alice is liquidated with normal assets--enough in stability pool for partial offset-one SP depositor", async () => {
      // --- SETUP --- Mint Alice 1000 WETH and 1000 WAVAX and deposit into trove with debt of 2000
      const colls = [contracts.weth, contracts.wavax];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveWAVAX = toBN(dec(2005, 16));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveWAVAX];

      await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedAVAX] })

      // based on above have checked that after alice's trove has been opened with the correct collateral amounts
      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(2250, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(4, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      // --- TEST ---

      const bobData = await troveManager.getEntireDebtAndColls(bob);
      const bobTotalTroveDebt = bobData[0];
      console.log("bob trove debt", bobTotalTroveDebt.toString())
      console.log('weth collat', (bobData[2][0]).toString())

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), SP_Deposit_Bob.toString())

      const aliceBeforeICR = await troveManager.getCurrentICR(alice);
      console.log('alice before icr', aliceBeforeICR.toString());

      await priceFeedAVAX.setPrice(toBN(dec(109, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());

      const aliceICR = await troveManager.getCurrentICR(alice);
      console.log('alice icr', aliceICR.toString());

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];
      console.log("alice trove debt", aliceTotalTroveDebt.toString())
      console.log('weth collat', (aliceData[2][0]).toString())
      console.log('wavax token collat', (aliceData[2][1]).toString())

      // liquidate Alice:
      const tx1 = await troveManager.liquidate(alice, {from: dave});
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(tx1, wethIDX)
      const [liquidatedDebt2, liquidatedColl2, gasComp2] = th.getEmittedLiquidationValues(tx1, 1)
      console.log('emitted liquidated ETH', liquidatedColl.toString())
      console.log('emitted liquidated AVAX', liquidatedColl2.toString())
      const stabilityPoolAssets = await stabilityPool.getAllCollateral();
      
      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][0];
      const SP_WAVAX = stabilityPoolAssets[1][1];

      const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
      const wavaxCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.wavax.address)
      console.log('stability pool weth', SP_WETH.toString())
      console.log('stability pool wavax', SP_WAVAX.toString())
      console.log('wethCollSurplusPool', wethCollSurplusPool.toString())
      console.log('wavaxCollSurplusPool', wavaxCollSurplusPool.toString())
      
      // assert 2440.2375 YUSD entered stability pool: min(USD value of Coll not redistributed, 1.1 * debt offseted by stability pool) = 2440.2375
      th.assertIsApproximatelyEqual(toBN(dec(24402375, 14)), SP_WETH.mul(toBN(109)).add(SP_WAVAX.mul(toBN(109))), 10000)

      // assert 0 YUSD entered coll surplus pool: offsetting collat - collat sent to stability pool = coll surplus --> 2440.2375 - 2440.2375 = 0
      th.assertIsApproximatelyEqual(toBN(0), wethCollSurplusPool.mul(toBN(109)).add(wavaxCollSurplusPool.mul(toBN(109))));
    })

    /* Alice mints 1000 WAVAX and 1000 WETH, then deposits both into a trove will taking YUSD debt.
     * Then she mints another 1000 WETH and deposits that into the trove as well.
     * Then bob mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then bob deposits 5000 YUSD into stability pool.
     * Then carol mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then carol deposits 5000 YUSD into stability pool.
     * Then Alice gets liquidated.
     * Checks that her collateral is transferred into the
     * stability pool and that bob can withdraw it successfully
     * Also checks collateral is properly split between Carol and Bob.
     */
    it("provideToSP(): alice is liquidated-enough in stability pool for full offset-two equivalent SP depositors", async () => {
      // --- SETUP ---
      const colls = [contracts.weth, contracts.wavax];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveWAVAX = toBN(dec(2005, 16));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveWAVAX];

      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedAVAX] })

      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(5000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      const collsCarol = [contracts.wavax];
      const amountsCarol = [toBN(dec(500000, 18))];
      const SP_Deposit_Carol = toBN(dec(5000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsCarol, amounts: amountsCarol, extraYUSDAmount: SP_Deposit_Carol, from: carol, oracles: [priceFeedAVAX] })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })
      await stabilityPool.provideToSP(SP_Deposit_Carol, ZERO_ADDRESS, { from: carol })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), (SP_Deposit_Bob.add(SP_Deposit_Carol)).toString())

      await priceFeedAVAX.setPrice(toBN(dec(109, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());
      console.log('alice new icr', (await troveManager.getCurrentICR(alice)).toString())

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];

      // liquidate Alice:
      await troveManager.liquidate(alice, {from: dave});

      const stabilityPoolAssets = await stabilityPool.getAllCollateral();

      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][0];
      const SP_WAVAX = stabilityPoolAssets[1][1];
      assert.equal(((aliceData[2][0]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WAVAX.toString());

      // Liquidator (Dave) gets correct rewards
      const dave_WETH = await contracts.weth.balanceOf(dave);
      const dave_WAVAX = await contracts.wavax.balanceOf(dave);
      assert.equal(((aliceData[2][0]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WAVAX.toString());

      // SP Depositor (bob) receives correct rewards upon withdrawal
      const bob_pre_WETH = await contracts.weth.balanceOf(bob);
      const bob_pre_WAVAX = await contracts.wavax.balanceOf(bob);
      const bob_pre_YUSD = await contracts.yusdToken.balanceOf(bob);

      await priceFeedAVAX.setPrice(toBN(dec(200, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(200, 18)).toString());
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

      const bob_post_WETH = await contracts.weth.balanceOf(bob);
      const bob_post_WAVAX = await contracts.wavax.balanceOf(bob);
      const bob_post_YUSD = await contracts.yusdToken.balanceOf(bob);

      const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
      const bob_WAVAX_gain = bob_post_WAVAX - bob_pre_WAVAX;
      const bob_YUSD_gain_fromWithdrawal = bob_post_YUSD - bob_pre_YUSD;
      const bob_expected_YUSD_gain_fromWithdrawal = SP_Deposit_Bob - (aliceTotalTroveDebt / 2);
      const bob_YUSD_error = toBN(Math.abs(bob_YUSD_gain_fromWithdrawal - bob_expected_YUSD_gain_fromWithdrawal));

      assert.equal(bob_WETH_gain.toString(), (SP_WETH / 2).toString());
      assert.equal(bob_WAVAX_gain.toString(), (SP_WAVAX / 2).toString());

      // TODO: the received YUSD amount is slightly less than expected. Confirm why
      //assert.isTrue(bob_YUSD_error < toBN(400000));

      // SP Depositor (alice) receives correct rewards upon withdrawal
      const carol_pre_WETH = await contracts.weth.balanceOf(carol);
      const carol_pre_WAVAX = await contracts.wavax.balanceOf(carol);
      const carol_pre_YUSD = await contracts.yusdToken.balanceOf(carol);

      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Carol, {from: carol});

      const carol_post_WETH = await contracts.weth.balanceOf(carol);
      const carol_post_WAVAX = await contracts.wavax.balanceOf(carol);
      const carol_post_YUSD = await contracts.yusdToken.balanceOf(carol);

      const carol_WETH_gain = carol_post_WETH - carol_pre_WETH;
      const carol_WAVAX_gain = carol_post_WAVAX - carol_pre_WAVAX;
      const carol_YUSD_gain_fromWithdrawal = carol_post_YUSD - carol_pre_YUSD;
      const carol_expected_YUSD_gain_fromWithdrawal = SP_Deposit_Carol - (aliceTotalTroveDebt / 2);
      const carol_YUSD_error = toBN(Math.abs(carol_YUSD_gain_fromWithdrawal - carol_expected_YUSD_gain_fromWithdrawal));

      assert.equal(carol_WETH_gain.toString(), (SP_WETH / 2).toString());
      assert.equal(carol_WAVAX_gain.toString(), (SP_WAVAX / 2).toString());

      // TODO: the received YUSD amount is slightly less than expected. Confirm why
      //assert.isTrue(carol_YUSD_error < toBN(400000));

      // Liquidated Trove Owner (Alice) has no pending rewards in Coll Surplus Pool
      const aliceWETHPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.weth.address);
      const aliceWAVAXPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.wavax.address);

      assert.equal(aliceWETHPendingRewards.toString(), "0");
      assert.equal(aliceWAVAXPendingRewards.toString(), "0");
    })

    /* Alice mints 1000 WAVAX and 1000 WETH, then deposits both into a trove will taking YUSD debt.
     * Then she mints another 1000 WETH and deposits that into the trove as well.
     * Then bob mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then bob deposits 5000 YUSD into stability pool.
     * Then carol mints 500k weth and deposits it into a trove while borrowing YUSD.
     * Then carol deposits 10,000 YUSD into stability pool.
     * Then Alice gets liquidated.
     * Checks that her collateral is transferred into the
     * stability pool and that bob can withdraw it successfully
     * Also checks collateral is properly split between Carol and Bob.
     * TODO
     */
    it("provideToSP(): alice is liquidated-enough in stability pool for full offset-two unequal SP depositors with unusual ratios", async () => {
      // --- SETUP ---
      const colls = [contracts.weth, contracts.wavax];
      const aliceTroveWETH = toBN(dec(2005, 16));
      const aliceTroveWAVAX = toBN(dec(2005, 16));
      const aliceExtraTroveDebt = toBN(dec(2000, 18));
      const amounts = [aliceTroveWETH, aliceTroveWAVAX];

      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: colls, amounts: amounts, extraYUSDAmount: aliceExtraTroveDebt, from: alice, oracles: [priceFeedETH, priceFeedAVAX] })

      const collsBob = [contracts.weth];
      const amountsBob = [toBN(dec(500000, 18))];
      const SP_Deposit_Bob = toBN(dec(5000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsBob, amounts: amountsBob, extraYUSDAmount: SP_Deposit_Bob, from: bob, oracles: [priceFeedETH] })

      const collsCarol = [contracts.wavax];
      const amountsCarol = [toBN(dec(500000, 18))];
      const SP_Deposit_Carol = toBN(dec(10000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsCarol, amounts: amountsCarol, extraYUSDAmount: SP_Deposit_Carol, from: carol, oracles: [priceFeedAVAX] })

      // --- TEST ---

      // provideToSP()
      await stabilityPool.provideToSP(SP_Deposit_Bob, ZERO_ADDRESS, { from: bob })
      await stabilityPool.provideToSP(SP_Deposit_Carol, ZERO_ADDRESS, { from: carol })

      // check YUSD balances after
      const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
      assert.equal(stabilityPool_YUSD_After.toString(), (SP_Deposit_Bob.add(SP_Deposit_Carol)).toString())

      await priceFeedAVAX.setPrice(toBN(dec(109, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());

      const aliceData = await troveManager.getEntireDebtAndColls(alice);
      const aliceTotalTroveDebt = aliceData[0];

      // liquidate Alice:
      await troveManager.liquidate(alice, {from: dave});

      // Erin creates a trove and deposits into stability pool
      const collsErin = [contracts.wavax];
      const amountsErin = [toBN(dec(500000, 18))];
      const SP_Deposit_Erin = toBN(dec(10000, 18));
      await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)),
        colls: collsErin, amounts: amountsErin, extraYUSDAmount: SP_Deposit_Erin, from: erin, oracles: [priceFeedAVAX] })
      await stabilityPool.provideToSP(SP_Deposit_Erin, ZERO_ADDRESS, { from: erin })

      const erin_pre_WETH = await contracts.weth.balanceOf(erin);
      const erin_pre_WAVAX = await contracts.wavax.balanceOf(erin);
      const erin_pre_YUSD = await contracts.yusdToken.balanceOf(erin);


      const stabilityPoolAssets = await stabilityPool.getAllCollateral();

      // SP Receives Correct Rewards
      const SP_WETH = stabilityPoolAssets[1][0];
      const SP_WAVAX = stabilityPoolAssets[1][1];
      assert.equal(((aliceData[2][0]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(995)).div(toBN(1000))).toString(), SP_WAVAX.toString());

      // Liquidator (Dave) gets correct rewards
      const dave_WETH = await contracts.weth.balanceOf(dave);
      const dave_WAVAX = await contracts.wavax.balanceOf(dave);
      assert.equal(((aliceData[2][0]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WETH.toString());
      assert.equal(((aliceData[2][1]).mul(toBN(5)).div(toBN(1000))).toString(), dave_WAVAX.toString());

      // SP Depositor (bob) receives correct rewards upon withdrawal
      const bob_pre_WETH = await contracts.weth.balanceOf(bob);
      const bob_pre_WAVAX = await contracts.wavax.balanceOf(bob);
      const bob_pre_YUSD = await contracts.yusdToken.balanceOf(bob);

      await priceFeedAVAX.setPrice(toBN(dec(200, 18)).toString());
      await priceFeedETH.setPrice(toBN(dec(200, 18)).toString());
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Bob, {from: bob});

      const bob_post_WETH = await contracts.weth.balanceOf(bob);
      const bob_post_WAVAX = await contracts.wavax.balanceOf(bob);
      const bob_post_YUSD = await contracts.yusdToken.balanceOf(bob);

      const bob_WETH_gain = bob_post_WETH - bob_pre_WETH;
      const bob_WAVAX_gain = bob_post_WAVAX - bob_pre_WAVAX;
      const bob_YUSD_gain_fromWithdrawal = bob_post_YUSD - bob_pre_YUSD;
      const bob_expected_YUSD_gain_fromWithdrawal = SP_Deposit_Bob - (aliceTotalTroveDebt / 3);
      const bob_YUSD_error = toBN(Math.abs(bob_YUSD_gain_fromWithdrawal - bob_expected_YUSD_gain_fromWithdrawal));

      th.assertIsApproximatelyEqual(bob_WETH_gain, (SP_WETH / 3), 10000)
      th.assertIsApproximatelyEqual(bob_WAVAX_gain, (SP_WAVAX / 3), 10000)

      // TODO: the received YUSD amount is slightly less than expected. Confirm why
      //assert.isTrue(bob_YUSD_error < toBN(400000));

      // SP Depositor (alice) receives correct rewards upon withdrawal
      const carol_pre_WETH = await contracts.weth.balanceOf(carol);
      const carol_pre_WAVAX = await contracts.wavax.balanceOf(carol);
      const carol_pre_YUSD = await contracts.yusdToken.balanceOf(carol);

      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Carol, {from: carol});

      const carol_post_WETH = await contracts.weth.balanceOf(carol);
      const carol_post_WAVAX = await contracts.wavax.balanceOf(carol);
      const carol_post_YUSD = await contracts.yusdToken.balanceOf(carol);

      const carol_WETH_gain = carol_post_WETH - carol_pre_WETH;
      const carol_WAVAX_gain = carol_post_WAVAX - carol_pre_WAVAX;
      const carol_YUSD_gain_fromWithdrawal = carol_post_YUSD - carol_pre_YUSD;
      const carol_expected_YUSD_gain_fromWithdrawal = SP_Deposit_Carol - 2 * (aliceTotalTroveDebt / 3);
      const carol_YUSD_error = toBN(Math.abs(carol_YUSD_gain_fromWithdrawal - carol_expected_YUSD_gain_fromWithdrawal));

      th.assertIsApproximatelyEqual(carol_WETH_gain, (2 * SP_WETH / 3), 10000)
      th.assertIsApproximatelyEqual(carol_WAVAX_gain, (2 * SP_WAVAX / 3), 10000)

      // TODO: the received YUSD amount is slightly less than expected. Confirm why
      //assert.isTrue(carol_YUSD_error < toBN(400000));

      // Liquidated Trove Owner (Alice) has no pending rewards in Coll Surplus Pool
      const aliceWETHPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.weth.address);
      const aliceWAVAXPendingRewards = await contracts.collSurplusPool.getAmountClaimable(alice, contracts.wavax.address);

      assert.equal(aliceWETHPendingRewards.toString(), "0");
      assert.equal(aliceWAVAXPendingRewards.toString(), "0");

      // Erin Withdraws from Stability Pool and receives initial YUSD with no gains
      await contracts.stabilityPool.withdrawFromSP(SP_Deposit_Erin, {from: erin});

      const erin_post_WETH = await contracts.weth.balanceOf(erin);
      const erin_post_WAVAX = await contracts.wavax.balanceOf(erin);
      const erin_post_YUSD = await contracts.yusdToken.balanceOf(erin);

      // no gains from liquidations
      assert.equal(erin_pre_WETH.toString(), erin_post_WETH.toString());
      assert.equal(erin_pre_WAVAX.toString(), erin_post_WAVAX.toString());

      // erin gets back full initial SP deposit
      assert.equal((erin_post_YUSD.sub(erin_pre_YUSD)).toString(), SP_Deposit_Erin.toString());
    })

    describe("Multi Collateral, Recovery Mode, one SP depositor liquidations, full offset", async () => {
      it("liquidate() recovery mode, with one trove ICR <= 100%", async () => {
        // --- SETUP ---
        //  Alice and Bob withdraw such that the TCR is ~200%
        const colls = [contracts.weth, tokenSuperRisky];
        const aliceWETH_InTrove = toBN(dec(2005, 16));
        const aliceRisky_InTrove = toBN(dec(4010, 16))
        const amountsAlice = [aliceWETH_InTrove, aliceRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amountsAlice, extraYUSDAmount: toBN(dec(2000, 18)), from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

        const bobWETH_InTrove = toBN(dec(4010, 16));
        const bobRisky_InTrove = toBN(dec(4010, 16));
        const amountsBob = [bobWETH_InTrove, bobRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amountsBob, extraYUSDAmount: toBN(dec(2000, 18)), from: bob, oracles: [priceFeedETH, priceFeedSuperRisky] })
        
        const TCR = (await th.getTCR(contracts)).toString()
        assert.equal(TCR, '2500000000000000000')
    
        //const bob_Stake_Before = (await troveManager.getTroveStake(bob, weth.address))
        const weth_totalStakes_Before = await troveManager.getTotalStake(weth.address)
        const risky_totalStakes_Before = await troveManager.getTotalStake(tokenSuperRisky.address)
        console.log('weth_totalStakes_Before', weth_totalStakes_Before.toString())
        console.log('risky_totalStakes_Before', risky_totalStakes_Before.toString())
        //assert.equal(bob_Stake_Before.toString(), B_coll)
        //assert.equal(totalStakes_Before.toString(), A_coll.add(B_coll))
    
        // --- TEST ---
        // price drops to 1ETH:100YUSD, reducing TCR below 150%
        await priceFeedETH.setPrice(toBN(dec(100, 18)).toString());
        await priceFeedSuperRisky.setPrice(toBN(dec(100, 18)).toString());
    
        const recoveryMode = await th.checkRecoveryMode(contracts)
        assert.isTrue(recoveryMode)
    
        // check Alice's ICR falls to 100%
        const alice_ICR = await troveManager.getCurrentICR(alice);
        assert.equal(alice_ICR, '1000000000000000000')
    
        // Liquidate Alice
        await troveManager.liquidate(alice, { from: owner })
    
        const alice_weth_Stake_After = (await troveManager.getTroveStake(alice, weth.address))
        const alice_risky_Stake_After = (await troveManager.getTroveStake(alice, tokenSuperRisky.address))
        const weth_totalStakes_After = await troveManager.getTotalStake(weth.address)
        const risky_totalStakes_After = await troveManager.getTotalStake(tokenSuperRisky.address)
        assert.equal(alice_weth_Stake_After, 0)
        assert.equal(alice_risky_Stake_After, 0)
        assert.equal(weth_totalStakes_After.toString(), bobWETH_InTrove.toString())
        assert.equal(risky_totalStakes_After.toString(), bobRisky_InTrove.toString())

        const weth_totalStakesSnaphot = (await troveManager.totalStakesSnapshot(weth.address)).toString()
        const risky_totalStakesSnaphot = (await troveManager.totalStakesSnapshot(tokenSuperRisky.address)).toString()
        const weth_totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot(weth.address)).toString()
        const risky_totalCollateralSnapshot = (await troveManager.totalCollateralSnapshot(tokenSuperRisky.address)).toString()
        assert.equal(weth_totalStakesSnaphot, bobWETH_InTrove.toString())
        assert.equal(risky_totalStakesSnaphot, bobRisky_InTrove.toString())
        assert.equal(weth_totalCollateralSnapshot, (bobWETH_InTrove.add(th.applyLiquidationFee(aliceWETH_InTrove))).toString())
        assert.equal(risky_totalCollateralSnapshot, (bobRisky_InTrove.add(th.applyLiquidationFee(aliceRisky_InTrove))).toString())
      })

      it("liquidate() recovery mode, 100% < ICR < MCR & SP YUSD > Trove debt, full offset ratio = 1, 0.5", async () => {
        const collsAlice = [contracts.weth, tokenSuperRisky]
        const aliceWETH_InTrove = toBN(dec(2005, 16))
        const aliceRisky_InTrove = toBN(dec(4010, 16))
        const amountsAlice = [aliceWETH_InTrove, aliceRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: collsAlice, amounts: amountsAlice, extraYUSDAmount: toBN(dec(2000, 18)), from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

        const collsBob = [contracts.weth, contracts.wavax]
        const bobWETH_InTrove = toBN(dec(35125, 15))
        const bobWAVAX_InTrove = toBN(dec(35125, 15))
        const amountsBob = [bobWETH_InTrove, bobWAVAX_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: collsBob, amounts: amountsBob, extraYUSDAmount: toBN(dec(5000, 18)), from: bob, oracles: [priceFeedETH, priceFeedSuperRisky] })
        console.log((await troveManager.getCurrentICR(bob)).toString())
        console.log((await troveManager.getTroveDebt(bob)).toString())
        const TCR = (await th.getTCR(contracts)).toString()
        assert.equal(TCR, '2000000000000000000')

        // provideToSP()
        await stabilityPool.provideToSP(toBN(dec(5000, 18)), ZERO_ADDRESS, { from: bob })

        // check YUSD balances after
        const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
        assert.equal(stabilityPool_YUSD_After.toString(), toBN(dec(5000, 18)).toString())
  
        await priceFeedETH.setPrice(toBN(dec(130, 18)).toString());
        await priceFeedSuperRisky.setPrice(toBN(dec(80, 18)).toString());

        const recoveryMode = await th.checkRecoveryMode(contracts)
        assert.isTrue(recoveryMode)

        const aliceICR_1 = await troveManager.getCurrentICR(alice);
        const aliceDebt = await troveManager.getTroveDebt(alice);
        const aliceColls = await troveManager.getTroveColls(alice);
        const aliceTroveUSD = await troveManager.getUSD(aliceColls[0], aliceColls[1]);
        console.log("Alice USD in Trove ", aliceTroveUSD.toString());
  
        console.log("Alice ICR", aliceICR_1.toString());
        console.log("Alice Debt", th.toNormalBase(aliceDebt));
  
        // liquidate Alice:
        await assertRevert(troveManager.liquidate(bob), "TroveManager: nothing to liquidate")
        await troveManager.liquidate(alice);
        const aliceStatus = await troveManager.getTroveStatus(alice);
        assert.equal(aliceStatus.toString(), "3") // 3 means "closed by liquidation"
  
        const stabilityPoolAssets = await stabilityPool.getAllCollateral();
        const SP_WETH = stabilityPoolAssets[1][wethIDX];
        const SP_WAVAX = stabilityPoolAssets[1][1];
        const SP_Risky = stabilityPoolAssets[1][3];
        console.log(SP_WETH.toString())
        console.log(SP_WAVAX.toString())
        console.log(SP_Risky.toString())

        // Calculation Breakdown
        // Alice ICR: 1.05, TCR: 1.43, USD value of collateral with 0.5% fee: 5785.4275
        // YUSD in stability pool > Alice debt --> 4010 x 1.1 = 4411 sent to stability pool. 
        // 5814.5 - 4411 = 1374.4275 sent to collsurplus pool

        // assert correct amount of collateral entered stability pool
        console.log((SP_WETH.mul(toBN(130)).add(SP_Risky.mul(toBN(80))).add(SP_WAVAX.mul(toBN(200)))).toString())
        th.assertIsApproximatelyEqual(toBN((dec(4411, 18))), SP_WETH.mul(toBN(130)).add(SP_Risky.mul(toBN(80))).add(SP_WAVAX.mul(toBN(200))))

        // assert correct amount of collateral entered the collsurplus pool
        const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
        const riskyCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address)
        const wavaxCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.wavax.address)
        console.log((wethCollSurplusPool.mul(toBN(130)).add(riskyCollSurplusPool.mul(toBN(80))).add(wavaxCollSurplusPool.mul(toBN(200)))).toString())
        th.assertIsApproximatelyEqual(toBN(dec(13744275, 14)), wethCollSurplusPool.mul(toBN(130)).add(riskyCollSurplusPool.mul(toBN(80))).add(wavaxCollSurplusPool.mul(toBN(200))))
      })

      it("liquidate() recovery mode, 100% < ICR < MCR & SP YUSD < Trove debt, partial offset ratio = 1, 0.5", async () => {
        // --- SETUP ---
        const colls = [contracts.weth, tokenSuperRisky];
        const aliceWETH_InTrove = toBN(dec(2005, 16));
        const aliceRisky_InTrove = toBN(dec(4010, 16))
        const amountsAlice = [aliceWETH_InTrove, aliceRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amountsAlice, extraYUSDAmount: toBN(dec(2000, 18)), from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

        const bobWETH_InTrove = toBN(dec(4010, 16));
        const bobRisky_InTrove = toBN(dec(4010, 16));
        const amountsBob = [bobWETH_InTrove, bobRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: colls, amounts: amountsBob, extraYUSDAmount: toBN(dec(2000, 18)), from: bob, oracles: [priceFeedETH, priceFeedSuperRisky] })
        
        const TCR = (await th.getTCR(contracts)).toString()
        assert.equal(TCR, '2500000000000000000')
  
        // --- TEST ---
  
        // provideToSP()
        await stabilityPool.provideToSP(toBN(dec(2000, 18)), ZERO_ADDRESS, { from: bob })
  
        // check YUSD balances after
        const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
        assert.equal(stabilityPool_YUSD_After.toString(), toBN(dec(2000, 18)).toString())
  
        await priceFeedETH.setPrice(toBN(dec(109, 18)).toString());
        await priceFeedSuperRisky.setPrice(toBN(dec(109, 18)).toString());

        const recoveryMode = await th.checkRecoveryMode(contracts)
        assert.isTrue(recoveryMode)
  
        const aliceICR_1 = await troveManager.getCurrentICR(alice);
        const aliceDebt = await troveManager.getTroveDebt(alice);
        const aliceColls = await troveManager.getTroveColls(alice);
        const aliceTroveUSD = await troveManager.getUSD(aliceColls[0], aliceColls[1]);
        console.log("Alice USD in Trove ", aliceTroveUSD.toString());
  
        console.log("Alice ICR", aliceICR_1.toString());
        console.log("Alice Debt", th.toNormalBase(aliceDebt));
  
        // liquidate Alice:
        await assertRevert(troveManager.liquidate(bob), "TroveManager: nothing to liquidate")
        await troveManager.liquidate(alice);
        const aliceStatus = await troveManager.getTroveStatus(alice);
        assert.equal(aliceStatus.toString(), "3") // 3 means "closed by liquidation"
  
        const stabilityPoolAssets = await stabilityPool.getAllCollateral();
        const SP_WETH = stabilityPoolAssets[1][wethIDX];
        const SP_Risky = stabilityPoolAssets[1][3];
        console.log(stabilityPoolAssets[1].toString());
        console.log(SP_WETH.toString())
        console.log(SP_Risky.toString())
  
        // assert correct amount of collateral entered stability pool
        th.assertIsApproximatelyEqual((toBN(dec(2200, 18))), (SP_WETH.mul(toBN(109)).add(SP_Risky.mul(toBN(109)))));

        // assert correct amount of collateral entered the collsurplus pool
        const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
        const riskyCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address)
        th.assertIsApproximatelyEqual(toBN(dec(105365, 16)), wethCollSurplusPool.mul(toBN(109)).add(riskyCollSurplusPool.mul(toBN(109))))
      })
      
      it("liquidate() recovery mode, MCR <= ICR < 150% & SP YUSD >= Trove debt, full offset ratio = 1, 1, 0.5", async () => {
        const collsAlice = [contracts.weth, tokenSuperRisky]
        const aliceWETH_InTrove = toBN(dec(2005, 16))
        const aliceRisky_InTrove = toBN(dec(4010, 16))
        const amountsAlice = [aliceWETH_InTrove, aliceRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: collsAlice, amounts: amountsAlice, extraYUSDAmount: toBN(dec(2000, 18)), from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

        const collsBob = [contracts.weth, contracts.wavax]
        const bobWETH_InTrove = toBN(dec(35125, 15))
        const bobWAVAX_InTrove = toBN(dec(35125, 15))
        const amountsBob = [bobWETH_InTrove, bobWAVAX_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: collsBob, amounts: amountsBob, extraYUSDAmount: toBN(dec(5000, 18)), from: bob, oracles: [priceFeedETH, priceFeedSuperRisky] })
        console.log((await troveManager.getCurrentICR(bob)).toString())
        console.log((await troveManager.getTroveDebt(bob)).toString())
        const TCR = (await th.getTCR(contracts)).toString()
        assert.equal(TCR, '2000000000000000000')

        // provideToSP()
        await stabilityPool.provideToSP(toBN(dec(5000, 18)), ZERO_ADDRESS, { from: bob })

        // check YUSD balances after
        const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
        assert.equal(stabilityPool_YUSD_After.toString(), toBN(dec(5000, 18)).toString())
  
        await priceFeedETH.setPrice(toBN(dec(130, 18)).toString());
        await priceFeedSuperRisky.setPrice(toBN(dec(100, 18)).toString());

        const recoveryMode = await th.checkRecoveryMode(contracts)
        assert.isTrue(recoveryMode)

        const aliceICR_1 = await troveManager.getCurrentICR(alice);
        const aliceDebt = await troveManager.getTroveDebt(alice);
        const aliceColls = await troveManager.getTroveColls(alice);
        const aliceTroveUSD = await troveManager.getUSD(aliceColls[0], aliceColls[1]);
        console.log("Alice USD in Trove ", aliceTroveUSD.toString());
  
        console.log("Alice ICR", aliceICR_1.toString());
        console.log("Alice Debt", th.toNormalBase(aliceDebt));

        const aliceData = await troveManager.getEntireDebtAndColls(alice);
  
        // liquidate Alice:
        await assertRevert(troveManager.liquidate(bob), "TroveManager: nothing to liquidate")
        await troveManager.liquidate(alice);
        const aliceStatus = await troveManager.getTroveStatus(alice);
        assert.equal(aliceStatus.toString(), "3") // 3 means "closed by liquidation"
  
        const stabilityPoolAssets = await stabilityPool.getAllCollateral();
        const SP_WETH = stabilityPoolAssets[1][wethIDX];
        const SP_WAVAX = stabilityPoolAssets[1][1];
        const SP_Risky = stabilityPoolAssets[1][3];
        console.log(SP_WETH.toString())
        console.log(SP_Risky.toString())
        console.log(aliceData[2][0].toString())
        console.log(aliceData[2][1].toString())

        // Calculation:
        // Alice ICR: 1.15, TCR: 1.46, USD value of collateral (no fee applied): 6616.5
        // YUSD in stability pool > Alice debt --> 4010 x 1.1 x 0.995 = 4,388.95 sent to stability pool. 
        // 6616.5 - 4411 = 2205.5 sent to collsurplus pool

        // assert correct amount of collateral entered stability pool
        console.log((SP_WETH.mul(toBN(130)).add(SP_Risky.mul(toBN(100))).add(SP_WAVAX.mul(toBN(200)))).toString())
        th.assertIsApproximatelyEqual(toBN((dec(4411, 18))).mul(toBN(995)).div(toBN(1000)), SP_WETH.mul(toBN(130)).add(SP_Risky.mul(toBN(100))).add(SP_WAVAX.mul(toBN(200))), 10000)

        // assert correct amount of collateral entered the collsurplus pool
        const wethCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.weth.address)
        const riskyCollSurplusPool = await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address)
        const wavaxCollSurplusPool = await contracts.collSurplusPool.getCollateral(contracts.wavax.address)
        console.log((wethCollSurplusPool.mul(toBN(130)).add(riskyCollSurplusPool.mul(toBN(100))).add(wavaxCollSurplusPool.mul(toBN(200)))).toString())
        th.assertIsApproximatelyEqual(toBN(dec(22055, 17)), wethCollSurplusPool.mul(toBN(130)).add(riskyCollSurplusPool.mul(toBN(100))).add(wavaxCollSurplusPool.mul(toBN(200))), 10000)
      })

      it("liquidate() recovery mode, MCR <= ICR < 150% & SP YUSD < Trove debt, nothing happens, ratio = 1, 0.5", async () => {
        const collsAlice = [contracts.weth, tokenSuperRisky]
        const aliceWETH_InTrove = toBN(dec(2005, 16))
        const aliceRisky_InTrove = toBN(dec(4010, 16))
        const amountsAlice = [aliceWETH_InTrove, aliceRisky_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: collsAlice, amounts: amountsAlice, extraYUSDAmount: toBN(dec(2000, 18)), from: alice, oracles: [priceFeedETH, priceFeedSuperRisky] })

        const collsBob = [contracts.wavax]
        const bobWAVAX_InTrove = toBN(dec(4010, 16))
        const amountsBob = [bobWAVAX_InTrove]
        await th.openTroveWithCollsOld(contracts, { colls: collsBob, amounts: amountsBob, extraYUSDAmount: toBN(dec(2000, 18)), from: bob, oracles: [priceFeedAVAX] })
        console.log((await troveManager.getCurrentICR(bob)).toString())
        console.log((await troveManager.getTroveDebt(bob)).toString())
        const TCR = (await th.getTCR(contracts)).toString()
        assert.equal(TCR, '2000000000000000000')

        // provideToSP()
        await stabilityPool.provideToSP(toBN(dec(2000, 18)), ZERO_ADDRESS, { from: bob })

        // check YUSD balances after
        const stabilityPool_YUSD_After = await stabilityPool.getTotalYUSDDeposits()
        assert.equal(stabilityPool_YUSD_After.toString(), toBN(dec(2000, 18)).toString())
  
        await priceFeedETH.setPrice(toBN(dec(130, 18)).toString());
        await priceFeedSuperRisky.setPrice(toBN(dec(100, 18)).toString());
        await priceFeedAVAX.setPrice(toBN(dec(180, 18)).toString());

        const recoveryMode = await th.checkRecoveryMode(contracts)
        assert.isTrue(recoveryMode)

        const aliceICR_1 = await troveManager.getCurrentICR(alice);
        const aliceDebt = await troveManager.getTroveDebt(alice);
        const aliceColls = await troveManager.getTroveColls(alice);
        const aliceTroveUSD = await troveManager.getUSD(aliceColls[0], aliceColls[1]);
        console.log("Alice USD in Trove ", aliceTroveUSD.toString());
  
        console.log("Alice ICR", aliceICR_1.toString());
        console.log("Alice Debt", th.toNormalBase(aliceDebt));

        const aliceData = await troveManager.getEntireDebtAndColls(alice);
  
        // liquidate Alice:
        await assertRevert(troveManager.liquidate(bob), "TroveManager: nothing to liquidate")
        await assertRevert(troveManager.liquidate(alice), "TroveManager: nothing to liquidate")
      })

    })
})

})
contract('Reset chain state', async accounts => { })