const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");

const { initialize, mintAndApprove, createSynthetic } = require("./helpers");

contract("LongShort (minting fees)", (accounts) => {
  const syntheticName = "FTSE100";
  const syntheticSymbol = "FTSE";

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];

  const fifty = "50000000000000000000";
  const oneHundred = "100000000000000000000";
  const oneHundredAndFifty = "150000000000000000000";
  const twoHundred = "200000000000000000000";
  const e18 = new BN("1000000000000000000");

  let longShort;
  let treasury;
  beforeEach(async () => {
    const result = await initialize(admin);
    longShort = result.longShort;
    treasury = result.treasury;
  });

  // Generic test runner that checks whether the expected base and extra fee
  // amounts are correct for difference combinations of mints/redeems.
  function testMintFees(args) {
    return async () => {
      let {
        baseFee,
        penaltyFee,
        initialMintLong,
        initialMintShort,
        mintLong,
        mintShort,
        expectedBaseFeeAmount,
        expectedPenaltyFeeAmount,
      } = args;

      assert.isTrue(
        mintLong == 0 || mintShort == 0,
        "Test should only mint on one side of the market"
      );

      // Create synthetic market.
      const synthResult = await createSynthetic(
        admin,
        longShort,
        syntheticName,
        syntheticSymbol,
        treasury,
        baseFee,
        penaltyFee,
        0, // redeem base fee
        0 // redeem penalty fee
      );

      // Variables for synthetic token queries.
      let fund = synthResult.fundToken;
      let long = synthResult.longToken;
      let short = synthResult.shortToken;
      let marketIndex = synthResult.currentMarketIndex;

      // Variables for mint fees.
      baseFee = await longShort.baseEntryFee.call(marketIndex);
      penaltyFee = await longShort.badLiquidityEntryFee.call(marketIndex);
      let feeUnitsOfPrecision = await longShort.feeUnitsOfPrecision.call();

      // Mint the initial long tokens.
      if (initialMintLong != 0) {
        await mintAndApprove(fund, initialMintLong, user3, longShort.address);
        await longShort.mintLong(marketIndex, new BN(initialMintLong), {
          from: user3,
        });
      }

      // Mint the initial short tokens.
      if (initialMintShort != 0) {
        await mintAndApprove(fund, initialMintShort, user3, longShort.address);
        await longShort.mintShort(marketIndex, new BN(initialMintShort), {
          from: user3,
        });
      }

      // Get locked value for initial mints (fees may have been taken):
      const initialLongValue = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
      const initialShortValue = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

      // Work out expected fee.
      const expectedBaseFee = baseFee
        .mul(new BN(expectedBaseFeeAmount))
        .div(feeUnitsOfPrecision);
      const expectedPenaltyFee = penaltyFee
        .mul(new BN(expectedPenaltyFeeAmount))
        .div(feeUnitsOfPrecision);
      const expectedTotalFee = expectedPenaltyFee.add(expectedBaseFee);

      // Mint the long tokens.
      if (mintLong != 0) {
        await mintAndApprove(fund, mintLong, user1, longShort.address);
        await longShort.mintLong(marketIndex, new BN(mintLong), {
          from: user1,
        });
      }

      // Mint the short tokens.
      if (mintShort != 0) {
        await mintAndApprove(fund, mintShort, user2, longShort.address);
        await longShort.mintShort(marketIndex, new BN(mintShort), {
          from: user2,
        });
      }

      // The fee is the mint amount less the user's token value.
      let totalFee;
      if (mintLong != 0) {
        let userBalance = await long.balanceOf(user1);
        let tokenPrice = await longShort.syntheticTokenPrice.call(0, marketIndex);
        totalFee = new BN(mintLong).sub(userBalance.mul(tokenPrice).div(e18));
      } else {
        let userBalance = await short.balanceOf(user2);
        let tokenPrice = await longShort.syntheticTokenPrice.call(1, marketIndex);
        totalFee = new BN(mintShort).sub(userBalance.mul(tokenPrice).div(e18));
      }

      // Check that the fees match what was expected, with small variance to
      // catch numerical errors due to dividing by e18.
      assert(
        totalFee.sub(expectedTotalFee).abs().lt(new BN(5)),
        "Fees were not calculated correctly."
      );
    };
  }

  it.skip(
    "case 1: penalty fees when completely imbalancing market",
    testMintFees({
      baseFee: 0,
      penaltyFee: 50,
      initialMintLong: oneHundred,
      initialMintShort: oneHundred,
      mintLong: oneHundred,
      mintShort: 0,
      expectedBaseFeeAmount: oneHundred,
      expectedPenaltyFeeAmount: oneHundred,
    })
  );

  it.skip(
    "case 2: penalty fees when completely imbalancing market (flipped)",
    testMintFees({
      baseFee: 0,
      penaltyFee: 50,
      initialMintLong: oneHundred,
      initialMintShort: oneHundred,
      mintLong: 0,
      mintShort: oneHundred,
      expectedBaseFeeAmount: oneHundred,
      expectedPenaltyFeeAmount: oneHundred,
    })
  );

  it.skip(
    "case 2: penalty fees when partially imbalancing market",
    testMintFees({
      baseFee: 0,
      penaltyFee: 50,
      initialMintLong: fifty,
      initialMintShort: oneHundred,
      mintLong: oneHundred,
      mintShort: 0,
      expectedBaseFeeAmount: oneHundred,
      expectedPenaltyFeeAmount: fifty,
    })
  );

  it.skip(
    "case 2: penalty fees when partially imbalancing market (flipped)",
    testMintFees({
      baseFee: 0,
      penaltyFee: 50,
      initialMintLong: oneHundred,
      initialMintShort: fifty,
      mintLong: 0,
      mintShort: oneHundred,
      expectedBaseFeeAmount: oneHundred,
      expectedPenaltyFeeAmount: fifty,
    })
  );
});
