import { expect } from "chai";
import { fromWei, ONE_WEI, toWei } from "./utils/Decimal";
import { Signer } from "./utils/ContractBase";
import { TempusAMM, TempusAMMJoinKind } from "./utils/TempusAMM";
import { expectRevert } from "./utils/Utils";
import { PoolType, TempusPool } from "./utils/TempusPool";
import { TempusController } from "./utils/TempusController";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";
import { ITestPool } from "./pool-utils/ITestPool";
import { BigNumber } from "@ethersproject/bignumber";

const SWAP_LIMIT_ERROR_MESSAGE = "BAL#507";

describeForEachPool("TempusController", (testPool:ITestPool) =>
{
  let owner:Signer, user1:Signer, user2:Signer;
  let pool:TempusPool;
  let amm:TempusAMM;
  let controller:TempusController;

  beforeEach(async () =>
  {
    pool = await testPool.createDefault();
    [owner, user1, user2] = testPool.signers;

    amm = testPool.amm;
    controller = testPool.tempus.controller;
    await testPool.setupAccounts(owner, [[user1,/*ybt*/1000000],[user2,/*ybt*/100000]]);
  });

  // TODO: refactor math (minimize toWei, fromWei, Number etc...). I think we should just use Decimal.js
  async function getAMMBalancesRatio(): Promise<BigNumber>
  {
    const principals = await pool.principalShare.balanceOf(amm.vault.address);
    const yields = await pool.yieldShare.balanceOf(amm.vault.address);
    return ONE_WEI.mul(toWei(principals)).div(toWei(yields));
  }

  // pre-initialize AMM liquidity
  async function initAMM(user:Signer, ybtDeposit:number, principals:number, yields:number)
  {
    await controller.depositYieldBearing(user, pool, ybtDeposit, user);
    await amm.provideLiquidity(user1, principals, yields, TempusAMMJoinKind.INIT);
  }

  async function expectValidState(expectedAMMBalancesRatio:BigNumber = null)
  {
    if (expectedAMMBalancesRatio) {
      expect(await getAMMBalancesRatio()).to.equal(expectedAMMBalancesRatio, "AMM balances must maintain the same ratio");
    }
    expect(+await pool.principalShare.balanceOf(controller.address)).to.be.lessThan(2e-18, "No funds should remain in controller");
    expect(+await pool.yieldShare.balanceOf(controller.address)).to.be.lessThan(2e-18, "No funds should remain in controller");
  }

  describe("depositAndProvideLiquidity", () =>
  {
    it("deposit YBT and provide liquidity to a pre-initialized AMM", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/1200, /*principals*/120, /*yields*/1200);

      const ratioBefore = await getAMMBalancesRatio();
      await controller.depositAndProvideLiquidity(testPool, user2, 500, /*isBackingToken:*/false);
      await expectValidState(ratioBefore);
      
      expect(+await amm.balanceOf(user2)).to.be.greaterThan(0, "pool tokens must be issued to the user");
      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });

    it("deposit BT and provide liquidity to a pre-initialized AMM", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/100, /*principals*/1.2, /*yields*/12);

      const ratioBefore = await getAMMBalancesRatio();
      const ethAmount = testPool.type == PoolType.Lido ? 50 : 0;
      await controller.depositAndProvideLiquidity(testPool, user2, 50, true, ethAmount);
      await expectValidState(ratioBefore);

      expect(+await amm.balanceOf(user2)).to.be.greaterThan(0, "pool tokens must be issued to the user");
      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });

    it("deposit YBT and provide liquidity to a pre-initialized AMM with more then 100% yield estimate [ @skip-on-coverage ]", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/1200, /*principals*/120, /*yields*/12);
      await testPool.setInterestRate(10.0);

      const ratioBefore = await getAMMBalancesRatio();
      await controller.depositAndProvideLiquidity(testPool, user2, 100, false); 
      await expectValidState(ratioBefore);

      expect(+await amm.balanceOf(user2)).to.be.greaterThan(0, "pool tokens must be issued to the user");
      expect(+await pool.principalShare.balanceOf(user2)).to.be.equal(0, "ALL Principals should be deposited to AMM");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.greaterThan(0, "Some Yields should be returned to user");
    });

    it("verifies depositing YBT and providing liquidity to a non initialized AMM reverts", async () =>
    {
      const invalidAction = controller.depositAndProvideLiquidity(testPool, user1, 123, false);
      (await expectRevert(invalidAction)).to.equal("AMM not initialized");
    });

    it("verifies depositing ERC20 BT and providing liquidity to a non initialized AMM reverts", async () =>
    {
      const invalidAction = controller.depositAndProvideLiquidity(testPool, user1, 123, true);
      (await expectRevert(invalidAction)).to.equal("AMM not initialized");
    });

    it("verifies depositing 0 YBT and providing liquidity reverts", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/12.34567, /*yields*/1234.567891);
      const invalidAction = controller.depositAndProvideLiquidity(testPool, user2, 0, false);
      (await expectRevert(invalidAction)).to.equal("yieldTokenAmount is 0");
    });
  });

  describe("depositAndFix", () =>
  {
    it("verifies tx reverts if provided minimum TYS rate requirement is not met", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/200, /*yields*/2000); // 10% rate
      const minTYSRate = "0.11";
      const invalidAction = controller.depositAndFix(testPool, user2, 5.456789, false, minTYSRate); 

      (await expectRevert(invalidAction)).to.equal(SWAP_LIMIT_ERROR_MESSAGE);
    });

    it("verifies depositing YBT succeeds if provided minimum TYS rate requirement is met", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/200, /*yields*/2000); // 10% rate
      const minTYSRate = "0.097"; // 9.7% (fee + slippage)
      await controller.depositAndFix(testPool, user2, 5.456789, false, minTYSRate); 
      await expectValidState();

      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });

    it("verifies depositing BT succeeds if provided minimum TYS rate requirement is met", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/20, /*yields*/200); // 10% rate
      const minTYSRate = "0.097"; // 9.7% (fee + slippage)
      const amount = 5.456789;
      const ethAmount = testPool.type == PoolType.Lido ? amount : 0;
      await controller.depositAndFix(testPool, user2, 5.456789, true, minTYSRate, ethAmount); 
      await expectValidState();

      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });
  });

  describe("provideLiquidity", () =>
  {
    it("check lp provided", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/100, /*yields*/1000); // 10% rate
      await controller.provideLiquidity(testPool, user1, 1000);
      expect(+await pool.principalShare.balanceOf(user1)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user1)).to.be.equal(0, "ALL Yields should be deposited to AMM");
      expect(+await testPool.amm.balanceOf(user1)).to.be.greaterThan(0, "Should have some LP tokens");
    });
  });

  describe("Exit AMM", () =>
  {
    it("ExitAMM after maturity", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      const beforeExitBalanceLP:number = +await testPool.amm.balanceOf(user1);
      const totalSupply:number = +await testPool.amm.totalSupply();
      expect(beforeExitBalanceLP).to.be.within(181000, 182000);
      await testPool.setInterestRate(1.1);
      await testPool.fastForwardToMaturity();
      await controller.exitTempusAmm(testPool, user1, 100000);
      const redeemPercent:number = 100000 / totalSupply;
      expect(+await testPool.amm.balanceOf(user1)).to.be.within(81000, 82000);
      expect(+await testPool.tempus.yieldShare.balanceOf(user1)).to.be.within(0.999999 * redeemPercent * 1000000, 1.000001 * redeemPercent * 1000000);
      // user already had 900000 because he provided liquidity with 100000 only
      const redeemedPrincipals = (+await testPool.tempus.principalShare.balanceOf(user1)) - 900000;
      expect(redeemedPrincipals).to.be.within(0.999999 * redeemPercent * 100000, 1.000001 * redeemPercent * 100000);
    });
  });

  describe("Exit AMM and Reedem", () => 
  {
    it("Exit AMM and redeem before maturity", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);

      await controller.depositYieldBearing(user2, pool, 10000, user2);
      await testPool.amm.provideLiquidity(user2, 1000, 10000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);
      
      const userP:number = +await testPool.tempus.principalShare.balanceOf(user2);
      const userY:number = +await testPool.tempus.yieldShare.balanceOf(user2);
      const userPRedeem:number = userP < 9999 ? userP : 9999;
      const userYRedeem:number = userY < 9999 ? userY : 9999;
      await controller.exitTempusAMMAndRedeem(
        testPool, 
        user2, 
        userPRedeem,
        userYRedeem,
        9999 - userPRedeem, 
        9999 - userYRedeem,
        false
      );
      expect(await pool.yieldShare.balanceOf(user2)).to.equal(0);
      expect(await pool.principalShare.balanceOf(user2)).to.equal(0);
      expect(+await amm.balanceOf(user2)).to.be.within(0.991, 0.993);
      expect(await pool.yieldBearing.balanceOf(user2)).to.equal(99999);
    });

    it("Exit AMM and redeem to backing before maturity", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      await controller.depositYieldBearing(user2, pool, 10000, user2);
      await testPool.amm.provideLiquidity(user2, 1000, 10000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);
      const userP:number = +await testPool.tempus.principalShare.balanceOf(user2);
      const userY:number = +await testPool.tempus.yieldShare.balanceOf(user2);
      const userPRedeem:number = userP < 9999 ? userP : 9999;
      const userYRedeem:number = userY < 9999 ? userY : 9999;
      const reedemAction = controller.exitTempusAMMAndRedeem(
        testPool, 
        user2, 
        userPRedeem,
        userYRedeem,
        9999 - userPRedeem,
        9999 - userYRedeem, 
        true
      );
      if (testPool.type === PoolType.Lido) {
        (await expectRevert(reedemAction)).to.equal("LidoTempusPool.withdrawFromUnderlyingProtocol not supported");
      }
      else {
        await reedemAction;
        expect(await pool.yieldShare.balanceOf(user2)).to.equal(0);
        expect(await pool.principalShare.balanceOf(user2)).to.equal(0);
        expect(+await amm.balanceOf(user2)).to.be.within(0.991, 0.993);
        expect(await testPool.asset().balanceOf(user2)).to.equal(109999);
      }
    });

    it("Exit AMM and redeem after maturity should revert", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      await testPool.fastForwardToMaturity();

      (await expectRevert(controller.exitTempusAMMAndRedeem(
        testPool, 
        user2, 
        100000, 
        100000,
        0,
        0,
        false
      ))).to.equal(
        "Pool already finalized"
      );
    });
  });

  describe("Complete Exit", () => 
  {
    it("Complete exit before maturity", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      
      const preBalanceUser2 = +await testPool.yieldTokenBalance(user2);
      const preBalanceOwner = +await testPool.yieldTokenBalance(owner);
      await testPool.controller.depositAndProvideLiquidity(testPool, user2, 10000, false);
      await testPool.controller.depositAndFix(testPool, owner, 100, false, 0);

      await controller.exitTempusAmmAndRedeem(
        testPool, 
        user2, 
        await testPool.amm.balanceOf(user2), 
        await testPool.tempus.principalShare.balanceOf(user2),
        await testPool.tempus.yieldShare.balanceOf(user2), 
        false
      );
      await controller.exitTempusAmmAndRedeem(
        testPool, 
        owner, 
        await testPool.amm.balanceOf(owner), 
        await testPool.tempus.principalShare.balanceOf(owner),
        await testPool.tempus.yieldShare.balanceOf(owner), 
        false
      );

      const postBalanceUser2 = +await testPool.yieldTokenBalance(user2);
      const postBalanceOwner = +await testPool.yieldTokenBalance(owner);

      expect(postBalanceOwner).to.be.within(preBalanceOwner - 1, preBalanceOwner + 1);
      expect(postBalanceUser2).to.be.within(preBalanceUser2 - 1, preBalanceUser2 + 1);
    });

    it("Complete exit to yield bearing", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      expect(await testPool.tempus.yieldShare.balanceOf(user1)).to.equal(0, "all yields are in amm");
      expect(await testPool.tempus.principalShare.balanceOf(user1)).to.equal(
        900000, 
        "balance should decrease as there is some of it locked in amm"
      );
      expect(+fromWei(await testPool.amm.contract.balanceOf(user1.address))).to.be.within(181000, 182000);
      
      await testPool.setInterestRate(1.1);
      await testPool.fastForwardToMaturity();

      expect(await testPool.yieldTokenBalance(user1)).to.equal(0);

      await controller.exitTempusAmmAndRedeem(
        testPool, 
        user1, 
        await testPool.amm.balanceOf(user1), 
        await testPool.tempus.principalShare.balanceOf(user1),
        await testPool.tempus.yieldShare.balanceOf(user1),
        false
      );

      expect(await testPool.tempus.yieldShare.balanceOf(user1)).to.equal(0);
      expect(await testPool.tempus.principalShare.balanceOf(user1)).to.equal(0);
      expect(await testPool.amm.contract.balanceOf(user1.address)).to.equal(0);
      if (testPool.yieldPeggedToAsset) {
        expect(+await testPool.yieldTokenBalance(user1)).to.be.within(1099000, 1101000);
      } else {
        expect(+await testPool.yieldTokenBalance(user1)).to.be.within(999000, 1001000);
      }

    });

    it("Complete exit to backing", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      expect(await pool.yieldShare.balanceOf(user1)).to.equal(0, "all yields are in amm");
      expect(await pool.principalShare.balanceOf(user1)).to.equal(
        900000,
        "balance should decrease as there is some of it locked in amm"
      );
      expect(+fromWei(await testPool.amm.contract.balanceOf(user1.address))).to.be.within(181000, 182000);

      await testPool.setInterestRate(1.1);
      await testPool.fastForwardToMaturity();

      if (testPool.type == PoolType.Lido)
      {
        (await expectRevert(controller.exitTempusAmmAndRedeem(
          testPool, 
          user1, 
          await testPool.amm.balanceOf(user1), 
          await testPool.tempus.principalShare.balanceOf(user1),
          await testPool.tempus.yieldShare.balanceOf(user1),
          true
        ))).to.equal(
          "LidoTempusPool.withdrawFromUnderlyingProtocol not supported"
        );
      }
      else
      {
        expect(await testPool.backingTokenBalance(user1)).to.equal(100000);
        await controller.exitTempusAmmAndRedeem(
          testPool, 
          user1, 
          await testPool.amm.balanceOf(user1), 
          await testPool.tempus.principalShare.balanceOf(user1),
          await testPool.tempus.yieldShare.balanceOf(user1),
          true
        );
        expect(await pool.yieldShare.balanceOf(user1)).to.equal(0);
        expect(await pool.principalShare.balanceOf(user1)).to.equal(0);
        expect(await testPool.amm.contract.balanceOf(user1.address)).to.equal(0);
        expect(+await testPool.backingTokenBalance(user1)).to.be.within(1199000, 1200000);
      }
    });
  });

});
