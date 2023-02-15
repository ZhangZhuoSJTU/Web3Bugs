const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const { dec, toBN } = th
const moneyVals = testHelpers.MoneyValues

let latestRandomSeed = 31337

const TroveManagerTester = artifacts.require("TroveManagerTester")
const YUSDToken = artifacts.require("YUSDToken")

contract('HintHelpers', async accounts => {
 
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let sortedTroves
  let troveManager
  let borrowerOperations
  let hintHelpers
  let priceFeed

  let contracts

  let numAccounts;

  let stableCoin
  let priceFeedStableCoin
  let tokenRisky
  let priceFeedRisky

  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)

  /* Open a Trove for each account. YUSD debt is 200 YUSD each, with collateral beginning at
  1.5 ether, and rising by 0.01 ether per Trove.  Hence, the ICR of account (i + 1) is always 1% greater than the ICR of account i. 
 */

 // Open Troves in parallel, then withdraw YUSD in parallel
 const makeTrovesInParallel = async (accounts, n) => {
  activeAccounts = accounts.slice(0,n)
  // console.log(`number of accounts used is: ${activeAccounts.length}`)
  // console.time("makeTrovesInParallel")
  const openTrovepromises = activeAccounts.map((account, index) => openTrove(account, index))
  await Promise.all(openTrovepromises)
  const withdrawYUSDpromises = activeAccounts.map(account => withdrawYUSDfromTrove(account))
  await Promise.all(withdrawYUSDpromises)
  // console.timeEnd("makeTrovesInParallel")
 }

 const openTrove = async (account, index) => {
   const amountFinney = 2000 + index * 10
   const coll = web3.utils.toWei((amountFinney.toString()), 'finney')
   await borrowerOperations.openTrove(th._100pct, 0, account, account, { from: account, value: coll })
 }

 const withdrawYUSDfromTrove = async (account) => {
  await borrowerOperations.withdrawYUSD(th._100pct, '100000000000000000000', account, account, { from: account })
 }

 // Sequentially add coll and withdraw YUSD, 1 account at a time
  const makeTrovesInSequence = async (accounts, n) => {
    activeAccounts = accounts.slice(0,n)
    // console.log(`number of accounts used is: ${activeAccounts.length}`)

    let ICR = 200
    const allColls = [contracts.weth, contracts.wavax, stableCoin, tokenRisky]
    const allAmounts = 
        [toBN(dec(2000, 18)),  // price = 100. Ratio = 1. Collateral amount = 200. Value = 200 * 1 * 100 = 200000
         toBN(dec(4000, 18)),   // price = 50. Ratio = 1. Collateral amount = 400. Value = 400 * 1 * 50 = 200000
         toBN(dec(200000, 18)).mul(toBN(dec(1, 18))).div(toBN(dec(105, 16))),   // price = 1. Ratio = 1.05. Collateral amount = 200000 / 1.05
         toBN(dec(200000, 18)).mul(toBN(dec(1, 36))).div(toBN(dec(75, 16))).div(toBN(dec(200, 18)))]   // price = 200. Ratio = 0.75. Collateral amount = 200000 / 200 / 0.75 = 100 / 0.75

    let thisColls = [0, 0]
    let thisAmounts = [0, 0]
    let resultIndex = 0
    let prevIndex = -1
    // console.time('makeTrovesInSequence')
    for (const account of activeAccounts) {
      const ICR_BN = toBN(ICR.toString().concat('0'.repeat(16)))
    //   await th.openTrove(contracts, { extraYUSDAmount: toBN(dec(10000, 18)), ICR: ICR_BN, extraParams: { from: account } })
        // Choose 2 out of these 4, which will create the same collateral value, in VC. 
        for (let i = 0; i < 2; i++) {
            resultIndex = Math.floor(Math.random() * allColls.length)
            if (resultIndex == prevIndex) {
                resultIndex = (resultIndex + 1) % allColls.length
            }
            prevIndex = resultIndex 
            thisColls[i] = allColls[resultIndex]
            thisAmounts[i] = allAmounts[resultIndex]
        }
        prevIndex = -1;
        // console.log("THIS COLLS ", thisColls[0].address, thisColls[1].address)
      await th.openTroveWithColls(contracts, { ICR: ICR_BN,
        colls: thisColls, amounts: thisAmounts,  from: account })

      ICR += 1
    }
    // console.timeEnd('makeTrovesInSequence')
  }

  before(async () => {
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

    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    priceFeed = contracts.priceFeedETH
  
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)


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


    numAccounts = 10

    await priceFeed.setPrice(dec(100, 18))
    await contracts.priceFeedAVAX.setPrice(dec(50, 18))
    await priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
    await priceFeedRisky.setPrice(toBN(dec(200, 18)))
    await makeTrovesInSequence(accounts, numAccounts) 
    // await makeTrovesInParallel(accounts, numAccounts)  


  })

  it("setup: makes accounts with nominal ICRs increasing by 1% consecutively", async () => {
    // check first 10 accounts
    const ICR_0 = await troveManager.getCurrentICR(accounts[0])
    const ICR_1 = await troveManager.getCurrentICR(accounts[1])
    const ICR_2 = await troveManager.getCurrentICR(accounts[2])
    const ICR_3 = await troveManager.getCurrentICR(accounts[3])
    const ICR_4 = await troveManager.getCurrentICR(accounts[4])
    const ICR_5 = await troveManager.getCurrentICR(accounts[5])
    const ICR_6 = await troveManager.getCurrentICR(accounts[6])
    const ICR_7 = await troveManager.getCurrentICR(accounts[7])
    const ICR_8 = await troveManager.getCurrentICR(accounts[8])
    const ICR_9 = await troveManager.getCurrentICR(accounts[9])

    console.log("ICR 0 ", ICR_0.toString())
    console.log("ICR 1 ", ICR_1.toString())
    console.log("ICR 2 ", ICR_2.toString())
    console.log("ICR 3 ", ICR_3.toString())
    console.log("ICR 4 ", ICR_4.toString())
    console.log("ICR 5 ", ICR_5.toString())
    console.log("ICR 6 ", ICR_6.toString())
    console.log("ICR 7 ", ICR_7.toString())
    console.log("ICR 8 ", ICR_8.toString())
    console.log("ICR 9 ", ICR_9.toString())
    
    // Off by 1 wei. 
    assert.isTrue(ICR_0.eq(toBN(dec(200, 16))))
    assert.isTrue(ICR_1.eq(toBN(dec(201, 16))))
    assert.isTrue(ICR_2.eq(toBN(dec(202, 16))))
    assert.isTrue(ICR_3.eq(toBN(dec(203, 16))))
    assert.isTrue(ICR_4.eq(toBN(dec(204, 16))))
    assert.isTrue(ICR_5.eq(toBN(dec(205, 16))))
    assert.isTrue(ICR_6.eq(toBN(dec(206, 16))))
    assert.isTrue(ICR_7.eq(toBN(dec(207, 16))))
    assert.isTrue(ICR_8.eq(toBN(dec(208, 16))))
    assert.isTrue(ICR_9.eq(toBN(dec(209, 16))))
  })

  it("getApproxHint(): returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    /* As per the setup, the ICRs of Troves are monotonic and seperated by 1% intervals. Therefore, the difference in ICR between 
    the given CR and the ICR of the hint address equals the number of positions between the hint address and the correct insert position 
    for a Trove with the given CR. */

    // CR = 250%
    const CR_250 = '2500000000000000000'
    const CRPercent_250 = Number(web3.utils.fromWei(CR_250, 'ether')) * 100

    let hintAddress

    // const hintAddress_250 = await functionCaller.troveManager_getApproxHint(CR_250, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_250, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_250 = await troveManager.getCurrentICR(hintAddress)
    const ICRPercent_hintAddress_250 = Number(web3.utils.fromWei(ICR_hintAddress_250, 'ether')) * 100

    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_250 = (ICRPercent_hintAddress_250 - CRPercent_250)
    assert.isBelow(ICR_Difference_250, sqrtLength)

    // CR = 287% 
    const CR_287 = '2870000000000000000'
    const CRPercent_287 = Number(web3.utils.fromWei(CR_287, 'ether')) * 100

    // const hintAddress_287 = await functionCaller.troveManager_getApproxHint(CR_287, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_287, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_287 = await troveManager.getCurrentICR(hintAddress)
    const ICRPercent_hintAddress_287 = Number(web3.utils.fromWei(ICR_hintAddress_287, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_287 = (ICRPercent_hintAddress_287 - CRPercent_287)
    assert.isBelow(ICR_Difference_287, sqrtLength)

    // CR = 213%
    const CR_213 = '2130000000000000000'
    const CRPercent_213 = Number(web3.utils.fromWei(CR_213, 'ether')) * 100

    // const hintAddress_213 = await functionCaller.troveManager_getApproxHint(CR_213, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_213, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_213 = await troveManager.getCurrentICR(hintAddress)
    const ICRPercent_hintAddress_213 = Number(web3.utils.fromWei(ICR_hintAddress_213, 'ether')) * 100
    
    // check the hint position is at most sqrtLength positions away from the correct position
    ICR_Difference_213 = (ICRPercent_hintAddress_213 - CRPercent_213)
    assert.isBelow(ICR_Difference_213, sqrtLength)

     // CR = 201%
     const CR_201 = '2010000000000000000'
     const CRPercent_201 = Number(web3.utils.fromWei(CR_201, 'ether')) * 100
 
    //  const hintAddress_201 = await functionCaller.troveManager_getApproxHint(CR_201, sqrtLength * 10)
     ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_201, sqrtLength * 10, latestRandomSeed))
     const ICR_hintAddress_201 = await troveManager.getCurrentICR(hintAddress)
     const ICRPercent_hintAddress_201 = Number(web3.utils.fromWei(ICR_hintAddress_201, 'ether')) * 100
     
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_201 = (ICRPercent_hintAddress_201 - CRPercent_201)
     assert.isBelow(ICR_Difference_201, sqrtLength)
  })

  /* Pass 100 random collateral ratios to getApproxHint(). For each, check whether the returned hint address is within 
  sqrt(length) positions of where a Trove with that CR should be inserted. */
  it("getApproxHint(): for 100 random CRs, returns the address of a Trove within sqrt(length) positions of the correct insert position", async () => {
    // const newNumAccounts = 100
    // await makeTrovesInSequence(accounts, newNumAccounts-10) 
    console.log("This test may take a minute")
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))
    let hintAddress
    for (i = 0; i < 100; i++) {
      // get random ICR between 200% and (200 + numAccounts)%
      const min = 200
      const max = 200 + numAccounts
      const ICR_Percent = (Math.floor(Math.random() * (max - min) + min)) 

      // Convert ICR to a duint
      const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney') 
  
      ;({hintAddress, latestRandomSeed} = await hintHelpers.getApproxHint(ICR, sqrtLength * 10, latestRandomSeed))
      const ICR_hintAddress = await troveManager.getCurrentICR(hintAddress)
      const ICRPercent_hintAddress = Number(web3.utils.fromWei(ICR_hintAddress, 'ether')) * 100
      
      // check the hint position is at most sqrtLength positions away from the correct position
      ICR_Difference = (ICRPercent_hintAddress - ICR_Percent)
      assert.isBelow(ICR_Difference, sqrtLength)
    }
  })

  it("getApproxHint(): returns the head of the list if the CR is the max uint256 value", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

    // CR = Maximum value, i.e. 2**256 -1 
    const CR_Max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

    let hintAddress

    // const hintAddress_Max = await functionCaller.troveManager_getApproxHint(CR_Max, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_Max, sqrtLength * 10, latestRandomSeed))

    const ICR_hintAddress_Max = await troveManager.getCurrentICR(hintAddress)
    const ICRPercent_hintAddress_Max = Number(web3.utils.fromWei(ICR_hintAddress_Max, 'ether')) * 100

     const firstTrove = await sortedTroves.getFirst()
     const ICR_FirstTrove = await troveManager.getCurrentICR(firstTrove)
     const ICRPercent_FirstTrove = Number(web3.utils.fromWei(ICR_FirstTrove, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     ICR_Difference_Max = (ICRPercent_hintAddress_Max - ICRPercent_FirstTrove)
     assert.isBelow(ICR_Difference_Max, sqrtLength)
  })

  it("getApproxHint(): returns the tail of the list if the CR is lower than ICR of any Trove", async () => {
    const sqrtLength = Math.ceil(Math.sqrt(numAccounts))

     // CR = MCR
     const CR_Min = '1100000000000000000'

     let hintAddress

    //  const hintAddress_Min = await functionCaller.troveManager_getApproxHint(CR_Min, sqrtLength * 10)
    ;({ hintAddress, latestRandomSeed } = await hintHelpers.getApproxHint(CR_Min, sqrtLength * 10, latestRandomSeed))
    const ICR_hintAddress_Min = await troveManager.getCurrentICR(hintAddress)
    const ICRPercent_hintAddress_Min = Number(web3.utils.fromWei(ICR_hintAddress_Min, 'ether')) * 100

     const lastTrove = await sortedTroves.getLast()
     const ICR_LastTrove = await troveManager.getCurrentICR(lastTrove)
     const ICRPercent_LastTrove = Number(web3.utils.fromWei(ICR_LastTrove, 'ether')) * 100
 
     // check the hint position is at most sqrtLength positions away from the correct position
     const ICR_Difference_Min = (ICRPercent_hintAddress_Min - ICRPercent_LastTrove)
     assert.isBelow(ICR_Difference_Min, sqrtLength)
  })

})

// Gas usage:  See gas costs spreadsheet. Cost per trial = 10k-ish.
