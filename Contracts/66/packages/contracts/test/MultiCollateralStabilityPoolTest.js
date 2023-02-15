const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerLiquidations = artifacts.require("./TroveManagerLiquidations.sol")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const TroveManagerTester = artifacts.require("TroveManagerTester")
const YUSDToken = artifacts.require("YUSDToken")
const NonPayable = artifacts.require('NonPayable.sol')

const ZERO = toBN('0')
const ZERO_ADDRESS = th.ZERO_ADDRESS
const maxBytes32 = th.maxBytes32

contract('StabilityPool', async accounts => {

    const [owner,
      defaulter_1, defaulter_2, defaulter_3,
      whale,
      alice, bob, carol, dennis, erin, flyn,
      A, B, C, D, E, F,
      frontEnd_1, frontEnd_2, frontEnd_3,
    ] = accounts;
  
    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
    const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]
    let contracts
    let priceFeed
    let yusdToken
    let sortedTroves
    let troveManager
    let activePool
    let stabilityPool
    let defaultPool
    let borrowerOperations
    let yetiToken
    let communityIssuance
    let weth
    let priceFeedETH
    let priceFeedAVAX
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
    let tokens
    let troveManagerRedemptions
    let troveManagerLiquidations
  
    let gasPriceInWei
  
    const getOpenTroveYUSDAmount = async (totalDebt) => th.getOpenTroveYUSDAmount(contracts, totalDebt)
    const openTrove = async (params) => th.openTrove(contracts, params)
    const openTroveToken = async (token, params) => th.openTroveWithToken(contracts, token, params)

    const assertRevert = th.assertRevert

    describe("Stability Pool Mechanisms", async () => {
        before(async () => {
            gasPriceInWei = await web3.eth.getGasPrice()
          })
      
          beforeEach(async () => {
            contracts = await deploymentHelper.deployLiquityCore()
            contracts.borrowerOperations = await BorrowerOperationsTester.new()
            contracts.troveManager = await TroveManagerTester.new()

            contracts.yusdToken = await YUSDTokenTester.new(contracts.troveManager.address,
                contracts.troveManagerLiquidations.address,
                contracts.troveManagerRedemptions.address,
                contracts.stabilityPool.address,
                contracts.borrowerOperations.address),
            contracts = await deploymentHelper.deployYUSDTokenTester(contracts)
            const YETIContracts = await deploymentHelper.deployYETIContracts(bountyAddress, lpRewardsAddress, multisig)
            
            priceFeedETH = contracts.priceFeedETH
            priceFeedAVAX = contracts.priceFeedAVAX
            yusdToken = contracts.yusdToken
            sortedTroves = contracts.sortedTroves
            troveManager = contracts.troveManager
            activePool = contracts.activePool
            stabilityPool = contracts.stabilityPool
            defaultPool = contracts.defaultPool
            borrowerOperations = contracts.borrowerOperations
            hintHelpers = contracts.hintHelpers
            weth = contracts.weth
            wavax = contracts.wavax
            troveManagerLiquidations = contracts.troveManagerLiquidations
            troveManagerRedemptions = contracts.troveManagerRedemptions

            // console.log(contracts);
      
            yetiToken = YETIContracts.yetiToken
            communityIssuance = YETIContracts.communityIssuance
      
            await deploymentHelper.connectYETIContracts(YETIContracts)
            await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
            await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)
      
            // Register 3 front ends
            await th.registerFrontEnds(frontEnds, stabilityPool)

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

          })

          it("MULTICOLLATERAL withdrawFromSP(): partial retrieval - retrieves correct YUSD amount and the entire ETH Gain, and updates deposit", async () => {
            // --- SETUP ---

            await th.addERC20(weth, whale, borrowerOperations.address, toBN(dec(1, 24)), { from: whale })
            await th.addERC20(wavax, whale, borrowerOperations.address, toBN(dec(2, 24)), { from: whale })

            const whaleInSP = toBN(dec(10000, 18));
            const aliceInSP = toBN(dec(2000, 18));
            const bobInSP = toBN(dec(3000, 18));

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(18500, 18)), whale, whale, 
                  [weth.address, wavax.address], 
                  [dec(100, 'ether'), dec(100, 'ether')], 
                  { from: whale }
            )


            // Whale deposits 10000 YUSD in StabilityPool
            await stabilityPool.provideToSP(whaleInSP, frontEnd_1, { from: whale })
        
            // // 2 Troves opened
            await th.addERC20(weth, defaulter_1, borrowerOperations.address, toBN(dec(20, 18)), { from: defaulter_1 })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), defaulter_1, defaulter_1, 
                  [weth.address], 
                  [dec(20, 'ether')], 
                  { from: defaulter_1 }
            )

            await th.addERC20(wavax, defaulter_2, borrowerOperations.address, toBN(dec(21, 18)), { from: defaulter_2 })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), defaulter_2, defaulter_2, 
                  [wavax.address], 
                  [dec(21, 'ether')], 
                  { from: defaulter_2 }
            )

            await th.addERC20(wavax, alice, borrowerOperations.address, toBN(dec(230, 18)), { from: alice })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), alice, alice, 
                  [wavax.address], 
                  [dec(230, 'ether')], 
                  { from: alice }
            )

            // await th.addERC20(weth, bob, borrowerOperations.address, toBN(dec(14, 24)), { from: bob })
            // await th.addERC20(wavax, bob, borrowerOperations.address, toBN(dec(22, 24)), { from: bob })

            // await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(25000, 18)), bob, bob, 
            //       [weth.address, wavax.address], 
            //       [dec(100, 'ether'), dec(100, 'ether')], 
            //       { from: bob }
            // )

            const defaulter1_ICR_pre = await troveManager.getCurrentICR(defaulter_1)
            const defaulter2_ICR_pre = await troveManager.getCurrentICR(defaulter_2);

            assert.equal(defaulter1_ICR_pre.toString(), "1666666666666666666", "Defaulter 1 ICR incorrect")
            assert.equal(defaulter2_ICR_pre.toString(), "1750000000000000000", "Defaulter 2 ICR incorrect")
        
            // // --- TEST ---
    
            // Alice makes deposit #1: 2000 YUSD
            await stabilityPool.provideToSP(aliceInSP, frontEnd_1, { from: alice })
        
            // // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
            await priceFeedETH.setPrice(dec(126, 18));
            await priceFeedAVAX.setPrice(dec(120, 18));

            const defaulter1_ICR = await troveManager.getCurrentICR(defaulter_1)
            const defaulter2_ICR = await troveManager.getCurrentICR(defaulter_2);

            const alice_pre_WETH_balance = await weth.balanceOf(alice);
            const alice_pre_WAVAX_balance = await wavax.balanceOf(alice);

            const whale_pre_WETH_balance = await weth.balanceOf(whale);
            const whale_pre_WAVAX_balance = await wavax.balanceOf(whale);
        
            // // 2 users with Trove with 170 YUSD drawn are closed
            const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })  // 170 YUSD closed
            const liquidationTX_2 = await troveManager.liquidate(defaulter_2, { from: owner }) // 170 YUSD closed
            
            const [liquidatedDebt_1, yusdGasComp_1, liquidatedCollTokens_1, liquidatedCollAmounts_1, 
              totalCollGasCompTokens_1, totalCollGasCompAmounts_1]  = await th.getEmittedLiquidationValuesMulti(liquidationTX_1);

            const [liquidatedDebt_2, yusdGasComp_2, liquidatedCollTokens_2, liquidatedCollAmounts_2, 
              totalCollGasCompTokens_2, totalCollGasCompAmounts_2]  = await th.getEmittedLiquidationValuesMulti(liquidationTX_2);
        
            // Alice YUSDLoss is ((2000/(10000 + 2000)) * liquidatedDebt), for each liquidation

            const expectedYUSDLoss_A = liquidatedDebt_1.mul(toBN(aliceInSP)).div(toBN(aliceInSP).add(toBN(whaleInSP)))
              .add(liquidatedDebt_2.mul(toBN(aliceInSP)).div(toBN(aliceInSP).add(toBN(whaleInSP))))
        
            const expectedCompoundedYUSDDeposit_A = toBN(aliceInSP).sub(expectedYUSDLoss_A)
            const compoundedYUSDDeposit_A = await stabilityPool.getCompoundedYUSDDeposit(alice)
        
            assert.isAtMost(th.getDifference(expectedCompoundedYUSDDeposit_A, compoundedYUSDDeposit_A), 100000)
        
            // Alice retrieves part of her entitled YUSD: 1800 YUSDer
            await stabilityPool.withdrawFromSP(dec(1000, 18), { from: alice })
            
            // Alice Gains Are Accurate
            const alice_post_WETH_balance = await weth.balanceOf(alice);
            const alice_post_WAVAX_balance = await wavax.balanceOf(alice);

            const alice_WETH_gain = alice_post_WETH_balance.sub(alice_pre_WETH_balance);
            const alice_WAVAX_gain = alice_post_WAVAX_balance.sub(alice_pre_WAVAX_balance);
            const alice_expected_WETH_gain = (toBN(dec(20, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
            const alice_expected_WAVAX_gain = (toBN(dec(21, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))

            // gains from WETH liquidation
            assert.isAtMost(th.getDifference(alice_WETH_gain, alice_expected_WETH_gain), 100000)

            // gains from WAVAX liquidation
            assert.isAtMost(th.getDifference(alice_WAVAX_gain, alice_expected_WAVAX_gain), 100000)
        
            const expectedNewDeposit_A = (compoundedYUSDDeposit_A.sub(toBN(dec(1000, 18))))
        
            // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
            const newDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
            assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000)
        
            // // Expect Alice has withdrawn all ETH gain
            const alice_pendingETHGain = (await stabilityPool.getDepositorGains(alice))[1][0]
            assert.equal(alice_pendingETHGain, 0)

            // // Expect Alice has withdrawn all WAVAX gain
            const alice_pendingWAVAXGain = (await stabilityPool.getDepositorGains(alice))[1][1]
            assert.equal(alice_pendingWAVAXGain, 0)

            // Whale Gains Are Accurate

            const expectedYUSDLoss_whale = liquidatedDebt_1.mul(whaleInSP).div(aliceInSP.add(whaleInSP))
              .add(liquidatedDebt_2.mul(whaleInSP).div(aliceInSP.add(whaleInSP)))
        
            const expectedCompoundedYUSDDeposit_Whale = toBN(whaleInSP).sub(expectedYUSDLoss_whale)
            const compoundedYUSDDeposit_Whale = await stabilityPool.getCompoundedYUSDDeposit(whale)
        
            assert.isAtMost(th.getDifference(expectedCompoundedYUSDDeposit_Whale, compoundedYUSDDeposit_Whale), 100000)
            
            await stabilityPool.withdrawFromSP(dec(1000, 18), { from: whale }) // whale withdraws 1000 YUSD from SP
            
            const whale_post_WETH_balance = await weth.balanceOf(whale);
            const whale_post_WAVAX_balance = await wavax.balanceOf(whale);

            const whale_WETH_gain = whale_post_WETH_balance.sub(whale_pre_WETH_balance);
            const whale_WAVAX_gain = whale_post_WAVAX_balance.sub(whale_pre_WAVAX_balance);
            
            const whale_expected_WETH_gain = (toBN(dec(20, 18))).mul(whaleInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
            const whale_expected_WAVAX_gain = (toBN(dec(21, 18))).mul(whaleInSP).div(aliceInSP.add(whaleInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
          
            // gains from WETH liquidation
            assert.isAtMost(th.getDifference(whale_WETH_gain, whale_expected_WETH_gain), 100000)

            // gains from WAVAX liquidation
            assert.isAtMost(th.getDifference(whale_WAVAX_gain, whale_expected_WAVAX_gain), 100000)
        
            const expectedNewDeposit_Whale = (compoundedYUSDDeposit_Whale.sub(toBN(dec(1000, 18))))
        
            // check whale's deposit has been updated to equal her compounded deposit minus her withdrawal */
            const newWhaleDeposit = ((await stabilityPool.deposits(whale))[0]).toString()
            assert.isAtMost(th.getDifference(newWhaleDeposit, expectedNewDeposit_Whale), 100000)
        
            // // Expect whale has withdrawn all ETH gain
            const whale_pendingETHGain = (await stabilityPool.getDepositorGains(whale))[1][0]
            assert.equal(whale_pendingETHGain, 0)

            // // Expect whale has withdrawn all WAVAX gain
            const whale_pendingWAVAXGain = (await stabilityPool.getDepositorGains(whale))[1][1]
            assert.equal(whale_pendingWAVAXGain, 0)


          })

          it("open, deposit into SP, liquidate, deposit into SP #2, liquidate", async () => {
            // --- SETUP ---

            await th.addERC20(weth, whale, borrowerOperations.address, toBN(dec(14000, 24)), { from: whale })
            await th.addERC20(wavax, whale, borrowerOperations.address, toBN(dec(20000, 24)), { from: whale })

            const whaleInSP = toBN(dec(10000, 18));
            const aliceInSP = toBN(dec(2000, 18));
            const carolInSP = toBN(dec(2000, 18));
            const bobInSP = toBN(dec(2000, 18));

            await th.addERC20(weth, bob, borrowerOperations.address, toBN(dec(1400, 24)), { from: bob })
            await th.addERC20(wavax, bob, borrowerOperations.address, toBN(dec(2200, 24)), { from: bob })

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(25000, 18)), bob, bob, 
                  [weth.address, wavax.address], 
                  [dec(1000, 'ether'), dec(1000, 'ether')], 
                  { from: bob }
            )

            await stabilityPool.provideToSP(bobInSP, frontEnd_1, { from: bob })

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(18500, 18)), whale, whale, 
                  [weth.address, wavax.address], 
                  [dec(10000, 'ether'), dec(100, 'ether')], 
                  { from: whale }
            )


            // Whale deposits 10000 YUSD in StabilityPool
            await stabilityPool.provideToSP(whaleInSP, frontEnd_1, { from: whale })
        
            // // 2 Troves opened
            await th.addERC20(weth, defaulter_1, borrowerOperations.address, toBN(dec(20000, 18)), { from: defaulter_1 })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), defaulter_1, defaulter_1, 
                  [weth.address], 
                  [dec(20, 'ether')], 
                  { from: defaulter_1 }
            )

            await th.addERC20(wavax, defaulter_2, borrowerOperations.address, toBN(dec(210000, 18)), { from: defaulter_2 })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), defaulter_2, defaulter_2, 
                  [wavax.address], 
                  [dec(21, 'ether')], 
                  { from: defaulter_2 }
            )

            await th.addERC20(wavax, alice, borrowerOperations.address, toBN(dec(230000, 18)), { from: alice })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), alice, alice, 
                  [wavax.address], 
                  [dec(230, 'ether')], 
                  { from: alice }
            )

            const defaulter1_ICR_pre = await troveManager.getCurrentICR(defaulter_1)
            const defaulter2_ICR_pre = await troveManager.getCurrentICR(defaulter_2);

            assert.equal(defaulter1_ICR_pre.toString(), "1666666666666666666", "Defaulter 1 ICR incorrect")
            assert.equal(defaulter2_ICR_pre.toString(), "1750000000000000000", "Defaulter 2 ICR incorrect")
        
            // // --- TEST ---
    
            // Alice makes deposit #1: 2000 YUSD
            await stabilityPool.provideToSP(aliceInSP, frontEnd_1, { from: alice })
        
            // // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
            await priceFeedETH.setPrice(dec(126, 18));
            await priceFeedAVAX.setPrice(dec(120, 18));

            const defaulter1_ICR = await troveManager.getCurrentICR(defaulter_1)
            const defaulter2_ICR = await troveManager.getCurrentICR(defaulter_2);

            const alice_pre_WETH_balance = await weth.balanceOf(alice);
            const alice_pre_WAVAX_balance = await wavax.balanceOf(alice);

            const whale_pre_WETH_balance = await weth.balanceOf(whale);
            const whale_pre_WAVAX_balance = await wavax.balanceOf(whale);
        
            // // 2 users with Trove with 170 YUSD drawn are closed
            const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })  // 170 YUSD closed
            const liquidationTX_2 = await troveManager.liquidate(defaulter_2, { from: owner }) // 170 YUSD closed
            
            const [liquidatedDebt_1, yusdGasComp_1, liquidatedCollTokens_1, liquidatedCollAmounts_1, 
              totalCollGasCompTokens_1, totalCollGasCompAmounts_1]  = await th.getEmittedLiquidationValuesMulti(liquidationTX_1);

            const [liquidatedDebt_2, yusdGasComp_2, liquidatedCollTokens_2, liquidatedCollAmounts_2, 
              totalCollGasCompTokens_2, totalCollGasCompAmounts_2]  = await th.getEmittedLiquidationValuesMulti(liquidationTX_2);
        
            // Alice YUSDLoss is ((2000/(10000 + 2000)) * liquidatedDebt), for each liquidation

            const expectedYUSDLoss_A = liquidatedDebt_1.mul(toBN(aliceInSP)).div(toBN(aliceInSP).add(toBN(whaleInSP).add(toBN(bobInSP))))
              .add(liquidatedDebt_2.mul(toBN(aliceInSP)).div((toBN(aliceInSP).add(toBN(whaleInSP).add(toBN(bobInSP))))))
        
            const expectedCompoundedYUSDDeposit_A = toBN(aliceInSP).sub(expectedYUSDLoss_A)
            const compoundedYUSDDeposit_A = await stabilityPool.getCompoundedYUSDDeposit(alice)
        
            assert.isAtMost(th.getDifference(expectedCompoundedYUSDDeposit_A, compoundedYUSDDeposit_A), 100000)
        
            // Alice retrieves part of her entitled YUSD: 1800 YUSDer
            await stabilityPool.withdrawFromSP(dec(1000, 18), { from: alice })
            
            // Alice Gains Are Accurate
            const alice_post_WETH_balance = await weth.balanceOf(alice);
            const alice_post_WAVAX_balance = await wavax.balanceOf(alice);

            const alice_WETH_gain = alice_post_WETH_balance.sub(alice_pre_WETH_balance);
            const alice_WAVAX_gain = alice_post_WAVAX_balance.sub(alice_pre_WAVAX_balance);
            
            const alice_expected_WETH_gain = (toBN(dec(20, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP).add(bobInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
            const alice_expected_WAVAX_gain = (toBN(dec(21, 18))).mul(aliceInSP).div(aliceInSP.add(whaleInSP).add(bobInSP)).mul(toBN(dec(995, 18))).div(toBN(dec(1000, 18)))
          
            // gains from WETH liquidation
            assert.isAtMost(th.getDifference(alice_WETH_gain, alice_expected_WETH_gain), 100000)

            // gains from WAVAX liquidation
            assert.isAtMost(th.getDifference(alice_WAVAX_gain, alice_expected_WAVAX_gain), 100000)
        
            const expectedNewDeposit_A = (compoundedYUSDDeposit_A.sub(toBN(dec(1000, 18))))
        
            // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
            const newDeposit = ((await stabilityPool.deposits(alice))[0]).toString()
            assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000)
        
            // // Expect Alice has withdrawn all ETH gain
            const alice_pendingETHGain = (await stabilityPool.getDepositorGains(alice))[1][0]
            assert.equal(alice_pendingETHGain, 0)

            // // Expect Alice has withdrawn all WAVAX gain
            const alice_pendingWAVAXGain = (await stabilityPool.getDepositorGains(alice))[1][1]
            assert.equal(alice_pendingWAVAXGain, 0)

            // Whale Gains Are Accurate

            const expectedYUSDLoss_whale = liquidatedDebt_1.mul(whaleInSP).div(aliceInSP.add(whaleInSP).add(bobInSP))
              .add(liquidatedDebt_2.mul(whaleInSP).div(aliceInSP.add(whaleInSP).add(bobInSP)))
        
            const expectedCompoundedYUSDDeposit_Whale = toBN(whaleInSP).sub(expectedYUSDLoss_whale)
            const compoundedYUSDDeposit_Whale = await stabilityPool.getCompoundedYUSDDeposit(whale)
        
            assert.isAtMost(th.getDifference(expectedCompoundedYUSDDeposit_Whale, compoundedYUSDDeposit_Whale), 100000)
            
            // new depositor to stability pool
            await th.addERC20(wavax, carol, borrowerOperations.address, toBN(dec(230, 18)), { from: carol })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), carol, carol, 
                  [wavax.address], 
                  [dec(230, 'ether')], 
                  { from: carol }
            )
            
            // carol makes deposit #1: 2000 YUSD
            await stabilityPool.provideToSP(carolInSP, frontEnd_1, { from: carol })

            
          })

          it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
            await th.addERC20(weth, whale, borrowerOperations.address, toBN(dec(1, 24)), { from: whale })
            await th.addERC20(wavax, whale, borrowerOperations.address, toBN(dec(2, 24)), { from: whale })

            await th.addERC20(weth, alice, borrowerOperations.address, toBN(dec(11, 24)), { from: alice })
            await th.addERC20(wavax, alice, borrowerOperations.address, toBN(dec(232, 24)), { from: alice })

            await th.addERC20(weth, bob, borrowerOperations.address, toBN(dec(14, 24)), { from: bob })
            await th.addERC20(wavax, bob, borrowerOperations.address, toBN(dec(22, 24)), { from: bob })

            await th.addERC20(weth, carol, borrowerOperations.address, toBN(dec(14, 24)), { from: carol })
            await th.addERC20(wavax, carol, borrowerOperations.address, toBN(dec(22, 24)), { from: carol })

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(20000, 18)), whale, whale, 
                  [weth.address, wavax.address], 
                  [dec(100, 'ether'), dec(100, 'ether')], 
                  { from: whale }
            )

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(12000, 18)), alice, alice, 
                  [weth.address, wavax.address], 
                  [dec(100, 'ether'), dec(100, 'ether')], 
                  { from: alice }
            )

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(25000, 18)), bob, bob, 
                  [weth.address, wavax.address], 
                  [dec(100, 'ether'), dec(100, 'ether')], 
                  { from: bob }
            )

            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(35000, 18)), carol, carol, 
                  [weth.address, wavax.address], 
                  [dec(100, 'ether'), dec(100, 'ether')], 
                  { from: carol }
            )

            // A, B and C provide to SP
            await stabilityPool.provideToSP(dec(10000, 18), frontEnd_1, { from: alice })
            await stabilityPool.provideToSP(dec(20000, 18), frontEnd_1, { from: bob })
            await stabilityPool.provideToSP(dec(30000, 18), frontEnd_1, { from: carol })
      
            // Price drops
            await priceFeedETH.setPrice(dec(105, 18))
            await priceFeedAVAX.setPrice(dec(140, 18))
      
            // Get debt, collateral and ICR of all existing troves
            const whale_Debt_Before = (await troveManager.getTroveDebt(whale)).toString()
            const alice_Debt_Before = (await troveManager.getTroveDebt(alice)).toString()
            const bob_Debt_Before = (await troveManager.getTroveDebt(bob)).toString()
            const carol_Debt_Before = (await troveManager.getTroveDebt(carol)).toString()
      
            const wethIDX = await contracts.whitelist.getIndex(contracts.weth.address)
            const whale_Coll_Before = (await troveManager.getTroveColls(whale))[1][wethIDX].toString()
            const alice_Coll_Before = (await troveManager.getTroveColls(alice))[1][wethIDX].toString()
            const bob_Coll_Before = (await troveManager.getTroveColls(bob))[1][wethIDX].toString()
            const carol_Coll_Before = (await troveManager.getTroveColls(carol))[1][wethIDX].toString()

            const wavaxIDX = await contracts.whitelist.getIndex(contracts.wavax.address)
            const whale_Coll_Before_1 = (await troveManager.getTroveColls(whale))[1][wavaxIDX].toString()
            const alice_Coll_Before_1 = (await troveManager.getTroveColls(alice))[1][wavaxIDX].toString()
            const bob_Coll_Before_1 = (await troveManager.getTroveColls(bob))[1][wavaxIDX].toString()
            const carol_Coll_Before_1 = (await troveManager.getTroveColls(carol))[1][wavaxIDX].toString()

      
            // price rises
            await priceFeedETH.setPrice(dec(200, 18))
            await priceFeedAVAX.setPrice(dec(1400, 18))
      
            // Carol withdraws her Stability deposit 
            assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), dec(30000, 18))
            await stabilityPool.withdrawFromSP(dec(30000, 18), { from: carol })
            assert.equal(((await stabilityPool.deposits(carol))[0]).toString(), '0')
      
            const whale_Debt_After = (await troveManager.getTroveDebt(whale)).toString()
            const alice_Debt_After = (await troveManager.getTroveDebt(alice)).toString()
            const bob_Debt_After = (await troveManager.getTroveDebt(bob)).toString()
            const carol_Debt_After = (await troveManager.getTroveDebt(carol)).toString()
      
            const whale_Coll_After = (await troveManager.getTroveColls(whale))[1][wethIDX].toString()
            const alice_Coll_After = (await troveManager.getTroveColls(alice))[1][wethIDX].toString()
            const bob_Coll_After = (await troveManager.getTroveColls(bob))[1][wethIDX].toString()
            const carol_Coll_After = (await troveManager.getTroveColls(carol))[1][wethIDX].toString()

            const whale_Coll_After_1 = (await troveManager.getTroveColls(whale))[1][wavaxIDX].toString()
            const alice_Coll_After_1 = (await troveManager.getTroveColls(alice))[1][wavaxIDX].toString()
            const bob_Coll_After_1 = (await troveManager.getTroveColls(bob))[1][wavaxIDX].toString()
            const carol_Coll_After_1 = (await troveManager.getTroveColls(carol))[1][wavaxIDX].toString()
      
            // @KingYeti: because ICR is dynamically calculated, function calls to getCurrentICR will consider the latest price
            // const whale_ICR_After = (await troveManager.getCurrentICR(whale)).toString()
            // const alice_ICR_After = (await troveManager.getCurrentICR(alice)).toString()
            // const bob_ICR_After = (await troveManager.getCurrentICR(bob)).toString()
            // const carol_ICR_After = (await troveManager.getCurrentICR(carol)).toString()
      
            // Check all troves are unaffected by Carol's Stability deposit withdrawal
            assert.equal(whale_Debt_Before, whale_Debt_After)
            assert.equal(alice_Debt_Before, alice_Debt_After)
            assert.equal(bob_Debt_Before, bob_Debt_After)
            assert.equal(carol_Debt_Before, carol_Debt_After)
      
            assert.equal(whale_Coll_Before, whale_Coll_After)
            assert.equal(alice_Coll_Before, alice_Coll_After)
            assert.equal(bob_Coll_Before, bob_Coll_After)
            assert.equal(carol_Coll_Before, carol_Coll_After)

            assert.equal(whale_Coll_Before_1, whale_Coll_After_1)
            assert.equal(alice_Coll_Before_1, alice_Coll_After_1)
            assert.equal(bob_Coll_Before_1, bob_Coll_After_1)
            assert.equal(carol_Coll_Before_1, carol_Coll_After_1)
      
            // assert.equal(whale_ICR_Before, whale_ICR_After)
            // assert.equal(alice_ICR_Before, alice_ICR_After)
            // assert.equal(bob_ICR_Before, bob_ICR_After)
            // assert.equal(carol_ICR_Before, carol_ICR_After)
          })

          it("provideToSP(), new deposit: depositor does not receive any collateral gains", async () => {
            const addresses = [alice, whale, C, D]

            await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
            await th.addMultipleERC20(whale, borrowerOperations.address, [tokenB, tokenD, tokenA], [dec(234, 18), dec(114000, 18), dec(11445, 18)], { from: whale })

            await borrowerOperations.openTrove(th._100pct, toBN(dec(2000, 18)), alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(200000, 18)), whale, whale, [tokenB.address, tokenD.address, tokenA.address], [dec(234, 18), dec(114000, 18), dec(11445, 18)], { from: whale })
            
            // Whale transfers YUSD to A, B
            await yusdToken.transfer(A, dec(100, 18), { from: whale })
            await yusdToken.transfer(B, dec(200, 18), { from: whale })
      
            // C, D open troves
            await th.addMultipleERC20(C, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(4, 18), dec(3, 18), dec(20, 18)], { from: C })
            await th.addMultipleERC20(D, borrowerOperations.address, [tokenB, tokenD], [dec(500, 18), dec(4, 18)], { from: D })

            await borrowerOperations.openTrove(th._100pct, toBN(dec(2000, 18)), C, C, [tokenA.address, tokenB.address, tokenC.address], [dec(4, 18), dec(3, 18), dec(20, 18)], { from: C })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(2000, 18)), D, D, [tokenB.address, tokenD.address], [dec(500, 18), dec(4, 18)], { from: D })
      
            // --- TEST ---
            tokens = [weth, wavax, tokenA, tokenB, tokenC, tokenD, tokenRisky, tokenSuperRisky, tokenLowDecimal, stableCoin]
            
            console.log("BEFORE");
            const balancesBefore = {}
            for (let j = 0; j < addresses.length; j++) {
              let address = addresses[j];
              balancesBefore[address] = {}
              for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i];
                const balance = await token.balanceOf(addresses[j])
                console.log(address, token.address, balance);
                balancesBefore[address][token.address.address] = balance;
              }
            }

            // A, B, C, D provide to SP
            await stabilityPool.provideToSP(dec(100, 18), frontEnd_1, { from: whale, gasPrice: 0 })
            await stabilityPool.provideToSP(dec(200, 18), ZERO_ADDRESS, { from: alice, gasPrice: 0 })
            await stabilityPool.provideToSP(dec(300, 18), frontEnd_2, { from: C, gasPrice: 0 })
            await stabilityPool.provideToSP(dec(400, 18), ZERO_ADDRESS, { from: D, gasPrice: 0 })
            
            console.log("AFTER");
            // Get  ETH balances after
            const balancesAfter = {}
            for (let j = 0; j < addresses.length; j++) {
              let address = addresses[j];
              balancesAfter[address] = {}
              for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i];
                const balance = await token.balanceOf(addresses[j])
                console.log(address, token.address, balance);
                balancesAfter[address][token.address.address] = balance;
              }
            }



            // for (let j = 0; j < addresses.length; j++) {
            //   let address = addresses[j];
            //   for (let i = 0; i < tokens.length; i++) {
            //     let token = tokens[i];
            //     assert.isTrue(balanceAfter[address][token.address] == balancesBefore[address][token.address])
            //   }
            // }
            
            const TCR = await troveManager.getCurrentICR(C);
            console.log("TCR", TCR.toString())
            


          })

          it("provideToSP(): doesn't impact other users' deposits or ETH gains", async () => {
            // await th.addMultipleERC20(alice, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })
            // await borrowerOperations.openTrove(th._100pct, toBN(dec(2000, 18)), alice, alice, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: alice })

            await th.addMultipleERC20(whale, borrowerOperations.address, [tokenA, tokenB, tokenC], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: whale })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(2000, 18)), whale, whale, [tokenA.address, tokenB.address, tokenC.address], [dec(5, 18), dec(10, 18), dec(15, 18)], { from: whale })

            
            await th.addERC20(weth, defaulter_1, borrowerOperations.address, toBN(dec(20, 18)), { from: defaulter_1 })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), defaulter_1, defaulter_1, 
                  [weth.address], 
                  [dec(20, 'ether')], 
                  { from: defaulter_1 }
            )

            await th.addERC20(weth, defaulter_2, borrowerOperations.address, toBN(dec(21, 18)), { from: defaulter_2 })
            await borrowerOperations.openTrove(th._100pct, await getOpenTroveYUSDAmount(dec(2400, 18)), defaulter_2, defaulter_2, 
                  [weth.address], 
                  [dec(21, 'ether')], 
                  { from: defaulter_2 })

            // A, B, C open troves and make Stability Pool deposits
            await openTrove({ extraYUSDAmount: toBN(dec(1000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
            await openTrove({ extraYUSDAmount: toBN(dec(2000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
            await openTrove({ extraYUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      
            await stabilityPool.provideToSP(dec(1000, 18), frontEnd_1, { from: alice })
            await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, { from: bob })
            await stabilityPool.provideToSP(dec(3000, 18), frontEnd_1, { from: carol })
      
            // D opens a trove
            await openTrove({ extraYUSDAmount: toBN(dec(300, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

            // Price drops
            await priceFeedETH.setPrice(dec(128, 18))
            await priceFeedAVAX.setPrice(dec(128, 18))

            const defaulter1_ICR = await troveManager.getCurrentICR(defaulter_1);
            const defaulter2_ICR = await troveManager.getCurrentICR(defaulter_2);

            // Defaulters are liquidated
            await troveManager.liquidate(defaulter_1)
            await troveManager.liquidate(defaulter_2)
            assert.isFalse(await sortedTroves.contains(defaulter_1))
            assert.isFalse(await sortedTroves.contains(defaulter_2))
      
            const alice_YUSDDeposit_Before = (await stabilityPool.getCompoundedYUSDDeposit(alice)).toString()
            const bob_YUSDDeposit_Before = (await stabilityPool.getCompoundedYUSDDeposit(bob)).toString()
            const carol_YUSDDeposit_Before = (await stabilityPool.getCompoundedYUSDDeposit(carol)).toString()
      
            const alice_ETHGain_Before = ((await stabilityPool.getDepositorGains(alice))[1][0]).toString()
            const bob_ETHGain_Before = ((await stabilityPool.getDepositorGains(bob))[1][0]).toString()
            const carol_ETHGain_Before = ((await stabilityPool.getDepositorGains(carol))[1][0]).toString()
      
            //check non-zero YUSD and ETHGain in the Stability Pool
            const YUSDinSP = await stabilityPool.getTotalYUSDDeposits()
            const ETHinSP = await stabilityPool.getCollateral(weth.address)
            assert.isTrue(YUSDinSP.gt(mv._zeroBN))
            assert.isTrue(ETHinSP.gt(mv._zeroBN))
      
            // D makes an SP deposit
            await stabilityPool.provideToSP(dec(1000, 18), frontEnd_1, { from: dennis })
            assert.equal((await stabilityPool.getCompoundedYUSDDeposit(dennis)).toString(), dec(1000, 18))
      
            const alice_YUSDDeposit_After = (await stabilityPool.getCompoundedYUSDDeposit(alice)).toString()
            const bob_YUSDDeposit_After = (await stabilityPool.getCompoundedYUSDDeposit(bob)).toString()
            const carol_YUSDDeposit_After = (await stabilityPool.getCompoundedYUSDDeposit(carol)).toString()
      
            const alice_ETHGain_After = ((await stabilityPool.getDepositorGains(alice))[1][0]).toString()
            const bob_ETHGain_After = ((await stabilityPool.getDepositorGains(bob))[1][0]).toString()
            const carol_ETHGain_After = ((await stabilityPool.getDepositorGains(carol))[1][0]).toString()
      
            // Check compounded deposits and ETH gains for A, B and C have not changed
            assert.equal(alice_YUSDDeposit_Before, alice_YUSDDeposit_After)
            assert.equal(bob_YUSDDeposit_Before, bob_YUSDDeposit_After)
            assert.equal(carol_YUSDDeposit_Before, carol_YUSDDeposit_After)
      
            assert.equal(alice_ETHGain_Before, alice_ETHGain_After)
            assert.equal(bob_ETHGain_Before, bob_ETHGain_After)
            assert.equal(carol_ETHGain_Before, carol_ETHGain_After)
          })

          it("withdrawFromSP(): caller can withdraw full deposit and ETH gain during Recovery Mode", async () => {
            // --- SETUP ---
            // Price doubles
            await priceFeedAVAX.setPrice(dec(400, 18))
            await priceFeedETH.setPrice(dec(300, 18))

            await th.addMultipleERC20(defaulter_1, borrowerOperations.address, [weth, wavax], [dec(50, 18), dec(100, 18)], { from: defaulter_1 })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(3290, 18)), defaulter_1, defaulter_1, [weth.address, wavax.address], [dec(50, 18), dec(100, 18)], { from: defaulter_1 })
            // A, B, C open troves and make Stability Pool deposits
            await th.addMultipleERC20(alice, borrowerOperations.address, [weth, wavax], [dec(50, 18), dec(100, 18)], { from: alice })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(3000, 18)), alice, alice, [weth.address, wavax.address], [dec(50, 18), dec(100, 18)], { from: alice })

            await th.addMultipleERC20(bob, borrowerOperations.address, [weth, wavax], [dec(50, 18), dec(100, 18)], { from: bob })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(3000, 18)), bob, bob, [weth.address, wavax.address], [dec(50, 18), dec(100, 18)], { from: bob })

            await th.addMultipleERC20(carol, borrowerOperations.address, [weth, wavax], [dec(50, 18), dec(100, 18)], { from: carol })
            await borrowerOperations.openTrove(th._100pct, toBN(dec(3000, 18)), carol, carol, [weth.address, wavax.address], [dec(50, 18), dec(100, 18)], { from: carol })

            const TCR = await troveManager.getTCR();
            console.log("TCR", TCR.toString());

            // A, B, C provides 10000, 5000, 3000 YUSD to SP
            await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, { from: alice })
            await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, { from: bob })
            await stabilityPool.provideToSP(dec(2000, 18), frontEnd_1, { from: carol })
      
            // Price halves
            await priceFeedAVAX.setPrice(dec(30, 18))
            await priceFeedETH.setPrice(dec(18, 18))
            
            const TCRpost = await troveManager.getTCR();
            console.log("TCR", TCRpost.toString());
      
            assert.isTrue(await th.checkRecoveryMode(contracts))
      
            // Liquidate defaulter 1
            await troveManager.liquidate(defaulter_1)
            assert.isFalse(await sortedTroves.contains(defaulter_1))
      
            const alice_YUSD_Balance_Before = await yusdToken.balanceOf(alice)
            const bob_YUSD_Balance_Before = await yusdToken.balanceOf(bob)
            const carol_YUSD_Balance_Before = await yusdToken.balanceOf(carol)
      
            const alice_ETH_Balance_Before = web3.utils.toBN(await weth.balanceOf(alice))
            const bob_ETH_Balance_Before = web3.utils.toBN(await weth.balanceOf(bob))
            const carol_ETH_Balance_Before = web3.utils.toBN(await weth.balanceOf(carol))
      
            const alice_Deposit_Before = await stabilityPool.getCompoundedYUSDDeposit(alice)
            const bob_Deposit_Before = await stabilityPool.getCompoundedYUSDDeposit(bob)
            const carol_Deposit_Before = await stabilityPool.getCompoundedYUSDDeposit(carol)
      
            const alice_ETHGain_Before = (await stabilityPool.getDepositorGains(alice))[1][0]
            const bob_ETHGain_Before = (await stabilityPool.getDepositorGains(bob))[1][0]
            const carol_ETHGain_Before = (await stabilityPool.getDepositorGains(carol))[1][0]
      
            const YUSDinSP_Before = await stabilityPool.getTotalYUSDDeposits()
      
            // Price rises
            // await priceFeedAVAX.setPrice(dec(220, 18))
      
            assert.isTrue(await th.checkRecoveryMode(contracts))
      
            // A, B, C withdraw their full deposits from the Stability Pool
            await stabilityPool.withdrawFromSP(dec(2000, 18), { from: alice, gasPrice: 0 })
            await stabilityPool.withdrawFromSP(dec(2000, 18), { from: bob, gasPrice: 0 })
            await stabilityPool.withdrawFromSP(dec(2000, 18), { from: carol, gasPrice: 0 })
      
            // Check YUSD balances of A, B, C have risen by the value of their compounded deposits, respectively
            const alice_expectedYUSDBalance = (alice_YUSD_Balance_Before.add(alice_Deposit_Before)).toString()
           
            const bob_expectedYUSDBalance = (bob_YUSD_Balance_Before.add(bob_Deposit_Before)).toString()
            const carol_expectedYUSDBalance = (carol_YUSD_Balance_Before.add(carol_Deposit_Before)).toString()
      
            const alice_YUSD_Balance_After = (await yusdToken.balanceOf(alice)).toString()
       
            const bob_YUSD_Balance_After = (await yusdToken.balanceOf(bob)).toString()
            const carol_YUSD_Balance_After = (await yusdToken.balanceOf(carol)).toString()
      
            assert.equal(alice_YUSD_Balance_After, alice_expectedYUSDBalance)
            assert.equal(bob_YUSD_Balance_After, bob_expectedYUSDBalance)
            assert.equal(carol_YUSD_Balance_After, carol_expectedYUSDBalance)
      
            // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
            const alice_expectedETHBalance = (alice_ETH_Balance_Before.add(alice_ETHGain_Before)).toString()
            const bob_expectedETHBalance = (bob_ETH_Balance_Before.add(bob_ETHGain_Before)).toString()
            const carol_expectedETHBalance = (carol_ETH_Balance_Before.add(carol_ETHGain_Before)).toString()
      
            const alice_ETHBalance_After = (await weth.balanceOf(alice)).toString()
            const bob_ETHBalance_After = (await weth.balanceOf(bob)).toString()
            const carol_ETHBalance_After = (await weth.balanceOf(carol)).toString()
      
            assert.equal(alice_expectedETHBalance, alice_ETHBalance_After)
            assert.equal(bob_expectedETHBalance, bob_ETHBalance_After)
            assert.equal(carol_expectedETHBalance, carol_ETHBalance_After)
      
            // Check YUSD in Stability Pool has been reduced by A, B and C's compounded deposit
            const expectedYUSDinSP = (YUSDinSP_Before
              .sub(alice_Deposit_Before)
              .sub(bob_Deposit_Before)
              .sub(carol_Deposit_Before))
              .toString()
            const YUSDinSP_After = (await stabilityPool.getTotalYUSDDeposits()).toString()
            assert.equal(YUSDinSP_After, expectedYUSDinSP)
      
            // Check ETH in SP has reduced to zero
            const ETHinSP_After = (await stabilityPool.getCollateral(weth.address)).toString()
            assert.isAtMost(th.getDifference(ETHinSP_After, '0'), 100000)
          })
    })
});