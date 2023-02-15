const { BN } = require("@openzeppelin/test-helpers");
const { initialize, mintAndApprove, createSynthetic, totalValueLockedInMarket } = require("./helpers");

const erc20 = artifacts.require("SyntheticToken");

contract("LongShort (yield mechanism)", (accounts) => {
  let longShort;
  let treasury;

  const syntheticName = "FTSE100";
  const syntheticSymbol = "FTSE";

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];

  // Bignum utility constants.
  const fifty = new BN("50000000000000000000");
  const oneHundred = new BN("100000000000000000000");
  const oneHundredAndFifty = new BN("150000000000000000000");
  const twoHundred = new BN("200000000000000000000");
  const threeHundred = new BN("300000000000000000000");
  const fourHundred = new BN("400000000000000000000");

  beforeEach(async () => {
    var result = await initialize(admin);
    longShort = result.longShort;
    treasury = result.treasury;
  });

  // Generic test runner that checks whether the expected base and extra fee
  // amounts are correct for difference combinations of mints/redeems.
  function testMintFees(args) {
    return async () => {
      let {
        initialMintLong,
        initialMintShort,
        yieldFn,
        expectedShortValue,
        expectedLongValue,
        expectedTreasuryValue,
      } = args;

      // Create synthetic market.
      const synthResult = await createSynthetic(
        admin,
        longShort,
        syntheticName,
        syntheticSymbol,
        treasury,
        0, // no mint/redeem fees for testing yield
        0,
        0,
        0
      );

      // Variables for synthetic token queries.
      let fund = synthResult.fundToken;
      let long = synthResult.longToken;
      let short = synthResult.shortToken;
      let marketIndex = synthResult.currentMarketIndex;
      let yieldManager = synthResult.yieldManager;
      const yieldScale = await yieldManager.yieldScale.call();
      const yieldTokenAddress = await yieldManager.getHeldToken.call();
      const yieldToken = await erc20.at(yieldTokenAddress);

      const totalValueBefore = await totalValueLockedInMarket(longShort, marketIndex);
      const longValueBefore = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
      const shortValueBefore = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

      // Mint the initial long tokens.
      if (initialMintLong != 0) {
        await mintAndApprove(fund, initialMintLong, user1, longShort.address);
        await longShort.mintLong(marketIndex, new BN(initialMintLong), {
          from: user1,
        });
      }

      // Mint the initial short tokens.
      if (initialMintShort != 0) {
        await mintAndApprove(fund, initialMintShort, user2, longShort.address);
        await longShort.mintShort(marketIndex, new BN(initialMintShort), {
          from: user2,
        });
      }

      // Ensure locked market value matches the amounts minted.
      const initialLongValue = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
      const initialShortValue = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
      assert.equal(
        longValueBefore.add(new BN(initialMintLong)).toString(),
        initialLongValue.toString(),
        "wrong long value locked in market after initial mint"
      );
      assert.equal(
        shortValueBefore.add(new BN(initialMintShort)).toString(),
        initialShortValue.toString(),
        "wrong short value locked in market after initial mint"
      );

      // Ensure value has been locked into the yield manager correctly.
      const initialMarketValue = await totalValueLockedInMarket(longShort, marketIndex);
      const initialYieldValue = await longShort.totalValueLockedInYieldManager.call(
        marketIndex
      );
      assert.equal(
        initialMarketValue.toString(),
        initialYieldValue.toString(),
        "wrong value locked into yield manager after initial mints"
      );

      // Ensure yield manager actually holds/bookkeeps the locked tokens.
      const initialYieldHeld = await yieldManager.getTotalHeld.call();
      const initialTokenHeld = await yieldToken.balanceOf(yieldManager.address);
      assert.equal(
        initialYieldValue.toString(),
        initialYieldHeld.toString(),
        "wrong value of tokens held in yield manager after initial mints"
      );
      assert.equal(
        initialYieldHeld.toString(),
        initialTokenHeld.toString(),
        "wrong number of tokens held in yield manager after initial mints"
      );

      // Accrue deterministic yield and update longshort system state.
      const yieldAmount = yieldFn(yieldScale);
      await yieldManager.settleWithYieldPercent(yieldAmount, {
        from: admin,
      });
      await longShort.updateSystemState(marketIndex);

      // Get changes in long/short value and check they match expectations.
      const longValue = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
      const shortValue = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
      const treasuryValue = await longShort.totalValueReservedForTreasury.call(
        marketIndex
      );
      assert.equal(
        longValue.toString(),
        longValueBefore.add(expectedLongValue).toString(),
        "long value didn't match expectation after settlement"
      );
      assert.equal(
        shortValue.toString(),
        shortValueBefore.add(expectedShortValue).toString(),
        "short value didn't match expectation after settlement"
      );
      assert.equal(
        treasuryValue.toString(),
        expectedTreasuryValue.toString(),
        "treasury value didn't match expectation after settlement"
      );
    };
  }

  it.skip(
    "handles balanced market with zero APY",
    testMintFees({
      initialMintLong: oneHundred,
      initialMintShort: oneHundred,
      yieldFn: (yieldScale) => new BN(0),
      expectedLongValue: oneHundred,
      expectedShortValue: oneHundred,
      expectedTreasuryValue: new BN(0),
    })
  );

  it.skip(
    "handles imbalanced market with zero APY",
    testMintFees({
      initialMintLong: oneHundred,
      initialMintShort: twoHundred,
      yieldFn: (yieldScale) => new BN(0),
      expectedLongValue: oneHundred,
      expectedShortValue: twoHundred,
      expectedTreasuryValue: new BN(0),
    })
  );

  it.skip(
    "handles imbalanced market with zero APY (flipped)",
    testMintFees({
      initialMintLong: twoHundred,
      initialMintShort: oneHundred,
      yieldFn: (yieldScale) => new BN(0),
      expectedLongValue: twoHundred,
      expectedShortValue: oneHundred,
      expectedTreasuryValue: new BN(0),
    })
  );

  // TODO: re-add these tests to include initializer amounts or re-implement in reason.
  it.skip(
    "handles balanced market with non-zero APY",
    testMintFees({
      initialMintLong: oneHundred,
      initialMintShort: oneHundred,
      yieldFn: (yieldScale) => yieldScale, // 100%
      expectedLongValue: oneHundred,
      expectedShortValue: oneHundred,
      expectedTreasuryValue: twoHundred, // balanced - all yield goes to dao
    })
  );

  it.skip(
    "handles totally imbalanced market with non-zero APY",
    testMintFees({
      initialMintLong: oneHundred,
      initialMintShort: new BN(0),
      yieldFn: (yieldScale) => yieldScale, // 100%
      expectedLongValue: oneHundred,
      expectedShortValue: oneHundred, // all yield goes to weaker position
      expectedTreasuryValue: new BN(0), // no yield goes to dao
    })
  );

  it.skip(
    "handles totally imbalanced market with non-zero APY (flipped)",
    testMintFees({
      initialMintLong: new BN(0),
      initialMintShort: oneHundred,
      yieldFn: (yieldScale) => yieldScale, // 100%
      expectedLongValue: oneHundred, // all yield goes to weaker position
      expectedShortValue: oneHundred,
      expectedTreasuryValue: new BN(0), // no yield goes to dao
    })
  );

  it.skip(
    "handles partially imbalanced market with non-zero APY",
    testMintFees({
      initialMintLong: oneHundred,
      initialMintShort: threeHundred,
      yieldFn: (yieldScale) => yieldScale, // 100%
      expectedLongValue: twoHundred.add(fifty), // 37.5% goes to weaker side
      expectedShortValue: threeHundred.add(fifty), // 12.5% goes to stronger side
      expectedTreasuryValue: twoHundred, // 50% split to dao
    })
  );

  it.skip(
    "handles partially imbalanced market with non-zero APY (flipped)",
    testMintFees({
      initialMintLong: threeHundred,
      initialMintShort: oneHundred,
      yieldFn: (yieldScale) => yieldScale, // 100%
      expectedLongValue: threeHundred.add(fifty), // 12.5% goes to stronger side
      expectedShortValue: twoHundred.add(fifty), // 37.5% goes to weaker side
      expectedTreasuryValue: twoHundred, // 50% split to dao
    })
  );
});
