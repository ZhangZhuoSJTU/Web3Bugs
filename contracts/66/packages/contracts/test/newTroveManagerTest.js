const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert
const WAVAX_ADDRESS = ZERO_ADDRESS;

/* NOTE: Some of the borrowing tests do not test for specific YUSD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific YUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 *
 */

contract('newTroveManager', async accounts => {



  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeedAVAX
  let priceFeedETH
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let sYETI
  let yetiToken

  let tokenSuperRisky
  let priceFeedSuperRisky
  let stableCoin
  let priceFeedStableCoin

  let contracts

  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

  let YUSD_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR

  before(async () => {

  })

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()
      contracts = await deploymentHelper.deployYUSDTokenTester(contracts)
      const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      await deploymentHelper.connectYETIContracts(YETIContracts)
      await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
      await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, YETIContracts, owner, users)
      }

      // priceFeed = contracts.priceFeedTestnet
      priceFeedAVAX = contracts.priceFeedAVAX
      priceFeedETH = contracts.priceFeedETH
      yusdToken = contracts.yusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers
      whitelist = contracts.whitelist

      const paramsSuperRisky = {
        name: "Super Risky Token",
        symbol: "T.SR",
        decimals: 18,
        ratio: dec(5, 17) // 50%
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsSuperRisky)
      tokenSuperRisky = result.token
      priceFeedSuperRisky = result.priceFeed

      const paramsStableCoin = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 18,
        ratio: dec(105, 16) // 105%
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
      stableCoin = result.token
      priceFeedStableCoin = result.priceFeed

      sYETI = YETIContracts.sYETI
      yetiToken = YETIContracts.yetiToken
      communityIssuance = YETIContracts.communityIssuance
      lockupContractFactory = YETIContracts.lockupContractFactory

      YUSD_GAS_COMPENSATION = await borrowerOperations.YUSD_GAS_COMPENSATION()
      MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
      BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()
    })

    it("basicliquidation(), basic sanity", async () => {
      // whale creates a Trove and adds first collateral
      let wethToMint = toBN(dec(1000000, 18));
      let wavaxToMint = toBN(dec(1000000, 18));
      // mint weth for Alice and approve borrowerOperations to use it
      let wethMinted = await th.addERC20(contracts.weth, whale, borrowerOperations.address, wethToMint, { from: whale })
      assert.isTrue(wethMinted);

      // mint wavax for Alice and approve borrowerOperations to use it
      let wavaxMinted = await th.addERC20(contracts.wavax, whale, borrowerOperations.address, wavaxToMint, { from: whale })
      assert.isTrue(wavaxMinted);

      let colls = [contracts.weth, contracts.wavax];
      let amounts = [wethToMint, wavaxToMint];

      // console.log("Whale Mints:");
      // console.log(th.toNormalBase(wethToMint), "WETH");
      // console.log(th.toNormalBase(wavaxToMint), "WAVAX");
      // console.log("");
      let priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX];
      await th.openTroveWithColls(contracts, {
        ICR: toBN(dec(2, 18)),
        from: whale, colls: [contracts.weth, contracts.wavax], amounts: amounts, yusdAmount: toBN(dec(2000, 18)), priceFeeds: priceFeeds
      });

      // console.log("");

      // alice creates a Trove and adds collateral
      wethToMint = toBN(dec(1000, 18));
      wavaxToMint = toBN(dec(1000, 18));
      // mint weth for Alice and approve borrowerOperations to use it
      wethMinted = await th.addERC20(contracts.weth, alice, borrowerOperations.address, wethToMint, { from: alice })
      assert.isTrue(wethMinted);

      // mint wavax for Alice and approve borrowerOperations to use it
      wavaxMinted = await th.addERC20(contracts.wavax, alice, borrowerOperations.address, wavaxToMint, { from: alice })
      assert.isTrue(wavaxMinted);

      colls = [contracts.weth, contracts.wavax];
      amounts = [wethToMint, wavaxToMint];

      await th.openTroveWithColls(contracts, {
        ICR: toBN(dec(2, 18)),
        from: alice, colls: colls, amounts: amounts, yusdAmount: toBN(dec(2000, 18)), priceFeeds: priceFeeds
      });

      const troveColls2 = await troveManager.getTroveColls(alice);

      // console.log("Trove Colls:")
      // console.log("Alice Trove Coll Addresses " + troveColls2[0])
      // console.log("WETH in Alice's Trove",  th.toNormalBase(troveColls2[1][0]));
      // console.log("WAVAX in Alice's Trove",  th.toNormalBase(troveColls2[1][1]));
      // console.log("");

      const activePoolWeth = await contracts.weth.balanceOf(activePool.address)
      // console.log("WETH active pool has:", (activePoolWeth.div(toBN(10 ** 18))).toNumber());

      const activePoolWavax = await contracts.wavax.balanceOf(activePool.address)
      // console.log("wavax activepool has:", (activePoolWavax.div(toBN(10 ** 18))).toNumber());

      // console.log("");

      const aliceYUSD = await yusdToken.balanceOf(alice)
      // console.log("yusd MINTED:", (aliceYUSD.div(toBN(10 ** 18))).toNumber());

      const aliceAvax = await contracts.wavax.balanceOf(alice)
      // console.log("wavax alice has:", (aliceAvax.div(toBN(10 ** 18))).toNumber());

      const aliceWeth = await contracts.weth.balanceOf(alice)
      // console.log("weth alice has:", (aliceWeth.div(toBN(10 ** 18))).toNumber());

      const troveDebt = await troveManager.getTroveDebt(alice)
      // console.log("Trove debt: " + troveDebt)

      assert.isTrue(th.toNormalBase(troveDebt) == 4220)

      await priceFeedAVAX.setPrice('200000000000000000000');
      await priceFeedETH.setPrice('200000000000000000000');

      const initICR = await troveManager.getCurrentICR(alice);
      const initVC = await troveManager.getTroveVC(alice);

      // console.log("Initial Debt", th.toNormalBase(troveDebt));
      // console.log("Initial VC", th.toNormalBase(initVC));
      // console.log("Initial ICR", th.toNormalBase(initICR));

      await priceFeedAVAX.setPrice('1200000000000000000');
      await priceFeedETH.setPrice('1200000000000000000');

      const finalICR = await troveManager.getCurrentICR(alice);
      // console.log("Final ICR", th.toNormalBase(finalICR));

      await troveManager.liquidate(alice, { from: owner });
      const status = (await troveManager.getTroveStatus(alice))
      assert.equal(status, 3)  // status enum 3 corresponds to "Closed by liquidation"
    })
    it("redistribution: A, B Open. B Liquidated. C, D Open. D Liquidated. Distributes correct rewards", async () => {

      // A, B open trove
      const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
      const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: bob } })



      // Price drops to 100 $/E
      await priceFeedETH.setPrice(dec(100, 18))

      // Confirm not in Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // L1: B liquidated
      const txB = await troveManager.liquidate(bob)
      assert.isTrue(txB.receipt.status)
      assert.isFalse(await sortedTroves.contains(bob))

      // Price bounces back to 200 $/E
      await priceFeedETH.setPrice(dec(200, 18))



      // C, D open troves
      const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
      const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })

      const wethIDX = await contracts.whitelist.getIndex(contracts.weth.address)
      const test = (await troveManager.getPendingCollRewards(alice))[1][wethIDX];
      // console.log('test: ', test.toString())


      // Price drops to 100 $/E
      await priceFeedETH.setPrice(dec(100, 18))

      // Confirm not in Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // L2: D Liquidated
      const txD = await troveManager.liquidate(dennis)
      assert.isTrue(txB.receipt.status)
      assert.isFalse(await sortedTroves.contains(dennis))


      await priceFeedETH.setPrice(dec(200, 18))
      // // Get entire coll of A and C
      // aliceCTS = (await contracts.troveManager.getEDC(alice))
      // const alice_Coll = (await contracts.troveManager.getVC(aliceCTS[0], aliceCTS[1])).toString()

      // carolCTS = (await contracts.troveManager.getEDC(carol))
      // const carol_Coll = (await contracts.troveManager.getVC(carolCTS[0], carolCTS[1])).toString()



      // Get entire coll of A and C
      const alice_Coll = ((await troveManager.getTroveColls(alice))[1][wethIDX]
        .add((await troveManager.getPendingCollRewards(alice))[1][wethIDX]))
        .toString()
      const carol_Coll = ((await troveManager.getTroveColls(carol))[1][wethIDX]
        .add((await troveManager.getPendingCollRewards(carol))[1][wethIDX]))
        .toString()


      /* Expected collateral:
      A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
      expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH
  
      C: Carol receives ~2/5 ETH from L2
      expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH
  
      Total coll = 4 + 2 * 0.995 ETH
      */
      const A_collAfterL1 = A_coll.add(th.applyLiquidationFee(B_coll))
      assert.isAtMost(th.getDifference(alice_Coll, A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(150, 20)))
      assert.isAtMost(th.getDifference(carol_Coll, C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(100, 20)))



      // const entireSystemColl = Number(await contracts.borrowerOperations.getEntireSystemColl())

      // assert.equal(entireSystemColl, Number(A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))*2*100)

      const entireSystemColl = (await activePool.getCollateral(contracts.weth.address)).add(await defaultPool.getCollateral(contracts.weth.address)).toString()
      assert.equal(entireSystemColl, A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))


      // check YUSD gas compensation
      assert.equal((await yusdToken.balanceOf(owner)).toString(), dec(400, 18))
    })

    it("redeemCollateral() - MultiCollateral: Sanity test for doing one redemption, checks correct amounts.", async () => {

      // Alice creates a Trove and adds first collateral
      let wethToMintAlice = toBN(dec(1000, 18));
      let wavaxToMintAlice = toBN(dec(1000, 18));
      // mint weth for Alice and approve borrowerOperations to use it
      let wethMintedAlice = await th.addERC20(contracts.weth, A, borrowerOperations.address, wethToMintAlice, { from: A })
      assert.isTrue(wethMintedAlice);

      // mint wavax for Alice and approve borrowerOperations to use it
      let wavaxMintedAlice = await th.addERC20(contracts.wavax, A, borrowerOperations.address, wavaxToMintAlice, { from: A })
      assert.isTrue(wavaxMintedAlice);

      let colls = [contracts.weth, contracts.wavax];
      let amountsAlice = [wethToMintAlice, wavaxToMintAlice];

      // console.log("A Mints:");
      // console.log(th.toNormalBase(wethToMintAlice), "WETH");
      // console.log(th.toNormalBase(wavaxToMintAlice), "WAVAX");
      // console.log("");
      let priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX];
      await th.openTroveWithColls(contracts, { from: A, colls: colls, amounts: amountsAlice, extraYUSDAmount: await getOpenTroveYUSDAmount(toBN(dec(6000, 18))), oracles: priceFeeds });

      // Bob creates a Trove and adds first collateral
      let wethToMintBob = toBN(dec(1000, 18));
      let wavaxToMintBob = toBN(dec(1000, 18));
      // mint weth for Bob and approve borrowerOperations to use it
      let wethMintedBob = await th.addERC20(contracts.weth, B, borrowerOperations.address, wethToMintBob, { from: B })
      assert.isTrue(wethMintedBob);

      // mint wavax for Bob and approve borrowerOperations to use it
      let wavaxMintedBob = await th.addERC20(contracts.wavax, B, borrowerOperations.address, wavaxToMintBob, { from: B })
      assert.isTrue(wavaxMintedBob);

      let amountsBob = [wethToMintBob, wavaxToMintBob];

      // console.log("B Mints:");
      // console.log(th.toNormalBase(wethToMintBob), "WETH");
      // console.log(th.toNormalBase(wavaxToMintBob), "WAVAX");
      // console.log("");
      await th.openTroveWithColls(contracts, { from: B, colls: colls, amounts: amountsBob, extraYUSDAmount: await getOpenTroveYUSDAmount(toBN(dec(20000, 18))), oracles: priceFeeds });

      //await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(6000, 18)), A, A, [contracts.weth.address], [dec(1000, 18)], { from: A })
      //await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(1000, 18)], { from: B })

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_WAVAX_Balance_Before = await contracts.wavax.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_WAVAX_Balance_Before)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]
      const B_WAVAX_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[1]
      const B_Coll_Before = B_WETH_Collateral_Before.add(B_WAVAX_Collateral_Before)

      const active_pool_before = (await activePool.getCollateral(contracts.weth.address)).add(await activePool.getCollateral(contracts.wavax.address))

      // YUSD redemption is 5000 YUSD
      const YUSDRedemption = dec(1000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      // console.log("ESTIMATED YUSD", finalYUSDAmount.toString())
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualCollAmount = ((th.getEmittedRedemptionValues(tx1))[4][0]).add((th.getEmittedRedemptionValues(tx1))[4][1])

      assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
      await th.assertIsApproximatelyEqual(actualCollAmount, finalYUSDAmount.div(toBN(200)), 100000)
      assert.isTrue(actualYUSDFee.lt(finalYUSDFeeAmount))

      const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
      const B_debt_after = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
      const A_WAVAX_Balance_After = await contracts.wavax.balanceOf(A)
      const A_Coll_Balance_After = A_WETH_Balance_After.add(A_WAVAX_Balance_After)
      const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]
      const B_WAVAX_Collateral_After = (await th.getTroveEntireColl(contracts, B))[1]
      const B_Coll_After = B_WETH_Collateral_After.add(B_WAVAX_Collateral_After)
      const active_pool_after = (await activePool.getCollateral(contracts.weth.address)).add(await activePool.getCollateral(contracts.wavax.address))

      // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
      await th.assertIsApproximatelyEqual(
        A_YUSD_Balance_After,
        A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(finalYUSDFeeAmount),
        100000)

      // Assert that B's debt has decreased by the correct amount of YUSD
      assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount)))

      // Make sure that A gained an appropriate amount of collateral
      await th.assertIsApproximatelyEqual(
        A_Coll_Balance_After,
        A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200))),
        100000)
      //assert.isTrue(A_Coll_Balance_After.eq(A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))))

      // Make sure that B lost that amount of collateral
      await th.assertIsApproximatelyEqual(
        B_Coll_After,
        B_Coll_Before.sub(finalYUSDAmount.div(th.toBN(200))),
        100000)
      //assert.isTrue(B_Coll_After.eq(B_Coll_Before.sub(finalYUSDAmount.div(th.toBN(200)))))

      // Make sure active pool has decreased by the correct amount of WETH
      await th.assertIsApproximatelyEqual(
        active_pool_after,
        active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))),
        100000)
      //assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(200)))))
    })

    it("redeemCollateral() - MultiCollateral: redeems trove with one collateral first, a trove with multiple collaterals second, and partially redeems third trove with one collateral", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(9999, 18)], { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), C, C, [contracts.weth.address], [dec(50, 18)], { from: C })

      // Dennis creates a Trove and adds first collateral
      let wethToMintDennis = toBN(dec(25, 18));
      let wavaxToMintDennis = toBN(dec(25, 18));
      // mint weth for Dennis and approve borrowerOperations to use it
      let wethMintedDennis = await th.addERC20(contracts.weth, D, borrowerOperations.address, wethToMintDennis, { from: D })
      assert.isTrue(wethMintedDennis);

      // mint wavax for Dennis and approve borrowerOperations to use it
      let wavaxMintedDennis = await th.addERC20(contracts.wavax, D, borrowerOperations.address, wavaxToMintDennis, { from: D })
      assert.isTrue(wavaxMintedDennis);

      let amountsDennis = [wethToMintDennis, wavaxToMintDennis];
      let colls = [contracts.weth, contracts.wavax];
      let priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX];
      await th.openTroveWithColls(contracts, { from: D, colls: colls, amounts: amountsDennis, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_WAVAX_Balance_Before = await contracts.wavax.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_WAVAX_Balance_Before)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_before = (await activePool.getCollateral(contracts.weth.address)).add(await activePool.getCollateral(contracts.wavax.address))

      // YUSD redemption is 6000 YUSD. Should close C, D and take some of B.
      const YUSDRedemption = dec(6000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]
      const actualAVAXAmount = (th.getEmittedRedemptionValues(tx1))[4][1]
      const actualCollAmount = actualETHAmount.add(actualAVAXAmount)
      // console.log('actual avax', actualAVAXAmount.toString())
      // console.log('actual eth', actualETHAmount.toString())

      assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
      // console.log('actual', actualCollAmount.toString())
      // console.log('yusdamount', (finalYUSDAmount.div(toBN(200))).toString())
      //await th.assertIsApproximatelyEqual(actualCollAmount, (finalYUSDAmount.div(toBN(200))))
      assert.isTrue(actualCollAmount.eq(finalYUSDAmount.div(toBN(200))))
      assert.isTrue(actualYUSDFee.lt(finalYUSDFeeAmount))

      assert.isTrue(await sortedTroves.contains(A))
      assert.isTrue(await sortedTroves.contains(B))
      assert.isFalse(await sortedTroves.contains(C))
      assert.isFalse(await sortedTroves.contains(D))

      const collSurplusPoolAfter = (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).add(await contracts.collSurplusPool.getCollateral(contracts.wavax.address))
      // console.log('eth surplus after', (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).toString())
      // console.log('avax surplus after', (await contracts.collSurplusPool.getCollateral(contracts.wavax.address)).toString())
      assert.isTrue(collSurplusPoolAfter.eq(th.toBN(dec(82, 18))))
      const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
      const B_debt_after = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
      const A_WAVAX_Balance_After = await contracts.wavax.balanceOf(A)
      const A_Coll_Balance_After = A_WETH_Balance_After.add(A_WAVAX_Balance_After)
      const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_after = await activePool.getCollateral(contracts.weth.address)

      // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
      await th.assertIsApproximatelyEqual(
        A_YUSD_Balance_After,
        A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(finalYUSDFeeAmount),
        100000)

      // Assert that B's debt has decreased by the correct amount of YUSD. 1800 * 2 offset from other troves.
      // console.log('B debt after', B_debt_after.toString())
      // console.log('B debt before', (B_debt_before.sub(finalYUSDAmount).add(toBN(dec(3600, 18)))).toString())
      //assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount).add(toBN(dec(3600, 18)))))
      await th.assertIsApproximatelyEqual(
        B_debt_after,
        B_debt_before.sub(finalYUSDAmount).add(toBN(dec(3600, 18))),
        100000)

      // Make sure that A gained an appropriate amount of collateral
      // console.log('A coll after', A_Coll_Balance_After.toString())
      // console.log('A coll before', (A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))).toString())
      //assert.isTrue(A_Coll_Balance_After.eq(A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))))
      await th.assertIsApproximatelyEqual(
        A_Coll_Balance_After,
        A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200))),
        100000)

      // Make sure that B lost that amount of collateral. Total collateral offset with 13.5 eth and 4.5 avax from other troves.
      //assert.isTrue(B_WETH_Collateral_After.eq(B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200))).add(toBN(dec(18, 18)))))
      await th.assertIsApproximatelyEqual(
        B_WETH_Collateral_After,
        B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200))).add(toBN(dec(18, 18))),
        100000)

      // Make sure active pool has decreased by the correct amount of WETH
      //assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))).sub(toBN(dec(82, 18)))))
      await th.assertIsApproximatelyEqual(
        active_pool_after,
        active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))).sub(toBN(dec(82, 18))),
        100000)
    })

    it("redeemCollateral() - MultiCollateral: different weth to wavax ratio for trove D", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(9999, 18)], { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(4000, 18)), C, C, [contracts.weth.address], [dec(50, 18)], { from: C })

      // Dennis creates a Trove and adds first collateral
      let wethToMintDennis = toBN(dec(40, 18));
      let wavaxToMintDennis = toBN(dec(10, 18));
      // mint weth for Dennis and approve borrowerOperations to use it
      let wethMintedDennis = await th.addERC20(contracts.weth, D, borrowerOperations.address, wethToMintDennis, { from: D })
      assert.isTrue(wethMintedDennis);

      // mint wavax for Dennis and approve borrowerOperations to use it
      let wavaxMintedDennis = await th.addERC20(contracts.wavax, D, borrowerOperations.address, wavaxToMintDennis, { from: D })
      assert.isTrue(wavaxMintedDennis);

      let amountsDennis = [wethToMintDennis, wavaxToMintDennis];
      let colls = [contracts.weth, contracts.wavax];
      let priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX];
      await th.openTroveWithColls(contracts, { from: D, colls: colls, amounts: amountsDennis, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_WAVAX_Balance_Before = await contracts.wavax.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_WAVAX_Balance_Before)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_before = (await activePool.getCollateral(contracts.weth.address)).add(await activePool.getCollateral(contracts.wavax.address))

      // YUSD redemption is 8000 YUSD. Should close D, C and take some of B.
      const YUSDRedemption = dec(8000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      // console.log("finalYUSDAMOUNT", finalYUSDAmount.toString())
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]
      const actualAVAXAmount = (th.getEmittedRedemptionValues(tx1))[4][1]
      const actualCollAmount = actualETHAmount.add(actualAVAXAmount)
      // console.log('actual avax', actualAVAXAmount.toString())
      // console.log('actual eth', actualETHAmount.toString())

      assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
      // console.log('actual', actualCollAmount.toString())
      // console.log('yusdamount', (finalYUSDAmount.div(toBN(200))).toString())
      //await th.assertIsApproximatelyEqual(actualCollAmount, (finalYUSDAmount.div(toBN(200))))
      assert.isTrue(actualCollAmount.eq(finalYUSDAmount.div(toBN(200))))
      assert.isTrue(actualYUSDFee.lt(finalYUSDFeeAmount))

      assert.isTrue(await sortedTroves.contains(A))
      assert.isTrue(await sortedTroves.contains(B))
      assert.isFalse(await sortedTroves.contains(C))
      assert.isFalse(await sortedTroves.contains(D))

      const collSurplusPoolAfter = (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).add(await contracts.collSurplusPool.getCollateral(contracts.wavax.address))
      // console.log('eth surplus after', (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).toString())
      // console.log('avax surplus after', (await contracts.collSurplusPool.getCollateral(contracts.wavax.address)).toString())
      assert.isTrue(collSurplusPoolAfter.eq(th.toBN(dec(72, 18)))) // 50 + 50 - 9 - 19 = 72
      const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
      const B_debt_after = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
      const A_WAVAX_Balance_After = await contracts.wavax.balanceOf(A)
      const A_Coll_Balance_After = A_WETH_Balance_After.add(A_WAVAX_Balance_After)
      const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_after = await activePool.getCollateral(contracts.weth.address)

      // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
      await th.assertIsApproximatelyEqual(
        A_YUSD_Balance_After,
        A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(finalYUSDFeeAmount),
        100000)

      // Assert that B's debt has decreased by the correct amount of YUSD. 1800 + 3800 offset from other troves.
      // console.log('B debt after', B_debt_after.toString())
      // console.log('B debt before', (B_debt_before.sub(finalYUSDAmount).add(toBN(dec(5600, 18)))).toString())
      //assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount).add(toBN(dec(3600, 18)))))
      await th.assertIsApproximatelyEqual(
        B_debt_after,
        B_debt_before.sub(finalYUSDAmount).add(toBN(dec(5600, 18))),
        100000)

      // Make sure that A gained an appropriate amount of collateral
      // console.log('A coll after', A_Coll_Balance_After.toString())
      // console.log('A coll before', (A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))).toString())
      //assert.isTrue(A_Coll_Balance_After.eq(A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))))
      await th.assertIsApproximatelyEqual(
        A_Coll_Balance_After,
        A_Coll_Balance_Before.add(finalYUSDAmount.div(th.toBN(200))),
        100000)

      // Make sure that B lost that amount of collateral. Total collateral offset with 18 eth from other troves.
      //assert.isTrue(B_WETH_Collateral_After.eq(B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200))).add(toBN(dec(18, 18)))))
      await th.assertIsApproximatelyEqual(
        B_WETH_Collateral_After,
        B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200))).add(toBN(dec(28, 18))),
        100000)

      // Make sure active pool has decreased by the correct amount of WETH
      //assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))).sub(toBN(dec(82, 18)))))
      await th.assertIsApproximatelyEqual(
        active_pool_after,
        active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))).sub(toBN(dec(72, 18))),
        100000)

      //Trove A reedems 1800 YUSD from trove D, which has 10 WAVAX and 40 ETH. Trove A's WAVAX balance = 1.8 WAVAX = (1800 YUSD x (10 WAVAX / 50 WAVAX/WETH))/200
      assert(A_WAVAX_Balance_After.eq(toBN(dec(18, 17))))
    })

    it("redeemCollateral() - MultiCollateral: perform two separate redemptions, check if two troves positions update, check if final ICR's are correct", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(10000, 18)], { from: B })

      // Carol creates a Trove and adds first collateral
      let wethToMintCarol = toBN(dec(30, 18));
      let wavaxToMintCarol = toBN(dec(20, 18));
      // mint weth for Carol and approve borrowerOperations to use it
      let wethMintedCarol = await th.addERC20(contracts.weth, C, borrowerOperations.address, wethToMintCarol, { from: C })
      assert.isTrue(wethMintedCarol);

      // mint wavax for Carol and approve borrowerOperations to use it
      let wavaxMintedCarol = await th.addERC20(contracts.wavax, C, borrowerOperations.address, wavaxToMintCarol, { from: C })
      assert.isTrue(wavaxMintedCarol);

      let amountsCarol = [wethToMintCarol, wavaxToMintCarol];
      let colls = [contracts.weth, contracts.wavax];
      let priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX];
      await th.openTroveWithColls(contracts, { from: C, colls: colls, YUSDAmount: await getOpenTroveYUSDAmount(dec(3000, 18)), amounts: amountsCarol, priceFeeds: priceFeeds });

      // Dennis creates a Trove and adds first collateral
      let wethToMintDennis = toBN(dec(40, 18));
      let wavaxToMintDennis = toBN(dec(10, 18));
      // mint weth for Dennis and approve borrowerOperations to use it
      let wethMintedDennis = await th.addERC20(contracts.weth, D, borrowerOperations.address, wethToMintDennis, { from: D })
      assert.isTrue(wethMintedDennis);

      // mint wavax for Dennis and approve borrowerOperations to use it
      let wavaxMintedDennis = await th.addERC20(contracts.wavax, D, borrowerOperations.address, wavaxToMintDennis, { from: D })
      assert.isTrue(wavaxMintedDennis);

      let amountsDennis = [wethToMintDennis, wavaxToMintDennis];
      await th.openTroveWithColls(contracts, { from: D, colls: colls, YUSDAmount: await getOpenTroveYUSDAmount(dec(4000, 18)), amounts: amountsDennis, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      // YUSD redemption is 2000 YUSD. Shouldn't fully redeem any troves.
      const YUSDRedemption = dec(2000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      //check if debt and collat of trove D are correct after partial redemption
      const D_totalColl = ((await th.getTroveEntireColl(contracts, D))[0]).add((await th.getTroveEntireColl(contracts, D))[1]).mul(toBN(200))
      const D_totalDebt = (await th.getTroveEntireDebt(contracts, D))
      assert(D_totalDebt.eq(toBN(dec(4000, 18)).sub(finalYUSDAmount)))
      await th.assertIsApproximatelyEqual(
        D_totalColl,
        toBN(dec(10000, 18)).sub(finalYUSDAmount),
        100000)

      const YUSDRedemption2 = dec(1000, 18)
      const finalYUSDAmount2 = await th.estimateYUSDEligible(contracts, YUSDRedemption2)
      const tx2 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption2, th._100pct)
      assert.isTrue(tx2.receipt.status)

      //check if debt and collat of trove C are correct after partial redemption
      const C_totalColl = ((await th.getTroveEntireColl(contracts, C))[0]).add((await th.getTroveEntireColl(contracts, C))[1]).mul(toBN(200))
      const C_totalDebt = (await th.getTroveEntireDebt(contracts, C))
      assert(C_totalDebt.eq(toBN(dec(3000, 18)).sub(finalYUSDAmount2)))
      await th.assertIsApproximatelyEqual(
        C_totalColl,
        toBN(dec(10000, 18)).sub(finalYUSDAmount2),
        100000)

      //check trove D's collateral and debt are unchanged
      assert(D_totalDebt.eq(toBN(dec(4000, 18)).sub(finalYUSDAmount)))
      await th.assertIsApproximatelyEqual(
        D_totalColl,
        toBN(dec(10000, 18)).sub(finalYUSDAmount),
        100000)
    })

    it("redeemCollateral() - MultiCollateral: fully redeem trove C with riskytoken and weth, partially redeem trove B", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(10000, 18)], { from: B })
      // Carol creates a Trove and adds first collateral
      let tokenRiskyMintCarol = toBN(dec(16, 18));
      let wethToMintCarol = toBN(dec(20, 18));

      const newRiskyTokenPrice = toBN(dec(100, 18))
      await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)
      // mint tokenRisky for Carol and approve borrowerOperations to use it
      let tokenRiskyMinted = await th.addERC20(tokenSuperRisky, C, borrowerOperations.address, tokenRiskyMintCarol, { from: C })
      assert.isTrue(tokenRiskyMinted);

      // mint weth for Carol and approve borrowerOperations to use it
      let wethMintedCarol = await th.addERC20(contracts.weth, C, borrowerOperations.address, wethToMintCarol, { from: C })
      assert.isTrue(wethMintedCarol);

      let amountsCarol = [wethToMintCarol, tokenRiskyMintCarol];
      let colls = [contracts.weth, tokenSuperRisky];
      let priceFeeds = [contracts.priceFeedETH, priceFeedSuperRisky];
      await th.openTroveWithColls(contracts, { from: C, colls: colls, YUSDAmount: await getOpenTroveYUSDAmount(dec(3000, 18)), amounts: amountsCarol, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_RISKY_Balance_Before = await tokenSuperRisky.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_RISKY_Balance_Before)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_before = (await activePool.getCollateral(contracts.weth.address)).add(await activePool.getCollateral(tokenSuperRisky.address))

      // YUSD redemption is 3000 YUSD.
      const YUSDRedemption = dec(3000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      // console.log("finalYUSDAMOUNT", finalYUSDAmount.toString())
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]
      const actualRISKYAmount = (th.getEmittedRedemptionValues(tx1))[4][1]
      const actualCollAmount = actualETHAmount.add(actualRISKYAmount)
      // console.log('actual risky token', actualRISKYAmount.toString())
      // console.log('actual eth', actualETHAmount.toString())

      //checks that the correct amount of risky tokens were liquidated:
      // 3000 YUSD - gascomp = 2800 YUSD -> (2800 YUSD debt / 5600 YUSD collat) x Amount of Risky tokens = 8
      // Trove A redeems 2888.538 YUSD. Fully redeems Trove C. Partially redeems Trove B's ETH (~88.538 YUSD in ETH)
      assert.isTrue(actualRISKYAmount.eq(toBN(dec(8, 18))))
      const ETHinYUSD = actualETHAmount.mul(toBN(200))
      const RISKYinYUSD = actualRISKYAmount.mul(toBN(100))
      // console.log(ETHinYUSD.toString())
      // console.log(finalYUSDAmount.sub(RISKYinYUSD).toString())

      //check if ETH redeemed equals total YUSD redeemed - risky token redeemed
      await th.assertIsApproximatelyEqual(
        ETHinYUSD,
        finalYUSDAmount.sub(RISKYinYUSD),
        100000)
      const collSurplusPoolAfter = (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).add(await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address))
      // console.log('eth surplus after', (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).toString())
      // console.log('risky token surplus after', (await contracts.collSurplusPool.getCollateral(tokenSuperRisky.address)).toString())
      assert.isTrue(collSurplusPoolAfter.eq(th.toBN(dec(18, 18)))) // 36 total tokens - 8 risky tokens - 10 weth tokens
    })

    it("redeemCollateral() - MultiCollateral: fully redeem trove C with stablecoin and weth, partially redeem trove B", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(10000, 18)], { from: B })
      // Carol creates a Trove and adds first collateral
      let stableToMintCarol = toBN(dec(1600, 18));
      let wethToMintCarol = toBN(dec(20, 18));

      await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
      // mint stablecoin for Carol and approve borrowerOperations to use it
      let tokenStableMinted = await th.addERC20(stableCoin, C, borrowerOperations.address, stableToMintCarol, { from: C })
      assert.isTrue(tokenStableMinted);

      // mint weth for Carol and approve borrowerOperations to use it
      let wethMintedCarol = await th.addERC20(contracts.weth, C, borrowerOperations.address, wethToMintCarol, { from: C })
      assert.isTrue(wethMintedCarol);

      let amountsCarol = [wethToMintCarol, stableToMintCarol];
      let colls = [contracts.weth, stableCoin];
      let priceFeeds = [contracts.priceFeedETH, priceFeedStableCoin];
      await th.openTroveWithColls(contracts, { from: C, colls: colls, YUSDAmount: await getOpenTroveYUSDAmount(dec(3000, 18)), amounts: amountsCarol, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_STABLE_Balance_Before = await tokenSuperRisky.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_STABLE_Balance_Before)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_before = (await activePool.getCollateral(contracts.weth.address)).add(await activePool.getCollateral(stableCoin.address))

      // YUSD redemption is 3000 YUSD.
      const YUSDRedemption = dec(3000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      // console.log("finalYUSDAMOUNT", finalYUSDAmount.toString())
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]
      const actualSTABLEAmount = (th.getEmittedRedemptionValues(tx1))[4][1]
      const actualCollAmount = actualETHAmount.add(actualSTABLEAmount)
      // console.log('actual stable coin', actualSTABLEAmount.toString())
      // console.log('actual eth', actualETHAmount.toString())

      //checks that the correct amount of stable coins were liquidated:
      // 3000 YUSD - gascomp = 2800 YUSD -> (2800 YUSD debt / 5600 YUSD collat) x Amount of Risky tokens = 8
      // Trove A redeems 2888.538 YUSD. Fully redeems Trove C. Partially redeems Trove B's ETH (~88.538 YUSD in ETH)
      assert(actualSTABLEAmount.eq(toBN(dec(800, 18))))
      const ETHinYUSD = actualETHAmount.mul(toBN(200))
      // console.log(ETHinYUSD.toString())
      // console.log(finalYUSDAmount.sub(actualSTABLEAmount).toString())

      //check if ETH redeemed equals total YUSD redeemed - stable coin redeemed
      await th.assertIsApproximatelyEqual(
        ETHinYUSD,
        finalYUSDAmount.sub(actualSTABLEAmount),
        100000)
      const collSurplusPoolAfter = (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).add(await contracts.collSurplusPool.getCollateral(stableCoin.address))
      // console.log('eth surplus after', (await contracts.collSurplusPool.getCollateral(contracts.weth.address)).toString())
      // console.log('stable coin surplus after', (await contracts.collSurplusPool.getCollateral(stableCoin.address)).toString())
      assert.isTrue(collSurplusPoolAfter.eq(th.toBN(dec(810, 18)))) // 1620 total tokens - 800 stable coins - 10 weth tokens
    })

    it("redeemCollateral() - MultiCollateral: partially redeem trove C with riskytoken stablecoin and weth", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(10000, 18)], { from: B })
      // Carol creates a Trove and adds first collateral
      let tokenRiskyMintCarol = toBN(dec(16, 18));
      let wethToMintCarol = toBN(dec(20, 18));
      let stableToMintCarol = toBN(dec(1000, 18))

      //sets prices of stable coin and riskytoken
      const newRiskyTokenPrice = toBN(dec(100, 18))
      await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)
      await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))

      // mint tokenRisky for Carol and approve borrowerOperations to use it
      let tokenRiskyMinted = await th.addERC20(tokenSuperRisky, C, borrowerOperations.address, tokenRiskyMintCarol, { from: C })
      assert.isTrue(tokenRiskyMinted);

      // mint stable coin for Carol and approve borrowerOperations to use it
      let stableCoinMinted = await th.addERC20(stableCoin, C, borrowerOperations.address, stableToMintCarol, { from: C })
      assert.isTrue(stableCoinMinted);

      // mint weth for Carol and approve borrowerOperations to use it
      let wethMintedCarol = await th.addERC20(contracts.weth, C, borrowerOperations.address, wethToMintCarol, { from: C })
      assert.isTrue(wethMintedCarol);

      let amountsCarol = [wethToMintCarol, tokenRiskyMintCarol, stableToMintCarol];
      let colls = [contracts.weth, tokenSuperRisky, stableCoin];
      let priceFeeds = [contracts.priceFeedETH, priceFeedSuperRisky, priceFeedStableCoin];
      await th.openTroveWithColls(contracts, { from: C, colls: colls, YUSDAmount: await getOpenTroveYUSDAmount(dec(5150, 18)), amounts: amountsCarol, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_RISKY_Balance_Before = await tokenSuperRisky.balanceOf(A)
      const A_STABLE_Balance_Before = await stableCoin.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_RISKY_Balance_Before).add(A_STABLE_Balance_Before)

      // YUSD redemption is 1320 YUSD
      const YUSDRedemption = toBN(dec(1320, 18))
      const tx1 = await th.performRedemptionWithMaxFeeAmount(A, contracts, YUSDRedemption, YUSDRedemption)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]
      const actualRISKYAmount = (th.getEmittedRedemptionValues(tx1))[4][1]
      const actualSTABLEAmount = (th.getEmittedRedemptionValues(tx1))[4][2]

      // console.log('actual risky token', actualRISKYAmount.toString())
      // console.log('actual eth', actualETHAmount.toString())
      // console.log('actual stable', actualSTABLEAmount.toString())

      //checks that the correct amount of risky tokens were redeemed:
      // (1320 YUSD debt / 6600 YUSD collat) = 0.2
      // 0.2 x 16 risky tokens = 3.2 risky redeemed && 0.2 x 1000 stable tokens = 200 stable redeemed && 0.2 x 20 weth = 4 weth redeemed
      assert(actualRISKYAmount.eq(toBN(dec(32, 17))))
      assert(actualSTABLEAmount.eq(toBN(dec(200, 18))))
      assert(actualETHAmount.eq(toBN(dec(4, 18))))
    })

    it("redeemCollateral() - MultiCollateral: redeems trove C with riskytoken stablecoin and weth TWICE", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(10000, 18)], { from: B })
      // Carol creates a Trove and adds first collateral
      let tokenRiskyMintCarol = toBN(dec(16, 18));
      let wethToMintCarol = toBN(dec(20, 18));
      let stableToMintCarol = toBN(dec(1000, 18))

      //sets prices of stable coin and riskytoken
      const newRiskyTokenPrice = toBN(dec(100, 18))
      await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)
      await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))

      // mint tokenRisky for Carol and approve borrowerOperations to use it
      let tokenRiskyMinted = await th.addERC20(tokenSuperRisky, C, borrowerOperations.address, tokenRiskyMintCarol, { from: C })
      assert.isTrue(tokenRiskyMinted);

      // mint stable coin for Carol and approve borrowerOperations to use it
      let stableCoinMinted = await th.addERC20(stableCoin, C, borrowerOperations.address, stableToMintCarol, { from: C })
      assert.isTrue(stableCoinMinted);

      // mint weth for Carol and approve borrowerOperations to use it
      let wethMintedCarol = await th.addERC20(contracts.weth, C, borrowerOperations.address, wethToMintCarol, { from: C })
      assert.isTrue(wethMintedCarol);

      let amountsCarol = [wethToMintCarol, tokenRiskyMintCarol, stableToMintCarol];
      let colls = [contracts.weth, tokenSuperRisky, stableCoin];
      let priceFeeds = [contracts.priceFeedETH, priceFeedSuperRisky, priceFeedStableCoin];
      await th.openTroveWithColls(contracts, { from: C, colls: colls, YUSDAmount: await getOpenTroveYUSDAmount(dec(5150, 18)), amounts: amountsCarol, priceFeeds: priceFeeds });

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const A_RISKY_Balance_Before = await tokenSuperRisky.balanceOf(A)
      const A_STABLE_Balance_Before = await stableCoin.balanceOf(A)
      const A_Coll_Balance_Before = A_WETH_Balance_Before.add(A_RISKY_Balance_Before).add(A_STABLE_Balance_Before)

      // YUSD redemption is 1320 YUSD
      const YUSDRedemption = toBN(dec(1320, 18))
      const tx1 = await th.performRedemptionWithMaxFeeAmount(A, contracts, YUSDRedemption, YUSDRedemption)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]
      const actualRISKYAmount = (th.getEmittedRedemptionValues(tx1))[4][1]
      const actualSTABLEAmount = (th.getEmittedRedemptionValues(tx1))[4][2]

      // console.log('actual risky token', actualRISKYAmount.toString())
      // console.log('actual eth', actualETHAmount.toString())
      // console.log('actual stable', actualSTABLEAmount.toString())

      //checks that the correct amount of risky tokens were redeemed:
      // (1320 YUSD debt / 6600 YUSD collat) = 0.2
      // 0.2 x 16 risky tokens = 3.2 risky redeemed && 0.2 x 1000 stable tokens = 200 stable redeemed && 0.2 x 20 weth = 4 weth redeemed
      assert(actualRISKYAmount.eq(toBN(dec(32, 17))))
      assert(actualSTABLEAmount.eq(toBN(dec(200, 18))))
      assert(actualETHAmount.eq(toBN(dec(4, 18))))

      const YUSDRedemption2 = toBN(dec(1320, 18))
      const tx2 = await th.performRedemptionWithMaxFeeAmount(A, contracts, YUSDRedemption2, YUSDRedemption2)
      assert.isTrue(tx2.receipt.status)
      const actualETHAmount2 = (th.getEmittedRedemptionValues(tx2))[4][0]
      const actualRISKYAmount2 = (th.getEmittedRedemptionValues(tx2))[4][1]
      const actualSTABLEAmount2 = (th.getEmittedRedemptionValues(tx2))[4][2]
      // console.log('actual risky second redemption', actualRISKYAmount2.toString())
      // console.log('actual eth second redemption', actualETHAmount2.toString())
      // console.log('actual stable second redemption', actualSTABLEAmount2.toString())

      assert.isTrue((await tokenSuperRisky.balanceOf(A)).eq(toBN(dec(64, 17))))
      assert.isTrue((await stableCoin.balanceOf(A)).eq(toBN(dec(400, 18))))

    })

    it("updateTroves(): When only one trove is updated it keeps the old icr values correctly. Multi Collateral. Other operations also work with trove manager update function", async function () {
      await makeTrovesInSequence()
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)
      await assertSortedListIsOrdered(contracts)

      // Update price of risky and assert A in correct position

      priceFeedSuperRisky.setPrice(toBN(dec(100, 18)))
      await troveManager.updateTroves([B], [A], [E])
      await assertSortedListIsOrdered(contracts)
      assert.isTrue((await sortedTroves.getOldICR(B)).eq(await troveManager.getCurrentICR(B)))

      // Withdraw collateral of trove C. C should be in correct position
      let wethMinted = await th.addERC20(contracts.weth, C, borrowerOperations.address, toBN(dec(1, 30)), { from: C })
      assert.isTrue(wethMinted);
      wethMinted = await th.addERC20(stableCoin, C, borrowerOperations.address, toBN(dec(1, 30)), { from: C })
      assert.isTrue(wethMinted);
      await borrowerOperations.adjustTrove([contracts.weth.address, stableCoin.address], [toBN(dec(1, 18)), toBN(dec(1000, 18))], [], [], 0, false, alice, alice, th._100pct, { from: C })
      assert.isTrue((await sortedTroves.getOldICR(C)).eq(await troveManager.getCurrentICR(C)))
      await assertSortedListIsOrdered(contracts)

      // Open new trove F and assert it is in the correct position.

      await th.openTroveWithColls(contracts, {
        ICR: toBN(dec(300, 16)),
        colls: [contracts.weth, stableCoin], amounts: [toBN(dec(2000, 18)), toBN(dec(500, 18))], from: F
      })
      assert.isTrue((await sortedTroves.getOldICR(F)).eq(await troveManager.getCurrentICR(F)))
      await assertSortedListIsOrdered(contracts)

      // Adjust trove C multiple ways and assert it is in the correct position TODO
      // await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 18))], [stableCoin.address, tokenSuperRisky], [toBN(dec(1000, 18)), toBN(dec(50, 18))], toBN(dec(8000, 18)), true, alice, alice, th._100pct, { from: C })
      // assert.isTrue((await sortedTroves.getOldICR(C)).eq(await troveManager.getCurrentICR(C)))
      // await assertSortedListIsOrdered(contracts)

      // Redeem troves and assert that that trove has been updated properly in the list.
      const bottomBeforeRedemption = await contracts.sortedTroves.getLast()
      const ICRBefore = await troveManager.getCurrentICR(bottomBeforeRedemption)
      const YUSDRedemption = dec(8000, 18)

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      assert.isTrue((await sortedTroves.getOldICR(bottomBeforeRedemption)).eq(await troveManager.getCurrentICR(bottomBeforeRedemption)))
      assert.isTrue(ICRBefore.lt(await troveManager.getCurrentICR(bottomBeforeRedemption)))
      await assertSortedListIsOrdered(contracts)

    })

  }
  describe('Without proxy', async () => {
    testCorpus({ withProxy: false })
  })

  // Sequentially add coll and withdraw YUSD, 1 account at a time
  const makeTrovesInSequence = async () => {
    // const makeTrovesInSequence = async () => {

    await contracts.priceFeedETH.setPrice(dec(100, 18))
    await contracts.priceFeedAVAX.setPrice(dec(50, 18))
    await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
    await priceFeedSuperRisky.setPrice(toBN(dec(200, 18)))
    const allColls = [contracts.weth, contracts.wavax, stableCoin, tokenSuperRisky]
    const allAmounts =
      [toBN(dec(2000, 18)),  // price = 100. Ratio = 1. Collateral amount = 200. Value = 200 * 1 * 100 = 200000
      toBN(dec(4000, 18)),   // price = 50. Ratio = 1. Collateral amount = 400. Value = 400 * 1 * 50 = 200000
      toBN(dec(200000, 18)).mul(toBN(dec(1, 18))).div(toBN(dec(105, 16))),   // price = 1. Ratio = 1.05. Collateral amount = 200000 / 1.05
      toBN(dec(200000, 18)).mul(toBN(dec(1, 36))).div(toBN(dec(75, 16))).div(toBN(dec(200, 18)))]   // price = 200. Ratio = 0.75. Collateral amount = 200000 / 200 / 0.75 = 100 / 0.75

    const whaleColls = [contracts.weth, contracts.wavax]
    const whaleAmounts = [allAmounts[0], allAmounts[1]]
    const AColls = [contracts.weth, stableCoin]
    const AAmounts = [allAmounts[0], allAmounts[2]]
    const BColls = [contracts.weth, tokenSuperRisky]
    const BAmounts = [allAmounts[0], allAmounts[3]]
    const CColls = [stableCoin, tokenSuperRisky]
    const CAmounts = [allAmounts[2], allAmounts[3]]
    const DColls = [contracts.wavax, tokenSuperRisky]
    const DAmounts = [allAmounts[1], allAmounts[3]]
    const EColls = [contracts.wavax, stableCoin]
    const EAmounts = [allAmounts[1], allAmounts[2]]

    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(500, 16)),
      colls: whaleColls, amounts: whaleAmounts, from: whale
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(300, 16)),
      colls: AColls, amounts: AAmounts, from: A
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(250, 16)),
      colls: BColls, amounts: BAmounts, from: B
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(200, 16)),
      colls: CColls, amounts: CAmounts, from: C
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(160, 16)),
      colls: DColls, amounts: DAmounts, from: D
    })
    await th.openTroveWithColls(contracts, {
      ICR: toBN(dec(125, 16)),
      colls: EColls, amounts: EAmounts, from: E
    })
  }

  const assertSortedListIsOrdered = async (contracts) => {
    //const price = await contracts.priceFeedTestnet.getPrice()

    let trove = await contracts.sortedTroves.getLast()
    while (trove !== (await contracts.sortedTroves.getFirst())) {

      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(trove)

      const troveOldICR = await contracts.sortedTroves.getOldICR(trove) //contracts.troveManager.getCurrentICR(trove)
      const prevTroveOldICR = await contracts.sortedTroves.getOldICR(prevTrove) //contracts.troveManager.getCurrentICR(prevTrove)

      assert.isTrue(prevTroveOldICR.gte(troveOldICR))

      // climb the list
      trove = prevTrove
    }
  }

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => { })