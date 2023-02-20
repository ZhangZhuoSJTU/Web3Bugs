const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");

const {
  initialize,
  mintAndApprove,
  createSynthetic,
  logGasPrices,
} = require("./helpers");

contract("LongShort (gas prices)", (accounts) => {
  ////////////////////////////////////
  //////// GAS ASSUMPTIONS ///////////
  ////////////////////////////////////
  const ethPriceUsd = 1723;
  const maticPriceUsd = 0.34;
  const ethGasPriceGwei = 80;
  const maticGasPriceGwei = 1;
  ////////////////////////////////////
  //////// ^^^^^^^^^^^^^^^ ///////////
  ////////////////////////////////////
  let longShort;
  let long;
  let short;
  let dai;
  let oracleManager;
  let marketIndex;
  let fund;
  let treasury;

  const syntheticName = "FTSE100";
  const syntheticSymbol = "FTSE";

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];

  const e18 = new BN("1000000000000000000");
  const tenPercentMovement = new BN("100000000000000000");
  const defaultMintAmount = "100000000000000000000"; // 100 dai etc.
  const oneUnitInWei = "1000000000000000000";

  beforeEach(async () => {
    const result = await initialize(admin);
    longShort = result.longShort;
    dai = result.dai;
    treasury = result.treasury;

    const synthResult = await createSynthetic(
      admin,
      longShort,
      syntheticName,
      syntheticSymbol, treasury,
      _baseEntryFee,
      _badLiquidityEntryFee,
      _baseExitFee,
      _badLiquidityExitFee
    );

    fund = synthResult.fundToken;
    long = synthResult.long;
    short = synthResult.short;
    marketIndex = synthResult.currentMarketIndex;
    oracleManager = synthResult.oracleManager;
  });

  it.skip("check cost of minting without oracle movement", async () => {
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);
    const receipt = await longShort.mintLong(
      marketIndex,
      new BN(defaultMintAmount),
      {
        from: user1,
      }
    );
    await logGasPrices(
      "mintLong",
      receipt,
      ethPriceUsd,
      maticPriceUsd,
      ethGasPriceGwei,
      maticGasPriceGwei
    );
  });

  it.skip("mint and stake", async () => {
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);
    const receipt = await longShort.mintLongAndStake(
      marketIndex,
      new BN(defaultMintAmount),
      {
        from: user1,
      }
    );
    await logGasPrices(
      "mintLongAndStake",
      receipt,
      ethPriceUsd,
      maticPriceUsd,
      ethGasPriceGwei,
      maticGasPriceGwei
    );
  });

  it.skip("check cost of minting with oracle movement", async () => {
    await mintAndApprove(fund, defaultMintAmount, user1, longShort.address);
    await longShort.mintLong(marketIndex, new BN(defaultMintAmount), {
      from: user1,
    });

    await mintAndApprove(fund, defaultMintAmount, user2, longShort.address);
    await longShort.mintShort(marketIndex, new BN(defaultMintAmount), {
      from: user2,
    });

    await mintAndApprove(fund, defaultMintAmount, user3, longShort.address);
    // change oracle price.
    const oraclePrice = await oracleManager.getLatestPrice.call();
    await oracleManager.setPrice(
      oraclePrice.add(oraclePrice.mul(tenPercentMovement).div(e18))
    );

    const receipt = await longShort.mintLong(
      marketIndex,
      new BN(defaultMintAmount),
      {
        from: user3,
      }
    );
    await logGasPrices(
      "mintLong",
      receipt,
      ethPriceUsd,
      maticPriceUsd,
      ethGasPriceGwei,
      maticGasPriceGwei
    );
  });
});
