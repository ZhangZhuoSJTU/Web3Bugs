import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";
import { expectRevert } from "./utils/Utils";

describeForEachPool("TempusPool DepositBackingTokens", (pool:ITestPool) =>
{
  it("Should issue appropriate shares after depositing Backing Tokens", async () =>
  {
    const depositAmount = 100;
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500]]);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    
    await pool.asset().approve(user, pool.tempus.controller.address, depositAmount);
    (await pool.expectDepositBT(user, depositAmount)).to.equal('success');

    (await pool.userState(user)).expect(depositAmount, depositAmount, /*yieldBearing:*/500);
  });

  it("Should issue appropriate shares after depositing Backing Tokens after changing rate to 2.0", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.asset().approve(user, pool.tempus.controller.address, 200);
    (await pool.expectDepositBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/200);

    await pool.setInterestRate(2.0);

    const expectedYBTBalance = pool.yieldPeggedToAsset ? 400 : 200;
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/expectedYBTBalance);
    (await pool.expectDepositBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/expectedYBTBalance);

    expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
    expect(await pool.tempus.currentInterestRate()).to.equal(2.0);
  });

  it("Should revert when trying to deposit BT directly into the TempusPool (not via the TempusController)", async () => 
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500]]);
    
    (await expectRevert(pool.tempus.depositBacking(user, 1, user))).to.equal("Only callable by TempusController");
  });
});
