/* Script that logs gas costs for Liquity operations under various conditions. 
  Note: uses Mocha testing structure, but simply prints gas costs of transactions. No assertions.
*/
const fs = require('fs')
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const {TestHelper: th, TimeValues: timeValues } = testHelpers
const dec = th.dec
const toBN = th.toBN

const ZERO_ADDRESS = th.ZERO_ADDRESS
const _100pct = th._100pct

contract('Gas cost tests', async accounts => {

  const [owner] = accounts;
  const [A,B,C,D,E,F,G,H,I, J] = accounts;
  const _10_Accounts = accounts.slice(0, 10)
  const _20_Accounts = accounts.slice(0, 20)
  const _30_Accounts = accounts.slice(0, 30)
  const _40_Accounts = accounts.slice(0, 40)
  const _50_Accounts = accounts.slice(0, 50)
  const _100_Accounts = accounts.slice(0, 100)

  const whale = accounts[999]
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  const address_0 = '0x0000000000000000000000000000000000000000'

  let contracts

  let priceFeed
  let yusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let hintHelpers
  let functionCaller

  let data = []


  beforeEach(async () => {
    contracts = await deploymentHelper.deployTesterContractsHardhat()
    const YETIContracts = await deploymentHelper.deployYETIContracts(bountyAddress, lpRewardsAddress)

    priceFeed = contracts.priceFeedTestnet
    yusdToken = contracts.yusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    functionCaller = contracts.functionCaller

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)
  })

  // ---TESTS ---

  it("runs the test helper", async () => {
    assert.equal(th.getDifference('2000', '1000'), 1000)
  })

  it("helper - getBorrowerOpsListHint(): returns the right position in the list", async () => {
    // Accounts A - J open troves at sequentially lower ICR
    await borrowerOperations.openTrove(_100pct, dec(100, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: A, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(102, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: B, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(104, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: C, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(106, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: D, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(108, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: E, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(110, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: F, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(112, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: G, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(114, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: H, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(116, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: I, value: dec(10, 'ether') })
    await borrowerOperations.openTrove(_100pct, dec(118, 18), ZERO_ADDRESS, ZERO_ADDRESS, { from: J, value: dec(10, 'ether') })
  
    for (account of [A,B,C,D,E,F,G,H,I,J]) {
      console.log(th.squeezeAddr(account))
    }

    // Between F and G
    let amount = dec(111, 18)
    let fee = await troveManager.getBorrowingFee(amount)
    let debt = (await th.getCompositeDebt(contracts, amount)).add(fee)
    let {upperHint, lowerHint} = await th.getBorrowerOpsListHint(contracts, dec(10, 'ether'), debt)  

    assert.equal(upperHint, F)
    assert.equal(lowerHint, G)

    // Bottom of the list
    amount = dec(120, 18)
    fee = await troveManager.getBorrowingFee(amount)
    debt = (await th.getCompositeDebt(contracts, amount)).add(fee)
    ;({upperHint, lowerHint} = await th.getBorrowerOpsListHint(contracts, dec(10, 'ether'), debt))
     
    assert.equal(upperHint, J)
    assert.equal(lowerHint, ZERO_ADDRESS)

    // Top of the list
    amount = dec(98, 18)
    fee = await troveManager.getBorrowingFee(amount)
    debt = (await th.getCompositeDebt(contracts, amount)).add(fee)
    ;({upperHint, lowerHint} = await th.getBorrowerOpsListHint(contracts, dec(10, 'ether'), debt))
     
    assert.equal(upperHint, ZERO_ADDRESS)
    assert.equal(lowerHint, A)
  })

  // --- Trove Manager function calls ---

  // --- openTrove() ---

  // it("", async () => {
  //   const message = 'openTrove(), single account, 0 existing Troves in system. Adds 10 ether and issues 100 YUSD'
  //   const tx = await borrowerOperations.openTrove(_100pct, dec(100, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2], value: dec(10, 'ether') })
  //   const gas = th.gasUsed(tx)
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'openTrove(), single account, 1 existing Trove in system. Adds 10 ether and issues 100 YUSD'
  //   await borrowerOperations.openTrove(_100pct, dec(100, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(10, 'ether') })

  //   const tx = await borrowerOperations.openTrove(_100pct, dec(100, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2], value: dec(10, 'ether') })
  //   const gas = th.gasUsed(tx)
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'openTrove(), single account, Inserts between 2 existing CDs in system. Adds 10 ether and issues 80 YUSD. '

  //   await borrowerOperations.openTrove(_100pct, dec(100, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(10, 'ether') })
  //   await borrowerOperations.openTrove(_100pct, dec(50, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2], value: dec(10, 'ether') })

  //   const tx = await borrowerOperations.openTrove(_100pct, dec(80, 18), accounts[3], ZERO_ADDRESS, { from: accounts[3], value: dec(10, 'ether') })

  //   const gas = th.gasUsed(tx)
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'openTrove(), 10 accounts, each account adds 10 ether and issues 100 YUSD'

  //   const amountETH = dec(10, 'ether')
  //   const amountYUSD = 0
  //   const gasResults = await th.openTrove_allAccounts(_10_Accounts, contracts, amountETH, amountYUSD)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'openTrove(), 10 accounts, each account adds 10 ether and issues less YUSD than the previous one'
  //   const amountETH = dec(10, 'ether')
  //   const amountYUSD = 200
  //   const gasResults = await th.openTrove_allAccounts_decreasingYUSDAmounts(_10_Accounts, contracts, amountETH, amountYUSD)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'openTrove(), 50 accounts, each account adds random ether and random YUSD'
    const amountETH = dec(10, 'ether')
    const amountYUSD = 0
    const gasResults = await th.openTrove_allAccounts_randomETH_randomYUSD(1, 9, _50_Accounts, contracts, 2, 100, true)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- adjustTrove ---

  // it("", async () => {
  //   const message = 'adjustTrove(). ETH/YUSD Increase/Increase. 10 accounts, each account adjusts up -  1 ether and 100 YUSD'
  //   await borrowerOperations.openTrove(_100pct, 0, accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(100, 'ether') })

  //   const amountETH = dec(10, 'ether')
  //   const amountYUSD = dec(100, 18)
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, amountETH, amountYUSD)


  //   const amountETH_2 = dec(1, 'ether')
  //   const amountYUSD_2 = dec(100, 18)
  //   const gasResults = await th.adjustTrove_allAccounts(_10_Accounts, contracts, amountETH_2, amountYUSD_2)

  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'adjustTrove(). ETH/YUSD Decrease/Decrease. 10 accounts, each account adjusts down by 0.1 ether and 10 YUSD'
  //   await borrowerOperations.openTrove(_100pct, 0, accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(100, 'ether') })

  //   const amountETH = dec(10, 'ether')
  //   const amountYUSD = dec(100, 18)
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, amountETH, amountYUSD)

  //   const amountETH_2 = "-100000000000000000"  // coll decrease of 0.1 ETH 
  //   const amountYUSD_2 = "-10000000000000000000" // debt decrease of 10 YUSD
  //   const gasResults = await th.adjustTrove_allAccounts(_10_Accounts, contracts, amountETH_2, amountYUSD_2)

  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'adjustTrove(). ETH/YUSD Increase/Decrease. 10 accounts, each account adjusts up by 0.1 ether and down by 10 YUSD'
  //   await borrowerOperations.openTrove(_100pct, 0, accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(100, 'ether') })

  //   const amountETH = dec(10, 'ether')
  //   const amountYUSD = dec(100, 18)
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, amountETH, amountYUSD)

  //   const amountETH_2 = "100000000000000000"  // coll increase of 0.1 ETH 
  //   const amountYUSD_2 = "-10000000000000000000" // debt decrease of 10 YUSD
  //   const gasResults = await th.adjustTrove_allAccounts(_10_Accounts, contracts, amountETH_2, amountYUSD_2)

  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'adjustTrove(). 30 accounts, each account adjusts up by random amounts. No size range transition'
  //   await borrowerOperations.openTrove(_100pct, 0, accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(100, 'ether') })

  //   const amountETH = dec(10, 'ether')
  //   const amountYUSD = dec(100, 18)
  //   await th.openTrove_allAccounts(_30_Accounts, contracts, amountETH, amountYUSD)

  //   // Randomly add between 1-9 ETH, and withdraw 1-100 YUSD
  //   const gasResults = await th.adjustTrove_allAccounts_randomAmount(_30_Accounts, contracts, 1, 9, 1, 100)

  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'adjustTrove(). 40 accounts, each account adjusts up by random amounts. HAS size range transition'
    await borrowerOperations.openTrove(_100pct, 0, accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(100, 'ether') })

    const amountETH = dec(9, 'ether')
    const amountYUSD = dec(100, 18)
    await th.openTrove_allAccounts(_40_Accounts, contracts, amountETH, amountYUSD)
    // Randomly add between 1-9 ETH, and withdraw 1-100 YUSD
    const gasResults = await th.adjustTrove_allAccounts_randomAmount(_40_Accounts, contracts, 1, 9, 1, 100)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- closeTrove() ---

  it("", async () => {
    const message = 'closeTrove(), 10 accounts, 1 account closes its trove'

    await th.openTrove_allAccounts_decreasingYUSDAmounts(_10_Accounts, contracts, dec(10, 'ether'), 200)

    for (account of _10_Accounts ) {
      await yusdToken.unprotectedMint(account, dec(1000, 18))
    }

    const tx = await borrowerOperations.closeTrove({ from: accounts[1] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'closeTrove(), 20 accounts, each account adds 10 ether and issues less YUSD than the previous one. First 10 accounts close their trove. '

    await th.openTrove_allAccounts_decreasingYUSDAmounts(_20_Accounts, contracts, dec(10, 'ether'), 200)

    for (account of _20_Accounts ) {
      await yusdToken.unprotectedMint(account, dec(1000, 18))
    }
    
    const gasResults = await th.closeTrove_allAccounts(_20_Accounts.slice(1), contracts)

    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- addColl() ---

  // it("", async () => {
  //   const message = 'addColl(), second deposit, 0 other Troves in system. Adds 10 ether'
  //   await th.openTrove_allAccounts([accounts[2]], contracts, dec(10, 'ether'), 0)

  //   const tx = await borrowerOperations.addColl(accounts[2], accounts[2], { from: accounts[2], value: dec(10, 'ether') })
  //   const gas = th.gasUsed(tx)
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'addColl(), second deposit, 10 existing Troves in system. Adds 10 ether'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

  //   await th.openTrove_allAccounts([accounts[99]], contracts, dec(10, 'ether'), 0)
  //   const tx = await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: dec(10, 'ether') })
  //   const gas = th.gasUsed(tx)
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'addColl(), second deposit, 10 accounts, each account adds 10 ether'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

  //   const gasResults = await th.addColl_allAccounts(_10_Accounts, contracts, dec(10, 'ether'))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'addColl(), second deposit, 30 accounts, each account adds random amount. No size range transition'
    const amount = dec(10, 'ether')
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.addColl_allAccounts_randomAmount(0.000000001, 10000, _30_Accounts, th._100pct, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawColl() ---

  // it("", async () => {
  //   const message = 'withdrawColl(), first withdrawal. 10 accounts in system. 1 account withdraws 5 ether'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

  //   const tx = await borrowerOperations.withdrawColl(dec(5, 'ether'), accounts[9], ZERO_ADDRESS, { from: accounts[9] })
  //   const gas = th.gasUsed(tx)
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'withdrawColl(), first withdrawal, 10 accounts, each account withdraws 5 ether'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

  //   const gasResults = await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(5, 'ether'))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws 5 ether'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(1, 'ether'))

  //   const gasResults = await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(5, 'ether'))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'withdrawColl(), first withdrawal, 30 accounts, each account withdraws random amount. HAS size range transition'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 8, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawColl(), second withdrawal, 10 accounts, each account withdraws random amount'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawColl_allAccounts(_10_Accounts, contracts, dec(1, 'ether'))

    const gasResults = await th.withdrawColl_allAccounts_randomAmount(1, 8, _10_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawYUSD() ---

  // it("", async () => {
  //   const message = 'withdrawYUSD(), first withdrawal, 10 accounts, each account withdraws 100 YUSD'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)

  //   const gasResults = await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'withdrawYUSD(), second withdrawal, 10 accounts, each account withdraws 100 YUSD'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

  //   const gasResults = await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'withdrawYUSD(), first withdrawal, 30 accounts, each account withdraws a random YUSD amount'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)

    const gasResults = await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawYUSD(), second withdrawal, 30 accounts, each account withdraws a random YUSD amount'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_30_Accounts, contracts, dec(100, 18))

    const gasResults = await th.withdrawYUSD_allAccounts_randomAmount(1, 70, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- repayYUSD() ---

  // it("", async () => {
  //   const message = 'repayYUSD(), partial repayment, 10 accounts, repay 30 YUSD (of 100 YUSD)'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

  //   const gasResults = await th.repayYUSD_allAccounts(_10_Accounts, contracts, dec(30, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'repayYUSD(), second partial repayment, 10 accounts, repay 30 YUSD (of 70 YUSD)'
  //   await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_30_Accounts, contracts, dec(100, 18))
  //   await th.repayYUSD_allAccounts(_30_Accounts, contracts, dec(30, 18))

  //   const gasResults = await th.repayYUSD_allAccounts(_30_Accounts, contracts, dec(30, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'repayYUSD(), partial repayment, 30 accounts, repay random amount of YUSD (of 100 YUSD)'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_30_Accounts, contracts, dec(100, 18))

    const gasResults = await th.repayYUSD_allAccounts_randomAmount(1, 99, _30_Accounts, contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // it("", async () => {
  //   const message = 'repayYUSD(), first repayment, 10 accounts, repay in full (100 of 100 YUSD)'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

  //   const gasResults = await th.repayYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'repayYUSD(), first repayment, 30 accounts, repay in full (50 of 50 YUSD)'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_30_Accounts, contracts, dec(100, 18))
    await th.repayYUSD_allAccounts(_30_Accounts, contracts, dec(50, 18))

    const gasResults = await th.repayYUSD_allAccounts(_30_Accounts, contracts, dec(50, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- getCurrentICR() ---

  it("", async () => {
    const message = 'single getCurrentICR() call'

    await th.openTrove_allAccounts([accounts[1]], contracts, dec(10, 'ether'), 0)
    const randYUSDAmount = th.randAmountInWei(1, 180)
    await borrowerOperations.withdrawYUSD(_100pct, randYUSDAmount, accounts[1], ZERO_ADDRESS, { from: accounts[1] })

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.troveManager_getCurrentICR(accounts[1], price)

    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)
  })

  it("", async () => {
    const message = 'getCurrentICR(), new Troves with 10 ether and no withdrawals'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), Troves with 10 ether and 100 YUSD withdrawn'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), Troves with 10 ether and random YUSD amount withdrawn'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts_randomAmount(1, 1300, _10_Accounts, contracts)

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- getCurrentICR() with pending distribution rewards ---

  it("", async () => {
    const message = 'single getCurrentICR() call, WITH pending rewards'

    const randYUSDAmount = th.randAmountInWei(1, 180)
    await borrowerOperations.openTrove(_100pct, randYUSDAmount, accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(10, 'ether') })

    // acct 999 adds coll, withdraws YUSD, sits at 111% ICR
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(1, 'ether') })

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[999], { from: accounts[0] })

    const price = await priceFeed.getPrice()
    const tx = await functionCaller.troveManager_getCurrentICR(accounts[1], price)

    const gas = th.gasUsed(tx) - 21000
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), new Troves with 10 ether and no withdrawals,  WITH pending rewards'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(100, 18))

    // acct 999 adds coll, withdraws YUSD, sits at 111% ICR
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(1, 'ether') })

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), Troves with 10 ether and 100 YUSD withdrawn, WITH pending rewards'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(100, 18))

    // acct 999 adds coll, withdraws YUSD, sits at 111% ICR
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(1, 'ether') })


    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'getCurrentICR(), Troves with 10 ether and random YUSD amount withdrawn, WITH pending rewards'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(100, 18))

    // acct 999 adds coll, withdraws YUSD, sits at 111% ICR
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[999], ZERO_ADDRESS, { from: accounts[999], value: dec(1, 'ether') })

    // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[999], { from: accounts[0] })

    const gasResults = await th.getCurrentICR_allAccounts(_10_Accounts, contracts, functionCaller)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- redeemCollateral() ---
  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 YUSD, redemption hits 1 Trove. One account in system, partial redemption'
    await th.openTrove_allAccounts([accounts[0]], contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts([accounts[0]], contracts, dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(accounts[0], contracts, dec(50, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 YUSD, redemption hits 1 Trove. No pending rewards. 3 accounts in system, partial redemption'
    // 3 accounts add coll
    await th.openTrove_allAccounts(accounts.slice(0, 3), contracts, dec(10, 'ether'), 0)
    // 3 accounts withdraw successively less YUSD
    await borrowerOperations.withdrawYUSD(_100pct, dec(100, 18), accounts[0], ZERO_ADDRESS, { from: accounts[0] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(90, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(80, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })

    /* Account 2 redeems 50 YUSD. It is redeemed from account 0's Trove,
    leaving the Trove active with 30 YUSD and ((200 *10 - 50 ) / 200 ) = 9.75 ETH.
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(accounts[2], contracts, dec(50, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 101 YUSD, redemption hits 2 Troves, last redemption is partial'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 500 YUSD, redeems 101 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(500, 18), whale, ZERO_ADDRESS, { from: whale })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(101, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 500 YUSD, redemption hits 5 Troves, all full redemptions'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 500 YUSD, redeems 500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(500, 18), whale, ZERO_ADDRESS, { from: whale })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 450 YUSD, redemption hits 5 Troves,  last redemption is partial (50 of 100 YUSD)'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 450 YUSD, redeems 500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(450, 18), whale, ZERO_ADDRESS, { from: whale })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(450, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1000 YUSD, redemption hits 10 Troves'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1000 YUSD, redeems 500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(1000, 18), whale, ZERO_ADDRESS, { from: whale })
    
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(1000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1500 YUSD, redemption hits 15 Troves'
    await th.openTrove_allAccounts(_20_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_20_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1500 YUSD, redeems 1500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(1500, 18), whale, ZERO_ADDRESS, { from: whale })
    
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(1500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 2000 YUSD, redemption hits 20 Troves'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_30_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 2000 YUSD, redeems 2000 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(2000, 18), whale, ZERO_ADDRESS, { from: whale })
    
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(2000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  YUSD, each redemption only hits the first Trove, never closes it'
  //   await th.addColl_allAccounts(_20_Accounts, troveManager, dec(10, 'ether'))
  //   await th.withdrawYUSD_allAccounts(_20_Accounts, troveManager, dec(100, 18))

  //   const gasResults = await th.redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, troveManager)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // --- redeemCollateral(), with pending redistribution rewards --- 

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 YUSD, redemption hits 1 Trove, WITH pending rewards. One account in system'
    await th.openTrove_allAccounts([accounts[1]], contracts, dec(10, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(100, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })

    // acct 998 adds coll, withdraws YUSD, sits at 111% ICR
    await th.openTrove_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[998], ZERO_ADDRESS, { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[998], { from: accounts[0] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(accounts[1], contracts, dec(50, 18))

    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeems 50 YUSD, redemption hits 1 Trove. WITH pending rewards. 3 accounts in system.'
    // 3 accounts add coll
    await th.openTrove_allAccounts(accounts.slice(0, 3), contracts, dec(10, 'ether'), 0)
    // 3 accounts withdraw successively less YUSD
    await borrowerOperations.withdrawYUSD(_100pct, dec(100, 18), accounts[0], ZERO_ADDRESS, { from: accounts[0] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(90, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(80, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })

    // acct 999 adds coll, withdraws YUSD, sits at 111% ICR
    await th.openTrove_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[998], ZERO_ADDRESS, { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[998], { from: accounts[0] })

    /* Account 2 redeems 50 YUSD. It is redeemed from account 0's Trove,
    leaving the Trove active with 30 YUSD and ((200 *10 - 50 ) / 200 ) = 9.75 ETH.
    
    It's ICR jumps from 2500% to 6500% and it is reinserted at the top of the list.
    */

   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(accounts[2], contracts, dec(50, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 500 YUSD, WITH pending rewards, redemption hits 5 Troves, WITH pending rewards'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 500 YUSD, redeems 500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(500, 18), whale, ZERO_ADDRESS, { from: whale })

    // acct 998 adds coll, withdraws YUSD, sits at 111% ICR
    await th.openTrove_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[998], ZERO_ADDRESS, { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[998], { from: accounts[0] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1000 YUSD, WITH pending rewards, redemption hits 10 Troves, WITH pending rewards'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1000 YUSD, redeems 500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(1000, 18), whale, ZERO_ADDRESS, { from: whale })

    // acct 998 adds coll, withdraws YUSD, sits at 111% ICR
    await th.openTrove_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[998], ZERO_ADDRESS, { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[998], { from: accounts[0] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(1000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 1500 YUSD, WITH pending rewards, redemption hits 15 Troves, WITH pending rewards'
    await th.openTrove_allAccounts(_20_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_20_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 1500 YUSD, redeems 1500 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(1500, 18), whale, ZERO_ADDRESS, { from: whale })

    //  // acct 998 adds coll, withdraws YUSD, sits at 111% ICR
    await th.openTrove_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[998], ZERO_ADDRESS, { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[998], { from: accounts[0] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(1500, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'redeemCollateral(), redeemed 2000 YUSD, WITH pending rewards, redemption hits 20 Troves, WITH pending rewards'
    await th.openTrove_allAccounts(_30_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_30_Accounts, contracts, dec(100, 18))

    // Whale adds 200 ether, withdraws 2000 YUSD, redeems 2000 YUSD
    await borrowerOperations.openTrove(_100pct, 0, whale, ZERO_ADDRESS, { from: whale, value: dec(200, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(2000, 18), whale, ZERO_ADDRESS, { from: whale })

    // acct 998 adds coll, withdraws YUSD, sits at 111% ICR
    await th.openTrove_allAccounts([accounts[998]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[998], ZERO_ADDRESS, { from: accounts[998] })

    // Price drops, account[998]'s ICR falls below MCR, and gets liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[998], { from: accounts[0] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)
    const gas = await th.redeemCollateral(whale, contracts, dec(2000, 18))
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Slow test

  // it("", async () => { 
  //   const message = 'redeemCollateral(),  YUSD, each redemption only hits the first Trove, never closes it, WITH pending rewards'
  //   await th.addColl_allAccounts(_20_Accounts, troveManager, dec(10, 'ether'))
  //   await th.withdrawYUSD_allAccounts(_20_Accounts, troveManager, dec(100, 18))

  //    // acct 999 adds coll, withdraws YUSD, sits at 111% ICR
  //    await borrowerOperations.addColl(accounts[999], {from: accounts[999], value:dec(1, 'ether')})
  //    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[999], ZERO_ADDRESS, { from: accounts[999]})

  //     // Price drops, account[999]'s ICR falls below MCR, and gets liquidated
  //    await priceFeed.setPrice(dec(100, 18))
  //    await troveManager.liquidate(accounts[999], ZERO_ADDRESS, { from: accounts[0]})

  //   const gasResults = await th.redeemCollateral_allAccounts_randomAmount( 1, 10, _10_Accounts, troveManager)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })


  // --- getApproxHint() ---

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 10, 10 calls, each with random CR'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   gasCostList = []

  //   for (i = 0; i < 10; i++) {
  //     randomCR = th.randAmountInWei(1, 5)
  //     const tx = await functionCaller.troveManager_getApproxHint(randomCR, 10)
  //     const gas = th.gasUsed(tx) - 21000
  //     gasCostList.push(gas)
  //   }

  //   const gasResults = th.getGasMetrics(gasCostList)
  //   th.logGasMetrics(gasResults)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 10:  i.e. k = 1, list size = 1'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 10)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 32:  i.e. k = 10, list size = 10'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)


  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 32)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'getApproxHint(), numTrials = 100: i.e. k = 10, list size = 100'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0 )
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, borrowerOperations)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 100)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // Slow tests

  // it("", async () => { //8mil. gas
  //   const message = 'getApproxHint(), numTrials = 320: i.e. k = 10, list size = 1000'
  //   await th.addColl_allAccounts(_10_Accounts, troveManager, dec(10, 'ether'))
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, troveManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 320)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 25mil. gas
  //   const message = 'getApproxHint(), numTrials = 1000:  i.e. k = 10, list size = 10000'
  //   await th.addColl_allAccounts(_10_Accounts, troveManager, dec(10, 'ether'))
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, troveManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 1000)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // it("", async () => { // 81mil. gas
  //   const message = 'getApproxHint(), numTrials = 3200:  i.e. k = 10, list size = 100000'
  //   await th.addColl_allAccounts(_10_Accounts, troveManager, dec(10, 'ether'))
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, troveManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 3200)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })


  // Test hangs 

  // it("", async () => { 
  //   const message = 'getApproxHint(), numTrials = 10000:  i.e. k = 10, list size = 1000000'
  //   await th.addColl_allAccounts(_10_Accounts, troveManager, dec(10, 'ether'))
  //   await th.withdrawYUSD_allAccounts_randomAmount(1, 180, _10_Accounts, troveManager)

  //   const CR = '200000000000000000000'
  //   tx = await functionCaller.troveManager_getApproxHint(CR, 10000)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({gas: gas}, message, data)
  // })

  // --- provideToSP(): No pending rewards

  // --- First deposit ---

  // it("", async () => {
  //   const message = 'provideToSP(), No pending rewards, part of issued YUSD: all accounts withdraw 180 YUSD, all make first deposit, provide 100 YUSD'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(130, 18))

  //   // first funds provided
  //   const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(100, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'provideToSP(), No pending rewards, all issued YUSD: all accounts withdraw 180 YUSD, all make first deposit, 180 YUSD'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(130, 18))

  //   // first funds provided
  //   const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(130, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 YUSD, all make first deposit, random YUSD amount'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(130, 18))

    // first funds provided
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 129, _10_Accounts, stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

     // --- Top-up deposit ---

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, deposit part of issued YUSD: all accounts withdraw 180 YUSD, all make second deposit, provide 50 YUSD'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(130, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))

    // >>FF time and one account tops up, triggers YETI gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have YETI gain
    for (account of _10_Accounts.slice(1)) {
      const YETIGain = await stabilityPool.getDepositorYETIGain(account)
      assert.isTrue(YETIGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // it("", async () => {
  //   const message = 'provideToSP(), No pending rewards, deposit all issued YUSD: all accounts withdraw 180 YUSD, make second deposit, provide 90 YUSD'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(130, 18))
  //   await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))

  //   // >> FF time and one account tops up, triggers YETI gains for all
  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
  //   await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

  //   // Check the other accounts have YETI gain
  //   for (account of _10_Accounts.slice(1)) {
  //     const YETIGain = await stabilityPool.getDepositorYETIGain(account)
  //     assert.isTrue(YETIGain.gt(toBN('0')))
  //   }

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // top-up of StabilityPool Deposit
  //   const gasResults = await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'provideToSP(), No pending rewards, all accounts withdraw 180 YUSD, make second deposit, random YUSD amount'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(_10_Accounts, contracts, dec(130, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(50, 18))

    // >>FF time and one account tops up, triggers YETI gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have YETI gain
    for (account of _10_Accounts.slice(1)) {
      const YETIGain = await stabilityPool.getDepositorYETIGain(account)
      assert.isTrue(YETIGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // top-up of StabilityPool Deposit
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 50, _10_Accounts, stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  //   // --- provideToSP(): Pending rewards

  //   // --- Top-up deposit ---

  // it("", async () => {
  //   const message = 'provideToSP(), with pending rewards in system. deposit part of issued YUSD: all accounts make second deposit, provide 50 YUSD'
  //   // 9 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 50 YUSD to Stability Pool
  //   await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(accounts.slice(2, 12), contracts, dec(130, 18))
  //   await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(50, 18))

  //   //1 acct open Trove with 1 ether and withdraws 170 YUSD
  //   await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })

  //   // >>FF time and one account tops up, triggers YETI gains for all
  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // Price drops, account 1 liquidated
  //   await priceFeed.setPrice(dec(100, 18))
  //   await troveManager.liquidate(accounts[1], { from: accounts[0] })
  //   assert.isFalse(await sortedTroves.contains(accounts[1]))

  //   // Check accounts have YETI gains from liquidations
  //   for (account of accounts.slice(2, 12)) {
  //     const YETIGain = await stabilityPool.getDepositorYETIGain(account)
  //     assert.isTrue(YETIGain.gt(toBN('0')))
  //   }

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // 9 active Troves top up their Stability Pool deposits with 50 YUSD
  //   const gasResults = await th.provideToSP_allAccounts(accounts.slice(2, 11), stabilityPool, dec(50, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // it("", async () => {
  //   const message = 'provideToSP(), with pending rewards in system. deposit all issued YUSD: all accounts make second deposit, provide 90 YUSD'
  //   // 10 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 90 YUSD to Stability Pool
  //   await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), 0)
  //   await th.withdrawYUSD_allAccounts(accounts.slice(2, 12), contracts, dec(130, 18))
  //   await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(50, 18))

  //   //1 acct open Trove with 1 ether and withdraws 180 YUSD
  //   await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })

  //   // >>FF time and one account tops up, triggers YETI gains for all
  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // Price drops, account[1] is liquidated
  //   await priceFeed.setPrice(dec(100, 18))
  //   await troveManager.liquidate(accounts[1], { from: accounts[0] })
  //   assert.isFalse(await sortedTroves.contains(accounts[1]))

  //   // Check accounts have YETI gains from liquidations
  //   for (account of accounts.slice(2, 12)) {
  //     const YETIGain = await stabilityPool.getDepositorYETIGain(account)
  //     assert.isTrue(YETIGain.gt(toBN('0')))
  //   }

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // 5 active Troves top up their Stability Pool deposits with 90 YUSD, using up all their issued YUSD
  //   const gasResults = await th.provideToSP_allAccounts(accounts.slice(7, 12), stabilityPool, dec(50, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'provideToSP(), with pending rewards in system. deposit part of issued YUSD: all make second deposit, provide random YUSD amount'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 90 YUSD to Stability Pool
    await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(130, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(50, 18))

    //1 acct open Trove with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })

    // >>FF time and one account tops up, triggers YETI gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[1] is liquidated
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[1]))

    // Check accounts have YETI gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const YETIGain = await stabilityPool.getDepositorYETIGain(account)
      assert.isTrue(YETIGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active Troves top up their Stability Pool deposits with a random YUSD amount
    const gasResults = await th.provideToSP_allAccounts_randomAmount(1, 49, accounts.slice(7, 12), stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawFromSP() ---

  // --- No pending rewards ---

  // partial
  // it("", async () => {
  //   const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - 90 YUSD of 180 YUSD deposit'
  //   await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(190, 18))
  //   await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(130, 18))

  //   // >>FF time and one account tops up, triggers YETI gains for all
  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
  //   await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

  //   // Check the other accounts have YETI gain
  //   for (account of _10_Accounts.slice(1)) {
  //     const YETIGain = await stabilityPool.getDepositorYETIGain(account)
  //     assert.isTrue(YETIGain.gt(toBN('0')))
  //   }
  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   const gasResults = await th.withdrawFromSP_allAccounts(_10_Accounts, stabilityPool, dec(90, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  // full
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make full withdrawal - 130 YUSD of 130 YUSD deposit'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(190, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(130, 18))

    // >>FF time and one account tops up, triggers YETI gains for all
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: _10_Accounts[0] })

    // Check the other accounts have YETI gain
    for (account of _10_Accounts.slice(1)) {
      const YETIGain = await stabilityPool.getDepositorYETIGain(account)
      assert.isTrue(YETIGain.gt(toBN('0')))
    }
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const gasResults = await th.withdrawFromSP_allAccounts(_10_Accounts, stabilityPool, dec(130, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // random amount
  it("", async () => {
    const message = 'withdrawFromSP(), no pending rewards. Stability Pool depositors make partial withdrawal - random YUSD amount, less than 180 YUSD deposit'
    await th.openTrove_allAccounts(_10_Accounts, contracts, dec(10, 'ether'), dec(130, 18))
    await th.provideToSP_allAccounts(_10_Accounts, stabilityPool, dec(130, 18))

    const gasResults = await th.withdrawFromSP_allAccounts_randomAmount(1, 129, _10_Accounts, stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })


  // // --- withdrawFromSP() ---

  // // --- Pending rewards in system ---

  // it("", async () => {
  //   const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - 90 YUSD of 130 YUSD deposit'
  //   // 10 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 180 YUSD to Stability Pool
  //   await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(130, 18))
  //   await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(130, 18))

  //   //1 acct open Trove with 1 ether and withdraws 170 YUSD
  //   await borrowerOperations.openTrove(_100pct, 0, accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })
  //   await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // Price drops, account[0]'s ICR falls below MCR
  //   await priceFeed.setPrice(dec(100, 18))
  //   await troveManager.liquidate(accounts[1], { from: accounts[0] })
  //   assert.isFalse(await sortedTroves.contains(accounts[1]))

  //   // Check accounts have YETI gains from liquidations
  //   for (account of accounts.slice(2, 12)) {
  //     const YETIGain = await stabilityPool.getDepositorYETIGain(account)
  //     assert.isTrue(YETIGain.gt(toBN('0')))
  //   }

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // 5 active Troves reduce their Stability Pool deposit by 90 YUSD
  //   const gasResults = await th.withdrawFromSP_allAccounts(accounts.slice(7, 12), stabilityPool, dec(90, 18))
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make full withdrawal - 130 YUSD of 130 YUSD deposit'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 180 YUSD to Stability Pool
    await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(130, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(130, 18))

    //1 acct open Trove with 1 ether and withdraws 170 YUSD
    await borrowerOperations.openTrove(_100pct, 0, accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })


    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[1]))

    // Check accounts have YETI gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const YETIGain = await stabilityPool.getDepositorYETIGain(account)
      assert.isTrue(YETIGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active Troves reduce their Stability Pool deposit by 130 YUSD
    const gasResults = await th.withdrawFromSP_allAccounts(accounts.slice(7, 12), stabilityPool, dec(130, 18))
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  it("", async () => {
    const message = 'withdrawFromSP(), pending rewards in system. Stability Pool depositors make partial withdrawal - random amount of YUSD'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 130 YUSD to Stability Pool
    await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(130, 18))
    await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(130, 18))

    //1 acct open Trove with 1 ether and withdraws 170 YUSD
    await borrowerOperations.openTrove(_100pct, 0, accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Price drops, account[0]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[1]))

    // Check accounts have YETI gains from liquidations
    for (account of accounts.slice(2, 12)) {
      const YETIGain = await stabilityPool.getDepositorYETIGain(account)
      assert.isTrue(YETIGain.gt(toBN('0')))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // 5 active Troves reduce their Stability Pool deposit by random amount
    const gasResults = await th.withdrawFromSP_allAccounts_randomAmount(1, 129, accounts.slice(7, 12), stabilityPool)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- withdrawETHGainToTrove() ---

  // --- withdrawETHGainToTrove() - deposit has pending rewards ---
  // it("", async () => {
  //   const message = 'withdrawETHGainToTrove(), pending rewards in system. Accounts withdraw 180 YUSD, provide 180 YUSD, then withdraw all to SP after a liquidation'
  //   // 10 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 130 YUSD to Stability Pool
  //   await th.openTrove_allAccounts(accounts.slice(2, 12), contracts, dec(10, 'ether'), dec(130, 18))
  //   await th.provideToSP_allAccounts(accounts.slice(2, 12), stabilityPool, dec(130, 18))

  //   //1 acct open Trove with 1 ether and withdraws 170 YUSD
  //   await borrowerOperations.openTrove(_100pct, 0, accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })
  //   await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // Price drops, account[0]'s ICR falls below MCR
  //   await priceFeed.setPrice(dec(100, 18))
  //   await troveManager.liquidate(accounts[1], { from: accounts[0] })
  //   assert.isFalse(await sortedTroves.contains(accounts[1]))

  //    // Check accounts have YETI gains from liquidations
  //    for (account of accounts.slice(2, 12)) {
  //     const YETIGain = await stabilityPool.getDepositorYETIGain(account)
  //     assert.isTrue(YETIGain.gt(toBN('0')))
  //   }

  //   await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

  //   // 5 active Troves withdraw their ETH gain to their trove
  //   const gasResults = await th.withdrawETHGainToTrove_allAccounts(accounts.slice(7, 12), contracts)
  //   th.logGasMetrics(gasResults, message)
  //   th.logAllGasCosts(gasResults)

  //   th.appendData(gasResults, message, data)
  // })

  it("", async () => {
    const message = 'withdrawETHGainToTrove(), pending rewards in system. Accounts withdraw 180 YUSD, provide a random amount, then withdraw all to SP after a liquidation'
    // 20 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 180 YUSD to Stability Pool
    await th.openTrove_allAccounts(accounts.slice(2, 22), contracts, dec(10, 'ether'), dec(130, 18))
    await await th.provideToSP_allAccounts_randomAmount(1, 129, accounts.slice(2, 22), stabilityPool)

    //1 acct open Trove with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, 0, accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
  
    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[1], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[1]))

       // Check accounts have YETI gains from liquidations
       for (account of accounts.slice(2, 22)) {
        const YETIGain = await stabilityPool.getDepositorYETIGain(account)
        assert.isTrue(YETIGain.gt(toBN('0')))
      }
  
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
  
    // 5 active Troves withdraw their ETH gain to their trove
    const gasResults = await th.withdrawETHGainToTrove_allAccounts(accounts.slice(2, 22), contracts)
    th.logGasMetrics(gasResults, message)
    th.logAllGasCosts(gasResults)

    th.appendData(gasResults, message, data)
  })

  // --- liquidate() ---

  // Pure redistribution WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Pure redistribution'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    //6s acct open Trove with 1 ether and withdraw 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(accounts.slice(0, 6), contracts, dec(1, 'ether'), dec(130, 18))
    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Initial distribution liquidations make system reward terms and Default Pool non-zero
    const tx1 = await troveManager.liquidate(accounts[2], { from: accounts[0] })
    // const gas1 = th.gasUsed(tx1)
    // th.logGas(gas1, message)
    const tx2 = await troveManager.liquidate(accounts[3], { from: accounts[0] })
    // const gas2 = th.gasUsed(tx2)
    // th.logGas(gas2, message)

    assert.isTrue(await sortedTroves.contains(accounts[1]))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx5 = await troveManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedTroves.contains(accounts[1]))
    const gas5 = th.gasUsed(tx5)
    th.logGas(gas5, message)

    th.appendData({ gas: gas5 }, message, data)
  })

  it("", async () => {
    const message = 'Series of liquidate() calls. Liquidee has pending rewards. Pure redistribution'
    // 100 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 200), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 200), contracts, dec(130, 18))

    const liquidationAcctRange = accounts.slice(1, 10)

    // Accts open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(liquidationAcctRange, contracts, dec(1, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(liquidationAcctRange, contracts, dec(130, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // All troves are liquidated
    for (account of liquidationAcctRange) {
      const hasPendingRewards = await troveManager.hasPendingRewards(account)
      console.log("Liquidee has pending rewards: " + hasPendingRewards)

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const tx = await troveManager.liquidate(account, { from: accounts[0] })
      assert.isFalse(await sortedTroves.contains(account))

      const gas = th.gasUsed(tx)
      th.logGas(gas, message)
    }

    // th.appendData({gas: gas}, message, data)
  })

  // Pure redistribution with NO pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has NO pending rewards. Pure redistribution'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    //2 acct open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(accounts.slice(2, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[3], ZERO_ADDRESS, { from: accounts[3] })

    // Price drops
    await priceFeed.setPrice(dec(100, 18))

    // Initial distribution liquidations make system reward terms and DefaultPool non-zero
    const tx1 = await troveManager.liquidate(accounts[2], { from: accounts[0] })
    const tx2 = await troveManager.liquidate(accounts[3], { from: accounts[0] })

    // Account 1 opens trove
    await borrowerOperations.openTrove(_100pct, dec(40, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(50, 18))

    assert.isTrue(await sortedTroves.contains(accounts[1]))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx3 = await troveManager.liquidate(accounts[1], { from: accounts[0] })

    assert.isFalse(await sortedTroves.contains(accounts[1]))
    const gas = th.gasUsed(tx3)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  it("", async () => {
    const message = 'Series of liquidate() calls. Liquidee has NO pending rewards. Pure redistribution'

    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    const liquidationAcctRange = accounts.slice(1, 20)

    for (account of liquidationAcctRange) {
      await priceFeed.setPrice(dec(200, 18))
      await borrowerOperations.openTrove(_100pct, dec(130, 18), account, ZERO_ADDRESS, { from: account, value: dec(1, 'ether') })

      const hasPendingRewards = await troveManager.hasPendingRewards(account)
      console.log("Liquidee has pending rewards: " + hasPendingRewards)

      await priceFeed.setPrice(dec(100, 18))

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

      const tx = await troveManager.liquidate(account, { from: accounts[0] })

      assert.isFalse(await sortedTroves.contains(account))

      const gas = th.gasUsed(tx)
      th.logGas(gas, message)
    }

    // th.appendData({gas: gas}, message, data)
  })

  // Pure offset with NO pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has NO pending rewards. Pure offset with SP'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    //3 acct open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(accounts.slice(0, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[3], ZERO_ADDRESS, { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 100 provides 600 YUSD to pool
    await borrowerOperations.withdrawYUSD(_100pct, dec(600, 18), accounts[100], ZERO_ADDRESS, { from: accounts[100] })
    await stabilityPool.provideToSP(dec(600, 18), ZERO_ADDRESS, { from: accounts[100] })

    // Initial liquidations - full offset - makes SP reward terms and SP non-zero
    await troveManager.liquidate(accounts[2], { from: accounts[0] })
    await troveManager.liquidate(accounts[3], { from: accounts[0] })

    const hasPendingRewards = await troveManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Account 1 liquidated - full offset
    const tx = await troveManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Pure offset WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Pure offset with SP'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    // 5 acct open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(accounts.slice(0, 5), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[3], ZERO_ADDRESS, { from: accounts[3] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[4], ZERO_ADDRESS, { from: accounts[4] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 100 provides 360 YUSD to SP
    await borrowerOperations.withdrawYUSD(_100pct, dec(600, 18), accounts[100], ZERO_ADDRESS, { from: accounts[100] })
    await stabilityPool.provideToSP(dec(360, 18), ZERO_ADDRESS, { from: accounts[100] })

    // Initial liquidations - full offset - makes SP reward terms and SP non-zero
    await troveManager.liquidate(accounts[2], { from: accounts[0] })
    await troveManager.liquidate(accounts[3], { from: accounts[0] })

    // Pure redistribution - creates pending dist. rewards for account 1
    await troveManager.liquidate(accounts[4], { from: accounts[0] })

    // Account 5 provides another 200 to the SP
    await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: accounts[100] })

    const hasPendingRewards = await troveManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Account 1 liquidated - full offset
    const tx = await troveManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Partial offset + redistribution WITH pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has pending rewards. Partial offset + redistribution'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    //4 acct open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(accounts.slice(0, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[3], ZERO_ADDRESS, { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Set up some "previous" liquidations triggering partial offsets, and pending rewards for all troves
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[100] })
    await troveManager.liquidate(accounts[2], { from: accounts[0] })

    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[101] })
    await troveManager.liquidate(accounts[3], { from: accounts[0] })

    // pool refilled with 100 YUSD
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[102] })

    const hasPendingRewards = await troveManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // account 1 180 YUSD liquidated  - partial offset
    const tx = await troveManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // Partial offset + redistribution with NO pending rewards
  it("", async () => {
    const message = 'Single liquidate() call. Liquidee has NO pending rewards. Partial offset + redistribution'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 110), contracts, dec(130, 18))

    //2 acct open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts(accounts.slice(2, 4), contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[2], ZERO_ADDRESS, { from: accounts[2] })
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[3], ZERO_ADDRESS, { from: accounts[3] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Set up some "previous" liquidations that trigger partial offsets, 
    //and create pending rewards for all troves
    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[100] })
    await troveManager.liquidate(accounts[2], { from: accounts[0] })

    await stabilityPool.provideToSP(dec(100, 18), ZERO_ADDRESS, { from: accounts[101] })
    await troveManager.liquidate(accounts[3], { from: accounts[0] })

    // Pool refilled with 50 YUSD
    await stabilityPool.provideToSP(dec(50, 18), ZERO_ADDRESS, { from: accounts[102] })

    // Account 1 opens trove
    await borrowerOperations.openTrove(_100pct, dec(30, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1], value: dec(1, 'ether') })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(50, 18))

    const hasPendingRewards = await troveManager.hasPendingRewards(accounts[1])
    console.log("Liquidee has pending rewards: " + hasPendingRewards)

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // account 1 70 YUSD liquidated  - partial offset against 50 YUSD in SP
    const tx = await troveManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // With pending dist. rewards and SP gains (still closes) - partial offset (Highest gas cost scenario in Normal Mode)
  it("", async () => {
    const message = 'liquidate() 1 Trove, liquidated Trove has pending SP rewards and redistribution rewards, offset + redistribution.'
    // 10 accts each open Trove with 10 ether
    await th.openTrove_allAccounts(accounts.slice(100, 110), contracts, dec(10, 'ether'), 0)

    //Account 99 and 98 each open Trove with 1 ether, and withdraw 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts([accounts[99]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[99], ZERO_ADDRESS, { from: accounts[99] })
    await th.openTrove_allAccounts([accounts[98]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[98], ZERO_ADDRESS, { from: accounts[98] })

    // Acct 99 deposits 1 YUSD to SP
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: accounts[99] })

    //Account 97 opens Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts([accounts[97]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[97], ZERO_ADDRESS, { from: accounts[97] })

    // Acct 100 withdraws 1800 YUSD and deposits it to the SP
    await borrowerOperations.withdrawYUSD(_100pct, dec(1750, 18), accounts[100], ZERO_ADDRESS, { from: accounts[100] })
    await stabilityPool.provideToSP(dec(1750, 18), ZERO_ADDRESS, { from: accounts[100] })

    // Price drops too $100, accounts 99 and 100 ICR fall below MCR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    /* Liquidate account 97. Account 97 is completely offset against SP and removed from system.
    This creates SP gains for accounts 99 and 7. */
    await troveManager.liquidate(accounts[97], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[97]))

    // Price rises again to 200
    await priceFeed.setPrice(dec(200, 18))

    // Acct 100 withdraws deposit and gains from SP
    await stabilityPool.withdrawFromSP(dec(1750, 18), { from: accounts[100] })

     // Price drops again to 100
     await priceFeed.setPrice(dec(100, 18))

    // Account 98 is liquidated, with nothing in SP pool.  This creates pending rewards from distribution.
    await troveManager.liquidate(accounts[98], { from: accounts[0] })

    // Account 7 deposits 1 YUSD in the Stability Pool
    await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: accounts[100] })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await troveManager.liquidate(accounts[99], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[99]))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // pure offset
  it("", async () => {
    const message = 'liquidate() 1 Trove Normal Mode, 30 active Troves, no ETH gain in pool, pure offset with SP'
    // 30 accts each open Trove with 10 ether, withdraw 180 YUSD, and provide 180 YUSD to Stability Pool
    await th.openTrove_allAccounts(accounts.slice(100, 130), contracts, dec(10, 'ether'), 0)
    await th.withdrawYUSD_allAccounts(accounts.slice(100, 130), contracts, dec(130, 18))

    await stabilityPool.provideToSP(dec(130, 18), ZERO_ADDRESS, { from: accounts[100] })

    //1 acct open Trove with 1 ether and withdraws 180 YUSD (inc gas comp)
    await th.openTrove_allAccounts([accounts[1]], contracts, dec(1, 'ether'), 0)
    await borrowerOperations.withdrawYUSD(_100pct, dec(130, 18), accounts[1], ZERO_ADDRESS, { from: accounts[1] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    
    const tx = await troveManager.liquidate(accounts[1], { from: accounts[0] })
    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- findInsertPosition ---

  // --- Insert at head, 0 traversals ---

  // it("", async () => {
  //   const message = 'findInsertPosition(), 10 Troves with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'

  //   // makes 10 Troves with ICRs 200 to 209%
  //   await th.makeTrovesIncreasingICR(_10_Accounts, contracts)

  //   // 300% ICR, higher than Trove at head of list
  //   const CR = web3.utils.toWei('3', 'ether')
  //   const address_0 = '0x0000000000000000000000000000000000000000'

  //   const price = await priceFeed.getPrice()
  //   const tx = await functionCaller.sortedTroves_findInsertPosition(CR, address_0, address_0)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'findInsertPosition(), 50 Troves with ICRs 200-209%, ICR > head ICR, no hint, 0 traversals'

  //   // makes 10 Troves with ICRs 200 to 209%
  //   await th.makeTrovesIncreasingICR(_50_Accounts, contracts)

  //   // 300% ICR, higher than Trove at head of list
  //   const CR = web3.utils.toWei('3', 'ether')
  //   const address_0 = '0x0000000000000000000000000000000000000000'

  //   const price = await priceFeed.getPrice()
  //   const tx = await functionCaller.sortedTroves_findInsertPosition(CR, price, address_0, address_0)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // // --- Insert at tail, so num. traversals = listSize ---

  // it("", async () => {
  //   const message = 'findInsertPosition(), 10 Troves with ICRs 200-209%, ICR < tail ICR, no hint, 10 traversals'

  //   // makes 10 Troves with ICRs 200 to 209%
  //   await th.makeTrovesIncreasingICR(_10_Accounts, contracts)

  //   // 200% ICR, lower than Trove at tail of list
  //   const CR = web3.utils.toWei('2', 'ether')
  //   const address_0 = '0x0000000000000000000000000000000000000000'

  //   const price = await priceFeed.getPrice()
  //   const tx = await functionCaller.sortedTroves_findInsertPosition(CR, price, address_0, address_0)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'findInsertPosition(), 20 Troves with ICRs 200-219%, ICR <  tail ICR, no hint, 20 traversals'

  //   // makes 20 Troves with ICRs 200 to 219%
  //   await th.makeTrovesIncreasingICR(_20_Accounts, contracts)

  //   // 200% ICR, lower than Trove at tail of list
  //   const CR = web3.utils.toWei('2', 'ether')

  //   const price = await priceFeed.getPrice()
  //   const tx = await functionCaller.sortedTroves_findInsertPosition(CR, price, address_0, address_0)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // it("", async () => {
  //   const message = 'findInsertPosition(), 50 Troves with ICRs 200-249%, ICR <  tail ICR, no hint, 50 traversals'

  //   // makes 50 Troves with ICRs 200 to 249%
  //   await th.makeTrovesIncreasingICR(_50_Accounts, contracts)

  //   // 200% ICR, lower than Trove at tail of list
  //   const CR = web3.utils.toWei('2', 'ether')

  //   const price = await priceFeed.getPrice()
  //   const tx = await functionCaller.sortedTroves_findInsertPosition(CR, price, address_0, address_0)
  //   const gas = th.gasUsed(tx) - 21000
  //   th.logGas(gas, message)

  //   th.appendData({ gas: gas }, message, data)
  // })

  // --- Write test output data to CSV file

  it("Export test data", async () => {
    fs.writeFile('gasTest/outputs/gasTestData.csv', data, (err) => {
      if (err) { console.log(err) } else {
        console.log("Gas test data written to gasTest/outputs/gasTestData.csv")
      }
    })
  })

})


/* TODO:
-Liquidations in Recovery Mode
---
Parameters to vary for gas tests:
- Number of accounts
- Function call parameters - low, high, random, average of many random
  -Pre-existing state:
  --- Rewards accumulated (or not)
  --- YUSD in StabilityPool (or not)
  --- State variables non-zero e.g. Trove already opened, stake already made, etc
  - Steps in the the operation:
  --- number of liquidations to perform
  --- number of troves to redeem from
  --- number of trials to run
  Extremes/edges:
  - Lowest or highest ICR
  - empty list, max size list
  - the only Trove, the newest Trove
  etc.
*/
