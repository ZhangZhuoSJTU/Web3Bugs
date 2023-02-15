const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester")
const LiquityBaseTester = artifacts.require("./LiquityBaseTester")

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
    let liquityBaseTester

    let a1
    let a2
    let a3
    let a4
    let a5
    let whitelistedAddresses = []

    let sum
    let sumTokens
    let sumAmounts

    let sub
    let subTokens
    let subAmounts

    let a1IDX
    let a2IDX
    let a3IDX
    let a4IDX
    let a5IDX

    let result

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
        before(async () => {
            contracts = await deploymentHelper.deployLiquityCore()
            contracts.borrowerOperations = await BorrowerOperationsTester.new()
            contracts.troveManager = await TroveManagerTester.new()
            contracts.liquityBaseTester = await LiquityBaseTester.new()
            LiquityBaseTester.setAsDeployed(defaultPool)
            liquityBaseTester = contracts.liquityBaseTester
            
            contracts = await deploymentHelper.deployYUSDTokenTester(contracts)
            const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

            await deploymentHelper.connectYETIContracts(YETIContracts)
            await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
            await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

            await liquityBaseTester.setAddresses(contracts.whitelist.address, contracts.defaultPool.address, contracts.activePool.address)

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

            sYETI = YETIContracts.sYETI
            yetiToken = YETIContracts.yetiToken

            YUSD_GAS_COMPENSATION = await borrowerOperations.YUSD_GAS_COMPENSATION()
            MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
            BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()

            const paramsSuperRisky = {
                name: "Super Risky Token",
                symbol: "T.SR",
                decimals: 18,
                ratio: dec(5, 17) // 50%
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsSuperRisky)
            let tokenSuperRisky = result.token

            const paramsLowDecimal = {
                name: "Low Decimal Token",
                symbol: "T.LD",
                decimals: 6,
                ratio: dec(1, 18)
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsLowDecimal)
            let tokenLowDecimal = result.token

            const paramsStableCoin = {
                name: "USD Coin",
                symbol: "USDC",
                decimals: 18,
                ratio: dec(105, 16) // 105%
            }
            result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
            let stableCoin = result.token

            a1 = contracts.wavax.address
            a2 = contracts.weth.address
            a3 = stableCoin.address
            a4 = tokenSuperRisky.address
            a5 = tokenLowDecimal.address

            let i;
            for (i = 0; i < 50; i++) {
                result = await deploymentHelper.deployExtraCollateral(contracts, paramsStableCoin)
                // let token = result.token
                // let tokenAddress = token.address
                // whitelistedAddresses.push(tokenAddress);
            }
            whitelistedAddresses = await contracts.whitelist.getValidCollateral();
        })

        describe('Left Sum Colls Tests', async () => {
            it("leftSumColls(): empty second token/array ", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                const tokens2 = [];
                const amounts2 = [];

                sum = await liquityBaseTester.leftSumColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(sumAmounts[i].toString(), amounts1[i].toString());
                }
            })

            it("leftSumColls(): non-empty second token/array with tokens = all whitelisted tokens", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                const tokens2 = whitelistedAddresses;
                const amounts2 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                let amounts3 = []

                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    amounts3.push(amounts1[i] + amounts2[i]);
                }

                assert.equal(tokens1.length, amounts1.length);
                assert.equal(tokens2.length, amounts2.length);

                sum = await liquityBaseTester.leftSumColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(sumAmounts[i].toString(), amounts3[i].toString());
                }
            })

            it("leftSumColls(): non-empty second token/array in order with tokens != all whitelisted tokens", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                const tokens2 = [a2, a4];
                const amounts2 = [1502, 12490]
                let amounts3 = [...amounts1]
                a4IDX = await contracts.whitelist.getIndex(a4);
                a2IDX = await contracts.whitelist.getIndex(a2);

                amounts3[a2IDX] = amounts3[a2IDX] + 1502;
                amounts3[a4IDX] = amounts3[a4IDX] + 12490;

                assert.equal(tokens1.length, amounts1.length);
                assert.equal(tokens2.length, amounts2.length);

                sum = await liquityBaseTester.leftSumColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);

                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(sumAmounts[i].toString(), amounts3[i].toString());
                }
            })

            it("leftSumColls(): non-empty second token/array out of order with tokens != all whitelisted tokens", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                const tokens2 = [a4, a2];
                const amounts2 = [1502, 12490]
                let amounts3 = [...amounts1]
                a4IDX = await contracts.whitelist.getIndex(a4);
                a2IDX = await contracts.whitelist.getIndex(a2);

                amounts3[a2IDX] = amounts3[a2IDX] + 12490;
                amounts3[a4IDX] = amounts3[a4IDX] + 1502;

                assert.equal(tokens1.length, amounts1.length);
                assert.equal(tokens2.length, amounts2.length);

                sum = await liquityBaseTester.leftSumColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);

                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(sumAmounts[i].toString(), amounts3[i].toString());
                }
            })

        })

        describe('Normal Sum Colls Tests', async () => {
            it("Sum arrays Same Length and Tokens ", async () => {
                const tokens1 = [a1, a2];
                const amounts1 = [500, 240];
                const tokens2 = [a1, a2];
                const amounts2 = [250, 0]
                const expectedA1 = "750"
                const expectedA2 = "240"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
            })

            it("Sum arrays Different Length and Partially Same Tokens ", async () => {
                const tokens1 = [a1, a2];
                const amounts1 = [500, 240];
                const tokens2 = [a1];
                const amounts2 = [250]
                const expectedA1 = "750"
                const expectedA2 = "240"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
            })

            it("Sum arrays Same Length and Different Tokens ", async () => {
                const tokens1 = [a1];
                const amounts1 = [500];
                const tokens2 = [a2];
                const amounts2 = [250]
                const expectedA1 = "500"
                const expectedA2 = "250"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
            })

            it("Sum arrays Same Length and Different Tokens-Large Numbers", async () => {
                const tokens1 = [a1];
                const amounts1 = ["50000000012401249000"];
                const tokens2 = [a2];
                const amounts2 = ["50000000012401249000"]
                const expectedA1 = "50000000012401249000"
                const expectedA2 = "50000000012401249000"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
            })

            it("Sum arrays Different Length and Different Tokens", async () => {
                const tokens1 = [a1];
                const amounts1 = [500];
                const tokens2 = [a2, a3];
                const amounts2 = [250, 200]
                const expectedA1 = "500"
                const expectedA2 = "250"
                const expectedA3 = "200"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
            })

            it("Sum arrays empty colls plus non-empty colls", async () => {
                const tokens1 = [];
                const amounts1 = [];
                const tokens2 = [a1, a2, a3];
                const amounts2 = [500, 250, 200]
                const expectedA1 = "500"
                const expectedA2 = "250"
                const expectedA3 = "200"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
            })

            it("Sum arrays out of order-different lengths", async () => {
                const tokens1 = [a3, a2];
                const amounts1 = [1235, 152];
                const tokens2 = [a1, a2, a3];
                const amounts2 = [500, 250, 200]
                const expectedA1 = "500"
                const expectedA2 = "402"
                const expectedA3 = "1435"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
            })

            it("Sum arrays out of order-different lengths and many collaterals", async () => {
                const tokens1 = [a3, a2, a4, a5];
                const amounts1 = [1235, 152, 142, 124];
                const tokens2 = [a1, a2, a3];
                const amounts2 = [500, 250, 200]
                const expectedA1 = "500"
                const expectedA2 = "402"
                const expectedA3 = "1435"
                const expectedA4 = "142"
                const expectedA5 = "124"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                a4IDX = sumTokens.indexOf(a4);
                a5IDX = sumTokens.indexOf(a5);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
                assert.equal(sumAmounts[a4IDX].toString(), expectedA4);
                assert.equal(sumAmounts[a5IDX].toString(), expectedA5);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                a4IDX = sumTokens.indexOf(a4);
                a5IDX = sumTokens.indexOf(a5);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
                assert.equal(sumAmounts[a4IDX].toString(), expectedA4);
                assert.equal(sumAmounts[a5IDX].toString(), expectedA5);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                a4IDX = sumTokens.indexOf(a4);
                a5IDX = sumTokens.indexOf(a5);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
                assert.equal(sumAmounts[a4IDX].toString(), expectedA4);
                assert.equal(sumAmounts[a5IDX].toString(), expectedA5);
            })

            it("Sum arrays-same length and 50 collaterals", async () => {
                const tokens1 = whitelistedAddresses
                // randomly generated N = tokens1.length length array 0 <= A[N] <= 39
                const amounts1 = Array.from({length: tokens1.length}, () => Math.floor(Math.random() * 120125888));

                const tokens2 = whitelistedAddresses
                // randomly generated N = tokens1.length length array 0 <= A[N] <= 39
                const amounts2 = Array.from({length: tokens2.length}, () => Math.floor(Math.random() * 1500009));

                const amounts3 = []

                for (let i = 0;  i < whitelistedAddresses.length; i++) {
                    amounts3.push(amounts1[i] + amounts2[i]);
                }

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    let address = whitelistedAddresses[i];
                    let IDX = sumTokens.indexOf(address);
                    assert.equal(sumAmounts[IDX].toString(), amounts3[i].toString());
                }

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    let address = whitelistedAddresses[i];
                    let IDX = sumTokens.indexOf(address);
                    assert.equal(sumAmounts[IDX].toString(), amounts3[i].toString());
                }

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    let address = whitelistedAddresses[i];
                    let IDX = sumTokens.indexOf(address);
                    assert.equal(sumAmounts[IDX].toString(), amounts3[i].toString());
                }
            })

            it("Sum arrays out of order-same length", async () => {
                const tokens1 = [a3, a2, a1];
                const amounts1 = [1235, 152, 124];
                const tokens2 = [a1, a2, a3];
                const amounts2 = [500, 250, 200]
                const expectedA1 = "624"
                const expectedA2 = "402"
                const expectedA3 = "1435"

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                a3IDX = sumTokens.indexOf(a3);
                assert.equal(sumAmounts[a1IDX].toString(), expectedA1);
                assert.equal(sumAmounts[a2IDX].toString(), expectedA2);
                assert.equal(sumAmounts[a3IDX].toString(), expectedA3);
            })

            it("Sum arrays Both empty colls", async () => {
                const tokens1 = [];
                const amounts1 = [];
                const tokens2 = [];
                const amounts2 = []

                sum = await liquityBaseTester.sumCollsTwoColls(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts.length, 0);
                assert.equal(sumTokens.length, 0);

                sum = await liquityBaseTester.sumCollsOneCollsOneSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts.length, 0);
                assert.equal(sumTokens.length, 0);

                sum = await liquityBaseTester.sumCollsTwoSplit(tokens1, amounts1, tokens2, amounts2);
                [sumTokens, sumAmounts] = th.getEmittedSumValues(sum);
                a1IDX = sumTokens.indexOf(a1);
                a2IDX = sumTokens.indexOf(a2);
                assert.equal(sumAmounts.length, 0);
                assert.equal(sumTokens.length, 0);
            })
        })

        describe("Left Sub Colls Tests", async() => {
            it("leftSubColls(): empty second token/array ", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                const tokens2 = [];
                const amounts2 = [];

                sub = await liquityBaseTester.leftSubColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(subAmounts[i].toString(), amounts1[i].toString());
                }
            })

            it("leftSubColls(): non-empty second token/array with tokens = all whitelisted tokens", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => (130125888 + Math.floor(Math.random() * 120125888)));
                const tokens2 = whitelistedAddresses;
                const amounts2 = Array.from({length: whitelistedAddresses.length}, () => Math.floor(Math.random() * 120125888));
                let amounts3 = []

                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    amounts3.push(amounts1[i] - amounts2[i]);
                }

                assert.equal(tokens1.length, amounts1.length);
                assert.equal(tokens2.length, amounts2.length);

                sub = await liquityBaseTester.leftSubColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(subAmounts[i].toString(), amounts3[i].toString());
                }
            })

            it("leftSubColls(): non-empty second token/array in order with tokens != all whitelisted tokens", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => (300000 + Math.floor(Math.random() * 120125888)));
                const tokens2 = [a2, a4];
                const amounts2 = [1502, 12490]
                let amounts3 = [...amounts1]
                a4IDX = await contracts.whitelist.getIndex(a4);
                a2IDX = await contracts.whitelist.getIndex(a2);

                amounts3[a2IDX] = amounts3[a2IDX] - 1502;
                amounts3[a4IDX] = amounts3[a4IDX] - 12490;

                assert.equal(tokens1.length, amounts1.length);
                assert.equal(tokens2.length, amounts2.length);

                sub = await liquityBaseTester.leftSubColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);

                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(subAmounts[i].toString(), amounts3[i].toString());
                }
            })

            it("leftSubColls(): non-empty second token/array out of order with tokens != all whitelisted tokens", async () => {
                const tokens1 = whitelistedAddresses;
                const amounts1 = Array.from({length: whitelistedAddresses.length}, () => (300000 + Math.floor(Math.random() * 120125888)));
                const tokens2 = [a4, a2];
                const amounts2 = [1502, 12490]
                let amounts3 = [...amounts1]
                a2IDX = await contracts.whitelist.getIndex(a2);
                a4IDX = await contracts.whitelist.getIndex(a4);

                amounts3[a2IDX] = amounts3[a2IDX] - 12490;
                amounts3[a4IDX] = amounts3[a4IDX] - 1502;

                assert.equal(tokens1.length, amounts1.length);
                assert.equal(tokens2.length, amounts2.length);

                sub = await liquityBaseTester.leftSubColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);

                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    assert.equal(subAmounts[i].toString(), amounts3[i].toString());
                }
            })

        })

        describe('Normal Sub Colls Tests', async () => {
            it("subColls(): Same Length and Tokens ", async () => {
                const tokens1 = [a1, a2];
                const amounts1 = [500, 240];
                const tokens2 = [a1, a2];
                const amounts2 = [250, 0]
                const expectedA1 = "250"
                const expectedA2 = "240"

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
            })

            it("subColls(): Same Length and Tokens That goes to 0", async () => {
                const tokens1 = [a1, a2];
                const amounts1 = [500, 240];
                const tokens2 = [a1, a2];
                const amounts2 = [250, 240]
                const expectedA1 = "250"
                const expectedA2 = "0"

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts.length, 1);
            })

            it("subColls(): Different Length and Partially Same Tokens ", async () => {
                const tokens1 = [a1, a2];
                const amounts1 = [500, 240];
                const tokens2 = [a1];
                const amounts2 = [250]
                const expectedA1 = "250"
                const expectedA2 = "240"

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
            })

            it("subColls(): Different Length and Different Tokens Not of Order", async () => {
                const tokens1 = [a1, a2, a3];
                const amounts1 = [500, 423, 1240];
                const tokens2 = [a2, a3];
                const amounts2 = [200, 250]
                const expectedA1 = "500"
                const expectedA2 = "223"
                const expectedA3 = "990"

                sum = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sum);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                a3IDX = subTokens.indexOf(a3);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
                assert.equal(subAmounts[a3IDX].toString(), expectedA3);
            })

            it("subColls(): Different Length and Different Tokens Out of Order", async () => {
                const tokens1 = [a1, a2, a3];
                const amounts1 = [500, 423, 1240];
                const tokens2 = [a3, a2];
                const amounts2 = [250, 200]
                const expectedA1 = "500"
                const expectedA2 = "223"
                const expectedA3 = "990"

                sum = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sum);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                a3IDX = subTokens.indexOf(a3);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
                assert.equal(subAmounts[a3IDX].toString(), expectedA3);
            })

            it("subColls() non-empty colls minus empty colls", async () => {
                const tokens1 = [a1, a2, a3];
                const amounts1 = [500, 250, 200];
                const tokens2 = [];
                const amounts2 = [];
                const expectedA1 = "500"
                const expectedA2 = "250"
                const expectedA3 = "200"

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                a3IDX = subTokens.indexOf(a3);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
                assert.equal(subAmounts[a3IDX].toString(), expectedA3);
            })

            it("subColls() out of order-different lengths and many collaterals", async () => {
                const tokens1 = [a3, a2, a4, a1];
                const amounts1 = [1235, 730, 6360, 1420];
                const tokens2 = [a1, a2, a3];
                const amounts2 = [500, 250, 200]
                const expectedA1 = "920"
                const expectedA2 = "480"
                const expectedA3 = "1035"
                const expectedA4 = "6360"

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                a3IDX = subTokens.indexOf(a3);
                a4IDX = subTokens.indexOf(a4);
                a5IDX = subTokens.indexOf(a5);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
                assert.equal(subAmounts[a3IDX].toString(), expectedA3);
                assert.equal(subAmounts[a4IDX].toString(), expectedA4);
            })

            it("subColls()-same length and 50 collaterals", async () => {
                const tokens1 = whitelistedAddresses
                // randomly generated N = tokens1.length length array 0 <= A[N] <= 39
                const amounts1 = Array.from({length: tokens1.length}, () =>  (100000000 + Math.floor(Math.random() * 120125888)));

                const tokens2 = whitelistedAddresses
                // randomly generated N = tokens1.length length array 0 <= A[N] <= 39
                const amounts2 = Array.from({length: tokens2.length}, () => Math.floor(Math.random() * 1500009));

                const amounts3 = []

                for (let i = 0;  i < whitelistedAddresses.length; i++) {
                    amounts3.push(amounts1[i] - amounts2[i]);
                }

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                for (let i = 0; i < whitelistedAddresses.length; i++) {
                    let address = whitelistedAddresses[i];
                    let IDX = subTokens.indexOf(address);
                    assert.equal(subAmounts[IDX].toString(), amounts3[i].toString());
                }
            })

            it("subColls() out of order-same length", async () => {
                const tokens1 = [a3, a2, a1];
                const amounts1 = [1235, 250, 623];
                const tokens2 = [a1, a2, a3];
                const amounts2 = [500, 123, 200]
                const expectedA1 = "123"
                const expectedA2 = "127"
                const expectedA3 = "1035"

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                a3IDX = subTokens.indexOf(a3);
                assert.equal(subAmounts[a1IDX].toString(), expectedA1);
                assert.equal(subAmounts[a2IDX].toString(), expectedA2);
                assert.equal(subAmounts[a3IDX].toString(), expectedA3);
            })

            it("subColls() Both empty colls", async () => {
                const tokens1 = [];
                const amounts1 = [];
                const tokens2 = [];
                const amounts2 = []

                sub = await liquityBaseTester.subColls(tokens1, amounts1, tokens2, amounts2);
                [subTokens, subAmounts] = th.getEmittedSumValues(sub);
                a1IDX = subTokens.indexOf(a1);
                a2IDX = subTokens.indexOf(a2);
                assert.equal(subAmounts.length, 0);
                assert.equal(subTokens.length, 0);
            })
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