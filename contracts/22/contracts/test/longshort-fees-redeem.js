const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");

const { initialize, mintAndApprove, createSynthetic } = require("./helpers");

contract("LongShort (redeeming fees)", (accounts) => {
  let longShort;
  let priceOracle;
  let marketIndex;
  let long;
  let short;
  let fund;
  let treasury;

  const syntheticName = "FTSE100";
  const syntheticSymbol = "FTSE";

  // Fees
  const _baseEntryFee = 0;
  const _badLiquidityEntryFee = 0;
  const _baseExitFee = 50;
  const _badLiquidityExitFee = 50;

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];

  const fifty = "50000000000000000000";
  const oneHundred = "100000000000000000000";
  const oneHundredAndFifty = "150000000000000000000";
  const twoHundred = "200000000000000000000";

  beforeEach(async () => {
    const result = await initialize(admin);
    longShort = result.longShort;
    treasury = result.treasury;

    const synthResult = await createSynthetic(
      admin,
      longShort,
      syntheticName,
      syntheticSymbol,
      treasury,
      _baseEntryFee,
      _badLiquidityEntryFee,
      _baseExitFee,
      _badLiquidityExitFee
    );

    fund = synthResult.fundToken;
    long = synthResult.longToken;
    short = synthResult.shortToken;
    priceOracle = synthResult.oracle;
    marketIndex = synthResult.currentMarketIndex;

    // Variables for redeem fees.
    baseExitFee = await longShort.baseExitFee.call(marketIndex);
    badLiquidityExitFee = await longShort.badLiquidityExitFee.call(marketIndex);
    feeUnitsOfPrecision = await longShort.feeUnitsOfPrecision.call();

    getShortBeta = async () => await longShort.getShortBeta.call(marketIndex);
    getLongBeta = async () => await longShort.getLongBeta.call(marketIndex);
  });

  // Generic test runner that checks whether the expected base and extra fee
  // amounts are correct for difference combinations of mints/redeems.
  function testRedeemFees(args) {
    return async () => {
      let {
        mintLong,
        mintShort,
        redeemLong,
        redeemShort,
        expectedBaseFeeAmount,
        expectedExtraFeeAmount,
      } = args;

      assert.isTrue(
        redeemLong == 0 || redeemShort == 0,
        "Test should only redeem on one side of the market"
      );

      // Mint the long tokens.
      await mintAndApprove(fund, mintLong, user1, longShort.address);
      await longShort.mintLong(marketIndex, new BN(mintLong), {
        from: user1,
      });

      // Mint the short tokens.
      await mintAndApprove(fund, mintShort, user2, longShort.address);
      await longShort.mintShort(marketIndex, new BN(mintShort), {
        from: user2,
      });

      // Check that value has been locked in long side correctly.
      const longValueInContract = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
      const expectedLongValueInContract = new BN(mintLong);
      assert.equal(
        longValueInContract.toString(),
        expectedLongValueInContract.toString(),
        "Wrong value locked in long side of market."
      );

      // Check that value has been locked in short side correctly.
      const shortValueInContract = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
      const expectedShortValueInContract = new BN(mintShort);
      assert.equal(
        shortValueInContract.toString(),
        expectedShortValueInContract.toString(),
        "Wrong value locked in short side of market."
      );

      // Work out expected fees and market split.
      const baseFee = baseExitFee
        .mul(new BN(expectedBaseFeeAmount))
        .div(feeUnitsOfPrecision);
      const extraFee = badLiquidityExitFee
        .mul(new BN(expectedExtraFeeAmount))
        .div(feeUnitsOfPrecision);
      let splitAmounts = await longShort.getTreasurySplit.call(
        marketIndex,
        baseFee.add(extraFee)
      );
      let marketSplit = splitAmounts.marketAmount;

      // Redeem the tokens.
      if (redeemShort == 0) {
        await longShort.redeemLong(marketIndex, new BN(redeemLong), {
          from: user1,
        });
      } else {
        await longShort.redeemShort(marketIndex, new BN(redeemShort), {
          from: user2,
        });
      }

      // The fee is the redeem amount less the user's DAI balance change.
      let userBalance, userFee;
      if (redeemShort == 0) {
        userBalance = await fund.balanceOf(user1);
        userFee = new BN(redeemLong).sub(userBalance);
      } else {
        userBalance = await fund.balanceOf(user2);
        userFee = new BN(redeemShort).sub(userBalance);
      }

      // Check that fees match what was expected.
      assert.equal(
        userFee.toString(),
        baseFee.add(extraFee).toString(),
        "Fees were not calculated correctly."
      );

      // Fee mechanism should have released the fees back into the market.
      let expectedLockedValue;
      if (redeemShort == 0) {
        expectedLockedValue = new BN(mintShort)
          .add(new BN(mintLong))
          .sub(new BN(redeemLong))
          .add(marketSplit);
      } else {
        expectedLockedValue = new BN(mintLong)
          .add(new BN(mintShort))
          .sub(new BN(redeemShort))
          .add(marketSplit);
      }
      const actualLockedValue = await totalValueLockedInMarket(longShort, marketIndex);
      assert.equal(
        actualLockedValue.toString(),
        expectedLockedValue.toString(),
        "Fees were not released back into market correctly."
      );
    };
  }

  it.skip(
    "case 1: only base fees when balancing market",
    testRedeemFees({
      mintLong: oneHundred,
      mintShort: twoHundred,
      redeemLong: 0,
      redeemShort: oneHundred,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: 0,
    })
  );

  it.skip(
    "case 1: only base fees when balancing market (flipped)",
    testRedeemFees({
      mintLong: twoHundred,
      mintShort: oneHundred,
      redeemLong: oneHundred,
      redeemShort: 0,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: 0,
    })
  );

  it.skip(
    "case 2: penalty fees when completely imbalancing market",
    testRedeemFees({
      mintLong: oneHundred,
      mintShort: twoHundred,
      redeemLong: oneHundred,
      redeemShort: 0,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: oneHundred,
    })
  );

  it.skip(
    "case 2: penalty fees when completely imbalancing market (flipped)",
    testRedeemFees({
      mintLong: twoHundred,
      mintShort: oneHundred,
      redeemLong: 0,
      redeemShort: oneHundred,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: oneHundred,
    })
  );

  it.skip(
    "case 2: penalty fees when partially imbalancing market",
    testRedeemFees({
      mintLong: oneHundredAndFifty,
      mintShort: oneHundred,
      redeemLong: oneHundred,
      redeemShort: 0,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: fifty,
    })
  );

  it.skip(
    "case 2: penalty fees when partially imbalancing market (flipped)",
    testRedeemFees({
      mintLong: oneHundred,
      mintShort: oneHundredAndFifty,
      redeemLong: 0,
      redeemShort: oneHundred,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: fifty,
    })
  );

  it.skip(
    "case 2: edge-case where longValue == shortValue",
    testRedeemFees({
      mintLong: twoHundred,
      mintShort: twoHundred,
      redeemLong: oneHundred,
      redeemShort: 0,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: oneHundred,
    })
  );

  it.skip(
    "case 2: edge-case where longValue == shortValue (flipped)",
    testRedeemFees({
      mintLong: twoHundred,
      mintShort: twoHundred,
      redeemLong: 0,
      redeemShort: oneHundred,
      expectedBaseFeeAmount: oneHundred,
      expectedExtraFeeAmount: oneHundred,
    })
  );
});
