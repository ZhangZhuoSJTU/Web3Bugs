const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("TroveManagerTester")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the Liquity admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: Liquity functions with the caller restricted to Liquity contract(s)', async accounts => {

  const [owner, alice, bob, carol] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts

  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let whitelist

  let sYETI
  let yetiToken
  let communityIssuance
  let lockupContractFactory

  let weth
  let priceFeedETH
  let wavax
  let priceFeedAVAX


  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployYUSDToken(contracts)

    const YETIContracts = await deploymentHelper.deployYETIContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeedETH = contracts.priceFeedETH
    priceFeedAVAX = contracts.priceFeedAVAX
    yusdToken = contracts.yusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    nameRegistry = contracts.nameRegistry
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    functionCaller = contracts.functionCaller
    borrowerOperations = contracts.borrowerOperations
    whitelist = contracts.whitelist
    weth = contracts.weth
    wavax = contracts.wavax

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

    // const amountToMint = toBN(dec(1000, 18));

    // // const colls = [contracts.weth.address, contracts.wavax.address];
    // // const amounts = [amountToMint, amountToMint]
    // // const priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX]
    // const collList = await contracts.whitelist.getValidCollateral()
    // const wethRatio = await contracts.whitelist.getRatio(contracts.weth.address)

    for (account of accounts.slice(0, 10)) {
      await th.openTrove(contracts, { extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
    }


    const expectedCISupplyCap = '32000000000000000000000000' // 32mil

    // Check CI has been properly funded
    // const bal = await yetiToken.balanceOf(communityIssuance.address)
    // assert.equal(bal, expectedCISupplyCap)
  })


  describe('TroveManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.applyPendingRewards(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    it("batchLiquidateTroves(): reverts when called by an account that is not TroveManger", async () => {
      // Attempt call from alice
      const collList = await contracts.whitelist.getValidCollateral()

      await priceFeedETH.setPrice(dec(70, 18))

      await contracts.troveManager.liquidate(alice)

      assertRevert(contracts.troveManagerLiquidations.batchLiquidateTroves([bob], alice))
    })


    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveRewardSnapshots(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.removeStake(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateStakeAndTotalStakes(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeTrove
    it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.closeTrove(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addTroveOwnerToArray
    it("addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.addTroveOwnerToArray(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setTroveStatus
    it("setTroveStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.setTroveStatus(bob, 1, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // @KingYeti: removed this function
    // increaseTroveColl
    // it("increaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
    //   // Attempt call from alice
    //   try {
    //     const txAlice = await troveManager.increaseTroveColl(bob, 100, { from: alice })
    //
    //   } catch (err) {
    //      assert.include(err.message, "revert")
    //     // assert.include(err.message, "Caller is not the BorrowerOperations contract")
    //   }
    // })

    // @KingYeti: removed this function
    // decreaseTroveColl
    // it("decreaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
    //   // Attempt call from alice
    //   try {
    //     const txAlice = await troveManager.decreaseTroveColl(bob, 100, { from: alice })
    //
    //   } catch (err) {
    //      assert.include(err.message, "revert")
    //     // assert.include(err.message, "Caller is not the BorrowerOperations contract")
    //   }
    // })

    // increaseTroveDebt
    it("increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveDebt(bob, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveDebt
    it("decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveDebt(bob, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendETH
    it("sendETH(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendCollaterals(alice, [contracts.weth.address], ["1"], { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // increaseYUSD
    it("increaseYUSDDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseYUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager")
      }
    })

    // decreaseYUSD
    it("decreaseYUSDDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseYUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // fallback (payment)	@KingYeti function has been removed
    // it("fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool", async () => {
    //   // Attempt call from alice
    //   try {
    //     const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })

    //   } catch (err) {
    //     assert.include(err.message, "revert")
    //     assert.include(err.message, "ActivePool: Caller is neither BO nor Default Pool")
    //   }
    // })
  })

  describe('DefaultPool', async accounts => {
    // sendCollateralToActivePool
    it("sendCollsToActivePool(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendCollsToActivePool([contracts.weth.address], [100], alice, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // increaseYUSD
    it("increaseYUSDDebt(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseYUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // decreaseYUSD
    it("decreaseYUSD(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseYUSDDebt(100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // fallback (payment)	@KingYeti Function has been removed. 
    // it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
    //   // Attempt call from alice
    //   try {
    //     const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })

    //   } catch (err) {
    //     assert.include(err.message, "revert")
    //     assert.include(err.message, "DefaultPool: Caller is not the ActivePool")
    //   }
    // })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyTroveManager --- 

    // offset
    it("offset(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, [contracts.weth.address], [100], { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not TML")
      }
    })

    // --- onlyActivePool ---

    // fallback (payment)	@KingYeti Function has been removed. 
    // it("fallback(): reverts when called by an account that is not the Active Pool", async () => {
    //   // Attempt call from alice
    //   try {
    //     const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })

    //   } catch (err) {
    //     assert.include(err.message, "revert")
    //     assert.include(err.message, "StabilityPool: Caller is not ActivePool")
    //   }
    // })
  })

  describe('YUSDToken', async accounts => {

    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = yusdToken.mint(bob, 100, { from: alice })
      await th.assertRevert(txAlice, "Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await yusdToken.burn(bob, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await yusdToken.sendToPool(bob, activePool.address, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await yusdToken.returnFromPool(activePool.address, bob, 100, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither TroveManager nor StabilityPool")
      }
    })
  })

  describe('SortedTroves', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.insert(bob, '150000000000000000000', bob, bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is neither BO nor TroveM")
      }
    })

    // --- onlyTroveManager ---
    // remove
    it("remove(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.remove(bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, " Caller is not the TroveManager")
      }
    })

    // --- onlyTroveMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.reInsert(bob, '150000000000000000000', bob, bob, { from: alice })

      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BO nor TroveM")
      }
    })
  })

  describe('SYETI', async accounts => {
    it("setAddresses(): reverts when caller is not Owner", async () => {
      try {
        const txAlice = await sYETI.setAddresses(alice, alice, { from: alice })
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('YETIToken', async accounts => {
    it("sendToSYETI(): reverts when caller is not the YETISstaking", async () => {

      // multisig tries to call it
      try {
        const tx = await yetiToken.sendToSYETI(multisig, 1, { from: multisig })
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // FF >> time one year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Bob tries to call it
      try {
        const tx = await yetiToken.sendToSYETI(bob, dec(1, 18), { from: bob })
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("sendYETI(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.sendYETI(alice, dec(100, 18), { from: alice })
      const tx2 = communityIssuance.sendYETI(bob, dec(100, 18), { from: alice })
      const tx3 = communityIssuance.sendYETI(stabilityPool.address, dec(100, 18), { from: alice })

      assertRevert(tx1)
      assertRevert(tx2)
      assertRevert(tx3)
    })

    it("issueYETI(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.issueYETI({ from: alice })

      assertRevert(tx1)
    })
  })
  describe('Whitelist', async accounts => {
    it("deprecateCollateral(): reverts when caller is not the Owner", async () => {
       assertRevert(whitelist.deprecateCollateral(weth.address, {from: alice}))
    })
    it("deprecateCollateral(): reverts when caller is not the Owner", async () => {
      await whitelist.deprecateCollateral(weth.address)
      assertRevert(whitelist.undeprecateCollateral(weth.address, {from: alice}))
    })
    it("changeOracle(): reverts when caller is not the Owner", async () => {
      assertRevert(whitelist.changeOracle(weth.address, priceFeedAVAX.address, {from: alice}))
    })
    it("changePriceCurve(): reverts when caller is not the Owner", async () => {
      assertRevert(whitelist.changePriceCurve(weth.address, contracts.PriceCurveAVAX.address, {from: alice}))
    })
    it("changePriceCurve(): reverts when caller is not the Owner", async () => {
      assertRevert(whitelist.changeRatio(weth.address, toBN(dec(1, 18)), {from: alice}))
    })

  })

})


