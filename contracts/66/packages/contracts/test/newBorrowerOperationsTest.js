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

contract('newBorrowerOperations', async accounts => {

    const [
        owner, alice, bob, carol, dennis, whale,
        A, B, C, D, E, F, G, H,
        // defaulter_1, defaulter_2,
        frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

    // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

    let priceFeedAVAX
    let priceFeedETH
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
    const openTrove = async (params) => th.openTrove(contracts, params)
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
            priceFeedETH = contracts.priceFeedETH
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

        it("addColl(), basic sanity", async () => {
            // alice creates a Trove and adds first collateral
            // await contracts.weth.mint(alice, toBN(dec(1000, 18)))
            // await contracts.weth.approve(borrowerOperations.address, toBN(dec(1000, 18)), { from: alice });
            const amountToMint = toBN(dec(1000, 18));
            // mint weth for Alice and approve borrowerOperations to use it
            const wethMint = await th.addERC20(contracts.weth, alice, borrowerOperations.address, amountToMint, { from: alice })
            assert.isTrue(wethMint);

            // mint wavax for Alice and approve borrowerOperations to use it
            const wavaxMint = await th.addERC20(contracts.wavax, alice, borrowerOperations.address, amountToMint, { from: alice })
            assert.isTrue(wavaxMint);

            const colls = [contracts.weth.address, contracts.wavax.address];
            const amounts = [amountToMint, amountToMint]
            const priceFeeds = [contracts.priceFeedETH, contracts.priceFeedAVAX]

            // await th.openTroveWithCollsAndMint(contracts, { ICR: toBN(dec(2, 18)), 
            //     extraParams: { from: alice, _colls: colls, _amounts: amounts, _yusdAmount: toBN(dec(2000, 18)), _priceFeeds: priceFeeds } })

            await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)), 
                extraParams: { from: alice, _colls: colls, _amounts: amounts, _yusdAmount: toBN(dec(2000, 18)), _priceFeeds: priceFeeds } })

            const troveColls2 = await troveManager.getTroveColls(alice)
            console.log("trove coll address " + troveColls2[0])
            console.log("trove coll amount " + troveColls2[1])

            const activePoolWeth = await contracts.weth.balanceOf(activePool.address)
            console.log("WETH active pool has:", (activePoolWeth.div(toBN(10 ** 18))).toNumber());

            const activePoolWavax = await contracts.wavax.balanceOf(activePool.address)
            console.log("wavax activepool has:", (activePoolWavax.div(toBN(10 ** 18))).toNumber());

            const aliceYUSD = await yusdToken.balanceOf(alice)
            console.log("yusd MINTED:", (aliceYUSD.div(toBN(10 ** 18))).toNumber());

            const aliceAvax = await contracts.wavax.balanceOf(alice)
            console.log("wavax alice has:", (aliceAvax.div(toBN(10 ** 18))).toNumber());

            const aliceWeth = await contracts.weth.balanceOf(alice)
            console.log("weth alice has:", (aliceWeth.div(toBN(10 ** 18))).toNumber());

            const troveDebt = await troveManager.getTroveDebt(alice)
            console.log("Trove debt: " + troveDebt)

            assert.isTrue(th.toNormalBase(troveDebt) == 2220)


            const wethMint2 = await th.addERC20(contracts.weth, alice, borrowerOperations.address, amountToMint, { from: alice })
            assert.isTrue(wethMint2);

            // collsIn, amountsIn, collsOut, amountsOut, 
            await th.adjustTrove(contracts, [contracts.weth.address], [amountToMint], [], [], 0, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, {from: alice})

            const troveColls = await troveManager.getTroveColls(alice)
            console.log("trove coll address " + troveColls[0])
            console.log("trove coll amount " + troveColls[1])

            const troveDebt2 = await troveManager.getTroveDebt(alice)
            console.log("Trove debt2: " + troveDebt2)


            const wethMint3 = await th.addERC20(contracts.weth, alice, borrowerOperations.address, amountToMint, { from: alice })
            assert.isTrue(wethMint3);

            // collsIn, amountsIn, collsOut, amountsOut, 
            await th.adjustTrove(contracts, [contracts.weth.address], [amountToMint], [], [], 0, false, th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, {from: alice})

            const troveColls3 = await troveManager.getTroveColls(alice)
            console.log("trove coll address " + troveColls3[0])
            console.log("trove coll amount " + troveColls3[1])


            await th.adjustTrove(contracts, [], [], [], [], toBN(dec(2000, 18)), true, th.ZERO_ADDRESS, th.ZERO_ADDRESS, th._100pct, {from: alice})

            const troveDebt3 = await troveManager.getTroveDebt(alice)
            console.log("Trove debt3: " + troveDebt3)
            const mintedYUSDb = await contracts.yusdToken.balanceOf(alice)
            console.log(th.toNormalBase(mintedYUSDb))

            const result = await th.mintAndApproveYUSDToken(contracts, alice, borrowerOperations.address, amountToMint)
            const mintedYUSD = await contracts.yusdToken.balanceOf(alice)
            console.log(th.toNormalBase(mintedYUSD))
            console.log("result " + result)


            // const amountToMint = toBN(dec(1000, 18));
            // mint weth for bob and approve borrowerOperations to use it
            const wethMintBob = await th.addERC20(contracts.weth, bob, borrowerOperations.address, amountToMint, { from: bob })
            assert.isTrue(wethMintBob);

            // mint wavax for bob and approve borrowerOperations to use it
            const wavaxMintBob = await th.addERC20(contracts.wavax, bob, borrowerOperations.address, amountToMint, { from: bob })
            assert.isTrue(wavaxMintBob);

            // const collsBob = [contracts.weth.address, contracts.wavax.address];
            // const amountsBob = [amountToMint, amountToMint]
            // const priceFeedsBob = [contracts.priceFeedETH, contracts.priceFeedAVAX]
            await th.openTroveWithColls(contracts, { ICR: toBN(dec(2, 18)), 
                extraParams: { from: bob, _colls: colls, _amounts: amounts, _yusdAmount: toBN(dec(2000, 18)), _priceFeeds: priceFeeds } })


            await contracts.borrowerOperations.closeTrove({from:alice})

            const activePoolWeth2 = await contracts.weth.balanceOf(activePool.address)
            console.log("WETH active pool has:", (activePoolWeth2.div(toBN(10 ** 18))).toNumber());

            const activePoolWavax2 = await contracts.wavax.balanceOf(activePool.address)
            console.log("wavax activepool has:", (activePoolWavax2.div(toBN(10 ** 18))).toNumber());

            const aliceYUSD2 = await yusdToken.balanceOf(alice)
            console.log("yusd MINTED:", (aliceYUSD2.div(toBN(10 ** 18))).toNumber());

            const aliceAvax2 = await contracts.wavax.balanceOf(alice)
            console.log("wavax alice has:", (aliceAvax2.div(toBN(10 ** 18))).toNumber());

            const aliceWeth2 = await contracts.weth.balanceOf(alice)
            console.log("weth alice has:", (aliceWeth2.div(toBN(10 ** 18))).toNumber());

            const troveDebtalice2 = await troveManager.getTroveDebt(alice)
            console.log("Trove debt: " + troveDebt2)

            
            
            // // await contracts.weth.balanceOf(account)
            // const alice_Trove_Before = await troveManager.Troves(alice)
            // const coll_before = alice_Trove_Before[1]
            // const status_Before = alice_Trove_Before[3]

            // // check status before
            // assert.equal(status_Before, 1)

            // // Alice adds second collateral
            // await borrowerOperations.addColl(alice, alice, { from: alice, value: dec(1, 'ether') })

            // const alice_Trove_After = await troveManager.Troves(alice)
            // const coll_After = alice_Trove_After[1]
            // const status_After = alice_Trove_After[3]

            // // check coll increases by correct amount,and status remains active
            // assert.isTrue(coll_After.eq(coll_before.add(toBN(dec(1, 'ether')))))
            // assert.equal(status_After, 1)
        })

    }
    describe('Without proxy', async () => {
        testCorpus({ withProxy: false })
      })
    
      // describe('With proxy', async () => {
      //   testCorpus({ withProxy: true })
      // })
    })
    
    contract('Reset chain state', async accounts => { })