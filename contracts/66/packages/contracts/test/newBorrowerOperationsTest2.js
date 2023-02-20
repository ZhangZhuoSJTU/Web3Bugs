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
const WAVAX_ADDRESS = ZERO_ADDRESS;

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

  const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
//   const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

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
      priceFeed = contracts.priceFeedETH
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

      await assertRevert(borrowerOperations.addColl([contracts.weth.address], [collTopUp], th.ZERO_ADDRESS, th.ZERO_ADDRESS,  th._100pct, {from: alice}),//th.addColl(contracts, toBN(dec(collTopUp, 18), alice)),
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    //   await assertRevert(addColl(alice, alice, { from: alice, value: collTopUp }),
        // "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })}
    describe('Without proxy', async () => {
        testCorpus({ withProxy: false })
      })
    
      // describe('With proxy', async () => {
      //   testCorpus({ withProxy: true })
      // })
    })
    
    contract('Reset chain state', async accounts => { })