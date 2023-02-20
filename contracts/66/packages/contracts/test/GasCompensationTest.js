const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const YUSDToken = artifacts.require("YUSDToken")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Gas compensation tests', async accounts => {
  const [
    owner, liquidator,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts
  let troveManagerTester
  let borrowerOperationsTester
  let weth
  let wethIDX
  let whitelist

  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)

  const logICRs = (ICRList) => {
    for (let i = 0; i < ICRList.length; i++) {
      console.log(`account: ${i + 1} ICR: ${ICRList[i].toString()}`)
    }
  }

  before(async () => {
    troveManagerTester = await TroveManagerTester.new()
    borrowerOperationsTester = await BorrowerOperationsTester.new()

    TroveManagerTester.setAsDeployed(troveManagerTester)
    BorrowerOperationsTester.setAsDeployed(borrowerOperationsTester)
  })

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.yusdToken = await YUSDToken.new(
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
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    weth = contracts.weth
    whitelist = contracts.whitelist

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

    wethIDX = await contracts.whitelist.getIndex(weth.address);
  })

  // --- Raw gas compensation calculations ---

  xit('_getCollGasCompensation(): returns the 0.5% of collaterall if it is < $10 in value', async () => {
    /* 
    ETH:USD price = 1
    coll = 1 ETH: $1 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice(dec(1, 18))
    // const price_1 = await priceFeed.getPrice()
    await troveManagerTester.getCollGasCompensation(weth.address, dec(1, 'ether'));
    const gasCompensation_1 = (await troveManagerTester.getCollGasCompensation(weth.address, dec(1, 'ether')))
    assert.equal(gasCompensation_1, dec(5, 15))

    /*
    ETH:USD price = 28.4
    coll = 0.1 ETH: $2.84 in value
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice('28400000000000000000')
    // const price_2 = await priceFeed.getPrice()
    const gasCompensation_2 = (await troveManagerTester.getCollGasCompensation(weth.address, dec(100, 'finney')))
    assert.equal(gasCompensation_2, dec(5, 14))

    /* 
    ETH:USD price = 1000000000 (1 billion)
    coll = 0.000000005 ETH (5e9 wei): $5 in value 
    -> Expect 0.5% of collaterall as gas compensation */
    await priceFeed.setPrice(dec(1, 27))
    // const price_3 = await priceFeed.getPrice()
    const gasCompensation_3 = (await troveManagerTester.getCollGasCompensation(weth.address, '5000000000')).toString()
    assert.equal(gasCompensation_3, '25000000')
  })

  it('_getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral < $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 9.999 ETH  
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_1 = (await troveManagerTester.getCollGasCompensation(weth.address, '9999000000000000000'))
    assert.equal(gasCompensation_1, '49995000000000000')

    /* ETH:USD price = 200
     coll = 0.055 ETH  
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_2 = (await troveManagerTester.getCollGasCompensation(weth.address, '55000000000000000'))
    assert.equal(gasCompensation_2, dec(275, 12))

    /* ETH:USD price = 200
    coll = 6.09232408808723580 ETH  
    0.5% of coll = 0.004995 ETH. USD value: $6.09
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation_3 = (await troveManagerTester.getCollGasCompensation(weth.address, '6092324088087235800'))
    assert.equal(gasCompensation_3, '30461620440436179')
  })

  it('getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 10 ETH  
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect 0.5% of collaterall as gas compensation */
    const gasCompensation = (await troveManagerTester.getCollGasCompensation(weth.address, dec(10, 'ether')))
    assert.equal(gasCompensation, '50000000000000000')
  })

  it('getCollGasCompensation(): returns 0.5% of collaterall when 0.5% of collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200 $/E
    coll = 100 ETH  
    0.5% of coll = 0.5 ETH. USD value: $100
    -> Expect $100 gas compensation, i.e. 0.5 ETH */
    const gasCompensation_1 = (await troveManagerTester.getCollGasCompensation(weth.address, dec(100, 'ether')))
    assert.equal(gasCompensation_1, dec(500, 'finney'))

    /* 
    ETH:USD price = 200 $/E
    coll = 10.001 ETH  
    0.5% of coll = 0.050005 ETH. USD value: $10.001
    -> Expect $100 gas compensation, i.e.  0.050005  ETH */
    const gasCompensation_2 = (await troveManagerTester.getCollGasCompensation(weth.address, '10001000000000000000'))
    assert.equal(gasCompensation_2, '50005000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 37.5 ETH  
    0.5% of coll = 0.1875 ETH. USD value: $37.5
    -> Expect $37.5 gas compensation i.e.  0.1875  ETH */
    const gasCompensation_3 = (await troveManagerTester.getCollGasCompensation(weth.address, '37500000000000000000'))
    assert.equal(gasCompensation_3, '187500000000000000')

    /* 
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH  
    0.5% of coll = 473.7911529 ETH. USD value: $21473894.84
    -> Expect $21473894.8385808 gas compensation, i.e.  473.7911529115490  ETH */
    await priceFeed.setPrice('45323545420000000000000')
    const gasCompensation_4 = await troveManagerTester.getCollGasCompensation(weth.address, '94758230582309850000000')
    assert.isAtMost(th.getDifference(gasCompensation_4, '473791152911549000000'), 1000000)

    /* 
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    0.5% of coll = 1500000 ETH. USD value: $150000000000
    -> Expect $150000000000 gas compensation, i.e. 1500000 ETH */
    await priceFeed.setPrice(dec(1, 24))
    const price_2 = await priceFeed.getPrice()
    const gasCompensation_5 = (await troveManagerTester.getCollGasCompensation(weth.address, '300000000000000000000000000'))
    assert.equal(gasCompensation_5, '1500000000000000000000000')
  })

  // --- Composite debt calculations ---

  // gets debt + 50 when 0.5% of coll < $10
  it('_getCompositeDebt(): returns (debt + 50) when collateral < $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 9.999 ETH 
    debt = 10 YUSD
    0.5% of coll = 0.04995 ETH. USD value: $9.99
    -> Expect composite debt = 10 + 200  = 2100 YUSD*/
    const compositeDebt_1 = await troveManagerTester.getCompositeDebt(dec(10, 18))
    assert.equal(compositeDebt_1, dec(210, 18))

    /* ETH:USD price = 200
     coll = 0.055 ETH  
     debt = 0 YUSD
     0.5% of coll = 0.000275 ETH. USD value: $0.055
     -> Expect composite debt = 0 + 200 = 200 YUSD*/
    const compositeDebt_2 = await troveManagerTester.getCompositeDebt(0)
    assert.equal(compositeDebt_2, dec(200, 18))

    // /* ETH:USD price = 200
    // coll = 6.09232408808723580 ETH 
    // debt = 200 YUSD
    // 0.5% of coll = 0.004995 ETH. USD value: $6.09
    // -> Expect  composite debt =  200 + 200 = 400  YUSD */
    const compositeDebt_3 = await troveManagerTester.getCompositeDebt(dec(200, 18))
    assert.equal(compositeDebt_3, '400000000000000000000')
  })

  // returns $10 worth of ETH when 0.5% of coll == $10
  it('getCompositeDebt(): returns (debt + 50) collateral = $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200
    coll = 10 ETH  
    debt = 123.45 YUSD
    0.5% of coll = 0.5 ETH. USD value: $10
    -> Expect composite debt = (123.45 + 200) = 323.45 YUSD  */
    const compositeDebt = await troveManagerTester.getCompositeDebt('123450000000000000000')
    assert.equal(compositeDebt, '323450000000000000000')
  })

  /// *** 

  // gets debt + 50 when 0.5% of coll > 10
  it('getCompositeDebt(): returns (debt + 50) when 0.5% of collateral > $10 in value', async () => {
    const price = await priceFeed.getPrice()
    assert.equal(price, dec(200, 18))

    /* 
    ETH:USD price = 200 $/E
    coll = 100 ETH  
    debt = 2000 YUSD
    -> Expect composite debt = (2000 + 200) = 2200 YUSD  */
    const compositeDebt_1 = (await troveManagerTester.getCompositeDebt(dec(2000, 18))).toString()
    assert.equal(compositeDebt_1, '2200000000000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 10.001 ETH  
    debt = 200 YUSD
    -> Expect composite debt = (200 + 200) = 400 YUSD  */
    const compositeDebt_2 = (await troveManagerTester.getCompositeDebt(dec(200, 18))).toString()
    assert.equal(compositeDebt_2, '400000000000000000000')

    /* 
    ETH:USD price = 200 $/E
    coll = 37.5 ETH  
    debt = 500 YUSD
    -> Expect composite debt = (500 + 200) = 700 YUSD  */
    const compositeDebt_3 = (await troveManagerTester.getCompositeDebt(dec(500, 18))).toString()
    assert.equal(compositeDebt_3, '700000000000000000000')

    /* 
    ETH:USD price = 45323.54542 $/E
    coll = 94758.230582309850 ETH  
    debt = 1 billion YUSD
    -> Expect composite debt = (1000000000 + 200) = 1000000200 YUSD  */
    await priceFeed.setPrice('45323545420000000000000')
    const price_2 = await priceFeed.getPrice()
    const compositeDebt_4 = (await troveManagerTester.getCompositeDebt(dec(1, 27))).toString()
    assert.isAtMost(th.getDifference(compositeDebt_4, '1000000200000000000000000000'), 100000000000)

    /* 
    ETH:USD price = 1000000 $/E (1 million)
    coll = 300000000 ETH   (300 million)
    debt = 54321.123456789 YUSD
   -> Expect composite debt = (54321.123456789 + 200) = 54521.123456789 YUSD */
    await priceFeed.setPrice(dec(1, 24))
    const price_3 = await priceFeed.getPrice()
    const compositeDebt_5 = (await troveManagerTester.getCompositeDebt('54321123456789000000000')).toString()
    assert.equal(compositeDebt_5, '54521123456789000000000')
  })

  // --- Test ICRs with virtual debt ---
  it('getCurrentICR(): Incorporates virtual debt, and returns the correct ICR for new troves', async () => {
    const price = await priceFeed.getPrice()
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } })

    // A opens with 1 ETH, 110 YUSD
    await openTrove({ ICR: toBN('1818181818181818181'), extraParams: { from: alice } })
    const alice_ICR = (await troveManager.getCurrentICR(alice)).toString()
    // Expect aliceICR = (1 * 200) / (110) = 181.81%
    assert.isAtMost(th.getDifference(alice_ICR, '1818181818181818181'), 1000)

    // B opens with 0.5 ETH, 50 YUSD
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
    const bob_ICR = (await troveManager.getCurrentICR(bob)).toString()
    // Expect Bob's ICR = (0.5 * 200) / 50 = 200%
    assert.isAtMost(th.getDifference(bob_ICR, dec(2, 18)), 1000)

    // F opens with 1 ETH, 100 YUSD
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(100, 18), extraParams: { from: flyn } })
    const flyn_ICR = (await troveManager.getCurrentICR(flyn)).toString()
    // Expect Flyn's ICR = (1 * 200) / 100 = 200%
    assert.isAtMost(th.getDifference(flyn_ICR, dec(2, 18)), 1000)

    // C opens with 2.5 ETH, 160 YUSD
    await openTrove({ ICR: toBN(dec(3125, 15)), extraParams: { from: carol } })
    const carol_ICR = (await troveManager.getCurrentICR(carol)).toString()
    // Expect Carol's ICR = (2.5 * 200) / (160) = 312.50%
    assert.isAtMost(th.getDifference(carol_ICR, '3125000000000000000'), 1000)

    // D opens with 1 ETH, 0 YUSD
    await openTrove({ ICR: toBN(dec(4, 18)), extraParams: { from: dennis } })
    const dennis_ICR = (await troveManager.getCurrentICR(dennis)).toString()
    // Expect Dennis's ICR = (1 * 200) / (50) = 400.00%
    assert.isAtMost(th.getDifference(dennis_ICR, dec(4, 18)), 1000)

    // E opens with 4405.45 ETH, 32598.35 YUSD
    await openTrove({ ICR: toBN('27028668628933700000'), extraParams: { from: erin } })
    const erin_ICR = (await troveManager.getCurrentICR(erin)).toString()
    // Expect Erin's ICR = (4405.45 * 200) / (32598.35) = 2702.87%
    assert.isAtMost(th.getDifference(erin_ICR, '27028668628933700000'), 100000)

    // H opens with 1 ETH, 180 YUSD
    await openTrove({ ICR: toBN('1111111111111111111'), extraParams: { from: harriet } })
    const harriet_ICR = (await troveManager.getCurrentICR(harriet)).toString()
    // Expect Harriet's ICR = (1 * 200) / (180) = 111.11%
    assert.isAtMost(th.getDifference(harriet_ICR, '1111111111111111111'), 1000)
  })

  // Test compensation amounts and liquidation amounts

  xit('Gas compensation from pool-offset liquidations. All collateral paid as compensation', async () => {
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-E open troves
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(100, 18), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(200, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(300, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: A_totalDebt, extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: B_totalDebt.add(C_totalDebt), extraParams: { from: erin } })

    // D, E each provide YUSD to SP
    await stabilityPool.provideToSP(A_totalDebt, ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(B_totalDebt.add(C_totalDebt), ZERO_ADDRESS, { from: erin })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()

    // --- Price drops to 9.99 ---
    await priceFeed.setPrice('9990000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 9.99
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const newshit = (await troveManager.getTroveColls(alice));
    console.log(newshit[1][0].toString());
    console.log(wethIDX.toString());
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]

    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_A = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by 0.5% of A's coll (1 ETH)
    const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl)

    // Check SP YUSD has decreased due to the liquidation
    const YUSDinSP_A = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_A.lte(YUSDinSP_0))

    // Check ETH in SP has received the liquidation
    const ETHinSP_A = await stabilityPool.getCollateral(weth.address)
    assert.equal(ETHinSP_A.toString(), aliceColl.sub(_0pt5percent_aliceColl)) // 1 ETH - 0.5%

    // --- Price drops to 3 ---
    await priceFeed.setPrice(dec(3, 18))
    const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 3
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]

    assert.isFalse(await th.checkRecoveryMode(contracts))
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_B = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by B's 0.5% of coll, 2 ETH
    const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    assert.equal(compensationReceived_B, _0pt5percent_bobColl) // 0.5% of 2 ETH

    // Check SP YUSD has decreased due to the liquidation of B
    const YUSDinSP_B = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_B.lt(YUSDinSP_A))

    // Check ETH in SP has received the liquidation
    const ETHinSP_B = await stabilityPool.getCollateral(weth.address)
    assert.equal(ETHinSP_B.toString(), aliceColl.sub(_0pt5percent_aliceColl).add(bobColl).sub(_0pt5percent_bobColl)) // (1 + 2 ETH) * 0.995


    // --- Price drops to 3 ---
    await priceFeed.setPrice('3141592653589793238')
    const price_3 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 3.141592653589793238
    Carol coll = 3 ETH. Value = (3 * 3.141592653589793238) = $6
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const carolColl = (await troveManager.getTroveColls(carol))[1][wethIDX]

    assert.isFalse(await th.checkRecoveryMode(contracts))
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_C = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(carol, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_C = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by C's 0.5% of coll, 3 ETH
    const compensationReceived_C = (liquidatorBalance_after_C.sub(liquidatorBalance_before_C)).toString()
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    assert.equal(compensationReceived_C, _0pt5percent_carolColl)

    // Check SP YUSD has decreased due to the liquidation of C
    const YUSDinSP_C = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_C.lt(YUSDinSP_B))

    // Check ETH in SP has not changed due to the lquidation of C
    const ETHinSP_C = await stabilityPool.getCollateral(weth.address)
    assert.equal(ETHinSP_C.toString(), aliceColl.sub(_0pt5percent_aliceColl).add(bobColl).sub(_0pt5percent_bobColl).add(carolColl).sub(_0pt5percent_carolColl)) // (1+2+3 ETH) * 0.995
  })

  it('gas compensation from pool-offset liquidations: 0.5% collateral < $10 in value. Compensates $10 worth of collateral, liquidates the remainder', async () => {
    await priceFeed.setPrice(dec(400, 18))
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-E open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(200, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraYUSDAmount: dec(5000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(60, 18)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })

    // D, E each provide 10000 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getCollateral(weth.address)

    // --- Price drops to 199.999 ---
    await priceFeed.setPrice('199999000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 199.999
    Alice coll = 1 ETH. Value: $199.999
    0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
    Minimum comp = $10 = 0.05000025000125001 ETH.
    -> Expect 0.05000025000125001 ETH sent to liquidator, 
    and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const aliceICR = await troveManager.getCurrentICR(alice)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_A = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl)

    // Check SP YUSD has decreased due to the liquidation of A
    const YUSDinSP_A = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_A.lt(YUSDinSP_0))

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl)
    const ETHinSP_A = await stabilityPool.getCollateral(weth.address)

    const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0)

    assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000)

    // --- Price drops to 15 ---
    await priceFeed.setPrice(dec(15, 18))
    const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 15
    Bob coll = 15 ETH. Value: $165
    0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
    Minimum comp = $10 =  0.66666...ETH.
    -> Expect 0.666666666666666666 ETH sent to liquidator, 
    and (15 - 0.666666666666666666) ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const bobICR = await troveManager.getCurrentICR(bob)
    assert.isTrue(bobICR.lte(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_B = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by $10 worth of coll
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
    assert.equal(compensationReceived_B, _0pt5percent_bobColl)

    // Check SP YUSD has decreased due to the liquidation of B
    const YUSDinSP_B = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_B.lt(YUSDinSP_A))

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_B = bobColl.sub(_0pt5percent_bobColl)
    const ETHinSP_B = await stabilityPool.getCollateral(weth.address)

    const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A)

    assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000)
  })

  it('gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Compensates 0.5% of  collateral, liquidates the remainder', async () => {
    // open troves
    await priceFeed.setPrice(dec(400, 18))
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } })

    // A-E open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(2000, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(1875, 15)), extraYUSDAmount: dec(8000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })

    // D, E each provide 10000 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getCollateral(weth.address)

    await priceFeed.setPrice(dec(200, 18))
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 200
    Alice coll = 10.001 ETH. Value: $2000.2
    0.5% of coll  = 0.050005 ETH. Value: (0.050005 * 200) = $10.01
    Minimum comp = $10 = 0.05 ETH.
    -> Expect  0.050005 ETH sent to liquidator, 
    and (10.001 - 0.050005) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const aliceICR = await troveManager.getCurrentICR(alice)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_A = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_A = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_A = (liquidatorBalance_after_A.sub(liquidatorBalance_before_A)).toString()
    assert.equal(compensationReceived_A, _0pt5percent_aliceColl)

    // Check SP YUSD has decreased due to the liquidation of A
    const YUSDinSP_A = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_A.lt(YUSDinSP_0))

    // Check ETH in SP has increased by the remainder of A's coll
    const collRemainder_A = aliceColl.sub(_0pt5percent_aliceColl)
    const ETHinSP_A = await stabilityPool.getCollateral(weth.address)

    const SPETHIncrease_A = ETHinSP_A.sub(ETHinSP_0)

    assert.isAtMost(th.getDifference(SPETHIncrease_A, collRemainder_A), 1000)


    /* 
   ETH:USD price = 200
   Bob coll = 37.5 ETH. Value: $7500
   0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
   Minimum comp = $10 = 0.05 ETH.
   -> Expect 0.1875 ETH sent to liquidator, 
   and (37.5 - 0.1875 ETH) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const bobICR = await troveManager.getCurrentICR(bob)
    assert.isTrue(bobICR.lt(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidatorBalance_before_B = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after_B = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check liquidator's balance increases by 0.5% of coll
    const compensationReceived_B = (liquidatorBalance_after_B.sub(liquidatorBalance_before_B)).toString()
    assert.equal(compensationReceived_B, _0pt5percent_bobColl)

    // Check SP YUSD has decreased due to the liquidation of B
    const YUSDinSP_B = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_B.lt(YUSDinSP_A))

    // Check ETH in SP has increased by the remainder of B's coll
    const collRemainder_B = bobColl.sub(_0pt5percent_bobColl)
    const ETHinSP_B = await stabilityPool.getCollateral(weth.address)

    const SPETHIncrease_B = ETHinSP_B.sub(ETHinSP_A)

    assert.isAtMost(th.getDifference(SPETHIncrease_B, collRemainder_B), 1000)

  })

  // --- Event emission in single liquidation ---

  it('Gas compensation from pool-offset liquidations. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-E open troves
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(100, 18), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(200, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(300, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: A_totalDebt, extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: B_totalDebt, extraParams: { from: erin } })

    // D, E each provide YUSD to SP
    await stabilityPool.provideToSP(A_totalDebt, ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(B_totalDebt, ZERO_ADDRESS, { from: erin })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()

    th.logBN('TCR', await troveManager.getTCR())
    // --- Price drops to 9.99 ---
    await priceFeed.setPrice('9990000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 9.99
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const aliceDebt = (await troveManager.getTroveDebt(alice))

    th.logBN('TCR', await troveManager.getTCR())
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })

    const expectedGasComp_A = aliceColl.mul(th.toBN(5)).div(th.toBN(1000))
    const expectedLiquidatedColl_A = aliceColl.sub(expectedGasComp_A)
    const expectedLiquidatedDebt_A = aliceDebt


    const [loggedDebt_A, loggedColl_A, loggedGasComp_A] = th.getEmittedLiquidationValues(liquidationTxA, wethIDX)


    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedDebt_A), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedColl_A), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasComp_A), 1000)

    // --- Price drops to 3 ---
    await priceFeed.setPrice(dec(3, 18))
    const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 3
    -> Expect 0.5% of collaterall to be sent to liquidator, as gas compensation */

    // Check collateral value in USD is < $10
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const bobDebt = (await troveManager.getTroveDebt(bob))

    assert.isFalse(await th.checkRecoveryMode(contracts))
    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxB = await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })

    const expectedGasComp_B = bobColl.mul(th.toBN(5)).div(th.toBN(1000))
    const expectedLiquidatedColl_B = bobColl.sub(expectedGasComp_B)
    const expectedLiquidatedDebt_B =  bobDebt

    const [loggedDebt_B, loggedColl_B, loggedGasComp_B, ] = th.getEmittedLiquidationValues(liquidationTxB, wethIDX)

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedDebt_B), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedColl_B), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasComp_B), 1000)
  })


  it('gas compensation from pool-offset liquidations. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await priceFeed.setPrice(dec(400, 18))
    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-E open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(200, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(120, 16)), extraYUSDAmount: dec(5000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(60, 18)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(80, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })

    // D, E each provide 10,000 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getCollateral(weth.address)

    // --- Price drops to 199.999 ---
    await priceFeed.setPrice('199999000000000000000')
    const price_1 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 199.999
    Alice coll = 1 ETH. Value: $199.999
    0.5% of coll  = 0.05 ETH. Value: (0.05 * 199.999) = $9.99995
    Minimum comp = $10 = 0.05000025000125001 ETH.
    -> Expect 0.05000025000125001 ETH sent to liquidator, 
    and (1 - 0.05000025000125001) = 0.94999974999875 ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]

    const aliceDebt = (await troveManager.getTroveDebt(alice))
    const aliceCollValueInUSD = (await whitelist.getValueUSD(weth.address, aliceColl))
    assert.isTrue(aliceCollValueInUSD.gt(th.toBN(dec(10, 18))))

    // Check value of 0.5% of collateral in USD is < $10
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))

    console.log("0.5% Coll", _0pt5percent_aliceColl.toString());

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const aliceICR = await troveManager.getCurrentICR(alice)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })

    const expectedGasComp_A = _0pt5percent_aliceColl
    const expectedLiquidatedColl_A = aliceColl.sub(expectedGasComp_A)
    const expectedLiquidatedDebt_A =  aliceDebt

    const [loggedDebt_A, loggedColl_A, loggedGasComp_A, ] = th.getEmittedLiquidationValues(liquidationTxA, wethIDX)

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedDebt_A), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedColl_A), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasComp_A), 1000)

      // --- Price drops to 15 ---
      await priceFeed.setPrice(dec(15, 18))
      const price_2 = await priceFeed.getPrice()

    /* 
    ETH:USD price = 15
    Bob coll = 15 ETH. Value: $165
    0.5% of coll  = 0.75 ETH. Value: (0.75 * 11) = $8.25
    Minimum comp = $10 =  0.66666...ETH.
    -> Expect 0.666666666666666666 ETH sent to liquidator, 
    and (15 - 0.666666666666666666) ETH remainder liquidated */

    // Check collateral value in USD is > $10
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const bobDebt = (await troveManager.getTroveDebt(bob))


    assert.isFalse(await th.checkRecoveryMode(contracts))

    const bobICR = await troveManager.getCurrentICR(bob)
    assert.isTrue(bobICR.lte(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives
    const liquidationTxB = await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })

    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const expectedGasComp_B = _0pt5percent_bobColl
    const expectedLiquidatedColl_B = bobColl.sub(expectedGasComp_B)
    const expectedLiquidatedDebt_B =  bobDebt

    const [loggedDebt_B, loggedColl_B, loggedGasComp_B, ] = th.getEmittedLiquidationValues(liquidationTxB, wethIDX)

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedDebt_B), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedColl_B), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasComp_B), 1000)
  })


  it('gas compensation from pool-offset liquidations: 0.5% collateral > $10 in value. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    // open troves
    await priceFeed.setPrice(dec(400, 18))
    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } })

    // A-E open troves
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(2000, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(1875, 15)), extraYUSDAmount: dec(8000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(2, 18)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(4, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })

    // D, E each provide 10000 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: dennis })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()
    const ETHinSP_0 = await stabilityPool.getCollateral(weth.address)

    await priceFeed.setPrice(dec(200, 18))
    const price_1 = await priceFeed.getPrice()

    // Check value of 0.5% of collateral in USD is > $10
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const aliceDebt = (await troveManager.getTroveDebt(alice))
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const aliceICR = await troveManager.getCurrentICR(alice)
    assert.isTrue(aliceICR.lt(mv._MCR))

    // Liquidate A (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxA = await troveManager.liquidate(alice, { from: liquidator, gasPrice: 0 })
    
    const expectedGasComp_A = _0pt5percent_aliceColl
    const expectedLiquidatedColl_A = aliceColl.sub(_0pt5percent_aliceColl)
    const expectedLiquidatedDebt_A =  aliceDebt

    const [loggedDebt_A, loggedColl_A, loggedGasComp_A, ] = th.getEmittedLiquidationValues(liquidationTxA, wethIDX)

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_A, loggedDebt_A), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_A, loggedColl_A), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_A, loggedGasComp_A), 1000)


    /* 
   ETH:USD price = 200
   Bob coll = 37.5 ETH. Value: $7500
   0.5% of coll  = 0.1875 ETH. Value: (0.1875 * 200) = $37.5
   Minimum comp = $10 = 0.05 ETH.
   -> Expect 0.1875 ETH sent to liquidator, 
   and (37.5 - 0.1875 ETH) ETH remainder liquidated */

    // Check value of 0.5% of collateral in USD is > $10
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const bobDebt = (await troveManager.getTroveDebt(bob))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))

    assert.isFalse(await th.checkRecoveryMode(contracts))

    const bobICR = await troveManager.getCurrentICR(bob)
    assert.isTrue(bobICR.lt(mv._MCR))

    // Liquidate B (use 0 gas price to easily check the amount the compensation amount the liquidator receives)
    const liquidationTxB = await troveManager.liquidate(bob, { from: liquidator, gasPrice: 0 })
    
    const expectedGasComp_B = _0pt5percent_bobColl
    const expectedLiquidatedColl_B = bobColl.sub(_0pt5percent_bobColl)
    const expectedLiquidatedDebt_B =  bobDebt

    const [loggedDebt_B, loggedColl_B, loggedGasComp_B, ] = th.getEmittedLiquidationValues(liquidationTxB, wethIDX)

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt_B, loggedDebt_B), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl_B, loggedColl_B), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp_B, loggedGasComp_B), 1000)
  })


  // liquidateTroves - full offset
  it('liquidateTroves(): full offset.  Compensates the correct amount, and liquidates the remainder', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-F open troves
    await openTrove({ ICR: toBN(dec(118, 16)), extraYUSDAmount: dec(2000, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(526, 16)), extraYUSDAmount: dec(8000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(488, 16)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(545, 16)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: flyn } })

    // D, E each provide 10000 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: flyn })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis)).lt(mv._MCR))

    // Check E, F have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(erin)).gt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(flyn)).gt(mv._MCR))


    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const carolColl = (await troveManager.getTroveColls(carol))[1][wethIDX]
    const dennisColl = (await troveManager.getTroveColls(dennis))[1][wethIDX]

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const collGasCompensation = await troveManagerTester.getCollGasCompensation(weth.address, price)
    assert.equal(collGasCompensation, dec(1, 18))

    /* Expect total gas compensation = 
    0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
      .add(_0pt5percent_bobColl)
      .add(_0pt5percent_carolColl)
      .add(_0pt5percent_dennisColl)

    /* Expect liquidated coll = 
    0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
      .add(bobColl.sub(_0pt5percent_bobColl))
      .add(carolColl.sub(_0pt5percent_carolColl))
      .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Liquidate troves A-D

    const liquidatorBalance_before = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.batchLiquidateTroves([alice, bob, carol, dennis], liquidator, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check YUSD in SP has decreased
    const YUSDinSP_1 = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_1.lt(YUSDinSP_0))

    // Check liquidator's balance has increased by the expected compensation amount
    const compensationReceived = (liquidatorBalance_after.sub(liquidatorBalance_before)).toString()
    assert.equal(expectedGasComp, compensationReceived)

    // Check ETH in stability pool now equals the expected liquidated collateral
    const ETHinSP = (await stabilityPool.getCollateral(weth.address)).toString()
    assert.equal(expectedLiquidatedColl, ETHinSP)
  })

  // liquidateTroves - full redistribution
  it('liquidateTroves(): full redistribution. Compensates the correct amount, and liquidates the remainder', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await openTrove({ ICR: toBN(dec(200, 18)), extraParams: { from: whale } })

    // A-D open troves
    await openTrove({ ICR: toBN(dec(118, 16)), extraYUSDAmount: dec(2000, 18), extraParams: { from: alice } })
    await openTrove({ ICR: toBN(dec(526, 16)), extraYUSDAmount: dec(8000, 18), extraParams: { from: bob } })
    await openTrove({ ICR: toBN(dec(488, 16)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    await openTrove({ ICR: toBN(dec(545, 16)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })

    const YUSDinDefaultPool_0 = await defaultPool.getYUSDDebt()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis)).lt(mv._MCR))

    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const carolColl = (await troveManager.getTroveColls(carol))[1][wethIDX]
    const dennisColl = (await troveManager.getTroveColls(dennis))[1][wethIDX]

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const collGasCompensation = await troveManagerTester.getCollGasCompensation(weth.address, price)
    assert.equal(collGasCompensation, dec(1 , 18))

    /* Expect total gas compensation = 
       0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
          .add(_0pt5percent_bobColl)
          .add(_0pt5percent_carolColl)
          .add(_0pt5percent_dennisColl)

    /* Expect liquidated coll = 
    0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
      .add(bobColl.sub(_0pt5percent_bobColl))
      .add(carolColl.sub(_0pt5percent_carolColl))
      .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Liquidate troves A-D
    const liquidatorBalance_before = web3.utils.toBN(await weth.balanceOf(liquidator))
    await troveManager.batchLiquidateTroves([alice, bob, carol, dennis], liquidator, { from: liquidator, gasPrice: 0 })
    const liquidatorBalance_after = web3.utils.toBN(await weth.balanceOf(liquidator))

    // Check YUSD in DefaultPool has decreased
    const YUSDinDefaultPool_1 = await defaultPool.getYUSDDebt()
    assert.isTrue(YUSDinDefaultPool_1.gt(YUSDinDefaultPool_0))

    // Check liquidator's balance has increased by the expected compensation amount
    const compensationReceived = (liquidatorBalance_after.sub(liquidatorBalance_before)).toString()

    assert.isAtMost(th.getDifference(expectedGasComp, compensationReceived), 1000)

    // Check ETH in defaultPool now equals the expected liquidated collateral
    const ETHinDefaultPool = (await defaultPool.getCollateral(weth.address)).toString()
    assert.isAtMost(th.getDifference(expectedLiquidatedColl, ETHinDefaultPool), 1000)
  })

  //  --- event emission in liquidation sequence ---
  it('liquidateTroves(): full offset. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-F open troves
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(118, 16)), extraYUSDAmount: dec(2000, 18), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(526, 16)), extraYUSDAmount: dec(8000, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(488, 16)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(545, 16)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: flyn } })

    // D, E each provide 10000 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: erin })
    await stabilityPool.provideToSP(dec(1, 23), ZERO_ADDRESS, { from: flyn })

    const YUSDinSP_0 = await stabilityPool.getTotalYUSDDeposits()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis)).lt(mv._MCR))

    // Check E, F have ICR > MCR
    assert.isTrue((await troveManager.getCurrentICR(erin)).gt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(flyn)).gt(mv._MCR))


    // --- Check value of of A's collateral is < $10, and value of B,C,D collateral are > $10  ---
    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const carolColl = (await troveManager.getTroveColls(carol))[1][wethIDX]
    const dennisColl = (await troveManager.getTroveColls(dennis))[1][wethIDX]

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    const collGasCompensation = await troveManagerTester.getCollGasCompensation(weth.address, price)
    assert.equal(collGasCompensation, dec(1, 18))

    /* Expect total gas compensation = 
    0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
      .add(_0pt5percent_bobColl)
      .add(_0pt5percent_carolColl)
      .add(_0pt5percent_dennisColl)

    /* Expect liquidated coll = 
       0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
          .add(bobColl.sub(_0pt5percent_bobColl))
          .add(carolColl.sub(_0pt5percent_carolColl))
          .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Expect liquidatedDebt = 51 + 190 + 1025 + 13510 = 14646 YUSD
    const expectedLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)

    // Liquidate troves A-D
    const liquidationTxData = await troveManager.batchLiquidateTroves([alice, bob, dennis, carol], liquidator, { from: liquidator, gasPrice: 0 })

    // Get data from the liquidation event logs
    const [loggedDebt, loggedColl, loggedGasComp, ] = th.getEmittedLiquidationValues(liquidationTxData, wethIDX)
    
    assert.isAtMost(th.getDifference(expectedLiquidatedDebt, loggedDebt), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl, loggedColl), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp, loggedGasComp), 1000)
  })

  it('liquidateTroves(): full redistribution. Liquidation event emits the correct gas compensation and total liquidated coll and debt', async () => {
    await priceFeed.setPrice(dec(1000, 18))

    await openTrove({ ICR: toBN(dec(2000, 18)), extraParams: { from: whale } })

    // A-F open troves
    const { totalDebt: A_totalDebt } = await openTrove({ ICR: toBN(dec(118, 16)), extraYUSDAmount: dec(2000, 18), extraParams: { from: alice } })
    const { totalDebt: B_totalDebt } = await openTrove({ ICR: toBN(dec(526, 16)), extraYUSDAmount: dec(8000, 18), extraParams: { from: bob } })
    const { totalDebt: C_totalDebt } = await openTrove({ ICR: toBN(dec(488, 16)), extraYUSDAmount: dec(600, 18), extraParams: { from: carol } })
    const { totalDebt: D_totalDebt } = await openTrove({ ICR: toBN(dec(545, 16)), extraYUSDAmount: dec(1, 23), extraParams: { from: dennis } })
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: erin } })
    await openTrove({ ICR: toBN(dec(10, 18)), extraYUSDAmount: dec(1, 23), extraParams: { from: flyn } })

    const YUSDinDefaultPool_0 = await defaultPool.getYUSDDebt()

    // price drops to 200 
    await priceFeed.setPrice(dec(200, 18))
    const price = await priceFeed.getPrice()

    // Check not in Recovery Mode 
    assert.isFalse(await th.checkRecoveryMode(contracts))

    // Check A, B, C, D have ICR < MCR
    assert.isTrue((await troveManager.getCurrentICR(alice)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(bob)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(carol)).lt(mv._MCR))
    assert.isTrue((await troveManager.getCurrentICR(dennis)).lt(mv._MCR))

    const aliceColl = (await troveManager.getTroveColls(alice))[1][wethIDX]
    const bobColl = (await troveManager.getTroveColls(bob))[1][wethIDX]
    const carolColl = (await troveManager.getTroveColls(carol))[1][wethIDX]
    const dennisColl = (await troveManager.getTroveColls(dennis))[1][wethIDX]

    // --- Check value of 0.5% of A, B, and C's collateral is <$10, and value of 0.5% of D's collateral is > $10 ---
    const _0pt5percent_aliceColl = aliceColl.div(web3.utils.toBN('200'))
    const _0pt5percent_bobColl = bobColl.div(web3.utils.toBN('200'))
    const _0pt5percent_carolColl = carolColl.div(web3.utils.toBN('200'))
    const _0pt5percent_dennisColl = dennisColl.div(web3.utils.toBN('200'))

    /* Expect total gas compensation = 
    0.5% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedGasComp = _0pt5percent_aliceColl
      .add(_0pt5percent_bobColl)
      .add(_0pt5percent_carolColl)
      .add(_0pt5percent_dennisColl).toString()

    /* Expect liquidated coll = 
    0.95% of [A_coll + B_coll + C_coll + D_coll]
    */
    const expectedLiquidatedColl = aliceColl.sub(_0pt5percent_aliceColl)
      .add(bobColl.sub(_0pt5percent_bobColl))
      .add(carolColl.sub(_0pt5percent_carolColl))
      .add(dennisColl.sub(_0pt5percent_dennisColl))

    // Expect liquidatedDebt = 51 + 190 + 1025 + 13510 = 14646 YUSD
    const expectedLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt).add(D_totalDebt)

    // Liquidate troves A-D
    const liquidationTxData = await troveManager.batchLiquidateTroves([alice, bob, dennis, carol], liquidator, { from: liquidator, gasPrice: 0 })

    // Get data from the liquidation event logs
    const [loggedDebt, loggedColl, loggedGasComp, ] = th.getEmittedLiquidationValues(liquidationTxData, wethIDX)

    assert.isAtMost(th.getDifference(expectedLiquidatedDebt, loggedDebt), 1000)
    assert.isAtMost(th.getDifference(expectedLiquidatedColl, loggedColl), 1000)
    assert.isAtMost(th.getDifference(expectedGasComp, loggedGasComp), 1000)
  })

  // --- Trove ordering by ICR tests ---

  it('Trove ordering: same collateral, decreasing debt. Price successively increases. Troves should maintain ordering by ICR', async () => {
    const _10_accounts = accounts.slice(1, 11)

    let debt = 50
    // create 10 troves, constant coll, descending debt 100 to 90 YUSD
    for (const account of _10_accounts) {

      const debtString = debt.toString().concat('000000000000000000')
      await openTrove({ extraYUSDAmount: debtString, extraParams: { from: account, value: dec(30, 'ether') } })

      const squeezedTroveAddr = th.squeezeAddr(account)

      debt -= 1
    }

    const initialPrice = await priceFeed.getPrice()
    const firstColl = (await troveManager.getTroveColls(_10_accounts[0]))[1][wethIDX]

    // Vary price 200-210
    let price = 200
    while (price < 210) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []
      const coll_firstTrove = (await troveManager.getTroveColls(_10_accounts[0]))[1][wethIDX]
      const gasComp_firstTrove = (await troveManagerTester.getCollGasCompensation(weth.address, coll_firstTrove))

      for (account of _10_accounts) {
        // Check gas compensation is the same for all troves
        const coll = (await troveManager.getTroveColls(account))[1][wethIDX]
        const gasCompensation = (await troveManagerTester.getCollGasCompensation(weth.address, coll))

        assert.equal(gasCompensation.toString(), gasComp_firstTrove.toString())

        const ICR = await troveManager.getCurrentICR(account)
        ICRList.push(ICR)


        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2]

          try {
            assert.isTrue(ICR.gte(prevICR))
          } catch (error) {
            console.log(`ETH price at which trove ordering breaks: ${price}`)
            logICRs(ICRList)
          }
        }

        price += 1
      }
    }
  })

  it('Trove ordering: increasing collateral, constant debt. Price successively increases. Troves should maintain ordering by ICR', async () => {
    const _20_accounts = accounts.slice(1, 21)

    let coll = 50
    // create 20 troves, increasing collateral, constant debt = 100YUSD
    for (const account of _20_accounts) {

      const collString = coll.toString().concat('000000000000000000')
      await openTrove({ extraYUSDAmount: dec(100, 18), extraParams: { from: account, value: collString } })

      coll += 5
    }

    const initialPrice = await priceFeed.getPrice()

    // Vary price 
    let price = 1
    while (price < 300) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []

      for (account of _20_accounts) {
        const ICR = await troveManager.getCurrentICR(account)
        ICRList.push(ICR)

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2]

          try {
            assert.isTrue(ICR.gte(prevICR))
          } catch (error) {
            console.log(`ETH price at which trove ordering breaks: ${price}`)
            logICRs(ICRList)
          }
        }

        price += 10
      }
    }
  })

  it('Trove ordering: Constant raw collateral ratio (excluding virtual debt). Price successively increases. Troves should maintain ordering by ICR', async () => {
    let collVals = [1, 5, 10, 25, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000].map(v => v * 20)
    const accountsList = accounts.slice(1, collVals.length + 1)

    let accountIdx = 0
    for (const coll of collVals) {

      const debt = coll * 110

      const account = accountsList[accountIdx]
      const collString = coll.toString().concat('000000000000000000')
      await openTrove({ extraYUSDAmount: dec(100, 18), extraParams: { from: account, value: collString } })

      accountIdx += 1
    }

    const initialPrice = await priceFeed.getPrice()

    // Vary price
    let price = 1
    while (price < 300) {

      const priceString = price.toString().concat('000000000000000000')
      await priceFeed.setPrice(priceString)

      const ICRList = []

      for (account of accountsList) {
        const ICR = await troveManager.getCurrentICR(account)
        ICRList.push(ICR)

        // Check trove ordering by ICR is maintained
        if (ICRList.length > 1) {
          const prevICR = ICRList[ICRList.length - 2]

          try {
            assert.isTrue(ICR.gte(prevICR))
          } catch (error) {
            console.log(error)
            console.log(`ETH price at which trove ordering breaks: ${price}`)
            logICRs(ICRList)
          }
        }

        price += 10
      }
    }
  })
})

