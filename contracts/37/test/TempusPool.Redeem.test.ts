import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";
import { expectRevert } from "./utils/Utils";

describeForEachPool("TempusPool Redeem", (pool:ITestPool) =>
{
  it("Should emit correct event on redemption", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);

    await pool.depositYBT(user, 100);
    await expect(pool.redeemToYBT(user, 100, 100)).to.emit(pool.tempus.controller.contract, 'Redeemed').withArgs(
      pool.tempus.address, // pool
      user.address, // redeemer
      user.address, // recipient
      pool.tempus.principalShare.toBigNum(100), // principal amount
      pool.tempus.yieldShare.toBigNum(100), // yield amount
      pool.tempus.yieldBearing.toBigNum(100), // yield bearing token amount
      pool.tempus.asset.toBigNum(100), // backing token amount
      pool.tempus.yieldShare.toBigNum(0), // fee
      pool.tempus.toContractExchangeRate(1.0), // rate
      true // early redeem
    );
  });

  it("Should revert on redeem with no balance", async () =>
  {
    await pool.createDefault();
    let [owner] = pool.signers;
    (await pool.expectRedeemBT(owner, 1, 1)).to.not.be.equal('success');
  });

  it("Should revert on random failure from backing pool", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);
    await pool.depositYBT(user, 100, /*recipient:*/user);

    await pool.forceFailNextDepositOrRedeem();
    (await pool.expectRedeemBT(user, 100, 100)).to.not.equal('success');
  });

  it("Should redeem exactly equal to deposit if no yield and no fees", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/0, "should receive 100 TPS+TYS");

    await pool.redeemToYBT(user, 100, 100);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/100, "redeem amount should be equal to original deposit");
  });

  it("Should fail with insufficient share balances", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/0);

    (await pool.expectRedeemYBT(user, 150, 100)).to.equal("Insufficient principals.");
    (await pool.expectRedeemYBT(user, 100, 150)).to.equal("Insufficient yields.");
    // We're checking principal first.
    (await pool.expectRedeemYBT(user, 150, 150)).to.equal("Insufficient principals.");
  });

  it("Should fail before maturity with unequal shares", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    (await pool.expectRedeemYBT(user, 50, 100)).to.equal("Inequal redemption not allowed before maturity.");
  });

  it("Should work before maturity with equal shares, without yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.redeemToYBT(user, 100, 100);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/200);
  });

  it("Should work before maturity with equal shares, with yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.setInterestRate(2.0);
    await pool.redeemToYBT(user, 100, 100);

    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/400);
    }
    else
    {
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/200);
    }
  });

  it("Should work after maturity with negative yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.setInterestRate(0.9);

    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/90);
        await pool.fastForwardToMaturity();
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/180);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        await pool.fastForwardToMaturity();
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/200);
    }
  });

  it("Should work after maturity with negative yield between maturity and redemption", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.setInterestRate(1.2);
    await pool.fastForwardToMaturity();
    await pool.setInterestRate(1.1);

    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/110);
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/220);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/200);
    }
  });

  it("Should work after maturity with unequal shares, without yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
    await pool.fastForwardToMaturity();
    await pool.redeemToYBT(user, 50, 100);
    (await pool.userState(user)).expect(50, 0, /*yieldBearing:*/150);
  });

  it("Should work after maturity with unequal shares, with yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.setInterestRate(2.0);
    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/200);
        await pool.fastForwardToMaturity();
        await pool.redeemToYBT(user, 50, 100);
        (await pool.userState(user)).expect(50, 0, /*yieldBearing:*/350);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        await pool.fastForwardToMaturity();
        await pool.redeemToYBT(user, 50, 100);
        (await pool.userState(user)).expect(50, 0, /*yieldBearing:*/175);
    }
  });

  it("Should work after maturity with additional yield after maturity", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.setInterestRate(2.0);
    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/200);
        await pool.fastForwardToMaturity();
        await pool.setInterestRate(4.0);
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/600);
        expect(await pool.yieldTokenBalance(pool.tempus.address)).to.equal(200);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        await pool.fastForwardToMaturity();
        await pool.setInterestRate(4.0);
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
    
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/150);
        expect(await pool.yieldTokenBalance(pool.tempus.address)).to.equal(50);
    }
  });

  it("Should redeem correct amount of tokens with multiple users depositing", async () =>
  {
    await pool.createDefault();
    let [owner, user, user2] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500], [user2, 500]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);

    await pool.setInterestRate(2.0);

    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/800);
        await pool.depositYBT(user, 100, /*recipient:*/user);
        (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/700);
    
        // Now the second user joins.
        await pool.depositYBT(user2, 200, /*recipient:*/user2);
        (await pool.userState(user2)).expect(100, 100, /*yieldBearing:*/800);
    
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.0);
    
        await pool.setInterestRate(2.5);
        await pool.fastForwardToMaturity();
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.5);
        expect(await pool.tempus.maturityInterestRate()).to.equal(2.5);
    
        // First user redeems
        (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/875);
        await pool.redeemToYBT(user, 150, 150);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/1250);
    
        // Second user redeems
        (await pool.userState(user2)).expect(100, 100, /*yieldBearing:*/1000);
        await pool.redeemToYBT(user2, 100, 100);
        (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/1250);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
        await pool.depositYBT(user, 100, /*recipient:*/user);
        (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
    
        // Now the second user joins.
        await pool.depositYBT(user2, 200, /*recipient:*/user2);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);
    
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.0);
    
        await pool.setInterestRate(2.5);
        await pool.fastForwardToMaturity();
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.5);
        expect(await pool.tempus.maturityInterestRate()).to.equal(2.5);
    
        // First user redeems
        (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
        await pool.redeemToYBT(user, 200, 200);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    
        // Second user redeems
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);
        await pool.redeemToYBT(user2, 200, 200);
        (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);
    }
  });
  it("Should revert when trying to call redeem directly on TempusPool (not via the TempusController)", async () => 
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500]]);
    
    (await expectRevert(pool.tempus.redeem(user, 1, 1))).to.equal("Only callable by TempusController");
  });

});
