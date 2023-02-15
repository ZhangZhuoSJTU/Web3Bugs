const { BN } = require("@openzeppelin/test-helpers");

const EthKiller = artifacts.require("OracleManagerEthKiller");
const BandOracle = artifacts.require("BandOracleMock");

contract("OracleManager (EthKiller)", (accounts) => {
  // Test users.
  const admin = accounts[0];
  const user = accounts[1];

  // Utility bignum.js constants.
  const one = new BN("1000000000000000000");
  const oneTenth = one.div(new BN(10));
  const two = one.mul(new BN(2));

  let ethKiller;
  let bandOracle;
  beforeEach(async () => {
    bandOracle = await BandOracle.new({
      from: admin,
    });

    // Set initial ethkiller prices to 1.
    await bandOracle.setup(admin, { from: admin });
    await bandOracle.setRate("TRX", "BUSD", one);
    await bandOracle.setRate("EOS", "BUSD", one);
    await bandOracle.setRate("XRP", "BUSD", one);

    ethKiller = await EthKiller.new(admin, bandOracle.address, {
      from: admin,
    });
  });

  let oracleTest = (params) => {
    return async () => {
      let { trxRate, eosRate, xrpRate, expectedPrice } = params;

      await ethKiller.updatePrice();
      let initialPrice = await ethKiller.getLatestPrice.call();
      assert.equal(
        initialPrice.toString(),
        one.toString(),
        "inital price should be one for ethkiller oracle"
      );

      // Set the band oracle to our given rates.
      await bandOracle.setRate("TRX", "BUSD", trxRate);
      await bandOracle.setRate("EOS", "BUSD", eosRate);
      await bandOracle.setRate("XRP", "BUSD", xrpRate);

      await ethKiller.updatePrice();
      let newPrice = await ethKiller.getLatestPrice.call();
      assert.equal(
        newPrice.toString(),
        expectedPrice.toString(),
        "final price of oracle was wrong"
      );
    };
  };

  it(
    "if prices don't change, neither should the oracle",
    oracleTest({
      trxRate: one,
      eosRate: one,
      xrpRate: one,
      expectedPrice: one,
    })
  );

  it(
    "if prices raise by same amount, oracle should too",
    oracleTest({
      trxRate: two,
      eosRate: two,
      xrpRate: two,
      expectedPrice: two,
    })
  );

  it(
    "if prices lower by same amount, oracle should too",
    oracleTest({
      trxRate: oneTenth,
      eosRate: oneTenth,
      xrpRate: oneTenth,
      expectedPrice: oneTenth,
    })
  );

  it(
    "price should raise by mean of underlying raises",
    oracleTest({
      trxRate: two, // 100% raise
      eosRate: two, // 100% raise
      xrpRate: one.add(oneTenth.mul(new BN(4))), // 40% raise
      expectedPrice: one.add(oneTenth.mul(new BN(8))), // 240/3 = 80% raise
    })
  );

  it(
    "should handle mix of raises and lowers",
    oracleTest({
      trxRate: oneTenth.mul(new BN(5)), // 50% lower
      eosRate: oneTenth.mul(new BN(5)), // 50% lower
      xrpRate: two, // 100% raise
      expectedPrice: one, // (100 - 50 - 50)/3 = 0% change
    })
  );
});
