const {
  BN,
  expectRevert,
  ether,
  expectEvent,
  balance,
  time,
} = require("@openzeppelin/test-helpers");

const { initialize, mintAndApprove, createSynthetic } = require("./helpers");

contract("LongShort (treasury)", (accounts) => {
  const syntheticName = "FTSE100";
  const syntheticSymbol = "FTSE";

  // Default test values
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const user3 = accounts[3];

  const f0 = new BN("0");
  const f1 = new BN("1000000000000000000");
  const f100 = f1.mul(new BN(100));

  let longShort;
  let treasury;
  beforeEach(async () => {
    const result = await initialize(admin);
    longShort = result.longShort;
    treasury = result.treasury;
  });

  let populateMarket = async (fees) => {
    // Create synthetic market.
    const synth = await createSynthetic(
      admin,
      longShort,
      "FTSE100",
      "FTSE100",
      treasury,
      fees,
      fees,
      fees,
      fees
    );

    // Mint some long tokens.
    await mintAndApprove(synth.fundToken, f100, user1, longShort.address);
    await longShort.mintLong(synth.currentMarketIndex, f100, {
      from: user1,
    });

    // Mint some short tokens.
    await mintAndApprove(synth.fundToken, f100, user2, longShort.address);
    await longShort.mintShort(synth.currentMarketIndex, f100, {
      from: user2,
    });

    return synth;
  };

  it.skip("sends accrued fees to treasury correctly", async () => {
    // Create a synthetic with lots of entry/exit fees for testing.
    const synth = await populateMarket(50);

    // Spoof the treasury address to avoid annoying test account errors.
    let spoofedTreasury = user3;
    await longShort.changeTreasury(spoofedTreasury, { from: admin });

    // Check the treasury has accrued fees and we can send them.
    let treasuryValue = await longShort.totalValueReservedForTreasury.call(
      synth.currentMarketIndex
    );
    assert(treasuryValue.gt(f0), "treasury should have accrued fees");

    // Send the treasury holdings to the treasury.
    await longShort.transferTreasuryFunds(synth.currentMarketIndex, {
      from: spoofedTreasury,
    });

    // There should be no remaining reserved treasury funds.
    let newTreasuryValue = await longShort.totalValueReservedForTreasury.call(
      synth.currentMarketIndex
    );
    assert.equal(
      newTreasuryValue.toString(),
      f0.toString(),
      "treasury was not sent accrued yield"
    );

    // The spoofed treasury should have received all the funds.
    let treasuryBalance = await synth.fundToken.balanceOf.call(spoofedTreasury);
    assert.equal(
      treasuryBalance.toString(),
      treasuryValue.toString(),
      "incorrect treasury amount was transferred"
    );
  });

  it.skip("sends accrued yield to treasury correctly", async () => {
    // Create a synthetic with no fees.
    const synth = await populateMarket(0);

    // Settle yield manager with lots of yield.
    await synth.yieldManager.settleWithYieldPercent(f100); // 100%

    // Redeem users's tokens to trigger treasury yield accumulation.
    await longShort.redeemLong(synth.currentMarketIndex, f100, {
      from: user1,
    });
    await longShort.redeemShort(synth.currentMarketIndex, f100, {
      from: user2,
    });

    // Spoof the treasury address to avoid annoying test account errors.
    let spoofedTreasury = user3;
    await longShort.changeTreasury(spoofedTreasury, { from: admin });

    // Check the treasury has accrued fees and we can send them.
    let treasuryValue = await longShort.totalValueReservedForTreasury.call(
      synth.currentMarketIndex
    );
    assert(treasuryValue.gt(f0), "treasury should have accrued yield");

    // Send the treasury holdings to the treasury.
    await longShort.transferTreasuryFunds(synth.currentMarketIndex, {
      from: spoofedTreasury,
    });

    // There should be no remaining reserved treasury funds.
    let newTreasuryValue = await longShort.totalValueReservedForTreasury.call(
      synth.currentMarketIndex
    );
    assert.equal(
      newTreasuryValue.toString(),
      f0.toString(),
      "treasury was not sent accrued yield"
    );

    // The spoofed treasury should have received all the funds.
    let treasuryBalance = await synth.fundToken.balanceOf.call(spoofedTreasury);
    assert.equal(
      treasuryBalance.toString(),
      treasuryValue.toString(),
      "incorrect treasury amount was transferred"
    );
  });
});
