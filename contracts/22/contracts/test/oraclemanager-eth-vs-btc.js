const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

const AggregatorV3 = artifacts.require("AggregatorV3Mock");

const EthToBtc = artifacts.require("OracleManagerEthVsBtc");

const bn = (a) => new BN(a);

const tenToThe18 = bn("1000000000000000000");
const oneEth = tenToThe18;

const tenToThe8 = bn("100000000");
const oneBTC = tenToThe8;
const oneDollar = tenToThe8;

const with18Decimals = (int) => bn(int).mul(tenToThe18);
const with8Decimals = (int) => bn(int).mul(tenToThe8);

const asDollars = with8Decimals;
contract("OracleManager (EthToBtc V0)", (accounts) => {
  // Test users.
  const admin = accounts[0];
  const user = accounts[1];

  let ethVsBtc;
  let btcOracle;
  let ethOracle;

  let setupChainlinkOracle = async (decimals, initialPrice) => {
    let oracle = await AggregatorV3.new({ from: admin });
    await oracle.setup(admin, initialPrice, decimals);
    return oracle;
  };

  let setup = async ({ btcPrice, ethPrice }) => {
    btcOracle = await setupChainlinkOracle(8, btcPrice);
    ethOracle = await setupChainlinkOracle(18, ethPrice);

    ethVsBtc = await EthToBtc.new(admin, btcOracle.address, ethOracle.address, {
      from: admin,
    });
  };

  let testPropertyStatic = async (expectedVal, propertyCall) => {
    let val = await propertyCall();
    assert.equal(val.toString(), expectedVal.toString());
  };

  describe("dominance calc = (eth price) / (btc price)", () => {
    let testDominanceStatic = ({
      btcPrice,
      ethPrice,
      expectedDominance,
    }) => async () => {
      await setup({ btcPrice, ethPrice });

      await testPropertyStatic(expectedDominance, ethVsBtc.getLatestPrice.call);
    };

    it(
      "identical prices and supplies lead to 100% eth dominance",
      testDominanceStatic({
        btcPrice: oneDollar, // $1
        ethPrice: oneDollar, // $1
        expectedDominance: with18Decimals(100),
      })
    );

    it(
      "btc price increases eth dominance decreases",
      testDominanceStatic({
        btcPrice: asDollars(4),
        ethPrice: oneDollar,
        expectedDominance: with18Decimals(25),
      })
    );

    it(
      "eth price increases eth dominance increases",
      testDominanceStatic({
        btcPrice: oneDollar,
        ethPrice: asDollars(4),
        expectedDominance: with18Decimals(400),
      })
    );
  });

  describe("integration", () => {
    it("handles price changes over time", async () => {
      await setup({
        ethPrice: oneDollar,
        btcPrice: oneDollar,
      });

      await testPropertyStatic(
        with18Decimals(100),
        ethVsBtc.getLatestPrice.call
      );

      await time.increase(time.duration.days(1));

      await ethOracle.setPrice(asDollars(2));
      await btcOracle.setPrice(asDollars(1));
      await ethVsBtc.updatePrice();

      await testPropertyStatic(
        with18Decimals(200),
        ethVsBtc.getLatestPrice.call
      );
    });
  });

  describe("admin funcs", () => {
    beforeEach(async () => {
      await setup({ btcPrice: oneBTC, ethPrice: oneEth });
    });

    let adminTest = async ({ adminCall, propertyCall, newValue }) => {
      // all other params have a value of 1
      await expectRevert.unspecified(adminCall(newValue, { from: user }));
      await adminCall(newValue, { from: admin });
      testPropertyStatic(newValue, propertyCall);
    };

    it("change admin", async () => {
      await adminTest({
        adminCall: ethVsBtc.changeAdmin,
        propertyCall: ethVsBtc.admin,
        newValue: user,
      });
    });
  });
});
