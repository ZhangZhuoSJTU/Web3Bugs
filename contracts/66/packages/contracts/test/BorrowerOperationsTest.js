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

/* NOTE: Some of the borrowing tests do not test for specific YUSD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific YUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let sYETI
  let yetiToken

  let contracts
  let wethIDX

  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)
  // const addERC20 = async (trove) => th.addERC20(contracts, token, account, addressToApprove, collateralAmount, extraParams)

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
      priceFeed = priceFeedETH
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

      wethIDX = await whitelist.getIndex(contracts.weth.address)
    })


    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral

      await th.openTrove(contracts, { ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await th.openTrove(contracts, { ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      assert.isFalse(await troveManager.checkRecoveryMode())
      assert.isTrue((await troveManager.getCurrentICR(alice)).lt(toBN(dec(110, 16))))

      const collTopUp = toBN(dec(1, 18))  // 1 wei top up

      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collTopUp, { from: alice })
      assert.isTrue(wethMint);

      await assertRevert(borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const { collateral: aliceColl } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_Before = toBN(await contracts.weth.balanceOf(activePool.address))

      assert.isTrue(activePool_ETH_Before.eq(aliceColl))
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl))

      const collTopUp = toBN(dec(1, 18))  // 1 wei top up

      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collTopUp, { from: alice })
      assert.isTrue(wethMint);

      await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice })

      const activePool_ETH_After = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
    })

    it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // const alice_Trove_Before = await troveManager.Troves(alice)
      const coll_before = await troveManager.getTroveColls(alice)
      const status_Before = await troveManager.getTroveStatus(alice)

      // check status before
      assert.equal(status_Before, 1)

      // Alice adds second collateral
      const collTopUp = toBN(dec(1, 18))  // 1 wei top up
      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collTopUp, { from: alice })
      assert.isTrue(wethMint);
      await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice })
      // await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

      // const alice_Trove_After = await troveManager.Troves(alice)
      const coll_After = await troveManager.getTroveColls(alice)
      const status_After = await troveManager.getTroveStatus(alice)

      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After[1][0].eq(coll_before[1][0].add(toBN(dec(1, 'ether')))))
      assert.equal(status_After, 1)
    })

    it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check Alice is in list before
      const aliceTroveInList_Before = await sortedTroves.contains(alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_Before, true)
      assert.equal(listIsEmpty_Before, false)

      const collTopUp = toBN(dec(1, 18))  // 1 wei top up
      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collTopUp, { from: alice })
      assert.isTrue(wethMint);
      await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice })
      // await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

      // check Alice is still in list after
      const aliceTroveInList_After = await sortedTroves.contains(alice)
      const listIsEmpty_After = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 1 ether
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // const alice_Trove_Before = await troveManager.Troves(alice)
      // const alice_Stake_Before = alice_Trove_Before[2]
      const alice_Stake_Before = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakes_Before = (await troveManager.totalStakes(contracts.weth.address))

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before))

      // Alice tops up Trove collateral with 2 ether
      const collTopUp = toBN(dec(2, 18))  // 1 wei top up
      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collTopUp, { from: alice })
      assert.isTrue(wethMint);
      await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice })
      // await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(2, 'ether') })

      // Check stake and total stakes get updated
      // const alice_Trove_After = await troveManager.Troves(alice)
      const alice_Stake_After = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakes_After = (await troveManager.totalStakes(contracts.weth.address))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, 'ether')))))
    })

    it("addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_YUSDDebt snapshots", async () => {
      // --- SETUP ---

      const { collateral: aliceCollBefore, totalDebt: aliceDebtBefore } = await openTrove({ extraYUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const { collateral: bobCollBefore, totalDebt: bobDebtBefore } = await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100YUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // Liquidate Carol's Trove,
      const tx = await troveManager.liquidate(carol, { from: owner });

      assert.isFalse(await sortedTroves.contains(carol))

      const L_ETH = await troveManager.getL_Coll(contracts.weth.address)
      const L_YUSDDebt = await troveManager.getL_YUSD(contracts.weth.address)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      // const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice, contracts.weth.address)
      // const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_YUSDDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      // const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
      // const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      // const bob_YUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]
      const bob_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_YUSDDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotYUSD(bob, contracts.weth.address)

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_YUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_YUSDDebtRewardSnapshot_Before, 0)

      const alicePendingETHReward = (await troveManager.getPendingCollRewards(alice))[1][0]
      const bobPendingETHReward = (await troveManager.getPendingCollRewards(bob))[1][0]
      const alicePendingYUSDDebtReward = await troveManager.getPendingYUSDDebtReward(alice)
      const bobPendingYUSDDebtReward = await troveManager.getPendingYUSDDebtReward(bob)
      for (reward of [alicePendingETHReward, bobPendingETHReward, alicePendingYUSDDebtReward, bobPendingYUSDDebtReward]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob top up their Troves
      const aliceTopUp = toBN(dec(5, 'ether'))
      const aliceMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, aliceTopUp, { from: alice })
      assert.isTrue(aliceMint);
      await borrowerOperations.addColl([contracts.weth.address], [aliceTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice })


      const bobTopUp = toBN(dec(1, 'ether'))
      const bobMint = await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, aliceTopUp, { from: bob })
      assert.isTrue(bobMint);
      await borrowerOperations.addColl([contracts.weth.address], [bobTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: bob })
      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      // const aliceNewColl = await getTroveEntireColl(alice)
      // const aliceNewDebt = await getTroveEntireDebt(alice)
      // const aliceDebtAndColls = await getEntireDebtAndColls(alice)
      const aliceNewColl = toBN((await getTroveEntireColl(alice))[0]) //aliceDebtAndColls[2][0]
      const aliceNewDebt = await getTroveEntireDebt(alice) //aliceDebtAndColls[0]
      // const bobDebtAndColls = await getEntireDebtAndColls(bob)
      const bobNewColl = toBN((await getTroveEntireColl(bob))[0]) //aliceDebtAndColls[2][0]
      const bobNewDebt = await getTroveEntireDebt(bob) // aliceDebtAndColls[0]
      // const bobNewColl = await getTroveEntireColl(bob)
      // const bobNewDebt = await getTroveEntireDebt(bob)

      assert.isTrue(aliceNewColl.eq(aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt.eq(aliceDebtBefore.add(alicePendingYUSDDebtReward)))
      assert.isTrue(bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)))
      assert.isTrue(bobNewDebt.eq(bobDebtBefore.add(bobPendingYUSDDebtReward)))


      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_YUSDDebt */
      // const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice)
      // const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      // const alice_YUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]
      const alice_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_YUSDDebtRewardSnapshot_After = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      // const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob)
      // const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      // const bob_YUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]
      const bob_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_YUSDDebtRewardSnapshot_After = await troveManager.getRewardSnapshotYUSD(bob, contracts.weth.address)

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_YUSDDebtRewardSnapshot_After, L_YUSDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_YUSDDebtRewardSnapshot_After, L_YUSDDebt), 100)
    })

    // it("addColl(), active Trove: adds the right corrected stake after liquidations have occured", async () => {
    //  // TODO - check stake updates for addColl/withdrawColl/adustTrove ---

    //   // --- SETUP ---
    //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 YUSD
    //   await borrowerOperations.openTrove(th._100pct, dec(100, 18), alice, alice, { from: alice, value: dec(15, 'ether') })
    //   await borrowerOperations.openTrove(th._100pct, dec(100, 18), bob, bob, { from: bob, value: dec(4, 'ether') })
    //   await borrowerOperations.openTrove(th._100pct, dec(900, 18), carol, carol, { from: carol, value: dec(5, 'ether') })

    //   await borrowerOperations.openTrove(th._100pct, 0, dennis, dennis, { from: dennis, value: dec(1, 'ether') })
    //   // --- TEST ---

    //   // price drops to 1ETH:100YUSD, reducing Carol's ICR below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // close Carol's Trove, liquidating her 5 ether and 900YUSD.
    //   await troveManager.liquidate(carol, { from: owner });

    //   // dennis tops up his trove by 1 ETH
    //   await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
    //   stake is given by the formula: 

    //   s = totalStakesSnapshot / totalCollateralSnapshot 

    //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
    //   the ETH from her Trove has now become the totalPendingETHReward. So:

    //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
    //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

    //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
    //   const dennis_Trove = await troveManager.Troves(dennis)

    //   const dennis_Stake = dennis_Trove[2]
    //   console.log(dennis_Stake.toString())

    //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
    // })

    it("addColl(), reverts if trove is non-existent or closed", async () => {
      // A, B open troves
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Carol attempts to add collateral to her non-existent trove
      try {
        const collTopUp = toBN(dec(1, 18))
        const wethMint = await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, collTopUp, { from: carol })
        assert.isTrue(wethMint);
        txCarol = await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: carol })
        //const txCarol = await borrowerOperations.addColl(carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "TroveInactive")
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      console.log("Bob gets liquidated");
      // Bob gets liquidated
      await troveManager.liquidate(bob)
      console.log("Liquidate done");

      assert.isFalse(await sortedTroves.contains(bob))

      // Bob attempts to add collateral to his closed trove
      try {
        console.log("TRY");
        const collTopUp = toBN(dec(1, 18))
        const wethMint = await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, collTopUp, { from: bob })
        assert.isTrue(wethMint);
        console.log("MINTED");
        txCarol = await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: bob })
        //const txBob = await borrowerOperations.addColl(bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "TroveInactive")
      }
    })

    it('addColl(): can add collateral in Recovery Mode', async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const coll_before = toBN((await (getTroveEntireColl(alice)))[0])
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')
      assert.isTrue(await th.checkRecoveryMode(contracts))

      const collTopUp = toBN(dec(1, 18))
      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collTopUp, { from: alice })
      assert.isTrue(wethMint);
      txCarol = await borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice })
      //await borrowerOperations.addColl(alice, alice, { from: alice, value: collTopUp })

      // Check Alice's collateral
      const coll_After = await troveManager.getTroveColls(alice)
      assert.isTrue(coll_After[1][0].eq(coll_before.add(toBN(dec(1, 'ether')))))
    })

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // const result = await troveManager.checkRecoveryMode()
      // console.log(result)

      assert.isFalse(await troveManager.checkRecoveryMode())
      assert.isTrue((await troveManager.getCurrentICR(alice)).lt(toBN(dec(110, 16))))

      const collWithdrawal = toBN(dec(1, 1))  // 1 wei withdrawal

      // await assertRevert(borrowerOperations.withdrawColl(1, alice, alice, { from: alice }),
      // "BorrowerOps: An operation that would result in ICR < MCR is not permitted")

      // const collTopUp = toBN(dec(1, 18))  // 1 wei top up

      const wethMint = await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, collWithdrawal, { from: alice })
      assert.isTrue(wethMint);

      await assertRevert(borrowerOperations.withdrawColl([contracts.weth.address], [collWithdrawal], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    // reverts when calling address does not have active trove  
    it("withdrawColl(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })


      // Bob successfully withdraws some coll
      const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'finney'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: bob })
      // const txBob = await borrowerOperations.withdrawColl(dec(100, 'finney'), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)
      // Carol with no active trove attempts to withdraw
      try {
        // const txCarol = await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, carol, { from: carol })
        const txCarol = await borrowerOperations.withdrawColl([contracts.weth.address], [dec(100, 'ether')], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1000)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
      // const txAlice = await borrowerOperations.withdrawColl(1000, alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check withdrawal impossible when recoveryMode == true
      try {
        // const txBob = await borrowerOperations.withdrawColl(1000, bob, bob, { from: bob })
        const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1000)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = (await getTroveEntireColl(carol))[0]
      const bobColl = (await getTroveEntireColl(bob))[0]
      // Carol withdraws exactly all her collateral
      await assertRevert(
        // borrowerOperations.withdrawColl(carolColl, carol, carol, { from: carol }),
        borrowerOperations.withdrawColl([contracts.weth.address], [toBN(carolColl)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: carol }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        // const txBob = await borrowerOperations.withdrawColl(bobColl.add(toBN(1)), bob, bob, { from: bob })
        const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [bobColl.add(toBN(1))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } }) // 110% ICR

      // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.

      try {
        const txBob = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: bob })
        // const txBob = await borrowerOperations.withdrawColl(1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---

      // A and B open troves at 150% ICR
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const aliceColls = await th.getTroveEntireColl(contracts, alice)
      const aliceDebt = await th.getTroveEntireDebt(contracts, alice)

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // --- TEST ---

      // price drops to 1ETH:150YUSD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');

      //Alice tries to withdraw collateral during Recovery Mode
      try {
        const txData = await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(1)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
        // const txData = await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceColls = await th.getTroveEntireColl(contracts, alice)
      const aliceDebt = await th.getTroveEntireDebt(contracts, alice)

      const aliceColl = (await th.getTroveEntireColl(contracts, alice))[0]

      // Check Trove is active
      // const alice_Trove_Before = await troveManager.Troves(alice)
      const status_Before = await troveManager.getTroveStatus(alice)
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl([contracts.weth.address], [toBN(aliceColl)], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice }),
        // borrowerOperations.withdrawColl(aliceColl, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
      // Open Trove 
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is active
      // const alice_Trove_Before = await troveManager.Troves(alice)
      const status_Before = await troveManager.getTroveStatus(alice)
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // Withdraw some collateral
      await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(100, 'finney'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
      // await borrowerOperations.withdrawColl(dec(100, 'finney'), alice, alice, { from: alice })

      // Check Trove is still active
      // const alice_Trove_After = await troveManager.Troves(alice)
      const status_After = await troveManager.getTroveStatus(alice)
      assert.equal(status_After, 1)
      assert.isTrue(await sortedTroves.contains(alice))
    })

    it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = (await getTroveEntireColl(alice))[0]

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
      // await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

      // Check 1 ether remaining
      // const alice_Trove_After = await troveManager.Troves(alice)
      const aliceCollAfter = (await getTroveEntireColl(alice))[0]

      assert.isTrue(toBN(aliceCollAfter).eq(toBN(aliceCollBefore).sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getTroveEntireColl(alice)

      // check before
      const activePool_ETH_before = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_before = toBN(await contracts.weth.balanceOf(activePool.address))

      // await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })
      await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })

      // check after
      const activePool_ETH_After = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RawEther_before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 2 ether
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: toBN(dec(5, 'ether')) } })
      const aliceColl = (await getTroveEntireColl(alice))[0]
      assert.isTrue(toBN(aliceColl).gt(toBN('0')))

      // const alice_Trove_Before = await troveManager.Troves(alice)
      // const alice_Stake_Before = alice_Trove_Before[2]
      const alice_Stake_Before = await troveManager.getTroveStake(alice, contracts.weth.address)
      // const totalStakes_Before = (await troveManager.totalStakes())
      const totalStakes_Before = (await troveManager.totalStakes(contracts.weth.address))

      assert.isTrue(alice_Stake_Before.eq(aliceColl))
      assert.isTrue(totalStakes_Before.eq(aliceColl))

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
      // await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })

      // Check stake and total stakes get updated
      // const alice_Trove_After = await troveManager.Troves(alice)
      // const alice_Stake_After = alice_Trove_After[2]
      // const totalStakes_After = (await troveManager.totalStakes())
      const alice_Stake_After = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakes_After = (await troveManager.totalStakes(contracts.weth.address))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(2, 'ether') } })

      const alice_ETHBalance_Before = toBN(web3.utils.toBN(await contracts.weth.balanceOf(alice)))
      await borrowerOperations.withdrawColl([contracts.weth.address], [toBN(dec(1, 'ether'))], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
      // await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })

      const alice_ETHBalance_After = toBN(web3.utils.toBN(await contracts.weth.balanceOf(alice)))
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

      assert.isTrue(balanceDiff.eq(toBN(dec(1, 'ether'))))
    })

    it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_YUSDDebt snapshots", async () => {
      // --- SETUP ---
      // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: bob, value: toBN(dec(100, 'ether')) } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol, value: toBN(dec(10, 'ether')) } })

      const aliceCollBefore = await getTroveEntireColl(alice)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const bobCollBefore = await getTroveEntireColl(bob)
      const bobDebtBefore = await getTroveEntireDebt(bob)

      // --- TEST ---

      // price drops to 1ETH:100YUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // close Carol's Trove, liquidating her 1 ether and 180YUSD.
      await troveManager.liquidate(carol, { from: owner });

      // const L_ETH = await troveManager.L_ETH()
      const L_ETH = await troveManager.getL_Coll(contracts.weth.address)
      const L_YUSDDebt = await troveManager.L_YUSDDebt(contracts.weth.address)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      // const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
      // const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      // const alice_YUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]
      const alice_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_YUSDDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      // const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
      // const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      // const bob_YUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]
      const bob_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_YUSDDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotYUSD(bob, contracts.weth.address)

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_YUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_YUSDDebtRewardSnapshot_Before, 0)

      // Check A and B have pending rewards
      const pendingCollReward_A = (await troveManager.getPendingCollRewards(alice))[1][0]
      const pendingDebtReward_A = await troveManager.getPendingYUSDDebtReward(alice)
      const pendingCollReward_B = (await troveManager.getPendingCollRewards(bob))[1][0]
      const pendingDebtReward_B = await troveManager.getPendingYUSDDebtReward(bob)
      for (reward of [pendingCollReward_A, pendingDebtReward_A, pendingCollReward_B, pendingDebtReward_B]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob withdraw from their Troves
      const aliceCollWithdrawal = toBN(dec(5, 'ether'))
      const bobCollWithdrawal = toBN(dec(1, 'ether'))

      await borrowerOperations.withdrawColl([contracts.weth.address], [aliceCollWithdrawal], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: alice })
      // await borrowerOperations.withdrawColl(aliceCollWithdrawal, alice, alice, { from: alice })
      await borrowerOperations.withdrawColl([contracts.weth.address], [bobCollWithdrawal], th.ZERO_ADDRESS, th.ZERO_ADDRESS, { from: bob })
      // await borrowerOperations.withdrawColl(bobCollWithdrawal, bob, bob, { from: bob })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const bobCollAfter = await getTroveEntireColl(bob)
      const bobDebtAfter = await getTroveEntireDebt(bob)

      // Check rewards have been applied to troves
      th.assertIsApproximatelyEqual(aliceCollAfter[0], aliceCollBefore[0].add(pendingCollReward_A).sub(aliceCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(pendingDebtReward_A), 10000)
      th.assertIsApproximatelyEqual(bobCollAfter[0], bobCollBefore[0].add(pendingCollReward_B).sub(bobCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(bobDebtAfter, bobDebtBefore.add(pendingDebtReward_B), 10000)

      /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_YUSDDebt */
      // const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice)
      // const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      // const alice_YUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]
      const alice_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_YUSDDebtRewardSnapshot_After = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      // const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob)
      // const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      // const bob_YUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]
      const bob_ETHrewardSnapshot_After = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_YUSDDebtRewardSnapshot_After = await troveManager.getRewardSnapshotYUSD(bob, contracts.weth.address)

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_YUSDDebtRewardSnapshot_After, L_YUSDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_YUSDDebtRewardSnapshot_After, L_YUSDDebt), 100)
    })

    // --- withdrawYUSD() ---

    it("withdrawYUSD(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode())
      assert.isTrue((await troveManager.getCurrentICR(alice)).lt(toBN(dec(110, 16))))

      const YUSDwithdrawal = 1  // withdraw 1 wei YUSD

      await assertRevert(borrowerOperations.withdrawYUSD(th._100pct, YUSDwithdrawal, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("withdrawYUSD(): decays a non-zero base rate", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraYUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const A_YUSDBal = await yusdToken.balanceOf(A)

      // Artificially set base rate to 5%
      await troveManager.setBaseRate(dec(5, 16))

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws YUSD
      await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), A, A, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E withdraws YUSD
      await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), A, A, { from: E })

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("withdrawYUSD(): reverts if max fee > 100%", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawYUSD(dec(2, 18), dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawYUSD('1000000000000000001', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawYUSD(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawYUSD(0, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawYUSD(1, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawYUSD('4999999999999999', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawYUSD(): reverts if fee exceeds max fee percentage", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraYUSDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await yusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // 100%: 1e18,  10%: 1e17,  1%: 1e16,  0.1%: 1e15
      // 5%: 5e16
      // 0.5%: 5e15
      // actual: 0.5%, 5e15


      // YUSDFee:                  15000000558793542
      // absolute _fee:            15000000558793542
      // actual feePercentage:      5000000186264514
      // user's _maxFeePercentage: 49999999999999999

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.withdrawYUSD(lessThan5pct, dec(3, 18), A, A, { from: A }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.withdrawYUSD(dec(1, 16), dec(1, 18), A, A, { from: B }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate()  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.withdrawYUSD(dec(3754, 13), dec(1, 18), A, A, { from: C }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate()  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 0.5%%
      await assertRevert(borrowerOperations.withdrawYUSD(dec(5, 15), dec(1, 18), A, A, { from: D }), "Fee exceeded provided maximum")
    })

    it("withdrawYUSD(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraYUSDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await yusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.isTrue(baseRate.eq(toBN(dec(5, 16))))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.withdrawYUSD(moreThan5pct, dec(1, 18), A, A, { from: A })
      assert.isTrue(tx1.receipt.status)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.withdrawYUSD(dec(5, 16), dec(1, 18), A, A, { from: B })
      assert.isTrue(tx2.receipt.status)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.withdrawYUSD(dec(1, 17), dec(1, 18), A, A, { from: C })
      assert.isTrue(tx3.receipt.status)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.withdrawYUSD(dec(37659, 13), dec(1, 18), A, A, { from: D })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.withdrawYUSD(dec(1, 18), dec(1, 18), A, A, { from: E })
      assert.isTrue(tx5.receipt.status)
    })

    it("withdrawYUSD(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws YUSD
      await borrowerOperations.withdrawYUSD(th._100pct, dec(37, 18), A, A, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await borrowerOperations.withdrawYUSD(th._100pct, dec(12, 18), A, A, { from: E })

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("withdrawYUSD(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })


    it("withdrawYUSD(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers a fee, before decay interval has passed
      await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), C, C, { from: C })

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("withdrawYUSD(): borrowing at non-zero base rate sends YUSD fee to sYETI contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI YUSD balance before == 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETI_YUSDBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws YUSD
      await borrowerOperations.withdrawYUSD(th._100pct, dec(37, 18), C, C, { from: D })

      // Check YETI YUSD balance after has increased
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("withdrawYUSD(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and E stakes 1 YETI
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
        await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
        await sYETI.mint(dec(1, 18), { from: E })

        await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getTroveEntireDebt(D)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        // D withdraws YUSD
        const withdrawal_D = toBN(dec(37, 18))
        const withdrawalTx = await borrowerOperations.withdrawYUSD(th._100pct, toBN(dec(37, 18)), D, D, { from: D })

        const emittedFee = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(withdrawalTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const newDebt = await troveManager.getTroveDebt(D)

        // Check debt on Trove struct equals initial debt + withdrawal + emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_debtBefore.add(withdrawal_D).add(emittedFee), 10000)
      })
    }

    it("withdrawYUSD(): Borrowing at non-zero base rate increases the sYETI contract YUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // @KingYeti: no F_YUSD() function
      // Check YETI contract YUSD fees-per-unit-staked is zero
      // const F_YUSD_Before = await sYETI.F_YUSD()
      // assert.equal(F_YUSD_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws YUSD
      await borrowerOperations.withdrawYUSD(th._100pct, toBN(dec(37, 18)), D, D, { from: D })

      // @KingYeti: F_YUSD() function no longer exists
      // // Check YETI contract YUSD fees-per-unit-staked has increased
      // const F_YUSD_After = await sYETI.F_YUSD()
      // assert.isTrue(F_YUSD_After.gt(F_YUSD_Before))
    })

    it("withdrawYUSD(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and E stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI Staking contract balance before == 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETI_YUSDBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_YUSDBalanceBefore = await yusdToken.balanceOf(D)

      // D withdraws YUSD
      const D_YUSDRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawYUSD(th._100pct, D_YUSDRequest, D, D, { from: D })

      // Check sYETI YUSD balance has increased
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))

      // Check D's YUSD balance now equals their initial balance plus request YUSD
      const D_YUSDBalanceAfter = await yusdToken.balanceOf(D)
      assert.isTrue(D_YUSDBalanceAfter.eq(D_YUSDBalanceBefore.add(D_YUSDRequest)))
    })

    it("withdrawYUSD(): Borrowing at zero base rate increases YUSD in sYETI contract", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // A artificially receives YETI, then stakes it
      await yetiToken.unprotectedMint(A, dec(100, 18))
      await sYETI.mint(dec(100, 18), { from: A })

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check YETI YUSD balance before == 0
      const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)

      // D withdraws YUSD
      await borrowerOperations.withdrawYUSD(th._100pct, dec(37, 18), D, D, { from: D })

      // Check YETI YUSD balance after > 0
      const F_YUSD_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(F_YUSD_After.gt('0'))
    })

    it("withdrawYUSD(): Borrowing at zero base rate sends debt request to user", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_YUSDBalanceBefore = await yusdToken.balanceOf(D)

      // D withdraws YUSD
      const D_YUSDRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawYUSD(th._100pct, dec(37, 18), D, D, { from: D })

      // Check D's YUSD balance now equals their requested YUSD
      const D_YUSDBalanceAfter = await yusdToken.balanceOf(D)

      // Check D's trove debt == D's YUSD balance + liquidation reserve
      assert.isTrue(D_YUSDBalanceAfter.eq(D_YUSDBalanceBefore.add(D_YUSDRequest)))
    })

    it("withdrawYUSD(): reverts when calling address does not have active trove", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws YUSD
      const txBob = await borrowerOperations.withdrawYUSD(th._100pct, dec(100, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw YUSD
      try {
        const txCarol = await borrowerOperations.withdrawYUSD(th._100pct, dec(100, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawYUSD(): reverts when requested withdrawal amount is zero YUSD", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws 1e-18 YUSD
      const txBob = await borrowerOperations.withdrawYUSD(th._100pct, 1, bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to withdraw 0 YUSD
      try {
        const txAlice = await borrowerOperations.withdrawYUSD(th._100pct, 0, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawYUSD(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawYUSD(th._100pct, dec(100, 18), alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('50000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check YUSD withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawYUSD(th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawYUSD(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob tries to withdraw YUSD that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawYUSD(th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawYUSD(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Alice and Bob creates troves with 150% ICR.  System TCR = 150%.
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      var TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // Bob attempts to withdraw 1 YUSD.
      // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
      try {
        const txBob = await borrowerOperations.withdrawYUSD(th._100pct, dec(1, 18), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawYUSD(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // --- TEST ---

      // price drops to 1ETH:150YUSD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');
      assert.isTrue((await th.getTCR(contracts)).lt(toBN(dec(15, 17))))

      try {
        const txData = await borrowerOperations.withdrawYUSD(th._100pct, '200', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawYUSD(): increases the Trove's YUSD debt by the correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check before
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      await borrowerOperations.withdrawYUSD(th._100pct, await getNetBorrowingAmount(100), alice, alice, { from: alice })

      // check after
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(toBN(100)))
    })

    it("withdrawYUSD(): increases YUSD debt in ActivePool by correct amount", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      // check before
      const activePool_YUSD_Before = await activePool.getYUSDDebt()
      assert.isTrue(activePool_YUSD_Before.eq(aliceDebtBefore))

      await borrowerOperations.withdrawYUSD(th._100pct, await getNetBorrowingAmount(dec(10000, 18)), alice, alice, { from: alice })

      // check after
      const activePool_YUSD_After = await activePool.getYUSDDebt()
      th.assertIsApproximatelyEqual(activePool_YUSD_After, activePool_YUSD_Before.add(toBN(dec(10000, 18))))
    })

    it("withdrawYUSD(): increases user YUSDToken balance by correct amount", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })

      // check before
      const alice_YUSDTokenBalance_Before = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.withdrawYUSD(th._100pct, dec(10000, 18), alice, alice, { from: alice })

      // check after
      const alice_YUSDTokenBalance_After = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_After.eq(alice_YUSDTokenBalance_Before.add(toBN(dec(10000, 18)))))
    })

    // --- repayYUSD() ---
    it("repayYUSD(): reverts when repayment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode())
      assert.isTrue((await troveManager.getCurrentICR(alice)).lt(toBN(dec(110, 16))))

      const YUSDRepayment = 1  // 1 wei repayment

      await assertRevert(borrowerOperations.repayYUSD(YUSDRepayment, alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("repayYUSD(): Succeeds when it would leave trove with net debt >= minimum net debt", async () => {
      // Make the YUSD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), A, A, [contracts.weth.address], [dec(100, 30)], { from: A })

      const repayTxA = await borrowerOperations.repayYUSD(1, A, A, { from: A })
      assert.isTrue(repayTxA.receipt.status)

      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(20, 25), B, B, [contracts.weth.address], [dec(100, 30)], { from: B })

      const repayTxB = await borrowerOperations.repayYUSD(dec(19, 25), B, B, { from: B })
      assert.isTrue(repayTxB.receipt.status)
    })

    it("repayYUSD(): reverts when it would leave trove with net debt < minimum net debt", async () => {
      // Make the YUSD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt - 1 wei
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('1'))), A, A, [contracts.weth.address], [dec(100, 30)], { from: A })

      console.log("This is the repaid amount ", (await troveManager.getTroveDebt(A)).toString())

      const repayTxAPromise = borrowerOperations.repayYUSD(2, A, A, { from: A })
      await assertRevert(repayTxAPromise, "BorrowerOps: Trove's net debt must be greater than minimum")
    })

    it("repayYUSD(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      // Bob successfully repays some YUSD
      const txBob = await borrowerOperations.repayYUSD(dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to repayYUSD
      try {
        const txCarol = await borrowerOperations.repayYUSD(dec(10, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("repayYUSD(): reverts when attempted repayment is > the debt of the trove", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebt = await getTroveEntireDebt(alice)

      // Bob successfully repays some YUSD
      const txBob = await borrowerOperations.repayYUSD(dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayYUSD(aliceDebt.add(toBN(dec(1, 18))), alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    //repayYUSD: reduces YUSD debt in Trove
    it("repayYUSD(): reduces the Trove's YUSD debt by the correct amount", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      await borrowerOperations.repayYUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtAfter.gt(toBN('0')))

      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))  // check 9/10 debt remaining
    })

    it("repayYUSD(): decreases YUSD debt in ActivePool by correct amount", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // Check before
      const activePool_YUSD_Before = await activePool.getYUSDDebt()
      assert.isTrue(activePool_YUSD_Before.gt(toBN('0')))

      await borrowerOperations.repayYUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const activePool_YUSD_After = await activePool.getYUSDDebt()
      th.assertIsApproximatelyEqual(activePool_YUSD_After, activePool_YUSD_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it("repayYUSD(): decreases user YUSDToken balance by correct amount", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // check before
      const alice_YUSDTokenBalance_Before = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.repayYUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const alice_YUSDTokenBalance_After = await yusdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_YUSDTokenBalance_After, alice_YUSDTokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it("repayYUSD(): can repay debt in Recovery Mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const tx = await borrowerOperations.repayYUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)

      // Check Alice's debt: 110 (initial) - 50 (repaid)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))
    })

    it("repayYUSD(): Reverts if borrower has insufficient YUSD balance to cover his debt repayment", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      const bobBalBefore = await yusdToken.balanceOf(B)
      assert.isTrue(bobBalBefore.gt(toBN('0')))

      // Bob transfers all but 5 of his YUSD to Carol
      await yusdToken.transfer(C, bobBalBefore.sub((toBN(dec(5, 18)))), { from: B })

      //Confirm B's YUSD balance has decreased to 5 YUSD
      const bobBalAfter = await yusdToken.balanceOf(B)

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))))

      // Bob tries to repay 6 YUSD
      const repayYUSDPromise_B = borrowerOperations.repayYUSD(toBN(dec(6, 18)), B, B, { from: B })

      await assertRevert(repayYUSDPromise_B, "Caller doesnt have enough YUSD to make repayment")
    })

    // --- adjustTrove() ---

    it("adjustTrove(): reverts when adjustment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode())
      assert.isTrue((await troveManager.getCurrentICR(alice)).lt(toBN(dec(110, 16))))

      const YUSDRepayment = 1  // 1 wei repayment
      const collTopUp = 1

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(collTopUp), { from: alice })
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [toBN(collTopUp)], [], [], YUSDRepayment, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, 0, YUSDRepayment, false, alice, alice, { from: alice, value: collTopUp }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("adjustTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(2,16)), { from: A })
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(2, 16))], [], [], toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, 0, { from: A }),
        "Max fee percentage must be between 0.5% and 100%"
      )
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(2, 16))], [], [], toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, 1, { from: A }),
        "Max fee percentage must be between 0.5% and 100%"
      )
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(2, 16))], [], [], toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, '4999999999999999', { from: A }),
        "Max fee percentage must be between 0.5% and 100%"
      )
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(2, 16))], [], [], toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, toBN(dec(1, 19)), { from: A }),
        "Max fee percentage must be between 0.5% and 100%"
      )
      // allow normal fee ceiling between 0.5% and 100%
      const tx = await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(2, 16))], [], [], toBN(dec(1, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, toBN(dec(1, 17)), { from: A })
      assert.isTrue(tx.receipt.status)

      // await assertRevert(borrowerOperations.adjustTrove(0, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      // await assertRevert(borrowerOperations.adjustTrove(1, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      // await assertRevert(borrowerOperations.adjustTrove('4999999999999999', 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("adjustTrove(): allows max fee < 0.5% in Recovery mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await priceFeed.setPrice(dec(120, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      console.log(th.toNormalBase(await th.getTCR(contracts)))
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(300, 18)), { from: A })
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(300, 18))], [], [], toBN(dec(1, 9)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, 0, { from: A })
      // await borrowerOperations.adjustTrove(0, 0, dec(1, 9), true, A, A, { from: A, value: dec(300, 18) })
      await priceFeed.setPrice(dec(1, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(30000, 18)), { from: A })
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(30000, 18))], [], [], toBN(dec(1, 9)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, 1, { from: A })
      // await borrowerOperations.adjustTrove(1, 0, dec(1, 9), true, A, A, { from: A, value: dec(30000, 18) })
      await priceFeed.setPrice(dec(1, 16))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(3000000, 18)), { from: A })
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(3000000, 18))], [], [], toBN(dec(1, 9)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, '4999999999999999', { from: A })
      // await borrowerOperations.adjustTrove('4999999999999999', 0, dec(1, 9), true, A, A, { from: A, value: dec(3000000, 18) })
    })

    it("adjustTrove(): decays a non-zero base rate", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 18)), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 15)), true, E, E, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("adjustTrove(): doesn't decay a non-zero base rate when user issues 0 debt", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // D opens trove 
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove with 0 debt
      await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(1, 18)), { from: D})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], 0, false, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, 0, false, D, D, { from: D, value: dec(1, 'ether') })

      // Check baseRate has not decreased 
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.eq(baseRate_1))
    })

    it("adjustTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 18)), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 15)), true, E, E, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 18)), true, C, C, th._100pct, { from: C })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 18)), true, C, C, th._100pct, { from: C })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // Borrower C triggers a fee, before decay interval of 1 minute has passed
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 18)), true, C, C, th._100pct, { from: C })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 18)), true, C, C, th._100pct, { from: C })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("adjustTrove(): borrowing at non-zero base rate sends YUSD fee to sYETI contract", async () => {
      // time fast-forwards 1 year, and E stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI YUSD balance before == 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETI_YUSDBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await openTrove({ extraYUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check YETI YUSD balance after has increased
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and E stakes 1 YETI
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
        await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
        await sYETI.mint(dec(1, 18), { from: E })

        await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getTroveEntireDebt(D)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const withdrawal_D = toBN(dec(37, 18))

        // D withdraws YUSD
        const adjustmentTx = await borrowerOperations.adjustTrove([], [], [], [], toBN(withdrawal_D), true, D, D, th._100pct, { from: D })
        // const adjustmentTx = await borrowerOperations.adjustTrove(th._100pct, 0, withdrawal_D, true, D, D, { from: D })

        const emittedFee = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(adjustmentTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        // const D_newDebt = (await troveManager.Troves(D))[0]
        const D_newDebt = (await troveManager.getTroveDebt(D))

        // Check debt on Trove struct equals initila debt plus drawn debt plus emitted fee
        assert.isTrue(D_newDebt.eq(D_debtBefore.add(withdrawal_D).add(emittedFee)))
      })
    }

    it("adjustTrove(): Borrowing at non-zero base rate increases the sYETI contract YUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and E stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI contract YUSD fees-per-unit-staked is zero
      const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(F_YUSD_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 18)), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check YETI contract YUSD fees-per-unit-staked has increased
      const F_YUSD_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(F_YUSD_After.gt(F_YUSD_Before))
    })

    it("adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and E stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI Staking contract balance before == 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETI_YUSDBalance_Before, '0')

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_YUSDBalanceBefore = await yusdToken.balanceOf(D)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const YUSDRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove([], [], [], [], toBN(YUSDRequest_D), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, YUSDRequest_D, true, D, D, { from: D })

      // Check sYETI YUSD balance has increased
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))

      // Check D's YUSD balance has increased by their requested YUSD
      const D_YUSDBalanceAfter = await yusdToken.balanceOf(D)
      assert.isTrue(D_YUSDBalanceAfter.eq(D_YUSDBalanceBefore.add(YUSDRequest_D)))
    })

    it("adjustTrove(): Borrowing at zero base rate changes YUSD balance of sYETI contract", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check staking YUSD balance before > 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_Before.gt(toBN('0')))

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 18)), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check staking YUSD balance after > staking balance before
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))
    })

    it("adjustTrove(): Borrowing at zero base rate increases YUSD in sYETI contract", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // A artificially receives YETI, then stakes it
      await yetiToken.unprotectedMint(A, dec(100, 18))
      await sYETI.mint(dec(100, 18), { from: A })

      // Check staking YUSD balance before == 0
      const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)

      // D adjusts trove
      await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(37, 18)), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check staking YUSD balance increases
      const F_YUSD_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(F_YUSD_After.gt(F_YUSD_Before))
    })

    it("adjustTrove(): Borrowing at zero base rate sends total requested YUSD to the user", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_YUSDBalBefore = await yusdToken.balanceOf(D)
      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const DUSDBalanceBefore = await yusdToken.balanceOf(D)

      // D adjusts trove
      const YUSDRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove([], [], [], [], toBN(YUSDRequest_D), true, D, D, th._100pct, { from: D })
      // await borrowerOperations.adjustTrove(th._100pct, 0, YUSDRequest_D, true, D, D, { from: D })

      // Check D's YUSD balance increased by their requested YUSD
      const YUSDBalanceAfter = await yusdToken.balanceOf(D)
      assert.isTrue(YUSDBalanceAfter.eq(D_YUSDBalBefore.add(YUSDRequest_D)))
    })

    it("adjustTrove(): reverts when calling address has no active trove", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Alice coll and debt increase(+1 ETH, +50YUSD)
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 18)), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(50, 18)), true, D, D, th._100pct, { from: alice })

      try {
        await th.addERC20(contracts.weth, carol, contracts.borrowerOperations.address, toBN(dec(1, 18)), { from: carol})
        const txCarol = await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(50, 18)), true, D, D, th._100pct, { from: carol })
        // const txCarol = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 18)), { from: alice})
      // const txAlice = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      const txAlice = await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(50, 18)), true, alice, alice, th._100pct, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(1, 'ether'))], 0, false, alice, alice, th._100pct, { from: alice })
        //await borrowerOperations.adjustTrove(th._100pct, dec(1, 'ether'), 0, false, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(50, 18)), true, bob, bob, th._100pct, { from: bob })
        // await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(1, 18)), { from: bob})
        const txBob = await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(111, 18)), true, bob, bob, th._100pct, { from: bob })
        //await borrowerOperations.adjustTrove(th._100pct, 0, dec(111, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): collateral withdrawal reverts in Recovery Mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(1)], dec(5000, 18), false, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, 1, dec(5000, 18), false, alice, alice, { from: alice }),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode")
    })

    it("adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await troveManager.getCurrentICR(alice)

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(50, 18))
      const collIncrease = toBN(dec(1, 'ether'))

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await troveManager.computeICR([contracts.weth.address], [aliceColl[0].add(collIncrease)], aliceDebt.add(debtIncrease))

      // console.log("Alice coll " + aliceColl[0].toString())
      // console.log(" coll increase " + collIncrease.toString())
      // console.log("debt  " + aliceDebt.toString())
      // console.log("debt increase " + debtIncrease.toString())

      // console.log(newICR.toString())
      // console.log(ICR_A.toString())
      // console.log(CCR.toString())

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR))

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(collIncrease), { from: alice})
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [collIncrease], [], [], debtIncrease, true, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease }),
        "BorrowerOps: Operation must leave trove with ICR >= CCR")
    })

    it("adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //--- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await troveManager.getCurrentICR(alice)

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebtIncrease = toBN(dec(150, 18))
      const aliceCollIncrease = toBN(dec(1, 'ether'))

      const newICR_A = await troveManager.computeICR([contracts.weth.address], [aliceColl[0].add(aliceCollIncrease)], aliceDebt.add(aliceDebtIncrease))

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR))

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(aliceCollIncrease), { from: alice})
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [aliceCollIncrease], [], [], aliceDebtIncrease, true, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, 0, aliceDebtIncrease, true, alice, alice, { from: alice, value: aliceCollIncrease }),
        "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode")

      //--- Bob with ICR < 150% tries to reduce his ICR ---

      const ICR_B = await troveManager.getCurrentICR(bob)

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR))

      const bobDebt = await getTroveEntireDebt(bob)
      const bobColl = await getTroveEntireColl(bob)
      const bobDebtIncrease = toBN(dec(450, 18))
      const bobCollIncrease = toBN(dec(1, 'ether'))

      const newICR_B = await troveManager.computeICR([contracts.weth.address], [bobColl[0].add(bobCollIncrease)], bobDebt.add(bobDebtIncrease))

      // Check Bob's new ICR would reduce 
      assert.isTrue(newICR_B.lt(ICR_B))

      await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(bobCollIncrease), { from: bob})
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [bobCollIncrease], [], [], bobDebtIncrease, true, bob, bob, th._100pct, { from: bob }),
        // borrowerOperations.adjustTrove(th._100pct, 0, bobDebtIncrease, true, bob, bob, { from: bob, value: bobCollIncrease }),
        " BorrowerOps: Operation must leave trove with ICR >= CCR")
    })

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await troveManager.getCurrentICR(alice)
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      // const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const newICR = await troveManager.computeICR([contracts.weth.address], [aliceColl[0].add(collIncrease)], aliceDebt.add(debtIncrease))

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(collIncrease), { from: alice})
      const tx = await borrowerOperations.adjustTrove([contracts.weth.address], [collIncrease], [], [], debtIncrease, true, alice, alice, th._100pct, { from: alice })
      // const tx = await borrowerOperations.adjustTrove(th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(alice)
      assert.isTrue(actualNewICR.gt(CCR))
    })

    it("adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const initialICR = await troveManager.getCurrentICR(alice)
      // Check initial ICR is above 150%
      assert.isTrue(initialICR.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR([contracts.weth.address], [aliceColl[0].add(collIncrease)], aliceDebt.add(debtIncrease))

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR))

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(collIncrease), { from: alice})
      const tx = await borrowerOperations.adjustTrove([contracts.weth.address], [collIncrease], [], [], debtIncrease, true, alice, alice, th._100pct, { from: alice })
      // const tx = await borrowerOperations.adjustTrove(th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(alice)
      assert.isTrue(actualNewICR.gt(initialICR))
    })

    it("adjustTrove(): debt increase in Recovery Mode charges no fee", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(200000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // B stakes YETI
      await yetiToken.unprotectedMint(bob, dec(100, 18))
      await sYETI.mint(dec(100, 18), { from: bob })

      const sYETIYUSDBalanceBefore = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETIYUSDBalanceBefore.gt(toBN('0')))

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: alice})
      const txAlice = await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(100, 'ether'))], [], [], toBN(dec(50, 18)), true, alice, alice, th._100pct, { from: alice })
      // const txAlice = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(100, 'ether') })
      assert.isTrue(txAlice.receipt.status)

      // Check emitted fee = 0
      const emittedFee = toBN(await th.getEventArgByName(txAlice, 'YUSDBorrowingFeePaid', '_YUSDFee'))
      assert.isTrue(emittedFee.eq(toBN('0')))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check no fee was sent to staking contract
      const sYETIYUSDBalanceAfter = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETIYUSDBalanceAfter.toString(), sYETIYUSDBalanceBefore.toString())
    })

    it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // Check TCR and Recovery Mode
      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustTrove([], [], [], [], toBN(dec(1, 18)), true, bob, bob, th._100pct, { from: bob })
        //borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when YUSD repaid is > debt of the trove", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const bobOpenTx = (await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })).tx

      const bobDebt = await getTroveEntireDebt(bob)
      assert.isTrue(bobDebt.gt(toBN('0')))

      const bobFee = toBN(await th.getEventArgByIndex(bobOpenTx, 'YUSDBorrowingFeePaid', 1))
      assert.isTrue(bobFee.gt(toBN('0')))

      // Alice transfers YUSD to bob to compensate borrowing fees
      await yusdToken.transfer(bob, bobFee, { from: alice })

      const remainingDebt = (await troveManager.getTroveDebt(bob)).sub(YUSD_GAS_COMPENSATION)

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: bob})
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], remainingDebt.add(toBN(1)), false, bob, bob, th._100pct, { from: bob }),
        // borrowerOperations.adjustTrove(th._100pct, 0, remainingDebt.add(toBN(1)), false, bob, bob, { from: bob, value: dec(1, 'ether') }),
        "revert"
      )
    })

    it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getTroveEntireColl(carol)

      // Carol attempts an adjustment that would withdraw 1 wei more than her ETH
      try {
        const txCarol = await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [carolColl[0].add(toBN(1))], 0, false, carol, carol, th._100pct, { from: carol })
        //borrowerOperations.adjustTrove(th._100pct, carolColl.add(toBN(1)), 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob attempts to increase debt by 100 YUSD and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: bob})
        const txBob = await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], dec(100, 18), true, bob, bob, th._100pct, { from: bob })
        //borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getTroveEntireColl(alice)
      const activePoolCollBefore = await activePool.getCollateral(contracts.weth.address)

      assert.isTrue(aliceCollBefore[0].gt(toBN('0')))
      assert.isTrue(aliceCollBefore[0].eq(activePoolCollBefore))

      // Alice adjusts trove. No coll change, and a debt increase (+50YUSD)
      await borrowerOperations.adjustTrove([], [], [], [], dec(50, 18), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice})

      const aliceCollAfter = await getTroveEntireColl(alice)
      const activePoolCollAfter = await activePool.getCollateral(contracts.weth.address)

      assert.isTrue(aliceCollAfter[0].eq(activePoolCollAfter))
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter))
    })

    it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const activePoolDebtBefore = await activePool.getYUSDDebt()

      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore))

      // Alice adjusts trove. Coll change, no debt change
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], 0, false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, 0, false, alice, alice, { from: alice, value: dec(1, 'ether') })

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const activePoolDebtAfter = await activePool.getYUSDDebt()

      assert.isTrue(aliceDebtAfter.eq(aliceDebtBefore))
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore))
    })

    it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50YUSD)
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], await getNetBorrowingAmount(dec(50, 18)), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, await getNetBorrowingAmount(dec(50, 18)), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter[0], collBefore[0].add(toBN(dec(1, 18))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50YUSD)
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(500, 'finney'))], toBN(dec(50, 18)), false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      assert.isTrue(debtAfter.eq(debtBefore.sub(toBN(dec(50, 18)))))
      assert.isTrue(collAfter[0].eq(collBefore[0].sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50YUSD)
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(500, 'finney')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(500, 'finney'))], [], [], toBN(dec(50, 18)), false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), false, alice, alice, { from: alice, value: dec(500, 'finney') })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.sub(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter[0], collBefore[0].add(toBN(dec(5, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore[0].gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10YUSD)
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 17)), { from: alice})
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(1, 17))], await getNetBorrowingAmount(dec(1, 18)), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, dec(1, 17), await getNetBorrowingAmount(dec(1, 18)), true, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(1, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter[0], collBefore[0].sub(toBN(dec(1, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesBefore = await troveManager.getTotalStake(contracts.weth.address)
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll and debt increase (+1 ETH, +50 YUSD)
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(50, 18)), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const stakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesAfter = await troveManager.getTotalStake(contracts.weth.address)

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove():  updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesBefore = await troveManager.getTotalStake(contracts.weth.address)
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(500, 'finney'))], toBN(dec(50, 18)), false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const stakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesAfter = await troveManager.getTotalStake(contracts.weth.address)

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): changes YUSDToken balance by the requested decrease", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_YUSDTokenBalance_Before = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(100, 'finney'))], toBN(dec(10, 18)), false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      // check after
      const alice_YUSDTokenBalance_After = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_After.eq(alice_YUSDTokenBalance_Before.sub(toBN(dec(10, 18)))))
    })

    it("adjustTrove(): changes YUSDToken balance by the requested increase", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_YUSDTokenBalance_Before = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(100, 18)), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      // check after
      const alice_YUSDTokenBalance_After = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDTokenBalance_After.eq(alice_YUSDTokenBalance_Before.add(toBN(dec(100, 18)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_Before = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove([], [], [contracts.weth.address], [toBN(dec(100, 'finney'))], toBN(dec(10, 18)), false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      const activePool_ETH_After = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_Before = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(100, 18)), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_ETH_After = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove(): Changes the YUSD debt in ActivePool by requested decrease", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_YUSDDebt_Before = await activePool.getYUSDDebt()
      assert.isTrue(activePool_YUSDDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(dec(30, 18)), false, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(30, 18), false, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_YUSDDebt_After = await activePool.getYUSDDebt()
      assert.isTrue(activePool_YUSDDebt_After.eq(activePool_YUSDDebt_Before.sub(toBN(dec(30, 18)))))
    })

    it("adjustTrove(): Changes the YUSD debt in ActivePool by requested increase", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_YUSDDebt_Before = await activePool.getYUSDDebt()
      assert.isTrue(activePool_YUSDDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: alice})
      await borrowerOperations.adjustTrove([contracts.weth.address], [toBN(dec(1, 'ether'))], [], [], toBN(await getNetBorrowingAmount(dec(100, 18))), true, alice, alice, th._100pct, { from: alice })
      // await borrowerOperations.adjustTrove(th._100pct, 0, await getNetBorrowingAmount(dec(100, 18)), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_YUSDDebt_After = await activePool.getYUSDDebt()

      th.assertIsApproximatelyEqual(activePool_YUSDDebt_After, activePool_YUSDDebt_Before.add(toBN(dec(100, 18))))
    })

    it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt = await troveManager.getTroveDebt(alice)
      const status_Before = await troveManager.getTroveStatus(alice)
      const isInSortedList_Before = await sortedTroves.contains(alice)

      assert.equal(status_Before, 1)  // 1: Active
      assert.isTrue(isInSortedList_Before)

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [aliceColl[0]], aliceDebt, true, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, aliceColl, aliceDebt, true, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("adjustTrove(): Reverts if requested debt increase and amount is zero", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], 0, true, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, 0, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: Debt increase requires non-zero debtChange')
    })

    it("adjustTrove(): Reverts if requested coll withdrawal and ether is sent", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(3, 'ether')), { from: alice})
      await assertRevert(
        borrowerOperations.adjustTrove([contracts.weth.address], [dec(3, 'ether')], [contracts.weth.address], [dec(3, 'ether')], dec(100, 18), true, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, dec(1, 'ether'), dec(100, 18), true, alice, alice, { from: alice, value: dec(3, 'ether') }), 
        'BorrowerOperations: Cannot withdraw and add coll')
    })

    it("adjustTrove(): Reverts if it’s zero adjustment", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(
        borrowerOperations.adjustTrove([], [], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
        // borrowerOperations.adjustTrove(th._100pct, 0, 0, false, alice, alice, { from: alice }),
        'BorrowerOps: There must be either a collateral change or a debt change')
    })

    it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceColl = await getTroveEntireColl(alice)

      // Requested coll withdrawal > coll in the trove
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [aliceColl[0].add(toBN(1))], 0, false, alice, alice, th._100pct, { from: alice })
        // borrowerOperations.adjustTrove(th._100pct, aliceColl.add(toBN(1)), 0, false, alice, alice, { from: alice })
      )
      await assertRevert(
        borrowerOperations.adjustTrove([], [], [contracts.weth.address], [aliceColl[0].add(toBN(dec(37, 'ether')))], 0, false, bob, bob, th._100pct, { from: bob })
        // borrowerOperations.adjustTrove(th._100pct, aliceColl.add(toBN(dec(37, 'ether'))), 0, false, bob, bob, { from: bob })
      )
    })

    it("adjustTrove(): Reverts if borrower has insufficient YUSD balance to cover his debt repayment", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: B } })
      const bobDebt = await getTroveEntireDebt(B)

      // Bob transfers some YUSD to carol
      await yusdToken.transfer(C, dec(10, 18), { from: B })

      //Confirm B's YUSD balance is less than 50 YUSD
      const B_YUSDBal = await yusdToken.balanceOf(B)
      assert.isTrue(B_YUSDBal.lt(bobDebt))

      const repayYUSDPromise_B = borrowerOperations.adjustTrove([], [], [], [], bobDebt, false, B, B, th._100pct, { from: B })
      // borrowerOperations.adjustTrove(th._100pct, 0, bobDebt, false, B, B, { from: B })

      // B attempts to repay all his debt
      await assertRevert(repayYUSDPromise_B, "revert")
    })

    // --- Internal _adjustTrove() ---

    // if (!withProxy) { // no need to test this with proxies
    //   it("Internal _adjustTrove(): reverts when op is a withdrawal and _borrower param is not the msg.sender", async () => {
    //     await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    //     await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

    //     const txPromise_A = borrowerOperations.callInternalAdjustLoan(alice, [], [], [contracts.weth.address], [toBN(dec(1, 18))], toBN(dec(1, 18)), true, alice, alice, th._100pct, {from: bob})
    //     // borrowerOperations.callInternalAdjustLoan(alice, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
    //     await assertRevert(txPromise_A, "BorrowerOps: Caller must be the borrower for a withdrawal")
    //     const txPromise_B = borrowerOperations.callInternalAdjustLoan(bob, [], [], [contracts.weth.address], [dec(1, 18)], dec(1, 18), true, alice, alice, th._100pct, {from: owner})
    //     // borrowerOperations.callInternalAdjustLoan(bob, dec(1, 18), dec(1, 18), true, alice, alice, { from: owner })
    //     await assertRevert(txPromise_B, "BorrowerOps: Caller must be the borrower for a withdrawal")
    //     const txPromise_C = borrowerOperations.callInternalAdjustLoan(carol, [], [], [contracts.weth.address], [dec(1, 18)], dec(1, 18), true, alice, alice, th._100pct, {from: bob})
    //     // borrowerOperations.callInternalAdjustLoan(carol, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
    //     await assertRevert(txPromise_C, "BorrowerOps: Caller must be the borrower for a withdrawal")
    //   })
    // }

    // --- closeTrove() ---

    it("closeTrove(): reverts when it would lower the TCR below CCR", async () => {
      await openTrove({ ICR: toBN(dec(300, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(120, 16)), extraYUSDAmount: toBN(dec(300, 18)), extraParams: { from: bob } })

      const price = await priceFeed.getPrice()

      // to compensate borrowing fees
      await yusdToken.transfer(alice, dec(300, 18), { from: bob })

      assert.isFalse(await troveManager.checkRecoveryMode())

      await assertRevert(
        borrowerOperations.closeTrove({ from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
      )
    })

    it("closeTrove(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Carol with no active trove attempts to close her trove
      try {
        const txCarol = await borrowerOperations.closeTrove({ from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("closeTrove(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Alice transfers her YUSD to Bob and Carol so they can cover fees
      const aliceBal = await yusdToken.balanceOf(alice)
      await yusdToken.transfer(bob, aliceBal.div(toBN(2)), { from: alice })
      await yusdToken.transfer(carol, aliceBal.div(toBN(2)), { from: alice })

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob successfully closes his trove
      const txBob = await borrowerOperations.closeTrove({ from: bob })
      assert.isTrue(txBob.receipt.status)

      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol attempts to close her trove during Recovery Mode
      await assertRevert(borrowerOperations.closeTrove({ from: carol }), "BorrowerOps: Operation not permitted during Recovery Mode")
    })

    it("closeTrove(): reverts when trove is the only one in the system", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Artificially mint to Alice so she has enough to close her trove
      await yusdToken.unprotectedMint(alice, dec(100000, 18))

      // Check she has more YUSD than her trove debt
      const aliceBal = await yusdToken.balanceOf(alice)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceBal.gt(aliceDebt))

      // check Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Alice attempts to close her trove
      await assertRevert(borrowerOperations.closeTrove({ from: alice }), "TroveManager: Only one trove in the system")
    })

    it("closeTrove(): reduces a Trove's collateral to zero", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = toBN((await (getTroveEntireColl(alice)))[0])
      const dennisYUSD = await yusdToken.balanceOf(dennis)
      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(dennisYUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await yusdToken.transfer(alice, dennisYUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({ from: alice })

      const aliceCollAfter = await getTroveEntireColl(alice)
      assert.isTrue(aliceCollAfter.length == 0)
    })

    it("closeTrove(): reduces a Trove's debt to zero", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const dennisYUSD = await yusdToken.balanceOf(dennis)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(dennisYUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await yusdToken.transfer(alice, dennisYUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({ from: alice })

      const aliceCollAfter = await getTroveEntireDebt(alice)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeTrove(): sets Trove's stake to zero", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceStakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))

      const dennisYUSD = await yusdToken.balanceOf(dennis)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))
      assert.isTrue(dennisYUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await yusdToken.transfer(alice, dennisYUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({ from: alice })
      const stakeAfter = ((await troveManager.getTroveStake(alice, contracts.weth.address))).toString()
      assert.equal(stakeAfter, '0')
      // check withdrawal was successful
    })

    it("closeTrove(): zero's the troves reward snapshots", async () => {
      // Dennis opens trove and transfers tokens to alice
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Price drops
      // console.log("price drops to 100")
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate Bob
      await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      // console.log("price bounces back to 200")
      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // Alice and Carol open troves
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Price drops ...again
      // console.log("Price drops again to 100")
      await priceFeed.setPrice(dec(100, 18))

      // Get Alice's pending reward snapshots 

      const L_ETH_A_Snapshot = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const L_YUSDDebt_A_Snapshot = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      // const L_ETH_A_Snapshot = (await troveManager.rewardSnapshots(alice))[0]
      // const L_YUSDDebt_A_Snapshot = (await troveManager.rewardSnapshots(alice))[1]
      assert.isTrue(L_ETH_A_Snapshot.gt(toBN('0')))
      assert.isTrue(L_YUSDDebt_A_Snapshot.gt(toBN('0')))

      // Liquidate Carol
      await troveManager.liquidate(carol)
      assert.isFalse(await sortedTroves.contains(carol))

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const L_ETH_Snapshot_A_AfterLiquidation = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const L_YUSDDebt_Snapshot_A_AfterLiquidation = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(toBN('0')))
      assert.isTrue(L_YUSDDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

      // console.log("Price raised to 200")
      await priceFeed.setPrice(dec(200, 18))

      // console.log("TCR")
      // console.log((await th.getTCR(contracts)).toString())

      // Alice closes trove
      await borrowerOperations.closeTrove({ from: alice })

      // Check Alice's pending reward snapshots are zero
      const L_ETH_Snapshot_A_afterAliceCloses = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const L_YUSDDebt_Snapshot_A_afterAliceCloses = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      assert.equal(L_ETH_Snapshot_A_afterAliceCloses, '0')
      assert.equal(L_YUSDDebt_Snapshot_A_afterAliceCloses, '0')
    })

    it("closeTrove(): sets trove's status to closed and removes it from sorted troves list", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is active
      // const alice_Trove_Before = await troveManager.Troves(alice)
      const status_Before = await troveManager.getTroveStatus(alice)

      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove({ from: alice })

      // const alice_Trove_After = await troveManager.Troves(alice)
      const status_After = await troveManager.getTroveStatus(alice)

      assert.equal(status_After, 2)
      assert.isFalse(await sortedTroves.contains(alice))
    })

    it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisColl = await getTroveEntireColl(dennis)
      const aliceColl = await getTroveEntireColl(alice)
      assert.isTrue(dennisColl[0].gt('0'))
      assert.isTrue(aliceColl[0].gt('0'))

      // Check active Pool ETH before
      const activePool_ETH_before = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_before = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_before.eq(aliceColl[0].add(dennisColl[0])))
      assert.isTrue(activePool_ETH_before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_before.eq(activePool_ETH_before))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove({ from: alice })

      // Check after
      const activePool_ETH_After = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(dennisColl[0]))
      assert.isTrue(activePool_RawEther_After.eq(dennisColl[0]))
    })

    it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisDebt = await getTroveEntireDebt(dennis)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(dennisDebt.gt('0'))
      assert.isTrue(aliceDebt.gt('0'))

      // Check before
      const activePool_Debt_before = await activePool.getYUSDDebt()
      assert.isTrue(activePool_Debt_before.eq(aliceDebt.add(dennisDebt)))
      assert.isTrue(activePool_Debt_before.gt(toBN('0')))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove({ from: alice })

      // Check after
      const activePool_Debt_After = (await activePool.getYUSDDebt()).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt)
    })

    it("closeTrove(): updates the the total stakes", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Get individual stakes
      const aliceStakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const bobStakeBefore = await troveManager.getTroveStake(bob, contracts.weth.address)
      const dennisStakeBefore = await troveManager.getTroveStake(dennis, contracts.weth.address)
      assert.isTrue(aliceStakeBefore.gt('0'))
      assert.isTrue(bobStakeBefore.gt('0'))
      assert.isTrue(dennisStakeBefore.gt('0'))

      const totalStakesBefore = await troveManager.getTotalStake(contracts.weth.address)

      assert.isTrue(totalStakesBefore.eq(aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore)))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

      // Alice closes trove
      await borrowerOperations.closeTrove({ from: alice })

      // Check stake and total stakes get updated
      const aliceStakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesAfter = await troveManager.getTotalStake(contracts.weth.address)

      assert.equal(aliceStakeAfter, 0)
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)))
    })

    if (!withProxy) { // TODO: wrap contracts.weth.balanceOf to be able to go through proxies
      it("closeTrove(): sends the correct amount of ETH to the user", async () => {
        await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
        await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        const aliceColl = await getTroveEntireColl(alice)
        assert.isTrue(aliceColl[0].gt(toBN('0')))

        const alice_ETHBalance_Before = toBN(await contracts.weth.balanceOf(alice))

        // to compensate borrowing fees
        await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

        await borrowerOperations.closeTrove({ from: alice })

        const alice_ETHBalance_After = toBN(await contracts.weth.balanceOf(alice))
        const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

        assert.isTrue(balanceDiff.eq(aliceColl[0]))
      })
    }

    it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's YUSDToken balance", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, await yusdToken.balanceOf(dennis), { from: dennis })

      const alice_YUSDBalance_Before = await yusdToken.balanceOf(alice)
      assert.isTrue(alice_YUSDBalance_Before.gt(toBN('0')))

      // close trove
      await borrowerOperations.closeTrove({ from: alice })

      // check alice YUSD balance after
      const alice_YUSDBalance_After = await yusdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_YUSDBalance_After, alice_YUSDBalance_Before.sub(aliceDebt.sub(YUSD_GAS_COMPENSATION)))
    })

    it("closeTrove(): applies pending rewards", async () => {
      // --- SETUP ---
      await openTrove({ extraYUSDAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      const whaleDebt = await getTroveEntireDebt(whale)
      const whaleColl = await getTroveEntireColl(whale)

      await openTrove({ extraYUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolDebt = await getTroveEntireDebt(carol)
      const carolColl = await getTroveEntireColl(carol)

      // Whale transfers to A and B to cover their fees
      await yusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await yusdToken.transfer(bob, dec(10000, 18), { from: whale })

      // --- TEST ---

      // price drops to 1ETH:100YUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice()

      // liquidate Carol's Trove, Alice and Bob earn rewards.
      const liquidationTx = await troveManager.liquidate(carol, { from: owner });
      const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

      // Dennis opens a new Trove 
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      // const alice_rewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contacts.weth.address)
      const alice_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(alice, contracts.weth.address)
      const alice_YUSDDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotYUSD(alice, contracts.weth.address)

      // const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)
      const bob_YUSDDebtRewardSnapshot_Before = await troveManager.getRewardSnapshotYUSD(bob, contracts.weth.address)

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_YUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_YUSDDebtRewardSnapshot_Before, 0)

      const defaultPool_ETH = await defaultPool.getCollateral(contracts.weth.address)
      const defaultPool_YUSDDebt = await defaultPool.getYUSDDebt()

      // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
      assert.isAtMost(th.getDifference(defaultPool_YUSDDebt, liquidatedDebt_C), 100)

      // const pendingCollReward_A = await troveManager.getPendingETHReward(alice)
      const pendingCollReward_A = (await troveManager.getPendingCollRewards(alice))[1][0] //amounts, 0th index
      const pendingDebtReward_A = await troveManager.getPendingYUSDDebtReward(alice)
      assert.isTrue(pendingCollReward_A.gt('0'))
      assert.isTrue(pendingDebtReward_A.gt('0'))

      // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeTrove({ from: alice })

      const defaultPool_ETH_afterAliceCloses = await defaultPool.getCollateral(contracts.weth.address)
      const defaultPool_YUSDDebt_afterAliceCloses = await defaultPool.getYUSDDebt()

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
        defaultPool_ETH.sub(pendingCollReward_A)), 1000)
      assert.isAtMost(th.getDifference(defaultPool_YUSDDebt_afterAliceCloses,
        defaultPool_YUSDDebt.sub(pendingDebtReward_A)), 1000)

      // whale adjusts trove, pulling their rewards out of DefaultPool
      const repayYUSDPromise_B = borrowerOperations.adjustTrove([], [], [], [], dec(1, 18), true, whale, whale, th._100pct, { from: whale })
      // await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), true, whale, whale, { from: whale })

      // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeTrove({ from: bob })

      const defaultPool_ETH_afterBobCloses = await defaultPool.getCollateral(contracts.weth.address)
      const defaultPool_YUSDDebt_afterBobCloses = await defaultPool.getYUSDDebt()

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100000)
      assert.isAtMost(th.getDifference(defaultPool_YUSDDebt_afterBobCloses, 0), 100000)
    })

    it("closeTrove(): reverts if borrower has insufficient YUSD balance to repay his entire debt", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      //Confirm Bob's YUSD balance is less than his trove debt
      const B_YUSDBal = await yusdToken.balanceOf(B)
      const B_troveDebt = await getTroveEntireDebt(B)

      assert.isTrue(B_YUSDBal.lt(B_troveDebt))

      const closeTrovePromise_B = borrowerOperations.closeTrove({ from: B })

      // Check closing trove reverts
      await assertRevert(closeTrovePromise_B, "BorrowerOps: Caller doesnt have enough YUSD to make repayment")
    })

    // --- openTrove() ---

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => {
        const txA = (await openTrove({ extraYUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })).tx
        const txB = (await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })).tx
        const txC = (await openTrove({ extraYUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })).tx

        const A_Coll = await getTroveEntireColl(A)
        const B_Coll = await getTroveEntireColl(B)
        const C_Coll = await getTroveEntireColl(C)
        const A_Debt = await getTroveEntireDebt(A)
        const B_Debt = await getTroveEntireDebt(B)
        const C_Debt = await getTroveEntireDebt(C)

        const A_emittedDebt = toBN(th.getEventArgByName(txA, "TroveUpdated", "_debt"))
        const A_emittedColl = toBN(th.getEventArgByName(txA, "TroveUpdated", "_amounts")[0])
        const B_emittedDebt = toBN(th.getEventArgByName(txB, "TroveUpdated", "_debt"))
        const B_emittedColl = toBN(th.getEventArgByName(txB, "TroveUpdated", "_amounts")[0])
        const C_emittedDebt = toBN(th.getEventArgByName(txC, "TroveUpdated", "_debt"))
        const C_emittedColl = toBN(th.getEventArgByName(txC, "TroveUpdated", "_amounts")[0])

        // Check emitted debt values are correct
        assert.isTrue(A_Debt.eq(A_emittedDebt))
        assert.isTrue(B_Debt.eq(B_emittedDebt))
        assert.isTrue(C_Debt.eq(C_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(A_Coll[0].eq(A_emittedColl))
        assert.isTrue(B_Coll[0].eq(B_emittedColl))
        assert.isTrue(C_Coll[0].eq(C_emittedColl))

        const baseRateBefore = await troveManager.baseRate()

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        assert.isTrue((await troveManager.baseRate()).gt(baseRateBefore))

        const txD = (await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })).tx
        const txE = (await openTrove({ extraYUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })).tx
        const D_Coll = await getTroveEntireColl(D)
        const E_Coll = await getTroveEntireColl(E)
        const D_Debt = await getTroveEntireDebt(D)
        const E_Debt = await getTroveEntireDebt(E)

        const D_emittedDebt = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
        const D_emittedColl = toBN(th.getEventArgByName(txD, "TroveUpdated", "_amounts")[0])

        const E_emittedDebt = toBN(th.getEventArgByName(txE, "TroveUpdated", "_debt"))
        const E_emittedColl = toBN(th.getEventArgByName(txE, "TroveUpdated", "_amounts")[0])

        // Check emitted debt values are correct
        assert.isTrue(D_Debt.eq(D_emittedDebt))
        assert.isTrue(E_Debt.eq(E_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(D_Coll[0].eq(D_emittedColl))
        assert.isTrue(E_Coll[0].eq(E_emittedColl))
      })
    }

    it("openTrove(): Opens a trove with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      const txA = await contracts.borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))), A, A, [contracts.weth.address], [toBN(dec(100, 30))], { from: A })
      //borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))), A, A, { from: A, value: dec(100, 30) })
      assert.isTrue(txA.receipt.status)
      assert.isTrue(await sortedTroves.contains(A))

      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
      const txC = await contracts.borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))), A, A, [contracts.weth.address], [toBN(dec(100, 30))], { from: C })
      //borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))), A, A, { from: C, value: dec(100, 30) })
      assert.isTrue(txC.receipt.status)
      assert.isTrue(await sortedTroves.contains(C))
    })

    it("openTrove(): reverts if net debt < minimum net debt", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: A })
      const txAPromise = contracts.borrowerOperations.openTrove(th._100pct, 0, A, A, [contracts.weth.address], [toBN(dec(100, 30))], { from: A })
      //borrowerOperations.openTrove(th._100pct, 0, A, A, { from: A, value: dec(100, 30) })
      await assertRevert(txAPromise, "revert")

      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: B })
      const txBPromise = contracts.borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))), B, B, [contracts.weth.address], [toBN(dec(100, 30))], { from: B })
      //borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))), B, B, { from: B, value: dec(100, 30) })
      await assertRevert(txBPromise, "revert")

      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 30)), { from: C })
      const txCPromise = contracts.borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, [contracts.weth.address], [toBN(dec(100, 30))], { from: C })
      //borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, { from: C, value: dec(100, 30) })
      await assertRevert(txCPromise, "revert")
    })

    it("openTrove(): decays a non-zero base rate", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraYUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({ extraYUSDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("openTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraYUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({ extraYUSDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // Borrower D triggers a fee
      await openTrove({ extraYUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

      // Borrower E triggers a fee
      await openTrove({ extraYUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("openTrove(): reverts if max fee > 100%", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(1000, 'ether')), { from: A })
      await assertRevert(
        contracts.borrowerOperations.openTrove(dec(2, 18), dec(10000, 18), A, A, [contracts.weth.address], [toBN(dec(1000, 'ether'))], { from: A }),
        // borrowerOperations.openTrove(dec(2, 18), dec(10000, 18), A, A, { from: A, value: dec(1000, 'ether') }), 
        "Max fee percentage must be between 0.5% and 100%")

      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: B })
      await assertRevert(
        contracts.borrowerOperations.openTrove('1000000000000000001', dec(20000, 18), B, B, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: B }),
        // borrowerOperations.openTrove('1000000000000000001', dec(20000, 18), B, B, { from: B, value: dec(1000, 'ether') }), 
        "Max fee percentage must be between 0.5% and 100%")
    })

    it("openTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(50000, 'ether')), { from: A })
      await assertRevert(
        contracts.borrowerOperations.openTrove(0, dec(195000, 18), A, A, [contracts.weth.address], [toBN(dec(1200, 'ether'))], { from: A }),
        // borrowerOperations.openTrove(0, dec(195000, 18), A, A, { from: A, value: dec(1200, 'ether') }), 
        "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(
        contracts.borrowerOperations.openTrove(1, dec(195000, 18), A, A, [contracts.weth.address], [toBN(dec(1000, 'ether'))], { from: A }),
        // borrowerOperations.openTrove(1, dec(195000, 18), A, A, { from: A, value: dec(1000, 'ether') }), 
        "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(
        contracts.borrowerOperations.openTrove('4999999999999999', dec(195000, 18), A, A, [contracts.weth.address], [toBN(dec(1200, 'ether'))], { from: A }),
        // borrowerOperations.openTrove('4999999999999999', dec(195000, 18), B, B, { from: B, value: dec(1200, 'ether') }), 
        "Max fee percentage must be between 0.5% and 100%")
    })

    it("openTrove(): allows max fee < 0.5% in Recovery Mode", async () => {
      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(2000, 'ether')), { from: A })
      // await borrowerOperations.openTrove(th._100pct, dec(195000, 18), A, A, { from: A, value: dec(2000, 'ether') })
      await contracts.borrowerOperations.openTrove(th._100pct, dec(195000, 18), A, A, [contracts.weth.address], [toBN(dec(2000, 'ether'))], { from: A })

      await priceFeed.setPrice(dec(100, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))

      await th.addERC20(contracts.weth, B, contracts.borrowerOperations.address, toBN(dec(3100, 'ether')), { from: B })
      await contracts.borrowerOperations.openTrove(0, dec(19500, 18), B, B, [contracts.weth.address], [toBN(dec(3100, 'ether'))], { from: B })
      //borrowerOperations.openTrove(0, dec(19500, 18), B, B, { from: B, value: dec(3100, 'ether') })
      await priceFeed.setPrice(dec(50, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(3100, 'ether')), { from: C })
      await contracts.borrowerOperations.openTrove(1, dec(19500, 18), C, C, [contracts.weth.address], [toBN(dec(3100, 'ether'))], { from: C })
      //borrowerOperations.openTrove(1, dec(19500, 18), C, C, { from: C, value: dec(3100, 'ether') })
      await priceFeed.setPrice(dec(25, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(3100, 'ether')), { from: D })
      await contracts.borrowerOperations.openTrove('4999999999999999', dec(19500, 18), D, D, [contracts.weth.address], [toBN(dec(3100, 'ether'))], { from: D })
      // await borrowerOperations.openTrove('4999999999999999', dec(19500, 18), D, D, { from: D, value: dec(3100, 'ether') })
    })

    xit("openTrove(): reverts if fee exceeds max fee percentage", async () => { // new fee system takes into account the max of ether and debt. 
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      const totalSupply = await yusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      //       actual fee percentage: 0.005000000186264514
      // user's max fee percentage:  0.0049999999999999999
      let borrowingRate = await troveManager.getBorrowingRate() // expect max(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      const lessThan5pct = '49999999999999999'
      await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(50000, 'ether')), { from: D })
      await assertRevert(
        contracts.borrowerOperations.openTrove(lessThan5pct, dec(30000, 18), A, A, [contracts.weth.address], [toBN(dec(1000, 'ether'))], { from: D }),
        // borrowerOperations.openTrove(lessThan5pct, dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), 
        "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1%

      await assertRevert(
        contracts.borrowerOperations.openTrove(dec(1, 16), dec(30000, 18), A, A, [contracts.weth.address], [toBN(dec(1000, 'ether'))], { from: D }),
        // borrowerOperations.openTrove(dec(1, 16), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), 
        "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(
        contracts.borrowerOperations.openTrove(dec(3754, 13), dec(30000, 18), A, A, [contracts.weth.address], [toBN(dec(1000, 'ether'))], { from: D }),
        // borrowerOperations.openTrove(dec(3754, 13), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), 
        "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1e-16%
      await assertRevert(
        contracts.borrowerOperations.openTrove(dec(5, 15), dec(30000, 18), A, A, [contracts.weth.address], [toBN(dec(1000, 'ether'))], { from: D }),
        // borrowerOperations.openTrove(dec(5, 15), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), 
        "Fee exceeded provided maximum")
    })

    it("openTrove(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let borrowingRate = await troveManager.getBorrowingRate() // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: D })
      const tx1 = await contracts.borrowerOperations.openTrove(moreThan5pct, dec(10000, 18), A, A, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: D })
      // borrowerOperations.openTrove(moreThan5pct, dec(10000, 18), A, A, { from: D, value: dec(100, 'ether') })
      assert.isTrue(tx1.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee = 5%
      await th.addERC20(contracts.weth, H, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: H })
      const tx2 = await contracts.borrowerOperations.openTrove(dec(5, 16), dec(10000, 18), A, A, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: H })
      // borrowerOperations.openTrove(dec(5, 16), dec(10000, 18), A, A, { from: H, value: dec(100, 'ether') })
      assert.isTrue(tx2.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 10%
      await th.addERC20(contracts.weth, E, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: E })
      const tx3 = await contracts.borrowerOperations.openTrove(dec(1, 17), dec(10000, 18), A, A, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: E })
      // borrowerOperations.openTrove(dec(1, 17), dec(10000, 18), A, A, { from: E, value: dec(100, 'ether') })
      assert.isTrue(tx3.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      await th.addERC20(contracts.weth, F, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: F })
      const tx4 = await contracts.borrowerOperations.openTrove(dec(37659, 13), dec(10000, 18), A, A, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: F })
      // borrowerOperations.openTrove(dec(37659, 13), dec(10000, 18), A, A, { from: F, value: dec(100, 'ether') })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      await th.addERC20(contracts.weth, G, contracts.borrowerOperations.address, toBN(dec(1000, 'ether')), { from: G })
      const tx5 = await contracts.borrowerOperations.openTrove(dec(1, 18), dec(10000, 18), A, A, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: G })
      //borrowerOperations.openTrove(dec(1, 18), dec(10000, 18), A, A, { from: G, value: dec(100, 'ether') })
      assert.isTrue(tx5.receipt.status)
    })

    it("openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 59 minutes pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Assume Borrower also owns accounts D and E
      // Borrower triggers a fee, before decay interval has passed
      await openTrove({ extraYUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // 1 minute pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Borrower triggers another fee
      await openTrove({ extraYUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("openTrove(): borrowing at non-zero base rate sends YUSD fee to sYETI contract", async () => {
      // time fast-forwards 1 year, and E stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI YUSD balance before == 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETI_YUSDBalance_Before, '0')

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check YETI YUSD balance after has increased
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Trove struct", async () => {
        // time fast-forwards 1 year, and E stakes 1 YETI
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
        await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
        await sYETI.mint(dec(1, 18), { from: E })

        await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const D_YUSDRequest = toBN(dec(20000, 18))

        // D withdraws YUSD
        await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(200, 'ether')), { from: D })
        const openTroveTx = await contracts.borrowerOperations.openTrove(th._100pct, D_YUSDRequest, ZERO_ADDRESS, ZERO_ADDRESS, [contracts.weth.address], [toBN(dec(200, 'ether'))], { from: D })
        // borrowerOperations.openTrove(th._100pct, D_YUSDRequest, ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(200, 'ether') })

        const emittedFee = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(openTroveTx))
        assert.isTrue(toBN(emittedFee).gt(toBN('0')))

        const newDebt = await troveManager.getTroveDebt(D)
        // const newDebt = (await troveManager.Troves(D))[0]

        // Check debt on Trove struct equals drawn debt plus emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_YUSDRequest.add(emittedFee).add(YUSD_GAS_COMPENSATION), 100000)
      })
    }
    
    // @KingYeti: F_YUSD() function no longer exists
    // it("openTrove(): Borrowing at non-zero base rate increases the sYETI contract YUSD fees-per-unit-staked", async () => {
    //   // time fast-forwards 1 year, and E stakes 1 YETI
    //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
    //   await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
    //   await sYETI.mint(dec(1, 18), { from: E })
    //
    //   // Check YETI contract YUSD fees-per-unit-staked is zero
    //   const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)
    //   assert.equal(F_YUSD_Before, '0')
    //
    //   await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    //   await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    //   await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    //   await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    //
    //   // Artificially make baseRate 5%
    //   await troveManager.setBaseRate(dec(5, 16))
    //   await troveManager.setLastFeeOpTimeToNow()
    //
    //   // Check baseRate is now non-zero
    //   const baseRate_1 = await troveManager.baseRate()
    //   assert.isTrue(baseRate_1.gt(toBN('0')))
    //
    //   // 2 hours pass
    //   th.fastForwardTime(7200, web3.currentProvider)
    //
    //   // D opens trove 
    //   await openTrove({ extraYUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    //
    //   // Check YETI contract YUSD fees-per-unit-staked has increased
    //   const F_YUSD_After = await sYETI.F_YUSD()
    //   assert.isTrue(F_YUSD_After.gt(F_YUSD_Before))
    // })

    it("openTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and E stakes 1 YETI
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await yetiToken.approve(sYETI.address, dec(1, 18), { from: E })
      await yetiToken.unprotectedMint(E, dec(1, 18), {from : E})
      await sYETI.mint(dec(1, 18), { from: E })

      // Check YETI Staking contract balance before == 0
      const sYETI_YUSDBalance_Before = await yusdToken.balanceOf(sYETI.address)
      assert.equal(sYETI_YUSDBalance_Before, '0')

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const YUSDRequest_D = toBN(dec(40000, 18))
      await th.addERC20(contracts.weth, D, contracts.borrowerOperations.address, toBN(dec(500, 'ether')), { from: D })
      await contracts.borrowerOperations.openTrove(th._100pct, YUSDRequest_D, D, D, [contracts.weth.address], [toBN(dec(500, 'ether'))], { from: D })
      // await borrowerOperations.openTrove(th._100pct, YUSDRequest_D, D, D, { from: D, value: dec(500, 'ether') })

      // Check sYETI YUSD balance has increased
      const sYETI_YUSDBalance_After = await yusdToken.balanceOf(sYETI.address)
      assert.isTrue(sYETI_YUSDBalance_After.gt(sYETI_YUSDBalance_Before))

      // Check D's YUSD balance now equals their requested YUSD
      const YUSDBalance_D = await yusdToken.balanceOf(D)
      assert.isTrue(YUSDRequest_D.eq(YUSDBalance_D))
    })

    // @KingYeti: no longer using F_YUSD
    // it("openTrove(): Borrowing at zero base rate changes the sYETI contract YUSD fees-per-unit-staked", async () => {
    //   await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    //   await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    //   await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    //
    //   // Check baseRate is zero
    //   const baseRate_1 = await troveManager.baseRate()
    //   assert.equal(baseRate_1, '0')
    //
    //   // 2 hours pass
    //   th.fastForwardTime(7200, web3.currentProvider)
    //
    //   // Check YUSD reward per YETI staked == 0
    //   const F_YUSD_Before = await yusdToken.balanceOf(sYETI.address)
    //   assert.equal(F_YUSD_Before, '0')
    //
    //   // A stakes YETI
    //   await yetiToken.unprotectedMint(A, dec(100, 18))
    //   await sYETI.mint(dec(100, 18), { from: A })
    //
    //   // D opens trove
    //   await openTrove({ extraYUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    //
    //   // Check YUSD reward per YETI staked > 0
    //   const F_YUSD_After = await yusdToken.balanceOf(sYETI.address)
    //   assert.isTrue(F_YUSD_After.gt(toBN('0')))
    // })

    it("openTrove(): Borrowing at zero base rate charges minimum fee", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      const YUSDRequest = toBN(dec(10000, 18))
      await th.addERC20(contracts.weth, C, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: C })
      const txC = await contracts.borrowerOperations.openTrove(th._100pct, YUSDRequest, ZERO_ADDRESS, ZERO_ADDRESS, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: C })
      // const txC = await borrowerOperations.openTrove(th._100pct, YUSDRequest, ZERO_ADDRESS, ZERO_ADDRESS, { value: dec(100, 'ether'), from: C })
      const _YUSDFee = toBN(th.getEventArgByName(txC, "YUSDBorrowingFeePaid", "_YUSDFee"))

      const expectedFee = BORROWING_FEE_FLOOR.mul(toBN(YUSDRequest)).div(toBN(dec(1, 18)))
      assert.isTrue(_YUSDFee.eq(expectedFee))
    })

    it("openTrove(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob = await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: alice } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when trove ICR < MCR", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR trove in Normal Mode
      try {
        const txBob = (await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR trove in Recovery Mode
      try {
        const txBob = await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      // Alice creates trove with 150% ICR.  System TCR = 150%.
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = await th.getTCR(contracts)
      assert.equal(TCR, dec(150, 16))
      // Bob attempts to open a trove with ICR = 149% 
      // System TCR would fall below 150%
      try {
        const txBob = await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts if trove is already active", async () => {
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      try {
        const txB_1 = await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_2 = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("openTrove(): Can open a trove with ICR >= CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100YUSD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol opens at 150% ICR in Recovery Mode
      const txCarol = (await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: carol } })).tx
      assert.isTrue(txCarol.receipt.status)
      assert.isTrue(await sortedTroves.contains(carol))

      const carol_TroveStatus = await troveManager.getTroveStatus(carol)
      assert.equal(carol_TroveStatus, 1)

      const carolICR = await troveManager.getCurrentICR(carol)
      assert.isTrue(carolICR.gt(toBN(dec(150, 16))))
    })

    it("openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100YUSD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');

      assert.isTrue(await th.checkRecoveryMode(contracts))

      await th.addERC20(contracts.weth, A, contracts.borrowerOperations.address, toBN(dec(1, 'ether')), { from: A })
      await assertRevert(
        contracts.borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT), carol, carol, [contracts.weth.address], [toBN(dec(1, 'ether'))], { from: carol })
        // borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT), carol, carol, { from: carol, value: dec(1, 'ether') })
      )
    })

    it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
      const debt_Before = await getTroveEntireDebt(alice)
      const coll_Before = await getTroveEntireColl(alice)
      const status_Before = await troveManager.getTroveStatus(alice)

      // check coll and debt before
      assert.equal(debt_Before, 0)
      assert.equal(coll_Before, 0)

      // check non-existent status
      assert.equal(status_Before, 0)

      const YUSDRequest = MIN_NET_DEBT
      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: alice })
      await contracts.borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT, carol, carol, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: alice })
      // borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT, carol, carol, { from: alice, value: dec(100, 'ether') })

      // Get the expected debt based on the YUSD request (adding fee and liq. reserve on top)
      const expectedDebt = YUSDRequest
        .add(await troveManager.getBorrowingFee(YUSDRequest))
        .add(YUSD_GAS_COMPENSATION)

      const debt_After = await getTroveEntireDebt(alice)
      const coll_After = await getTroveEntireColl(alice)
      const status_After = await troveManager.getTroveStatus(alice)

      // check coll and debt after
      assert.isTrue(coll_After[0].gt('0'))
      assert.isTrue(debt_After.gt('0'))

      assert.isTrue(debt_After.eq(expectedDebt))

      // check active status
      assert.equal(status_After, 1)
    })

    it("openTrove(): adds Trove owner to TroveOwners array", async () => {
      const TroveOwnersCount_Before = (await troveManager.getTroveOwnersCount()).toString();
      assert.equal(TroveOwnersCount_Before, '0')

      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TroveOwnersCount_After = (await troveManager.getTroveOwnersCount()).toString();
      assert.equal(TroveOwnersCount_After, '1')
    })

    it("openTrove(): creates a stake and adds it to total stakes", async () => {
      const aliceStakeBefore = await troveManager.getTroveStake(alice, contracts.weth.address)
      const totalStakesBefore = await troveManager.getTotalStake(contracts.weth.address)

      assert.equal(aliceStakeBefore, '0')
      assert.equal(totalStakesBefore, '0')

      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceStakeAfter = await troveManager.getTroveStake(alice, contracts.weth.address)
      assert.isTrue(aliceCollAfter[0].gt(toBN('0')))
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter[0]))

      const totalStakesAfter = await troveManager.getTotalStake(contracts.weth.address)

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter))
    })

    it("openTrove(): inserts Trove to Sorted Troves list", async () => {
      // Check before
      const aliceTroveInList_Before = await sortedTroves.contains(alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_Before, false)
      assert.equal(listIsEmpty_Before, true)

      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check after
      const aliceTroveInList_After = await sortedTroves.contains(alice)
      const listIsEmpty_After = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const activePool_ETH_Before = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_Before = await contracts.weth.balanceOf(activePool.address)
      assert.equal(activePool_ETH_Before, 0)
      assert.equal(activePool_RawEther_Before, 0)

      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getTroveEntireColl(alice)

      const activePool_ETH_After = await activePool.getCollateral(contracts.weth.address)
      const activePool_RawEther_After = toBN(await contracts.weth.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(aliceCollAfter[0]))
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter[0]))
    })

    // TODO 
    it("openTrove(): records up-to-date initial snapshots of L_ETH and L_YUSDDebt", async () => {
      // --- SETUP ---

      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100YUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Trove, liquidating her 1 ether and 180YUSD.
      const liquidationTx = await troveManager.liquidate(carol, { from: owner });
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

      /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
       and L_YUSD should equal 18 YUSD per-ether-staked. */

      // const L_ETH = await troveManager.L_ETH()
      const L_ETH = await troveManager.getL_Coll(contracts.weth.address)
      const L_YUSD = await troveManager.L_YUSDDebt(contracts.weth.address)

      assert.isTrue(L_ETH.gt(toBN('0')))
      assert.isTrue(L_YUSD.gt(toBN('0')))

      // Bob opens trove
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Check Bob's snapshots of L_ETH and L_YUSD equal the respective current values
      // const bob_rewardSnapshot = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot = await troveManager.getRewardSnapshotColl(bob, contracts.weth.address)// bob_rewardSnapshot[0]
      const bob_YUSDDebtRewardSnapshot = await troveManager.getRewardSnapshotYUSD(bob, contracts.weth.address)

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 1000)
      assert.isAtMost(th.getDifference(bob_YUSDDebtRewardSnapshot, L_YUSD), 1000)
    })

    it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
      // Open Troves
      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Check Trove is active
      // const alice_Trove_1 = await troveManager.Troves(alice)
      const status_1 = await troveManager.getTroveStatus(alice)
      assert.equal(status_1, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // to compensate borrowing fees
      await yusdToken.transfer(alice, dec(10000, 18), { from: whale })

      // Repay and close Trove
      await borrowerOperations.closeTrove({ from: alice })

      // Check Trove is closed
      // const alice_Trove_2 = await troveManager.Troves(alice)
      const status_2 = await troveManager.getTroveStatus(alice)
      assert.equal(status_2, 2)
      assert.isFalse(await sortedTroves.contains(alice))

      // Re-open Trove
      await openTrove({ extraYUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is re-opened
      // const alice_Trove_3 = await troveManager.Troves(alice)
      const status_3 = await troveManager.getTroveStatus(alice)
      assert.equal(status_3, 1)
      assert.isTrue(await sortedTroves.contains(alice))
    })

    it("openTrove(): increases the Trove's YUSD debt by the correct amount", async () => {
      // check before
      // const alice_Trove_Before = await troveManager.Troves(alice)
      const debt_Before = await troveManager.getTroveDebt(alice)//alice_Trove_Before[0]
      assert.equal(debt_Before, 0)

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(100, 'ether')), { from: alice })
      await contracts.borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(10000, 18)), alice, alice, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: alice })
      // borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(10000, 18)), alice, alice, { from: alice, value: dec(100, 'ether') })

      // check after
      // const alice_Trove_After = await troveManager.Troves(alice)
      const debt_After = await troveManager.getTroveDebt(alice) //alice_Trove_After[0]
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000)
    })

    it("openTrove(): increases YUSD debt in ActivePool by the debt of the trove", async () => {
      const activePool_YUSDDebt_Before = await activePool.getYUSDDebt()
      assert.equal(activePool_YUSDDebt_Before, 0)

      await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      const activePool_YUSDDebt_After = await activePool.getYUSDDebt()
      assert.isTrue(activePool_YUSDDebt_After.eq(aliceDebt))
    })

    it("openTrove(): increases user YUSDToken balance by correct amount", async () => {
      // check before
      const alice_YUSDTokenBalance_Before = await yusdToken.balanceOf(alice)
      assert.equal(alice_YUSDTokenBalance_Before, 0)

      await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(dec(1000, 'ether')), { from: alice })
      await contracts.borrowerOperations.openTrove(th._100pct, dec(10000, 18), alice, alice, [contracts.weth.address], [toBN(dec(100, 'ether'))], { from: alice })
      // borrowerOperations.openTrove(th._100pct, dec(10000, 18), alice, alice, { from: alice, value: dec(100, 'ether') })

      // check after
      const alice_YUSDTokenBalance_After = await yusdToken.balanceOf(alice)
      assert.equal(alice_YUSDTokenBalance_After, dec(10000, 18))
    })

    //  --- getNewICRFromTroveChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromTroveChange() returns the correct ICR", async () => {


      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl])).toString()
        console.log("New VC " + newVC)
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl])).toString()
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, true)).toString()
        assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl])).toString()
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, false)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(1, 'ether'))
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl.add(collChange)])).toString()
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(5, 17))
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl.sub(collChange)])).toString()
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '1000000000000000000')
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(5, 17))
        const debtChange = dec(50, 18)
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl.sub(collChange)])).toString()

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, false)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(1, 'ether'))
        const debtChange = dec(100, 18)
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl.add(collChange)])).toString()


        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(1, 'ether'))
        const debtChange = dec(50, 18)
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl.add(collChange)])).toString()

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, false)).toString()
        assert.equal(newICR, '8000000000000000000')
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        const initialColl = toBN(dec(1, 'ether'))
        const initialDebt = dec(100, 18)
        const collChange = toBN(dec(5, 17))
        const debtChange = dec(100, 18)
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [initialColl.sub(collChange)])).toString()

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(newVC, initialDebt, debtChange, true)).toString()
        assert.equal(newICR, '500000000000000000')
      })
    })

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      const res1 = await borrowerOperations.getCompositeDebt('0')
      assert.equal(res1, YUSD_GAS_COMPENSATION.toString())

      const res2 = await borrowerOperations.getCompositeDebt(dec(90, 18))
      th.assertIsApproximatelyEqual(res2, YUSD_GAS_COMPENSATION.add(toBN(dec(90, 18))))

      const res3 = await borrowerOperations.getCompositeDebt(dec(24423422357345049, 12))
      th.assertIsApproximatelyEqual(res3, YUSD_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))))
    })

    //  --- getNewTCRFromTroveChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)

        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedCollAmount, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = 0
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true)

        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [troveColl.add(liquidatedCollAmount)]))
        const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt))
        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)

        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        // const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)
        const [liquidatedDebt, liquidatedCollAmount, gasCompAmounts] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(200, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true))

        // const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
        //   .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))
        const newVC = (await borrowerOperations.getVC([contracts.weth.address], [troveColl.add(liquidatedCollAmount)]))
        const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)
        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)
        // const [liquidatedDebt, liquidatedCollTokens, liquidatedCollAmounts] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = 0
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0])]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt).sub(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)

        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)
        // const [liquidatedDebt, liquidatedCollTokens, liquidatedCollAmounts] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = dec(2, 'ether')
        const debtChange = 0

        const collChangeVC = (await borrowerOperations.getVC([contracts.weth.address], [collChange]))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChangeVC, true, debtChange, true))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0]).add(toBN(collChange))]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)
        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)


        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = 0

        const collChangeVC = (await borrowerOperations.getVC([contracts.weth.address], [collChange]))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChangeVC, false, debtChange, true))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0]).sub(toBN(collChange))]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)
        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)


        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = dec(100, 18)

        const collChangeVC = (await borrowerOperations.getVC([contracts.weth.address], [collChange]))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChangeVC, false, debtChange, false))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0]).sub(toBN(collChange))]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt).sub(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)
        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)

        const collChangeVC = (await borrowerOperations.getVC([contracts.weth.address], [collChange]))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChangeVC, true, debtChange, true))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(dec(100, 18))))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0]).add(toBN(collChange))]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)
        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)

        const collChangeVC = (await borrowerOperations.getVC([contracts.weth.address], [collChange]))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChangeVC, true, debtChange, false))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
        .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0]).add(toBN(collChange))]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt).sub(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveYUSDAmount = await getOpenTroveYUSDAmount(troveTotalDebt)
        await th.addERC20(contracts.weth, alice, contracts.borrowerOperations.address, toBN(troveColl), { from: alice })
        await th.addERC20(contracts.weth, bob, contracts.borrowerOperations.address, toBN(troveColl), { from: bob })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, [contracts.weth.address], [troveColl], { from: alice })
        await contracts.borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, [contracts.weth.address], [troveColl], { from: bob })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, alice, alice, { from: alice, value: troveColl })
        // await borrowerOperations.openTrove(th._100pct, troveYUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx, wethIDX)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = await getNetBorrowingAmount(dec(200, 18))

        const collChangeVC = (await borrowerOperations.getVC([contracts.weth.address], [collChange]))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChangeVC, false, debtChange, true))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(collChange))).mul(price)
        .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))
        // const newVC = (await borrowerOperations.getVC([liquidatedCollTokens[0]], [troveColl.add(liquidatedCollAmounts[0]).sub(toBN(collChange))]))
        // const expectedTCR = newVC.mul(toBN(dec(1, 18))).div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })
    })

    // if (!withProxy) {
    //   it('closeTrove(): fails if owner cannot receive ETH', async () => {
    //     const nonPayable = await NonPayable.new()

    //     // we need 2 troves to be able to close 1 and have 1 remaining in the system
    //     await contracts.borrowerOperations.openTrove(th._100pct, dec(100000, 18), alice, alice, [contracts.weth.address], [dec(1000, 18)], {from: alice})
    //     // await borrowerOperations.openTrove(th._100pct, dec(100000, 18), alice, alice, { from: alice, value: dec(1000, 18) })

    //     // Alice sends YUSD to NonPayable so its YUSD balance covers its debt
    //     await yusdToken.transfer(nonPayable.address, dec(10000, 18), { from: alice })

    //     // open trove from NonPayable proxy contract
    //     const _100pctHex = '0xde0b6b3a7640000'
    //     const _1e25Hex = '0xd3c21bcecceda1000000'
    //     const openTroveData = th.getTransactionData('openTrove(uint256,uint256,address,address)', [_100pctHex, _1e25Hex, '0x0', '0x0'])
    //     await nonPayable.forward(borrowerOperations.address, openTroveData, { value: dec(10000, 'ether') })
    //     assert.equal((await troveManager.getTroveStatus(nonPayable.address)).toString(), '1', 'NonPayable proxy should have a trove')
    //     assert.isFalse(await th.checkRecoveryMode(contracts), 'System should not be in Recovery Mode')
    //     // open trove from NonPayable proxy contract
    //     const closeTroveData = th.getTransactionData('closeTrove()', [])
    //     await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeTroveData), 'ActivePool: sending ETH failed')
    //   })
    // }
  }

  describe('Without proxy', async () => {
    testCorpus({ withProxy: false })
  })

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => { })

/* TODO:

 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawYUSD, repayYUSD, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.

 2)In security phase:
 -'Negative' tests for all the above functions.
 */
