const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 * 
 */ 
contract('TroveManager', async accounts => {
  const wethIDX = 0
  const _18_zeros = '000000000000000000'
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
    A, B, C, D, E] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers
  let troveManagerRedemptions

  let contracts

  const getOpenTroveTotalDebt = async (yusdAmount) => th.getOpenTroveTotalDebt(contracts, yusdAmount)
  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const withdrawYUSD = async (params) => th.withdrawYUSD(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.yusdToken = await YUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const YETIContracts = await deploymentHelper.deployYETIContracts(bountyAddress, lpRewardsAddress, multisig)
    
    priceFeed = contracts.priceFeedETH

    yusdToken = contracts.yusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    troveManagerRedemptions = contracts.troveManagerRedemptions
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    weth = contracts.weth

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)
  })

  it('liquidate(): closes a Trove that has ICR < MCR', async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    console.log("Alice Wallet:", alice);

    console.log("TroveManagerTest: troves opened");

    const ICR_Before = await troveManager.getCurrentICR(alice)
    assert.equal(ICR_Before.toString(), dec(4, 18))

    const MCR = (await troveManager.MCR()).toString()
    assert.equal(MCR.toString(), '1100000000000000000')

    // Alice increases debt to 180 YUSD, lowering her ICR to 1.11
    const A_YUSDWithdrawal = await getNetBorrowingAmount(dec(130, 18))

    const targetICR = toBN('1111111111111111111')
    await withdrawYUSD({ ICR: targetICR, extraParams: { from: alice } })

    const ICR_AfterWithdrawal = await troveManager.getCurrentICR(alice)
    assert.isAtMost(th.getDifference(ICR_AfterWithdrawal, targetICR), 100)

    // price drops to 1ETH:100YUSD, reducing Alice's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Trove
    await troveManager.liquidate(alice, { from: owner });

    // check the Trove is successfully closed, and removed from sortedList
    const status = (await troveManager.getTroveStatus(alice))
    assert.equal(status, 3)  // status enum 3 corresponds to "Closed by liquidation"
    const alice_Trove_isInSortedList = await sortedTroves.contains(alice)
    assert.isFalse(alice_Trove_isInSortedList)
  })

  it("liquidate(): decreases ActivePool ETH and YUSDDebt by correct amounts", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check ActivePool ETH and YUSD debt before
    const activePool_ETH_Before = (await activePool.getCollateral(weth.address)).toString()
    const activePool_RawEther_Before = (await weth.balanceOf(activePool.address)).toString()
    const activePool_YUSDDebt_Before = (await activePool.getYUSDDebt()).toString()

    assert.equal(activePool_ETH_Before, A_collateral.add(B_collateral))
    assert.equal(activePool_RawEther_Before, A_collateral.add(B_collateral))
    th.assertIsApproximatelyEqual(activePool_YUSDDebt_Before, A_totalDebt.add(B_totalDebt))

    // price drops to 1ETH:100YUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    /* close Bob's Trove. Should liquidate his ether and YUSD, 
    leaving Alice’s ether and YUSD debt in the ActivePool. */
    await troveManager.liquidate(bob, { from: owner });

    // check ActivePool ETH and YUSD debt 
    const activePool_ETH_After = (await activePool.getCollateral(weth.address)).toString()
    const activePool_RawEther_After = (await weth.balanceOf(activePool.address)).toString()
    const activePool_YUSDDebt_After = (await activePool.getYUSDDebt()).toString()

    assert.equal(activePool_ETH_After, A_collateral)
    assert.equal(activePool_RawEther_After, A_collateral)
    th.assertIsApproximatelyEqual(activePool_YUSDDebt_After, A_totalDebt)
  })

  it("liquidate(): increases DefaultPool ETH and YUSD debt by correct amounts", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    
    // --- TEST ---

    // check DefaultPool ETH and YUSD debt before
    const defaultPool_ETH_Before = (await defaultPool.getCollateral(weth.address))
    const defaultPool_RawEther_Before = (await weth.balanceOf(defaultPool.address)).toString()
    const defaultPool_YUSDDebt_Before = (await defaultPool.getYUSDDebt()).toString()

    assert.equal(defaultPool_ETH_Before, '0')
    assert.equal(defaultPool_RawEther_Before, '0')
    assert.equal(defaultPool_YUSDDebt_Before, '0')

    console.log("Before Works");

    // price drops to 1ETH:100YUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Bob's Trove
    await troveManager.liquidate(bob, { from: owner });

    // check after
    const defaultPool_ETH_After = (await defaultPool.getCollateral(weth.address)).toString()
    const defaultPool_RawEther_After = (await weth.balanceOf(defaultPool.address)).toString()
    const defaultPool_YUSDDebt_After = (await defaultPool.getYUSDDebt()).toString()

    const defaultPool_ETH = (th.applyLiquidationFee(B_collateral)).toString()

    console.log("default POol ETH balance after", defaultPool_ETH_After);
    console.log("default POol raw ETH balance after", defaultPool_RawEther_After);
    console.log("defaultpool ETH expected", defaultPool_ETH);

    assert.equal(defaultPool_ETH_After, defaultPool_ETH)
    assert.equal(defaultPool_RawEther_After, defaultPool_ETH)
    th.assertIsApproximatelyEqual(defaultPool_YUSDDebt_After, B_totalDebt)
  })

  it("liquidate(): removes the Trove's stake from the total stakes", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check totalStakes before
    const totalStakes_Before = (await troveManager.getTotalStakes(weth.address)).toString()
    assert.equal(totalStakes_Before, A_collateral.add(B_collateral))

    // price drops to 1ETH:100YUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Close Bob's Trove
    await troveManager.liquidate(bob, { from: owner });

    // check totalStakes after
    const totalStakes_After = (await troveManager.getTotalStakes(weth.address)).toString()
    assert.equal(totalStakes_After, A_collateral)
  })

  it("liquidate(): Removes the correct trove from the TroveOwners array, and moves the last array element to the new empty slot", async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(214, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(212, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // At this stage, TroveOwners array should be: [W, A, B, C, D, E] 

    // Drop price
    await priceFeed.setPrice(dec(100, 18))

    const arrayLength_Before = await troveManager.getTroveOwnersCount()
    assert.equal(arrayLength_Before, 6)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate carol
    await troveManager.liquidate(carol)

    // Check Carol no longer has an active trove
    assert.isFalse(await sortedTroves.contains(carol))

    // Check length of array has decreased by 1
    const arrayLength_After = await troveManager.getTroveOwnersCount()
    assert.equal(arrayLength_After, 5)

    /* After Carol is removed from array, the last element (Erin's address) should have been moved to fill 
    the empty slot left by Carol, and the array length decreased by one.  The final TroveOwners array should be:
  
    [W, A, B, E, D] 

    Check all remaining troves in the array are in the correct order */
    const trove_0 = await troveManager.TroveOwners(0)
    const trove_1 = await troveManager.TroveOwners(1)
    const trove_2 = await troveManager.TroveOwners(2)
    const trove_3 = await troveManager.TroveOwners(3)
    const trove_4 = await troveManager.TroveOwners(4)

    assert.equal(trove_0, whale)
    assert.equal(trove_1, alice)
    assert.equal(trove_2, bob)
    assert.equal(trove_3, erin)
    assert.equal(trove_4, dennis)

    // Check correct indices recorded on the active trove structs
    const whale_arrayIndex = (await troveManager.getTroveIndex(whale))
    const alice_arrayIndex = (await troveManager.getTroveIndex(alice))
    const bob_arrayIndex = (await troveManager.getTroveIndex(bob))
    const dennis_arrayIndex = (await troveManager.getTroveIndex(dennis))
    const erin_arrayIndex = (await troveManager.getTroveIndex(erin))


    // [W, A, B, E, D] 
    assert.equal(whale_arrayIndex, 0)
    assert.equal(alice_arrayIndex, 1)
    assert.equal(bob_arrayIndex, 2)
    assert.equal(erin_arrayIndex, 3)
    assert.equal(dennis_arrayIndex, 4)
  })

  it("liquidate(): updates the snapshots of total stakes and total collateral", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    // --- TEST ---

    // check snapshots before 
    const totalStakesSnapshot_Before = (await troveManager.totalStakesSnapshot(weth.address)).toString()
    const totalCollateralSnapshot_Before = (await troveManager.totalCollateralSnapshot(weth.address)).toString()
    assert.equal(totalStakesSnapshot_Before, '0')
    assert.equal(totalCollateralSnapshot_Before, '0')

    // price drops to 1ETH:100YUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Bob's Trove.  His ether*0.995 and YUSD should be added to the DefaultPool.
    await troveManager.liquidate(bob, { from: owner });

    /* check snapshots after. Total stakes should be equal to the  remaining stake then the system: 
    10 ether, Alice's stake.
     
    Total collateral should be equal to Alice's collateral plus her pending ETH reward (Bob’s collaterale*0.995 ether), earned
    from the liquidation of Bob's Trove */
    const totalStakesSnapshot_After = (await troveManager.totalStakesSnapshot(weth.address)).toString()
    const totalCollateralSnapshot_After = (await troveManager.totalCollateralSnapshot(weth.address)).toString()

    assert.equal(totalStakesSnapshot_After, A_collateral)
    assert.equal(totalCollateralSnapshot_After, A_collateral.add(th.applyLiquidationFee(B_collateral)))
  })

  it("liquidate(): updates the L_ETH and L_YUSDDebt reward-per-unit-staked totals", async () => {
    // --- SETUP ---
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    const { collateral: C_collateral, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(111, 16)), extraParams: { from: carol } })

    // --- TEST ---

    // price drops to 1ETH:100YUSD, reducing Carols's ICR below MCR
    await priceFeed.setPrice('100000000000000000000');

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // close Carol's Trove.  
    assert.isTrue(await sortedTroves.contains(carol));
    await troveManager.liquidate(carol, { from: owner });
    assert.isFalse(await sortedTroves.contains(carol));

    // Carol's ether*0.995 and YUSD should be added to the DefaultPool.
    const L_ETH_AfterCarolLiquidated = await troveManager.L_Coll(weth.address)
    const L_YUSDDebt_AfterCarolLiquidated = await troveManager.L_YUSDDebt(weth.address)

    const L_ETH_expected_1 = th.applyLiquidationFee(C_collateral).mul(mv._1e18BN).div(A_collateral.add(B_collateral))
    const L_YUSDDebt_expected_1 = C_totalDebt.mul(mv._1e18BN).div(A_collateral.add(B_collateral))
    assert.isAtMost(th.getDifference(L_ETH_AfterCarolLiquidated, L_ETH_expected_1), 100)
    assert.isAtMost(th.getDifference(L_YUSDDebt_AfterCarolLiquidated, L_YUSDDebt_expected_1), 100)

    console.log("about to wthdraw for bob");
    // Bob now withdraws YUSD, bringing his ICR to 1.11
    const { increasedTotalDebt: B_increasedTotalDebt } = await withdrawYUSD({ ICR: toBN(dec(111, 16)), extraParams: { from: bob } })
    console.log("withdrew for bob");
    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // price drops to 1ETH:50YUSD, reducing Bob's ICR below MCR
    await priceFeed.setPrice(dec(50, 18));
    const price = await priceFeed.getPrice()

    // close Bob's Trove 
    assert.isTrue(await sortedTroves.contains(bob))
    await troveManager.liquidate(bob, { from: owner });
    assert.isFalse(await sortedTroves.contains(bob))

    /* Alice now has all the active stake. totalStakes in the system is now 10 ether.
   
   Bob's pending collateral reward and debt reward are applied to his Trove
   before his liquidation.
   His total collateral*0.995 and debt are then added to the DefaultPool. 
   
   The system rewards-per-unit-staked should now be:
   
   L_ETH = (0.995 / 20) + (10.4975*0.995  / 10) = 1.09425125 ETH
   L_YUSDDebt = (180 / 20) + (890 / 10) = 98 YUSD */
    const L_ETH_AfterBobLiquidated = await troveManager.L_Coll(weth.address)
    const L_YUSDDebt_AfterBobLiquidated = await troveManager.L_YUSDDebt(weth.address)

    const L_ETH_expected_2 = L_ETH_expected_1.add(th.applyLiquidationFee(B_collateral.add(B_collateral.mul(L_ETH_expected_1).div(mv._1e18BN))).mul(mv._1e18BN).div(A_collateral))
    const L_YUSDDebt_expected_2 = L_YUSDDebt_expected_1.add(B_totalDebt.add(B_increasedTotalDebt).add(B_collateral.mul(L_YUSDDebt_expected_1).div(mv._1e18BN)).mul(mv._1e18BN).div(A_collateral))
    console.log("a", L_YUSDDebt_AfterBobLiquidated.toString())
    console.log("b", L_YUSDDebt_expected_2.toString())
    assert.isAtMost(th.getDifference(L_ETH_AfterBobLiquidated, L_ETH_expected_2), 100)
    assert.isAtMost(th.getDifference(L_YUSDDebt_AfterBobLiquidated, L_YUSDDebt_expected_2), 100)
  })


  xit("liquidate(): Liquidates undercollateralized trove if there are two troves in the system", async () => {
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: bob, value: dec(100, 'ether') } })

    // Alice creates a single trove with 0.7 ETH and a debt of 70 YUSD, and provides 10 YUSD to SP
    const { collateral: A_collateral, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

    // Alice proves 10 YUSD to SP
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, { from: alice })

    // Set ETH:USD price to 105
    await priceFeed.setPrice('105000000000000000000')

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const alice_ICR = (await troveManager.getCurrentICR(alice)).toString()
    assert.equal(alice_ICR, '1050000000000000000')

    const activeTrovesCount_Before = await troveManager.getTroveOwnersCount()

    assert.equal(activeTrovesCount_Before, 2)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate the trove
    await troveManager.liquidate(alice, { from: owner })

    // Check Alice's trove is removed, and bob remains
    const activeTrovesCount_After = await troveManager.getTroveOwnersCount()
    assert.equal(activeTrovesCount_After, 1)

    const alice_isInSortedList = await sortedTroves.contains(alice)
    assert.isFalse(alice_isInSortedList)

    const bob_isInSortedList = await sortedTroves.contains(bob)
    assert.isTrue(bob_isInSortedList)
  })

  it("liquidate(): reverts if trove is non-existent", async () => {
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(21, 17)), extraParams: { from: bob } })

    assert.equal(await troveManager.getTroveStatus(carol), 0) // check trove non-existent

    assert.isFalse(await sortedTroves.contains(carol))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    try {
      const txCarol = await troveManager.liquidate(carol)

      assert.isFalse(txCarol.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "trove must exist")
    }
  })

  it("liquidate(): reverts if trove has been closed", async () => {
    await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    assert.isTrue(await sortedTroves.contains(carol))

    // price drops, Carol ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Carol liquidated, and her trove is closed
    const txCarol_L1 = await troveManager.liquidate(carol)
    assert.isTrue(txCarol_L1.receipt.status)

    assert.isFalse(await sortedTroves.contains(carol))

    assert.equal(await troveManager.getTroveStatus(carol), 3)  // check trove closed by liquidation

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    try {
      const txCarol_L2 = await troveManager.liquidate(carol)

      assert.isFalse(txCarol_L2.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "trove must exist")
    }
  })

  it("liquidate(): does nothing if trove has >= 110% ICR", async () => {
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedTroves.getSize()).toString()

    // Check Bob's ICR > 110%
    const bob_ICR = await troveManager.getCurrentICR(bob)
    assert.isTrue(bob_ICR.gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate bob
    await assertRevert(troveManager.liquidate(bob), "TroveManager: nothing to liquidate")

    // Check bob active, check whale active
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(whale)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedTroves.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  it("liquidate(): Given the same price and no other trove changes, complete Pool offsets restore the TCR to its value prior to the defaulters opening troves", async () => {
    // Whale provides YUSD to SP
    const spDeposit = toBN(dec(100, 24))
    await openTrove({ ICR: toBN(dec(4, 18)), extraYUSDAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    const TCR_Before = (await th.getTCR(contracts)).toString()

    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    // Price drop
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // All defaulters liquidated
    await troveManager.liquidate(defaulter_1)
    assert.isFalse((await sortedTroves.contains(defaulter_1)))

    await troveManager.liquidate(defaulter_2)
    assert.isFalse((await sortedTroves.contains(defaulter_2)))

    await troveManager.liquidate(defaulter_3)
    assert.isFalse((await sortedTroves.contains(defaulter_3)))

    await troveManager.liquidate(defaulter_4)
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // Price bounces back
    await priceFeed.setPrice(dec(200, 18))

    const TCR_After = (await th.getTCR(contracts)).toString()
    assert.equal(TCR_Before, TCR_After)
  })


  it("liquidate(): Pool offsets increase the TCR", async () => {
    // Whale provides YUSD to SP
    const spDeposit = toBN(dec(100, 24))
    await openTrove({ ICR: toBN(dec(4, 18)), extraYUSDAmount: spDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))

    const TCR_1 = await th.getTCR(contracts)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Check TCR improves with each liquidation that is offset with Pool
    await troveManager.liquidate(defaulter_1)
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    const TCR_2 = await th.getTCR(contracts)
    assert.isTrue(TCR_2.gte(TCR_1))

    await troveManager.liquidate(defaulter_2)
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    const TCR_3 = await th.getTCR(contracts)
    assert.isTrue(TCR_3.gte(TCR_2))

    await troveManager.liquidate(defaulter_3)
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    const TCR_4 = await th.getTCR(contracts)
    assert.isTrue(TCR_4.gte(TCR_4))

    await troveManager.liquidate(defaulter_4)
    assert.isFalse((await sortedTroves.contains(defaulter_4)))
    const TCR_5 = await th.getTCR(contracts)
    assert.isTrue(TCR_5.gte(TCR_5))
  })

  it("liquidate(): a pure redistribution reduces the TCR only as a result of compensation", async () => {
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(70, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    await priceFeed.setPrice(dec(100, 18))

    const TCR_0 = await th.getTCR(contracts)
    const adjust20 = toBN(10**20);

    const entireSystemCollBefore = (await troveManager.getEntireSystemColl()).div(toBN(100))
    const entireSystemDebtBefore = await troveManager.getEntireSystemDebt()

    const expectedTCR_0 = entireSystemCollBefore.mul(adjust20).div(entireSystemDebtBefore);

    assert.isTrue(expectedTCR_0.eq(TCR_0))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Check TCR does not decrease with each liquidation 
    const liquidationTx_1 = await troveManager.liquidate(defaulter_1)
    const gasComp_1 = th.getEmittedLiquidationValuesMulti(liquidationTx_1)[5][0]
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    const TCR_1 = await th.getTCR(contracts)

    console.log("finished liquidation 1");
    // Expect only change to TCR to be due to the issued gas compensation
    const expectedTCR_1 = (entireSystemCollBefore
      .sub(gasComp_1))
      .mul(adjust20)
      .div(entireSystemDebtBefore)
    assert.isTrue(expectedTCR_1.eq(TCR_1))    
    const liquidationTx_2 = await troveManager.liquidate(defaulter_2)
    const gasComp_2 = th.getEmittedLiquidationValuesMulti(liquidationTx_2)[5][0]
    assert.isFalse((await sortedTroves.contains(defaulter_2)))

    const TCR_2 = await th.getTCR(contracts)

    const expectedTCR_2 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2))
      .mul(adjust20)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_2.eq(TCR_2))

    const liquidationTx_3 = await troveManager.liquidate(defaulter_3)
    const gasComp_3 = th.getEmittedLiquidationValuesMulti(liquidationTx_3)[5][0]
    assert.isFalse((await sortedTroves.contains(defaulter_3)))

    const TCR_3 = await th.getTCR(contracts)

    const expectedTCR_3 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3))
      .mul(adjust20)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_3.eq(TCR_3))


    const liquidationTx_4 = await troveManager.liquidate(defaulter_4)
    const gasComp_4 = th.getEmittedLiquidationValuesMulti(liquidationTx_4)[5][0]
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    const TCR_4 = await th.getTCR(contracts)

    const expectedTCR_4 = (entireSystemCollBefore
      .sub(gasComp_1)
      .sub(gasComp_2)
      .sub(gasComp_3)
      .sub(gasComp_4))
      .mul(adjust20)
      .div(entireSystemDebtBefore)

    assert.isTrue(expectedTCR_4.eq(TCR_4))
  })

  it("liquidate(): does not affect the SP deposit or ETH gain when called on an SP depositor's address that has no trove", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const spDeposit = toBN(dec(1, 24))
    await openTrove({ ICR: toBN(dec(3, 18)), extraYUSDAmount: spDeposit, extraParams: { from: bob } })
    const { C_totalDebt, C_collateral } = await openTrove({ ICR: toBN(dec(218, 16)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    // Bob sends tokens to Dennis, who has no trove
    await yusdToken.transfer(dennis, spDeposit, { from: bob })

    //Dennis provides YUSD to SP
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: dennis })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await troveManager.liquidate(carol)
    const liquidatedDebt = th.getEmittedLiquidationValuesMulti(liquidationTX_C)[0]
    const liquidatedColl = th.getEmittedLiquidationValuesMulti(liquidationTX_C)[3][0]
    assert.isFalse(await sortedTroves.contains(carol))
    // Check Dennis' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const dennis_Deposit_Before = (await stabilityPool.getCompoundedYUSDDeposit(dennis)).toString()
    const dennis_ETHGain_Before = (await stabilityPool.getDepositorGains(dennis))[1][0].toString()
    assert.isAtMost(th.getDifference(dennis_Deposit_Before, spDeposit.sub(liquidatedDebt)), 1000000)
    assert.isAtMost(th.getDifference(dennis_ETHGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate Dennis
    try {
      const txDennis = await troveManager.liquidate(dennis)
      assert.isFalse(txDennis.receipt.status)
    } catch (err) {
      assert.include(err.message, "revert")
      assert.include(err.message, "trove must exist")
    }

    // Check Dennis' SP deposit does not change after liquidation attempt
    const dennis_Deposit_After = (await stabilityPool.getCompoundedYUSDDeposit(dennis)).toString()
    const dennis_ETHGain_After = (await stabilityPool.getDepositorGains(dennis))[1][0].toString()
    assert.equal(dennis_Deposit_Before, dennis_Deposit_After)
    assert.equal(dennis_ETHGain_Before, dennis_ETHGain_After)
  })

  it("liquidate(): does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or ETH gain", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const spDeposit = toBN(dec(1, 24))
    await openTrove({ ICR: toBN(dec(3, 18)), extraYUSDAmount: spDeposit, extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(218, 16)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    //Bob provides YUSD to SP
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    const liquidationTX_C = await troveManager.liquidate(carol)
    const liquidatedDebt = th.getEmittedLiquidationValuesMulti(liquidationTX_C)[0]
    const liquidatedColl = th.getEmittedLiquidationValuesMulti(liquidationTX_C)[3][0]
    assert.isFalse(await sortedTroves.contains(carol))

    // price bounces back - Bob's trove is >110% ICR again
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()
    assert.isTrue((await troveManager.getCurrentICR(bob)).gt(mv._MCR))
    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = (await stabilityPool.getCompoundedYUSDDeposit(bob)).toString()
    const bob_ETHGain_Before = (await stabilityPool.getDepositorGains(bob))[1][0]
    assert.isAtMost(th.getDifference(bob_Deposit_Before, spDeposit.sub(liquidatedDebt)), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, liquidatedColl), 1000)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt to liquidate Bob
    await assertRevert(troveManager.liquidate(bob), "TroveManager: nothing to liquidate")

    // Confirm Bob's trove is still active
    assert.isTrue(await sortedTroves.contains(bob))

    // Check Bob' SP deposit does not change after liquidation attempt
    const bob_Deposit_After = (await stabilityPool.getCompoundedYUSDDeposit(bob)).toString()
    const bob_ETHGain_After = (await stabilityPool.getDepositorGains(bob))[1][0].toString()
    assert.equal(bob_Deposit_Before, bob_Deposit_After)
    assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
  })

  it("liquidate(): liquidates a SP depositor's trove with ICR < 110%, and the liquidation correctly impacts their SP deposit and ETH gain", async () => {
    const A_spDeposit = toBN(dec(3, 24))
    const B_spDeposit = toBN(dec(1, 24))
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(8, 18)), extraYUSDAmount: A_spDeposit, extraParams: { from: alice } })
    const { collateral: B_collateral, totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(218, 16)), extraYUSDAmount: B_spDeposit, extraParams: { from: bob } })
    const { collateral: C_collateral, totalDebt: C_debt } = await openTrove({ ICR: toBN(dec(210, 16)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    //Bob provides YUSD to SP
    await stabilityPool.provideToSP(B_spDeposit, ZERO_ADDRESS, { from: bob })

    // Carol gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(carol)

    // Check Bob' SP deposit has absorbed Carol's debt, and he has received her liquidated ETH
    const bob_Deposit_Before = await stabilityPool.getCompoundedYUSDDeposit(bob)
    const bob_ETHGain_Before = (await stabilityPool.getDepositorGains(bob))[1][wethIDX]
    assert.isAtMost(th.getDifference(bob_Deposit_Before, B_spDeposit.sub(C_debt)), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_Before, th.applyLiquidationFee(C_collateral)), 1000)

    // Alice provides YUSD to SP
    await stabilityPool.provideToSP(A_spDeposit, ZERO_ADDRESS, { from: alice })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate Bob
    await troveManager.liquidate(bob)

    // Confirm Bob's trove has been closed
    assert.isFalse(await sortedTroves.contains(bob))
    const bob_Trove_Status = ((await troveManager.getTroveStatus(bob))).toString()
    assert.equal(bob_Trove_Status, 3) // check closed by liquidation

    /* Alice's YUSD Loss = (300 / 400) * 200 = 150 YUSD
       Alice's ETH gain = (300 / 400) * 2*0.995 = 1.4925 ETH

       Bob's YUSDLoss = (100 / 400) * 200 = 50 YUSD
       Bob's ETH gain = (100 / 400) * 2*0.995 = 0.4975 ETH

     Check Bob' SP deposit has been reduced to 50 YUSD, and his ETH gain has increased to 1.5 ETH. */
    const alice_Deposit_After = (await stabilityPool.getCompoundedYUSDDeposit(alice)).toString()
    const alice_ETHGain_After = ((await stabilityPool.getDepositorGains(alice))[1][wethIDX]).toString()

    const totalDeposits = bob_Deposit_Before.add(A_spDeposit)

    assert.isAtMost(th.getDifference(alice_Deposit_After, A_spDeposit.sub(B_debt.mul(A_spDeposit).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(alice_ETHGain_After, th.applyLiquidationFee(B_collateral).mul(A_spDeposit).div(totalDeposits)), 1000000)

    const bob_Deposit_After = await stabilityPool.getCompoundedYUSDDeposit(bob)
    const bob_ETHGain_After = (await stabilityPool.getDepositorGains(bob))[1][wethIDX]

    assert.isAtMost(th.getDifference(bob_Deposit_After, bob_Deposit_Before.sub(B_debt.mul(bob_Deposit_Before).div(totalDeposits))), 1000000)
    assert.isAtMost(th.getDifference(bob_ETHGain_After, bob_ETHGain_Before.add(th.applyLiquidationFee(B_collateral).mul(bob_Deposit_Before).div(totalDeposits))), 1000000)
  })

  it("liquidate(): does not alter the liquidated user's token balance", async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    const { yusdAmount: A_yusdAmount } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: toBN(dec(300, 18)), extraParams: { from: alice } })
    const { yusdAmount: B_yusdAmount } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: toBN(dec(200, 18)), extraParams: { from: bob } })
    const { yusdAmount: C_yusdAmount } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(100, 18))

    // Check sortedList size
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate A, B and C
    const activeYUSDDebt_0 = await activePool.getYUSDDebt()
    const defaultYUSDDebt_0 = await defaultPool.getYUSDDebt()

    await troveManager.liquidate(alice)
    const activeYUSDDebt_A = await activePool.getYUSDDebt()
    const defaultYUSDDebt_A = await defaultPool.getYUSDDebt()

    await troveManager.liquidate(bob)
    const activeYUSDDebt_B = await activePool.getYUSDDebt()
    const defaultYUSDDebt_B = await defaultPool.getYUSDDebt()

    await troveManager.liquidate(carol)

    // Confirm A, B, C closed
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Check sortedList size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    // Confirm token balances have not changed
    assert.equal((await yusdToken.balanceOf(alice)).toString(), A_yusdAmount)
    assert.equal((await yusdToken.balanceOf(bob)).toString(), B_yusdAmount)
    assert.equal((await yusdToken.balanceOf(carol)).toString(), C_yusdAmount)
  })

  it("liquidate(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(8, 18)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: carol } })

    // Defaulter opens with 60 YUSD, 0.6 ETH
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await troveManager.getCurrentICR(alice)
    const bob_ICR_Before = await troveManager.getCurrentICR(bob)
    const carol_ICR_Before = await troveManager.getCurrentICR(carol)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 50) = 400%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    /* Liquidate defaulter. 30 YUSD and 0.3 ETH is distributed between A, B and C.

    A receives (30 * 2/4) = 15 YUSD, and (0.3*2/4) = 0.15 ETH
    B receives (30 * 1/4) = 7.5 YUSD, and (0.3*1/4) = 0.075 ETH
    C receives (30 * 1/4) = 7.5 YUSD, and (0.3*1/4) = 0.075 ETH
    */
    await troveManager.liquidate(defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(alice)
    const bob_ICR_After = await troveManager.getCurrentICR(bob)
    const carol_ICR_After = await troveManager.getCurrentICR(carol)

    /* After liquidation: 

    Alice ICR: (10.15 * 100 / 60) = 183.33%
    Bob ICR:(1.075 * 100 / 98) =  109.69%
    Carol ICR: (1.075 *100 /  107.5 ) = 100.0%

    Check Alice is above MCR, Bob below, Carol below. */


    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, 
    check that Bob's raw coll and debt has not changed, and that his "raw" ICR is above the MCR */
    const bob_Coll = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const bob_Debt = await troveManager.getTroveDebt(bob)

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate Alice, Bob, Carol
    await assertRevert(troveManager.liquidate(alice), "TroveManager: nothing to liquidate")
    await troveManager.liquidate(bob)
    await troveManager.liquidate(carol)

    /* Check Alice stays active, Carol gets liquidated, and Bob gets liquidated 
   (because his pending rewards bring his ICR < MCR) */
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Check trove statuses - A active (1),  B and C liquidated (3)
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '1')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '3')
  })

  it("liquidate(): when SP > 0, triggers YETI reward event - increases the sum G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves 
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalYUSDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100YUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate trove
    await troveManager.liquidate(defaulter_1)
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the YETI reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("liquidate(): when SP is empty, doesn't update G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves 
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: defaulter_1 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalYUSDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100YUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // liquidate trove
    await troveManager.liquidate(defaulter_1)
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- batchLiquidateTroves() ---

  it('batchLiquidateTroves(): liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
    // A, B, C, D, E open troves
    await openTrove({ ICR: toBN(dec(333, 16)), extraParams: { from: D } })
    await openTrove({ ICR: toBN(dec(333, 16)), extraParams: { from: E } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    // Price drops
    await priceFeed.setPrice(dec(175, 18))
    let price = await priceFeed.getPrice()
    
    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // A gets liquidated, creates pending rewards for all
    const liqTxA = await troveManager.liquidate(A)
    assert.isTrue(liqTxA.receipt.status)
    assert.isFalse(await sortedTroves.contains(A))

    // A adds 10 YUSD to the SP, but less than C's debt
    await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, {from: A})

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    price = await priceFeed.getPrice()
    // Confirm system is now in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))

    // Confirm C has ICR > TCR
    const TCR = await troveManager.getTCR()
    const ICR_C = await troveManager.getCurrentICR(C)
  
    assert.isTrue(ICR_C.gt(TCR))

    // Attempt to liquidate B and C, which skips C in the liquidation since it is immune
    //const liqTxBC = await troveManager.liquidateTroves(2)
    //assert.isTrue(liqTxBC.receipt.status)
    await troveManager.liquidate(B, { from: owner })
    await assertRevert(troveManager.liquidate(C, { from: owner }), "TroveManager: nothing to liquidate")
    assert.isFalse(await sortedTroves.contains(B))
    assert.isTrue(await sortedTroves.contains(C))
    assert.isTrue(await sortedTroves.contains(D))
    assert.isTrue(await sortedTroves.contains(E))

    // // All remaining troves D and E repay a little debt, applying their pending rewards
    assert.isTrue((await sortedTroves.getSize()).eq(toBN('3')))
    await borrowerOperations.repayYUSD(dec(1, 18), D, D, {from: D})
    await borrowerOperations.repayYUSD(dec(1, 18), E, E, {from: E})

    // Check C is the only trove that has pending rewards
    assert.isTrue(await troveManager.hasPendingRewards(C))
    assert.isFalse(await troveManager.hasPendingRewards(D))
    assert.isFalse(await troveManager.hasPendingRewards(E))

    // Check C's pending coll and debt rewards are <= the coll and debt in the DefaultPool
    const pendingETH_C = (await troveManager.getPendingCollRewards(C))[1][wethIDX]
    const pendingYUSDDebt_C = await troveManager.getPendingYUSDDebtReward(C)
    const defaultPoolETH = await defaultPool.getCollateral(weth.address)
    const defaultPoolYUSDDebt = await defaultPool.getYUSDDebt()
    assert.isTrue(pendingETH_C.lte(defaultPoolETH))
    assert.isTrue(pendingYUSDDebt_C.lte(defaultPoolYUSDDebt))
    //Check only difference is dust
    assert.isAtMost(th.getDifference(pendingETH_C, defaultPoolETH), 1000)
    assert.isAtMost(th.getDifference(pendingYUSDDebt_C, defaultPoolYUSDDebt), 1000)

    // Confirm system is still in Recovery Mode
    assert.isTrue(await th.checkRecoveryMode(contracts))

    // D and E fill the Stability Pool, enough to completely absorb C's debt of 70
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, {from: D})
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, {from: E})

    await priceFeed.setPrice(dec(50, 18))

    // Try to liquidate C again. Check it succeeds and closes C's trove
    //const liqTx2 = await troveManager.liquidateTroves(2)
    //assert.isTrue(liqTx2.receipt.status)
    await troveManager.liquidate(C, { from: owner })
    assert.isFalse(await sortedTroves.contains(C))
    assert.isTrue(await sortedTroves.contains(D))
    assert.isTrue(await sortedTroves.contains(E))
    assert.isTrue((await sortedTroves.getSize()).eq(toBN('2')))
  })

  it('batchLiquidateTroves(): closes every Trove with ICR < MCR, when n > number of undercollateralized troves', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // create 5 Troves with varying ICRs
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: flyn } })

    // G,H, I open high-ICR troves
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: graham } })
    await openTrove({ ICR: toBN(dec(90, 18)), extraParams: { from: harriet } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: ida } })

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing Bob and Carol's ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin)).lte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(flyn)).lte(mv._MCR))

    // Confirm troves G, H, I are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(graham)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(harriet)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(ida)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale)).gte(mv._MCR))

    // Liquidate 5 troves
    await troveManager.batchLiquidateTroves([alice, bob, carol, erin, flyn], owner)

    // Confirm troves A-E have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(flyn))
    // Check all troves A-E are now closed by liquidation
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(erin)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(flyn)).toString(), '3')

    // Check sorted list has been reduced to length 4 
    assert.equal((await sortedTroves.getSize()).toString(), '4')
  })

  it('batchLiquidateTroves(): liquidates  up to the requested number of undercollateralized troves', async () => {
    // --- SETUP --- 
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

    // Alice, Bob, Carol, Dennis, Erin open troves with consecutively decreasing collateral ratio
    await openTrove({ ICR: toBN(dec(202, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(204, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(208, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: erin } })

    // --- TEST --- 

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    await troveManager.batchLiquidateTroves([alice, bob, carol], owner)

    const TroveOwnersArrayLength = await troveManager.getTroveOwnersCount()
    assert.equal(TroveOwnersArrayLength, '3')

    // Check Alice, Bob, Carol troves have been closed
    const aliceTroveStatus = (await troveManager.getTroveStatus(alice)).toString()
    const bobTroveStatus = (await troveManager.getTroveStatus(bob)).toString()
    const carolTroveStatus = (await troveManager.getTroveStatus(carol)).toString()

    assert.equal(aliceTroveStatus, '3')
    assert.equal(bobTroveStatus, '3')
    assert.equal(carolTroveStatus, '3')

    //  Check Alice, Bob, and Carol's trove are no longer in the sorted list
    const alice_isInSortedList = await sortedTroves.contains(alice)
    const bob_isInSortedList = await sortedTroves.contains(bob)
    const carol_isInSortedList = await sortedTroves.contains(carol)

    assert.isFalse(alice_isInSortedList)
    assert.isFalse(bob_isInSortedList)
    assert.isFalse(carol_isInSortedList)

    // Check Dennis, Erin still have active troves
    const dennisTroveStatus = (await troveManager.getTroveStatus(dennis)).toString()
    const erinTroveStatus = (await troveManager.getTroveStatus(erin)).toString()

    assert.equal(dennisTroveStatus, '1')
    assert.equal(erinTroveStatus, '1')

    // Check Dennis, Erin still in sorted list
    const dennis_isInSortedList = await sortedTroves.contains(dennis)
    const erin_isInSortedList = await sortedTroves.contains(erin)

    assert.isTrue(dennis_isInSortedList)
    assert.isTrue(erin_isInSortedList)
  })

  it('batchLiquidateTroves(): does nothing if all troves have ICR > 110%', async () => {
    await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(222, 16)), extraParams: { from: carol } })

    // Price drops, but all troves remain active at 111% ICR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    assert.isTrue((await sortedTroves.contains(whale)))
    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_Before = (await th.getTCR(contracts)).toString()
    const listSize_Before = (await sortedTroves.getSize()).toString()

    assert.isTrue((await troveManager.getCurrentICR(whale)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(alice)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).gte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Attempt liqudation sequence
    await assertRevert(troveManager.batchLiquidateTroves([whale, alice, bob, carol], owner), "TroveManager: nothing to liquidate")
    // Check all troves remain active
    assert.isTrue((await sortedTroves.contains(whale)))
    assert.isTrue((await sortedTroves.contains(alice)))
    assert.isTrue((await sortedTroves.contains(bob)))
    assert.isTrue((await sortedTroves.contains(carol)))

    const TCR_After = (await th.getTCR(contracts)).toString()
    const listSize_After = (await sortedTroves.getSize()).toString()

    assert.equal(TCR_Before, TCR_After)
    assert.equal(listSize_Before, listSize_After)
  })

  
  it("batchLiquidateTroves(): liquidates based on entire/collateral debt (including pending rewards), not raw collateral/debt", async () => {
    await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(221, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR_Before = await troveManager.getCurrentICR(alice)
    const bob_ICR_Before = await troveManager.getCurrentICR(bob)
    const carol_ICR_Before = await troveManager.getCurrentICR(carol)

    /* Before liquidation: 
    Alice ICR: = (2 * 100 / 100) = 200%
    Bob ICR: (1 * 100 / 90.5) = 110.5%
    Carol ICR: (1 * 100 / 100 ) =  100%

    Therefore Alice and Bob above the MCR, Carol is below */
    assert.isTrue(alice_ICR_Before.gte(mv._MCR))
    assert.isTrue(bob_ICR_Before.gte(mv._MCR))
    assert.isTrue(carol_ICR_Before.lte(mv._MCR))

    // Liquidate defaulter. 30 YUSD and 0.3 ETH is distributed uniformly between A, B and C. Each receive 10 YUSD, 0.1 ETH
    await troveManager.liquidate(defaulter_1)

    const alice_ICR_After = await troveManager.getCurrentICR(alice)
    const bob_ICR_After = await troveManager.getCurrentICR(bob)
    const carol_ICR_After = await troveManager.getCurrentICR(carol)

    /* After liquidation: 

    Alice ICR: (1.0995 * 100 / 60) = 183.25%
    Bob ICR:(1.0995 * 100 / 100.5) =  109.40%
    Carol ICR: (1.0995 * 100 / 110 ) 99.95%

    Check Alice is above MCR, Bob below, Carol below. */
    assert.isTrue(alice_ICR_After.gte(mv._MCR))
    assert.isTrue(bob_ICR_After.lte(mv._MCR))
    assert.isTrue(carol_ICR_After.lte(mv._MCR))

    /* Though Bob's true ICR (including pending rewards) is below the MCR, check that Bob's raw coll and debt has not changed */
    const bob_Coll = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const bob_Debt = await troveManager.getTroveDebt(bob)

    const bob_rawICR = bob_Coll.mul(toBN(dec(100, 18))).div(bob_Debt)
    assert.isTrue(bob_rawICR.gte(mv._MCR))

    // Whale enters system, pulling it into Normal Mode
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 24), extraParams: { from: whale } })

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    //liquidate A, B, C
    await troveManager.batchLiquidateTroves([alice, bob, carol], owner)

    // Check A stays active, B and C get liquidated
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // check trove statuses - A active (1),  B and C closed by liquidation (3)
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '1')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '3')
  })

  it("batchLiquidateTroves(): reverts if _troveArray empty", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(206, 16)), extraParams: { from: carol } })

    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const TCR_Before = (await th.getTCR(contracts)).toString()

    // Confirm A, B, C ICRs are below 110%
    const alice_ICR = await troveManager.getCurrentICR(alice)
    const bob_ICR = await troveManager.getCurrentICR(bob)
    const carol_ICR = await troveManager.getCurrentICR(carol)
    assert.isTrue(alice_ICR.lte(mv._MCR))
    assert.isTrue(bob_ICR.lte(mv._MCR))
    assert.isTrue(carol_ICR.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidation with n = 0
    await assertRevert(troveManager.batchLiquidateTroves([], owner), "TroveManager: nothing to liquidate")

    // Check all troves are still in the system
    assert.isTrue(await sortedTroves.contains(whale))
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))

    const TCR_After = (await th.getTCR(contracts)).toString()

    // Check TCR has not changed after liquidation
    assert.equal(TCR_Before, TCR_After)
  })

  it("batchLiquidateTroves(): liquidates troves with ICR < MCR", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // A, B, C open troves that will remain active when price drops to 100
    await openTrove({ ICR: toBN(dec(220, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(230, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(240, 16)), extraParams: { from: carol } })

    // D, E, F open troves that will fall below MCR when price drops to 100
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    // Check list size is 7
    assert.equal((await sortedTroves.getSize()).toString(), '7')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    const alice_ICR = await troveManager.getCurrentICR(alice)
    const bob_ICR = await troveManager.getCurrentICR(bob)
    const carol_ICR = await troveManager.getCurrentICR(carol)
    const dennis_ICR = await troveManager.getCurrentICR(dennis)
    const erin_ICR = await troveManager.getCurrentICR(erin)
    const flyn_ICR = await troveManager.getCurrentICR(flyn)

    // Check A, B, C have ICR above MCR
    assert.isTrue(alice_ICR.gte(mv._MCR))
    assert.isTrue(bob_ICR.gte(mv._MCR))
    assert.isTrue(carol_ICR.gte(mv._MCR))

    // Check D, E, F have ICR below MCR
    assert.isTrue(dennis_ICR.lte(mv._MCR))
    assert.isTrue(erin_ICR.lte(mv._MCR))
    assert.isTrue(flyn_ICR.lte(mv._MCR))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    //Liquidate sequence
    await troveManager.batchLiquidateTroves([whale, alice, bob, carol, dennis, erin, flyn], owner)

    // check list size reduced to 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Check Whale and A, B, C remain in the system
    assert.isTrue(await sortedTroves.contains(whale))
    assert.isTrue(await sortedTroves.contains(alice))
    assert.isTrue(await sortedTroves.contains(bob))
    assert.isTrue(await sortedTroves.contains(carol))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(flyn))
  })

  it("batchLiquidateTroves(): does not affect the liquidated user's token balances", async () => {
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // D, E, F open troves that will fall below MCR when price drops to 100
    await openTrove({ ICR: toBN(dec(218, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(216, 16)), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: flyn } })

    const D_balanceBefore = await yusdToken.balanceOf(dennis)
    const E_balanceBefore = await yusdToken.balanceOf(erin)
    const F_balanceBefore = await yusdToken.balanceOf(flyn)

    // Check list size is 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    //Liquidate sequence
    await troveManager.batchLiquidateTroves([whale, dennis, erin, flyn], owner);

    // check list size reduced to 1
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    // Check Whale remains in the system
    assert.isTrue(await sortedTroves.contains(whale))

    // Check D, E, F have been removed
    assert.isFalse(await sortedTroves.contains(dennis))
    assert.isFalse(await sortedTroves.contains(erin))
    assert.isFalse(await sortedTroves.contains(flyn))

    // Check token balances of users whose troves were liquidated, have not changed
    assert.equal((await yusdToken.balanceOf(dennis)).toString(), D_balanceBefore)
    assert.equal((await yusdToken.balanceOf(erin)).toString(), E_balanceBefore)
    assert.equal((await yusdToken.balanceOf(flyn)).toString(), F_balanceBefore)
  })

  it("batchLiquidateTroves(): A liquidation sequence containing Pool offsets increases the TCR", async () => {
    // Whale provides 500 YUSD to SP
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: toBN(dec(500, 18)), extraParams: { from: whale } })
    await stabilityPool.provideToSP(dec(500, 18), ZERO_ADDRESS, { from: whale })

    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    await openTrove({ ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    await openTrove({ ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    assert.equal((await sortedTroves.getSize()).toString(), '9')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    const TCR_Before = await th.getTCR(contracts)

    // Check pool has 500 YUSD
    assert.equal((await stabilityPool.getTotalYUSDDeposits()).toString(), dec(500, 18))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate troves
    await troveManager.batchLiquidateTroves([whale, alice, bob, carol, dennis, defaulter_1, defaulter_2, defaulter_3, defaulter_4], owner);

    // Check pool has been emptied by the liquidations
    assert.equal((await stabilityPool.getTotalYUSDDeposits()).toString(), '0')

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize()).toString(), '5')

    // Check that the liquidation sequence has improved the TCR
    const TCR_After = await th.getTCR(contracts)
    assert.isTrue(TCR_After.gte(TCR_Before))
  })

  it("batchLiquidateTroves(): A liquidation sequence of pure redistributions decreases the TCR, due to gas compensation, but up to 0.5%", async () => {
    const { collateral: W_coll, totalDebt: W_debt } = await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
    const { collateral: A_coll, totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(28, 18)), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_debt } = await openTrove({ ICR: toBN(dec(8, 18)), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_debt } = await openTrove({ ICR: toBN(dec(80, 18)), extraParams: { from: dennis } })

    const { collateral: d1_coll, totalDebt: d1_debt } = await openTrove({ ICR: toBN(dec(199, 16)), extraParams: { from: defaulter_1 } })
    const { collateral: d2_coll, totalDebt: d2_debt } = await openTrove({ ICR: toBN(dec(156, 16)), extraParams: { from: defaulter_2 } })
    const { collateral: d3_coll, totalDebt: d3_debt } = await openTrove({ ICR: toBN(dec(183, 16)), extraParams: { from: defaulter_3 } })
    const { collateral: d4_coll, totalDebt: d4_debt } = await openTrove({ ICR: toBN(dec(166, 16)), extraParams: { from: defaulter_4 } })

    const totalCollNonDefaulters = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)
    const totalCollDefaulters = d1_coll.add(d2_coll).add(d3_coll).add(d4_coll)
    const totalColl = totalCollNonDefaulters.add(totalCollDefaulters)
    const totalDebt = W_debt.add(A_debt).add(B_debt).add(C_debt).add(D_debt).add(d1_debt).add(d2_debt).add(d3_debt).add(d4_debt)

    assert.isTrue((await sortedTroves.contains(defaulter_1)))
    assert.isTrue((await sortedTroves.contains(defaulter_2)))
    assert.isTrue((await sortedTroves.contains(defaulter_3)))
    assert.isTrue((await sortedTroves.contains(defaulter_4)))

    assert.equal((await sortedTroves.getSize()).toString(), '9')

    // Price drops
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price)

    const TCR_Before = await th.getTCR(contracts)
    assert.isAtMost(th.getDifference(TCR_Before, totalColl.mul(price).div(totalDebt)), 1000)

    // Check pool is empty before liquidation
    assert.equal((await stabilityPool.getTotalYUSDDeposits()).toString(), '0')

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate
    await troveManager.batchLiquidateTroves([whale, alice, bob, carol, dennis, defaulter_1, defaulter_2, defaulter_3, defaulter_4], owner)

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(defaulter_1)))
    assert.isFalse((await sortedTroves.contains(defaulter_2)))
    assert.isFalse((await sortedTroves.contains(defaulter_3)))
    assert.isFalse((await sortedTroves.contains(defaulter_4)))

    // check system sized reduced to 5 troves
    assert.equal((await sortedTroves.getSize()).toString(), '5')

    // Check that the liquidation sequence has reduced the TCR
    const TCR_After = await th.getTCR(contracts)
    // ((100+1+7+2+20)+(1+2+3+4)*0.995)*100/(2050+50+50+50+50+101+257+328+480)
    assert.isAtMost(th.getDifference(TCR_After, totalCollNonDefaulters.add(th.applyLiquidationFee(totalCollDefaulters)).mul(price).div(totalDebt)), 1000)
    assert.isTrue(TCR_Before.gte(TCR_After))
    assert.isTrue(TCR_After.gte(TCR_Before.mul(toBN(995)).div(toBN(1000))))
  })

  it("batchLiquidateTroves(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain", async () => {
    // Whale provides 400 YUSD to the SP
    const whaleDeposit = toBN(dec(40000, 18))
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: whaleDeposit, extraParams: { from: whale } })
    await stabilityPool.provideToSP(whaleDeposit, ZERO_ADDRESS, { from: whale })

    const A_deposit = toBN(dec(10000, 18))
    const B_deposit = toBN(dec(30000, 18))
    const { collateral: A_coll, totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: A_deposit, extraParams: { from: alice } })
    const { collateral: B_coll, totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: B_deposit, extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_debt } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

    const liquidatedColl = A_coll.add(B_coll).add(C_coll)
    const liquidatedDebt = A_debt.add(B_debt).add(C_debt)

    // A, B provide 100, 300 to the SP
    await stabilityPool.provideToSP(A_deposit, ZERO_ADDRESS, { from: alice })
    await stabilityPool.provideToSP(B_deposit, ZERO_ADDRESS, { from: bob })

    assert.equal((await sortedTroves.getSize()).toString(), '4')

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Check 800 YUSD in Pool
    const totalDeposits = whaleDeposit.add(A_deposit).add(B_deposit)
    assert.equal((await stabilityPool.getTotalYUSDDeposits()).toString(), totalDeposits)

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Liquidate
    await troveManager.batchLiquidateTroves([whale, alice, bob, carol], owner);

    // Check all defaulters have been liquidated
    assert.isFalse((await sortedTroves.contains(alice)))
    assert.isFalse((await sortedTroves.contains(bob)))
    assert.isFalse((await sortedTroves.contains(carol)))

    // check system sized reduced to 1 troves
    assert.equal((await sortedTroves.getSize()).toString(), '1')

    /* Prior to liquidation, SP deposits were:
    Whale: 400 YUSD
    Alice: 100 YUSD
    Bob:   300 YUSD
    Carol: 0 YUSD

    Total YUSD in Pool: 800 YUSD

    Then, liquidation hits A,B,C: 

    Total liquidated debt = 150 + 350 + 150 = 650 YUSD
    Total liquidated ETH = 1.1 + 3.1 + 1.1 = 5.3 ETH

    whale yusd loss: 650 * (400/800) = 325 yusd
    alice yusd loss:  650 *(100/800) = 81.25 yusd
    bob yusd loss: 650 * (300/800) = 243.75 yusd

    whale remaining deposit: (400 - 325) = 75 yusd
    alice remaining deposit: (100 - 81.25) = 18.75 yusd
    bob remaining deposit: (300 - 243.75) = 56.25 yusd

    whale eth gain: 5*0.995 * (400/800) = 2.4875 eth
    alice eth gain: 5*0.995 *(100/800) = 0.621875 eth
    bob eth gain: 5*0.995 * (300/800) = 1.865625 eth

    Total remaining deposits: 150 YUSD
    Total ETH gain: 4.975 ETH */

    // Check remaining YUSD Deposits and ETH gain, for whale and depositors whose troves were liquidated
    const whale_Deposit_After = await stabilityPool.getCompoundedYUSDDeposit(whale)
    const alice_Deposit_After = await stabilityPool.getCompoundedYUSDDeposit(alice)
    const bob_Deposit_After = await stabilityPool.getCompoundedYUSDDeposit(bob)

    const whale_ETHGain = (await stabilityPool.getDepositorGains(whale))[1][wethIDX]
    const alice_ETHGain = (await stabilityPool.getDepositorGains(alice))[1][wethIDX]
    const bob_ETHGain = (await stabilityPool.getDepositorGains(bob))[1][wethIDX]

    assert.isAtMost(th.getDifference(whale_Deposit_After, whaleDeposit.sub(liquidatedDebt.mul(whaleDeposit).div(totalDeposits))), 100000)
    assert.isAtMost(th.getDifference(alice_Deposit_After, A_deposit.sub(liquidatedDebt.mul(A_deposit).div(totalDeposits))), 100000)
    assert.isAtMost(th.getDifference(bob_Deposit_After, B_deposit.sub(liquidatedDebt.mul(B_deposit).div(totalDeposits))), 100000)

    assert.isAtMost(th.getDifference(whale_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(whaleDeposit).div(totalDeposits)), 100000)
    assert.isAtMost(th.getDifference(alice_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(A_deposit).div(totalDeposits)), 100000)
    assert.isAtMost(th.getDifference(bob_ETHGain, th.applyLiquidationFee(liquidatedColl).mul(B_deposit).div(totalDeposits)), 100000)

    // Check total remaining deposits and ETH gain in Stability Pool
    const total_YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    const total_ETHinSP = (await stabilityPool.getCollateral(weth.address)).toString()

    assert.isAtMost(th.getDifference(total_YUSDinSP, totalDeposits.sub(liquidatedDebt)), 1000)
    assert.isAtMost(th.getDifference(total_ETHinSP, th.applyLiquidationFee(liquidatedColl)), 1000)
  })

  it("batchLiquidateTroves(): when SP > 0, triggers YETI reward event - increases the sum G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalYUSDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100YUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate troves
    await troveManager.batchLiquidateTroves([defaulter_1, defaulter_2], owner)
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the YETI reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("batchLiquidateTroves(): when SP is empty, doesn't update G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraYUSDAmount: toBN(dec(100, 18)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(219, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(213, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalYUSDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100YUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // liquidate troves
    await troveManager.batchLiquidateTroves([defaulter_1, defaulter_2], owner)
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  it('batchLiquidateTroves(): closes every trove with ICR < MCR in the given array', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray, owner);

    // Confirm troves A-C have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))
    assert.isFalse(await sortedTroves.contains(carol))

    // Check all troves A-C are now closed by liquidation
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '3')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')
  })

  it('batchLiquidateTroves(): does not liquidate troves that are not in the given array', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: toBN(dec(500, 18)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: toBN(dec(500, 18)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm troves A-E are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin)).lt(mv._MCR))

    liquidationArray = [alice, bob]  // C-E not included
    await troveManager.batchLiquidateTroves(liquidationArray, owner);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')

    // Confirm troves C-E remain in the system
    assert.isTrue(await sortedTroves.contains(carol))
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(erin))

    // Check all troves C-E are still active
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '1')
    assert.equal((await troveManager.getTroveStatus(dennis)).toString(), '1')
    assert.equal((await troveManager.getTroveStatus(erin)).toString(), '1')

    // Check sorted list has been reduced to length 4
    assert.equal((await sortedTroves.getSize()).toString(), '4')
  })

  it('batchLiquidateTroves(): does not close troves with ICR >= MCR in the given array', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm troves A-C are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))

    // Confirm D-E are ICR >= 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin)).gte(mv._MCR))

    // Confirm Whale is ICR > 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale)).gte(mv._MCR))

    liquidationArray = [alice, bob, carol, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray, owner);

    // Confirm troves D-E and whale remain in the system
    assert.isTrue(await sortedTroves.contains(dennis))
    assert.isTrue(await sortedTroves.contains(erin))
    assert.isTrue(await sortedTroves.contains(whale))

    // Check all troves D-E and whale remain active
    assert.equal((await troveManager.getTroveStatus(dennis)).toString(), '1')
    assert.equal((await troveManager.getTroveStatus(erin)).toString(), '1')
    assert.isTrue(await sortedTroves.contains(whale))

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')
  })

  it('batchLiquidateTroves(): reverts if array is empty', async () => {
    // --- SETUP ---
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(dec(300, 18), ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    liquidationArray = []
    try {
      const tx = await troveManager.batchLiquidateTroves(liquidationArray, owner);
      assert.isFalse(tx.receipt.status)
    } catch (error) {
      assert.include(error.message, "TroveManager: Calldata address array must not be empty")
    }
  })

  it("batchLiquidateTroves(): skips if trove is non-existent", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18))
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: spDeposit, extraParams: { from: whale } })

    const { totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    assert.equal(await troveManager.getTroveStatus(carol), 0) // check trove non-existent

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '5')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray, owner);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')

    // Confirm trove C non-existent
    assert.isFalse(await sortedTroves.contains(carol))
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '0')

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual((await stabilityPool.getTotalYUSDDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
  })

  it("batchLiquidateTroves(): skips if a trove has been closed", async () => {
    // --- SETUP ---
    const spDeposit = toBN(dec(500000, 18))
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: spDeposit, extraParams: { from: whale } })

    const { totalDebt: A_debt } = await openTrove({ ICR: toBN(dec(190, 16)), extraParams: { from: alice } })
    const { totalDebt: B_debt } = await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(195, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2000, 16)), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(1800, 16)), extraParams: { from: erin } })

    assert.isTrue(await sortedTroves.contains(carol))

    // Check full sorted list size is 6
    assert.equal((await sortedTroves.getSize()).toString(), '6')

    // Whale puts some tokens in Stability Pool
    await stabilityPool.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale })

    // Whale transfers to Carol so she can close her trove
    await yusdToken.transfer(carol, dec(100, 18), { from: whale })

    // --- TEST ---

    // Price drops to 1ETH:100YUSD, reducing A, B, C ICR below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()

    // Carol liquidated, and her trove is closed
    const txCarolClose = await borrowerOperations.closeTrove({ from: carol })
    assert.isTrue(txCarolClose.receipt.status)

    assert.isFalse(await sortedTroves.contains(carol))

    assert.equal(await troveManager.getTroveStatus(carol), 2)  // check trove closed

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));

    // Confirm troves A-B are ICR < 110%
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))

    // Confirm D-E are ICR > 110%
    assert.isTrue((await troveManager.getCurrentICR(dennis)).gte(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(erin)).gte(mv._MCR))

    // Confirm Whale is ICR >= 110% 
    assert.isTrue((await troveManager.getCurrentICR(whale)).gte(mv._MCR))

    // Liquidate - trove C in between the ones to be liquidated!
    const liquidationArray = [alice, carol, bob, dennis, erin]
    await troveManager.batchLiquidateTroves(liquidationArray, owner);

    // Confirm troves A-B have been removed from the system
    assert.isFalse(await sortedTroves.contains(alice))
    assert.isFalse(await sortedTroves.contains(bob))

    // Check all troves A-B are now closed by liquidation
    assert.equal((await troveManager.getTroveStatus(alice)).toString(), '3')
    assert.equal((await troveManager.getTroveStatus(bob)).toString(), '3')
    // Trove C still closed by user
    assert.equal((await troveManager.getTroveStatus(carol)).toString(), '2')

    // Check sorted list has been reduced to length 3
    assert.equal((await sortedTroves.getSize()).toString(), '3')

    // Check Stability pool has only been reduced by A-B
    th.assertIsApproximatelyEqual((await stabilityPool.getTotalYUSDDeposits()).toString(), spDeposit.sub(A_debt).sub(B_debt))

    // Confirm system is not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts));
  })

  it("batchLiquidateTroves: when SP > 0, triggers YETI reward event - increases the sum G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(167, 16)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })
    assert.equal(await stabilityPool.getTotalYUSDDeposits(), dec(100, 18))

    const G_Before = await stabilityPool.epochToScaleToG(0, 0)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100YUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate troves
    await troveManager.batchLiquidateTroves([defaulter_1, defaulter_2], owner)
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has increased from the YETI reward event triggered
    assert.isTrue(G_After.gt(G_Before))
  })

  it("batchLiquidateTroves(): when SP is empty, doesn't update G", async () => {
    await openTrove({ ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

    // A, B, C open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(167, 16)), extraParams: { from: C } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_1 } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: defaulter_2 } })

    // B provides to SP
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: B })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // B withdraws
    await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })

    // Check SP is empty
    assert.equal((await stabilityPool.getTotalYUSDDeposits()), '0')

    // Check G is non-zero
    const G_Before = await stabilityPool.epochToScaleToG(0, 0)
    assert.isTrue(G_Before.gt(toBN('0')))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops to 1ETH:100YUSD, reducing defaulters to below MCR
    await priceFeed.setPrice(dec(100, 18));
    const price = await priceFeed.getPrice()
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // liquidate troves
    await troveManager.batchLiquidateTroves([defaulter_1, defaulter_2], owner)
    assert.isFalse(await sortedTroves.contains(defaulter_1))
    assert.isFalse(await sortedTroves.contains(defaulter_2))

    const G_After = await stabilityPool.epochToScaleToG(0, 0)

    // Expect G has not changed
    assert.isTrue(G_After.eq(G_Before))
  })

  // --- redemptions ---

  it('getRedemptionHints(): gets the address of the first Trove and the final ICR of the last Trove involved in a redemption', async () => {
    // --- SETUP ---
    const partialRedemptionAmount = toBN(dec(100, 18))
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraYUSDAmount: partialRedemptionAmount, extraParams: { from: alice } })
    const { netDebt: B_debt } = await openTrove({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    const { netDebt: C_debt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    // Dennis' Trove should be untouched by redemption, because its ICR will be < 110% after the price drop
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: dennis } })

    // Drop the price
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);
    // Update troves externally
    await troveManager.updateTroves([alice, bob, carol, dennis], [alice, alice, alice, alice], [carol, carol, carol, dennis])
    // --- TEST ---
    const redemptionAmount = C_debt.add(B_debt).add(partialRedemptionAmount)
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, 0)

    assert.equal(firstRedemptionHint, carol)
    const expectedICR = A_coll.mul(price).sub(partialRedemptionAmount.mul(mv._1e18BN)).div(A_totalDebt.sub(partialRedemptionAmount))
    th.assertIsApproximatelyEqual(partialRedemptionHintICR, expectedICR)
  });

  it('getRedemptionHints(): When only one trove is updated it keeps the old icr values correctly. ', async () => {
    // --- SETUP ---
    const partialRedemptionAmount = toBN(dec(100, 18))
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraYUSDAmount: partialRedemptionAmount, extraParams: { from: alice } })
    const { netDebt: B_debt } = await openTrove({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    const { netDebt: C_debt } = await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    // Dennis' Trove should be untouched by redemption, because its ICR will be < 110% after the price drop
    await openTrove({ ICR: toBN(dec(120, 16)), extraParams: { from: dennis } })

    // Drop the price
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);
    // Update troves externally
    await troveManager.updateTroves([alice, bob, carol], [alice, alice, alice], [carol, carol, carol])
    // --- TEST ---
    const redemptionAmount = C_debt.add(B_debt).add(partialRedemptionAmount)
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, 0)

    assert.equal(firstRedemptionHint, dennis)
  });

  it('getRedemptionHints(): returns 0 as partialRedemptionHintICR when reaching _maxIterations', async () => {
    // --- SETUP ---
    // await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    // await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    // await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    // await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await openTrove({ ICR: toBN(dec(310, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(290, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(250, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraParams: { from: dennis } })

    // --- TEST ---

    // Get hints for a redemption of 3600 + some extra YUSD. At least 3 iterations are needed
    // for total redemption of the given amount.
    const {
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(toBN(dec(4100, 18)), 2) // limit _maxIterations to 2

    console.log("partial ", partialRedemptionHintICR.toString())
    assert.equal(partialRedemptionHintICR, '0')
  });

    it("redeemCollateral(): Sanity test for doing one redemption, checks correct amounts.", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(6000, 18)), A, A, [contracts.weth.address], [dec(1000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(1000, 18)], { from: B })

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_before = await activePool.getCollateral(weth.address)

      // YUSD redemption is 5000 YUSD
      const YUSDRedemption = dec(5000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]

      assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
      assert.isTrue(actualETHAmount.eq(finalYUSDAmount.div(toBN(200))))
      assert.isTrue(actualYUSDFee.lt(finalYUSDFeeAmount))

      const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
      const B_debt_after = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
      const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_after = await activePool.getCollateral(weth.address)

      // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
      await th.assertIsApproximatelyEqual(
        A_YUSD_Balance_After,
        A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(finalYUSDFeeAmount),
        100000)

      // Assert that B's debt has decreased by the correct amount of YUSD
      assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount)))

      // Make sure that A gained an appropriate amount of collateral
      assert.isTrue(A_WETH_Balance_After.eq(A_WETH_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))))

      // Make sure that B lost that amount of collateral
      assert.isTrue(B_WETH_Collateral_After.eq(B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200)))))

      // Make sure active pool has decreased by the correct amount of WETH
      assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(200)))))
    })

    it("redeemCollateral(): Stops when amount fulfilled. Ensure that amounts are correct and that first trove closes", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
      await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(9999, 18)], { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), C, C, [contracts.weth.address], [dec(50, 18)], { from: C })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), D, D, [contracts.weth.address], [dec(50, 18)], { from: D })

      await troveManager.setBaseRate(0)

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
      const B_debt_before = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
      const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_before = await activePool.getCollateral(weth.address)

      // YUSD redemption is 6000 YUSD. Should close C, D and take some of B.
      const YUSDRedemption = dec(6000, 18)
      const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
      const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);

      const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
      assert.isTrue(tx1.receipt.status)

      const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
      const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
      const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]

      assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
      assert.isTrue(actualETHAmount.eq(finalYUSDAmount.div(toBN(200))))
      assert.isTrue(actualYUSDFee.lt(finalYUSDFeeAmount))

      assert.isTrue(await sortedTroves.contains(A))
      assert.isTrue(await sortedTroves.contains(B))
      assert.isFalse(await sortedTroves.contains(C))
      assert.isFalse(await sortedTroves.contains(D))

      const collSurplusPoolAfter = await contracts.collSurplusPool.getCollateral(weth.address)
      assert.isTrue(collSurplusPoolAfter.eq(th.toBN(dec(82, 18)))) // 50 + 50 - 9 - 9 = 82 in surplus.

      const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
      const B_debt_after = await troveManager.getTroveDebt(B)

      const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
      const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

      const active_pool_after = await activePool.getCollateral(weth.address)

      // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
      await th.assertIsApproximatelyEqual(
        A_YUSD_Balance_After,
        A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(finalYUSDFeeAmount),
        100000)

      // Assert that B's debt has decreased by the correct amount of YUSD. 1800 * 2 offset from other troves.
      assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount).add(toBN(dec(3600, 18)))))

      // Make sure that A gained an appropriate amount of collateral
      assert.isTrue(A_WETH_Balance_After.eq(A_WETH_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))))

      // Make sure that B lost that amount of collateral. Total collateral offset with 18 eth from other troves.
      assert.isTrue(B_WETH_Collateral_After.eq(B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200))).add(toBN(dec(18, 18)))))

      // Make sure active pool has decreased by the correct amount of WETH
      assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))).sub(toBN(dec(82, 18)))))
    })

  it('redeemCollateral(): with invalid first hint, zero address', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraYUSDAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: carol } })
    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await weth.balanceOf(dennis))

    const dennis_YUSDBalance_Before = await yusdToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // Find hints for redeeming 20 YUSD
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, 0)


    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } =
    await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Dennis redeems 20 YUSD
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const toApprove = redemptionAmount.add(redemptionAmount);
    await yusdToken.approve(troveManagerRedemptions.address, toApprove, {from: dennis});

    // const tx1 = await th.redeemCollateralAndGetTxObject()
    // const tx1 = await th.redeemCollateralAndGetTxObject(dennis, contracts, redemptionAmount, th._100pct)
    const redemptionTx = await troveManager.redeemCollateral(
      redemptionAmount,
      redemptionAmount,
      ZERO_ADDRESS, // invalid first hint
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintICR,
      0,
      // th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const YUSDFee = th.getEmittedRedemptionValues(redemptionTx)[2]

    // const alice_Trove_After = await troveManager.Troves(alice)
    // const bob_Trove_After = await troveManager.Troves(bob)
    // const carol_Trove_After = await troveManager.Troves(carol)

    // const alice_debt_After = alice_Trove_After[0].toString()
    // const bob_debt_After = bob_Trove_After[0].toString()
    // const carol_debt_After = carol_Trove_After[0].toString()

    const alice_debt_After = await th.getTroveEntireDebt(contracts, alice)
    const bob_debt_After = await th.getTroveEntireDebt(contracts, bob)
    const carol_debt_After = await th.getTroveEntireDebt(contracts, carol)

    /* check that Dennis' redeemed 20 YUSD has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) YUSD debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = toBN(await weth.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount YUSD to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)

    const dennis_YUSDBalance_After = (await yusdToken.balanceOf(dennis)).toString()
    assert.equal(dennis_YUSDBalance_After, dennis_YUSDBalance_Before.sub(redemptionAmount).sub(YUSDFee).toString())
  })

  it('redeemCollateral(): with invalid first hint, non-existent trove', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraYUSDAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: carol } })
    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await weth.balanceOf(dennis))

    const dennis_YUSDBalance_Before = await yusdToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // Find hints for redeeming 20 YUSD
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const toApprove = redemptionAmount.add(redemptionAmount);
    await yusdToken.approve(troveManagerRedemptions.address, toApprove, {from: dennis});

    // Dennis redeems 20 YUSD
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await troveManager.redeemCollateral(
      redemptionAmount,
      redemptionAmount,
      erin, // invalid first hint, it doesn’t have a trove
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintICR,
      0,
      // th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const YUSDFee = th.getEmittedRedemptionValues(redemptionTx)[2]

    const alice_debt_After = await th.getTroveEntireDebt(contracts, alice)
    const bob_debt_After = await th.getTroveEntireDebt(contracts, bob)
    const carol_debt_After = await th.getTroveEntireDebt(contracts, carol)

    /* check that Dennis' redeemed 20 YUSD has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) YUSD debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = toBN(await weth.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount YUSD to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)

    const dennis_YUSDBalance_After = (await yusdToken.balanceOf(dennis)).toString()
    assert.equal(dennis_YUSDBalance_After, dennis_YUSDBalance_Before.sub(redemptionAmount).sub(YUSDFee).toString())
  })

  it('redeemCollateral(): with invalid first hint, trove below MCR', async () => {
    // --- SETUP ---
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(310, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(290, 16)), extraYUSDAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(250, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: carol } })
    const partialRedemptionAmount = toBN(2)
    const redemptionAmount = C_netDebt.add(B_netDebt).add(partialRedemptionAmount)
    // start Dennis with a high ICR
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await weth.balanceOf(dennis))

    const dennis_YUSDBalance_Before = await yusdToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // Increase price to start Erin, and decrease it again so its ICR is under MCR
    await priceFeed.setPrice(price.mul(toBN(2)))
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: erin } })
    await priceFeed.setPrice(price)


    // --- TEST ---

    // Find hints for redeeming 20 YUSD
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, 0)

    // We don't need to use getApproxHint for this test, since it's not the subject of this
    // test case, and the list is very small, so the correct position is quickly found
    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      dennis,
      dennis
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const toApprove = redemptionAmount.add(redemptionAmount);
    await yusdToken.approve(troveManagerRedemptions.address, toApprove, {from: dennis});

    // Dennis redeems 20 YUSD
    // Don't pay for gas, as it makes it easier to calculate the received Ether
    const redemptionTx = await troveManager.redeemCollateral(
      redemptionAmount,
      redemptionAmount,
      erin, // invalid trove, below MCR
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintICR,
      0,
      // th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const YUSDFee = th.getEmittedRedemptionValues(redemptionTx)[2]

    const alice_debt_After = await th.getTroveEntireDebt(contracts, alice)
    const bob_debt_After = await th.getTroveEntireDebt(contracts, bob)
    const carol_debt_After = await th.getTroveEntireDebt(contracts, carol)

    /* check that Dennis' redeemed 20 YUSD has been cancelled with debt from Bobs's Trove (8) and Carol's Trove (10).
    The remaining lot (2) is sent to Alice's Trove, who had the best ICR.
    It leaves her with (3) YUSD debt + 50 for gas compensation. */
    th.assertIsApproximatelyEqual(alice_debt_After, A_totalDebt.sub(partialRedemptionAmount))
    assert.equal(bob_debt_After, '0')
    assert.equal(carol_debt_After, '0')

    const dennis_ETHBalance_After = toBN(await weth.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    const expectedTotalETHDrawn = redemptionAmount.div(toBN(200)) // convert redemptionAmount YUSD to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)

    const dennis_YUSDBalance_After = (await yusdToken.balanceOf(dennis))
    th.assertIsApproximatelyEqual(dennis_YUSDBalance_After, dennis_YUSDBalance_Before.sub(redemptionAmount).sub(YUSDFee))
  })

  it("redeemCollateral(): Stops when max iterations reached. Ensure that it does the correct amount after doing max iterations", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(9999, 18)], { from: B })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), C, C, [contracts.weth.address], [dec(51, 18)], { from: C })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), D, D, [contracts.weth.address], [dec(50, 18)], { from: D })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), whale, whale, [contracts.weth.address], [dec(49, 18)], { from: whale })

    await troveManager.setBaseRate(0)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
    const B_debt_before = await troveManager.getTroveDebt(B)

    const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
    const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

    const active_pool_before = await activePool.getCollateral(weth.address)

    // YUSD redemption is 10000. Should stop after redeeming against trove D
    const YUSDRedemption = dec(10000, 18)
    const finalYUSDAmount = toBN(dec(3600, 18))//await th.estimateYUSDEligible(contracts, YUSDRedemption)
    // const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);
    // console.log("FINAL YUSD FEE AMOUNT " , finalYUSDFeeAmount.toString())
    const estimatedYUSDFee = (await th.estimateRedemptionFee(contracts, finalYUSDAmount))

    // const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
    const tx1 = await th.performRedemptionTx(A, 0, contracts, YUSDRedemption, th._100pct, 1, 2)
    assert.isTrue(tx1.receipt.status)

    const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
    const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
    const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]

    assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
    assert.isTrue(actualETHAmount.eq(finalYUSDAmount.div(toBN(200))))
    assert.isTrue(actualYUSDFee.lt(estimatedYUSDFee))

    assert.isTrue(await sortedTroves.contains(A))
    assert.isTrue(await sortedTroves.contains(B))
    assert.isTrue(await sortedTroves.contains(C))
    assert.isFalse(await sortedTroves.contains(D))
    assert.isFalse(await sortedTroves.contains(whale))

    const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
    const B_debt_after = await troveManager.getTroveDebt(B)

    const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
    const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

    const active_pool_after = await activePool.getCollateral(weth.address)

    // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
    await th.assertIsApproximatelyEqual(
      A_YUSD_Balance_After,
      A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(estimatedYUSDFee),
      100000)

    // Assert that B's debt has decreased by the correct amount of YUSD. 1800 * 2 offset from other troves.
    assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount).add(toBN(dec(3600, 18)))))

    // Make sure that A gained an appropriate amount of collateral
    assert.isTrue(A_WETH_Balance_After.eq(A_WETH_Balance_Before.add(finalYUSDAmount.div(th.toBN(200)))))

    // Make sure that B lost that amount of collateral. Total collateral offset with 18 eth from other troves.
    assert.isTrue(B_WETH_Collateral_After.eq(B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(200))).add(toBN(dec(18, 18)))))

    // Make sure active pool has decreased by the correct amount of WETH
    assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(200))).sub(toBN(dec(81, 18)))))
  })

  it("redeemCollateral(): doesn't perform partial redemption if resultant debt would be < minimum net debt", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(9999, 18)], { from: B })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), C, C, [contracts.weth.address], [dec(51, 18)], { from: C })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), D, D, [contracts.weth.address], [dec(50, 18)], { from: D })

    await troveManager.setBaseRate(0)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
    const B_debt_before = await troveManager.getTroveDebt(B)

    const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
    const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

    const active_pool_before = await activePool.getCollateral(weth.address)

    // YUSD redemption is 3000. Should stop after redeeming against trove D
    const YUSDRedemption = dec(3000, 18)
    const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
    const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);
    const estimatedYUSDAmount = toBN(dec(1800, 18))
    const estimatedYUSDFee = await th.estimateRedemptionFee(contracts, estimatedYUSDAmount)

    const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
    // const tx1 = await th.performRedemptionTx(A, 0, contracts, YUSDRedemption, 0, th._100pct, 2)
    assert.isTrue(tx1.receipt.status)

    const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
    const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
    const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]

    assert.isTrue(actualYUSDAmount.eq(estimatedYUSDAmount))
    assert.isTrue(actualETHAmount.eq(estimatedYUSDAmount.div(toBN(200))))
    console.log("Actual fee", actualYUSDFee.toString())
    console.log("Actual fee estimation", estimatedYUSDFee.toString())
    assert.isTrue(actualYUSDFee.lt(estimatedYUSDFee))

    assert.isTrue(await sortedTroves.contains(A))
    assert.isTrue(await sortedTroves.contains(B))
    assert.isTrue(await sortedTroves.contains(C))
    assert.isFalse(await sortedTroves.contains(D))

    const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
    const B_debt_after = await troveManager.getTroveDebt(B)

    const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
    const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

    const active_pool_after = await activePool.getCollateral(weth.address)

    // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
    await th.assertIsApproximatelyEqual(
      A_YUSD_Balance_After,
      A_YUSD_Balance_Before.sub(estimatedYUSDAmount).sub(estimatedYUSDFee),
      100000)

    // Assert that B's debt has decreased by the correct amount of YUSD. 1800 * 2 offset from other troves.
    assert.isTrue(B_debt_after.eq(B_debt_before.sub(estimatedYUSDAmount).add(toBN(dec(1800, 18)))))

    // Make sure that A gained an appropriate amount of collateral
    assert.isTrue(A_WETH_Balance_After.eq(A_WETH_Balance_Before.add(estimatedYUSDAmount.div(th.toBN(200)))))

    // Make sure that B lost that amount of collateral. Total collateral offset with 18 eth from other troves.
    assert.isTrue(B_WETH_Collateral_After.eq(B_WETH_Collateral_Before.sub(estimatedYUSDAmount.div(th.toBN(200))).add(toBN(dec(9, 18)))))

    // Make sure active pool has decreased by the correct amount of WETH
    assert.isTrue(active_pool_after.eq(active_pool_before.sub(estimatedYUSDAmount.div(th.toBN(200))).sub(toBN(dec(41, 18)))))
  })

  //TODO hints? do we care...
  xit('redeemCollateral(): doesnt perform the final partial redemption in the sequence if the hint is out-of-date', async () => {
    // --- SETUP ---
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(363, 16)), extraYUSDAmount: dec(5, 18), extraParams: { from: alice } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(3331, 15)), extraYUSDAmount: dec(8, 18), extraParams: { from: bob } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(333, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: carol } })
    // const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(350, 16)), extraYUSDAmount: dec(10000, 18), extraParams: { from: whale } })

    const partialRedemptionAmount = toBN(2)
    const fullfilledRedemptionAmount = C_netDebt.add(B_netDebt)
    const redemptionAmount = fullfilledRedemptionAmount.add(partialRedemptionAmount)
    console.log("REDEMPTION AMOUNT" , redemptionAmount.toString())
    await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: redemptionAmount, extraParams: { from: dennis } })

    const dennis_ETHBalance_Before = toBN(await weth.balanceOf(dennis))

    const dennis_YUSDBalance_Before = await yusdToken.balanceOf(dennis)

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST --- 
    console.log("ICRS BEFORE ")
    console.log((await troveManager.getCurrentICR(alice)).toString())
    console.log((await troveManager.getCurrentICR(bob)).toString())
    console.log((await troveManager.getCurrentICR(carol)).toString())

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(redemptionAmount, 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      dennis,
      dennis
    )

    const frontRunRedemption = toBN(dec(1, 18))
    // Oops, another transaction gets in the way
    {
      const {
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints(dec(1, 18), 0)

      const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(
        partialRedemptionHintICR,
        dennis,
        dennis
      )

      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      // Alice redeems 1 YUSD from Carol's Trove
      await troveManager.redeemCollateral(
        frontRunRedemption,
        frontRunRedemption,
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintICR,
        0,
        // th._100pct,
        { from: alice }
      )
    }

    console.log("ICRS AFTER ")
    console.log((await troveManager.getCurrentICR(alice)).toString())
    console.log((await troveManager.getCurrentICR(bob)).toString())
    console.log((await troveManager.getCurrentICR(carol)).toString())

    // Dennis tries to redeem 20 YUSD
    const redemptionTx = await troveManager.redeemCollateral(
      redemptionAmount,
      redemptionAmount,
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintICR,
      0,
      // th._100pct,
      {
        from: dennis,
        gasPrice: 0
      }
    )

    const YUSDFee = th.getEmittedRedemptionValues(redemptionTx)[2]

    // Since Alice already redeemed 1 YUSD from Carol's Trove, Dennis was  able to redeem:
    //  - 9 YUSD from Carol's
    //  - 8 YUSD from Bob's
    // for a total of 17 YUSD.

    // Dennis calculated his hint for redeeming 2 YUSD from Alice's Trove, but after Alice's transaction
    // got in the way, he would have needed to redeem 3 YUSD to fully complete his redemption of 20 YUSD.
    // This would have required a different hint, therefore he ended up with a partial redemption.

    const dennis_ETHBalance_After = toBN(await weth.balanceOf(dennis))
    const receivedETH = dennis_ETHBalance_After.sub(dennis_ETHBalance_Before)

    // Expect only 17 worth of ETH drawn
    const expectedTotalETHDrawn = fullfilledRedemptionAmount.sub(frontRunRedemption).div(toBN(200)) // redempted YUSD converted to ETH, at ETH:USD price 200
    const expectedReceivedETH = expectedTotalETHDrawn//.sub(ETHFee)

    th.assertIsApproximatelyEqual(expectedReceivedETH, receivedETH)

    console.log("ALICE DEBT BEFORE  ", A_totalDebt.toString())
    console.log("ALICE DEBT AFTER ", (await th.getTroveEntireDebt(contracts, alice)).toString())

    const dennis_YUSDBalance_After = (await yusdToken.balanceOf(dennis)).toString()
    console.log("dennis YUDS Balance before ", dennis_YUSDBalance_Before.sub(YUSDFee).sub(fullfilledRedemptionAmount).sub(frontRunRedemption).toString())
    console.log("dennis YUDS Balance after ", dennis_YUSDBalance_After.toString())
    th.assertIsApproximatelyEqual(dennis_YUSDBalance_After, dennis_YUSDBalance_Before.sub(YUSDFee).sub(fullfilledRedemptionAmount).sub(frontRunRedemption))
  })

  // active debt cannot be zero, as there’s a positive min debt enforced, and at least a trove must exist
  it.skip("redeemCollateral(): can redeem if there is zero active debt but non-zero debt in DefaultPool", async () => {
    // --- SETUP ---
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })

    const amount = await getOpenTroveYUSDAmount(dec(110, 18))
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(133, 16)), extraYUSDAmount: amount, extraParams: { from: bob } })

    await yusdToken.transfer(carol, amount, { from: bob })

    const price = dec(100, 18)
    await priceFeed.setPrice(price)

    // Liquidate Bob's Trove
    await troveManager.liquidateTroves(1)

    // --- TEST --- 

    const carol_ETHBalance_Before = toBN(await weth.balanceOf(carol))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const redemptionTx = await troveManager.redeemCollateral(
      amount,
      alice,
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      '10367038690476190477',
      0,
      th._100pct,
      {
        from: carol,
        gasPrice: 0
      }
    )

    const ETHFee = th.getEmittedRedemptionValues(redemptionTx)[3]

    const carol_ETHBalance_After = toBN(await weth.balanceOf(carol))

    const expectedTotalETHDrawn = toBN(amount).div(toBN(100)) // convert 100 YUSD to ETH at ETH:USD price of 100
    const expectedReceivedETH = expectedTotalETHDrawn.sub(ETHFee)

    const receivedETH = carol_ETHBalance_After.sub(carol_ETHBalance_Before)
    assert.isTrue(expectedReceivedETH.eq(receivedETH))

    const carol_YUSDBalance_After = (await yusdToken.balanceOf(carol)).toString()
    assert.equal(carol_YUSDBalance_After, '0')
  })

  // TODO Reinsert
  it("redeemCollateral(): doesn't touch Troves with ICR < 110%", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), A, A, [contracts.weth.address], [dec(10000, 18)], { from: A })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), B, B, [contracts.weth.address], [dec(9999, 18)], { from: B })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), C, C, [contracts.weth.address], [dec(18, 18)], { from: C })
    await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2000, 18)), D, D, [contracts.weth.address], [dec(20, 18)], { from: D })

    // Put ICR < 110% for C and D
    const price = dec(100, 18)

    priceFeed.setPrice(price)
    await troveManager.updateTroves([A, B, C, D], [A, A, A, A], [D, D, D, D])

    await troveManager.setBaseRate(0)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_YUSD_Balance_Before = await contracts.yusdToken.balanceOf(A)
    const B_debt_before = await troveManager.getTroveDebt(B)

    const A_WETH_Balance_Before = await contracts.weth.balanceOf(A)
    const B_WETH_Collateral_Before = (await th.getTroveEntireColl(contracts, B))[0]

    const active_pool_before = await activePool.getCollateral(weth.address)

    // YUSD redemption is 3000. Should do against B.
    const YUSDRedemption = dec(3000, 18)
    const finalYUSDAmount = await th.estimateYUSDEligible(contracts, YUSDRedemption)
    const finalYUSDFeeAmount = th.toBN(YUSDRedemption).sub(finalYUSDAmount);
    const estimatedYUSDAmount = toBN(dec(1800, 18))
    const estimatedYUSDFee = await th.estimateRedemptionFee(contracts, estimatedYUSDAmount)

    const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, YUSDRedemption, th._100pct)
    // const tx1 = await th.performRedemptionTx(A, 0, contracts, YUSDRedemption, 0, th._100pct, 2)
    assert.isTrue(tx1.receipt.status)

    const actualYUSDAmount = (th.getEmittedRedemptionValues(tx1))[1]
    const actualYUSDFee = (th.getEmittedRedemptionValues(tx1))[2]
    const actualETHAmount = (th.getEmittedRedemptionValues(tx1))[4][0]

    console.log(`YUSD Amount: ${actualYUSDAmount}`)
    console.log(`YUSD amount estimated: ${finalYUSDAmount}`)
    assert.isTrue(actualYUSDAmount.eq(finalYUSDAmount))
    assert.isTrue(actualETHAmount.eq(finalYUSDAmount.div(toBN(100))))
    assert.isTrue(actualYUSDFee.lt(finalYUSDFeeAmount))

    assert.isTrue(await sortedTroves.contains(A))
    assert.isTrue(await sortedTroves.contains(B))
    assert.isTrue(await sortedTroves.contains(C))
    assert.isTrue(await sortedTroves.contains(D))

    const A_YUSD_Balance_After = await contracts.yusdToken.balanceOf(A)
    const B_debt_after = await troveManager.getTroveDebt(B)

    assert.isTrue(B_debt_after.lt(B_debt_before))
    // return

    const A_WETH_Balance_After = await contracts.weth.balanceOf(A)
    const B_WETH_Collateral_After = (await th.getTroveEntireColl(contracts, B))[0]

    const active_pool_after = await activePool.getCollateral(weth.address)

    // Assert that A lost the correct amount of YUSD. Approximate because fee amount not correct
    await th.assertIsApproximatelyEqual(
      A_YUSD_Balance_After,
      A_YUSD_Balance_Before.sub(finalYUSDAmount).sub(finalYUSDFeeAmount), 2000)

    // Assert that B's debt has decreased by the correct amount of YUSD.

    assert.isTrue(B_debt_after.eq(B_debt_before.sub(finalYUSDAmount)))

    // Make sure that A gained an appropriate amount of collateral
    assert.isTrue(A_WETH_Balance_After.eq(A_WETH_Balance_Before.add(finalYUSDAmount.div(th.toBN(100)))))

    // Make sure that B lost that amount of collateral. Total collateral offset with 18 eth from other troves.
    console.log("B BEFORE ", B_WETH_Collateral_Before.toString())
    console.log("B AFTER ", B_WETH_Collateral_After.toString())
    await th.assertIsApproximatelyEqual(B_WETH_Collateral_After, B_WETH_Collateral_Before.sub(finalYUSDAmount.div(th.toBN(100))))

    // Make sure active pool has decreased by the correct amount of WETH
    assert.isTrue(active_pool_after.eq(active_pool_before.sub(finalYUSDAmount.div(th.toBN(100)))))
  })

  // TODO Price update.
  xit("redeemCollateral(): finds the last Trove with ICR == 110% even if there is more than one", async () => {
    // --- SETUP ---
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    const amount1 = toBN(dec(100, 18)).sub(toBN(100))
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: amount1, extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: amount1, extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: amount1, extraParams: { from: carol } })
    const redemptionAmount = C_totalDebt.add(B_totalDebt).add(A_totalDebt)
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(195, 16)), extraYUSDAmount: redemptionAmount, extraParams: { from: dennis } })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
    const price = '110' + _18_zeros
    await priceFeed.setPrice(price)
    await troveManager.updateTroves([carol, alice, bob, dennis], [carol, alice, bob, dennis], [carol, alice, bob, dennis])

    const orderOfTroves = [];
    let current = await sortedTroves.getFirst();

    while (current !== '0x0000000000000000000000000000000000000000') {
      orderOfTroves.push(current);
      current = await sortedTroves.getNext(current);
    }

    assert.deepEqual(orderOfTroves, [bob, alice, carol, dennis]);

    const { totalDebt: whale_totalDebt } = await openTrove({ ICR: toBN(dec(100, 18)), extraYUSDAmount: dec(10, 18), extraParams: { from: whale } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const tx = await troveManager.redeemCollateral(
      redemptionAmount,
      redemptionAmount,
      carol, // try to trick redeemCollateral by passing a hint that doesn't exactly point to the
      // last Trove with ICR == 110% (which would be Alice's)
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      0,
      0,
      // th._100pct,
      { from: dennis }
    )
    assert.isTrue(tx.receipt.status)

    const alice_Debt_After = await troveManager.getTroveDebt(alice)
    const bob_Debt_After = await troveManager.getTroveDebt(bob)
    const carol_Debt_After = await troveManager.getTroveDebt(carol)
    const dennis_Debt_After = await troveManager.getTroveDebt(dennis)
    const whale_Debt_After = await troveManager.getTroveDebt(whale)

    assert.equal(alice_Debt_After, '0')
    assert.equal(bob_Debt_After, '0')
    assert.equal(carol_Debt_After, '0')

    th.assertIsApproximatelyEqual(dennis_Debt_After, D_totalDebt)
  });

  it("redeemCollateral(): reverts when TCR < MCR", async () => {
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(196, 16)), extraParams: { from: dennis } })

    // This will put Dennis slightly below 110%, and everyone else exactly at 110%
  
    await priceFeed.setPrice('110' + _18_zeros)
    const price = await priceFeed.getPrice()
    
    const TCR = (await th.getTCR(contracts))
    assert.isTrue(TCR.lt(toBN('1100000000000000000')))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await assertRevert(th.redeemCollateral(carol, contracts, dec(270, 18)), "TroveManager: Cannot redeem when TCR < MCR")
  });

  it("redeemCollateral(): reverts when argument _amount is 0", async () => {
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 500YUSD to Erin, the would-be redeemer
    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(500, 18), extraParams: { from: alice } })
    await yusdToken.transfer(erin, dec(500, 18), { from: alice })

    // B, C and D open troves
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraParams: { from: dennis } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin attempts to redeem with _amount = 0
    const redemptionTxPromise = troveManager.redeemCollateral(0, 1000, erin, erin, erin, 0, 0, { from: erin })
    await assertRevert(redemptionTxPromise, "TroveManager: Amount must be greater than zero")
  })

  it("redeemCollateral(): reverts if max fee > 100%", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })

    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(20, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(30, 18), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(40, 18), extraParams: { from: D } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), dec(2, 18)), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert( th.performRedemptionWithMaxFeeAmount(A, contracts, dec(10, 18), dec(11, 18)), "Max fee percentage must be between 0.5% and 100%")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), '1000000000000000001'), "Max fee percentage must be between 0.5% and 100%")
  })

  it("redeemCollateral(): reverts if max fee < 0.5%", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(10, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(20, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(30, 18), extraParams: { from: C } })
    await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(40, 18), extraParams: { from: D } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await assertRevert( th.performRedemptionWithMaxFeeAmount(A, contracts, dec(10, 18), toBN('4999999999999999')), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert( th.performRedemptionWithMaxFeeAmount(A, contracts, dec(10, 18), dec(1, 0)), "Max fee percentage must be between 0.5% and 100%")
    await assertRevert( th.performRedemptionWithMaxFeeAmount(A, contracts, dec(10, 18), dec(0, 0)), "Max fee percentage must be between 0.5% and 100%")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), 0), "Max fee percentage must be between 0.5% and 100%")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), 1), "Max fee percentage must be between 0.5% and 100%")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18), '4999999999999999'), "Max fee percentage must be between 0.5% and 100%")
  })

  it("redeemCollateral(): reverts if fee exceeds max fee percentage", async () => {
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(8000, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(9000, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(10000, 18), extraParams: { from: C } })
    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

    // Check total YUSD supply
    const totalSupply = await yusdToken.totalSupply()
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

    await troveManager.setBaseRate(0) 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // YUSD redemption is 27 USD: a redemption that incurs a fee of 27/(270 * 2) = 5%
    const attemptedYUSDRedemption = expectedTotalSupply.div(toBN(10))

    // Max fee is <5%
    const lessThan5pct = '49999999999999999'
    console.log("This is attempted YUSD Amount ", attemptedYUSDRedemption.toString())
    console.log("Max fee is supposed to be ", toBN(lessThan5pct).mul(attemptedYUSDRedemption).div(toBN(dec(1, 18))).toString())
    // await assertRevert(
    await assertRevert(th.performRedemptionWithMaxFeeAmount(A, contracts, attemptedYUSDRedemption, toBN(lessThan5pct).mul(attemptedYUSDRedemption).div(toBN(dec(1, 18)))), "Fee exceeded provided maximum")
    // , "Fee exceeded provided maximum")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedYUSDRedemption, lessThan5pct), "Fee exceeded provided maximum")
  
    await troveManager.setBaseRate(0)  // artificially zero the baseRate
    
    // Max fee is 1%
    await assertRevert(th.performRedemptionWithMaxFeeAmount(A, contracts, attemptedYUSDRedemption, toBN(dec(1, 16)).mul(attemptedYUSDRedemption).div(toBN(dec(1, 18)))), "Fee exceeded provided maximum")
    // th.redeemCollateralAndGetTxObject(A, contracts, attemptedYUSDRedemption, dec(1, 16)), "Fee exceeded provided maximum")
  
    await troveManager.setBaseRate(0)

     // Max fee is 3.754%
     await assertRevert(th.performRedemptionWithMaxFeeAmount(A, contracts, attemptedYUSDRedemption, toBN(dec(3754, 13)).mul(attemptedYUSDRedemption).div(toBN(dec(1, 18)))), "Fee exceeded provided maximum")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedYUSDRedemption, dec(3754, 13)), "Fee exceeded provided maximum")
  
    await troveManager.setBaseRate(0)

    // Max fee is 0.5%
    await assertRevert(th.performRedemptionWithMaxFeeAmount(A, contracts, attemptedYUSDRedemption, toBN(dec(5, 15)).mul(attemptedYUSDRedemption).div(toBN(dec(1, 18)))), "Fee exceeded provided maximum")
    // await assertRevert(th.redeemCollateralAndGetTxObject(A, contracts, attemptedYUSDRedemption, dec(5, 15)), "Fee exceeded provided maximum")
  })

  it("redeemCollateral(): succeeds if fee is less than max fee percentage", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(9500, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(395, 16)), extraYUSDAmount: dec(9000, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(390, 16)), extraYUSDAmount: dec(10000, 18), extraParams: { from: C } })
    const expectedTotalSupply = A_totalDebt.add(B_totalDebt).add(C_totalDebt)

    // Check total YUSD supply
    const totalSupply = await yusdToken.totalSupply()
    th.assertIsApproximatelyEqual(totalSupply, expectedTotalSupply)

    await troveManager.setBaseRate(0) 

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // YUSD redemption fee with 10% of the supply will be 0.5% + 1/(10*2)
    const attemptedYUSDRedemption = expectedTotalSupply.div(toBN(10))

    // Attempt with maxFee > 5.5%
    const price = await priceFeed.getPrice()
    const ETHDrawn = attemptedYUSDRedemption.mul(mv._1e18BN).div(price)
    const slightlyMoreThanFee = (await troveManager.getRedemptionFeeWithDecay(ETHDrawn))
    console.log("attempted YUSD  DRAWN ", attemptedYUSDRedemption.toString())
    console.log("SLIGHTLY MORE THAN FEE ", slightlyMoreThanFee.toString())
    const tx1 = await th.performRedemptionWithMaxFeeAmount(A, contracts, attemptedYUSDRedemption, slightlyMoreThanFee.mul(attemptedYUSDRedemption).div(toBN(dec(1,18))))
    // const tx1 = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedYUSDRedemption, slightlyMoreThanFee)
    assert.isTrue(tx1.receipt.status)

    await troveManager.setBaseRate(0)  // Artificially zero the baseRate
    
    // Attempt with maxFee = 5.5%
    const exactSameFee = (await troveManager.getRedemptionFeeWithDecay(ETHDrawn))
    console.log("attempted YUSD  DRAWN ", attemptedYUSDRedemption.toString())
    console.log("EXAC FEE  ", exactSameFee.toString())
    const tx2 = await th.performRedemptionWithMaxFeeAmount(C, contracts, attemptedYUSDRedemption, exactSameFee.mul(attemptedYUSDRedemption).div(toBN(dec(1,18))))
    // const tx2 = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedYUSDRedemption, exactSameFee)
    assert.isTrue(tx2.receipt.status)

    await troveManager.setBaseRate(0)

     // Max fee is 10%
    const tx3 = await th.redeemCollateralAndGetTxObject(B, contracts, attemptedYUSDRedemption, dec(1, 17))
    assert.isTrue(tx3.receipt.status)

    await troveManager.setBaseRate(0)

    // Max fee is 37.659%
    const tx4 = await th.redeemCollateralAndGetTxObject(A, contracts, attemptedYUSDRedemption, dec(37659, 13))
    assert.isTrue(tx4.receipt.status)

    await troveManager.setBaseRate(0)

    // Max fee is 100%
    const tx5 = await th.redeemCollateralAndGetTxObject(C, contracts, attemptedYUSDRedemption, dec(1, 18))
    assert.isTrue(tx5.receipt.status)
  })

  it("redeemCollateral(): doesn't affect the Stability Pool deposits or ETH gain of redeemed-from troves", async () => {
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await th.addERC20(contracts.weth, flyn, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: flyn })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // B, C, D, F open trove
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(195, 16)), extraYUSDAmount: dec(200, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(400, 18), extraParams: { from: dennis } })
    const { totalDebt: F_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: flyn } })

    const redemptionAmount = B_totalDebt.add(C_totalDebt).add(D_totalDebt).add(F_totalDebt)
    // Alice opens trove and transfers YUSD to Erin, the would-be redeemer
    await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: redemptionAmount, extraParams: { from: alice } })
    await yusdToken.transfer(erin, redemptionAmount, { from: alice })

    // B, C, D deposit some of their tokens to the Stability Pool
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: bob })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: carol })
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: dennis })

    let price = await priceFeed.getPrice()
    const bob_ICR_before = await troveManager.getCurrentICR(bob)
    const carol_ICR_before = await troveManager.getCurrentICR(carol)
    const dennis_ICR_before = await troveManager.getCurrentICR(dennis)

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    assert.isTrue(await sortedTroves.contains(flyn))

    // Liquidate Flyn
    await troveManager.liquidate(flyn)
    assert.isFalse(await sortedTroves.contains(flyn))

    // Price bounces back, bringing B, C, D back above MCR
    await priceFeed.setPrice(dec(200, 18))

    const bob_SPDeposit_before = (await stabilityPool.getCompoundedYUSDDeposit(bob)).toString()
    const carol_SPDeposit_before = (await stabilityPool.getCompoundedYUSDDeposit(carol)).toString()
    const dennis_SPDeposit_before = (await stabilityPool.getCompoundedYUSDDeposit(dennis)).toString()

    const bob_ETHGain_before = (await stabilityPool.getDepositorGains(bob))[1][0].toString()
    const carol_ETHGain_before = (await stabilityPool.getDepositorGains(carol))[1][0].toString()
    const dennis_ETHGain_before = (await stabilityPool.getDepositorGains(dennis))[1][0].toString()

    // Check the remaining YUSD and ETH in Stability Pool after liquidation is non-zero
    const YUSDinSP = await stabilityPool.getTotalYUSDDeposits()
    const ETHinSP = await stabilityPool.getCollateral(contracts.weth.address)
    assert.isTrue(YUSDinSP.gte(mv._zeroBN))
    assert.isTrue(ETHinSP.gte(mv._zeroBN))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin redeems YUSD
    await th.redeemCollateral(erin, contracts, redemptionAmount, th._100pct)

    price = await priceFeed.getPrice()
    const bob_ICR_after = await troveManager.getCurrentICR(bob)
    const carol_ICR_after = await troveManager.getCurrentICR(carol)
    const dennis_ICR_after = await troveManager.getCurrentICR(dennis)

    // Check ICR of B, C and D troves has increased,i.e. they have been hit by redemptions
    assert.isTrue(bob_ICR_after.gte(bob_ICR_before))
    assert.isTrue(carol_ICR_after.gte(carol_ICR_before))
    assert.isTrue(dennis_ICR_after.gte(dennis_ICR_before))

    const bob_SPDeposit_after = (await stabilityPool.getCompoundedYUSDDeposit(bob)).toString()
    const carol_SPDeposit_after = (await stabilityPool.getCompoundedYUSDDeposit(carol)).toString()
    const dennis_SPDeposit_after = (await stabilityPool.getCompoundedYUSDDeposit(dennis)).toString()

    const bob_ETHGain_after = (await stabilityPool.getDepositorGains(bob))[1][0].toString()
    const carol_ETHGain_after = (await stabilityPool.getDepositorGains(carol))[1][0].toString()
    const dennis_ETHGain_after = (await stabilityPool.getDepositorGains(dennis))[1][0].toString()

    // Check B, C, D Stability Pool deposits and ETH gain have not been affected by redemptions from their troves
    assert.equal(bob_SPDeposit_before, bob_SPDeposit_after)
    assert.equal(carol_SPDeposit_before, carol_SPDeposit_after)
    assert.equal(dennis_SPDeposit_before, dennis_SPDeposit_after)

    assert.equal(bob_ETHGain_before, bob_ETHGain_after)
    assert.equal(carol_ETHGain_before, carol_ETHGain_after)
    assert.equal(dennis_ETHGain_before, dennis_ETHGain_after)
  })

  it("redeemCollateral(): caller can redeem their entire YUSDToken balance", async () => {
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })

    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 400 YUSD to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(400, 18), extraParams: { from: alice } })
    await yusdToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await yusdToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open trove
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(500, 16)), extraYUSDAmount: dec(1990, 18), extraParams: { from: dennis } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getYUSDDebt()
    const activePool_coll_before = await activePool.getCollateral(weth.address)

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt)
    assert.equal(activePool_coll_before.toString(), totalColl)

    const price = await priceFeed.getPrice()

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin attempts to redeem 400 YUSD
    const finalYUSDAmount = await th.estimateYUSDEligible(contracts, dec(400, 18))
    const finalYUSDFeeAmount = toBN(toBN(dec(400, 18))).sub(finalYUSDAmount);
    await th.performRedemptionTx(erin, price, contracts, dec(400, 18))
    const activePool_debt_after = await activePool.getYUSDDebt()
    assert.equal(activePool_debt_before.sub(activePool_debt_after).toString(), finalYUSDAmount.toString())

    /* Check ActivePool coll reduced by $400 ish worth of Ether: at ETH:USD price of $200

    therefore remaining ActivePool ETH should be 198 */
    const activePool_coll_after = await activePool.getCollateral(weth.address)
    assert.equal(activePool_coll_after.toString(), activePool_coll_before.sub(finalYUSDAmount.div(toBN(200))).toString())

    // Check Erin's balance after
    const erin_balance_after = (await yusdToken.balanceOf(erin)).toString()

    await th.assertIsApproximatelyEqual(erin_balance_after, 0)
  })

  it("redeemCollateral(): reverts when requested redemption amount exceeds caller's YUSD token balance", async () => {
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    const { collateral: W_coll, totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 400 YUSD to Erin, the would-be redeemer
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(400, 18), extraParams: { from: alice } })
    await yusdToken.transfer(erin, dec(400, 18), { from: alice })

    // Check Erin's balance before
    const erin_balance_before = await yusdToken.balanceOf(erin)
    assert.equal(erin_balance_before, dec(400, 18))

    // B, C, D open trove
    const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(590, 18), extraParams: { from: bob } })
    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(1990, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(500, 16)), extraYUSDAmount: dec(1990, 18), extraParams: { from: dennis } })

    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)
    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    // Get active debt and coll before redemption
    const activePool_debt_before = await activePool.getYUSDDebt()
    const activePool_coll_before = (await activePool.getCollateral(weth.address)).toString()

    th.assertIsApproximatelyEqual(activePool_debt_before, totalDebt)
    assert.equal(activePool_coll_before, totalColl)

    const price = await priceFeed.getPrice()

    let firstRedemptionHint
    let partialRedemptionHintICR

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Erin tries to redeem 1000 YUSD
    try {
      const redemptionTx = await th.performRedemptionTx(erin, 0, contracts, dec(1000, 18))

      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's YUSD token balance")
    }

    // Erin tries to redeem 401 YUSD
    try {
      const redemptionTx = await th.performRedemptionTx(erin, 0, contracts, dec(401, 18))
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's YUSD token balance")
    }

    // Erin tries to redeem 239482309 YUSD
    try {
      const redemptionTx = await th.performRedemptionWithMaxFeeAmount(erin, contracts, toBN('239482309000000000000000000'), toBN('23948230900000000000000000'))
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      // console.log("ERROR ", error)
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's YUSD token balance")
    }

    // Erin tries to redeem 2^256 - 1 YUSD
    const maxBytes32 = toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

    try {
      ({
        firstRedemptionHint,
        partialRedemptionHintICR
      } = await hintHelpers.getRedemptionHints('239482309000000000000000000', 0))

      const { 0: upperPartialRedemptionHint_4, 1: lowerPartialRedemptionHint_4 } = await sortedTroves.findInsertPosition(
        partialRedemptionHintICR,
        erin,
        erin
      )
        console.log("HLHLENFL")
      const redemptionTx = await troveManager.redeemCollateral(
        maxBytes32,
        maxBytes32,
        firstRedemptionHint,
        upperPartialRedemptionHint_4,
        lowerPartialRedemptionHint_4,
        partialRedemptionHintICR,
        0,
        // th._100pct,
        { from: erin })
      // const redemptionTx = await th.performRedemptionWithMaxFeeAmount(erin, contracts, maxBytes32, maxBytes32)
      assert.isFalse(redemptionTx.receipt.status)
    } catch (error) {
      assert.include(error.message, "revert")
      assert.include(error.message, "Requested redemption amount must be <= user's YUSD token balance")
    }
  })


  it("redeemCollateral(): value of issued ETH == face value of redeemed YUSD (assuming 1 YUSD has value of $1)", async () => {
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: alice })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    const { collateral: W_coll } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    // Alice opens trove and transfers 1000 YUSD each to Erin, Flyn, Graham
    const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(400, 16)), extraYUSDAmount: dec(4990, 18), extraParams: { from: alice } })
    await yusdToken.transfer(erin, dec(1000, 18), { from: alice })
    await yusdToken.transfer(flyn, dec(1000, 18), { from: alice })
    await yusdToken.transfer(graham, dec(1000, 18), { from: alice })

    // B, C, D open trove
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(300, 16)), extraYUSDAmount: dec(1590, 18), extraParams: { from: bob } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(600, 16)), extraYUSDAmount: dec(1090, 18), extraParams: { from: carol } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(800, 16)), extraYUSDAmount: dec(1090, 18), extraParams: { from: dennis } })

    const totalColl = W_coll.add(A_coll).add(B_coll).add(C_coll).add(D_coll)

    const price = await priceFeed.getPrice()

    const _120_YUSD = '120000000000000000000'
    const _373_YUSD = '373000000000000000000'
    const _950_YUSD = '950000000000000000000'

    // Check Ether in activePool
    const activeETH_0 = await activePool.getCollateral(weth.address)
    assert.equal(activeETH_0, totalColl.toString());

    let firstRedemptionHint
    let partialRedemptionHintICR


    // Erin redeems 120 YUSD
    ({
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(_120_YUSD, 0))

    const { 0: upperPartialRedemptionHint_1, 1: lowerPartialRedemptionHint_1 } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      erin,
      erin
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const toApprove = toBN(1000).mul(th.toBN(_120_YUSD));
    await yusdToken.approve(troveManagerRedemptions.address, toApprove, {from: erin})

    const redemption_1 = await troveManager.redeemCollateral(
      _120_YUSD,
      _120_YUSD,
      firstRedemptionHint,
      upperPartialRedemptionHint_1,
      lowerPartialRedemptionHint_1,
      partialRedemptionHintICR,
      0,
      // th._100pct,
      { from: erin })

    assert.isTrue(redemption_1.receipt.status);

    /* 120 YUSD redeemed.  Expect $120 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (120/200) = 0.6 ETH
    Total active ETH = 280 - 0.6 = 279.4 ETH */

    const activeETH_1 = await activePool.getCollateral(weth.address)
    assert.equal(activeETH_1.toString(), activeETH_0.sub(toBN(_120_YUSD).mul(mv._1e18BN).div(price)));

    // Flyn redeems 373 YUSD
    ({
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(_373_YUSD, 0))

    const { 0: upperPartialRedemptionHint_2, 1: lowerPartialRedemptionHint_2 } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      flyn,
      flyn
    )

    const redemption_2 = await troveManager.redeemCollateral(
      _373_YUSD,
      _373_YUSD,
      firstRedemptionHint,
      upperPartialRedemptionHint_2,
      lowerPartialRedemptionHint_2,
      partialRedemptionHintICR,
      0,
      //  th._100pct,
      { from: flyn })

    assert.isTrue(redemption_2.receipt.status);

    /* 373 YUSD redeemed.  Expect $373 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (373/200) = 1.865 ETH
    Total active ETH = 279.4 - 1.865 = 277.535 ETH */
    const activeETH_2 = await activePool.getCollateral(weth.address)
    assert.equal(activeETH_2.toString(), activeETH_1.sub(toBN(_373_YUSD).mul(mv._1e18BN).div(price)));

    // Graham redeems 950 YUSD
    ({
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(_950_YUSD, 0))

    const { 0: upperPartialRedemptionHint_3, 1: lowerPartialRedemptionHint_3 } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      graham,
      graham
    )

    const redemption_3 = await troveManager.redeemCollateral(
      _950_YUSD,
      _950_YUSD,
      firstRedemptionHint,
      upperPartialRedemptionHint_3,
      lowerPartialRedemptionHint_3,
      partialRedemptionHintICR,
      0,
      // th._100pct,
      { from: graham })

    assert.isTrue(redemption_3.receipt.status);

    /* 950 YUSD redeemed.  Expect $950 worth of ETH removed. At ETH:USD price of $200, 
    ETH removed = (950/200) = 4.75 ETH
    Total active ETH = 277.535 - 4.75 = 272.785 ETH */
    const activeETH_3 = (await activePool.getCollateral(weth.address)).toString()
    assert.equal(activeETH_3.toString(), activeETH_2.sub(toBN(_950_YUSD).mul(mv._1e18BN).div(price)));
  })

  // it doesn’t make much sense as there’s now min debt enforced and at least one trove must remain active
  // the only way to test it is before any trove is opened
  it.skip("redeemCollateral(): reverts if there is zero outstanding system debt", async () => {
    // --- SETUP --- illegally mint YUSD to Bob
    await yusdToken.unprotectedMint(bob, dec(100, 18))

    assert.equal((await yusdToken.balanceOf(bob)), dec(100, 18))

    const price = await priceFeed.getPrice()

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(dec(100, 18), 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      bob,
      bob
    )

    // Bob tries to redeem his illegally obtained YUSD
    try {
      const redemptionTx = await troveManager.redeemCollateral(
        dec(100, 18),
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintICR,
        0, th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }

    // assert.isFalse(redemptionTx.receipt.status);
  })

  it("redeemCollateral(): reverts if caller's tries to redeem more than the outstanding system debt", async () => {
    await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: bob })
    await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: carol })
    await th.addERC20(contracts.weth, dennis, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: dennis })
    // --- SETUP --- illegally mint YUSD to Bob
    await yusdToken.unprotectedMint(bob, '101000000000000000000')

    assert.equal((await yusdToken.balanceOf(bob)), '101000000000000000000')

    const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(1000, 16)), extraYUSDAmount: dec(40, 18), extraParams: { from: carol } })
    const { collateral: D_coll, totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(1000, 16)), extraYUSDAmount: dec(40, 18), extraParams: { from: dennis } })

    const totalDebt = C_totalDebt.add(D_totalDebt)
    th.assertIsApproximatelyEqual((await activePool.getYUSDDebt()).toString(), totalDebt)

    const price = await priceFeed.getPrice()
    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints('101000000000000000000', 0)

    const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } = await sortedTroves.findInsertPosition(
      partialRedemptionHintICR,
      bob,
      bob
    )

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // Bob attempts to redeem his ill-gotten 101 YUSD, from a system that has 100 YUSD outstanding debt
    try {
      const redemptionTx = await troveManager.redeemCollateral(
        totalDebt.add(toBN(dec(100, 18))),
        totalDebt.add(toBN(dec(100, 18))),
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintICR,
        0,
        // th._100pct,
        { from: bob })
    } catch (error) {
      assert.include(error.message, "VM Exception while processing transaction")
    }
  })

  // Redemption fees 
  it("redeemCollateral(): a redemption made when base rate is zero increases the base rate", async () => {
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_balanceBefore = await yusdToken.balanceOf(A)

    await th.performRedemptionTx(A, 0, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    assert.isTrue((await troveManager.baseRate()).gt(toBN('0')))
  })

  it("redeemCollateral(): a redemption made when base rate is non-zero increases the base rate, for negligible time passed", async () => {
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    const A_balanceBefore = await yusdToken.balanceOf(A)
    const B_balanceBefore = await yusdToken.balanceOf(B)

    // A redeems 10 YUSD
    const redemptionTx_A = await th.redeemCollateralAndGetTxObject(A, contracts, dec(10, 18))
    const timeStamp_A = await th.getTimestampFromTx(redemptionTx_A, web3)

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // B redeems 10 YUSD
    const redemptionTx_B = await th.redeemCollateralAndGetTxObject(B, contracts, dec(10, 18))
    const timeStamp_B = await th.getTimestampFromTx(redemptionTx_B, web3)

    // Check B's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18))))

    // Check negligible time difference (< 1 minute) between txs
    assert.isTrue(Number(timeStamp_B) - Number(timeStamp_A) < 60)

    const baseRate_2 = await troveManager.baseRate()

    // Check baseRate has again increased
    assert.isTrue(baseRate_2.gt(baseRate_1))
  })

  it("redeemCollateral(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation [ @skip-on-coverage ]", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    const A_balanceBefore = await yusdToken.balanceOf(A)

    // A redeems 10 YUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

    // 45 seconds pass
    th.fastForwardTime(45, web3.currentProvider)

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time did not update, as borrower A's 2nd redemption occured
    // since before minimum interval had passed 
    assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

    // 15 seconds passes
    th.fastForwardTime(15, web3.currentProvider)

    // Check that now, at least one hour has passed since lastFeeOpTime_1
    const timeNow = await th.getLatestBlockTimestamp(web3)
    assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

    // Borrower A triggers a fee
    await th.redeemCollateral(A, contracts, dec(1, 18))

    const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

    // Check that the last fee operation time DID update, as A's 2rd redemption occured
    // after minimum interval had passed 
    assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
  })

  it("redeemCollateral(): a redemption made at zero base rate send a non-zero ETHFee to YETI staking contract", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // Get sYETI balance before redemption
    const sYETIBalance_Before = await yusdToken.balanceOf(sYETI.address)

    const A_balanceBefore = await yusdToken.balanceOf(A)

    // A redeems 10 YUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Make sure YUSD Staking contract balance has increased YUSD Balance
    const sYETIBalance_After = toBN(await yusdToken.balanceOf(sYETI.address))
    assert.isTrue(sYETIBalance_After.gt(sYETIBalance_Before))
  })

  it("redeemCollateral(): a redemption made at zero base increases the ETH-fees-per-YETI-staked in sYETI contract", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    // Check YETI Staking ETH-fees-per-YETI-staked before
    const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)

    const A_balanceBefore = await yusdToken.balanceOf(A)

    // A redeems 10 YUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check YETI Staking YUSD-fees higher after redemption
    const F_YUSD_After = await await yusdToken.balanceOf(sYETI.address)
    assert.isTrue(F_YUSD_After.gt(F_YUSD_Before))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate send a non-zero ETHFee to YETI staking contract", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    const A_balanceBefore = await yusdToken.balanceOf(A)
    const B_balanceBefore = await yusdToken.balanceOf(B)

    // A redeems 10 YUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    const sYETIBalance_Before = toBN(await yusdToken.balanceOf(sYETI.address))

    // B redeems 10 YUSD
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18))))

    const sYETIBalance_After = toBN(await yusdToken.balanceOf(sYETI.address))

    // check YETI Staking balance has increased
    assert.isTrue(sYETIBalance_After.gt(sYETIBalance_Before))
  })

  it("redeemCollateral(): a redemption made at a non-zero base rate increases ETH-per-YETI-staked in the staking contract", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    // Check baseRate == 0
    assert.equal(await troveManager.baseRate(), '0')

    const A_balanceBefore = await yusdToken.balanceOf(A)
    const B_balanceBefore = await yusdToken.balanceOf(B)

    // A redeems 10 YUSD
    await th.redeemCollateral(A, contracts, dec(10, 18))

    // Check A's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(A), A_balanceBefore.sub(toBN(dec(10, 18))))

    // Check baseRate is now non-zero
    const baseRate_1 = await troveManager.baseRate()
    assert.isTrue(baseRate_1.gt(toBN('0')))

    // Check YETI Staking YUSD fees before is zero
    const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)

    // B redeems 10 YUSD
    await th.redeemCollateral(B, contracts, dec(10, 18))

    // Check B's balance has decreased by 10 YUSD
    await th.assertIsApproximatelyEqual(await yusdToken.balanceOf(B), B_balanceBefore.sub(toBN(dec(10, 18))))

    const F_YUSD_After = await yusdToken.balanceOf(sYETI.address)

    // check YUSD balance of sYETI has increased
    assert.isTrue(F_YUSD_After.gt(F_YUSD_Before))
  })

  it("redeemCollateral(): a redemption sends the ETH remainder (ETHDrawn - ETHFee) to the redeemer", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    const { totalDebt: W_totalDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: whale } })

    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })
    const totalDebt = W_totalDebt.add(A_totalDebt).add(B_totalDebt).add(C_totalDebt)

    const A_balanceBefore = toBN(await weth.balanceOf(A))

    // Confirm baseRate before redemption is 0
    const baseRate = await troveManager.baseRate()
    assert.equal(baseRate, '0')

    // Check total YUSD supply
    const activeYUSD = await activePool.getYUSDDebt()
    const defaultYUSD = await defaultPool.getYUSDDebt()

    const totalYUSDSupply = activeYUSD.add(defaultYUSD)
    th.assertIsApproximatelyEqual(totalYUSDSupply, totalDebt)

    // A redeems 9 YUSD
    const redemptionAmount = toBN(dec(9, 18))
    await th.performRedemptionWithMaxFeeAmount(A, contracts, redemptionAmount, redemptionAmount)

    // No more eth Fee. :)
    const A_balanceAfter = toBN(await weth.balanceOf(A))

    // check A's ETH balance has increased by 0.045 ETH 
    const price = await priceFeed.getPrice()
    const ETHDrawn = redemptionAmount.mul(mv._1e18BN).div(price)
    th.assertIsApproximatelyEqual(
      A_balanceAfter.sub(A_balanceBefore),
      ETHDrawn,
      100000
    )
  })

  it("redeemCollateral(): a full redemption (leaving trove with 0 debt), closes the trove", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraYUSDAmount: dec(10000, 18), extraParams: { from: whale } })

    const { netDebt: A_netDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: D } })
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(toBN(dec(10, 18)))

    const A_balanceBefore = toBN(await weth.balanceOf(A))
    const B_balanceBefore = toBN(await weth.balanceOf(B))
    const C_balanceBefore = toBN(await weth.balanceOf(C))

    // whale redeems 360 YUSD.  Expect this to fully redeem A, B, C, and partially redeem D.
    await th.performRedemptionWithMaxFeeAmount(whale, contracts, redemptionAmount, redemptionAmount)

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(A))
    assert.isFalse(await sortedTroves.contains(B))
    assert.isFalse(await sortedTroves.contains(C))

    // Check D remains active
    assert.isTrue(await sortedTroves.contains(D))
  })

  const redeemCollateral3Full1Partial = async () => {
    // time fast-forwards 1 year, and multisig stakes 1 YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    await yetiToken.approve(sYETI.address, dec(1, 18), { from: multisig })
    await sYETI.mint(dec(1, 18), { from: multisig })

    const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraYUSDAmount: dec(10000, 18), extraParams: { from: whale } })

    const { netDebt: A_netDebt, collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt, collateral: B_coll } = await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt, collateral: C_coll } = await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })
    const { netDebt: D_netDebt } = await openTrove({ ICR: toBN(dec(280, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: D } })
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(toBN(dec(10, 18)))

    const A_balanceBefore = toBN(await weth.balanceOf(A))
    const B_balanceBefore = toBN(await weth.balanceOf(B))
    const C_balanceBefore = toBN(await weth.balanceOf(C))
    const D_balanceBefore = toBN(await weth.balanceOf(D))

    const A_collBefore = (await troveManager.getTroveColls(A))[1][0]
    const B_collBefore = (await troveManager.getTroveColls(B))[1][0]
    const C_collBefore = (await troveManager.getTroveColls(C))[1][0]
    const D_collBefore = (await troveManager.getTroveColls(D))[1][0]

    // Confirm baseRate before redemption is 0
    const baseRate = await troveManager.baseRate()
    assert.equal(baseRate, '0')

    // whale redeems YUSD.  Expect this to fully redeem A, B, C, and partially redeem D.
    // await th.redeemCollateral(whale, contracts, redemptionAmount)
    await th.performRedemptionWithMaxFeeAmount(whale, contracts, redemptionAmount, redemptionAmount)

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(A))
    assert.isFalse(await sortedTroves.contains(B))
    assert.isFalse(await sortedTroves.contains(C))

    // Check D stays active
    assert.isTrue(await sortedTroves.contains(D))
    
    /*
    At ETH:USD price of 200, with full redemptions from A, B, C:

    ETHDrawn from A = 100/200 = 0.5 ETH --> Surplus = (1-0.5) = 0.5
    ETHDrawn from B = 120/200 = 0.6 ETH --> Surplus = (1-0.6) = 0.4
    ETHDrawn from C = 130/200 = 0.65 ETH --> Surplus = (2-0.65) = 1.35
    */

    const A_balanceAfter = toBN(await weth.balanceOf(A))
    const B_balanceAfter = toBN(await weth.balanceOf(B))
    const C_balanceAfter = toBN(await weth.balanceOf(C))
    const D_balanceAfter = toBN(await weth.balanceOf(D))

    // Check A, B, C’s trove collateral balance is zero (fully redeemed-from troves)
    const A_collAfter = (await troveManager.getTroveColls(A))[1]
    const B_collAfter = (await troveManager.getTroveColls(B))[1]
    const C_collAfter = (await troveManager.getTroveColls(C))[1]
    console.log("A COLL AFTER", A_collAfter.toString())
    assert.isTrue(A_collAfter.length == 0)
    assert.isTrue(B_collAfter.length == 0)
    assert.isTrue(C_collAfter.length == 0)

    // check D's trove collateral balances have decreased (the partially redeemed-from trove)
    const D_collAfter = (await troveManager.getTroveColls(D))[1][0]
    assert.isTrue(D_collAfter.lt(D_collBefore))

    // Check A, B, C (fully redeemed-from troves), and D's (the partially redeemed-from trove) balance has not changed
    assert.isTrue(A_balanceAfter.eq(A_balanceBefore))
    assert.isTrue(B_balanceAfter.eq(B_balanceBefore))
    assert.isTrue(C_balanceAfter.eq(C_balanceBefore))
    assert.isTrue(D_balanceAfter.eq(D_balanceBefore))

    // D is not closed, so cannot open trove
    await assertRevert(
      borrowerOperations.openTrove(th._100pct, 0, ZERO_ADDRESS, ZERO_ADDRESS, [contracts.weth.address], [toBN(dec(10, 18))], { from: D }),
      // openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: D } }),
      // borrowerOperations.openTrove(th._100pct, 0, ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(10, 18) }),
      'BorrowerOps: Trove is active')

    return {
      A_netDebt, A_coll,
      B_netDebt, B_coll,
      C_netDebt, C_coll,
    }
  }

  it("redeemCollateral(): emits correct debt and coll values in each redeemed trove's TroveUpdated event", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    const { netDebt: W_netDebt } = await openTrove({ ICR: toBN(dec(20, 18)), extraYUSDAmount: dec(10000, 18), extraParams: { from: whale } })

    const { netDebt: A_netDebt } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    const { netDebt: B_netDebt } = await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    const { netDebt: C_netDebt } = await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })
    const { totalDebt: D_totalDebt, collateral: D_coll } = await openTrove({ ICR: toBN(dec(280, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: D } })
    const partialAmount = toBN(dec(15, 18))
    const redemptionAmount = A_netDebt.add(B_netDebt).add(C_netDebt).add(partialAmount)

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems YUSD.  Expect this to fully redeem A, B, C, and partially redeem 15 YUSD from D.
    // const redemptionTx = await th.redeemCollateralAndGetTxObject(whale, contracts, redemptionAmount, th._100pct, { gasPrice: 0 })
    const redemptionTx = await th.performRedemptionWithMaxFeeAmount(whale, contracts, redemptionAmount, redemptionAmount)

    // Check A, B, C have been closed
    assert.isFalse(await sortedTroves.contains(A))
    assert.isFalse(await sortedTroves.contains(B))
    assert.isFalse(await sortedTroves.contains(C))

    // Check D stays active
    assert.isTrue(await sortedTroves.contains(D))

    const troveUpdatedEvents = th.getAllEventsByName(redemptionTx, "TroveUpdated")

    // Get each trove's emitted debt and coll 
    const [A_emittedDebt, A_emittedTokens, A_emittedAmounts] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, A)
    const [B_emittedDebt, B_emittedTokens, B_emittedAmounts] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, B)
    const [C_emittedDebt, C_emittedTokens, C_emittedAmounts] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, C)
    const [D_emittedDebt, D_emittedTokens, D_emittedAmounts] = th.getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, D)

    // Expect A, B, C to have 0 emitted debt and coll, since they were closed
    assert.equal(A_emittedDebt, '0')
    assert.equal(A_emittedAmounts.length, 0)
    assert.equal(B_emittedDebt, '0')
    assert.equal(B_emittedAmounts.length, 0)
    assert.equal(C_emittedDebt, '0')
    assert.equal(C_emittedAmounts.length, 0)

    /* Expect D to have lost 15 debt and (at ETH price of 200) 15/200 = 0.075 ETH. 
    So, expect remaining debt = (85 - 15) = 70, and remaining ETH = 1 - 15/200 = 0.925 remaining. */
    const price = await priceFeed.getPrice()
    th.assertIsApproximatelyEqual(D_emittedDebt, D_totalDebt.sub(partialAmount))
    th.assertIsApproximatelyEqual(D_emittedAmounts[0], D_coll.sub(partialAmount.mul(mv._1e18BN).div(price)))
  })

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner to claim", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    const {
      A_netDebt, A_coll,
      B_netDebt, B_coll,
      C_netDebt, C_coll,
    } = await redeemCollateral3Full1Partial()

    const A_balanceBefore = toBN(await weth.balanceOf(A))
    const B_balanceBefore = toBN(await weth.balanceOf(B))
    const C_balanceBefore = toBN(await weth.balanceOf(C))

    // CollSurplusPool endpoint cannot be called directly
    await assertRevert(collSurplusPool.claimColl(A), 'CollSurplusPool: Caller is not Borrower Operations')

    await borrowerOperations.claimCollateral({ from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: C, gasPrice: 0 })

    const A_balanceAfter = toBN(await weth.balanceOf(A))
    const B_balanceAfter = toBN(await weth.balanceOf(B))
    const C_balanceAfter = toBN(await weth.balanceOf(C))

    const price = await priceFeed.getPrice()

    th.assertIsApproximatelyEqual(A_balanceAfter, A_balanceBefore.add(A_coll.sub(A_netDebt.mul(mv._1e18BN).div(price))))
    th.assertIsApproximatelyEqual(B_balanceAfter, B_balanceBefore.add(B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price))))
    th.assertIsApproximatelyEqual(C_balanceAfter, C_balanceBefore.add(C_coll.sub(C_netDebt.mul(mv._1e18BN).div(price))))
  })

  it("redeemCollateral(): a redemption that closes a trove leaves the trove's ETH surplus (collateral - ETH drawn) available for the trove owner after re-opening trove", async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    const {
      A_netDebt, A_coll: A_collBefore,
      B_netDebt, B_coll: B_collBefore,
      C_netDebt, C_coll: C_collBefore,
    } = await redeemCollateral3Full1Partial()

    const price = await priceFeed.getPrice()
    const A_surplus = A_collBefore.sub(A_netDebt.mul(mv._1e18BN).div(price))
    const B_surplus = B_collBefore.sub(B_netDebt.mul(mv._1e18BN).div(price))
    const C_surplus = C_collBefore.sub(C_netDebt.mul(mv._1e18BN).div(price))

    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(190, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: B } })
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(180, 16)), extraYUSDAmount: dec(100, 18), extraParams: { from: C } })

    const A_collAfter = (await troveManager.getTroveColls(A))[1][0]
    const B_collAfter = (await troveManager.getTroveColls(B))[1][0]
    const C_collAfter = (await troveManager.getTroveColls(C))[1][0]

    assert.isTrue(A_collAfter.eq(A_coll))
    assert.isTrue(B_collAfter.eq(B_coll))
    assert.isTrue(C_collAfter.eq(C_coll))

    const A_balanceBefore = toBN(await weth.balanceOf(A))
    const B_balanceBefore = toBN(await weth.balanceOf(B))
    const C_balanceBefore = toBN(await weth.balanceOf(C))

    await borrowerOperations.claimCollateral({ from: A, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: B, gasPrice: 0 })
    await borrowerOperations.claimCollateral({ from: C, gasPrice: 0 })

    const A_balanceAfter = toBN(await weth.balanceOf(A))
    const B_balanceAfter = toBN(await weth.balanceOf(B))
    const C_balanceAfter = toBN(await weth.balanceOf(C))

    th.assertIsApproximatelyEqual(A_balanceAfter, A_balanceBefore.add(A_surplus))
    th.assertIsApproximatelyEqual(B_balanceAfter, B_balanceBefore.add(B_surplus))
    th.assertIsApproximatelyEqual(C_balanceAfter, C_balanceBefore.add(C_surplus))
  })

  // This test is not necessary because the fee has to be paid in YUSD, so you will only get a corresponding
  // Amount of collateral back. TODO
  it.skip('redeemCollateral(): reverts if fee eats up all returned collateral', async () => {
    await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
    await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
    await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
    await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: D })
    await th.addERC20(contracts.weth, whale, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: whale })
    // --- SETUP ---
    const { yusdAmount } = await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: dec(1, 24), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    // --- TEST ---

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    await troveManager.setBaseRate(dec(1, 18))
    const finalYUSDAmount = await th.estimateYUSDEligible(contracts, yusdAmount)
    const finalYUSDFeeAmount = toBN(yusdAmount).sub(finalYUSDAmount)

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await hintHelpers.getRedemptionHints(finalYUSDAmount, 0)


    await assertRevert(
      troveManager.redeemCollateral(
        finalYUSDAmount,
        finalYUSDAmount,
        firstRedemptionHint,
        ZERO_ADDRESS,
        alice,
        partialRedemptionHintICR,
        0,
        {
          from: alice,
          gasPrice: 0
        }
      ),
      'TroveManager: Fee would eat up all returned collateral'
    )
  })

  it("getPendingYUSDDebtReward(): Returns 0 if there is no pending YUSDDebt reward", async () => {
    // Make some troves
    const { totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(100, 18), extraParams: { from: defaulter_1 } })

    await openTrove({ ICR: toBN(dec(3, 18)), extraYUSDAmount: dec(20, 18), extraParams: { from: carol } })

    await openTrove({ ICR: toBN(dec(20, 18)), extraYUSDAmount: totalDebt, extraParams: { from: whale } })
    await stabilityPool.provideToSP(totalDebt, ZERO_ADDRESS, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_YUSDDebt = await troveManager.L_YUSDDebt(weth.address)
    assert.equal(current_L_YUSDDebt, 0)

    const carolSnapshot_L_Coll = (await troveManager.getRewardSnapshotColl(carol, contracts.weth.address))
    assert.equal(carolSnapshot_L_Coll, 0)

    const carolSnapshot_L_YUSDDebt = (await troveManager.getRewardSnapshotYUSD(carol, contracts.weth.address))
    assert.equal(carolSnapshot_L_YUSDDebt, 0)

    const carol_PendingYUSDDebtReward = await troveManager.getPendingYUSDDebtReward(carol)
    assert.equal(carol_PendingYUSDDebtReward, 0)
  })

  it("getPendingETHReward(): Returns 0 if there is no pending Coll reward", async () => {
    // make some troves
    const { totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(100, 18), extraParams: { from: defaulter_1 } })

    await openTrove({ ICR: toBN(dec(3, 18)), extraYUSDAmount: dec(20, 18), extraParams: { from: carol } })

    await openTrove({ ICR: toBN(dec(20, 18)), extraYUSDAmount: totalDebt, extraParams: { from: whale } })
    await stabilityPool.provideToSP(totalDebt, ZERO_ADDRESS, { from: whale })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(defaulter_1)

    // Confirm defaulter_1 liquidated
    assert.isFalse(await sortedTroves.contains(defaulter_1))

    // Confirm there are no pending rewards from liquidation
    const current_L_ETH = await troveManager.L_Coll(weth.address)
    assert.equal(current_L_ETH, 0)

    const carolSnapshot_L_Coll = (await troveManager.getRewardSnapshotColl(carol, contracts.weth.address))
    assert.equal(carolSnapshot_L_Coll, 0)

    const carol_PendingCollReward = (await troveManager.getPendingCollRewards(carol))[1]
    assert.equal(carol_PendingCollReward[0], 0)
    assert.equal(carol_PendingCollReward[1], 0)
  })

  // --- computeICR ---

  it("computeICR(): Returns 0 if trove's coll is worth 0", async () => {
    // const price = 0
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)
    await priceFeed.setPrice(0)

    const ICR = (await troveManager.computeICR([contracts.weth.address], [coll], debt)).toString()

    assert.equal(ICR, 0)
  })

  it("computeICR(): Returns 2^256-1 for ETH:USD = 100, coll = 1 ETH, debt = 100 YUSD", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = dec(100, 18)
    await priceFeed.setPrice(price)

    const ICR = (await troveManager.computeICR([contracts.weth.address], [coll], debt)).toString()

    assert.equal(ICR, dec(1, 18))
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 200 ETH, debt = 30 YUSD", async () => {
    const price = dec(100, 18)
    const coll = dec(200, 'ether')
    const debt = dec(30, 18)

    await priceFeed.setPrice(price)

    const ICR = (await troveManager.computeICR([contracts.weth.address], [coll], debt)).toString()

    assert.isAtMost(th.getDifference(ICR, '666666666666666666666'), 1000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 250, coll = 1350 ETH, debt = 127 YUSD", async () => {
    const price = '250000000000000000000'
    const coll = '1350000000000000000000'
    const debt = '127000000000000000000'

    await priceFeed.setPrice(price)

    const ICR = (await troveManager.computeICR([contracts.weth.address], [coll], debt)).toString()

    assert.isAtMost(th.getDifference(ICR, '2657480314960630000000'), 1000000)
  })

  it("computeICR(): returns correct ICR for ETH:USD = 100, coll = 1 ETH, debt = 54321 YUSD", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = '54321000000000000000000'

    await priceFeed.setPrice(price)

    const ICR = (await troveManager.computeICR([contracts.weth.address], [coll], debt)).toString()

    assert.isAtMost(th.getDifference(ICR, '1840908672520756'), 1000)
  })


  it("computeICR(): Returns 2^256-1 if trove has non-zero coll and zero debt", async () => {
    const price = dec(100, 18)
    const coll = dec(1, 'ether')
    const debt = 0
    await priceFeed.setPrice(price)

    await priceFeed.setPrice(price)

    const ICR = web3.utils.toHex(await troveManager.computeICR([contracts.weth.address], [coll], debt))
    // const ICR = web3.utils.toHex(await troveManager.computeICR(coll, debt, price))
    const maxBytes32 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    assert.equal(ICR, maxBytes32)
  })

  // --- checkRecoveryMode ---

  //TCR < 150%
  it("checkRecoveryMode(): Returns true when TCR < 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice('99999999999999999999')

    const TCR = (await th.getTCR(contracts))

    assert.isTrue(TCR.lte(toBN('1500000000000000000')))

    assert.isTrue(await th.checkRecoveryMode(contracts))
  })

  // TCR == 150%
  it("checkRecoveryMode(): Returns false when TCR == 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    const TCR = (await th.getTCR(contracts))

    assert.equal(TCR, '1500000000000000000')

    assert.isFalse(await th.checkRecoveryMode(contracts))
  })

  // > 150%
  it("checkRecoveryMode(): Returns false when TCR > 150%", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice('100000000000000000001')

    const TCR = (await th.getTCR(contracts))

    assert.isTrue(TCR.gte(toBN('1500000000000000000')))

    assert.isFalse(await th.checkRecoveryMode(contracts))
  })

  // check 0
  it("checkRecoveryMode(): Returns false when TCR == 0", async () => {
    await priceFeed.setPrice(dec(100, 18))

    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

    await priceFeed.setPrice(0)

    const TCR = (await th.getTCR(contracts)).toString()

    assert.equal(TCR, 0)

    assert.isTrue(await th.checkRecoveryMode(contracts))
  })

  // --- Getters ---

  it("getTroveStake(): Returns stake", async () => {
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const A_Stake = await troveManager.getTroveStake(A, contracts.weth.address)
    const B_Stake = await troveManager.getTroveStake(B, contracts.weth.address)

    assert.equal(A_Stake, A_coll.toString())
    assert.equal(B_Stake, B_coll.toString())
  })

  it("getTroveColl(): Returns coll", async () => {
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    assert.equal((await troveManager.getTroveColls(A))[1][0], A_coll.toString())
    assert.equal((await troveManager.getTroveColls(A))[1][0], B_coll.toString())
  })

  it("getTroveDebt(): Returns debt", async () => {
    const { totalDebt: totalDebtA } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: A } })
    const { totalDebt: totalDebtB } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })

    const A_Debt = await troveManager.getTroveDebt(A)
    const B_Debt = await troveManager.getTroveDebt(B)

    // Expect debt = requested + 0.5% fee + 50 (due to gas comp)

    assert.equal(A_Debt, totalDebtA.toString())
    assert.equal(B_Debt, totalDebtB.toString())
  })

  it("getTroveStatus(): Returns status", async () => {
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: B } })
    await openTrove({ ICR: toBN(dec(200, 16)), extraYUSDAmount: B_totalDebt, extraParams: { from: A } })

    // to be able to repay:
    await yusdToken.transfer(B, B_totalDebt, { from: A })
    await borrowerOperations.closeTrove({from: B})

    const A_Status = await troveManager.getTroveStatus(A)
    const B_Status = await troveManager.getTroveStatus(B)
    const C_Status = await troveManager.getTroveStatus(C)

    assert.equal(A_Status, '1')  // active
    assert.equal(B_Status, '2')  // closed by user
    assert.equal(C_Status, '0')  // non-existent
  })

  it("hasPendingRewards(): Returns false it trove is not active", async () => {
    assert.isFalse(await troveManager.hasPendingRewards(alice))
  })

  it("Single Collateral low ratio-partial to SP partial redistribution", async () => {
    // A, B open trove
    await contracts.whitelist.changeRatio(weth.address, toBN(dec(9, 17)))
    const { collateral: A_coll } = await openTrove({ ICR: toBN(dec(500, 16)), extraParams: { from: alice } })
    const { collateral: B_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: bob } })
    
    console.log('\n----------- ')

    console.log('collVC in active pool: ', (await activePool.getVC()).toString())
    console.log('total amount weth in active pool', (await weth.balanceOf(activePool.address)).toString())
    
    console.log('debt in active pool: ', (await activePool.getYUSDDebt()).toString())
    console.log('collVC in default pool: ', (await defaultPool.getVC()).toString())
    console.log('total amount weth in default pool', (await weth.balanceOf(defaultPool.address)).toString())

    console.log('debt in default pool: ', (await defaultPool.getYUSDDebt()).toString())
    console.log('TCR: ', (await contracts.troveManager.getTCR()).toString())
    console.log('entire system VC: ', (await contracts.borrowerOperations.getEntireSystemColl()).toString())
    console.log('entire system eth amount: ', (await weth.balanceOf(activePool.address)).add((await weth.balanceOf(defaultPool.address))).toString())
    
    console.log('entire system debt: ', (await contracts.borrowerOperations.getEntireSystemDebt()).toString())

    await stabilityPool.provideToSP(dec(1000, 18), ZERO_ADDRESS, { from: alice })

    await priceFeed.setPrice(dec(100, 18))
    console.log('TCR: ', (await contracts.troveManager.getTCR()).toString())
    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L1: B liquidated
    const txB = await troveManager.liquidate(bob)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedTroves.contains(bob))

    // Price bounces back to 200 $/E
    await priceFeed.setPrice(dec(200, 18))
    
    // C, D open troves
    const { collateral: C_coll } = await openTrove({ ICR: toBN(dec(400, 16)), extraParams: { from: carol } })
    const { collateral: D_coll } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: dennis } })



   


    // Price drops to 100 $/E
    await priceFeed.setPrice(dec(100, 18))

    // Confirm not in Recovery Mode
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // L2: D Liquidated
    const txD = await troveManager.liquidate(dennis)
    assert.isTrue(txB.receipt.status)
    assert.isFalse(await sortedTroves.contains(dennis))


    await priceFeed.setPrice(dec(200, 18))
    // // Get entire coll of A and C
    // aliceCTS = (await contracts.troveManager.getEDC(alice))
    // const alice_Coll = (await contracts.troveManager.getVC(aliceCTS[0], aliceCTS[1])).toString()

    // carolCTS = (await contracts.troveManager.getEDC(carol))
    // const carol_Coll = (await contracts.troveManager.getVC(carolCTS[0], carolCTS[1])).toString()



    // Get entire coll of A and C
    const alice_Coll = ((await troveManager.getTroveColls(alice))[1][0]
      .add((await troveManager.getPendingCollRewards(alice))[1][0]))
      .toString()
    const carol_Coll = ((await troveManager.getTroveColls(carol))[1][0]
      .add((await troveManager.getPendingCollRewards(carol))[1][0]))
      .toString()


    /* Expected collateral:
    A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
    expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

    C: Carol receives ~2/5 ETH from L2
    expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

    Total coll = 4 + 2 * 0.995 ETH
    */
    const A_collAfterL1 = A_coll.add(th.applyLiquidationFee(B_coll)).sub(toBN(dec(1000, 18)))
    assert.isAtMost(th.getDifference(alice_Coll, A_collAfterL1.add(A_collAfterL1.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(150, 20)))
    assert.isAtMost(th.getDifference(carol_Coll, C_coll.add(C_coll.mul(th.applyLiquidationFee(D_coll)).div(A_collAfterL1.add(C_coll)))), Number(dec(100, 20)))



    // const entireSystemColl = Number(await contracts.borrowerOperations.getEntireSystemColl())

    // assert.equal(entireSystemColl, Number(A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))*2*100)

    const entireSystemColl = (await activePool.getCollateral(weth.address)).add(await defaultPool.getCollateral(weth.address)).add(await stabilityPool.getCollateral(weth.address)).toString()
    assert.equal(entireSystemColl, A_coll.add(C_coll).add(th.applyLiquidationFee(B_coll.add(D_coll))))


    // check YUSD gas compensation
    assert.equal((await yusdToken.balanceOf(owner)).toString(), dec(400, 18))
  })

})

contract('Reset chain state', async accounts => { })
