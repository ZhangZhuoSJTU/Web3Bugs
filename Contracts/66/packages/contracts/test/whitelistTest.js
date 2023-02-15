const { ETHERSCAN_BASE_URL } = require("../mainnetDeployment/deploymentParams.avalanche.js")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const Whitelist = artifacts.require("./Whitelist.sol")
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

    let tokensToOracles = new Map();
    let tokensToCurve = new Map();

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
            weth = contracts.weth
            wavax = contracts.wavax
            sYETI = YETIContracts.sYETI
            yetiToken = YETIContracts.yetiToken
            communityIssuance = YETIContracts.communityIssuance
            lockupContractFactory = YETIContracts.lockupContractFactory

            var params = {
                _collateral: contracts.weth.address,
                _minRatio: "1000000000000000000",
                _oracle: priceFeedETH.address,
                _decimals: 18,
                _priceCurve: contracts.PriceCurveETH.address
            }

            params = {
                _collateral: contracts.wavax.address,
                _minRatio: "1000000000000000000",
                _oracle: priceFeedAVAX.address,
                _decimals: 18,
                _priceCurve: contracts.PriceCurveAVAX.address
            }

            YUSD_GAS_COMPENSATION = await borrowerOperations.YUSD_GAS_COMPENSATION()
            MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
            BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()

            
            tokensToCurve.set(contracts.weth.address, contracts.PriceCurveETH);
            tokensToCurve.set(contracts.wavax.address, contracts.PriceCurveAVAX);

            
            tokensToOracles.set(contracts.weth.address, priceFeedETH);
            tokensToOracles.set(contracts.wavax.address, priceFeedAVAX);
        })

        

        it("deprecateCollateral(), loop through valid collateral and delete", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            // console.log("validCollateral:" + validCollateral);
            for (let i = 0; i < validCollateral.length; i++) {
                assert.isTrue(await whitelist.getIsActive(validCollateral[i]), "Collateral shouldn't be deprecated");
                await whitelist.deprecateCollateral(validCollateral[i]);
                // newValidCollateral = await whitelist.getValidCollateral();
                // console.log("validCollateral after:" + newValidCollateral);
                // assert.isFalse(newValidCollateral.includes(validCollateral[i]), "Collateral in validCollateral");
                // console.log(await whitelist.getIsActive(validCollateral[i]));
                assert.isFalse(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
            }
            // console.log("validCollateral after:" + validCollateral);
            
        })

        it("deprecateCollateral(), try deprecating deprecated collateral", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            // console.log("validCollateral:" + validCollateral);
            for (let i = 0; i < validCollateral.length; i++) {
                assert.isTrue(await whitelist.getIsActive(validCollateral[i]), "Collateral shouldn't be deprecated");
                await whitelist.deprecateCollateral(validCollateral[i]);
                // newValidCollateral = await whitelist.getValidCollateral();
                // console.log("validCollateral after:" + newValidCollateral);
                // assert.isFalse(newValidCollateral.includes(validCollateral[i]), "Collateral in validCollateral");
                // console.log(await whitelist.getIsActive(validCollateral[i]));
                assert.isFalse(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                
            }
            for (let i = 0; i < validCollateral.length; i++) {
                assert.isFalse(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                assertRevert(whitelist.deprecateCollateral(validCollateral[i]));
                // newValidCollateral = await whitelist.getValidCollateral();
                // console.log("validCollateral after:" + newValidCollateral);
                // assert.isFalse(newValidCollateral.includes(validCollateral[i]), "Collateral in validCollateral");
                // console.log(await whitelist.getIsActive(validCollateral[i]));
                assert.isFalse(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                
            }
            // console.log("validCollateral after:" + validCollateral);
            
        })

        it("undeprecateCollateral(), loop through valid collateral and delete and readd", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            // console.log("validCollateral:" + validCollateral);
            for (let i = 0; i < validCollateral.length; i++) {
                assert.isTrue(await whitelist.getIsActive(validCollateral[i]), "Collateral shouldn't be deprecated");
                await whitelist.deprecateCollateral(validCollateral[i]);
                // newValidCollateral = await whitelist.getValidCollateral();
                // console.log("validCollateral after:" + newValidCollateral);
                // assert.isFalse(newValidCollateral.includes(validCollateral[i]), "Collateral in validCollateral");
                // console.log(await whitelist.getIsActive(validCollateral[i]));
                assert.isFalse(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                
            }
            for (let i = 0; i < validCollateral.length; i++) {
                assert.isFalse(await whitelist.getIsActive(validCollateral[i]), "Collateral shouldn't be deprecated");
                await whitelist.undeprecateCollateral(validCollateral[i]);
                // newValidCollateral = await whitelist.getValidCollateral();
                // console.log("validCollateral after:" + newValidCollateral);
                // assert.isFalse(newValidCollateral.includes(validCollateral[i]), "Collateral in validCollateral");
                // console.log(await whitelist.getIsActive(validCollateral[i]));
                assert.isTrue(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                
            }
            // console.log("validCollateral after:" + validCollateral);
            
        })

        it("undeprecateCollateral(), try undeprecating undeprecated collateral", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                assert.isTrue(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                assertRevert(whitelist.undeprecateCollateral(validCollateral[i]));
                // newValidCollateral = await whitelist.getValidCollateral();
                // console.log("validCollateral after:" + newValidCollateral);
                // assert.isFalse(newValidCollateral.includes(validCollateral[i]), "Collateral in validCollateral");
                // console.log(await whitelist.getIsActive(validCollateral[i]));
                assert.isTrue(await whitelist.getIsActive(validCollateral[i]), "Collateral should be deprecated");
                
            }
            // console.log("validCollateral after:" + validCollateral);
            
        })


        it("changeRatio(), loop through valid collateral and change ratio", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                let ratio = await whitelist.getRatio(validCollateral[i]);
                await whitelist.changeRatio(validCollateral[i], dec(parseInt(Math.random()*110), 16));
                assert.notEqual(ratio, await whitelist.getRatio(validCollateral[i]))
            }
        })

        it("changeRatio(), loop through valid collateral and change ratio. Try setting higher ratio", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                let ratio = await whitelist.getRatio(validCollateral[i]);
                assertRevert(whitelist.changeRatio(validCollateral[i], dec(110+parseInt(Math.random()*100), 16)));
            }
        })

        it("getOracle(), check oracles for each collateral", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                let oracle = await whitelist.getOracle(validCollateral[i]);
                assert.equal(oracle, tokensToOracles.get(validCollateral[i]).address)
            }
        })

        it("changeOracle(), loop through valid collateral and change oracle", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                let oracle = await whitelist.getOracle(validCollateral[i]);
                await whitelist.changeOracle(validCollateral[i], validCollateral[i]);
                assert.notEqual(oracle, await whitelist.getOracle(validCollateral[i]))
            }
        })

        it("getPriceCurve(), check priceCurve for each collateral", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                let curve = await whitelist.getPriceCurve(validCollateral[i]);
                assert.equal(curve, tokensToCurve.get(validCollateral[i]).address)
            }
        })

        it("changePriceCurve(), loop through valid collateral and change PriceCurve", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                let curve = await whitelist.getPriceCurve(validCollateral[i]);
                await whitelist.changePriceCurve(validCollateral[i], validCollateral[i]);
                assert.notEqual(curve, await whitelist.getPriceCurve(validCollateral[i]))
            }
        })

        it("getPrice(), loop through valid collateral and getPrice. Randomly set price", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let k =0; k < 10000; k+=Math.random()*100) {
                for (let i = 0; i < validCollateral.length; i++) {
                    await tokensToOracles.get(validCollateral[i]).setPrice(dec(parseInt(k), parseInt(Math.random()*19))); //Randomly set price and decimals
                    let price = await whitelist.getPrice(validCollateral[i]);
                    // console.log(ethers.BigNumber.isBN(price));
                    // console.log(price.toNumber(), await tokensToOracles.get(validCollateral[i]).getPrice().toNumber()/ 1E18);
                    assert(price.eq(await tokensToOracles.get(validCollateral[i]).getPrice()));
                }
            }
        })

        it("getValueUSD(), loop through valid collateral and getValueUSD. Randomly set price", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let k =1; k < 10000; k+=Math.random()*100) {
                for (let i = 0; i < validCollateral.length; i++) {
                    let decimals=await whitelist.getDecimals(validCollateral[i]);
                    let decimalOffset = web3.utils.toBN(10 ** decimals);
                    
                    await tokensToOracles.get(validCollateral[i]).setPrice(dec(parseInt(k), decimals.add(web3.utils.toBN(parseInt(Math.random()*4)-2)))); //Randomly set price and decimals
                    let price = await whitelist.getPrice(validCollateral[i]);
                    let amount = web3.utils.toBN(dec(parseInt(Math.random()*100)+1, decimals.add(web3.utils.toBN(parseInt(Math.random()*4)-2))));
                    let value = await whitelist.getValueUSD(validCollateral[i], amount);
                    
                    // console.log(price.toString(), amount.toString(), value.toString(), decimalOffset.toString(), amount.div(decimalOffset).toString());
                    // console.log(price.mul(amount.div(decimalOffset)).toString());
                    // console.log((value.div(price.mul(amount.div(decimalOffset)))).toString());
                    assert((value.eq(price.mul(amount).div(decimalOffset))));
                    // console.log(ethers.BigNumber.isBN(price));
                    // console.log(price.toNumber(), await tokensToOracles.get(validCollateral[i]).getPrice().toNumber()/ 1E18);
                }
            }
        })

        it("getValueUSD(), loop through valid collateral and getValueUSD", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let i = 0; i < validCollateral.length; i++) {
                await tokensToOracles.get(validCollateral[i]).setPrice(dec(100, 18));
                let price = await whitelist.getPrice(validCollateral[i]);
                let amount = dec(1, 18);
                let value = await whitelist.getValueUSD(validCollateral[i], amount);
                // console.log(value.toString());
                // console.log(price*amount/dec(1, 18));
                assert.equal(value.toString(), (price*amount/dec(1, 18)).toString());
                // console.log(ethers.BigNumber.isBN(price));
                // console.log(price.toNumber(), await tokensToOracles.get(validCollateral[i]).getPrice().toNumber()/ 1E18);
                // assert(price.eq(await tokensToOracles.get(validCollateral[i]).getPrice()));
            }
        })

        it("getValueVC(), loop through valid collateral and getValueUSD. Randomly set price", async () => {
            let validCollateral = await whitelist.getValidCollateral();
            for (let k =1; k < 10000; k+=Math.random()*100) {
                for (let i = 0; i < validCollateral.length; i++) {
                    let decimals=await whitelist.getDecimals(validCollateral[i]);
                    let ratio=await whitelist.getRatio(validCollateral[i]);
                    let decimalOffset = web3.utils.toBN(10).pow(decimals.add(web3.utils.toBN(18)));
                    
                    await tokensToOracles.get(validCollateral[i]).setPrice(dec(parseInt(k), decimals.add(web3.utils.toBN(parseInt(Math.random()*4)-2)))); //Randomly set price and decimals
                    let price = await whitelist.getPrice(validCollateral[i]);
                    let amount = web3.utils.toBN(dec(parseInt(Math.random()*100)+1, decimals.add(web3.utils.toBN(parseInt(Math.random()*4)-2))));
                    let value = await whitelist.getValueVC(validCollateral[i], amount);
                    
                    // console.log(price.toString(), amount.toString(), value.toString(), decimalOffset.toString(), amount.div(decimalOffset).toString());
                    // console.log(price.mul(amount.div(decimalOffset)).toString());
                    // console.log(price.mul(amount).mul(ratio).div(decimalOffset).toString());
                    assert((value.eq(price.mul(amount).mul(ratio).div(decimalOffset))));
                    // console.log(ethers.BigNumber.isBN(price));
                    // console.log(price.toNumber(), await tokensToOracles.get(validCollateral[i]).getPrice().toNumber()/ 1E18);
                }
            }
        })
        it("Check after deprecation of collateral that people cannot add new of that collateral, but it still works inside the system.", async () => {
            const validCollateral = await whitelist.getValidCollateral();
            /*
            Add troves with both collaterals.
            deprecate Eth
            - make sure new troves cannot be opened with Eth
            - still able to liquidate troves with Eth
            */
            let a_wethToMint = toBN(dec(400, 17));

            let a_colls = [contracts.weth];
            let a_amounts = [a_wethToMint];

            const { amounts: A_amounts} = await th.openTroveWithColls(contracts, { ICR: toBN(dec(400, 16)), colls: a_colls, amounts:a_amounts, oracles: [contracts.priceFeedETH],  from: alice });

            let b_wavaxToMint = toBN(dec(400, 17));

            let b_colls = [contracts.wavax];
            let b_amounts = [b_wavaxToMint];
            

            const { amounts: B_amounts} = await th.openTroveWithColls(contracts, { ICR: toBN(dec(400, 16)), colls: b_colls, amounts:b_amounts, oracles: [contracts.priceFeedAVAX], from: bob });

            let c_wethToMint = toBN(dec(110, 17));
            let c_wavaxToMint = toBN(dec(100, 17));

            let c_colls = [contracts.weth, contracts.wavax];
            let c_amounts = [c_wethToMint, c_wavaxToMint];
            

            const { amounts: C_amounts} = await th.openTroveWithColls(contracts, { ICR: toBN(dec(210, 16)), colls: c_colls, amounts:c_amounts, oracles: [contracts.priceFeedETH, contracts.priceFeedAVAX], from: carol });
            // carol withdraw 1 eth
            C_amounts[0] = C_amounts[0].sub(toBN(dec(10, 17)))
            // deprecateETh
            await whitelist.deprecateCollateral(validCollateral[0]);
            
            let d_wethToMint = toBN(dec(400, 17));

            let d_colls = [contracts.weth];
            let d_amounts = [d_wethToMint];
            
            assertRevert(th.openTroveWithColls(contracts, { ICR: toBN(dec(400, 16)), colls: d_colls, amounts:d_amounts, oracles: [contracts.priceFeedETH],  from: dennis }));
            
            const addedColl1 = toBN(dec(1, 'ether'))
            await weth.mint(alice, addedColl1)
            await weth.approve(borrowerOperations.address, addedColl1, {from: alice});
            assertRevert(borrowerOperations.addColl([weth.address], [addedColl1], alice, alice,  th._100pct, {from: alice}));
            
            await weth.mint(carol, addedColl1)
            await weth.approve(borrowerOperations.address, addedColl1, {from: carol});
            assertRevert(borrowerOperations.addColl([weth.address], [addedColl1], carol, carol,  th._100pct, {from: carol}));

            await borrowerOperations.withdrawColl([weth.address], [addedColl1], carol, carol, {from: carol});

            await wavax.mint(carol, addedColl1)
            await wavax.approve(borrowerOperations.address, addedColl1, {from: carol});
            await borrowerOperations.addColl([wavax.address], [addedColl1], carol, carol,  th._100pct, {from: carol});
            await borrowerOperations.withdrawColl([wavax.address], [addedColl1], carol, carol, {from: carol});


            // // Price drops to 100 $/E
            await contracts.priceFeedETH.setPrice(dec(100, 18))
            await contracts.priceFeedAVAX.setPrice(dec(100, 18))
            
            
            // Confirm not in Recovery Mode
            assert.isFalse(await th.checkRecoveryMode(contracts))

            // L1: C liquidated
            const txB = await troveManager.liquidate(carol)
            assert.isTrue(txB.receipt.status)
            assert.isFalse(await sortedTroves.contains(carol))


            // Price bounces back to 200 $/E
            await contracts.priceFeedETH.setPrice(dec(200, 18))
            await contracts.priceFeedAVAX.setPrice(dec(200, 18))
            
            
            const alice_ETH = ((await troveManager.getTroveColls(alice))[1][0]
                .add((await troveManager.getPendingCollRewards(alice))[1][0]))
                .toString()
                
            const bob_AVAX = ((await troveManager.getTroveColls(bob))[1][0]
                .add((await troveManager.getPendingCollRewards(bob))[1][0]))
                .toString()


            /* Expected collateral:
            A: Alice receives 0.995 ETH from L1, and ~3/5*0.995 ETH from L2.
            expect aliceColl = 2 + 0.995 + 2.995/4.995 * 0.995 = 3.5916 ETH

            C: Carol receives ~2/5 ETH from L2
            expect carolColl = 2 + 2/4.995 * 0.995 = 2.398 ETH

            Total coll = 4 + 2 * 0.995 ETH
            */
            const A_ETHAfterL1 = A_amounts[0].add(th.applyLiquidationFee(C_amounts[0]))
            assert.isAtMost(th.getDifference(alice_ETH, A_ETHAfterL1), Number(dec(150, 20)))




            const entireSystemETH = (await activePool.getCollateral(weth.address)).add(await defaultPool.getCollateral(weth.address)).toString()
            assert.equal(entireSystemETH, A_amounts[0].add(th.applyLiquidationFee(C_amounts[0])))

            aliceCTS = (await contracts.troveManager.getEDC(alice))

            console.log('aliceDebt: ', aliceCTS[2].toString())

            console.log((await yusdToken.balanceOf(alice)).toString())
            await yusdToken.unprotectedMint(alice, toBN(dec(1300, 18)))
            await yusdToken.approve(borrowerOperations.address, toBN(dec(1300, 18)), {from: alice});
            console.log((await yusdToken.balanceOf(alice)).toString())
            const txAlice = await borrowerOperations.closeTrove({ from: alice })
            assert.isTrue(txAlice.receipt.status)


            const B_AVAXAfterL1 = B_amounts[0].add(th.applyLiquidationFee(C_amounts[1]))
            assert.isAtMost(th.getDifference(bob_AVAX, B_AVAXAfterL1), Number(dec(150, 20)))




            const entireSystemAVAX = (await activePool.getCollateral(wavax.address)).add(await defaultPool.getCollateral(wavax.address)).toString()
            assert.equal(entireSystemAVAX, A_amounts[0].add(th.applyLiquidationFee(C_amounts[1])))


            assert.equal((await yusdToken.balanceOf(owner)).toString(), dec(200, 18))
        })
        it("Check undeprecate collateral and if that is still relevant with new system of indexing", async () => {
            const validCollateral = await whitelist.getValidCollateral();
            const wethIDX1 = (await whitelist.getIndex(weth.address)).toString();
            await whitelist.deprecateCollateral(validCollateral[0]);
            const wethIDX2 = (await whitelist.getIndex(weth.address)).toString();
            assert.equal(wethIDX1, wethIDX2)

            await whitelist.undeprecateCollateral(weth.address);
            const wethIDX3 = (await whitelist.getIndex(weth.address)).toString();
            assert.equal(wethIDX3, wethIDX2)
        })
        it("VC and PriceFeed still works after deprecate", async () => {
            const validCollateral = await whitelist.getValidCollateral();
            
            await whitelist.deprecateCollateral(validCollateral[0]);
            
            await contracts.priceFeedETH.setPrice(dec(100, 18))

            const vc = (await whitelist.getValueVC(weth.address, dec(1, 18))).toString()

            assert.equal(vc, toBN(dec(100, 18)).toString())

            await contracts.priceFeedETH.setPrice(dec(300, 18))

            const vc2 = (await whitelist.getValueVC(weth.address, dec(1, 18))).toString()

            assert.equal(vc2, toBN(dec(300, 18)).toString())

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