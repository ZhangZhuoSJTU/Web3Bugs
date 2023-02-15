
const BN = require('bn.js')
const { BorrowerOperationsProxy } = require('./proxyHelpers')
const LockupContract = artifacts.require(("./LockupContract.sol"))
const Destructible = artifacts.require("./TestContracts/Destructible.sol")


const MoneyValues = {
  negative_5e17: "-" + web3.utils.toWei('500', 'finney'),
  negative_1e18: "-" + web3.utils.toWei('1', 'ether'),
  negative_10e18: "-" + web3.utils.toWei('10', 'ether'),
  negative_50e18: "-" + web3.utils.toWei('50', 'ether'),
  negative_100e18: "-" + web3.utils.toWei('100', 'ether'),
  negative_101e18: "-" + web3.utils.toWei('101', 'ether'),
  negative_eth: (amount) => "-" + web3.utils.toWei(amount, 'ether'),

  _zeroBN: web3.utils.toBN('0'),
  _1e18BN: web3.utils.toBN('1000000000000000000'),
  _10e18BN: web3.utils.toBN('10000000000000000000'),
  _100e18BN: web3.utils.toBN('100000000000000000000'),
  _100BN: web3.utils.toBN('100'),
  _110BN: web3.utils.toBN('110'),
  _150BN: web3.utils.toBN('150'),

  _MCR: web3.utils.toBN('1100000000000000000'),
  _ICR100: web3.utils.toBN('1000000000000000000'),
  _CCR: web3.utils.toBN('1500000000000000000'),
}

const TimeValues = {
  SECONDS_IN_ONE_MINUTE: 60,
  SECONDS_IN_ONE_HOUR: 60 * 60,
  SECONDS_IN_ONE_DAY: 60 * 60 * 24,
  SECONDS_IN_ONE_WEEK: 60 * 60 * 24 * 7,
  SECONDS_IN_SIX_WEEKS: 60 * 60 * 24 * 7 * 6,
  SECONDS_IN_ONE_MONTH: 60 * 60 * 24 * 30,
  SECONDS_IN_ONE_YEAR: 60 * 60 * 24 * 365,
  MINUTES_IN_ONE_WEEK: 60 * 24 * 30,
  MINUTES_IN_ONE_MONTH: 60 * 24 * 30,
  MINUTES_IN_ONE_YEAR: 60 * 24 * 365
}

class TestHelper {

  static dec(val, scale) {
    let zerosCount

    if (scale == 'ether') {
      zerosCount = 18
    } else if (scale == 'finney')
      zerosCount = 15
    else {
      zerosCount = scale
    }

    const strVal = val.toString()
    const strZeros = ('0').repeat(zerosCount)

    return strVal.concat(strZeros)
  }

  static squeezeAddr(address) {
    const len = address.length
    return address.slice(0, 6).concat("...").concat(address.slice(len - 4, len))
  }

  static getDifference(x, y) {
    const x_BN = web3.utils.toBN(x)
    const y_BN = web3.utils.toBN(y)

    return Number(x_BN.sub(y_BN).abs())
  }

  static assertIsApproximatelyEqual(x, y, error = 1000) {
    assert.isAtMost(this.getDifference(x, y), error)
  }

  static zipToObject(array1, array2) {
    let obj = {}
    array1.forEach((element, idx) => obj[element] = array2[idx])
    return obj
  }

  static getGasMetrics(gasCostList) {
    const minGas = Math.min(...gasCostList)
    const maxGas = Math.max(...gasCostList)

    let sum = 0;
    for (const gas of gasCostList) {
      sum += gas
    }

    if (sum === 0) {
      return {
        gasCostList: gasCostList,
        minGas: undefined,
        maxGas: undefined,
        meanGas: undefined,
        medianGas: undefined
      }
    }
    const meanGas = sum / gasCostList.length

    // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
    const sortedGasCostList = [...gasCostList].sort()
    const medianGas = (sortedGasCostList[Math.floor(sortedGasCostList.length / 2)])
    return { gasCostList, minGas, maxGas, meanGas, medianGas }
  }

  static getGasMinMaxAvg(gasCostList) {
    const metrics = th.getGasMetrics(gasCostList)

    const minGas = metrics.minGas
    const maxGas = metrics.maxGas
    const meanGas = metrics.meanGas
    const medianGas = metrics.medianGas

    return { minGas, maxGas, meanGas, medianGas }
  }

  static getEndOfAccount(account) {
    const accountLast2bytes = account.slice((account.length - 4), account.length)
    return accountLast2bytes
  }

  static randDecayFactor(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toFixed(18), 'ether')
    return amountInWei
  }

  static randAmountInWei(min, max) {
    const amount = Math.random() * (max - min) + min;
    const amountInWei = web3.utils.toWei(amount.toString(), 'ether')
    return amountInWei
  }

  static randAmountInGWei(min, max) {
    const amount = Math.floor(Math.random() * (max - min) + min);
    const amountInWei = web3.utils.toWei(amount.toString(), 'gwei')
    return amountInWei
  }

  static makeWei(num) {
    return web3.utils.toWei(num.toString(), 'ether')
  }

  static appendData(results, message, data) {
    data.push(message + `\n`)
    for (const key in results) {
      data.push(key + "," + results[key] + '\n')
    }
  }

  static getRandICR(min, max) {
    const ICR_Percent = (Math.floor(Math.random() * (max - min) + min))

    // Convert ICR to a duint
    const ICR = web3.utils.toWei((ICR_Percent * 10).toString(), 'finney')
    return ICR
  }

  static computeICR(coll, debt, price) {
    const collBN = web3.utils.toBN(coll)
    const debtBN = web3.utils.toBN(debt)
    const priceBN = web3.utils.toBN(price)

    const ICR = debtBN.eq(this.toBN('0')) ?
      this.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      : collBN.mul(priceBN).div(debtBN)

    return ICR
  }

  static async ICRbetween100and110(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account)
    return (ICR.gt(MoneyValues._ICR100)) && (ICR.lt(MoneyValues._MCR))
  }

  static async isUndercollateralized(account, troveManager, price) {
    const ICR = await troveManager.getCurrentICR(account)
    return ICR.lt(MoneyValues._MCR)
  }

  static toBN(num) {
    return web3.utils.toBN(num)
  }

  static gasUsed(tx) {
    const gas = tx.receipt.gasUsed
    return gas
  }

  static applyLiquidationFee(ethAmount) {
    return ethAmount.mul(this.toBN(this.dec(995, 15))).div(MoneyValues._1e18BN)
  }
  // --- Logging functions ---

  static logGasMetrics(gasResults, message) {
    console.log(
      `\n ${message} \n
      min gas: ${gasResults.minGas} \n
      max gas: ${gasResults.maxGas} \n
      mean gas: ${gasResults.meanGas} \n
      median gas: ${gasResults.medianGas} \n`
    )
  }

  static logAllGasCosts(gasResults) {
    console.log(
      `all gas costs: ${gasResults.gasCostList} \n`
    )
  }

  static logGas(gas, message) {
    console.log(
      `\n ${message} \n
      gas used: ${gas} \n`
    )
  }

  static async logActiveAccounts(contracts, n) {
    const count = await contracts.sortedTroves.getSize()
    const price = await contracts.priceFeedTestnet.getPrice()

    n = (typeof n == 'undefined') ? count : n

    let account = await contracts.sortedTroves.getLast()
    const head = await contracts.sortedTroves.getFirst()

    console.log(`Total active accounts: ${count}`)
    console.log(`First ${n} accounts, in ascending ICR order:`)

    let i = 0
    while (i < n) {
      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await contracts.troveManager.Troves(account))[1]
      const debt = (await contracts.troveManager.Troves(account))[0]
      const ICR = await contracts.troveManager.getCurrentICR(account)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)

      if (account == head) { break; }

      account = await contracts.sortedTroves.getPrev(account)

      i++
    }
  }

  static async logAccountsArray(accounts, troveManager, price, n) {
    const length = accounts.length

    n = (typeof n == 'undefined') ? length : n

    console.log(`Number of accounts in array: ${length}`)
    console.log(`First ${n} accounts of array:`)

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i]

      const squeezedAddr = this.squeezeAddr(account)
      const coll = (await troveManager.Troves(account))[1]
      const debt = (await troveManager.Troves(account))[0]
      const ICR = await troveManager.getCurrentICR(account)

      console.log(`Acct: ${squeezedAddr}  coll:${coll}  debt: ${debt}  ICR: ${ICR}`)
    }
  }

  static logBN(label, x) {
    x = x.toString().padStart(18, '0')
    // TODO: thousand separators
    const integerPart = x.slice(0, x.length - 18) ? x.slice(0, x.length - 18) : '0'
    console.log(`${label}:`, integerPart + '.' + x.slice(-18))
  }

  // --- TCR and Recovery Mode functions ---

  // These functions use the PriceFeedTestNet view price function getPrice() which is sufficient for testing.
  // the mainnet contract PriceFeed uses fetchPrice, which is non-view and writes to storage.

  // To checkRecoveryMode / getTCR from the Liquity mainnet contracts, pass a price value - this can be the lastGoodPrice
  // stored in Liquity, or the current Chainlink ETHUSD price, etc.


  static async checkRecoveryMode(contracts) {
    return contracts.troveManager.checkRecoveryMode()
  }

  static async getTCR(contracts) {
    return contracts.troveManager.getTCR()
  }

  // --- Gas compensation calculation functions ---

  // Given a composite debt, returns the actual debt  - i.e. subtracts the virtual debt.
  // Virtual debt = 50 YUSD.
  static async getActualDebtFromComposite(compositeDebt, contracts) {

    const issuedDebt = await contracts.troveManager.getActualDebtFromComposite(compositeDebt);

    return issuedDebt
  }

  // Adds the gas compensation (50 YUSD) (Why does say 50 here? - from @RoboYeti)
  static async getCompositeDebt(contracts, debt) {
    const compositeDebt = contracts.borrowerOperations.getCompositeDebt(debt)
    return compositeDebt
  }

  static async getTroveEntireColl(contracts, trove) {
    return (await contracts.troveManager.getEntireDebtAndColls(trove))[2]
  }

  static async getTroveEntireTokens(contracts, trove) {
    return (await contracts.troveManager.getEntireDebtAndColls(trove))[1]
  }

  static async getTroveEntireDebt(contracts, trove) {
    return this.toBN((await contracts.troveManager.getEntireDebtAndColls(trove))[0])
  }

  static async getTroveStake(contracts, trove) {
    return (contracts.troveManager.getTroveStake(trove))
  }

  /*
   * given the requested YUSD amomunt in openTrove, returns the total debt
   * So, it adds the gas compensation and the borrowing fee
   */
  static async getOpenTroveTotalDebt(contracts, yusdAmount) {
    const fee = await contracts.troveManager.getBorrowingFee(yusdAmount)
    // console.log("Fee " + fee)
    const compositeDebt = await this.getCompositeDebt(contracts, yusdAmount)
    // console.log("Composite debt " + compositeDebt)
    return compositeDebt.add(fee)
  }

  /*
   * given the desired total debt, returns the YUSD amount that needs to be requested in openTrove
   * So, it subtracts the gas compensation and then the borrowing fee
   */
  static async getOpenTroveYUSDAmount(contracts, totalDebt) {
    const actualDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    return this.getNetBorrowingAmount(contracts, actualDebt)
  }

  // Subtracts the borrowing fee
  static async getNetBorrowingAmount(contracts, debtWithFee) {
    const borrowingRate = await contracts.troveManager.getBorrowingRateWithDecay()

    // console.log("Numerator", (this.toBN(debtWithFee).mul(MoneyValues._1e18BN)).toString());
    return this.toBN(debtWithFee).mul(MoneyValues._1e18BN).div(MoneyValues._1e18BN.add(borrowingRate))
  }

  // Adds the borrowing fee
  static async getAmountWithBorrowingFee(contracts, yusdAmount) {
    const fee = await contracts.troveManager.getBorrowingFee(yusdAmount)
    return yusdAmount.add(fee)
  }

  // Adds the redemption fee
  static async getRedemptionGrossAmount(contracts, expected) {
    const redemptionRate = await contracts.troveManager.getRedemptionRate()
    return expected.mul(MoneyValues._1e18BN).div(MoneyValues._1e18BN.add(redemptionRate))
  }

  // Get's total collateral minus total gas comp, for a series of troves.
  static async getExpectedTotalCollMinusTotalGasComp(troveList, contracts) {
    let totalCollRemainder = web3.utils.toBN('0')

    for (const trove of troveList) {
      const remainingColl = this.getCollMinusGasComp(trove, contracts)
      totalCollRemainder = totalCollRemainder.add(remainingColl)
    }
    return totalCollRemainder
  }

  static getEmittedSumValues(sumTX) {
    const log = sumTX.logs[0];
    return [sumTX.logs[0].args[0], sumTX.logs[0].args[1]];
  }

  static getEmittedRedemptionValues(redemptionTx) {
    for (let i = 0; i < redemptionTx.logs.length; i++) {
      if (redemptionTx.logs[i].event === "Redemption") {
        const attemptedYUSDAmount = redemptionTx.logs[i].args[0]
        const actualYUSDAmount = redemptionTx.logs[i].args[1]
        const YUSDFee = redemptionTx.logs[i].args[2]
        const tokensRedeemed = redemptionTx.logs[i].args[3]
        const amountsRedeemed = redemptionTx.logs[i].args[4]

        return [attemptedYUSDAmount, actualYUSDAmount, YUSDFee, tokensRedeemed, amountsRedeemed]
      }
    }
    throw ("The transaction logs do not contain a redemption event")
  }

  // @RoboYeti: added new functino to be use dto get multi-collateral liquidation values
  static getEmittedLiquidationValuesMulti(liquidationTx) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        const liquidatedDebt = liquidationTx.logs[i].args[0]
        const yusdGasComp = liquidationTx.logs[i].args[1]
        const liquidatedCollTokens = liquidationTx.logs[i].args[2]
        const liquidatedCollAmounts = liquidationTx.logs[i].args[3]
        const totalCollGasCompTokens = liquidationTx.logs[i].args[4]
        const totalCollGasCompAmounts = liquidationTx.logs[i].args[5]


        return [liquidatedDebt, yusdGasComp, liquidatedCollTokens, liquidatedCollAmounts, totalCollGasCompTokens, totalCollGasCompAmounts]

      }
    }
    throw ("The transaction logs do not contain a liquidation event")
  }

  // @RoboYeti: changed this to fit one collateral-type test cases.
  static getEmittedLiquidationValues(liquidationTx, tokenIDX) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        const liquidatedDebt = liquidationTx.logs[i].args[0]
        const yusdGasComp = liquidationTx.logs[i].args[1]
        const liquidatedCollTokens = liquidationTx.logs[i].args[2]
        const liquidatedCollAmounts = liquidationTx.logs[i].args[3]
        const totalCollGasCompTokens = liquidationTx.logs[i].args[4]
        const totalCollGasCompAmounts = liquidationTx.logs[i].args[5]


        return [liquidatedDebt, liquidatedCollAmounts[tokenIDX], totalCollGasCompAmounts[tokenIDX]]

      }
    }
    throw ("The transaction logs do not contain a liquidation event")
  }

  // static async sumLiquidationAmounts(collTokens1, collAmounts1, collTokens2, collAmounts2, collTokens3, collAmounts3) {
  //   const addition1 = await contracts.borrowerOperations.sumColls(collTokens1, collAmounts1, collTokens2, collAmounts2)
  //   const addition2 = await contracts.borrowerOperations.sumColls(addition1[0], addition1[1], collTokens3, collAmounts3)
  //   return addition2
  //   // return
  //   // let totalColl = []
  //   // for (let i = 0; i < collTokens.length; i++) {
  //   //   totalColl.push(toBN(0))
  //   // }
  //   // let totalColl = web3.utils.toBN('0')
  //   // for (let i = 0; i < collTokens.length; i++) {
  //   //   totalColl.push(this.toBN(collAmounts1[i]).add(this.toBN(collAmounts2[i]).add(this.toBN(collAmounts3[i]))))
  //   // }
  //   // return totalColl
  // }

  static getEmittedLiquidatedDebt(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 0)  // LiquidatedDebt is position 0 in the Liquidation event
  }

  static getEmittedLiquidatedColl(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 1) // LiquidatedColl is position 1 in the Liquidation event
  }

  static getEmittedGasComp(liquidationTx) {
    return this.getLiquidationEventArg(liquidationTx, 2) // GasComp is position 2 in the Liquidation event
  }

  static getLiquidationEventArg(liquidationTx, arg) {
    for (let i = 0; i < liquidationTx.logs.length; i++) {
      if (liquidationTx.logs[i].event === "Liquidation") {
        return liquidationTx.logs[i].args[arg]
      }
    }

    throw ("The transaction logs do not contain a liquidation event")
  }

  static getYUSDFeeFromYUSDBorrowingEvent(tx) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === "YUSDBorrowingFeePaid") {
        return (tx.logs[i].args[1]).toString()
      }
    }
    throw ("The transaction logs do not contain an YUSDBorrowingFeePaid event")
  }

  static getEventArgByIndex(tx, eventName, argIndex) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        return tx.logs[i].args[argIndex]
      }
    }
    throw (`The transaction logs do not contain event ${eventName}`)
  }

  static getEventArgByName(tx, eventName, argName) {
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        const keys = Object.keys(tx.logs[i].args)
        for (let j = 0; j < keys.length; j++) {
          if (keys[j] === argName) {
            return tx.logs[i].args[keys[j]]
          }
        }
      }
    }

    throw (`The transaction logs do not contain event ${eventName} and arg ${argName}`)
  }

  static getAllEventsByName(tx, eventName) {
    const events = []
    for (let i = 0; i < tx.logs.length; i++) {
      if (tx.logs[i].event === eventName) {
        events.push(tx.logs[i])
      }
    }
    return events
  }

  static getDebtAndCollFromTroveUpdatedEvents(troveUpdatedEvents, address) {
    const event = troveUpdatedEvents.filter(event => event.args[0] === address)[0]
    return [event.args[1], event.args[2]]
  }

  static async getBorrowerOpsListHint(contracts, newColl, newDebt) {
    const newNICR = await contracts.hintHelpers.computeNominalCR(newColl, newDebt)
    const {
      hintAddress: approxfullListHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(newNICR, 5, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const { 0: upperHint, 1: lowerHint } = await contracts.sortedTroves.findInsertPosition(newNICR, approxfullListHint, approxfullListHint)
    return { upperHint, lowerHint }
  }

  static async getEntireCollAndDebt(contracts, account) {
    // console.log(`account: ${account}`)
    let wethIDX = await contracts.whitelist.getIndex(contracts.weth.address)
    const rawColl = (await contracts.troveManager.getTroveColls(account))[1][wethIDX]
    const rawDebt = (await contracts.troveManager.getTroveDebt(account))
    const pendingETHReward = (await contracts.troveManager.getPendingCollRewards(account))[1][wethIDX]
    const pendingYUSDDebtReward = await contracts.troveManager.getPendingYUSDDebtReward(account)
    const entireColl = rawColl.add(pendingETHReward)
    const entireDebt = rawDebt.add(pendingYUSDDebtReward)

    return { entireColl, entireDebt }
  }

  static async getCollAndDebtFromAddColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl.add(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawColl(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)
    // console.log(`entireColl  ${entireColl}`)
    // console.log(`entireDebt  ${entireDebt}`)

    const newColl = entireColl.sub(this.toBN(amount))
    const newDebt = entireDebt
    return { newColl, newDebt }
  }

  static async getCollAndDebtFromWithdrawYUSD(contracts, account, amount) {
    const fee = await contracts.troveManager.getBorrowingFee(amount)
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.add(this.toBN(amount)).add(fee)

    return { newColl, newDebt }
  }

  static async getCollAndDebtFromRepayYUSD(contracts, account, amount) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    const newColl = entireColl
    const newDebt = entireDebt.sub(this.toBN(amount))

    return { newColl, newDebt }
  }

  static async getCollAndDebtFromAdjustment(contracts, account, ETHChange, YUSDChange) {
    const { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)

    // const coll = (await contracts.troveManager.Troves(account))[1]
    // const debt = (await contracts.troveManager.Troves(account))[0]

    const fee = YUSDChange.gt(this.toBN('0')) ? await contracts.troveManager.getBorrowingFee(YUSDChange) : this.toBN('0')
    const newColl = entireColl.add(ETHChange)
    const newDebt = entireDebt.add(YUSDChange).add(fee)

    return { newColl, newDebt }
  }


  // --- BorrowerOperations gas functions ---

  static async openTrove_allAccounts(accounts, contracts, ETHAmount, YUSDAmount) {
    const gasCostList = []
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, YUSDAmount)

    for (const account of accounts) {
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, ETHAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, YUSDAmount, upperHint, lowerHint, { from: account, value: ETHAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomETH(minETH, maxETH, accounts, contracts, YUSDAmount) {
    const gasCostList = []
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, YUSDAmount)

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, YUSDAmount, upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomETH_ProportionalYUSD(minETH, maxETH, accounts, contracts, proportion) {
    const gasCostList = []

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      const proportionalYUSD = (web3.utils.toBN(proportion)).mul(web3.utils.toBN(randCollAmount))
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, proportionalYUSD)

      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, proportionalYUSD, upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomETH_randomYUSD(minETH, maxETH, accounts, contracts, minYUSDProportion, maxYUSDProportion, logging = false) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()
    const _1e18 = web3.utils.toBN('1000000000000000000')

    let i = 0
    for (const account of accounts) {

      const randCollAmount = this.randAmountInWei(minETH, maxETH)
      // console.log(`randCollAmount ${randCollAmount }`)
      const randYUSDProportion = this.randAmountInWei(minYUSDProportion, maxYUSDProportion)
      const proportionalYUSD = (web3.utils.toBN(randYUSDProportion)).mul(web3.utils.toBN(randCollAmount).div(_1e18))
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, proportionalYUSD)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, randCollAmount, totalDebt)

      const feeFloor = this.dec(5, 16)
      const tx = await contracts.borrowerOperations.openTrove(this._100pct, proportionalYUSD, upperHint, lowerHint, { from: account, value: randCollAmount })

      if (logging && tx.receipt.status) {
        i++
        const ICR = await contracts.troveManager.getCurrentICR(account)
        // console.log(`${i}. Trove opened. addr: ${this.squeezeAddr(account)} coll: ${randCollAmount} debt: ${proportionalYUSD} ICR: ${ICR}`)
      }
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_randomYUSD(minYUSD, maxYUSD, accounts, contracts, ETHAmount) {
    const gasCostList = []

    for (const account of accounts) {
      const randYUSDAmount = this.randAmountInWei(minYUSD, maxYUSD)
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, randYUSDAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, ETHAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, randYUSDAmount, upperHint, lowerHint, { from: account, value: ETHAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async closeTrove_allAccounts(accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const tx = await contracts.borrowerOperations.closeTrove({ from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async openTrove_allAccounts_decreasingYUSDAmounts(accounts, contracts, ETHAmount, maxYUSDAmount) {
    const gasCostList = []

    let i = 0
    for (const account of accounts) {
      const YUSDAmount = (maxYUSDAmount - i).toString()
      const YUSDAmountWei = web3.utils.toWei(YUSDAmount, 'ether')
      const totalDebt = await this.getOpenTroveTotalDebt(contracts, YUSDAmountWei)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, ETHAmount, totalDebt)

      const tx = await contracts.borrowerOperations.openTrove(this._100pct, YUSDAmountWei, upperHint, lowerHint, { from: account, value: ETHAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      i += 1
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addCollateralToWhitelist(whitelist, params) {
    await whitelist.addCollateral(
      params._collateral,
      params._minRatio,
      params._oracle,
      params._decimals,
      params._priceCurve, 
      false,
      params._router
    );
    const validCollateral = await whitelist.getValidCollateral();
  }

  static async openTrove(contracts, {
    maxFeePercentage,
    extraYUSDAmount,
    upperHint,
    lowerHint,
    ICR,
    token,
    oracle,
    extraParams
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
    else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS
    if (!token) token = contracts.weth
    if (!oracle) oracle = contracts.priceFeedETH
    const account = extraParams.from

    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    const yusdAmount = MIN_DEBT.add(extraYUSDAmount)


    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(15, 17)) // 150%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    // debt taken out = yusdAmount
    // totalDebt = debt taken out + fee + gas compensation
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
    // netDebt = totalDebt - gas compensation
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)

    const price = await oracle.getPrice()
    
    let collateral
    let tx
    // console.log("Price:", this.toNormalBase(price).toString());
    // console.log("Collateral Amount", this.toNormalBase(collateralAmount).toString());
    // console.log("VC of collateral", this.toNormalBase(collateralVC).toString());
    // console.log("Total debt " + this.toNormalBase(totalDebt).toString());
    // console.log("netDebt", this.toNormalBase(netDebt).toString());
    // console.log("Open trove at ICR=", this.toNormalBase(ICR).toString());
    // console.log("");

    if (ICR) {
      const collateralAmount = ICR.mul(totalDebt).div(price).div(this.toBN(this.dec(1, this.toBN(18).sub(await token.decimals()))))
      collateral = collateralAmount

    } else {
      collateral = extraParams.value
      
    }
    const tokenMintedSuccessfully = await this.addERC20(token, account, contracts.borrowerOperations.address, collateral, { from: account })
    assert.isTrue(tokenMintedSuccessfully);
    extraParams.value = 0;
    // console.log("YUSD Amount (minDebt + extra YUSD amount)", yusdAmount.toString())
    tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, yusdAmount, upperHint, lowerHint, [token.address], [collateral], extraParams)
    
    // mint weth for from account (in extra params) and approve borrowerOperations to use it
    
        // await contracts.weth.mint(account, collateralAmount)
    // const mintedWETH = await contracts.weth.balanceOf(account)
    // // console.log("WETH MINTED:", (mintedWETH.div(this.toBN(10 ** 18))).toNumber());

    // // console.log("collateral amount " + collateralAmount)
    // await contracts.weth.approve(contracts.borrowerOperations.address, collateralAmount, extraParams);
    // const approvedWETH = await contracts.weth.allowance(account, contracts.borrowerOperations.address)
    // // console.log("WETH APPROVED:", (approvedWETH.div(this.toBN(10 ** 18))).toNumber());
    
    return {
      yusdAmount,
      netDebt,
      totalDebt,
      ICR,
      collateral: collateral,
      tx
    }
  }

  static async test(contracts, signer, wtoken, amount) {
    const tx = await contracts.borrowerOperations.openTrove(
      this._100pct,
      this.toBN(this.dec(2000, 18)),
      this.ZERO_ADDRESS,
      this.ZERO_ADDRESS,
      [wtoken], [amount.toString()],
      { from: signer }
      )
  }

  static async openTroveWithJLPManual(contracts, {
    Zapper,
    token,
    AVAXIn,
    signer
  }) {

    await Zapper.zapIn(token.address, {value: AVAXIn});
    const tokenBalance = await token.balanceOf(signer);
    const WToken = contracts.wJLP;
    await token.approve(WToken.address, tokenBalance);
    await WToken.wrap(tokenBalance, signer, signer, signer);
    const wTokenBalance = await WToken.balanceOf(signer);
    await WToken.approve(contracts.borrowerOperations.address, wTokenBalance);
    const approval = await WToken.allowance(signer, contracts.borrowerOperations.address);
    console.log("Approval", approval.toString());

    console.log("W Token address", WToken.address);
    assert.equal(wTokenBalance.toString(), tokenBalance.toString());
    console.log("Signer", signer);
    console.log(wTokenBalance.toString());
    console.log(tokenBalance.toString());

    const tx = await contracts.borrowerOperations.openTrove(this._100pct, this.toBN(this.dec(20000, 18)), this.ZERO_ADDRESS, this.ZERO_ADDRESS, [WToken.address], [tokenBalance], { from: signer })
    console.log(tx);

    const debt = await contracts.troveManager.getTroveDebt(signer);

    console.log("Debt", debt.toString());
    console.log(tx);

    return {
      yusdAmount: "1000000",
      collateral: tokenBalance,
      tx
    }
  }

  static async openTroveWithJLP(contracts, {
    Zapper,
    token,
    AVAXIn,
    signer,
    maxFeePercentage,
    extraYUSDAmount,
    upperHint,
    lowerHint,
    ICR,
    extraParams
  }) {


    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
    else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    const WToken = contracts.wJLP
    const oracle = contracts.priceFeedJLP
    const account = extraParams.from
    console.log("Account", account);

    await Zapper.zapIn(token.address, {value: AVAXIn});
    const tokenBalance = await token.balanceOf(signer);

    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    const yusdAmount = MIN_DEBT.add(extraYUSDAmount)


    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(15, 17)) // 150%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    // debt taken out = yusdAmount
    // totalDebt = debt taken out + fee + gas compensation
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
    // netDebt = totalDebt - gas compensation
    //const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)

    const price = await oracle.getPrice()

    let collateral
    let tx

    if (ICR) {
      const collateralAmount = ICR.mul(totalDebt).div(price).div(this.toBN(this.dec(1, this.toBN(this.toBN(this.dec(18, 0)).sub(await token.decimals())))))
      collateral = collateralAmount

    } else {
      collateral = extraParams.value
    }

    await token.approve(WToken.address, collateral, extraParams)
    const tokenAllowance = await token.allowance(extraParams.from, WToken.address);
    console.log("Token Allowance", tokenAllowance.toString());

    console.log(1)
    await WToken.wrap(collateral, account, account, account)
    console.log(1)
    await WToken.approve(borrowerOperations.address, collateral, extraParams);


    tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, yusdAmount, upperHint, lowerHint, [WToken.address], [collateral], extraParams)

    return {
      yusdAmount,
      totalDebt,
      ICR,
      collateral: collateral,
      tx
    }
  }


  static async openTroveWithToken(contracts, token, {
    maxFeePercentage,
    extraYUSDAmount,
    upperHint,
    lowerHint,
    ICR,
    extraParams
  }) {

    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
    else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    const account = extraParams.from

    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    const yusdAmount = MIN_DEBT.add(extraYUSDAmount)


    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(15, 17)) // 150%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)

    // if (ICR) {
    const price = await contracts.priceFeedETH.getPrice()
    const collateralAmount = ICR.mul(totalDebt).div(price)
    const collateralVC = await contracts.whitelist.getValueVC(contracts.weth.address, collateralAmount);

    // console.log("Price:", this.toNormalBase(price).toString());
    // console.log("Collateral Amount", this.toNormalBase(collateralAmount).toString());
    // console.log("VC of collateral", this.toNormalBase(collateralVC).toString());
    // console.log("Total debt " + this.toNormalBase(totalDebt).toString());
    // console.log("netDebt", this.toNormalBase(netDebt).toString());
    // console.log("Open trove at ICR=", this.toNormalBase(ICR).toString());
    // console.log("");

    extraParams.value = 0;

    // mint weth for from account (in extra params) and approve borrowerOperations to use it
    const tokenMint = await this.addERC20(token, account, contracts.borrowerOperations.address, collateralAmount, { from: account })
    assert.isTrue(tokenMint);
        // await contracts.weth.mint(account, collateralAmount)
    // const mintedWETH = await contracts.weth.balanceOf(account)
    // // console.log("WETH MINTED:", (mintedWETH.div(this.toBN(10 ** 18))).toNumber());

    // // console.log("collateral amount " + collateralAmount)
    // await contracts.weth.approve(contracts.borrowerOperations.address, collateralAmount, extraParams);
    // const approvedWETH = await contracts.weth.allowance(account, contracts.borrowerOperations.address)
    // // console.log("WETH APPROVED:", (approvedWETH.div(this.toBN(10 ** 18))).toNumber());
    const tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, yusdAmount, upperHint, lowerHint, [contracts.weth.address], [collateralAmount], extraParams)
    return {
      yusdAmount,
      netDebt,
      totalDebt,
      ICR,
      collateral: collateralAmount,
      tx
    }
  }

  // replacing old addColl calls, mints some collateral and adds it to account
  static async addColl(contracts, collateralAmount, account) {
    // mint weth for Alice and approve borrowerOperations to use it
    await contracts.weth.mint(account, collateralAmount)
    await contracts.weth.approve(contracts.borrowerOperations.address, collateralAmount, {from: account})
    await contracts.borrowerOperations.addColl([contracts.weth.address], [collateralAmount], account, account,  this._100pct, {from: account})
  }

  static printColls(name, tokens, amounts) {
    console.log(name + ":")
    for (let i = 0; i < tokens.length; i++) {
      console.log("token " + (i+1) + " address " + tokens[i] + " with amount " + amounts[i])
    }
  }

  static async assertCollateralsEqual(tokens1, amounts1, tokens2, amounts2) {
    // this.printColls(tokens1, amounts1)
    // this.printColls(tokens2, amounts2)
    for (let i = 0; i < tokens1.length; i++) {
      const token1 = tokens1[i]
      const amount1 = this.toBN(amounts1[i])
      let found = false
      for (let j = 0; j < tokens2.length; j++) {
        const token2 = tokens2[j]
        const amount2 = this.toBN(amounts2[j])
        if (token1 == token2) {
          if (amount1.eq(amount2)) {
            found = true
            break
          } else {
            console.log("Token " + token1 + " amounts don't match: " + amount1 + " vs " + amount2)
            return false
          }
        }
      }
      if (!found) {
        console.log("Token " + token1 + " not found in second list")
        return false
      }
    }
    return true
  }

  // Same as assertCollateralsEqual but with tokens1 to be the whitelist tokens (or some larger list)
  // Only checks collisions with tokens2, ok if tokens2 does not contain that one. 
  static async leftAssertCollateralsEqual(tokens1, amounts1, tokens2, amounts2) {
    for (let i = 0; i < tokens1.length; i++) {
      const token1 = tokens1[i]
      const amount1 = this.toBN(amounts1[i])
      for (let j = 0; j < tokens2.length; j++) {
        const token2 = tokens2[j]
        const amount2 = this.toBN(amounts2[j])
        if (token1 == token2) {
          if (amount1.eq(amount2)) {
            break
          } else {
            console.log("Token " + token1 + " amounts don't match: " + amount1 + " vs " + amount2)
            return false
          }
        }
      }
    }
    return true
  }

  // static async openTroveWithColls(contracts, {
  //   maxFeePercentage,
  //   extraYUSDAmount,
  //   upperHint,
  //   lowerHint,
  //   ICR,
  //   extraParams
  // }) {
  //   if (!maxFeePercentage) maxFeePercentage = this._100pct
  //   if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
  //   else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
  //   if (!upperHint) upperHint = this.ZERO_ADDRESS
  //   if (!lowerHint) lowerHint = this.ZERO_ADDRESS

  //   const account = extraParams.from

  //   const MIN_DEBT = (
  //     await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
  //   ).add(this.toBN(1)) // add 1 to avoid rounding issues
  //   const yusdAmount = MIN_DEBT.add(extraYUSDAmount)


  //   if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(15, 17)) // 150%
  //   else if (typeof ICR == 'string') ICR = this.toBN(ICR)

  //   const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
  //   const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)

  //   // if (ICR) {
  //   // const price = await contracts.priceFeedTestnet.getPrice()
  //   // const collateralAmount = ICR.mul(totalDebt).div(price)

  //   extraParams.value = 0;

  //   // await contracts.weth.mint(account, collateralAmount)
  //   // const mintedWETH = await contracts.weth.balanceOf(account)
  //   // // console.log("WETH MINTED:", (mintedWETH.div(this.toBN(10 ** 18))).toNumber());

  //   // // console.log("collateral amount " + collateralAmount)
  //   // await contracts.weth.approve(contracts.borrowerOperations.address, collateralAmount, extraParams);
  //   // const approvedWETH = await contracts.weth.allowance(account, contracts.borrowerOperations.address)
  //   // // console.log("WETH APPROVED:", (approvedWETH.div(this.toBN(10 ** 18))).toNumber());

  //   const tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, 
  //     extraParams._yusdAmount, upperHint, lowerHint, extraParams._colls, extraParams._amounts, extraParams)

  //   return {
  //     yusdAmount: extraParams._yusdAmount,
  //     netDebt,
  //     totalDebt,
  //     ICR,
  //     collateral: extraParams._colls,
  //     tx
  //   }
  // }

  static async openTrove2(contracts, {
    WJLPIn: finalWJLPBalance,
    signer: harry
  }) {
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1))
  }

  // mints amounts of given colls to from and then opens trove with those colls while taking out
  // debt of extraYUSDAmount
  static async openTroveWithColls(contracts, {
    maxFeePercentage,
    extraYUSDAmount,
    upperHint,
    lowerHint,
    ICR,
    colls,
    amounts,
    oracles,
    from
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
    else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    const account = from
    let yusdAmount
    const collsAddress = []
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    yusdAmount = MIN_DEBT.add(extraYUSDAmount)

    if (!ICR) ICR = this.toBN(this.dec(15, 17)) // 150%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    for (let i = 0; i < colls.length; i++) {
      collsAddress.push(colls[i].address)
    }
    const totalVC = await contracts.troveManager.getVC(collsAddress, amounts)

    for (let i = 0; i < colls.length; i++) {
      const VC = (await contracts.whitelist.getValueVC(collsAddress[i], amounts[i]))

      console.log("totalVC: ", totalVC.toString(), "VC: ", VC.toString())
      const price = await (oracles[i]).getPrice()
      if (ICR) {
        amounts[i] = ICR.mul(totalDebt).div(price).mul(VC).div(totalVC)
      } 

      await this.addERC20(colls[i], account, contracts.borrowerOperations.address, amounts[i], { from: account })
      
    }

    let tx    
    
    console.log("YUDS Amount: ", yusdAmount.toString())
    tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, yusdAmount, upperHint, lowerHint, collsAddress, amounts, {from: from})
    

    
    return {
      yusdAmount,
      netDebt,
      totalDebt,
      ICR,
      totalVC,
      amounts,
      tx
    }
  }

  static async openTroveWithCollsOld(contracts, {
    maxFeePercentage,
    extraYUSDAmount,
    YUSDAmount,
    upperHint,
    lowerHint,
    colls,
    amounts,
    ICR,
    from,
    includeOne
  }) {

    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
    else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS
    if (!YUSDAmount) YUSDAmount = this.toBN(0)
    if (!includeOne) includeOne = true
    let yusdAmount
    const collsAddress = []
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    )
    if (includeOne) MIN_DEBT.add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    if (YUSDAmount.gt(MIN_DEBT)) yusdAmount = YUSDAmount
    else yusdAmount = MIN_DEBT.add(extraYUSDAmount)

    const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    for (let i = 0; i < colls.length; i++) {
      collsAddress.push(colls[i].address)
    }
    const totalVC = await contracts.troveManager.getVC(collsAddress, amounts)

    // if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(2, 18)) // 200%
    // else
    if (typeof ICR == 'string') ICR = this.toBN(ICR)
    if (ICR) {
      yusdAmount = await this.getOpenTroveYUSDAmount(contracts, totalVC.mul(this.toBN(this.dec(1, 18))).div(ICR))
    }
    for (let i = 0; i < colls.length; i++) {
      await this.addERC20(colls[i], from, contracts.borrowerOperations.address, amounts[i], { from: from })
    }

    let tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, yusdAmount, upperHint, lowerHint, collsAddress, amounts, { from: from })

    return {
      yusdAmount,
      netDebt,
      totalDebt,
      ICR,
      totalVC,
      amounts,
      tx
    }
  }


  static async openTroveWithCollsFixedYUSD(contracts, {
    maxFeePercentage,
    extraYUSDAmount,
    upperHint,
    lowerHint,
    ICR,
    colls,
    amounts,
    oracles,
    from
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!extraYUSDAmount) extraYUSDAmount = this.toBN(0)
    else if (typeof extraYUSDAmount == 'string') extraYUSDAmount = this.toBN(extraYUSDAmount)
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    const account = from
    let yusdAmount
    const collsAddress = []
    const MIN_DEBT = (
      await this.getNetBorrowingAmount(contracts, await contracts.borrowerOperations.MIN_NET_DEBT())
    ).add(this.toBN(1)) // add 1 to avoid rounding issues for tests where trove was opening at 150%, and you can’t open the first trove under TCR 150%
    yusdAmount = MIN_DEBT.add(extraYUSDAmount)

    if (!ICR && !extraParams.value) ICR = this.toBN(this.dec(15, 17)) // 150%
    else if (typeof ICR == 'string') ICR = this.toBN(ICR)

    
    const totalDebt = await this.getOpenTroveTotalDebt(contracts, yusdAmount)
    const netDebt = await this.getActualDebtFromComposite(totalDebt, contracts)
    for (let i = 0; i < colls.length; i++) {
      collsAddress.push(colls[i].address)
    }
    const totalVC = await contracts.troveManager.getVC(collsAddress, amounts)

    for (let i = 0; i < colls.length; i++) {
      const VC = (await contracts.whitelist.getValueVC(collsAddress[i], amounts[i]))

      console.log("totalVC: ", totalVC.toString(), "VC: ", VC.toString())
      const price = await oracles[i].getPrice()
      if (ICR) {
        amounts[i] = ICR.mul(totalDebt).div(price).mul(VC).div(totalVC)
  
      } 
      await this.addERC20(colls[i], account, contracts.borrowerOperations.address, amounts[i], { from: account })
      
    }

    let tx
    
  
  

    
    
    console.log("YUDS Amount: ", yusdAmount.toString())
    tx = await contracts.borrowerOperations.openTrove(maxFeePercentage, yusdAmount, upperHint, lowerHint, collsAddress, amounts, {from: from})
    

    
    return {
      yusdAmount,
      netDebt,
      totalDebt,
      ICR,
      totalVC,
      amounts,
      tx
    }
  }

  
  // mint collateralAmount of token to acccount
  // and then approve addressToApprove to spend collateralAmount of token
  static async addERC20(token, account, addressToApprove, collateralAmount, extraParams) {
    // if (!addressToApprove) {addressToApprove=contracts.borrowerOperations}
    const preMintBalance = await token.balanceOf(account)
    await token.mint(account, collateralAmount)
    const postMintBalance = await token.balanceOf(account)

    // console.log("WETH MINTED:", (postMintBalance.div(this.toBN(10 ** 18))).toNumber());

    // console.log("collateral amount " + collateralAmount)
    await token.approve(addressToApprove, collateralAmount, extraParams);
    const tokenApprovedAmount = await token.allowance(account, addressToApprove)
    // console.log("TOKEN APPROVED:", (tokenApprovedAmount.div(this.toBN(10 ** 18))).toNumber());

    return (this.toNormalBase(postMintBalance.sub(preMintBalance)) == this.toNormalBase(collateralAmount)
     && this.toNormalBase(collateralAmount) == this.toNormalBase(tokenApprovedAmount))
  }

  static async addMultipleERC20(account, addressToApprove, tokens, amounts, extraParams) {
    for (let i = 0; i < tokens.length; i++) {
      if (!await this.addERC20(tokens[i], account, addressToApprove, this.toBN(amounts[i]), extraParams)) return false
    }
    return true
  }

  static async mintAndApproveYUSDToken(contracts, account, addressToApprove, collateralAmount, extraParams) {
    const preMintBalance = await contracts.yusdToken.balanceOf(account)
    await contracts.yusdToken.unprotectedMint(account, collateralAmount)
    const postMintBalance = await contracts.yusdToken.balanceOf(account)

    await contracts.yusdToken.callInternalApprove(account, addressToApprove, collateralAmount)
    const approvedToken = await contracts.yusdToken.allowance(account, addressToApprove)

    return (this.toNormalBase(postMintBalance.sub(preMintBalance)) == this.toNormalBase(collateralAmount)
    && this.toNormalBase(collateralAmount) == this.toNormalBase(approvedToken))
  }

  static async adjustTrove(contracts, collsIn, amountsIn, collsOut, amountsOut, YUSDChange, 
    isDebtIncrease, upperHint, lowerHint, maxFeePercentage, extraParams) {

      const tx = await contracts.borrowerOperations.adjustTrove(collsIn, amountsIn, collsOut, amountsOut, YUSDChange, 
        isDebtIncrease, upperHint, lowerHint, maxFeePercentage, extraParams)
  }

  // Pass in big number, divide by 18 and return normal number
  static toNormalBase(number) {
    return this.toBN(number).div(this.toBN(10**18)).toNumber()
  }

  static async addTokensToAccountsAndOpenTroveWithICR(contracts, ICR, accounts, tokens) {
    let extraParams
    for (let i = 0; i < accounts.length; i++) {
      extraParams = { from: accounts[i] }
      for (let j = 0; j < tokens.length; j++) {
        await this.addERC20(tokens[j], accounts[i], contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams)
      }
    }
    for (let i = 0; i < accounts.length; i++) {
      extraParams = { from: accounts[i] }
      let index1 = Math.floor(Math.random() * (tokens.length - 1))
      let index2 = Math.floor(Math.random() * (tokens.length - 1))
      let index3 = Math.floor(Math.random() * (tokens.length - 1))
      if (index1 == index2) {
        index2 = (index1 + 1) % tokens.length
      }
      if (index1 == index3) {
        index3 = (index1 + 1) % tokens.length
      }
      if (index2 == index3) {
        index3 = (index2 + 1) % tokens.length
      }
      // low decimal index hard coded to 11,
      let amounts1 = this.toBN(this.dec(1, 22))
      let amounts2 = this.toBN(this.dec(1, 22))
      let amounts3 = this.toBN(this.dec(1, 22))
      if (index1 == 11) {
        amounts1 = this.dec(1, 10)
      } else if (index2 == 11) {
        amounts2 = this.dec(1, 10)
      } else if (index3 == 11) {
        amounts3 = this.dec(1, 10)
      }
      await this.openTroveWithCollsOld(contracts,
        {ICR: ICR,
          colls: [tokens[index1], tokens[index2], tokens[index3]],
          amounts: [amounts1, amounts2, amounts3],
          from:accounts[i],
        })
      // Reapprove tokens to borrowerOperations
      await tokens[index1].approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
      await tokens[index2].approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
      await tokens[index3].approve(contracts.borrowerOperations.address, this.toBN(this.dec(1, 30)), extraParams);
    }
  }

  static async adjustTrovesRandomly(contracts, accounts, tokens) {
    for (let i = 0; i < accounts.length; i++) {
      let extraParams = { from: accounts[i] }
      let token1 = (await this.getTroveEntireTokens(contracts, accounts[i]))[0]
      let index1
      for (let j = 0; j < tokens.length; j++) {
        if (tokens[j].address == token1.toString()) {
          index1 = j
          break
        }
      }
      let index2 = Math.floor(Math.random() * (tokens.length - 1)) 
      let index3 = Math.floor(Math.random() * (tokens.length - 1))
      if (index1 == index2) {
        index2 = (index1 + 1) % tokens.length
      }
      if (index1 == index3) {
        index3 = (index1 + 1) % tokens.length
      }
      if (index2 == index3) {
        index3 = (index2 + 1) % tokens.length
        if (index3 == index1) {
          index3 = (index3 + 1) % tokens.length
        }
      }
      await contracts.borrowerOperations.adjustTrove(
        [tokens[index3].address, tokens[index2].address],
        [this.toBN(this.dec(10, 18)), this.toBN(this.dec(10, 18))],
        [tokens[index1].address],
        [this.toBN(this.dec(1, 9))],
        this.toBN(this.dec(1, 18)),
        true,
        this.ZERO_ADDRESS,
        this.ZERO_ADDRESS,
        this._100pct, 
        {from : accounts[i]}
      )
    }
  }

  static async withdrawYUSD(contracts, {
    maxFeePercentage,
    yusdAmount,
    ICR,
    upperHint,
    lowerHint,
    extraParams
  }) {
    if (!maxFeePercentage) maxFeePercentage = this._100pct
    if (!upperHint) upperHint = this.ZERO_ADDRESS
    if (!lowerHint) lowerHint = this.ZERO_ADDRESS

    assert(!(yusdAmount && ICR) && (yusdAmount || ICR), "Specify either yusd amount or target ICR, but not both")

    let increasedTotalDebt
    if (ICR) {
      assert(extraParams.from, "A from account is needed")

      // get entire trove collateral and debt after considering redistribution
      const edc = await contracts.troveManager.getEDC(extraParams.from);

      const tokens = edc[0];
      const amounts = edc[1];
      const debt = edc[2];
      
      const troveVC = await contracts.troveManager.getVC(tokens, amounts);

      const targetDebt = troveVC.mul(this.toBN(this.dec(1, 18))).div(ICR);

      assert(targetDebt > debt, "ICR is already greater than or equal to target")
      increasedTotalDebt = targetDebt.sub(debt)
      yusdAmount = await this.getNetBorrowingAmount(contracts, increasedTotalDebt)
    } else {
      increasedTotalDebt = await this.getAmountWithBorrowingFee(contracts, yusdAmount)
    }

    await contracts.borrowerOperations.withdrawYUSD(maxFeePercentage, yusdAmount, upperHint, lowerHint, extraParams)

    return {
      yusdAmount,
      increasedTotalDebt
    }
  }

  // static async adjustTrove_allAccounts(accounts, contracts, ETHAmount, YUSDAmount) {
  //   const gasCostList = []
  //
  //   for (const account of accounts) {
  //     let tx;
  //
  //     let ETHChangeBN = this.toBN(ETHAmount)
  //     let YUSDChangeBN = this.toBN(YUSDAmount)
  //
  //     const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHChangeBN, YUSDChangeBN)
  //     const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)
  //
  //     const zero = this.toBN('0')
  //
  //     let isDebtIncrease = YUSDChangeBN.gt(zero)
  //     YUSDChangeBN = YUSDChangeBN.abs()
  //
  //     // Add ETH to trove
  //     if (ETHChangeBN.gt(zero)) {
  //       tx = await contracts.borrowerOperations.adjustTrove(this._100pct, 0, YUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account, value: ETHChangeBN })
  //       // Withdraw ETH from trove
  //     } else if (ETHChangeBN.lt(zero)) {
  //       ETHChangeBN = ETHChangeBN.neg()
  //       tx = await contracts.borrowerOperations.adjustTrove(this._100pct, ETHChangeBN, YUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account })
  //     }
  //
  //     const gas = this.gasUsed(tx)
  //     gasCostList.push(gas)
  //   }
  //   return this.getGasMetrics(gasCostList)
  // }

  static async adjustTrove_allAccounts_randomAmount(accounts, contracts, ETHMin, ETHMax, YUSDMin, YUSDMax) {
    const gasCostList = []

    for (const account of accounts) {
      let tx;

      let ETHChangeBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax))
      let YUSDChangeBN = this.toBN(this.randAmountInWei(YUSDMin, YUSDMax))

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHChangeBN, YUSDChangeBN)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const zero = this.toBN('0')

      let isDebtIncrease = YUSDChangeBN.gt(zero)
      YUSDChangeBN = YUSDChangeBN.abs()

      // Add ETH to trove
      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, 0, YUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account, value: ETHChangeBN })
        // Withdraw ETH from trove
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, ETHChangeBN, YUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account })
      }

      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async adjustTrove_allAccounts_randomAmount(accounts, contracts, ETHMin, ETHMax, YUSDMin, YUSDMax) {
    const gasCostList = []

    for (const account of accounts) {
      let tx;

      let ETHChangeBN = this.toBN(this.randAmountInWei(ETHMin, ETHMax))
      let YUSDChangeBN = this.toBN(this.randAmountInWei(YUSDMin, YUSDMax))

      const { newColl, newDebt } = await this.getCollAndDebtFromAdjustment(contracts, account, ETHChangeBN, YUSDChangeBN)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const zero = this.toBN('0')

      let isDebtIncrease = YUSDChangeBN.gt(zero)
      YUSDChangeBN = YUSDChangeBN.abs()

      // Add ETH to trove
      if (ETHChangeBN.gt(zero)) {
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, 0, YUSDChangeBN, isDebtIncrease, upperHint, lowerHint, { from: account, value: ETHChangeBN })
        // Withdraw ETH from trove
      } else if (ETHChangeBN.lt(zero)) {
        ETHChangeBN = ETHChangeBN.neg()
        tx = await contracts.borrowerOperations.adjustTrove(this._100pct, ETHChangeBN, YUSDChangeBN, isDebtIncrease, lowerHint, upperHint, { from: account })
      }

      const gas = this.gasUsed(tx)
      // console.log(`ETH change: ${ETHChangeBN},  YUSDChange: ${YUSDChangeBN}, gas: ${gas} `)

      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    for (const account of accounts) {

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, amount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.addColl(upperHint, lowerHint, { from: account, value: amount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, randCollAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.addColl(upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, amount)
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawColl(amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, randCollAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawColl(randCollAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawYUSD_allAccounts(accounts, contracts, amount) {
    const gasCostList = []

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawYUSD(contracts, account, amount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawYUSD(this._100pct, amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawYUSD_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randYUSDAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawYUSD(contracts, account, randYUSDAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawYUSD(this._100pct, randYUSDAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayYUSD_allAccounts(accounts, contracts, amount) {
    const gasCostList = []

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromRepayYUSD(contracts, account, amount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.repayYUSD(amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayYUSD_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randYUSDAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromRepayYUSD(contracts, account, randYUSDAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.repayYUSD(randYUSDAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async getCurrentICR_allAccounts(accounts, contracts, functionCaller) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const account of accounts) {
      const tx = await functionCaller.troveManager_getCurrentICR(account)
      const gas = this.gasUsed(tx) - 21000
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Redemption functions ---

  static async redeemCollateral(redeemer, contracts, YUSDAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, YUSDAmount, maxFee)
    const gas = await this.gasUsed(tx)
    return gas
  }

  static async redeemCollateralAndGetTxObject(redeemer, contracts, YUSDAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, YUSDAmount, maxFee)
    return tx
  }

  static async redeemCollateral_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const redeemer of accounts) {
      const randYUSDAmount = this.randAmountInWei(min, max)

      await this.performRedemptionTx(redeemer, price, contracts, randYUSDAmount)
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async performRedemptionTx(redeemer, price, contracts, YUSDAmount, maxFee = 0, YUSDMaxFee = 0, maxIterations = 0) {
    var finalYUSDAmount = this.toBN(0)
    var finalYUSDFeeAmount = this.toBN(0)
    if (YUSDMaxFee == 0) {
      finalYUSDAmount = await this.estimateYUSDEligible(contracts, YUSDAmount)
      finalYUSDFeeAmount = this.toBN(YUSDAmount).sub(finalYUSDAmount);
    } else {
      finalYUSDAmount = YUSDAmount
      finalYUSDFeeAmount = await this.estimateRedemptionFee(contracts, this.toBN(YUSDAmount))
    }
    // TODO Ensure max fee is not greater than the amount of YUSD fee calculated
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(finalYUSDAmount, 0)
    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]
    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed
    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    finalYUSDAmount = this.toBN(finalYUSDAmount);
    const totalYUSD_ToPullIn = this.toBN(1000000).mul(finalYUSDAmount.add(finalYUSDFeeAmount));
    console.log("TO Pull IN", totalYUSD_ToPullIn.toString());

    await contracts.yusdToken.approve(contracts.troveManagerRedemptions.address, totalYUSD_ToPullIn, {from: redeemer});

    const tx = await contracts.troveManager.redeemCollateral(finalYUSDAmount,
      finalYUSDFeeAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations,
      // maxFee,
      { from: redeemer, gasPrice: 50000 },
    )
    return tx
  }
  
  static async performRedemptionWithMaxFeeAmount(redeemer, contracts, YUSDAmount, YUSDMaxFee, maxIterations = 0) {

    const finalYUSDAmount = YUSDAmount
    const finalYUSDFeeAmount = YUSDMaxFee
    // TODO Ensure max fee is not greater than the amount of YUSD fee calculated

    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(finalYUSDAmount, 0)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]

    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    const totalYUSD_ToPullIn = this.toBN(1000000).mul(finalYUSDAmount.add(finalYUSDFeeAmount));
    console.log("TO Pull IN", totalYUSD_ToPullIn.toString());

    await contracts.yusdToken.approve(contracts.troveManagerRedemptions.address, totalYUSD_ToPullIn, {from: redeemer});

    const tx = await contracts.troveManager.redeemCollateral(finalYUSDAmount,
      finalYUSDFeeAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations,
      // maxFee,
      { from: redeemer, gasPrice: 50000 },
    )

    return tx
  }

  static async estimateYUSDEligible(contracts, YUSDAmount) {
    const totalYUSDSupply = await contracts.troveManagerRedemptions.getEntireSystemDebt(); // S
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate(); // BR
    const squareTerm = (this.toBN(this.dec(1005, 15)).add(decayedBaseRate)) // BR + .5%
    const sqrtTerm = squareTerm.mul(squareTerm)//.div(this.toBN(this.dec(1,18))) // Square term squared, over the precision
    const sqrtTerm2 = ((this.toBN(this.dec(2, 0))).mul(this.toBN(YUSDAmount))).mul(this.toBN(this.dec(1, 36))).div(totalYUSDSupply)
    const finalSqrtTerm = this.sqrt((sqrtTerm.add(sqrtTerm2)).mul(this.toBN(this.dec(1, 18))))//.div(this.toBN(this.dec(1,9)))

    const finalYUSDAmount = totalYUSDSupply.mul(finalSqrtTerm.sub(squareTerm.mul(this.toBN(this.dec(1, 9))))).div(this.toBN(this.dec(1, 27)))
    // console.log("FINAL YUDS AMOUNT : " + finalYUSDAmount)
    // console.log("FINAL YUSD FEE : ", this.toBN(YUSDAmount).sub(finalYUSDAmount).toString())
    return finalYUSDAmount
  }

  // Using babylonian estimation of the square root for big numbers
  static sqrt(x) {
    let z = (x.add(this.toBN(this.dec(1, 0)))).div(this.toBN(this.dec(2, 0)))
    let y = x
    while (z.lt(y)) {
      y = z
      z = ((x.div(z)).add(z)).div(this.toBN(this.dec(2, 0)))
    }
    return y
  }

  static async estimateRedemptionFee(contracts, YUSDAmount) {
    const estimateUpdatedBaseRate = await this.estimateUpdatedBaseRateFromRedemption(contracts, YUSDAmount)
    // console.log("ESTIMATED UDPATED BSE RATE " + estimateUpdatedBaseRate.toString())
    return (this.toBN(estimateUpdatedBaseRate).add(this.toBN(this.dec(5, 15)))).mul(YUSDAmount).div(this.toBN(this.dec(1, 18)))
  }

  static async estimateUpdatedBaseRateFromRedemption(contracts, YUSDAmount) {
    const YUSDSupplyAtStart = await contracts.troveManagerRedemptions.getEntireSystemDebt();
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate();

    /* Convert the drawn ETH back to YUSD at face value rate (1 YUSD:1 USD), in order to get
    * the fraction of total supply that was redeemed at face value. */
    const redeemedYUSDFraction = YUSDAmount.mul(this.toBN(this.dec(1, 18))).div(YUSDSupplyAtStart);
    const BETA = 2
    const newBaseRate = decayedBaseRate.add(redeemedYUSDFraction.div(this.toBN(this.dec(BETA, 0))));
    // console.log("YUSDSUPPLY AT START ", YUSDSupplyAtStart.toString())
    // console.log("REDEEMED YUSD FRACTION " + redeemedYUSDFraction.toString())
    // console.log("NEW BASE RATE ", newBaseRate.toString())
    return Math.min(newBaseRate, this._100pct); // cap baseRate at a maximum of 100%

  }

  // --- Composite functions ---

  static async makeTrovesIncreasingICR(accounts, contracts) {
    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openTrove(this._100pct, '200000000000000000000', account, account, { from: account, value: coll })

      amountFinney += 10
    }
  }

  // --- StabilityPool gas functions ---

  static async provideToSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await stabilityPool.provideToSP(amount, this.ZERO_ADDRESS, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, accounts, stabilityPool) {
    const gasCostList = []
    for (const account of accounts) {
      const randomYUSDAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.provideToSP(randomYUSDAmount, this.ZERO_ADDRESS, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await stabilityPool.withdrawFromSP(amount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts_randomAmount(min, max, accounts, stabilityPool) {
    const gasCostList = []
    for (const account of accounts) {
      const randomYUSDAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.withdrawFromSP(randomYUSDAmount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawETHGainToTrove_allAccounts(accounts, contracts) {
    const gasCostList = []
    for (const account of accounts) {

      let { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)
      // console.log(`entireColl: ${entireColl}`)
      // console.log(`entireDebt: ${entireDebt}`)
      const ETHGain = await contracts.stabilityPool.getDepositorETHGain(account)
      const newColl = entireColl.add(ETHGain)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, entireDebt)

      const tx = await contracts.stabilityPool.withdrawETHGainToTrove(upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    for (const account of accounts) {

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, amount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.addColl(upperHint, lowerHint, { from: account, value: amount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async addColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromAddColl(contracts, account, randCollAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.addColl(upperHint, lowerHint, { from: account, value: randCollAmount })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts(accounts, contracts, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, amount)
      // console.log(`newColl: ${newColl} `)
      // console.log(`newDebt: ${newDebt} `)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawColl(amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawColl_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randCollAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawColl(contracts, account, randCollAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawColl(randCollAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
      // console.log("gasCostlist length is " + gasCostList.length)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawYUSD_allAccounts(accounts, contracts, amount) {
    const gasCostList = []

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawYUSD(contracts, account, amount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawYUSD(this._100pct, amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawYUSD_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randYUSDAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromWithdrawYUSD(contracts, account, randYUSDAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.withdrawYUSD(this._100pct, randYUSDAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayYUSD_allAccounts(accounts, contracts, amount) {
    const gasCostList = []

    for (const account of accounts) {
      const { newColl, newDebt } = await this.getCollAndDebtFromRepayYUSD(contracts, account, amount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.repayYUSD(amount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async repayYUSD_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []

    for (const account of accounts) {
      const randYUSDAmount = this.randAmountInWei(min, max)

      const { newColl, newDebt } = await this.getCollAndDebtFromRepayYUSD(contracts, account, randYUSDAmount)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, newDebt)

      const tx = await contracts.borrowerOperations.repayYUSD(randYUSDAmount, upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async getCurrentICR_allAccounts(accounts, contracts, functionCaller) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const account of accounts) {
      const tx = await functionCaller.troveManager_getCurrentICR(account)
      const gas = this.gasUsed(tx) - 21000
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- Redemption functions ---

  static async redeemCollateral(redeemer, contracts, YUSDAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, YUSDAmount, maxFee)
    const gas = await this.gasUsed(tx)
    return gas
  }

  static async redeemCollateralAndGetTxObject(redeemer, contracts, YUSDAmount, maxFee = this._100pct) {
    const price = await contracts.priceFeedETH.getPrice()
    const tx = await this.performRedemptionTx(redeemer, price, contracts, YUSDAmount, maxFee)
    return tx
  }

  static async redeemCollateral_allAccounts_randomAmount(min, max, accounts, contracts) {
    const gasCostList = []
    const price = await contracts.priceFeedTestnet.getPrice()

    for (const redeemer of accounts) {
      const randYUSDAmount = this.randAmountInWei(min, max)

      await this.performRedemptionTx(redeemer, price, contracts, randYUSDAmount)
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async performRedemptionTx(redeemer, price, contracts, YUSDAmount, maxFee = 0, YUSDMaxFee = 0, maxIterations = 0) {
    var finalYUSDAmount = this.toBN(0)
    var finalYUSDFeeAmount = this.toBN(0)
    if (YUSDMaxFee == 0) {
      finalYUSDAmount = await this.estimateYUSDEligible(contracts, YUSDAmount)
      finalYUSDFeeAmount = this.toBN(YUSDAmount).sub(finalYUSDAmount);
    } else {
      finalYUSDAmount = YUSDAmount
      finalYUSDFeeAmount = await this.estimateRedemptionFee(contracts, this.toBN(YUSDAmount))
    }
    // TODO Ensure max fee is not greater than the amount of YUSD fee calculated
    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(finalYUSDAmount, 0)
    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]
    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed
    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    finalYUSDAmount = this.toBN(finalYUSDAmount);
    const totalYUSD_ToPullIn = this.toBN(1000000).mul(finalYUSDAmount.add(finalYUSDFeeAmount));
    console.log("TO Pull IN", totalYUSD_ToPullIn.toString());

    await contracts.yusdToken.approve(contracts.troveManagerRedemptions.address, totalYUSD_ToPullIn, {from: redeemer});

    const tx = await contracts.troveManager.redeemCollateral(finalYUSDAmount,
      finalYUSDFeeAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations,
      // maxFee,
      { from: redeemer, gasPrice: 500000 },
    )
    return tx
  }

  static async performRedemptionWithMaxFeeAmount(redeemer, contracts, YUSDAmount, YUSDMaxFee, maxIterations = 0) {

    const finalYUSDAmount = YUSDAmount
    const finalYUSDFeeAmount = YUSDMaxFee
    // TODO Ensure max fee is not greater than the amount of YUSD fee calculated

    const redemptionhint = await contracts.hintHelpers.getRedemptionHints(finalYUSDAmount, 0)

    const firstRedemptionHint = redemptionhint[0]
    const partialRedemptionNewICR = redemptionhint[1]

    const {
      hintAddress: approxPartialRedemptionHint,
      latestRandomSeed
    } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, 50, this.latestRandomSeed)
    this.latestRandomSeed = latestRandomSeed

    const exactPartialRedemptionHint = (await contracts.sortedTroves.findInsertPosition(partialRedemptionNewICR,
      approxPartialRedemptionHint,
      approxPartialRedemptionHint))

    const totalYUSD_ToPullIn = this.toBN(1000000).mul(finalYUSDAmount.add(finalYUSDFeeAmount));
    console.log("TO Pull IN", totalYUSD_ToPullIn.toString());

    await contracts.yusdToken.approve(contracts.troveManagerRedemptions.address, totalYUSD_ToPullIn, {from: redeemer});

    const tx = await contracts.troveManager.redeemCollateral(finalYUSDAmount,
      finalYUSDFeeAmount,
      firstRedemptionHint,
      exactPartialRedemptionHint[0],
      exactPartialRedemptionHint[1],
      partialRedemptionNewICR,
      maxIterations,
      // maxFee,
      { from: redeemer, gasPrice: 100879745 },
    )

    return tx
  }

  static async estimateYUSDEligible(contracts, YUSDAmount) {
    const totalYUSDSupply = await contracts.troveManagerRedemptions.getEntireSystemDebt(); // S
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate(); // BR
    const squareTerm = (this.toBN(this.dec(1005, 15)).add(decayedBaseRate)) // BR + .5%
    const sqrtTerm = squareTerm.mul(squareTerm)//.div(this.toBN(this.dec(1,18))) // Square term squared, over the precision
    const sqrtTerm2 = ((this.toBN(this.dec(2, 0))).mul(this.toBN(YUSDAmount))).mul(this.toBN(this.dec(1, 36))).div(totalYUSDSupply)
    const finalSqrtTerm = this.sqrt((sqrtTerm.add(sqrtTerm2)).mul(this.toBN(this.dec(1, 18))))//.div(this.toBN(this.dec(1,9)))

    const finalYUSDAmount = totalYUSDSupply.mul(finalSqrtTerm.sub(squareTerm.mul(this.toBN(this.dec(1, 9))))).div(this.toBN(this.dec(1, 27)))
    // console.log("FINAL YUDS AMOUNT : " + finalYUSDAmount)
    // console.log("FINAL YUSD FEE : ", this.toBN(YUSDAmount).sub(finalYUSDAmount).toString())
    return finalYUSDAmount
  }

  // Using babylonian estimation of the square root for big numbers
  static sqrt(x) {
    let z = (x.add(this.toBN(this.dec(1, 0)))).div(this.toBN(this.dec(2, 0)))
    let y = x
    while (z.lt(y)) {
      y = z
      z = ((x.div(z)).add(z)).div(this.toBN(this.dec(2, 0)))
    }
    return y
  }

  static async estimateRedemptionFee(contracts, YUSDAmount) {
    const estimateUpdatedBaseRate = await this.estimateUpdatedBaseRateFromRedemption(contracts, YUSDAmount)
    // console.log("ESTIMATED UDPATED BSE RATE " + estimateUpdatedBaseRate.toString())
    return (this.toBN(estimateUpdatedBaseRate).add(this.toBN(this.dec(5, 15)))).mul(YUSDAmount).div(this.toBN(this.dec(1, 18)))
  }

  static async estimateUpdatedBaseRateFromRedemption(contracts, YUSDAmount) {
    const YUSDSupplyAtStart = await contracts.troveManagerRedemptions.getEntireSystemDebt();
    const decayedBaseRate = await contracts.troveManager.calcDecayedBaseRate();

    /* Convert the drawn ETH back to YUSD at face value rate (1 YUSD:1 USD), in order to get
    * the fraction of total supply that was redeemed at face value. */
    const redeemedYUSDFraction = YUSDAmount.mul(this.toBN(this.dec(1, 18))).div(YUSDSupplyAtStart);
    const BETA = 2
    const newBaseRate = decayedBaseRate.add(redeemedYUSDFraction.div(this.toBN(this.dec(BETA, 0))));
    // console.log("YUSDSUPPLY AT START ", YUSDSupplyAtStart.toString())
    // console.log("REDEEMED YUSD FRACTION " + redeemedYUSDFraction.toString())
    // console.log("NEW BASE RATE ", newBaseRate.toString())
    return Math.min(newBaseRate, this._100pct); // cap baseRate at a maximum of 100%

  }

  // --- Composite functions ---

  static async makeTrovesIncreasingICR(accounts, contracts) {
    let amountFinney = 2000

    for (const account of accounts) {
      const coll = web3.utils.toWei(amountFinney.toString(), 'finney')

      await contracts.borrowerOperations.openTrove(this._100pct, '200000000000000000000', account, account, { from: account, value: coll })

      amountFinney += 10
    }
  }

  // --- StabilityPool gas functions ---

  static async provideToSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await stabilityPool.provideToSP(amount, this.ZERO_ADDRESS, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async provideToSP_allAccounts_randomAmount(min, max, accounts, stabilityPool) {
    const gasCostList = []
    for (const account of accounts) {
      const randomYUSDAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.provideToSP(randomYUSDAmount, this.ZERO_ADDRESS, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts(accounts, stabilityPool, amount) {
    const gasCostList = []
    for (const account of accounts) {
      const tx = await stabilityPool.withdrawFromSP(amount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawFromSP_allAccounts_randomAmount(min, max, accounts, stabilityPool) {
    const gasCostList = []
    for (const account of accounts) {
      const randomYUSDAmount = this.randAmountInWei(min, max)
      const tx = await stabilityPool.withdrawFromSP(randomYUSDAmount, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  static async withdrawETHGainToTrove_allAccounts(accounts, contracts) {
    const gasCostList = []
    for (const account of accounts) {

      let { entireColl, entireDebt } = await this.getEntireCollAndDebt(contracts, account)
      // console.log(`entireColl: ${entireColl}`)
      // console.log(`entireDebt: ${entireDebt}`)
      const ETHGain = await contracts.stabilityPool.getDepositorETHGain(account)
      const newColl = entireColl.add(ETHGain)
      const { upperHint, lowerHint } = await this.getBorrowerOpsListHint(contracts, newColl, entireDebt)

      const tx = await contracts.stabilityPool.withdrawETHGainToTrove(upperHint, lowerHint, { from: account })
      const gas = this.gasUsed(tx)
      gasCostList.push(gas)
    }
    return this.getGasMetrics(gasCostList)
  }

  // --- LQTY & Lockup Contract functions ---

  static getLCAddressFromDeploymentTx(deployedLCTx) {
    return deployedLCTx.logs[0].args[0]
  }

  static async getLCFromDeploymentTx(deployedLCTx) {
    const deployedLCAddress = this.getLCAddressFromDeploymentTx(deployedLCTx)  // grab addr of deployed contract from event
    const LC = await this.getLCFromAddress(deployedLCAddress)
    return LC
  }

  static async getLCFromAddress(LCAddress) {
    const LC = await LockupContract.at(LCAddress)
    return LC
  }


  static async registerFrontEnds(frontEnds, stabilityPool) {
    for (const frontEnd of frontEnds) {
      await stabilityPool.registerFrontEnd(this.dec(5, 17), { from: frontEnd })  // default kickback rate of 50%
    }
  }

  // --- Time functions ---

  static async fastForwardTime(seconds, currentWeb3Provider) {
    await currentWeb3Provider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds]
    },
      (err) => { if (err) console.log(err) })

    await currentWeb3Provider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_mine'
    },
      (err) => { if (err) console.log(err) })
  }

  static async getLatestBlockTimestamp(web3Instance) {
    const blockNumber = await web3Instance.eth.getBlockNumber()
    const block = await web3Instance.eth.getBlock(blockNumber)

    return block.timestamp
  }

  static async getTimestampFromTx(tx, web3Instance) {
    return this.getTimestampFromTxReceipt(tx.receipt, web3Instance)
  }

  static async getTimestampFromTxReceipt(txReceipt, web3Instance) {
    const block = await web3Instance.eth.getBlock(txReceipt.blockNumber)
    return block.timestamp
  }

  static secondsToDays(seconds) {
    return Number(seconds) / (60 * 60 * 24)
  }

  static daysToSeconds(days) {
    return Number(days) * (60 * 60 * 24)
  }

  static async getTimeFromSystemDeployment(lqtyToken, web3, timePassedSinceDeployment) {
    const deploymentTime = await lqtyToken.getDeploymentStartTime()
    return this.toBN(deploymentTime).add(this.toBN(timePassedSinceDeployment))
  }

  // --- Assert functions ---

  static async assertRevert(txPromise, message = undefined) {
    try {
      const tx = await txPromise
      // console.log("tx succeeded")
      assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      // console.log("tx failed")
      // console.log(err.message)
      assert.include(err.message, "revert")
      // TODO !!!

      // if (message) {
      //   assert.include(err.message, message)
      // }
    }
  }

  static async assertAssert(txPromise) {
    try {
      const tx = await txPromise
      assert.isFalse(tx.receipt.status) // when this assert fails, the expected revert didn't occur, i.e. the tx succeeded
    } catch (err) {
      assert.include(err.message, "invalid opcode")
    }
  }

  // --- Misc. functions  ---

  static async forceSendEth(from, receiver, value) {
    const destructible = await Destructible.new()
    await web3.eth.sendTransaction({ to: destructible.address, from, value })
    await destructible.destruct(receiver)
  }

  static hexToParam(hexValue) {
    return ('0'.repeat(64) + hexValue.slice(2)).slice(-64)
  }

  static formatParam(param) {
    let formattedParam = param
    if (typeof param == 'number' || typeof param == 'object' ||
      (typeof param == 'string' && (new RegExp('[0-9]*')).test(param))) {
      formattedParam = web3.utils.toHex(formattedParam)
    } else if (typeof param == 'boolean') {
      formattedParam = param ? '0x01' : '0x00'
    } else if (param.slice(0, 2) != '0x') {
      formattedParam = web3.utils.asciiToHex(formattedParam)
    }

    return this.hexToParam(formattedParam)
  }
  static getTransactionData(signatureString, params) {
    /*
     console.log('signatureString: ', signatureString)
     console.log('params: ', params)
     console.log('params: ', params.map(p => typeof p))
     */
    return web3.utils.sha3(signatureString).slice(0, 10) +
      params.reduce((acc, p) => acc + this.formatParam(p), '')
  }
}

TestHelper.ZERO_ADDRESS = '0x' + '0'.repeat(40)
TestHelper.maxBytes32 = '0x' + 'f'.repeat(64)


TestHelper._100pct = '1000000000000000000'
TestHelper.latestRandomSeed = 31337

module.exports = {
  TestHelper,
  MoneyValues,
  TimeValues
}
