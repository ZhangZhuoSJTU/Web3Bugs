import { expect } from "chai";
import { PoolType } from "./utils/TempusPool";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";
import { expectRevert } from "./utils/Utils";

describeForEachPool.type("TempusPool Redeem", [PoolType.Aave, PoolType.Compound], (pool:ITestPool) =>
{
  it("Should redeem correct BackingTokens after depositing BackingTokens", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.asset().transfer(owner, user, 1000);

    await pool.asset().approve(user, pool.tempus.controller.address, 100);
    (await pool.expectDepositBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/0, "0 YBT because we did BT deposit");

    expect(await pool.backingTokenBalance(user)).to.equal(900);

    (await pool.expectRedeemBT(user, 100, 100)).to.equal('success');
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/0, "burn TPS+TYS, 0 YBT because we did BT redeem");

    expect(await pool.backingTokenBalance(user)).to.equal(1000);
  });

  it("Should redeem more BackingTokens after changing rate to 2.0", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.asset().transfer(owner, user, 1000);
    await pool.asset().approve(user, pool.tempus.controller.address, 100);
    (await pool.expectDepositBT(user, 100)).to.equal('success');

    await pool.setInterestRate(2.0);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/0, "0 YBT because we did BT deposit");

    // since we change interest rate to 2.0x, tempus pool actually doesn't have enough BackingTokens to redeem
    // so here we just add large amount of funds from owner into the pool
    await pool.asset().approve(owner, pool.tempus.controller.address, 200);
    (await pool.depositBT(owner, 200));

    (await pool.expectRedeemBT(user, 100, 100)).to.equal('success');
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/0, "burn TPS+TYS, 0 YBT because we did BT redeem");

    expect(await pool.backingTokenBalance(user)).to.equal(1100, "gain extra 100 backing tokens due to interest 2.0x");
  });
});

describeForEachPool("TempusPool Redeem", (pool: ITestPool) =>
{
  it("Should revert when trying to call redeem BT directly on TempusPool (not via the TempusController)", async () => 
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500]]);
    
    (await expectRevert(pool.tempus.redeemToBacking(user, 1, 1))).to.equal("Only callable by TempusController");
  });
});

describeForEachPool.type("TempusPool Redeem", [PoolType.Lido], (pool:ITestPool) =>
{
  it("Should revert on redeem", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.asset().transfer(owner, user, 1000);
    await pool.asset().approve(user, pool.tempus.controller.address, 100);
    (await pool.expectDepositBT(user, 100)).to.equal('success');

    (await pool.expectRedeemBT(user, 100, 100)).to.equal('LidoTempusPool.withdrawFromUnderlyingProtocol not supported');
  });
});
