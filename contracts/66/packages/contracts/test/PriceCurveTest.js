// const { assert } = require("workbox-core/_private")
// const { assert } = require("workbox-core/_private")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester")
const LinearPriceCurve = artifacts.require("./PriceCurves/ThreePieceWiseLinearPriceCurve.sol");

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

contract('Price Curve', async accounts => {

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
    let weth
    let tokenA
    let priceFeedA
    let tokenB
    let priceFeedB
    let tokenC
    let priceFeedC
    let tokenD
    let priceFeedD
    let tokenRisky
    let priceFeedRisky
    let tokenSuperRisky
    let priceFeedSuperRisky
    let tokenLowDecimal
    let priceFeedLowDecimal
    let stableCoin
    let priceFeedStableCoin

    let priceCurveA
    let priceCurveB

    let contracts

    const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
    const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
    const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
    const openTrove = async (params) => th.openTrove(contracts, params)
    const getTroveEntireTokens = async (trove) => th.getTroveEntireTokens(contracts, trove)
    const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
    const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
    const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)

    const YUSDMinAmount = toBN('1791044776119402985075')

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
            priceFeed = priceFeedETH
            yusdToken = contracts.yusdToken
            sortedTroves = contracts.sortedTroves
            troveManager = contracts.troveManager
            activePool = contracts.activePool
            stabilityPool = contracts.stabilityPool
            defaultPool = contracts.defaultPool
            borrowerOperations = contracts.borrowerOperations
            hintHelpers = contracts.hintHelpers
            whitelist = contracts.whitelist
            weth = contracts.weth
            wavax = contracts.wavax

            sYETI = YETIContracts.sYETI
            yetiToken = YETIContracts.yetiToken
            communityIssuance = YETIContracts.communityIssuance
            lockupContractFactory = YETIContracts.lockupContractFactory

            YUSD_GAS_COMPENSATION = await borrowerOperations.YUSD_GAS_COMPENSATION()
            MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
            BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()

            const paramsA = {
                name: "Token A",
                symbol: "T.A",
                decimals: 18,
                ratio: dec(1, 18)
            }
            let result = await deploymentHelper.deployExtraCollateral(contracts, paramsA)
            tokenA = result.token
            priceFeedA = result.priceFeed

            const paramsB = {
                name: "Token B",
                symbol: "T.B",
                decimals: 18,
                ratio: dec(1, 18)
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsB)
            tokenB = result.token
            priceFeedB = result.priceFeed

            const paramsC = {
                name: "Token C",
                symbol: "T.C",
                decimals: 18,
                ratio: dec(1, 18)
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsC)
            tokenC = result.token
            priceFeedC = result.priceFeed

            const paramsD = {
                name: "Token D",
                symbol: "T.D",
                decimals: 18,
                ratio: dec(1, 18)
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsD)
            tokenD = result.token
            priceFeedD = result.priceFeed

            const paramsRisky = {
                name: "Risky Token",
                symbol: "T.R",
                decimals: 18,
                ratio: dec(75, 16) // 75%
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsRisky)
            tokenRisky = result.token
            priceFeedRisky = result.priceFeed

            const paramsSuperRisky = {
                name: "Super Risky Token",
                symbol: "T.SR",
                decimals: 18,
                ratio: dec(5, 17) // 50%
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsSuperRisky)
            tokenSuperRisky = result.token
            priceFeedSuperRisky = result.priceFeed

            const paramsLowDecimal = {
                name: "Low Decimal Token",
                symbol: "T.LD",
                decimals: 6,
                ratio: dec(1, 18)
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsLowDecimal)
            tokenLowDecimal = result.token
            priceFeedLowDecimal = result.priceFeed

            const paramsStableCoin = {
                name: "USD Coin",
                symbol: "USDC",
                decimals: 18,
                ratio: dec(105, 16) // 105%
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
            stableCoin = result.token
            priceFeedStableCoin = result.priceFeed

            // console.log("Deployed extra collateral " + tokenLowDecimal.address)

            priceCurveA = await LinearPriceCurve.new()
            priceCurveB = await LinearPriceCurve.new()
            await priceCurveA.setAddresses(contracts.whitelist.address)
            await priceCurveB.setAddresses(contracts.whitelist.address)
            await priceCurveA.adjustParams("Price Curve A", "0", "0", "0", "0", "0", "0", "0");
            await priceCurveB.adjustParams("Price Curve B", "0", "0", "0", "0", "0", "0", "0");

            await whitelist.changePriceCurve(tokenA, priceCurveA.address)
            await whitelist.changePriceCurve(tokenB, priceCurveB.address)

        })

        // --- getFee() Three Piecewise  ---
        describe('getFee() ThreePieceWiseLinearPriceCurve: Calculate raw fee correctly', async () => {

            it("Get fee changes properly with adjust params, when set to non increasing linear function", async () => {
                // Fee set to 0 initially in beforeEach
                const zeroFee = await priceCurveA.getFee(toBN(dec(1, 15)), toBN(dec(1, 18)))
                assert.isTrue(zeroFee.eq(toBN(0)))

                console.log("GOTHEER")
                // Setting to intercept of 10% so should just output 10% always. Cuttoffs are arbitrarily large.
                await priceCurveA.adjustParams("Price Curve A 10%", "0", toBN(dec(1, 17)), "0", toBN(30, 30), "0", toBN(dec(30, 30)));
                const tenFee = await priceCurveA.getFee(toBN(dec(1, 15)), toBN(dec(1, 18)))
                assert.isTrue(tenFee.eq(toBN(dec(1, 17))))
            })

            it("Open a trove with multiple collateral types, check if amounts added are correct", async () => {

            })

            it("Open a trove with multiple collateral types, check if amounts added are correct", async () => {

            })

            it("Open a trove with multiple collateral types, check if amounts added are correct", async () => {

            })

            it("Open a trove with multiple collateral types, check if amounts added are correct", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })

                const aliceRawBalanceBefore_A = await tokenA.balanceOf(alice)
                const aliceRawBalanceBefore_B = await tokenB.balanceOf(alice)
                const aliceRawBalanceBefore_C = await tokenC.balanceOf(alice)

                const activePoolRawBalanceBefore_A = await tokenA.balanceOf(activePool.address)
                const activePoolRawBalanceBefore_B = await tokenB.balanceOf(activePool.address)
                const activePoolRawBalanceBefore_C = await tokenC.balanceOf(activePool.address)

                assert.isTrue(activePoolRawBalanceBefore_A.eq(toBN(0)))
                assert.isTrue(activePoolRawBalanceBefore_B.eq(toBN(0)))
                assert.isTrue(activePoolRawBalanceBefore_C.eq(toBN(0)))

                assert.isTrue(aliceRawBalanceBefore_A.eq(toBN(dec(5, 18))))
                assert.isTrue(aliceRawBalanceBefore_B.eq(toBN(dec(10, 18))))
                assert.isTrue(aliceRawBalanceBefore_C.eq(toBN(dec(15, 18))))
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })

                const aliceRawBalanceAfter_A = await tokenA.balanceOf(alice)
                const aliceRawBalanceAfter_B = await tokenB.balanceOf(alice)
                const aliceRawBalanceAfter_C = await tokenC.balanceOf(alice)

                const activePoolRawBalanceAfter_A = await tokenA.balanceOf(activePool.address)
                const activePoolRawBalanceAfter_B = await tokenB.balanceOf(activePool.address)
                const activePoolRawBalanceAfter_C = await tokenC.balanceOf(activePool.address)

                assert.isTrue(aliceRawBalanceAfter_A.eq(toBN(0)))
                assert.isTrue(aliceRawBalanceAfter_B.eq(toBN(0)))
                assert.isTrue(aliceRawBalanceAfter_C.eq(toBN(0)))

                assert.isTrue(activePoolRawBalanceAfter_A.eq(toBN(dec(5, 18))))
                assert.isTrue(activePoolRawBalanceAfter_B.eq(toBN(dec(10, 18))))
                assert.isTrue(activePoolRawBalanceAfter_C.eq(toBN(dec(15, 18))))

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)]))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                // Missing token B allocation
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: bob })
                await assertRevert(
                    borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [tokenA.address, tokenC.address], [dec(5, 18), dec(11, 18), dec(15, 18)], { from: bob }),
                    "Borrower does not have enough allocation of one of the tokens. "
                )

            })
        })
    }


    // describe('Without proxy', async () => {
    //     testCorpus({ withProxy: false })
    // })

    // describe('With proxy', async () => {
    //   testCorpus({ withProxy: true })
    // })
})

contract('Reset chain state', async accounts => { })