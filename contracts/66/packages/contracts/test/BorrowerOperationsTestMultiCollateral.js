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
const SECONDS_IN_ONE_DAY = timeValues.SECONDS_IN_ONE_DAY

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert
const WAVAX_ADDRESS = ZERO_ADDRESS;

const routerABI = [{ "inputs": [{ "internalType": "address", "name": "_factory", "type": "address" }, { "internalType": "address", "name": "_WAVAX", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "WAVAX", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenA", "type": "address" }, { "internalType": "address", "name": "tokenB", "type": "address" }, { "internalType": "uint256", "name": "amountADesired", "type": "uint256" }, { "internalType": "uint256", "name": "amountBDesired", "type": "uint256" }, { "internalType": "uint256", "name": "amountAMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountBMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "addLiquidity", "outputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "amountB", "type": "uint256" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "amountTokenDesired", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "addLiquidityAVAX", "outputs": [{ "internalType": "uint256", "name": "amountToken", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }], "stateMutability": "payable", "type": "function" }, { "inputs": [], "name": "factory", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "reserveIn", "type": "uint256" }, { "internalType": "uint256", "name": "reserveOut", "type": "uint256" }], "name": "getAmountIn", "outputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "reserveIn", "type": "uint256" }, { "internalType": "uint256", "name": "reserveOut", "type": "uint256" }], "name": "getAmountOut", "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }], "name": "getAmountsIn", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }], "name": "getAmountsOut", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "reserveA", "type": "uint256" }, { "internalType": "uint256", "name": "reserveB", "type": "uint256" }], "name": "quote", "outputs": [{ "internalType": "uint256", "name": "amountB", "type": "uint256" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenA", "type": "address" }, { "internalType": "address", "name": "tokenB", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountAMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountBMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "removeLiquidity", "outputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "amountB", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "removeLiquidityAVAX", "outputs": [{ "internalType": "uint256", "name": "amountToken", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "removeLiquidityAVAXSupportingFeeOnTransferTokens", "outputs": [{ "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "bool", "name": "approveMax", "type": "bool" }, { "internalType": "uint8", "name": "v", "type": "uint8" }, { "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }], "name": "removeLiquidityAVAXWithPermit", "outputs": [{ "internalType": "uint256", "name": "amountToken", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "bool", "name": "approveMax", "type": "bool" }, { "internalType": "uint8", "name": "v", "type": "uint8" }, { "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }], "name": "removeLiquidityAVAXWithPermitSupportingFeeOnTransferTokens", "outputs": [{ "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenA", "type": "address" }, { "internalType": "address", "name": "tokenB", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountAMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountBMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "bool", "name": "approveMax", "type": "bool" }, { "internalType": "uint8", "name": "v", "type": "uint8" }, { "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }], "name": "removeLiquidityWithPermit", "outputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "amountB", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapAVAXForExactTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactAVAXForTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactAVAXForTokensSupportingFeeOnTransferTokens", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForAVAX", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForAVAXSupportingFeeOnTransferTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "amountInMax", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapTokensForExactAVAX", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "amountInMax", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapTokensForExactTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "stateMutability": "payable", "type": "receive" }];


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

    let contracts
    let YETIContracts

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
            YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

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
        })

        // --- openTrove() --- 
        describe('openTrove() multi collateral', async () => {

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

            it("Open various troves with wrong order collateral, check that they have it properly", async () => {
                // await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                // await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                // await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenC], [dec(200, 18)], { from: alice })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenC.address], [dec(200, 18)], { from: alice })

                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenC, tokenA], [dec(5, 18), dec(10, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [tokenC.address, tokenA.address], [dec(5, 18), dec(10, 18)], { from: bob })

                await th.addMultipleERC20(carol, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: carol })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, carol, carol, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: carol })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)

                const bobTokens = await getTroveEntireTokens(bob)
                const bobColls = await getTroveEntireColl(bob)

                const carolTokens = await getTroveEntireTokens(carol)
                const carolColls = await getTroveEntireColl(carol)

                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenC.address], [dec(200, 18)]))
                assert.isTrue(await th.assertCollateralsEqual(bobTokens, bobColls, [tokenC.address, tokenA.address], [dec(5, 18), dec(10, 18)]))
                assert.isTrue(await th.assertCollateralsEqual(carolTokens, carolColls, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)]))
            })

            it("Open trove multi collat with less balance than you have fails", async () => {
                await assertRevert(
                    borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address], [dec(200, 18)], { from: alice }),
                    "revert if you don't have enough collateral"
                )

                await assertRevert(
                  borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address], [dec(200, 18), dec(200, 18)], { from: alice }),
                  "revert if you don't have enough collateral"
                )

                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA], [dec(400, 18)], { from: alice })
                await assertRevert(
                  borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address], [dec(200, 18), dec(200, 18)], { from: alice }),
                  "revert if you don't have enough collateral"
                )
            })

            it("Open trove after collateral price changes fails ", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA], [dec(400, 18)], { from: alice })
                await th.addMultipleERC20(whale, borrowerOperations.address, [tokenA], [dec(400, 18)], { from: whale })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA], [dec(400, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address], [dec(300, 18)], { from: whale })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [tokenA.address], [dec(20, 18)], { from: bob })

                priceFeedA.setPrice(dec(100, 18))

                await assertRevert(
                    borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address], [dec(20, 18)], { from: alice }),
                    "revert if collateral is now not worth enough."
                )
            })
        })


        describe('adjustTrove() multi collateral', async () => {
            it("Open a trove with multiple collateral types, then adjust", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC, tokenD], [dec(500, 18), dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: bob })

                // Attempt to adjust with wrong order collateral and with new collateral type
                await borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], 0, false, alice, alice, th._100pct, { from: alice })
                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)
                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address, tokenC.address, tokenD.address], [dec(8, 18), dec(9, 18), dec(13, 18), dec(1, 18)]))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                // Should let adjust debt and collateral types
                await borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], dec(100, 18), true, alice, alice, th._100pct, { from: alice })
                const aliceTokens2 = await getTroveEntireTokens(alice)
                const aliceColls2 = await getTroveEntireColl(alice)
                assert.isTrue(await th.assertCollateralsEqual(aliceTokens2, aliceColls2, [tokenA.address, tokenB.address, tokenC.address, tokenD.address], [dec(11, 18), dec(8, 18), dec(11, 18), dec(2, 18)]))
                const aliceDebt2 = await getTroveEntireDebt(alice)
                assert.isTrue(aliceDebt2.eq(toBN(dec(21005, 17)))) // With extra fee 

                await borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], dec(1005, 17), false, alice, alice, th._100pct, { from: alice })
                const aliceDebt3 = await getTroveEntireDebt(alice)
                assert.isTrue(aliceDebt3.eq(toBN(dec(2000, 18)))) // Back to normal 

                // But not below debt floor
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenD.address, tokenA.address], [dec(1, 18), dec(3, 18)], [tokenC.address, tokenB.address], [dec(2, 18), dec(1, 18)], dec(1, 17), false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if below debt floor, while also adjusting multi collateral"
                )
            })

            it("Adjusting trove without doing anything reverts", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [], [], 0, true, alice, alice, th._100pct, { from: alice }),
                    "Should revert if nothing is happening"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if nothing is happening"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address], [0], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if nothing is happening"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address], [0], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if nothing is happening"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address, tokenB.address], [0, 0], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if nothing is happening"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address, tokenB.address], [0, 0], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if nothing is happening"
                )
            })

            it("Adjusting trove by amounts / tokens that do not line up reverts", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                await assertRevert(
                    borrowerOperations.adjustTrove([], [0], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if tokens and amounts do not have same length"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [], [0], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if tokens and amounts do not have same length"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address, tokenB.address], [0], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if tokens and amounts do not have same length"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if tokens and amounts do not have same length"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address, tokenB.address], [0], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if tokens and amounts do not have same length"
                )
            })

            it("Adjusting trove by removing and adding same type of collateral does not work", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })

                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address], [toBN(dec(1, 18))], [tokenA.address], [toBN(dec(2, 18))], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if same collateral type in colls_in and colls_out"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenB.address, tokenA.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], [tokenA.address], [toBN(dec(2, 18))], dec(1, 18), false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if same collateral type in colls_in and colls_out even if others are valid"
                )
            })

            it("Adjusting or opening trove with duplicate collat does not work", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                await assertRevert(
                    borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenA.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice }),
                    "Should revert if duplicate collateral"
                )

                // Can still open normal trove
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })

                await assertRevert(
                    borrowerOperations.adjustTrove([tokenA.address, tokenB.address, tokenA.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], [], [], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if duplicate collateral"
                )
                await assertRevert(
                    borrowerOperations.adjustTrove([], [], [tokenA.address, tokenA.address, tokenB.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], 0, false, alice, alice, th._100pct, { from: alice }),
                    "Should revert if duplicate collateral"
                )

                // Can still adjust normal trove
                await borrowerOperations.adjustTrove([tokenA.address, tokenB.address], [toBN(dec(1, 18)), toBN(dec(1, 18))], [], [], 0, false, alice, alice, th._100pct, { from: alice })
            })

            it("Adjusting a trove with collateral after price drops calculates VC correctly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenC, tokenLowDecimal], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(whale, borrowerOperations.address, [tokenSuperRisky, tokenC, tokenLowDecimal], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: whale })

                // 5 low decimal token worth 5 * 200, with only 6 decimals. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenSuperRisky.address, tokenC.address, tokenLowDecimal.address], [dec(20, 18), dec(5, 18), dec(5, 6)], { from: alice })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenSuperRisky.address, tokenC.address, tokenLowDecimal.address], [dec(450, 18), dec(450, 18), dec(450, 6)], { from: whale })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const activePoolTokens = await activePool.getAllCollateral()[0]
                const activePoolAmounts = await activePool.getAllCollateral()[1]

                const aliceICRBefore = await troveManager.getCurrentICR(alice)

                // (20 * .5 + 5 + 5 ) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(aliceICRBefore.eq(toBN(dec(2, 18))))

                const newLowDecimalPrice = toBN(dec(0, 18))
                await priceFeedLowDecimal.setPrice(newLowDecimalPrice)

                let aliceICRAfter = await troveManager.getCurrentICR(alice)

                // (20 * .5 + 5) * 200 + (5) * 0 = 5000 VC Balance, 3000 / 2000 = 150% collateral ratio
                assert.isTrue(aliceICRAfter.eq(toBN(dec(15, 17))))

                // Assert ICR = Alice ICR 
                const aliceVC = await troveManager.getTroveVC(alice)
                assert.isTrue(aliceVC.eq(toBN(dec(3000, 18))))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                // Can still add collateral with 0 value but does not do anything. 
                await borrowerOperations.adjustTrove([tokenLowDecimal.address], [toBN(dec(1, 18))], [], [], 0, false, alice, alice, th._100pct, { from: alice })
                aliceICRAfter = await troveManager.getCurrentICR(alice)
                assert.isTrue(aliceICRAfter.eq(toBN(dec(150, 16))))

                // Can still remove collateral with 0 value but does not do anything.
                await borrowerOperations.adjustTrove([], [], [tokenLowDecimal.address], [toBN(dec(1, 18))], 0, false, alice, alice, th._100pct, { from: alice })
                aliceICRAfter = await troveManager.getCurrentICR(alice)
                assert.isTrue(aliceICRAfter.eq(toBN(dec(150, 16))))

                const newRiskyTokenPrice = toBN(dec(100, 18))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)

                // (20 * .5) * 100 + (5) * 200 + (5) * 0 = 2000 VC Balance, 2000 / 2000 = 100% collateral ratio
                aliceICRAfter = await await troveManager.getCurrentICR(alice)
                assert.isTrue(aliceICRAfter.eq(toBN(dec(100, 16))))

                // Can do a withdrawal of collateral as long as total change is positive and above 110%. 
                // (18 * .5) * 100 + (11) * 200 + (10) * 0 = 3300 VC Balance, 3300 / 3000 = 110% collateral ratio
                const debtAddition = toBN(dec(1000, 18)).mul(toBN(1000)).div(toBN(1005)) // 1000 adjusted for fees
                await borrowerOperations.adjustTrove([tokenLowDecimal.address, tokenC.address], [toBN(dec(5, 18)), toBN(dec(7, 18))], [tokenSuperRisky.address], [toBN(dec(2, 18))], debtAddition, true, alice, alice, th._100pct, { from: alice })
                aliceICRAfter = await troveManager.getCurrentICR(alice)
                assert.isTrue(aliceICRAfter.eq(toBN(dec(110, 16))))

                const newRiskyTokenPrice2 = toBN(dec(200, 18))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice2) // new VC 4000, debt 3000

                // Reverts if trying to withdraw collateral + debt worth more than above 110%
                await assertRevert(
                    borrowerOperations.adjustTrove([tokenC.address], [toBN(dec(1, 18))], [tokenSuperRisky.address], [toBN(dec(11, 18))], toBN(dec(500, 18)), true, alice, alice, th._100pct, { from: alice }),
                    "Cannot withdraw more collateral than 110% of total debt"
                )
            })
        })

        describe('check VC, TCR, balances multi collateral', async () => {
            it("Open two multi collateral trove, check if collateral is correct", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: bob })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)
                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)]))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                // const aliceTCR = await borrowerOperations.getTCR(alice, aliceTokens)
                // assert.isTrue(aliceTCR.eq(dec(0.5, 18)))
            })

            it("Open two multi collateral trove, check raw balances of contracts are correct", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                const ABCAddresses = [tokenA.address, tokenB.address, tokenC.address]
                const activePool_Coll_Before = [await activePool.getCollateral(tokenA.address), await activePool.getCollateral(tokenB.address), await activePool.getCollateral(tokenC.address)]
                const activePool_RawColl_Before = [toBN(await tokenA.balanceOf(activePool.address)), toBN(await tokenB.balanceOf(activePool.address)), toBN(await tokenC.balanceOf(activePool.address))]

                assert.isTrue(await th.assertCollateralsEqual(ABCAddresses, [0, 0, 0], ABCAddresses, activePool_Coll_Before))
                assert.isTrue(await th.assertCollateralsEqual(ABCAddresses, [0, 0, 0], ABCAddresses, activePool_RawColl_Before))

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenB.address], [dec(55, 18), dec(10, 18)], { from: alice })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [tokenA.address, tokenC.address], [dec(20, 18), dec(12, 18)], { from: bob })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const bobTokens = await getTroveEntireTokens(bob)
                const bobColls = await getTroveEntireColl(bob)
                const bobDebt = await getTroveEntireDebt(bob)

                assert.isTrue(await th.assertCollateralsEqual(aliceTokens, aliceColls, [tokenA.address, tokenB.address], [dec(55, 18), dec(10, 18)]))
                assert.isTrue(await th.assertCollateralsEqual(bobTokens, bobColls, [tokenA.address, tokenC.address], [dec(20, 18), dec(12, 18)]))

                const activePool_Coll_After = [await activePool.getCollateral(tokenA.address), await activePool.getCollateral(tokenB.address), await activePool.getCollateral(tokenC.address)]
                const activePool_RawColl_After = [toBN(await tokenA.balanceOf(activePool.address)), toBN(await tokenB.balanceOf(activePool.address)), toBN(await tokenC.balanceOf(activePool.address))]

                const sumResult = await contracts.borrowerOperations.sumColls(aliceTokens, aliceColls, bobTokens, bobColls)
                const aliceBobTokens = sumResult[0]
                const aliceBobAmounts = sumResult[1]

                // Make sure raw balances of alice + bob are equal to the active pool amounts. 
                assert.isTrue(await th.assertCollateralsEqual(aliceBobTokens, aliceBobAmounts, ABCAddresses, activePool_Coll_After))
                assert.isTrue(await th.assertCollateralsEqual(aliceBobTokens, aliceBobAmounts, ABCAddresses, activePool_RawColl_After))
            })

            it("Open multi collateral trove, adjust prices individually, check if VC and TCR change accordingly. Ratio 1 tokens", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenA.address, tokenC.address, tokenB.address], [dec(10, 18), dec(5, 18), dec(5, 18)], { from: alice })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const activePoolTokens = await activePool.getAllCollateral()[0]
                const activePoolAmounts = await activePool.getAllCollateral()[1]

                const TCRBefore = await th.getTCR(contracts)

                // (10 + 5 + 5 ) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRBefore.eq(toBN(dec(2, 18))))

                const newTokenAPrice = toBN(dec(100, 18))
                await priceFeedA.setPrice(newTokenAPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (10) * 100 + (5 + 5) * 200 = 3000 VC Balance, 3000 / 2000 = 150% collateral ratio
                assert.isTrue(TCRAfter.eq(toBN(dec(15, 17))))

                // Assert TCR = Alice ICR 
                const aliceVC = await troveManager.getTroveVC(alice)
                assert.isTrue(aliceVC.eq(toBN(dec(3000, 18))))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                const newTokenBPrice = toBN(dec(100, 18))
                await priceFeedB.setPrice(newTokenBPrice)

                const TCRAfter2 = await th.getTCR(contracts)
                assert.isTrue(TCRAfter2.eq(toBN(dec(125, 16))))
            })

            it("Ratio < 1, Open multi collateral trove, adjust prices individually, check if VC and TCR change accordingly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenB, tokenC], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenSuperRisky.address, tokenC.address, tokenB.address], [dec(20, 18), dec(5, 18), dec(5, 18)], { from: alice })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const activePoolTokens = await activePool.getAllCollateral()[0]
                const activePoolAmounts = await activePool.getAllCollateral()[1]

                const TCRBefore = await th.getTCR(contracts)

                // (20 * .5 + 5 + 5 ) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRBefore.eq(toBN(dec(2, 18))))

                const newRiskyTokenPrice = toBN(dec(100, 18))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (20 * .5) * 100 + (5 + 5) * 200 = 3000 VC Balance, 3000 / 2000 = 150% collateral ratio
                assert.isTrue(TCRAfter.eq(toBN(dec(15, 17))))

                // Assert TCR = Alice ICR 
                const aliceVC = await troveManager.getTroveVC(alice)
                assert.isTrue(aliceVC.eq(toBN(dec(3000, 18))))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                const newTokenBPrice = toBN(dec(100, 18))
                await priceFeedB.setPrice(newTokenBPrice)

                const TCRAfter2 = await th.getTCR(contracts)
                assert.isTrue(TCRAfter2.eq(toBN(dec(125, 16))))
            })

            it("Ratio > 1, Open multi collateral trove, adjust prices, VC and TCR should change accordingly. ", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [stableCoin, tokenC], [dec(500000, 18), dec(500, 18)], { from: alice })

                priceFeedStableCoin.setPrice(toBN(dec(1, 18)))
                const amountStableCoin = toBN(dec(2000, 18)).mul(toBN(dec(1, 18))).div(toBN(dec(105, 16))) // 2000 / 105% to get the amount to take out in stablecoin
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenC.address, stableCoin.address], [dec(10, 18), amountStableCoin], { from: alice })

                const TCRBefore = await th.getTCR(contracts)

                // Collat ratio should be 200%
                th.assertIsApproximatelyEqual(TCRBefore, toBN(dec(2, 18)))
                // assert.isTrue(TCRBefore.eq(toBN(dec(2, 18))))

                const newStableCoinPrice = toBN(dec(95, 16)) // Stable coin drops to .95 cents 
                await priceFeedStableCoin.setPrice(newStableCoinPrice)

                const VCStableAfter = toBN(dec(2000, 18)).mul(toBN(dec(95, 16))).div(toBN(dec(1, 18)))

                const expectedTCR = VCStableAfter.add(toBN(dec(2000, 18))).mul(toBN(dec(1, 18))).div(toBN(dec(2000, 18)))
                const TCRAfter = await th.getTCR(contracts)
                th.assertIsApproximatelyEqual(TCRAfter, expectedTCR)
                // assert.isTrue(TCRAfter.eq(expectedTCR))

                const newStableCoinPrice2 = toBN(dec(105, 16))
                await priceFeedStableCoin.setPrice(newStableCoinPrice2)

                const VCStableAfter2 = toBN(dec(2000, 18)).mul(toBN(dec(105, 16))).div(toBN(dec(1, 18)))
                const expectedTCR2 = VCStableAfter2.add(toBN(dec(2000, 18))).mul(toBN(dec(1, 18))).div(toBN(dec(2000, 18)))
                const TCRAfter2 = await th.getTCR(contracts)
                th.assertIsApproximatelyEqual(TCRAfter2, expectedTCR2)
                // assert.isTrue(TCRAfter2.eq(expectedTCR2))

            })

            it("Including low decimal, Open multi collateral trove, adjust prices individually, check if VC and TCR change accordingly", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenC, tokenLowDecimal], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                // 5 low decimal token worth 5 * 200, with only 6 decimals. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenSuperRisky.address, tokenC.address, tokenLowDecimal.address], [dec(20, 18), dec(5, 18), dec(5, 6)], { from: alice })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const activePoolTokens = await activePool.getAllCollateral()[0]
                const activePoolAmounts = await activePool.getAllCollateral()[1]

                const TCRBefore = await th.getTCR(contracts)

                // (20 * .5 + 5 + 5 ) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRBefore.eq(toBN(dec(2, 18))))

                const newLowDecimalPrice = toBN(dec(400, 18))
                await priceFeedLowDecimal.setPrice(newLowDecimalPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (20 * .5 + 5) * 200 + (5) * 400 = 5000 VC Balance, 5000 / 2000 = 250% collateral ratio
                assert.isTrue(TCRAfter.eq(toBN(dec(25, 17))))

                // Assert TCR = Alice ICR 
                const aliceVC = await troveManager.getTroveVC(alice)
                assert.isTrue(aliceVC.eq(toBN(dec(5000, 18))))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))

                const newRiskyTokenPrice = toBN(dec(100, 18))
                await priceFeedSuperRisky.setPrice(newRiskyTokenPrice)

                // (20 * .5) * 100 + (5) * 200 + (5) * 400 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                const TCRAfter2 = await th.getTCR(contracts)
                assert.isTrue(TCRAfter2.eq(toBN(dec(200, 16))))
            })

            it("When price drops to 0, VC updates accordingly. ", async () => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [tokenSuperRisky, tokenC, tokenLowDecimal], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })

                // 5 low decimal token worth 5 * 200, with only 6 decimals. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [tokenSuperRisky.address, tokenC.address, tokenLowDecimal.address], [dec(20, 18), dec(5, 18), dec(5, 6)], { from: alice })

                const aliceTokens = await getTroveEntireTokens(alice)
                const aliceColls = await getTroveEntireColl(alice)
                const aliceDebt = await getTroveEntireDebt(alice)

                const activePoolTokens = await activePool.getAllCollateral()[0]
                const activePoolAmounts = await activePool.getAllCollateral()[1]

                const TCRBefore = await th.getTCR(contracts)

                // (20 * .5 + 5 + 5 ) * 200 = 4000 VC Balance, 4000 / 2000 = 200% collateral ratio
                assert.isTrue(TCRBefore.eq(toBN(dec(2, 18))))

                const newLowDecimalPrice = toBN(dec(0, 18))
                await priceFeedLowDecimal.setPrice(newLowDecimalPrice)

                const TCRAfter = await th.getTCR(contracts)

                // (20 * .5 + 5) * 200 + (5) * 0 = 3000 VC Balance, 3000 / 2000 = 150% collateral ratio
                assert.isTrue(TCRAfter.eq(toBN(dec(15, 17))))

                // Assert TCR = Alice ICR 
                const aliceVC = await troveManager.getTroveVC(alice)
                assert.isTrue(aliceVC.eq(toBN(dec(3000, 18))))
                assert.isTrue(aliceDebt.eq(toBN(dec(2000, 18))))
            })
        })

        describe('Various Test multi collateral borrow ops', async () => {
            it("Try various operations with lots of accounts and tokens.", async () => {
                const paramsE = {
                    name: "Token E",
                    symbol: "T.E",
                    decimals: 18,
                    ratio: dec(6, 17)
                }
                let result = await deploymentHelper.deployExtraCollateral(contracts, paramsE)
                let tokenE = result.token
                let priceFeedE = result.priceFeed

                const paramsF = {
                    name: "Token F",
                    symbol: "T.F",
                    decimals: 18,
                    ratio: dec(3, 17)
                }
                 result = await deploymentHelper.deployExtraCollateral(contracts, paramsF)
                let tokenF = result.token
                let priceFeedF = result.priceFeed

                const paramsG = {
                    name: "Token G",
                    symbol: "T.G",
                    decimals: 18,
                    ratio: dec(78, 16)
                }
                 result = await deploymentHelper.deployExtraCollateral(contracts, paramsG)
                let tokenG = result.token
                let priceFeedG = result.priceFeed

                const paramsH = {
                    name: "Token H",
                    symbol: "T.H",
                    decimals: 18,
                    ratio: dec(55, 16)
                }
                 result = await deploymentHelper.deployExtraCollateral(contracts, paramsH)
                let tokenH = result.token
                let priceFeedH = result.priceFeed

                const paramsI = {
                    name: "Token I",
                    symbol: "T.I",
                    decimals: 18,
                    ratio: dec(1, 18)
                }
                 result = await deploymentHelper.deployExtraCollateral(contracts, paramsI)
                let tokenI = result.token
                let priceFeedI = result.priceFeed

                await priceFeedE.setPrice(toBN(dec(200, 18)))
                await priceFeedF.setPrice(toBN(dec(200, 18)))
                await priceFeedG.setPrice(toBN(dec(200, 18)))
                await priceFeedH.setPrice(toBN(dec(200, 18)))
                await priceFeedI.setPrice(toBN(dec(200, 18)))

                let accounts = [A, B, C, D, E, F, G, H]
                let tokens = [contracts.weth, contracts.wavax, tokenA, tokenB, tokenC, tokenD, tokenE, tokenF, tokenG, tokenH, tokenI, tokenLowDecimal, tokenRisky, tokenSuperRisky, stableCoin]
                await openTrove({ extraYUSDAmount: toBN(dec(100000, 30)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
                await th.addTokensToAccountsAndOpenTroveWithICR(contracts, toBN(dec(2, 18)), accounts, tokens)
                console.log("Finished adding tokens and opening all troves. ")
                console.log("Adjusting troves randomly.")

                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)

                console.log("Adjusting prices and adjusting troves again. ")
                await priceFeedA.setPrice(toBN(dec(180, 18)))
                await priceFeedB.setPrice(toBN(dec(188, 18)))
                await priceFeedC.setPrice(toBN(dec(222, 18)))
                await priceFeedD.setPrice(toBN(dec(230, 18)))
                await priceFeedE.setPrice(toBN(dec(211, 18)))
                await priceFeedF.setPrice(toBN(dec(214, 18)))
                await priceFeedG.setPrice(toBN(dec(130, 18)))
                await priceFeedH.setPrice(toBN(dec(234, 18)))
                await priceFeedI.setPrice(toBN(dec(820, 18)))
                await contracts.priceFeedETH.setPrice(toBN(dec(250, 18)))
                await contracts.priceFeedAVAX.setPrice(toBN(dec(288, 18)))
                await priceFeedRisky.setPrice(toBN(dec(2235, 18)))
                await priceFeedSuperRisky.setPrice(toBN(dec(555, 18)))
                await priceFeedStableCoin.setPrice(toBN(dec(444, 18)))
                await priceFeedLowDecimal.setPrice(toBN(dec(380, 18)))

                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)
                await th.adjustTrovesRandomly(contracts, accounts, tokens)

                console.log("Finished randomly adjusting troves")
                for (let i = 0; i < accounts.length - 1; i++) {
                    // let balanceBefore = await contracts.weth.balanceOf(accounts[i])
                    const transfer = await yusdToken.transfer(accounts[i], toBN(dec(1000, 30)), { from: whale }) // for borrow fee. 
                    assert.isTrue(transfer.receipt.status)
                    await borrowerOperations.closeTrove({ from: accounts[i] })
                    for (let j = 0; j < tokens.length; j++) {
                        let balance = await tokens[j].balanceOf(accounts[i])
                        if (balance.gt(toBN(dec(1, 30)))){
                            if (tokens[j].address === tokenLowDecimal.address) {
                                await th.assertIsApproximatelyEqual(balance, toBN(dec(1, 30)).add(toBN(dec(1, 10))))
                            } else {
                                await th.assertIsApproximatelyEqual(balance, toBN(dec(1, 30)).add(toBN(dec(1, 22))))
                            }
                        } else {
                            await th.assertIsApproximatelyEqual(balance, toBN(dec(1, 30)))
                        }
                    }
                }
            })
        })

        describe('Various Test fees borrow ops', async () => {
            it("Basic get fee flat open trove before and after", async () => {
                // skip fee bootstrap period 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: carol })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                await newPriceCurve.adjustParams("WAVAX Price curve", "0", dec(5, 15), "0", "0", "0", "0", "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2020, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", "0", dec(1, 16), "0", "0", "0", "0", "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, carol, carol, [contracts.wavax.address, tokenA.address], [dec(20, 18), dec(20, 18)], { from: carol })
                // expect debt to be VCAmount * (0.015) / 2 + 2000 
                const carolDebt = await troveManager.getTroveDebt(carol)
                await th.assertIsApproximatelyEqual(carolDebt, toBN(dec(2060, 18)))

                // Check that sYETI got the correct amount of tokens. + 10 + the normal 0.005 fee.
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)
                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(60, 18))).add(toBN(dec(1800, 18)).sub(YUSDMinAmount)))
            })

            it("Basic get fee sloped open trove before and after", async () => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: carol })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // Now wavax is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2030, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 40 + 120 = 160. 
                // wavax is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, carol, carol, [contracts.wavax.address, tokenA.address], [dec(80, 18), dec(40, 18)], { from: carol })
                // expect debt to be (80 * 200 * 0.010625 + 40 * 200 * 0.00625) / 2 + 2000 = 2110
                const carolDebt = await troveManager.getTroveDebt(carol)
                await th.assertIsApproximatelyEqual(carolDebt, toBN(dec(2220, 18)))

                // Check that sYETI got the correct amount of tokens. + 10 + the normal 0.005 fee.
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)
                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(220, 18))).add(toBN(dec(1800, 18)).sub(YUSDMinAmount)))
            })

            it("Basic get fee sloped open and adjust trove before and after", async () => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // Now wavax is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2030, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 40 + 120 = 160. 
                // wavax is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.adjustTrove([contracts.wavax.address, tokenA.address], [dec(80, 18), dec(40, 18)], [], [], 0, false, bob, bob, th._100pct, { from: bob })
                // expect debt to be (80 * 200 * 0.010625 + 40 * 200 * 0.00625) / 2 + 2000 = 2110 + 15 from earlier
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(2250, 18)))

                // Check that sYETI got the correct amount of tokens. + 110
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(220, 18))))
            })

            it("Test fee cap passed in to open trove", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                const justBelowFeeCap = toBN(dec(30, 18)).add(toBN(dec(1800, 18)).sub(YUSDMinAmount)).mul(toBN(dec(1, 18))).div(toBN(dec(4000, 18))).sub(toBN(dec(1, 1)))
                // bob does not want to pay more than 0.5% fee on his open trove. Now calculated on collateral amount. 
                th.assertRevert(
                    borrowerOperations.openTrove(justBelowFeeCap, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob }),
                    "This tx should revert because the assessed fee is greater than the cap bob passed in."
                )
                // succeeds just below fee cap 
                await borrowerOperations.openTrove(justBelowFeeCap.add(toBN(dec(1, 1))), YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
            })

            it("Test fee cap passed in to adjustTrove", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // Now wavax is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2030, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 40 + 120 = 160. 
                // wavax is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                // nvm, expect fee to be 220.
                const justBelowFeeCap = toBN(dec(220, 18)).mul(toBN(dec(1, 18))).div(toBN(dec(24000, 18))).sub(toBN(dec(1, 1)))
                await th.assertRevert(
                    borrowerOperations.adjustTrove([contracts.wavax.address, tokenA.address], [dec(80, 18), dec(40, 18)], [], [], 0, false, bob, bob, justBelowFeeCap, { from: bob }),
                    "This tx should revert because the assessed fee is greater than the cap bob passed in."
                )
                // This one should go through. 
                await borrowerOperations.adjustTrove([contracts.wavax.address, tokenA.address], [dec(80, 18), dec(40, 18)], [], [], 0, false, bob, bob, justBelowFeeCap.add(toBN(dec(1, 1))), { from: bob })
                // expect debt to be (80 * 200 * 0.010625 + 40 * 200 * 0.00625) / 2 + 2000 = 2110 + 15 from earlier
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(2250, 18)))

                // Check that sYETI got the correct amount of tokens. + 110
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(220, 18))))
            })

            it("Test hard cap on collateral. If owner increases cap, tx should go through", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.wavax.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                // Hard cap set at 1. Won't go through for adding WAVAX
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), dec(7999, 18));
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // bob does not want to pay more than 0.5% fee on his open trove. Now calculated on collateral amount. 
                await th.assertRevert(
                    borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob }),
                    "No capacity for WAVAX. "
                )
                // succeeds after increasing cap. 
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), dec(8001, 18));
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
            })

            it("During bootstrapping period, max fee is 1%", async() => {
                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sfure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(5, 17), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // bob will pay max fee of 1% here 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], { from: bob })
                const bobDebt = await troveManager.getTroveDebt(bob)
                assert.isTrue(bobDebt.sub(toBN(dec(2000, 18))).eq(toBN(dec(40, 18))), "maxFee is 1% ")

                await yusdToken.transfer(bob, dec(1500, 18), { from: alice })
                await borrowerOperations.closeTrove({from: bob})
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], { from: bob })
                const bobDebt2 = await troveManager.getTroveDebt(bob)
                assert.isTrue(bobDebt2.sub(toBN(dec(2000, 18))).gt(toBN(dec(40, 18))), "maxFee no longer applies at 1% ")
            })

            it("Test fee decay without much change in time.", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: carol })

                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], { from: alice })
                // alice pays fee at 50% of the protocol. Carol potentially should pay less than that but it will charge the original fee. 
                const aliceDebt = await troveManager.getTroveDebt(alice)

                // Bob should pay slightly more than alice due to how the price curve is set up. Set to be around 0.875%. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.weth.address, contracts.wavax.address], [dec(100, 18), dec(20, 18)], { from: bob })

                // Carol should pay slightly less than 0.875% fee. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, carol, carol, [contracts.weth.address, contracts.wavax.address], [dec(100, 18), dec(20, 18)], { from: carol })
                const carolDebt = await troveManager.getTroveDebt(carol)
                assert.isTrue(carolDebt.sub(toBN(dec(2000, 18))).lt(toBN(dec(35, 18))), "slightly decayed")
                assert.isTrue(carolDebt.sub(toBN(dec(2000, 18))).gt(toBN(dec(349, 17))), "slightly decayed")
            })

            it("Test fee decay without much change in time stays when price curve changes.", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: carol })

                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], { from: alice })
                // alice pays fee at 50% of the protocol. Carol potentially should pay less than that but it will charge the original fee. 
                const aliceDebt = await troveManager.getTroveDebt(alice)

                // Bob should pay slightly more than alice due to how the price curve is set up. Set to be around 0.875%. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.weth.address, contracts.wavax.address], [dec(100, 18), dec(20, 18)], { from: bob })

                // actually the same price curve but it should keep the same params (last buyback time, etc. )
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve2.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve2.address)

                // Carol should pay slightly less than 0.875% fee. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, carol, carol, [contracts.weth.address, contracts.wavax.address], [dec(100, 18), dec(20, 18)], { from: carol })
                const carolDebt = await troveManager.getTroveDebt(carol)
                assert.isTrue(carolDebt.sub(toBN(dec(2000, 18))).lt(toBN(dec(35, 18))), "slightly decayed")
                assert.isTrue(carolDebt.sub(toBN(dec(2000, 18))).gt(toBN(dec(349, 17))), "slightly decayed")
            })

            it("Test that fee decays after time.", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await th.addMultipleERC20(carol, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: carol })

                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], { from: alice })
                // alice pays fee at 50% of the protocol. Carol potentially should pay less than that but it will charge the original fee. 
                const aliceDebt = await troveManager.getTroveDebt(alice)

                // Bob should pay slightly more than alice due to how the price curve is set up. Set to be around 0.875%. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.weth.address, contracts.wavax.address], [dec(100, 18), dec(20, 18)], { from: bob })

                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 0.5), web3.currentProvider)

                // Carol should pay slightly less than 0.875% fee if not decayed, but will pay her actual fee since the time has passed. 
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, carol, carol, [contracts.weth.address, contracts.wavax.address], [dec(100, 18), dec(20, 18)], { from: carol })
                const carolDebt = await troveManager.getTroveDebt(carol)
                assert.isTrue(carolDebt.sub(toBN(dec(2000, 18))).lt(toBN(dec(35, 18))), "under decay")
                assert.isTrue(carolDebt.sub(toBN(dec(2000, 18))).gt(toBN(dec(30, 18))), "but still not full fee (> 29.28")
            })

            it("Variable fee adjust trove, with collateral out and collateral in", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // Now wavax is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2030, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 40 + 140 - 20 = 160. 
                // wavax is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.adjustTrove([contracts.weth.address, tokenA.address], [dec(100, 18), dec(40, 18)], [contracts.wavax.address], [dec(20, 18)], 0, false, bob, bob, th._100pct, { from: bob })
                // expect debt to be (80 * 200 * 0.010625 + 40 * 200 * 0.00625) / 2 + 2000 = 2110 + 30 from earlier
                // expected debt to be 40 * 200 * 0.00625 + 2000 = 2050 + 30 from earlier
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(2080, 18)))

                // Check that sYETI got the correct amount of tokens. + 50
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(50, 18))))
            })

            it("Variable fee adjust trove, with collateral out > collateral in", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(100, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(100, 18)], { from: bob })
                const bobDebt = await troveManager.getTroveDebt(bob)

                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2150, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 200 + 40 - 80 = 160. 
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.adjustTrove([tokenA.address], [dec(40, 18)], [contracts.wavax.address], [dec(80, 18)], 0, false, bob, bob, th._100pct, { from: bob })
                // 150 from earlier, should be 40 * 200 * 0.00625 + 2000 = 2200, 150 from earlier. 
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(2200, 18)))

                // Check that sYETI got the correct amount of tokens. + 50
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(50, 18))))
            })

            it("Variable fee adjust trove, with paid back debt and collateral in. ", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(100, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(100, 18)], { from: bob })
                const bobDebt = await troveManager.getTroveDebt(bob)

                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2150, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 200 + 40 - 80 = 160. 
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.adjustTrove([tokenA.address], [dec(40, 18)], [contracts.wavax.address], [dec(80, 18)], dec(100, 18), false, bob, bob, th._100pct, { from: bob })
                // 150 from earlier, should be 40 * 200 * 0.00625 + 2000 = 2200, 150 from earlier. Sam fee but minus the 100 paid back. 
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(2100, 18)))

                // Check that sYETI got the correct amount of tokens. + 50
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(50, 18))))
            })

            it("Variable fee adjust trove, with extra debt and collateral in. Applies stacking fee correctly", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(100, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(100, 18)], { from: bob })
                const bobDebt = await troveManager.getTroveDebt(bob)

                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2150, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 200 + 40 - 80 = 160. 
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.adjustTrove([tokenA.address], [dec(40, 18)], [contracts.wavax.address], [dec(80, 18)], dec(100, 18), true, bob, bob, th._100pct, { from: bob })
                // 150 from earlier, should be 40 * 200 * 0.00625 + 2000 = 2200, 150 from earlier. extra 100 debt, plus 0.5% fee. 
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(23005, 17)))

                // Check that sYETI got the correct amount of tokens. + 50 + .5 from flat fee. 
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(505, 17))))
            })

            it("Add coll applies correct fee", async() => {
                // skip fee bootstrap period. 
                await th.fastForwardTime((SECONDS_IN_ONE_DAY * 14), web3.currentProvider)

                // alice will open a trove with a solid amount of tokens, of weth. weth has no additional fee. 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax, tokenA], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })

                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, alice, alice, [contracts.weth.address], [dec(20, 18)], { from: alice })
                // Entire system is collateralized by weth. Bob adds some wavax, which has an updated price curve with flat fee of 0.5%. Make sure that the new debt is correct. 
                const newPriceCurve = await LinearPriceCurve.new();
                await newPriceCurve.setAddresses(contracts.whitelist.address)
                // slope of 0.01, cutoff of 0.005. At 0.5 this should be 0.01. Average of this is 0.0075. Cutoffs are above 100% so they dont get triggered.
                await newPriceCurve.adjustParams("WAVAX Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(contracts.wavax.address, newPriceCurve.address)

                // Now wavax is 50% of the collateral of the protocol, so the two fee points should be 0.5% and 1.5%, resulting in 1% fee.
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(20, 18)], { from: bob })
                // expect debt to be VCAmount * (0.005) / 2 + 2000 
                const bobDebt = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebt, toBN(dec(2030, 18)))

                const sYETIBalanceBefore = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                // Add for carol with two tokens that both have flat fees. Make sure that the fee is correct and summed together
                const newPriceCurve2 = await LinearPriceCurve.new();
                await newPriceCurve2.setAddresses(contracts.whitelist.address)
                await newPriceCurve2.adjustParams("Token A Price curve", dec(1, 16), dec(5, 15), "0", dec(2, 18), "0", dec(2, 18), "0");
                await contracts.whitelist.changePriceCurve(tokenA.address, newPriceCurve2.address)

                // total collateral in the system is 40 + 120 = 160. 
                // wavax is 100 / 160 = 62.5% of total. The fee should be (50% + 62.5%) / 2 => (0.01 + 0.01125) / 2 = 0.010625%
                // tokenA is 40 / 160 = 25% of total. The fee should be (0% + 25%) / 2 => (0.005 + 0.0075) = 0.00625% 
                await borrowerOperations.addColl([contracts.wavax.address, tokenA.address], [dec(80, 18), dec(40, 18)], bob, bob, th._100pct, { from: bob })
                // await borrowerOperations.adjustTrove([contracts.wavax.address, tokenA.address], [dec(80, 18), dec(40, 18)], [], [], 0, false, bob, bob, th._100pct, { from: bob })
                // expect debt to be (80 * 200 * 0.010625 + 40 * 200 * 0.00625) / 2 + 2000 = 2110 + 15 from earlier
                const bobDebtAfter = await troveManager.getTroveDebt(bob)
                await th.assertIsApproximatelyEqual(bobDebtAfter, toBN(dec(2250, 18)))

                // Check that sYETI got the correct amount of tokens. + 110
                const sYETIBalanceAfter = await contracts.yusdToken.balanceOf(YETIContracts.sYETI.address)

                await th.assertIsApproximatelyEqual(sYETIBalanceAfter, sYETIBalanceBefore.add(toBN(dec(220, 18))))

            })
            // it("") test max fee max(new debt in, collateral in)
        })

        describe.only('Lever up', async () => {
            beforeEach(async () => {
                joeRouter = new ethers.Contract("0x60aE616a2155Ee3d9A68541Ba4544862310933d4", abi = routerABI, signer = await hre.ethers.getSigner(H));
                await yusdToken.unprotectedMint(H, dec(100000000, 18));
                await contracts.weth.mint(H, dec(100000000, 18));
                await yusdToken.approve(joeRouter.address, dec(100000000, 18), { from: H })
                await contracts.weth.approve(joeRouter.address, dec(100000000, 18), { from: H })
                await joeRouter.addLiquidity(yusdToken.address, contracts.weth.address, dec(2000000, 18), dec(10000, 18), 0, 0, H, 1737113033, { from: H })

                await yusdToken.unprotectedMint(H, dec(100000000, 18));
                await contracts.wavax.mint(H, dec(100000000, 18));
                await yusdToken.approve(joeRouter.address, dec(100000000, 18), { from: H })
                await contracts.wavax.approve(joeRouter.address, dec(100000000, 18), { from: H })
                await joeRouter.addLiquidity(yusdToken.address, contracts.wavax.address, dec(2000000, 18), dec(10000, 18), 0, 0, H, 1737113033, { from: H })
                await deploymentHelper.deployNewRouter(contracts, {name: "Joe router weth", joeRouter: joeRouter, whitelistCollateral: contracts.weth})
                await deploymentHelper.deployNewRouter(contracts, {name: "Joe router wavax", joeRouter: joeRouter, whitelistCollateral: contracts.wavax})
            })

            it("Basic open trove lever up with one collateral type", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(500, 18)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, 0, alice, alice, [contracts.weth.address], [dec(20, 18)], [dec(3, 18)], [dec(1, 17)], { from: alice })
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1]
                const aliceICR = (await troveManager.getCurrentICR(alice))

                const activePoolRawWethBalance = await contracts.weth.balanceOf(activePool.address)
                assert.isTrue(aliceDebt.eq(toBN(dec(8240, 18))))
                assert.isTrue(aliceICR.gt(toBN(dec(140, 16))))
                assert.isTrue(aliceICR.lt(toBN(dec(150, 16))))
                assert.isTrue(activePoolRawWethBalance.toString() == aliceWeth.toString())
            })

            it("Open trove lever up with multiple collateral types, one lever", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(500, 18)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceICR = (await troveManager.getCurrentICR(alice))

                const activePoolRawWethBalance = await contracts.weth.balanceOf(activePool.address)
                assert.isTrue(aliceDebt.eq(toBN(dec(10250, 18))))
                assert.isTrue(aliceICR.gt(toBN(dec(150, 16))))
                console.log("Alice weth" , aliceWeth.toString())
                console.log("active pool weth", activePoolRawWethBalance.toString())
                assert.isTrue(activePoolRawWethBalance.toString() == aliceWeth.toString())
            })

            it("Open trove lever up with multiple collateral types, multiple lever at once", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(500, 18)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), dec(3, 18)], [dec(1, 17), dec(1, 17)], { from: alice })
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavax = (await troveManager.getTroveColls(alice))[1][1]
                const aliceICR = (await troveManager.getCurrentICR(alice))

                const activePoolRawWethBalance = await contracts.weth.balanceOf(activePool.address)
                const activePoolRawWavaxBalance = await contracts.wavax.balanceOf(activePool.address)
                assert.isTrue(aliceDebt.eq(toBN(dec(18290, 18))))
                console.log("aliceICR", aliceICR.toString())
                assert.isTrue(aliceICR.gt(toBN(dec(130, 16))))
                assert.isTrue(aliceICR.lt(toBN(dec(150, 16))))
                assert.isTrue(activePoolRawWethBalance.toString() == aliceWeth.toString())
                assert.isTrue(activePoolRawWavaxBalance.sub(toBN(dec(500, 18))).toString() == aliceWavax.toString())
                
            })

            it("Adjust trove lever up on same collateral", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, YUSDMinAmount, bob, bob, [contracts.wavax.address], [dec(500, 18)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                // open normally with weth as collateral and 2k debt 
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address], [dec(40, 18)], ["0"], ["0"], { from: alice })
                // then lever up on weth
                await borrowerOperations.addCollLeverUp([contracts.weth.address], [dec(20, 18)], [dec(3, 18)], [dec(1, 17)], "0", alice, alice, th._100pct, { from: alice })
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                // const aliceWavax = (await troveManager.getTroveColls(alice))[1][1]
                const aliceICR = (await troveManager.getCurrentICR(alice))

                const activePoolRawWethBalance = await contracts.weth.balanceOf(activePool.address)
                const activePoolRawWavaxBalance = await contracts.wavax.balanceOf(activePool.address)
                // console.log("Alice debt", aliceDebt.toString())
                assert.isTrue(aliceDebt.eq(toBN(dec(10250, 18))))
                // console.log("aliceICR", aliceICR.toString())
                assert.isTrue(aliceICR.gt(toBN(dec(150, 16))))
                assert.isTrue(aliceICR.lt(toBN(dec(200, 16))))
                assert.isTrue(activePoolRawWethBalance.toString() == aliceWeth.toString())
                // assert.isTrue(activePoolRawWavaxBalance.sub(toBN(dec(500, 18))).toString() == aliceWavax.toString())
            })

            it("Withdraw coll unlever up one asset levered", async() => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, "0", alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })
                // alice has levered up on weth and wavax, and has this amount in her trove: 
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavax = (await troveManager.getTroveColls(alice))[1][1]
                const aliceRawBalance = (await yusdToken.balanceOf(alice))
                assert.isTrue(aliceDebt.eq(toBN(dec(8240, 18))))
                contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await borrowerOperations.withdrawCollUnleverUp([contracts.weth.address], [dec(20, 18)], [dec(1, 17)], dec(3000, 18), alice, alice, {from: alice})
                const aliceDebtAfter = await troveManager.getTroveDebt(alice)
                const aliceWethAfter = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavaxAfter = (await troveManager.getTroveColls(alice))[1][1]
                const aliceRawBalanceAfter = (await yusdToken.balanceOf(alice))
                // alice should have 3000 less debt after since she paid it back from unlevering up
                assert.isTrue(aliceDebtAfter.eq(toBN(dec(5240, 18))))
                // and have sold 20 weth.
                assert.isTrue(aliceWethAfter.eq(aliceWeth.sub(toBN(dec(20, 18)))))
                // and untouched wavax
                assert.isTrue(aliceWavaxAfter.eq(aliceWavax))
                // should have extra balance in her account after, with some unknown slippage. 
                assert.isTrue(aliceRawBalanceAfter.sub(aliceRawBalance).gt(toBN(dec(900, 18))))
            })

            it("Withdraw coll unlever up one asset levered, one not", async() => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, "0", alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })
                // alice has levered up on weth and wavax, and has this amount in her trove: 
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavax = (await troveManager.getTroveColls(alice))[1][1]
                const aliceRawBalance = (await yusdToken.balanceOf(alice))
                assert.isTrue(aliceDebt.eq(toBN(dec(8240, 18))))
                contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await borrowerOperations.withdrawCollUnleverUp([contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(1, 18)], [dec(1, 17), dec(0, 1)], dec(3000, 18), alice, alice, {from: alice})
                const aliceDebtAfter = await troveManager.getTroveDebt(alice)
                const aliceWethAfter = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavaxAfter = (await troveManager.getTroveColls(alice))[1][1]
                const aliceRawBalanceAfter = (await yusdToken.balanceOf(alice))
                // alice should have 3000 less debt after since she paid it back from unlevering up
                assert.isTrue(aliceDebtAfter.eq(toBN(dec(5240, 18))))
                // and have sold 20 weth.
                assert.isTrue(aliceWethAfter.eq(aliceWeth.sub(toBN(dec(20, 18)))))
                // and less wavax now 
                assert.isTrue(aliceWavaxAfter.add(toBN(dec(1, 18))).eq(aliceWavax))
                // should have extra balance in her account after, with some unknown slippage. 
                assert.isTrue(aliceRawBalanceAfter.sub(aliceRawBalance).gt(toBN(dec(900, 18))))
            })

            it("Withdraw coll unlever up, covers extra balance if not enough sold", async() => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, "0", alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })
                // alice has levered up on weth and wavax, and has this amount in her trove: 
                
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavax = (await troveManager.getTroveColls(alice))[1][1]
                assert.isTrue(aliceDebt.eq(toBN(dec(8240, 18))))
                contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                // should revert if she does not have enough YUSD
                await th.assertRevert( borrowerOperations.withdrawCollUnleverUp([contracts.weth.address], [dec(5, 18)], [dec(1, 17)], dec(3000, 18), alice, alice, {from: alice}), 
                    "Not enough balance to cover extra not sold from unlever")

                // give alice some YUSD first from bob
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 25), dec(500, 25), dec(500, 25)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, dec(20000, 18), bob, bob, [contracts.wavax.address], [dec(500, 25)], { from: bob })
                await contracts.yusdToken.transfer(alice, dec(10000, 18), {from: bob})
                const aliceRawBalance = (await yusdToken.balanceOf(alice))
                const bobDebt = await troveManager.getTroveDebt(bob)

                // check active pool raw balances. 
                var activePoolRawWethBalance = (await contracts.weth.balanceOf(contracts.activePool.address))
                var activePoolRawWavaxBalance = (await contracts.wavax.balanceOf(contracts.activePool.address))
                var activePoolVirtualWethBalance = (await contracts.activePool.getCollateralVC(contracts.weth.address)).div(toBN(200))
                var activePoolVirtualYUSDDebt = await contracts.activePool.getYUSDDebt()
                var activePoolVirtualWavaxBalance = (await contracts.activePool.getCollateralVC(contracts.wavax.address)).div(toBN(200))
                assert.isTrue(activePoolRawWethBalance.eq(activePoolVirtualWethBalance))
                assert.isTrue(activePoolRawWavaxBalance.eq(activePoolVirtualWavaxBalance))
                assert.isTrue(activePoolVirtualYUSDDebt.eq(bobDebt.add(aliceDebt)))

                await contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await borrowerOperations.withdrawCollUnleverUp([contracts.weth.address], [dec(5, 18)], [dec(1, 17)], dec(3000, 18), alice, alice, {from: alice})
                const aliceDebtAfter = await troveManager.getTroveDebt(alice)
                const aliceWethAfter = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavaxAfter = (await troveManager.getTroveColls(alice))[1][1]
                const aliceRawBalanceAfter = (await yusdToken.balanceOf(alice))
                // alice should have 3000 less debt after since she paid it back from unlevering up
                assert.isTrue(aliceDebtAfter.eq(toBN(dec(5240, 18))))
                // and have sold 20 weth.
                assert.isTrue(aliceWethAfter.eq(aliceWeth.sub(toBN(dec(5, 18)))))
                // same amount of wavax
                assert.isTrue(aliceWavaxAfter.eq(aliceWavax))
                // should have less balance in her account after 
                assert.isTrue(aliceRawBalanceAfter.lt(aliceRawBalance))

                // once again check raw balance active pool.
                activePoolRawWethBalance = (await contracts.weth.balanceOf(contracts.activePool.address))
                activePoolRawWavaxBalance = (await contracts.wavax.balanceOf(contracts.activePool.address))
                activePoolVirtualWethBalance = (await contracts.activePool.getCollateralVC(contracts.weth.address)).div(toBN(200))
                activePoolVirtualYUSDDebt = await contracts.activePool.getYUSDDebt()
                activePoolVirtualWavaxBalance = (await contracts.activePool.getCollateralVC(contracts.wavax.address)).div(toBN(200))
                assert.isTrue(activePoolRawWethBalance.eq(activePoolVirtualWethBalance))
                assert.isTrue(activePoolRawWavaxBalance.eq(activePoolVirtualWavaxBalance))
                assert.isTrue(activePoolVirtualYUSDDebt.eq(bobDebt.add(aliceDebtAfter)))
            })

            it("Withdraw coll unlever up, extra checks", async() => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await borrowerOperations.openTroveLeverUp(th._100pct, "0", alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })
                // alice has levered up on weth and wavax, and has this amount in her trove: 
                
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavax = (await troveManager.getTroveColls(alice))[1][1]
                assert.isTrue(aliceDebt.eq(toBN(dec(8240, 18))))
                contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                // should revert if she does not have enough YUSD
                await th.assertRevert( borrowerOperations.withdrawCollUnleverUp([contracts.weth.address], [dec(5, 18)], [dec(1, 17)], dec(3000, 18), alice, alice, {from: alice}), 
                    "Not enough balance to cover extra not sold from unlever")

                // give alice some YUSD first from bob
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 25), dec(500, 25), dec(500, 25)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, dec(20000, 18), bob, bob, [contracts.wavax.address], [dec(500, 25)], { from: bob })
                await contracts.yusdToken.transfer(alice, dec(10000, 18), {from: bob})
                const aliceRawBalance = (await yusdToken.balanceOf(alice))
                const bobDebt = await troveManager.getTroveDebt(bob)

                // check active pool raw balances. 
                var activePoolRawWethBalance = (await contracts.weth.balanceOf(contracts.activePool.address))
                var activePoolRawWavaxBalance = (await contracts.wavax.balanceOf(contracts.activePool.address))
                var activePoolVirtualWethBalance = (await contracts.activePool.getCollateralVC(contracts.weth.address)).div(toBN(200))
                var activePoolVirtualYUSDDebt = await contracts.activePool.getYUSDDebt()
                var activePoolVirtualWavaxBalance = (await contracts.activePool.getCollateralVC(contracts.wavax.address)).div(toBN(200))
                assert.isTrue(activePoolRawWethBalance.eq(activePoolVirtualWethBalance))
                assert.isTrue(activePoolRawWavaxBalance.eq(activePoolVirtualWavaxBalance))
                assert.isTrue(activePoolVirtualYUSDDebt.eq(bobDebt.add(aliceDebt)))

                await contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await borrowerOperations.withdrawCollUnleverUp([contracts.weth.address], [dec(5, 18)], [dec(1, 17)], dec(3000, 18), alice, alice, {from: alice})
                const aliceDebtAfter = await troveManager.getTroveDebt(alice)
                const aliceWethAfter = (await troveManager.getTroveColls(alice))[1][0]
                const aliceWavaxAfter = (await troveManager.getTroveColls(alice))[1][1]
                const aliceRawBalanceAfter = (await yusdToken.balanceOf(alice))
                // alice should have 3000 less debt after since she paid it back from unlevering up
                assert.isTrue(aliceDebtAfter.eq(toBN(dec(5240, 18))))
                // and have sold 20 weth.
                assert.isTrue(aliceWethAfter.eq(aliceWeth.sub(toBN(dec(5, 18)))))
                // same amount of wavax
                assert.isTrue(aliceWavaxAfter.eq(aliceWavax))
                // should have less balance in her account after 
                assert.isTrue(aliceRawBalanceAfter.lt(aliceRawBalance))

                // once again check raw balance active pool.
                activePoolRawWethBalance = (await contracts.weth.balanceOf(contracts.activePool.address))
                activePoolRawWavaxBalance = (await contracts.wavax.balanceOf(contracts.activePool.address))
                activePoolVirtualWethBalance = (await contracts.activePool.getCollateralVC(contracts.weth.address)).div(toBN(200))
                activePoolVirtualYUSDDebt = await contracts.activePool.getYUSDDebt()
                activePoolVirtualWavaxBalance = (await contracts.activePool.getCollateralVC(contracts.wavax.address)).div(toBN(200))
                assert.isTrue(activePoolRawWethBalance.eq(activePoolVirtualWethBalance))
                assert.isTrue(activePoolRawWavaxBalance.eq(activePoolVirtualWavaxBalance))
                assert.isTrue(activePoolVirtualYUSDDebt.eq(bobDebt.add(aliceDebtAfter)))
            })

            it("Full close trove unlever up one asset", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 25), dec(500, 25), dec(500, 25)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, dec(20000, 18), bob, bob, [contracts.wavax.address], [dec(500, 25)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })
                const aliceRawWethBefore = (await contracts.weth.balanceOf(alice))
                const aliceDebt = await troveManager.getTroveDebt(alice)
                const aliceWeth = (await troveManager.getTroveColls(alice))[1][0]
                const aliceICR = (await troveManager.getCurrentICR(alice))

                const activePoolRawWethBalance = await contracts.weth.balanceOf(activePool.address)
                assert.isTrue(aliceDebt.eq(toBN(dec(10250, 18))))
                assert.isTrue(aliceICR.gt(toBN(dec(150, 16))))
                assert.isTrue(activePoolRawWethBalance.toString() == aliceWeth.toString())

                await contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await th.assertRevert(borrowerOperations.closeTroveUnlever([contracts.weth.address], [dec(20, 18)], [dec(1, 17)], {from: alice}), 
                    "should revert if not enough YUSD to cover remaining balance. ")

                await contracts.yusdToken.transfer(alice, dec(10000, 18), {from: bob})
                const aliceYUSDBalanceBefore = (await yusdToken.balanceOf(alice))
                
                await borrowerOperations.closeTroveUnlever([contracts.weth.address], [dec(20, 18)], [dec(1, 17)], {from: alice})

                // make sure that alice has closed status (2)
                const aliceStatus = await troveManager.getTroveStatus(alice)
                assert.isTrue(aliceStatus.eq(toBN("2")))

                const bobDebt = await troveManager.getTroveDebt(bob)
                // check active pool balances and raw balances
                // active pool should only have debt from bob and coll from alice, 
                const activePoolRawWethBalanceAfter = await contracts.weth.balanceOf(activePool.address)
                const activePoolRawWavaxBalanceAfter = await contracts.wavax.balanceOf(activePool.address)
                const activePoolVirtualWethBalance = (await contracts.activePool.getCollateralVC(contracts.weth.address)).div(toBN(200))
                const activePoolVirtualWavaxBalance = (await contracts.activePool.getCollateralVC(contracts.wavax.address)).div(toBN(200))
                const activePoolVirtualYUSDDebt = await contracts.activePool.getYUSDDebt()
                assert.isTrue(activePoolRawWethBalanceAfter.eq(activePoolVirtualWethBalance))
                assert.isTrue(activePoolRawWavaxBalanceAfter.eq(activePoolVirtualWavaxBalance))
                assert.isTrue(activePoolVirtualYUSDDebt.eq(bobDebt))

                // assert alice's balances are correct
                // alice should have received all of her coll back. So the amount that was levered up, minus 20 weth. 
                // Her YUSD balance should have decreased by the corresponding amount as well. 
                const aliceRawWethAfter = await contracts.weth.balanceOf(alice)
                const aliceRawWavax = await contracts.wavax.balanceOf(alice)
                const aliceYUSDAfter = await contracts.yusdToken.balanceOf(alice)

                assert.isTrue(aliceRawWethAfter.sub(aliceRawWethBefore).eq(aliceWeth.sub(toBN(dec(20, 18)))))
                assert.isTrue(aliceRawWavax.eq(toBN(dec(500, 18))))

                // yusd balance should be less than before. debt = toBN(dec(10250, 18))
                // by selling 20 weth = 20 * ~200 = 4000, she should have paid back about 6000 YUSD from her own balance
                await th.assertIsApproximatelyEqual(((aliceYUSDBalanceBefore.sub(aliceYUSDAfter)).div(toBN(dec(1, 18)))), toBN(dec(6000, 0)), 50)
            })

            it("open trove reverts when max slippage is overtaken", async() => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.assertRevert(
                    borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 1), "0"], { from: alice }),
                    "Small slippage overtaken"
                )
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 16), "0"], { from: alice })
            })

            it("add coll reverts when max slippage is overtaken", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 25), dec(500, 25), dec(500, 25)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, dec(20000, 18), bob, bob, [contracts.wavax.address], [dec(500, 25)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })

                // make the price ~200 again
                joeRouter = new ethers.Contract("0x60aE616a2155Ee3d9A68541Ba4544862310933d4", abi = routerABI, signer = await hre.ethers.getSigner(H));
                await joeRouter.swapExactTokensForTokens(dec(40, 18), 1, [contracts.weth.address, contracts.yusdToken.address], H, dec(1, 50), {from: H})

                await contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await th.assertRevert(borrowerOperations.addCollLeverUp([contracts.weth.address], [dec(20, 18)], [dec(3, 18)], [dec(1, 1)], "0", alice, alice, th._100pct, { from: alice }), 
                    "should revert if not enough YUSD to cover remaining balance. ")
            })

            it("withdraw coll reverts when max slippage is overtaken", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 25), dec(500, 25), dec(500, 25)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, dec(20000, 18), bob, bob, [contracts.wavax.address], [dec(500, 25)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })

                // make the price ~200 again
                joeRouter = new ethers.Contract("0x60aE616a2155Ee3d9A68541Ba4544862310933d4", abi = routerABI, signer = await hre.ethers.getSigner(H));
                await joeRouter.swapExactTokensForTokens(dec(40, 18), 1, [contracts.weth.address, contracts.yusdToken.address], H, dec(1, 50), {from: H})

                await contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await th.assertRevert(borrowerOperations.withdrawCollUnleverUp([contracts.weth.address], [dec(20, 18)], [dec(1, 1)], dec(3000, 18), alice, alice, {from: alice}),
                    "should revert if not enough YUSD to cover remaining balance. ")
            })

            it("close trove reverts when max slippage is overtaken", async() => {
                await th.addMultipleERC20(bob, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 25), dec(500, 25), dec(500, 25)], { from: bob })
                await borrowerOperations.openTrove(th._100pct, dec(20000, 18), bob, bob, [contracts.wavax.address], [dec(500, 25)], { from: bob })
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                
                await borrowerOperations.openTroveLeverUp(th._100pct, dec(2000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(3, 18), "0"], [dec(1, 17), "0"], { from: alice })

                // make the price ~200 again
                joeRouter = new ethers.Contract("0x60aE616a2155Ee3d9A68541Ba4544862310933d4", abi = routerABI, signer = await hre.ethers.getSigner(H));
                await joeRouter.swapExactTokensForTokens(dec(40, 18), 1, [contracts.weth.address, contracts.yusdToken.address], H, dec(1, 50), {from: H})

                await contracts.weth.approve((await contracts.whitelist.getDefaultRouterAddress(contracts.weth.address)), dec(20, 18), {from: alice})
                await th.assertRevert(borrowerOperations.closeTroveUnlever([contracts.weth.address], [dec(20, 18)], [dec(1, 17)], {from: alice}), 
                    "should revert if not enough YUSD to cover remaining balance. ")
            })

            it("reverts when resulting value would be < 110%", async() => {
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.assertRevert(
                    borrowerOperations.openTroveLeverUp(th._100pct, dec(3000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(11, 18), "0"], [dec(1, 17), "0"], { from: alice }), 
                    "Should revert if < 110% after"
                )
            })

            it("reverts when leverage or slippage is invalid", async() => {
                // reverts if leverage <= 1, or slippage > 1 
                await th.addMultipleERC20(alice, borrowerOperations.address, [contracts.weth, contracts.wavax], [dec(500, 18), dec(500, 18), dec(500, 18)], { from: alice })
                await th.assertRevert(
                    borrowerOperations.openTroveLeverUp(th._100pct, dec(3000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(1, 15), "0"], [dec(1, 17), "0"], { from: alice }), 
                    "Should revert if leverage <= 1 but not 0"
                )
                await th.assertRevert(
                    borrowerOperations.openTroveLeverUp(th._100pct, dec(3000, 18), alice, alice, [contracts.weth.address, contracts.wavax.address], [dec(20, 18), dec(20, 18)], [dec(5, 18), "0"], [dec(11, 17), "0"], { from: alice }), 
                    "Should revert if slippage > 1"
                )
            })

            // it("Wrapped JLP lever up", async() => { 
                
            // })
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
