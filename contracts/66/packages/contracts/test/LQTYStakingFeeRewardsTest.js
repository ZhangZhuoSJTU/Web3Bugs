const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const SYETITester = artifacts.require('sYETIToken')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

/* NOTE: These tests do not test for specific ETH and YUSD gain values. They only test that the
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific ETH/YUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('SYETI revenue share tests', async accounts => {

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

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

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployYUSDTokenTester(contracts)
    const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    
    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    yusdToken = contracts.yusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    yetiToken = YETIContracts.yetiToken
    sYETI = YETIContracts.sYETI
  })

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A yeti bal: ${await yetiToken.balanceOf(A)}`)

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await assertRevert(sYETI.mint(0, {from: A}), "SYETI: Amount must be non-zero")
  })

  it("ETH fee per YETI staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A yeti bal: ${await yetiToken.balanceOf(A)}`)

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await sYETI.mint(dec(100, 18), {from: A})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await sYETI.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has increased by correct amount
    const F_ETH_After = await sYETI.F_ETH()

    // Expect fee per unit staked = fee/100, since there is 100 YUSD totalStaked
    const expected_F_ETH_After = emittedETHFee.div(toBN('100')) 

    assert.isTrue(expected_F_ETH_After.eq(F_ETH_After))
  })

  it("ETH fee per YETI staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await sYETI.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has not increased 
    const F_ETH_After = await sYETI.F_ETH()
    assert.equal(F_ETH_After, '0')
  })

  it("YUSD fee per YETI staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await sYETI.mint(dec(100, 18), {from: A})

    // Check YUSD fee per unit staked is zero
    const F_YUSD_Before = await sYETI.F_ETH()
    assert.equal(F_YUSD_Before, '0')

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawYUSD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(tx))
    assert.isTrue(emittedYUSDFee.gt(toBN('0')))
    
    // Check YUSD fee per unit staked has increased by correct amount
    const F_YUSD_After = await sYETI.F_YUSD()

    // Expect fee per unit staked = fee/100, since there is 100 YUSD totalStaked
    const expected_F_YUSD_After = emittedYUSDFee.div(toBN('100'))

    assert.isTrue(expected_F_YUSD_After.eq(F_YUSD_After))
  })

  it("YUSD fee per YETI staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // Check YUSD fee per unit staked is zero
    const F_YUSD_Before = await sYETI.F_ETH()
    assert.equal(F_YUSD_Before, '0')

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawYUSD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(tx))
    assert.isTrue(emittedYUSDFee.gt(toBN('0')))
    
    // Check YUSD fee per unit staked did not increase, is still zero
    const F_YUSD_After = await sYETI.F_YUSD()
    assert.equal(F_YUSD_After, '0')
  })

  it("YETI Staking: A single staker earns all ETH and YETI fees that occur", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await sYETI.mint(dec(100, 18), {from: A})

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await yusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await yusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawYUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee_1 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedYUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawYUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee_2 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedYUSDFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalYUSDGain = emittedYUSDFee_1.add(emittedYUSDFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_YUSDBalance_Before = toBN(await yusdToken.balanceOf(A))

    // A un-stakes
    await sYETI.unstake(dec(100, 18), {from: A, gasPrice: 0})

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_YUSDBalance_After = toBN(await yusdToken.balanceOf(A))


    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before)
    const A_YUSDGain = A_YUSDBalance_After.sub(A_YUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalYUSDGain, A_YUSDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated ETH and YUSD gains to the staker", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await sYETI.mint(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await yusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await yusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawYUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee_1 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedYUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawYUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee_2 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedYUSDFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalYUSDGain = emittedYUSDFee_1.add(emittedYUSDFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_YUSDBalance_Before = toBN(await yusdToken.balanceOf(A))

    // A tops up
    await sYETI.mint(dec(50, 18), {from: A, gasPrice: 0})

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_YUSDBalance_After = toBN(await yusdToken.balanceOf(A))

    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before)
    const A_YUSDGain = A_YUSDBalance_After.sub(A_YUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalYUSDGain, A_YUSDGain), 1000)
  })

  it("getPendingETHGain(): Returns the staker's correct pending ETH gain", async () => { 
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await sYETI.mint(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await yusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await yusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)

    const A_ETHGain = await sYETI.getPendingETHGain(A)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
  })

  it("getPendingYUSDGain(): Returns the staker's correct pending YUSD gain", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await sYETI.mint(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await yusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await yusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await yusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await yusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawYUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee_1 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedYUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawYUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check YUSD fee value in event is non-zero
    const emittedYUSDFee_2 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedYUSDFee_2.gt(toBN('0')))

    const expectedTotalYUSDGain = emittedYUSDFee_1.add(emittedYUSDFee_2)
    const A_YUSDGain = await sYETI.getPendingYUSDGain(A)

    assert.isAtMost(th.getDifference(expectedTotalYUSDGain, A_YUSDGain), 1000)
  })

  // - multi depositors, several rewards
  it("YETI Staking: Multiple stakers earn the correct share of all ETH and YETI fees, based on their stake size", async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer YETI
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A, B, C
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})
    await yetiToken.transfer(B, dec(200, 18), {from: multisig})
    await yetiToken.transfer(C, dec(300, 18), {from: multisig})

    // A, B, C make stake
    await yetiToken.approve(sYETI.address, dec(100, 18), {from: A})
    await yetiToken.approve(sYETI.address, dec(200, 18), {from: B})
    await yetiToken.approve(sYETI.address, dec(300, 18), {from: C})
    await sYETI.mint(dec(100, 18), {from: A})
    await sYETI.mint(dec(200, 18), {from: B})
    await sYETI.mint(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 YETI
    // console.log(`yeti staking YETI bal: ${await yetiToken.balanceOf(sYETI.address)}`)
    assert.equal(await yetiToken.balanceOf(sYETI.address), dec(600, 18))
    assert.equal(await sYETI.totalYETIStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18))
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18))
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawYUSD(th._100pct, dec(104, 18), F, F, {from: F})
    const emittedYUSDFee_1 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedYUSDFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawYUSD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedYUSDFee_2 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedYUSDFee_2.gt(toBN('0')))

    // D obtains YETI from owner and makes a stake
    await yetiToken.transfer(D, dec(50, 18), {from: multisig})
    await yetiToken.approve(sYETI.address, dec(50, 18), {from: D})
    await sYETI.mint(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 YETI
    assert.equal(await yetiToken.balanceOf(sYETI.address), dec(650, 18))
    assert.equal(await sYETI.totalYETIStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18))
     const emittedETHFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedETHFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawYUSD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedYUSDFee_3 = toBN(th.getYUSDFeeFromYUSDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedYUSDFee_3.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_ETH: (100* ETHFee_1)/600 + (100* ETHFee_2)/600 + (100*ETH_Fee_3)/650
    B_ETH: (200* ETHFee_1)/600 + (200* ETHFee_2)/600 + (200*ETH_Fee_3)/650
    C_ETH: (300* ETHFee_1)/600 + (300* ETHFee_2)/600 + (300*ETH_Fee_3)/650
    D_ETH:                                             (100*ETH_Fee_3)/650

    A_YUSD: (100*YUSDFee_1 )/600 + (100* YUSDFee_2)/600 + (100*YUSDFee_3)/650
    B_YUSD: (200* YUSDFee_1)/600 + (200* YUSDFee_2)/600 + (200*YUSDFee_3)/650
    C_YUSD: (300* YUSDFee_1)/600 + (300* YUSDFee_2)/600 + (300*YUSDFee_3)/650
    D_YUSD:                                               (100*YUSDFee_3)/650
    */

    // Expected ETH gains
    const expectedETHGain_A = toBN('100').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_B = toBN('200').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_C = toBN('300').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_D = toBN('50').mul(emittedETHFee_3).div( toBN('650'))

    // Expected YUSD gains:
    const expectedYUSDGain_A = toBN('100').mul(emittedYUSDFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedYUSDFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedYUSDFee_3).div( toBN('650')))

    const expectedYUSDGain_B = toBN('200').mul(emittedYUSDFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedYUSDFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedYUSDFee_3).div( toBN('650')))

    const expectedYUSDGain_C = toBN('300').mul(emittedYUSDFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedYUSDFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedYUSDFee_3).div( toBN('650')))
    
    const expectedYUSDGain_D = toBN('50').mul(emittedYUSDFee_3).div( toBN('650'))


    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_YUSDBalance_Before = toBN(await yusdToken.balanceOf(A))
    const B_ETHBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_YUSDBalance_Before = toBN(await yusdToken.balanceOf(B))
    const C_ETHBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_YUSDBalance_Before = toBN(await yusdToken.balanceOf(C))
    const D_ETHBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_YUSDBalance_Before = toBN(await yusdToken.balanceOf(D))

    // A-D un-stake
    const unstake_A = await sYETI.unstake(dec(100, 18), {from: A, gasPrice: 0})
    const unstake_B = await sYETI.unstake(dec(200, 18), {from: B, gasPrice: 0})
    const unstake_C = await sYETI.unstake(dec(400, 18), {from: C, gasPrice: 0})
    const unstake_D = await sYETI.unstake(dec(50, 18), {from: D, gasPrice: 0})

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await yetiToken.balanceOf(sYETI.address)), '0')
    assert.equal((await sYETI.totalYETIStaked()), '0')

    // Get A-D ETH and YUSD balances
    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_YUSDBalance_After = toBN(await yusdToken.balanceOf(A))
    const B_ETHBalance_After = toBN(await web3.eth.getBalance(B))
    const B_YUSDBalance_After = toBN(await yusdToken.balanceOf(B))
    const C_ETHBalance_After = toBN(await web3.eth.getBalance(C))
    const C_YUSDBalance_After = toBN(await yusdToken.balanceOf(C))
    const D_ETHBalance_After = toBN(await web3.eth.getBalance(D))
    const D_YUSDBalance_After = toBN(await yusdToken.balanceOf(D))

    // Get ETH and YUSD gains
    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before)
    const A_YUSDGain = A_YUSDBalance_After.sub(A_YUSDBalance_Before)
    const B_ETHGain = B_ETHBalance_After.sub(B_ETHBalance_Before)
    const B_YUSDGain = B_YUSDBalance_After.sub(B_YUSDBalance_Before)
    const C_ETHGain = C_ETHBalance_After.sub(C_ETHBalance_Before)
    const C_YUSDGain = C_YUSDBalance_After.sub(C_YUSDBalance_Before)
    const D_ETHGain = D_ETHBalance_After.sub(D_ETHBalance_Before)
    const D_YUSDGain = D_YUSDBalance_After.sub(D_YUSDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedETHGain_A, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedYUSDGain_A, A_YUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_B, B_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedYUSDGain_B, B_YUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_C, C_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedYUSDGain_C, C_YUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_D, D_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedYUSDGain_D, D_YUSDGain), 1000)
  })
 
  it("unstake(): reverts if caller has ETH gains and can't receive ETH",  async () => {
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
    await openTrove({ extraYUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraYUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraYUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraYUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers YETI to staker A and the non-payable proxy
    await yetiToken.transfer(A, dec(100, 18), {from: multisig})
    await yetiToken.transfer(nonPayable.address, dec(100, 18), {from: multisig})

    //  A makes stake
    const A_stakeTx = await sYETI.mint(dec(100, 18), {from: A})
    assert.isTrue(A_stakeTx.receipt.status)

    //  A tells proxy to make a stake
    const proxystakeTxData = await th.getTransactionData('stake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 YETI
    await nonPayable.forward(sYETI.address, proxystakeTxData, {from: A})


    // B makes a redemption, creating ETH gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(45, 18))
    
    const proxy_ETHGain = await sYETI.getPendingETHGain(nonPayable.address)
    assert.isTrue(proxy_ETHGain.gt(toBN('0')))

    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated ETH gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData('unstake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 YETI
    const proxyUnstakeTxPromise = nonPayable.forward(sYETI.address, proxyUnStakeTxData, {from: A})
   
    // but nonPayable proxy can not accept ETH - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise)
  })

  it("receive(): reverts when it receives ETH from an address that is not the Active Pool",  async () => { 
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: sYETI.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: sYETI.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = sYETI.unstake(1, {from: A})
    const unstakeTxPromise2 = sYETI.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

})
