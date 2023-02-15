const { TestHelper: { dec } } = require("../utils/testHelpers.js")

const EchidnaTester = artifacts.require('EchidnaTester')
const TroveManager = artifacts.require('TroveManager')
const YUSDToken = artifacts.require('YUSDToken')
const ActivePool = artifacts.require('ActivePool')
const DefaultPool = artifacts.require('DefaultPool')
const StabilityPool = artifacts.require('StabilityPool')

// run with:
// npx hardhat --config hardhat.config.echidna.js test fuzzTests/echidna_debug.js

contract('Echidna debugger', async accounts => {
  let echidnaTester
  let troveManager
  let yusdToken
  let activePool
  let defaultPool
  let stabilityPool
  let GAS_POOL_ADDRESS

  before(async () => {
    echidnaTester = await EchidnaTester.new({ value: dec(11, 25) })
    troveManager = await TroveManager.at(await echidnaTester.troveManager())
    yusdToken = await YUSDToken.at(await echidnaTester.yusdToken())
    activePool = await ActivePool.at(await echidnaTester.activePool())
    defaultPool = await DefaultPool.at(await echidnaTester.defaultPool())
    stabilityPool = await StabilityPool.at(await echidnaTester.stabilityPool())
    GAS_POOL_ADDRESS = await troveManager.GAS_POOL_ADDRESS();
  })

  it('openTrove', async () => {
    await echidnaTester.openTroveExt(
      '28533397325200555203581702704626658822751905051193839801320459908900876958892',
      '52469987802830075086048985199642144541375565475567220729814021622139768827880',
      '9388634783070735775888100571650283386615011854365252563480851823632223689886'
    )
  })

  it('openTrove', async () => {
    await echidnaTester.openTroveExt('0', '0', '0')
  })

  it.skip('trove order', async () => {
    const trove1 = await echidnaTester.echidnaProxies(0)
    console.log(trove1)
    const trove2 = await echidnaTester.echidnaProxies(1)

    const icr1_before = await troveManager.getCurrentICR(trove1, '1000000000000000000')
    const icr2_before = await troveManager.getCurrentICR(trove2, '1000000000000000000')
    console.log('Trove 1', icr1_before, icr1_before.toString())
    console.log('Trove 2', icr2_before, icr2_before.toString())

    await echidnaTester.openTroveExt('0', '0', '30540440604590048251848424')
    await echidnaTester.openTroveExt('1', '0', '0')
    await echidnaTester.setPriceExt('78051143795343077331468494330613608802436946862454908477491916')
    const icr1_after = await troveManager.getCurrentICR(trove1, '1000000000000000000')
    const icr2_after = await troveManager.getCurrentICR(trove2, '1000000000000000000')
    console.log('Trove 1', icr1_after, icr1_after.toString())
    console.log('Trove 2', icr2_after, icr2_after.toString())

    const icr1_after_price = await troveManager.getCurrentICR(trove1, '78051143795343077331468494330613608802436946862454908477491916')
    const icr2_after_price = await troveManager.getCurrentICR(trove2, '78051143795343077331468494330613608802436946862454908477491916')
    console.log('Trove 1', icr1_after_price, icr1_after_price.toString())
    console.log('Trove 2', icr2_after_price, icr2_after_price.toString())
  })

  it('YUSD balance', async () => {
    await echidnaTester.openTroveExt('0', '0', '4210965169908805439447313562489173090')

    const totalSupply = await yusdToken.totalSupply();
    const gasPoolBalance = await yusdToken.balanceOf(GAS_POOL_ADDRESS);
    const activePoolBalance = await activePool.getYUSDDebt();
    const defaultPoolBalance = await defaultPool.getYUSDDebt();
    const stabilityPoolBalance = await stabilityPool.getTotalYUSDDeposits();
    const currentTrove = await echidnaTester.echidnaProxies(0);
    const troveBalance = yusdToken.balanceOf(currentTrove);

    console.log('totalSupply', totalSupply.toString());
    console.log('gasPoolBalance', gasPoolBalance.toString());
    console.log('activePoolBalance', activePoolBalance.toString());
    console.log('defaultPoolBalance', defaultPoolBalance.toString());
    console.log('stabilityPoolBalance', stabilityPoolBalance.toString());
    console.log('troveBalance', troveBalance.toString());
  })
})
