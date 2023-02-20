const { BN } = require("@openzeppelin/test-helpers");
const { assertion } = require("@openzeppelin/test-helpers/src/expectRevert");

const ChainlinkOracle = artifacts.require("OracleManagerChainlink");
const AggregatorV3 = artifacts.require("AggregatorV3Mock");
const EthKillers = artifacts.require("OracleManagerEthKillerChainlink");

const twoBN = new BN(2);
const tenBN = new BN(10);

// Utility bignum.js constants.
const one = new BN("1000000000000000000");
const two = one.mul(twoBN);
const oneTenth = one.div(tenBN);

const tenToThe8 = new BN("100000000");
const twoTenToThe8 = tenToThe8.mul(twoBN);

const tenToThe20 = new BN("100000000000000000000");
const twoTenToThe20 = tenToThe20.mul(twoBN);

contract("OracleManager (ChainLink)", (accounts) => {
  // Test users.
  const admin = accounts[0];
  const user = accounts[1];

  let oracleTest = ({
    initialAggregatorPrice,
    initialOraclePrice,
    finalOraclePrice,
    aggregatorPriceToChangeTo,
  }) => {
    return async () => {
      let aggregator = await AggregatorV3.new({ from: admin });
      await aggregator.setup(admin, initialAggregatorPrice, 18);
      let oracle = await ChainlinkOracle.new(admin, aggregator.address);

      let initialPrice = await oracle.getLatestPrice.call();
      assert.equal(
        initialOraclePrice.toString(),
        initialPrice.toString(),
        "initial oracle price wrong"
      );

      // Set the chainlink oracle to our given rates.
      await aggregator.setPrice(aggregatorPriceToChangeTo);

      let newPrice = await oracle.updatePrice.call();
      assert.equal(
        newPrice.toString(),
        finalOraclePrice.toString(),
        "final price of oracle was wrong"
      );
    };
  };

  it(
    "if prices don't change, neither should the oracle",
    oracleTest({
      initialAggregatorPrice: one,
      initialOraclePrice: one,
      aggregatorPriceToChangeTo: one,
      finalOraclePrice: one,
    })
  );

  it(
    "if aggregate price increases, so does oracle price",
    oracleTest({
      initialAggregatorPrice: one,
      initialOraclePrice: one,
      aggregatorPriceToChangeTo: two,
      finalOraclePrice: two,
    })
  );

  it(
    "if aggregate price decreases, so does oracle price",
    oracleTest({
      initialAggregatorPrice: one,
      initialOraclePrice: one,
      aggregatorPriceToChangeTo: oneTenth,
      finalOraclePrice: oneTenth,
    })
  );
});

contract("OracleManager (EthKillerChainlink)", (accounts) => {
  // Test users.
  const admin = accounts[0];
  const user = accounts[1];

  let ethKillerTest = ({
    tronDecimals,
    xrpDecimals,
    eosDecimals,
    trxInitialRate,
    eosInitialRate,
    xrpInitialRate,
    trxRate,
    eosRate,
    xrpRate,
    expectedPrice,
  }) => {
    return async () => {
      // setup
      let tronOracle = await AggregatorV3.new({
        from: admin,
      });
      await tronOracle.setup(admin, trxInitialRate ?? one, tronDecimals ?? 18);

      let xrpOracle = await AggregatorV3.new({ from: admin });
      await xrpOracle.setup(admin, xrpInitialRate ?? one, xrpDecimals ?? 18);

      let eosOracle = await AggregatorV3.new({ from: admin });
      await eosOracle.setup(admin, eosInitialRate ?? one, eosDecimals ?? 18);

      let ethKiller = await EthKillers.new(
        admin,
        tronOracle.address,
        eosOracle.address,
        xrpOracle.address
      );

      // initial price
      await ethKiller.updatePrice();
      let initialPrice = await ethKiller.getLatestPrice.call();
      assert.equal(
        initialPrice.toString(),
        one.toString(),
        "initial oracle price wrong"
      );

      // set the rates
      await tronOracle.setPrice(trxRate);
      await eosOracle.setPrice(eosRate);
      await xrpOracle.setPrice(xrpRate);

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
    ethKillerTest({
      trxRate: one,
      eosRate: one,
      xrpRate: one,
      expectedPrice: one,
    })
  );

  it(
    "if prices raise by same amount, oracle should too",
    ethKillerTest({
      trxRate: two,
      eosRate: two,
      xrpRate: two,
      expectedPrice: two,
    })
  );

  it(
    "if prices lower by same amount, oracle should too",
    ethKillerTest({
      trxRate: oneTenth,
      eosRate: oneTenth,
      xrpRate: oneTenth,
      expectedPrice: oneTenth,
    })
  );

  it(
    "price should raise by mean of underlying raises",
    ethKillerTest({
      trxRate: two, // 100% raise
      eosRate: two, // 100% raise
      xrpRate: one.add(oneTenth.mul(new BN(4))), // 40% raise
      expectedPrice: one.add(oneTenth.mul(new BN(8))), // 240/3 = 80% raise
    })
  );

  it(
    "should handle mix of raises and lowers",
    ethKillerTest({
      trxRate: oneTenth.mul(new BN(5)), // 50% lower
      eosRate: oneTenth.mul(new BN(5)), // 50% lower
      xrpRate: two, // 100% raise
      expectedPrice: one, // (100 - 50 - 50)/3 = 0% change
    })
  );

  it(
    "underlying decimals don't affect index",
    ethKillerTest({
      tronDecimals: 8,
      trxInitialRate: tenToThe8,
      trxRate: twoTenToThe8, // 100% raise
      eosDecimals: 20,
      eosInitialRate: tenToThe20,
      eosRate: twoTenToThe20, // 100% raise
      xrpRate: one.add(oneTenth.mul(new BN(4))), // 40% raise, 18 decimals, initial price 10^18
      expectedPrice: one.add(oneTenth.mul(new BN(8))), // 240/3 = 80% raise
    })
  );
});
