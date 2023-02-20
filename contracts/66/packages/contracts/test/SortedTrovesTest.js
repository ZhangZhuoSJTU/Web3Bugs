const { zeroAddress } = require("ethereumjs-util")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const SortedTroves = artifacts.require("SortedTroves")
const SortedTrovesTester = artifacts.require("SortedTrovesTester")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const SortedTrovesBOTester = artifacts.require("./SortedTrovesBOTester.sol")
const YUSDToken = artifacts.require("YUSDToken")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues

contract('SortedTroves', async accounts => {

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

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I, J, whale] = accounts;

  //let priceFeed
  let sortedTroves
  let troveManager
  let troveManagerLiquidations
  let borrowerOperations
  let yusdToken

  let stableCoin
  let priceFeedStableCoin
  let tokenRisky
  let priceFeedRisky

  let sortedTrovesTester


  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts

  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)

  describe('SortedTroves', () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      //contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.yusdToken = await YUSDToken.new(
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )

      const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations
      yusdToken = contracts.yusdToken
      await deploymentHelper.connectYETIContracts(YETIContracts)
      await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
      await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)
    })

    it('contains(): returns true for addresses that have opened troves', async () => {
      await openTrove({ ICR: toBN(dec(150, 18)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // // Confirm trove statuses became active
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '1')

      // // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isTrue(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))
    })

    it('contains(): returns false for addresses that have not opened troves', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm troves have non-existent status
      assert.equal((await troveManager.getTroveStatus(dennis)).toString(), '0')
      assert.equal((await troveManager.getTroveStatus(erin)).toString(), '0')

      // Check sorted list do not contain troves
      assert.isFalse(await sortedTroves.contains(dennis))
      assert.isFalse(await sortedTroves.contains(erin))
    })

    it('contains(): returns false for addresses that opened and then closed a trove', async () => {
      await openTrove({ ICR: toBN(dec(1000, 18)), extraYUSDAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await yusdToken.transfer(alice, dec(1000, 18), { from: whale })
      await yusdToken.transfer(bob, dec(1000, 18), { from: whale })
      await yusdToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close troves
      await borrowerOperations.closeTrove({ from: alice })
      await borrowerOperations.closeTrove({ from: bob })
      await borrowerOperations.closeTrove({ from: carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '2')

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))
    })

    // true for addresses that opened -> closed -> opened a trove
    it('contains(): returns true for addresses that opened, closed and then re-opened a trove', async () => {
      await openTrove({ ICR: toBN(dec(1000, 18)), extraYUSDAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await yusdToken.transfer(alice, dec(1000, 18), { from: whale })
      await yusdToken.transfer(bob, dec(1000, 18), { from: whale })
      await yusdToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close troves
      await borrowerOperations.closeTrove({ from: alice })
      await borrowerOperations.closeTrove({ from: bob })
      await borrowerOperations.closeTrove({ from: carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '2')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '2')

      await openTrove({ ICR: toBN(dec(1000, 16)), extraParams: { from: alice } })
      await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: bob } })
      await openTrove({ ICR: toBN(dec(3000, 18)), extraParams: { from: carol } })

      // Confirm trove statuses became open again
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), '1')
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), '1')

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(alice))
      assert.isTrue(await sortedTroves.contains(bob))
      assert.isTrue(await sortedTroves.contains(carol))
    })

    // false when list size is 0
    it('contains(): returns false when there are no troves in the system', async () => {
      assert.isFalse(await sortedTroves.contains(alice))
      assert.isFalse(await sortedTroves.contains(bob))
      assert.isFalse(await sortedTroves.contains(carol))
    })

    // true when list size is 1 and the trove the only one in system
    it('contains(): true when list size is 1 and the trove the only one in system', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isTrue(await sortedTroves.contains(alice))
    })

    // false when list size is 1 and trove is not in the system
    it('contains(): false when list size is 1 and trove is not in the system', async () => {
      await openTrove({ ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isFalse(await sortedTroves.contains(bob))
    })

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedTroves.getMaxSize()

      assert.equal(web3.utils.toHex(max), th.maxBytes32)
    })

    //--- Ordering --- 
    // infinte ICR (zero collateral) is not possible anymore, therefore, skipping
    it.skip("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {

      // make several troves with 0 debt and collateral, in random order
      await borrowerOperations.openTrove(th._100pct, 0, whale, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, A, A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, B, B, { from: B, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, C, C, { from: C, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, D, D, { from: D, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, E, E, { from: E, value: dec(19, 'ether') })

      // Make some troves with non-zero debt, in random order
      await borrowerOperations.openTrove(th._100pct, dec(5, 19), F, F, { from: F, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(3, 18), G, G, { from: G, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(2, 20), H, H, { from: H, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(17, 18), I, I, { from: I, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(5, 21), J, J, { from: J, value: dec(1345, 'ether') })

      const price_1 = await priceFeed.getPrice()

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)

      await borrowerOperations.openTrove(th._100pct, dec(100, 18), defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      assert.isTrue(await sortedTroves.contains(defaulter_1))

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price_2 = await priceFeed.getPrice()

      // Liquidate a trove
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)
    })
  })

  describe('SortedTroves with mock dependencies', () => {


    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.borrowerOperations = await SortedTrovesBOTester.new()
      //contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.yusdToken = await YUSDToken.new(
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )

      const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations
      yusdToken = contracts.yusdToken
      await deploymentHelper.connectYETIContracts(YETIContracts)
      await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
      await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

      sortedTrovesTester = await SortedTrovesTester.new()

      borrowerOperations.resetSortedTroves(sortedTrovesTester.address)
    })

    context('when params are wrongly set', () => {
      it('setParams(): reverts if size is zero', async () => {
        await th.assertRevert(sortedTrovesTester.setParams(0, troveManager.address, borrowerOperations.address, contracts.troveManagerRedemptions.address), 'SortedTroves: Size can’t be zero')
      })
    })

    context('when params are properly set', () => {
      beforeEach('set params', async () => {
        await sortedTrovesTester.setParams(2, troveManager.address, borrowerOperations.address, contracts.troveManagerRedemptions.address)
      })

      it('insert(): fails if list is full', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        await sortedTrovesTester.callInsert(bob, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.callInsert(carol, 1, alice, alice), 'SortedTroves: List is full')
      })

      it('insert(): fails if list already contains the node', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        await th.assertRevert(sortedTrovesTester.callInsert(alice, 1, alice, alice), 'SortedTroves: List already contains the node')
      })

      it('insert(): fails if id is zero', async () => {
        await th.assertRevert(sortedTrovesTester.callInsert(th.ZERO_ADDRESS, 1, alice, alice), 'SortedTroves: Id cannot be zero')
      })

      it('insert(): fails if NICR is zero', async () => {
        await th.assertRevert(sortedTrovesTester.callInsert(alice, 0, alice, alice), 'SortedTroves: NICR must be positive')
      })

      it('remove(): fails if id is not in the list', async () => {
        await th.assertRevert(sortedTrovesTester.callRemove(alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if list doesn’t contain the node', async () => {
        await th.assertRevert(sortedTrovesTester.callReInsert(alice, 1, alice, alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if new NICR is zero', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        assert.isTrue(await sortedTrovesTester.contains(alice), 'list should contain element')
        await th.assertRevert(sortedTrovesTester.callReInsert(alice, 0, alice, alice), 'SortedTroves: NICR must be positive')
        assert.isTrue(await sortedTrovesTester.contains(alice), 'list should contain element')
      })

      it('findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
        await sortedTrovesTester.callInsert(alice, 1, alice, alice)
        const pos = await sortedTrovesTester.findInsertPosition(1, th.ZERO_ADDRESS, alice)
        assert.equal(pos[0], alice, 'prevId result should be nextId param')
        assert.equal(pos[1], th.ZERO_ADDRESS, 'nextId result should be zero')
      })


    })
  })
  describe('Check position, re-insert multi-collateral multi-ratio, selective update, etc. ', () => {


    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.borrowerOperations = await SortedTrovesBOTester.new()
      //contracts.borrowerOperations = await BorrowerOperationsTester.new()
      // contracts.troveManager = await TroveManagerTester.new()
      contracts.yusdToken = await YUSDToken.new(
        contracts.troveManager.address,
        contracts.troveManagerLiquidations.address,
        contracts.troveManagerRedemptions.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      sortedTrovesTester = await SortedTrovesTester.new()
      // await sortedTrovesTester.setParams(10, troveManager.address, borrowerOperations.address, contracts.troveManagerRedemptions.address)
      contracts.sortedTroves = sortedTrovesTester
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations
      yusdToken = contracts.yusdToken
      await deploymentHelper.connectYETIContracts(YETIContracts)
      await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
      await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)



      // newSortedTroves = await SortedTroves.new()

      borrowerOperations.resetSortedTroves(sortedTrovesTester.address)

      // Deploy new trove manager

      const paramsRisky = {
        name: "Risky Token",
        symbol: "T.R",
        decimals: 18,
        ratio: dec(75, 16) // 75%
      }
      let result = await deploymentHelper.deployExtraCollateral(contracts, paramsRisky)
      tokenRisky = result.token
      priceFeedRisky = result.priceFeed


      const paramsStableCoin = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 18,
        ratio: dec(105, 16) // 105%
      }
      result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
      stableCoin = result.token
      priceFeedStableCoin = result.priceFeed


      await contracts.priceFeedETH.setPrice(dec(100, 18))
      await contracts.priceFeedAVAX.setPrice(dec(50, 18))
      await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
      await priceFeedRisky.setPrice(toBN(dec(200, 18)))
      await makeTrovesInSequence()
      // Whale 500%, A 300%, B 260%, C 250%, D 130%, E 125%
      // Whale has weth, wavax
      // A has weth, stable
      // B has weth, risky
      // C has stable, risky
      // D has wavax, risky
      // E has wavax, stable
    })

    it('findInsertPosition(): After price changes, list remains sorted as original. Update single trove updates just that ICR.', async () => {
      // Whale 500%, A 300%, B 260%, C 250%, D 130%, E 125%
      // Whale has weth, wavax
      // A has weth, stable
      // B has weth, risky
      // C has stable, risky
      // D has wavax, risky
      // E has wavax, stable

      // Expect a trove with ICR 280% to be inserted between A and B
      let targetICR = dec(280, 16)

      // Pass addresses that loosely bound the right postiion
      let hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      // Change prices. List should not update since we are using stale list.
      await contracts.priceFeedETH.setPrice(dec(50, 18))
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      await assertSortedListIsOrdered(contracts)

      // Change prices and update only one trove. Insert position should reflect new change.
      await contracts.priceFeedAVAX.setPrice(dec(150, 18))
      await priceFeedStableCoin.setPrice(toBN(dec(2, 18)))
      await priceFeedRisky.setPrice(toBN(dec(300, 18)))
      let DUpdatedICR = await troveManager.getCurrentICR(D)
      assert.isTrue(DUpdatedICR.eq(toBN(dec(360, 16))), 'ICR should be updated correctly')
      await sortedTrovesTester.callReInsert(D, DUpdatedICR, A, E)

      targetICR = dec(340, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], D)
      assert.equal(hints[1], A)

      await assertSortedListIsOrdered(contracts)

      // Re-insert all options.
      let whaleUpdatedICR = await troveManager.getCurrentICR(whale)
      let AUpdatedICR = await troveManager.getCurrentICR(A)
      let BUpdatedICR = await troveManager.getCurrentICR(B)
      let CUpdatedICR = await troveManager.getCurrentICR(C)
      let EUpdatedICR = await troveManager.getCurrentICR(E)
      await sortedTrovesTester.callReInsert(whale, whaleUpdatedICR, whale, E)
      await sortedTrovesTester.callReInsert(A, AUpdatedICR, whale, E)
      await sortedTrovesTester.callReInsert(B, BUpdatedICR, whale, E)
      await sortedTrovesTester.callReInsert(C, CUpdatedICR, whale, E)

      // Expect E to still be out of position
      targetICR = dec(130, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], E)

      await sortedTrovesTester.callReInsert(E, EUpdatedICR, whale, E)

      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], zeroAddress())

      await assertSortedListIsOrdered(contracts)
    })

    it('TroveManager updateTroves(), correctly inserts multiple troves. ', async () => {
      // Whale 500%, A 300%, B 260%, C 250%, D 130%, E 125%
      // Whale has weth, wavax
      // A has weth, stable
      // B has weth, risky
      // C has stable, risky
      // D has wavax, risky
      // E has wavax, stable

      // Expect a trove with ICR 280% to be inserted between A and B
      let targetICR = dec(280, 16)

      // Pass addresses that loosely bound the right postiion
      let hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      // Change prices. List should not update since we are using stale list.
      await contracts.priceFeedETH.setPrice(dec(50, 18))
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], A)
      assert.equal(hints[1], B)

      await assertSortedListIsOrdered(contracts)

      // Change prices and update only one trove. Insert position should reflect new change.
      await contracts.priceFeedAVAX.setPrice(dec(150, 18))
      await priceFeedStableCoin.setPrice(toBN(dec(2, 18)))
      await priceFeedRisky.setPrice(toBN(dec(300, 18)))
      let DUpdatedICR = await troveManager.getCurrentICR(D)
      assert.isTrue(DUpdatedICR.eq(toBN(dec(360, 16))), 'ICR should be updated correctly')
      await troveManager.updateTroves([D], [A], [E])
      // sortedTrovesTester.callReInsert(D, DUpdatedICR, A, E)

      targetICR = dec(340, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], D)
      assert.equal(hints[1], A)

      await assertSortedListIsOrdered(contracts)

      // Re-insert all options except E.
      await troveManager.updateTroves([whale, A, B, C], [whale, whale, whale, whale], [E, E, E, E])

      // Expect E to still be out of position
      targetICR = dec(130, 16)
      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], E)

      await troveManager.updateTroves([E], [whale], [E])
      // await sortedTrovesTester.callReInsert(E, EUpdatedICR, whale, E)

      hints = await sortedTrovesTester.findInsertPosition(targetICR, A, E)
      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], zeroAddress())

      await assertSortedListIsOrdered(contracts)

      // Also hints can be wrong.
      await troveManager.updateTroves([E], [E], [whale])

      await assertSortedListIsOrdered(contracts)
    })

  })


  // Sequentially add coll and withdraw YUSD, 1 account at a time
  const makeTrovesInSequence = async () => {
  // const makeTrovesInSequence = async () => {
    const allColls = [contracts.weth, contracts.wavax, stableCoin, tokenRisky]
    const allAmounts =
      [toBN(dec(2000, 18)),  // price = 100. Ratio = 1. Collateral amount = 200. Value = 200 * 1 * 100 = 200000
      toBN(dec(4000, 18)),   // price = 50. Ratio = 1. Collateral amount = 400. Value = 400 * 1 * 50 = 200000
      toBN(dec(200000, 18)).mul(toBN(dec(1, 18))).div(toBN(dec(105, 16))),   // price = 1. Ratio = 1.05. Collateral amount = 200000 / 1.05
      toBN(dec(200000, 18)).mul(toBN(dec(1, 36))).div(toBN(dec(75, 16))).div(toBN(dec(200, 18)))]   // price = 200. Ratio = 0.75. Collateral amount = 200000 / 200 / 0.75 = 100 / 0.75

    const whaleColls = [contracts.weth, contracts.wavax]
    const whaleAmounts = [allAmounts[0], allAmounts[1]]
    const AColls = [contracts.weth, stableCoin]
    const AAmounts = [allAmounts[0], allAmounts[2]]
    const BColls = [contracts.weth, tokenRisky]
    const BAmounts = [allAmounts[0], allAmounts[3]]
    const CColls = [stableCoin, tokenRisky]
    const CAmounts = [allAmounts[2], allAmounts[3]]
    const DColls = [contracts.wavax, tokenRisky]
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


})
