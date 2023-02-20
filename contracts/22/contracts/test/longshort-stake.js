const { BN, time, expectRevert } = require("@openzeppelin/test-helpers");
const { inTransaction } = require("@openzeppelin/test-helpers/src/expectEvent");
const { assert, expect } = require("chai");

const { initialize, mintAndApprove, createSynthetic } = require("./helpers");

contract("LongShort (staking)", (accounts) => {
  const syntheticName = "FTSEoneHundred";
  const syntheticSymbol = "FTSE";

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];
  const initialMinter = accounts[4];

  const five = "5000000000000000000";
  const fifty = "50000000000000000000";
  const oneHundred = "1000000000000000000";
  const threeHundred = "3000000000000000000";
  const oneHundredAndFifty = "150000000000000000000";
  const twoHundred = "200000000000000000000";
  const twentyFive = "25000000000000000000";
  const e42 = new BN("1000000000000000000000000000000000000000000");

  let staker;
  let longShort;
  let longToken;
  let shortToken;
  let marketIndex;
  let fundToken;
  let floatToken;
  let treasury;

  beforeEach(async () => {
    const result = await initialize(admin);
    longShort = result.longShort;
    staker = result.staker;
    floatToken = result.floatToken;
    treasury = result.treasury;

    const synth = await createSynthetic(
      admin,
      longShort,
      syntheticName,
      syntheticSymbol,
      treasury,
      0, // no entry/exit fees
      0,
      0,
      0
    );

    longToken = synth.longToken;
    shortToken = synth.shortToken;
    marketIndex = synth.currentMarketIndex;
    fundToken = synth.fundToken;

    // Set some random market parameters for the staker.
    await staker.changeMarketLaunchIncentiveParameters(
      marketIndex,
      60 * 60 * 24 * 30,
      new BN(five),
      {
        from: admin,
      }
    );
  });

  it.skip("<IMPLEMENTED IN WAFFLE> users can stake long tokens", async () => {
    await mintThenStake(oneHundred, longToken, user1);
    await mintAndStake(oneHundred, longToken, user2);
    await mintThenStake(oneHundred, longToken, user3);

    const u1staked = await amountStaked(longToken, user1);
    const u2staked = await amountStaked(longToken, user2);
    const u3staked = await amountStaked(longToken, user3);

    assert.equal(new BN(oneHundred).toString(), u1staked.toString());
    assert.equal(new BN(oneHundred).toString(), u2staked.toString());
    assert.equal(new BN(oneHundred).toString(), u3staked.toString());
  });

  it.skip("<IMPLEMENTED IN WAFFLE> users can stake short tokens", async () => {
    await mintThenStake(oneHundred, shortToken, user1);
    await mintThenStake(oneHundred, shortToken, user2);
    await mintAndStake(oneHundred, shortToken, user3);

    const u1staked = await amountStaked(shortToken, user1);
    const u2staked = await amountStaked(shortToken, user2);
    const u3staked = await amountStaked(shortToken, user3);

    assert.equal(new BN(oneHundred).toString(), u1staked.toString());
    assert.equal(new BN(oneHundred).toString(), u2staked.toString());
    assert.equal(new BN(oneHundred).toString(), u3staked.toString());
  });

  it.skip("<WON'T RE-IMPLEMENT> users don't earn float immediately", async () => {
    await mintThenStake(oneHundred, longToken, user1);
    await staker.withdraw(longToken.address, new BN(oneHundred), {
      from: user1,
    });

    await mintAndStake(oneHundred, longToken, user2);
    await staker.withdraw(longToken.address, new BN(oneHundred), {
      from: user2,
    });

    await mintThenStake(oneHundred, longToken, user3);
    await staker.withdraw(longToken.address, new BN(oneHundred), {
      from: user3,
    });

    const u1Float = await floatToken.balanceOf(user1);
    const u2Float = await floatToken.balanceOf(user2);
    const u3Float = await floatToken.balanceOf(user3);

    const zero = new BN("0").toString();
    assert.equal(zero, u1Float.toString());
    assert.equal(zero, u2Float.toString());
    assert.equal(zero, u3Float.toString());
  });

  it.skip("case 1:  users can earn float with a delay from a long stake", async () => {
    await basicFloatAccumulationTest(mintThenStake, longToken, 2);
  });

  it.skip("case 2:  users can earn float immediately from a long mint", async () => {
    await basicFloatAccumulationTest(mintAndStake, longToken, 1);
  });

  it.skip("case 1: users can earn float immediately with a delay from from a short stake", async () => {
    await basicFloatAccumulationTest(mintThenStake, shortToken, 2);
  });

  it.skip("case 2:  users can earn float immediately from a short mint", async () => {
    await basicFloatAccumulationTest(mintAndStake, shortToken, 1);
  });

  it("staker admin can change", async () => {
    await expectRevert(staker.changeAdmin(user2, { from: user2 }), "not admin");
    await staker.changeAdmin(user2, {
      from: admin,
    });
    const a = await staker.admin.call();
    assert.equal(user2, a);
  });

  it("users who have no stake cannot withdraw", async () => {
    await expectRevert(
      staker.withdraw(longToken.address, new BN(oneHundred), {
        from: user1,
      }),
      "nothing to withdraw"
    );
  });

  it.skip("restaking credits you your float", async () => {
    // Ensure markets aren't empty.
    await populateMarket();

    // Mint 150 long tokens for user1.
    await mintAndApprove(
      fundToken,
      new BN(oneHundredAndFifty),
      user1,
      longShort.address
    );

    await longShort.mintLong(marketIndex, new BN(oneHundredAndFifty), {
      from: user1,
    });
    await longToken.stake(oneHundred, { from: user1 });

    // Get float parameters at current time for expected float calc.
    const before = await time.latest();
    const {
      longValue,
      shortValue,
      longPrice,
      shortPrice,
    } = await getFloatPerSecondParameters(longToken);

    // Wait a long time to accumulate some float.
    await time.increase(1000);

    // Compute expected float per second.
    let { longFloatPerSecond } = await calculateFloatPerSecond(
      longValue,
      shortValue,
      longPrice, shortPrice,
      marketIndex,
    );

    await longToken.stake(twentyFive, { from: user1 });
    const now = await time.latest();

    let result = await floatToken.balanceOf(user1);

    // Check that the credited float is what we expect.
    // NB NB NB This is failing, very slightly off.
    // Need to test the staking system wayy better
    assert.equal(
      result.toString(),
      longFloatPerSecond
        .mul(new BN(now - before))
        .mul(new BN(oneHundred))
        .div(e42)
        .toString(),
      "correct amount earned"
    );

    // Restaking again immediately shouldn't credit the user again.

    await longToken.stake(twentyFive, { from: user1 });

    let result2 = await floatToken.balanceOf(user1);

    // Check that the credited float is still the same.
    assert.equal(result.toString(), result2.toString(), "balance no equal");
  });

  it.skip("<No need to test again - implicitly tested> can stake directly from the synthetic token (without needing an approval)", async () => {
    await mintAndApprove(
      fundToken,
      new BN(oneHundredAndFifty),
      user1,
      longShort.address
    );
    await longShort.mintLong(marketIndex, oneHundred, {
      from: user1,
    });
    await longToken.stake(oneHundred, { from: user1 });

    const amountStaked = await staker.userAmountStaked.call(
      longToken.address,
      user1
    );
    assert.equal(amountStaked.toString(), oneHundred);
  });

  it.skip("cannot stake more than your balance from the synthetic token (without needing an approval)", async () => {
    await mintAndApprove(
      fundToken,
      new BN(oneHundredAndFifty),
      user1,
      longShort.address
    );
    await longShort.mintLong(marketIndex, oneHundred, {
      from: user1,
    });
    await expectRevert(
      longToken.stake(oneHundredAndFifty, { from: user1 }),
      "ERC20: transfer amount exceeds balance"
    );
  });

  it.skip("float earned is a function of time staked", async () => {
    // Ensure markets aren't empty.
    await populateMarket();

    // Mint 100 long tokens for user1.
    await mintAndApprove(
      fundToken,
      new BN(oneHundred),
      user1,
      longShort.address
    );
    await longShort.mintLong(marketIndex, new BN(oneHundred), {
      from: user1,
    });

    await longToken.stake(oneHundred, { from: user1 });

    // Wait a long time to accumulate some float.
    await time.increase(1000);
    await longShort.updateSystemState(marketIndex);

    // Withdraw stake and earn accumulated float tokens.
    await staker.withdraw(longToken.address, new BN(oneHundred), {
      from: user1,
    });
    const result1 = await floatToken.balanceOf(user1);

    await longToken.stake(oneHundred, { from: user1 });

    // Wait even longer to accumulate more float.
    await time.increase(2000);
    await longShort.updateSystemState(marketIndex);

    // Withdraw stake and earn accumulated float tokens.
    await staker.withdraw(longToken.address, new BN(oneHundred), {
      from: user1,
    });
    const result2 = await floatToken.balanceOf(user1);

    // Ensure the second time we staked, which was for twice as long,
    // resulted in more float tokens than the first time.
    assert(!result1.isZero(), "should have accumulated some float");
    assert(
      result2.sub(result1).gt(result1),
      "waiting longer should have more float"
    );
  });

  const basicFloatAccumulationTest = async (fn, token, iterations) => {
    // Ensure markets aren't empty.
    await populateMarket();

    // Run test staking function and record some state points in staker.
    await fn(oneHundred, token, user1);
    for (let i = 0; i < iterations - 1; i++) {
      await time.increase(1);
      await longShort.updateSystemState(marketIndex);
    }

    // Get float parameters at current time for expected float calculation.
    const before = await time.latest();
    const {
      longValue,
      shortValue,
      longPrice,
      shortPrice,
    } = await getFloatPerSecondParameters(token);

    // Wait a long time so user accumulates some float tokens.
    await time.increase(999);

    // Check how many float tokens the user has actually accumulated.
    await staker.withdraw(token.address, new BN(oneHundred), {
      from: user1,
    });
    const now = await time.latest();

    const isTestingLong = token.address === longToken.address;
    let { longFloatPerSecond,
      shortFloatPerSecond } = await calculateFloatPerSecond(
        longValue,
        shortValue,
        longPrice, shortPrice,
        marketIndex,
      );

    const expectedFloatPerSecond = isTestingLong ? longFloatPerSecond : shortFloatPerSecond;
    const result = await floatToken.balanceOf(user1);

    // Assert that the amount earned by the user matches the expected
    // float issance per second for a stake of 100.
    assert.equal(
      result.toString(),
      expectedFloatPerSecond
        .mul(new BN(now - before))
        .mul(new BN(oneHundred))
        .div(e42)
        .toString()
    );
  };

  // Pulls market parameters from the LongShort contract so we can verify
  // that 'r' value calculations are correct.
  const getFloatPerSecondParameters = async () => {
    let longValue = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    let shortValue = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
    let longPrice = await longShort.syntheticTokenPrice.call(0, marketIndex);
    let shortPrice = await longShort.syntheticTokenPrice.call(1, marketIndex);

    return {
      longValue,
      shortValue,
      longPrice,
      shortPrice,
    };
  };

  // Computes the expected float per second for the given parameters.
  const calculateFloatPerSecond = async (
    longValue,
    shortValue,
    longPrice, shortPrice,
    marketIndex,
  ) => {
    return await staker.calculateFloatPerSecond.call(
      longValue,
      shortValue,
      longPrice, shortPrice,
      marketIndex);
  };

  const amountStaked = async (token, user) =>
    await staker.userAmountStaked(token.address, user);

  const mintThenStake = async (amount, token, user) => {
    await mintAndApprove(fundToken, amount, user, longShort.address);
    conditionalMint(token, amount, user);
    await token.stake(amount, { from: user });
  };


  const mintAndStake = async (amount, token, user) => {
    await mintAndApprove(fundToken, new BN(amount), user, longShort.address);
    if (token.address === longToken.address) {
      await longShort.mintLongAndStake(marketIndex, new BN(amount), {
        from: user,
      });
    } else {
      await longShort.mintShortAndStake(marketIndex, new BN(amount), {
        from: user,
      });
    }
  };

  const conditionalMint = async (token, amount, user) => {
    if (token.address === longToken.address) {
      await longShort.mintLong(marketIndex, new BN(amount), {
        from: user,
      });
    } else {
      await longShort.mintShort(marketIndex, new BN(amount), {
        from: user,
      });
    }
  };

  const populateMarket = async () => {
    await mintAndApprove(
      fundToken,
      twoHundred,
      initialMinter,
      longShort.address
    );

    await longShort.mintLong(marketIndex, oneHundred, { from: initialMinter });

    await longShort.mintShort(marketIndex, oneHundred, { from: initialMinter });
  };
});
