const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");

const { initialize, mintAndApprove, createSynthetic, totalValueLockedInMarket } = require("./helpers");

contract("LongShort (price movements)", (accounts) => {
  let longShort;
  let oracleManager;
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

  const defaultMintAmount = "100000000000000000000"; // 100 fund etc.
  const ninetyPercentDefaultMintAmount = "90000000000000000000";
  const hundredTenPercentDefaultMintAmount = "110000000000000000000";

  const e18 = new BN("1000000000000000000");
  const tenPercentMovement = new BN("100000000000000000");
  const hundredPercentMovement = new BN("1000000000000000000");

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];

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
    oracleManager = synthResult.oracleManager;
  });

  // also tests full exposure value change on price increase
  it.skip("changes value correctly in equal markets", async () => {
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);
    await longShort.mintLong(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    await mintAndApprove(fund, defaultMintAmount, user2, longShort.address);
    await longShort.mintShort(marketIndex, new BN(defaultMintAmount), {
      from: user2,
    });

    // 100 fund tokens
    const longVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex); // $100
    const shortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex); // $100
    assert.equal(longVal.toString(), shortVal.toString(), "Price movement");

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.add(oraclePrice.mul(tenPercentMovement).div(e18))
    );

    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex); // $90

    // 110 fund tokens
    assert.equal(
      newLongVal.toString(),
      longVal.mul(e18.add(tenPercentMovement)).div(e18).toString(),
      "Longvalue change not correct"
    );

    // 90 fund tokens
    assert.equal(
      newShortVal.toString(),
      shortVal.mul(e18.sub(tenPercentMovement)).div(e18).toString(),
      "Short value change correct"
    );
  });

  it.skip("changes value correctly in equal markets (flipped)", async () => {
    // 100 fund tokens in each of long and short
    await mintLongShort2(
      marketIndex,
      user1,
      user2,
      defaultMintAmount,
      defaultMintAmount,
      true
    );

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.sub(oraclePrice.mul(tenPercentMovement).div(e18))
    );

    const longValueBefore = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const shortValueBefore = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

    // 90 fund tokens
    assert.equal(
      newLongVal.toString(),
      longValueBefore.mul(e18.sub(tenPercentMovement)).div(e18).toString(),
      "Longvalue change not correct"
    );

    console.log("STENT 4");

    // 110 fund tokens
    assert.equal(
      newShortVal.toString(),
      shortValueBefore.mul(e18.add(tenPercentMovement)).div(e18).toString(),
      "Short value change correct"
    );
  });

  it.skip("changes value correctly in imbalanced markets", async () => {
    // 110 fund in short, 90 fund in long. mint short first to avoid fees / tipping
    await mintLongShort2(
      marketIndex,
      user1,
      user2,
      ninetyPercentDefaultMintAmount,
      hundredTenPercentDefaultMintAmount,
      false
    );

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.add(oraclePrice.mul(tenPercentMovement).div(e18))
    );


    const longValueBefore = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const shortValueBefore = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

    let valueShift = longValueBefore.mul(tenPercentMovement).div(e18);
    // 99 fund tokens
    assert.equal(
      newLongVal.toString(),
      longValueBefore.add(valueShift).toString(),
      "Longvalue change not correct"
    );

    // 101 fund tokens
    assert.equal(
      newShortVal.toString(),
      shortValueBefore.sub(valueShift).toString(),
      "Short value change correct"
    );
  });
  it.skip("changes value correctly in imbalanced markets (flipped)", async () => {
    // 110 fund in short, 90 fund in long. mint short first to avoid fees / tipping
    await mintLongShort2(
      marketIndex,
      user1,
      user2,
      ninetyPercentDefaultMintAmount,
      hundredTenPercentDefaultMintAmount,
      false
    );

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.sub(oraclePrice.mul(tenPercentMovement).div(e18))
    );

    const longValueBefore = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const shortValueBefore = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);
    let valueShift = longValueBefore.mul(tenPercentMovement).div(e18);

    // 81 fund
    assert.equal(
      newLongVal.toString(),
      longValueBefore.sub(valueShift).toString(),
      "Longvalue change not correct"
    );

    // 119 fund
    assert.equal(
      newShortVal.toString(),
      shortValueBefore.add(valueShift).toString(),
      "Short value change correct"
    );
  });

  // TODO: should put the market into an emergancy state where everyone can withdraw their funds. This should never happen.
  //       Contracts break past this point.
  it.skip("induces short liquidation on >100% price movements", async () => {
    // 100 fund in short, 100 fund in long
    await mintLongShort2(
      marketIndex,
      user1,
      user2,
      defaultMintAmount,
      defaultMintAmount,
      false
    );

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.add(oraclePrice.mul(hundredPercentMovement).div(e18))
    );
    const totalLockedInMarket = await totalValueLockedInMarket(longShort, marketIndex);

    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

    // 200 fund
    assert.equal(
      newLongVal.toString(),
      totalLockedInMarket.toString(),
      "Longvalue change not correct"
    );
  });

  it.skip("induces long liquidation on >100% price movements", async () => {
    // 100 fund in short, 100 fund in long
    await mintLongShort2(
      marketIndex,
      user1,
      user2,
      defaultMintAmount,
      defaultMintAmount,
      false
    );

    const totalLockedInMarket = await totalValueLockedInMarket(longShort, marketIndex);

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.sub(oraclePrice.mul(hundredPercentMovement).div(e18))
    );

    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

    // 0 fund
    assert.equal(newLongVal.toString(), "0", "Longvalue change not correct");
    // 200 fund
    assert.equal(
      newShortVal.toString(),
      totalLockedInMarket.toString(),
      "Short value change correct"
    );
  });

  it.skip("induces no value change on long-only market (impossible currently)", async () => {
    // 100 fund to long
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);
    await longShort.mintLong(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.add(oraclePrice.mul(tenPercentMovement).div(e18))
    );

    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

    // 100 fund
    assert.equal(
      newLongVal.toString(),
      defaultMintAmount,
      "Longvalue change not correct"
    );

    // 0 fund
    assert.equal(newShortVal.toString(), "0", "Short value change correct");

    oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.sub(oraclePrice.mul(tenPercentMovement).div(e18))
    );
    await longShort.updateSystemState(marketIndex);

    // 100 fund
    assert.equal(
      newLongVal.toString(),
      defaultMintAmount,
      "Longvalue change not correct"
    );

    // 0 fund
    assert.equal(newShortVal.toString(), "0", "Short value change correct");
  });

  it.skip("induces no value change on short-only market", async () => {
    // 100 fund to short
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);
    await longShort.mintShort(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    let oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.add(oraclePrice.mul(tenPercentMovement).div(e18))
    );

    await longShort.updateSystemState(marketIndex);
    const newLongVal = await longShort.syntheticTokenBackedValue.call(0, marketIndex);
    const newShortVal = await longShort.syntheticTokenBackedValue.call(1, marketIndex);

    // 0 fund
    assert.equal(newLongVal.toString(), "0", "Longvalue change not correct");

    // 100 fund
    assert.equal(
      newShortVal.toString(),
      defaultMintAmount,
      "Short value change correct"
    );

    oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.sub(oraclePrice.mul(hundredPercentMovement).div(e18))
    );
    await longShort.updateSystemState(marketIndex);

    // 100 fund
    assert.equal(newLongVal.toString(), 0, "Longvalue change not correct");

    // 0 fund
    assert.equal(
      newShortVal.toString(),
      defaultMintAmount,
      "Short value change correct"
    );
  });

  const mintLongShort2 = async (
    marketIndex,
    longUser,
    shortUser,
    longAmount,
    shortAmount,
    longFirst
  ) => {
    if (longFirst) {
      // user 1
      await mintAndApprove(fund, longAmount, longUser, longShort.address);
      await longShort.mintLong(marketIndex, new BN(longAmount), {
        from: longUser,
      });
      // user 2
      await mintAndApprove(fund, shortAmount, shortUser, longShort.address);
      await longShort.mintShort(marketIndex, new BN(shortAmount), {
        from: shortUser,
      });
    } else {
      // user 2
      await mintAndApprove(fund, shortAmount, shortUser, longShort.address);
      await longShort.mintShort(marketIndex, new BN(shortAmount), {
        from: shortUser,
      });
      // user 1
      await mintAndApprove(fund, longAmount, longUser, longShort.address);
      await longShort.mintLong(marketIndex, new BN(longAmount), {
        from: longUser,
      });
    }
  };
});
