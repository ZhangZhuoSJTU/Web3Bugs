import { expect } from "chai";
import { BigNumber } from "ethers";
import { fromWei, NumberOrString } from "../utils/Decimal";
import { Signer } from "../utils/ContractBase";
import { PoolType, TempusPool } from "../utils/TempusPool";
import { evmMine, evmSetAutomine, expectRevert, increaseTime } from "../utils/Utils";
import { TempusAMM, TempusAMMExitKind, TempusAMMJoinKind } from "../utils/TempusAMM";
import { describeForEachPool } from "../pool-utils/MultiPoolTestSuite";
import { ITestPool } from "../pool-utils/ITestPool";
import exp = require("constants");
import { ethers } from "hardhat";

enum SwapType {
  SWAP_GIVEN_IN,
  SWAP_GIVEN_OUT
}

interface SwapTestRun {
  amplification:number;
  swapAmountIn:NumberOrString;
  swapAmountOut: NumberOrString;
  principalIn:boolean;
}

interface CreateParams {
  yieldEst:number;
  duration:number;
  amplifyStart:number;
  amplifyEnd?:number;
  oneAmpUpdate?:number;
  ammBalanceYield?: number;
  ammBalancePrincipal?:number;
}

describeForEachPool("TempusAMM", (testFixture:ITestPool) =>
{
  let owner:Signer, user:Signer, user1:Signer;
  const SWAP_FEE_PERC:number = 0.02;
  const ONE_HOUR:number = 60*60;
  const ONE_DAY:number = ONE_HOUR*24;
  const ONE_MONTH:number = ONE_DAY*30;
  const ONE_YEAR:number = ONE_MONTH*12;
  const ONE_AMP_UPDATE_TIME:number = ONE_DAY;

  let tempusPool:TempusPool;
  let tempusAMM:TempusAMM;
  
  async function createPools(params:CreateParams): Promise<void> {
    const oneAmplifyUpdate = (params.oneAmpUpdate === undefined) ? ONE_AMP_UPDATE_TIME : params.oneAmpUpdate;
    
    tempusPool = await testFixture.createWithAMM({
      initialRate:1.0, poolDuration:params.duration, yieldEst:params.yieldEst,
      ammSwapFee:SWAP_FEE_PERC, ammAmplification: params.amplifyStart
    });

    tempusAMM = testFixture.amm;
    [owner, user, user1] = testFixture.signers;

    const depositAmount = 1_000_000;
    await testFixture.deposit(owner, depositAmount);
    await tempusPool.controller.depositYieldBearing(owner, tempusPool, depositAmount, owner);
    if (params.ammBalanceYield != undefined && params.ammBalancePrincipal != undefined) {
      await tempusAMM.provideLiquidity(owner, params.ammBalancePrincipal, params.ammBalanceYield, TempusAMMJoinKind.INIT);
    }
    if (params.amplifyEnd != undefined) {
      await tempusAMM.startAmplificationUpdate(params.amplifyEnd, oneAmplifyUpdate);
    }
  }

  async function checkSwap(owner:Signer, swapTest:SwapTestRun) {
    await tempusAMM.forwardToAmplification(swapTest.amplification);

    const [tokenIn, tokenOut] = 
      swapTest.principalIn ? 
      [tempusAMM.principalShare, tempusAMM.yieldShare] : 
      [tempusAMM.yieldShare, tempusAMM.principalShare];

    const preSwapTokenInBalance:BigNumber = await tokenIn.contract.balanceOf(owner.address);
    const preSwapTokenOutBalance:BigNumber = await tokenOut.contract.balanceOf(owner.address);
  
    await tempusAMM.swapGivenIn(owner, tokenIn.address, tokenOut.address, swapTest.swapAmountIn);
    
    // mine a block in case the current test case has automining set to false (otherwise expect functions would fail...)
    await evmMine();

    const postSwapTokenInBalance:BigNumber = await tokenIn.contract.balanceOf(owner.address);
    const postSwapTokenOutBalance:BigNumber = await tokenOut.contract.balanceOf(owner.address);
    
    expect(+tokenIn.fromBigNum(preSwapTokenInBalance.sub(postSwapTokenInBalance))).to.be.within(+swapTest.swapAmountIn * 0.97, +swapTest.swapAmountIn * 1.02);
    expect(+tokenIn.fromBigNum(postSwapTokenOutBalance.sub(preSwapTokenOutBalance))).to.be.within(+swapTest.swapAmountOut * 0.97, +swapTest.swapAmountOut * 1.02);
  }

  it("[getExpectedReturnGivenIn] verifies the expected amount is equivilant to actual amount returned from swapping (TYS to TPS)", async () => {
    const inputAmount = 1;
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setTimeRelativeToPoolStart(0.5);
    const expectedReturn = await tempusAMM.getExpectedReturnGivenIn(inputAmount, true); // TYS --> TPS
    
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setNextBlockTimestampRelativeToPoolStart(0.5);
    await evmSetAutomine(false);
    
    try {
      await checkSwap(owner, {amplification: 5, swapAmountIn: inputAmount, swapAmountOut: expectedReturn, principalIn: false});
    }
    finally {
      // in case checkSwap fails, we must enable automining so that other tests are not affected
      await evmSetAutomine(true);    
    }
  });

  it("[getExpectedReturnGivenIn] verifies the expected amount is equivilant to actual amount returned from swapping (TPS to TYS)", async () => {
    const inputAmount = 1;
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setTimeRelativeToPoolStart(0.5);
    const expectedReturn = await tempusAMM.getExpectedReturnGivenIn(inputAmount, true); // TYS --> TPS
    
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setNextBlockTimestampRelativeToPoolStart(0.5);
    await evmSetAutomine(false);
    try {
      await checkSwap(owner, {amplification: 5, swapAmountIn: inputAmount, swapAmountOut: expectedReturn, principalIn: false});
    }
    finally {
      // in case checkSwap fails, we must enable automining so that other tests are not affected
      await evmSetAutomine(true);    
    }
  });

  it("[getExpectedTokensOutGivenBPTIn] verifies the expected amount is equivilant to actual exit from TempusAMM", async () => {
    const inputAmount = 100;
    
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setTimeRelativeToPoolStart(0.5);
    const expectedReturn = await testFixture.amm.getExpectedTokensOutGivenBPTIn(inputAmount);
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setNextBlockTimestampRelativeToPoolStart(0.5);
    
    const balancePrincipalsBefore = +await testFixture.tempus.principalShare.balanceOf(owner);
    const balanceYieldsBefore = +await testFixture.tempus.yieldShare.balanceOf(owner);
    await testFixture.amm.exitPoolExactLpAmountIn(owner, inputAmount);
    const balancePrincipalsAfter = +await testFixture.tempus.principalShare.balanceOf(owner);
    const balanceYieldsAfter = +await testFixture.tempus.yieldShare.balanceOf(owner);
    expect(balancePrincipalsBefore + expectedReturn.principals).to.be.within(0.999999 * balancePrincipalsAfter, 1.0000001 * balancePrincipalsAfter);
    expect(balanceYieldsBefore + expectedReturn.yields).to.be.within(0.999999 * balanceYieldsAfter, 1.0000001 * balanceYieldsAfter);
  });

  it("[getExpectedLPTokensForTokensIn] verifies the expected amount is equivilant to actual join to TempusAMM", async () => {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setTimeRelativeToPoolStart(0.5);
    const expectedReturn = +await testFixture.amm.getExpectedLPTokensForTokensIn(10, 100);
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setNextBlockTimestampRelativeToPoolStart(0.5);

    await evmSetAutomine(false);
    
    try {
      const balanceLpBefore = +await testFixture.amm.balanceOf(owner);
      await testFixture.amm.provideLiquidity(owner, 10, 100, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);
      await evmMine();
      const balanceLpAfter = +await testFixture.amm.balanceOf(owner);
      await evmMine();
      expect(balanceLpBefore + expectedReturn).to.be.within(0.999999 * balanceLpAfter, 1.0000001 * balanceLpAfter);
    } finally {
      await evmSetAutomine(true);
    }
  });

  it("[getExpectedBPTInGivenTokensOut] verifies predicted exit amount matches actual exit amount", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 10000, ammBalanceYield: 100000});
    await testFixture.setTimeRelativeToPoolStart(0.5);

    const LpBefore = +await testFixture.amm.balanceOf(owner);
    const LpExpectedExit = +await testFixture.amm.getExpectedBPTInGivenTokensOut(10, 100);
    const LpExpected = LpBefore - LpExpectedExit;

    await testFixture.amm.exitPoolExactAmountOut(owner, [10, 100], /*maxAmountLpIn*/1000);
    const LpAfter = +await testFixture.amm.balanceOf(owner);

    expect(LpAfter).to.be.within(0.999999 * LpExpected, 1.0000001 * LpExpected);
  });

  it("checks amplification and invariant in multiple stages", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5});
    let ampInv = await testFixture.amm.getLastInvariant();
    expect(ampInv.invariant).to.equal(0);
    expect(ampInv.amplification).to.equal(0);
    await testFixture.amm.provideLiquidity(owner, 100, 1000, TempusAMMJoinKind.INIT);
    ampInv = await testFixture.amm.getLastInvariant();
    expect(ampInv.invariant).to.be.within(181, 182);
    expect(ampInv.amplification).to.equal(5000);
  });

  it("checks invariant increases over time with adding liquidity", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, amplifyEnd: 95, oneAmpUpdate: (ONE_MONTH / 90)});
    await testFixture.amm.provideLiquidity(owner, 100, 1000, TempusAMMJoinKind.INIT);
    let ampInv = await testFixture.amm.getLastInvariant();
    const amplificationParams = await testFixture.amm.getAmplificationParam();
    expect(amplificationParams.value).to.be.equal(ampInv.amplification);
    expect(amplificationParams.isUpdating).to.be.true;
    expect(ampInv.invariant).to.be.within(200 / 1.11, 200 / 1.09);
    
    // move half period of pool duration
    await testFixture.setTimeRelativeToPoolStart(0.5);
    await testFixture.setInterestRate(1.05);
    await testFixture.amm.provideLiquidity(owner, 100, 1000, 1);
    ampInv = await testFixture.amm.getLastInvariant();
    expect(ampInv.invariant).to.be.within(400 / (1.1 / 1.049), 400 / (1.1 / 1.051));
    
    // move to the end of the pool
    await testFixture.setTimeRelativeToPoolStart(1.0);
    await testFixture.setInterestRate(1.1);
    await testFixture.amm.provideLiquidity(owner, 100, 1000, 1);
    ampInv = await testFixture.amm.getLastInvariant();
    expect(ampInv.invariant).to.be.equal(600);
  });

  it("checks amplification update reverts with invalid args", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5});

    // min amp 
    let invalidAmpUpdate = tempusAMM.startAmplificationUpdate(0, 0);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#300");

    // max amp 
    invalidAmpUpdate = tempusAMM.startAmplificationUpdate(1000000, 0);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#301");

    // min duration
    invalidAmpUpdate = tempusAMM.startAmplificationUpdate(65, 1);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#317");

    // stop update no ongoing update
    invalidAmpUpdate = tempusAMM.stopAmplificationUpdate();
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#320");

    // there is ongoing update
    await tempusAMM.startAmplificationUpdate(65, 60*60*12);
    await increaseTime(60*60*24*15);
    testFixture.setInterestRate(1.05);
    invalidAmpUpdate = tempusAMM.startAmplificationUpdate(95, 60*60*24);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#318");

    // stop update
    await tempusAMM.stopAmplificationUpdate();
    await tempusAMM.provideLiquidity(owner, 100, 1000, TempusAMMJoinKind.INIT);
    const ampInv = await tempusAMM.getLastInvariant();
    expect(ampInv.amplification).to.equal(35000);
  });

  it("revert on invalid join kind", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5});
    await tempusAMM.provideLiquidity(owner, 100, 1000, TempusAMMJoinKind.INIT);
    (await expectRevert(tempusAMM.provideLiquidity(owner, 100, 1000, TempusAMMJoinKind.INVALID)));
  });

  it("revert on join after maturity", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5});
    await testFixture.fastForwardToMaturity();
    (await expectRevert(tempusAMM.provideLiquidity(owner, 100, 1000, TempusAMMJoinKind.INIT)));
  });

  it("checks LP exiting pool", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 100, ammBalanceYield: 1000});
    const preYieldBalance = +await tempusAMM.yieldShare.balanceOf(owner);
    const prePrincipalBalance = +await tempusAMM.principalShare.balanceOf(owner);
    expect(+await tempusAMM.balanceOf(owner)).to.be.within(181, 182);
    await tempusAMM.exitPoolExactLpAmountIn(owner, 100);
    expect(+await tempusAMM.balanceOf(owner)).to.be.within(81, 82);
    const postYieldBalance = +await tempusAMM.yieldShare.balanceOf(owner);
    const postPrincipalBalance = +await tempusAMM.principalShare.balanceOf(owner);
    expect(postPrincipalBalance - prePrincipalBalance).to.be.within(55, 56);
    expect(postYieldBalance - preYieldBalance).to.be.within(550, 551);
  });

  it("checks LP exiting pool with exact tokens out", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 100, ammBalanceYield: 1000});
    const preYieldBalance = +await tempusAMM.yieldShare.balanceOf(owner);
    const prePrincipalBalance = +await tempusAMM.principalShare.balanceOf(owner);
    expect(+await tempusAMM.balanceOf(owner)).to.be.within(181, 182);
    await tempusAMM.exitPoolExactAmountOut(owner, [50, 500], 101);
    expect(+await tempusAMM.balanceOf(owner)).to.be.within(90, 91);
    const postYieldBalance = +await tempusAMM.yieldShare.balanceOf(owner);
    const postPrincipalBalance = +await tempusAMM.principalShare.balanceOf(owner);
    expect(postPrincipalBalance - prePrincipalBalance).to.equal(50);
    expect(postYieldBalance - preYieldBalance).to.equal(500);
  });

  it("checks second LP's pool token balance without swaps between", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 100, ammBalanceYield: 1000});

    await tempusAMM.principalShare.transfer(owner, user.address, 1000);
    await tempusAMM.yieldShare.transfer(owner, user.address, 1000);
    await tempusAMM.provideLiquidity(user, 100, 1000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);

    let balanceUser = +await tempusAMM.balanceOf(user);
    let balanceOwner = +await tempusAMM.balanceOf(owner);
    expect(balanceOwner).to.be.within(balanceUser * 0.99999, balanceUser * 1.000001);
  });

  it("checks rate and second LP's pool token balance with swaps between", async () =>
  {
    await createPools({yieldEst:0.1, duration:ONE_MONTH, amplifyStart:5, ammBalancePrincipal: 100, ammBalanceYield: 1000});

    expect(+await tempusAMM.balanceOf(owner)).to.be.within(181, 182);
    expect(+await tempusAMM.getRate()).to.be.equal(1);

    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 10);

    await tempusAMM.principalShare.transfer(owner, user.address, 1000);
    await tempusAMM.yieldShare.transfer(owner, user.address, 1000);
    await tempusAMM.provideLiquidity(user, 100, 1000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);

    expect(+await tempusAMM.balanceOf(user)).to.be.within(181, 182);
    expect(+await tempusAMM.getRate()).to.be.within(1.0019, 1.002);

    // do more swaps
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 10);
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 10);
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 10);
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 10);

    // provide more liquidity with different user
    await tempusAMM.principalShare.transfer(owner, user1.address, 1000);
    await tempusAMM.yieldShare.transfer(owner, user1.address, 1000);
    await tempusAMM.provideLiquidity(user1, 100, 1000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);
    
    expect(+await tempusAMM.balanceOf(user1)).to.be.within(180, 181);
    expect(+await tempusAMM.getRate()).to.be.within(1.00598, 1.0060);
  });

  it("test swaps principal in with balances aligned with Interest Rate", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.1, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:95, ammBalancePrincipal: 10000, ammBalanceYield: 100000});

    // basic swap with Interest Rate aligned to balances with increasing amplification
    await checkSwap(owner, {amplification: 5, swapAmountIn: 1, swapAmountOut: 9.800039358937214, principalIn: true});
    await checkSwap(owner, {amplification: 95, swapAmountIn: 1, swapAmountOut: 9.808507816594444, principalIn: true});
    // swap big percentage of tokens 
    // let's start updating amp backwards
    await tempusAMM.startAmplificationUpdate(5, ONE_AMP_UPDATE_TIME);
    await checkSwap(owner, {amplification: 95, swapAmountIn: 5000, swapAmountOut: 48717.68223490758, principalIn: true});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 5000, swapAmountOut: 29656.395311170872, principalIn: true});
  });

  it("tests swaps principal in with balances not aligned with Interest Rate - different direction", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.1, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:100, ammBalancePrincipal: 300, ammBalanceYield: 1000});

    // Interest Rate doesn't match balances (different direction) with increasing amplification
    await checkSwap(owner, {amplification: 1, swapAmountIn: 1, swapAmountOut: 5.3317755638575175, principalIn: true});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 1, swapAmountOut: 7.604776113715418, principalIn: true});
    await checkSwap(owner, {amplification: 20, swapAmountIn: 1, swapAmountOut: 9.017438622153582, principalIn: true});
    await checkSwap(owner, {amplification: 55, swapAmountIn: 1, swapAmountOut: 9.48492767451098, principalIn: true});
    await checkSwap(owner, {amplification: 100, swapAmountIn: 1, swapAmountOut: 9.624086305240366, principalIn: true});
    
    await tempusAMM.startAmplificationUpdate(5, ONE_AMP_UPDATE_TIME);
    // swap big percentage of tokens (this is going to make more balance in the pool)
    await checkSwap(owner, {amplification: 95, swapAmountIn: 50, swapAmountOut: 470.5179263828851, principalIn: true});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 50, swapAmountOut: 186.3783216913147, principalIn: true});
  });

  it("test swaps yield in with balances aligned with Interest Rate", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.1, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:95, ammBalancePrincipal: 10000, ammBalanceYield: 100000});

    // basic swap with Interest Rate aligned to balances with increasing amplification
    await checkSwap(owner, {amplification: 5, swapAmountIn: 10, swapAmountOut: 0.9799839923694128, principalIn: false});
    await checkSwap(owner, {amplification: 95, swapAmountIn: 10, swapAmountOut: 0.9791888166812937, principalIn: false});
    // swap big percentage of tokens 
    // let's start updating amp backwards
    await tempusAMM.startAmplificationUpdate(5, ONE_AMP_UPDATE_TIME);
    await checkSwap(owner, {amplification: 95, swapAmountIn: 5000, swapAmountOut: 489.3436560729869, principalIn: false});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 5000, swapAmountOut: 477.32926892162294, principalIn: false});
  });

  it("tests swaps yield in with balances not aligned with Interest Rate - different direction", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.1, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:100, ammBalancePrincipal: 300, ammBalanceYield: 1000});

    // Interest Rate doesn't match balances (different direction) with increasing amplification
    await checkSwap(owner, {amplification: 1, swapAmountIn: 10, swapAmountOut: 1.78720155521161, principalIn: false});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 10, swapAmountOut: 1.2467415717523336, principalIn: false});
    await checkSwap(owner, {amplification: 20, swapAmountIn: 10, swapAmountOut: 1.0564830973599812, principalIn: false});
    await checkSwap(owner, {amplification: 55, swapAmountIn: 10, swapAmountOut: 1.0078689702486059, principalIn: false});
    await checkSwap(owner, {amplification: 100, swapAmountIn: 10, swapAmountOut: 0.9945145891945463, principalIn: false});
    
    await tempusAMM.startAmplificationUpdate(5, ONE_AMP_UPDATE_TIME);
    // swap big percentage of tokens (this is going to make more balance in the pool)
    await checkSwap(owner, {amplification: 95, swapAmountIn: 500, swapAmountOut: 49.438688716741254, principalIn: false});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 500, swapAmountOut: 50.641479074770096, principalIn: false});
  });

  it("test swaps principal in given out with balances aligned with Interest Rate", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.1, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:95, ammBalancePrincipal: 10000, ammBalanceYield: 100000});

    // basic swap with Interest Rate aligned to balances with increasing amplification
    await checkSwap(owner, {amplification: 5, swapAmountIn: 1, swapAmountOut: 9.800039358937214, principalIn: true});
    await checkSwap(owner, {amplification: 95, swapAmountIn: 1, swapAmountOut: 9.808507816594444, principalIn: true});
    // swap big percentage of tokens 
    // let's start updating amp backwards
    await tempusAMM.startAmplificationUpdate(5, ONE_AMP_UPDATE_TIME);
    await checkSwap(owner, {amplification: 95, swapAmountIn: 5000, swapAmountOut: 48717.68223490758, principalIn: true});
    await checkSwap(owner, {amplification: 5, swapAmountIn: 5000, swapAmountOut: 29656.395311170872, principalIn: true});
  });

  // NOTE: putting tests with 0.2 yieldEst here to reduce fixture instantiations
  it("tests swaps yield in with balances not aligned with Interest Rate", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.2, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:95, ammBalancePrincipal: 100, ammBalanceYield: 1000});
    
    await checkSwap(owner, {amplification: 2, swapAmountIn: 10, swapAmountOut: 1.5181390799659535, principalIn: false});
    await checkSwap(owner, {amplification: 15, swapAmountIn: 10, swapAmountOut: 1.854315971827023, principalIn: false});
    await checkSwap(owner, {amplification: 40, swapAmountIn: 10, swapAmountOut: 1.9143269555117204, principalIn: false});
    await checkSwap(owner, {amplification: 85, swapAmountIn: 10, swapAmountOut: 1.935536937130989, principalIn: false});
  });

  it("tests swaps principal in with balances not aligned with Interest Rate", async () =>
  {
    // creating 300 year pool, so that estimated yield is more valued than current one (in order to not update underlying protocols behaviour)
    await createPools({yieldEst:0.2, duration:ONE_YEAR*300, amplifyStart:1, amplifyEnd:95, ammBalancePrincipal: 100, ammBalanceYield: 1000});
    
    await checkSwap(owner, {amplification: 2, swapAmountIn: 1, swapAmountOut: 6.272332951557398, principalIn: true});
    await checkSwap(owner, {amplification: 15, swapAmountIn: 1, swapAmountOut: 5.146813326588359, principalIn: true});
    await checkSwap(owner, {amplification: 40, swapAmountIn: 1, swapAmountOut: 4.994925254153118, principalIn: true});
    await checkSwap(owner, {amplification: 85, swapAmountIn: 1, swapAmountOut: 4.946851638290887, principalIn: true});
  });
});
