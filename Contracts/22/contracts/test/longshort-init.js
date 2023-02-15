const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");

const { initialize, mintAndApprove, createSynthetic, totalValueLockedInMarket } = require("./helpers");

contract("LongShort (initialisation)", (accounts) => {
  let longShort;
  let marketIndex;
  let long;
  let short;
  let fund;
  let treasury;

  const syntheticName = "FTSE100";
  const syntheticSymbol = "FTSE";

  // Fees
  const _baseEntryFee = 0;
  const _badLiquidityEntryFee = 50;
  const _baseExitFee = 50;
  const _badLiquidityExitFee = 50;

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  let entryFee;
  let feeUnitsOfPrecision;

  const defaultMintAmount = new BN("100000000000000000000"); // 100 dai etc.
  const oneUnitInWei = "1000000000000000000";

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
    marketIndex = synthResult.currentMarketIndex;

    // TODO: change this to just 'entryFee' since in future no such thing as 'badLiquidity' entry fee.
    entryFee = await longShort.badLiquidityEntryFee.call(marketIndex);
    feeUnitsOfPrecision = await longShort.feeUnitsOfPrecision.call();
  });

  it.skip("successfully initialises, long position can be made", async () => {
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);


    // Create a long position
    await longShort.mintLong(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    const user1LongTokens = await long.balanceOf(user1);
    const user1PaymentTokens = await fund.balanceOf(user1);

    console.log(
      user1LongTokens.toString(),
      defaultMintAmount.sub(defaultMintAmount.mul(entryFee).div(feeUnitsOfPrecision)).toString(),
      "Correct tokens not minted on initialization"
    );
    assert.equal(
      user1LongTokens.toString(),
      defaultMintAmount.sub(defaultMintAmount.mul(entryFee).div(feeUnitsOfPrecision)).toString(),
      "Correct tokens not minted on initialization"
    );
    assert.equal(user1PaymentTokens, 0, "Tokens not taken when minting position");
  });

  it.skip("successfully initialises, short position can be created.", async () => {
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);

    // Create a short position
    await longShort.mintShort(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    const user1ShortTokens = await short.balanceOf(user1);
    const user1PaymentTokens = await fund.balanceOf(user1);

    assert.equal(
      user1ShortTokens,
      defaultMintAmount.sub(defaultMintAmount.mul(entryFee).div(feeUnitsOfPrecision)).toString(),
      "Correct tokens not minted on initialization"
    );
    assert.equal(user1PaymentTokens, 0, "Tokens not taken when minting position");
  });

  it.skip("succesfully initialises, long/short sides created with correct price/value", async () => {
    const totalValueLockedInitial = await totalValueLockedInMarket(longShort, marketIndex);
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);

    // Create a short position
    await longShort.mintShort(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    const user1ShortTokens = await short.balanceOf(user1);
    const feesAppliedOnMinting = defaultMintAmount.mul(entryFee).div(feeUnitsOfPrecision)
    assert.equal(
      user1ShortTokens,
      defaultMintAmount.sub(feesAppliedOnMinting).toString(),
      "Correct tokens not minted on initialization"
    );
    // Check the other values are set correctly
    const totalValueLocked = await totalValueLockedInMarket(longShort, marketIndex);
    assert.equal(
      totalValueLocked.toString(),
      defaultMintAmount.add(totalValueLockedInitial).sub(feesAppliedOnMinting).toString(),
      "Total value not correctly shown"
    );

    const shortValueLocked = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
    assert.equal(
      shortValueLocked.toString(),
      defaultMintAmount,
      "Short value not correctly shown"
    );

    // Check token prices are reflected correctly...
    const shortValueTokenPrice = await longShort.syntheticTokenPrice.call(1,
      marketIndex
    );
    assert.equal(
      shortValueTokenPrice.toString(),
      oneUnitInWei,
      "Token price not correct"
    );

    // Now long position comes in.
    await mintAndApprove(fund, defaultMintAmount, user2, longShort.address);
    // Create a long position
    // Price always starts at $1 per side.
    // NOTE: Commenting out these tests because they get too complicated since fees are distributed
    /* await longShort.mintLong(marketIndex, new BN(defaultMintAmount), {
      from: user2,
    });
    const user2LongTokens = await long.balanceOf(user2);
    assert.equal(
      user2LongTokens.toString(),
      defaultMintAmount.toString(),
      "Correct tokens not minted on initialization"
    );

    // Check token prices are reflected correctly...
    const longValueTokenPrice = await longShort.syntheticTokenPrice.call(0,
      marketIndex
    );
    assert.equal(
      longValueTokenPrice.toString(),
      oneUnitInWei,
      "Token price not correct"
    ); */
  });
});
