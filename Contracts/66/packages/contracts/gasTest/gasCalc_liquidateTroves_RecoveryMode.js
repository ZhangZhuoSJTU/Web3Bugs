/* Script that logs gas costs for Liquity operations under various conditions. 

  Note: uses Mocha testing structure, but the purpose of each test is simply to print gas costs.

  'asserts' are only used to confirm the setup conditions.
*/
const fs = require('fs')

const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const th = testHelpers.TestHelper
const dec = th.dec
const timeValues = testHelpers.TimeValues
const _100pct = th._100pct

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('Gas cost tests', async accounts => {
  const [owner] = accounts;
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let priceFeed
  let yusdToken

  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let contracts
  let data = []

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
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

    sYETI = YETIContracts.sYETI
    yetiToken = YETIContracts.yetiToken
    communityIssuance = YETIContracts.communityIssuance
    lockupContractFactory = YETIContracts.lockupContractFactory

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)
  })

  // --- liquidateTroves RECOVERY MODE - pure redistribution ---

  // 1 trove
  it("", async () => {
    const message = 'liquidateTroves(). n = 1. Pure redistribution, Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //1 accts open Trove with 1 ether and withdraw 100 YUSD
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openTrove_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))
    const price = await priceFeed.getPrice()

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 2. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //2 accts open Trove with 1 ether and withdraw 100 YUSD
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openTrove_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 3. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //3 accts open Trove with 1 ether and withdraw 100 YUSD
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openTrove_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 5. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //5 accts open Trove with 1 ether and withdraw 100 YUSD
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openTrove_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 10. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //10 accts open Trove with 1 ether and withdraw 100 YUSD
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openTrove_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  //20 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 20. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 90 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //20 accts open Trove with 1 ether and withdraw 100 YUSD
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openTrove_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 30. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 90 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //30 accts open Trove with 1 ether and withdraw 100 YUSD
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openTrove_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 40. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 90 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //40 accts open Trove with 1 ether and withdraw 100 YUSD
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulters' troves have been closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 45. Pure redistribution. Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //45 accts open Trove with 1 ether and withdraw 100 YUSD
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 100 YUSD
    await borrowerOperations.openTrove(_100pct, dec(60, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Price drops, defaulters' troves fall below MCR
    await priceFeed.setPrice(dec(100, 18))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    const tx = await troveManager.liquidateTroves(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check defaulters' troves have been closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate Troves --- RECOVERY MODE --- Full offset, NO pending distribution rewards ----

  // 1 trove
  it("", async () => {
    const message = 'liquidateTroves(). n = 1. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //1 acct opens Trove with 1 ether and withdraw 100 YUSD
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openTrove_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _1_Defaulter) {
      console.log(`ICR: ${await troveManager.getCurrentICR(account, price)}`)
      assert.isTrue(await th.ICRbetween100and110(account, troveManager, price))
    }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 2. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //2 acct opens Trove with 1 ether and withdraw 100 YUSD
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openTrove_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _2_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 3 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 3. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //3 accts open Trove with 1 ether and withdraw 100 YUSD
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openTrove_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _3_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves 
  it("", async () => {
    const message = 'liquidateTroves(). n = 5. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //5 accts open Trove with 1 ether and withdraw 100 YUSD
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openTrove_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _5_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 10 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 10. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //10 accts open Trove with 1 ether and withdraw 100 YUSD
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openTrove_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _10_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 20. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //30 accts open Trove with 1 ether and withdraw 100 YUSD
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openTrove_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _20_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 30 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 30. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //30 accts open Trove with 1 ether and withdraw 100 YUSD
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openTrove_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _30_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 40. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale, ZERO_ADDRESS,{ from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //40 accts open Trove with 1 ether and withdraw 100 YUSD
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _40_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 45. All fully offset with Stability Pool. No pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    //45 accts open Trove with 1 ether and withdraw 100 YUSD
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _45_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- liquidate Troves --- RECOVERY MODE --- Full offset, HAS pending distribution rewards ----

  // 1 trove
  it("", async () => {
    const message = 'liquidateTroves(). n = 1. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //1 acct opens Trove with 1 ether and withdraw 100 YUSD
    const _1_Defaulter = accounts.slice(1, 2)
    await th.openTrove_allAccounts(_1_Defaulter, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _1_Defaulter) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _1_Defaulter) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale, ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28),ZERO_ADDRESS,  { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _1_Defaulter) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(1, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // // Check Troves are closed
    for (account of _1_Defaulter) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 2 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 2. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //2 accts open Trove with 1 ether and withdraw 100 YUSD
    const _2_Defaulters = accounts.slice(1, 3)
    await th.openTrove_allAccounts(_2_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _2_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _2_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale, ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS,  { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _2_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(2, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _2_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))


    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 3 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 3. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //3 accts open Trove with 1 ether and withdraw 100 YUSD
    const _3_Defaulters = accounts.slice(1, 4)
    await th.openTrove_allAccounts(_3_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _3_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _3_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _3_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(3, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _3_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 5 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 5. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //5 accts open Trove with 1 ether and withdraw 100 YUSD
    const _5_Defaulters = accounts.slice(1, 6)
    await th.openTrove_allAccounts(_5_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _5_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _5_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _5_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(5, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _5_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 10 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 10. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //10 accts open Trove with 1 ether and withdraw 100 YUSD
    const _10_Defaulters = accounts.slice(1, 11)
    await th.openTrove_allAccounts(_10_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _10_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _10_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _10_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(10, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _10_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 20 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 20. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //20 accts open Trove with 1 ether and withdraw 100 YUSD
    const _20_Defaulters = accounts.slice(1, 21)
    await th.openTrove_allAccounts(_20_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _20_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _20_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _20_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(20, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _20_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 30 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 30. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //30 accts open Trove with 1 ether and withdraw 100 YUSD
    const _30_Defaulters = accounts.slice(1, 31)
    await th.openTrove_allAccounts(_30_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _30_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _30_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _30_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(30, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _30_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 40. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //40 accts open Trove with 1 ether and withdraw 100 YUSD
    const _40_Defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _40_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _40_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _40_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(40, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _40_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'liquidateTroves(). n = 45. All fully offset with Stability Pool. Has pending distribution rewards. In Recovery Mode'
    // 10 accts each open Trove with 10 ether, withdraw 900 YUSD
    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(900, 18))
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }

    //45 accts open Trove with 1 ether and withdraw 100 YUSD
    const _45_Defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_Defaulters, contracts, dec(1, 'ether'), dec(60, 18))

    // Check all defaulters are active
    for (account of _45_Defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 opens with 1 ether and withdraws 110 YUSD
    await borrowerOperations.openTrove(_100pct, dec(110, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })
    assert.isTrue(await sortedTroves.contains(accounts[500]))

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    assert.isFalse(await sortedTroves.contains(accounts[500]))
    await priceFeed.setPrice(dec(200, 18))

    // Check all defaulters have pending rewards 
    for (account of _45_Defaulters) { assert.isTrue(await troveManager.hasPendingRewards(account)) }

    // Whale opens trove and fills SP with 1 billion YUSD
    const whale = accounts[999]
    await borrowerOperations.openTrove(_100pct, dec(9, 28), whale,ZERO_ADDRESS, { from: whale, value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(9, 28), ZERO_ADDRESS, { from: whale })

    // Check SP has 9e28 YUSD
    const YUSDinSP = (await stabilityPool.getTotalYUSDDeposits()).toString()
    assert.equal(YUSDinSP, dec(9, 28))

    // Price drops, defaulters falls below MCR
    await priceFeed.setPrice(dec(120, 18))
    const price = await priceFeed.getPrice()

    // Check Recovery Mode is true
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check defaulter ICRs are all between 100% and 110%
    for (account of _45_Defaulters) { assert.isTrue(await th.ICRbetween100and110(account, troveManager, price)) }

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    // Liquidate troves
    const tx = await troveManager.liquidateTroves(45, { from: accounts[0] })
    assert.isTrue(tx.receipt.status)

    // Check Recovery Mode is true after liquidations
    assert.isTrue(await troveManager.checkRecoveryMode(await priceFeed.getPrice()))

    // Check Troves are closed
    for (account of _45_Defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    // Check initial troves with starting 10E/90YUSD, and whale's trove, are still open
    for (account of accounts.slice(101, 111)) { assert.isTrue(await sortedTroves.contains(account)) }
    assert.isTrue(await sortedTroves.contains(whale))

    //Check YUSD in SP has decreased but is still > 0
    const YUSDinSP_After = await stabilityPool.getTotalYUSDDeposits()
    assert.isTrue(YUSDinSP_After.lt(web3.utils.toBN(dec(9, 28))))
    assert.isTrue(YUSDinSP_After.gt(web3.utils.toBN('0')))

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // --- BatchLiquidateTroves ---

  // --- Pure redistribution, no offset. WITH pending distribution rewards ---

  // 10 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 10. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openTrove_allAccounts(_10_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await troveManager.batchLiquidateTroves(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 40 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 40. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await troveManager.batchLiquidateTroves(_40_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _40_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 45. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await troveManager.batchLiquidateTroves(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 50 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 50. Pure redistribution. Has pending distribution rewards.'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _50_defaulters = accounts.slice(1, 51)
    await th.openTrove_allAccounts(_50_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _50_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    const tx = await troveManager.batchLiquidateTroves(_50_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _50_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // --- batchLiquidateTroves - pure offset with Stability Pool ---

  // 10 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 10. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    const _10_defaulters = accounts.slice(1, 11)
    // --- Accounts to be liquidated in the test tx ---
    await th.openTrove_allAccounts(_10_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _10_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens trove and fills SP with 1 billion YUSD
    await borrowerOperations.openTrove(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })

    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await troveManager.batchLiquidateTroves(_10_defaulters, { from: accounts[0] })

    // Check all defaulters liquidated
    for (account of _10_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })


  // 40 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 40. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(10, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500], ZERO_ADDRESS,{ from: accounts[500], value: dec(1, 'ether') })


    // --- Accounts to be liquidated in the test tx ---
    const _40_defaulters = accounts.slice(1, 41)
    await th.openTrove_allAccounts(_40_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // Check all defaulters active
    for (account of _40_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens trove and fills SP with 1 billion YUSD
    await borrowerOperations.openTrove(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await troveManager.batchLiquidateTroves(_40_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _40_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 45 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 45. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _45_defaulters = accounts.slice(1, 46)
    await th.openTrove_allAccounts(_45_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _45_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens trove and fills SP with 1 billion YUSD
    await borrowerOperations.openTrove(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)

    const tx = await troveManager.batchLiquidateTroves(_45_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _45_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })

  // 50 troves
  it("", async () => {
    const message = 'batchLiquidateTroves(). n = 50. All troves fully offset. Have pending distribution rewards'
    // 10 accts each open Trove with 10 ether, withdraw 180 YUSD

    await th.openTrove_allAccounts(accounts.slice(101, 111), contracts, dec(10, 'ether'), dec(130, 18))

    // Account 500 opens with 1 ether and withdraws 180 YUSD
    await borrowerOperations.openTrove(_100pct, dec(130, 18), accounts[500],ZERO_ADDRESS, { from: accounts[500], value: dec(1, 'ether') })

    // --- Accounts to be liquidated in the test tx ---
    const _50_defaulters = accounts.slice(1, 51)
    await th.openTrove_allAccounts(_50_defaulters, contracts, dec(1, 'ether'), dec(130, 18))

    // check all defaulters active
    for (account of _50_defaulters) { assert.isTrue(await sortedTroves.contains(account)) }

    // Account 500 is liquidated, creates pending distribution rewards for all
    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[500], { from: accounts[0] })
    await priceFeed.setPrice(dec(200, 18))

    // Whale opens trove and fills SP with 1 billion YUSD
    await borrowerOperations.openTrove(_100pct, dec(1, 27), accounts[999],ZERO_ADDRESS, { from: accounts[999], value: dec(1, 27) })
    await stabilityPool.provideToSP(dec(1, 27), ZERO_ADDRESS, { from: accounts[999] })


    // Price drops, account[1]'s ICR falls below MCR
    await priceFeed.setPrice(dec(100, 18))

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider)
    
    const tx = await troveManager.batchLiquidateTroves(_50_defaulters, { from: accounts[0] })

    // check all defaulters liquidated
    for (account of _50_defaulters) { assert.isFalse(await sortedTroves.contains(account)) }

    const gas = th.gasUsed(tx)
    th.logGas(gas, message)

    th.appendData({ gas: gas }, message, data)
  })



  it("Export test data", async () => {
    fs.writeFile('gasTest/outputs/liquidateTrovesGasData.csv', data, (err) => {
      if (err) { console.log(err) } else {
        console.log("LiquidateTroves() gas test data written to gasTest/outputs/liquidateTrovesGasData.csv")
      }
    })
  })
})