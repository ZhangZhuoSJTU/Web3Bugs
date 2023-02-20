const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

const AggregatorV3 = artifacts.require("AggregatorV3Mock");

const Flippening = artifacts.require("OracleManagerFlippening_V0");

const bn = (a) => new BN(a);

const oneBN = bn(1);
const zeroBN = bn(0);
const twoBN = bn(2);

const tenToThe18 = bn("1000000000000000000");
const oneEth = tenToThe18;

const tenToThe8 = bn("100000000");
const oneBTC = tenToThe8;
const oneDollar = tenToThe8;

const with18Decimals = (int) => bn(int).mul(tenToThe18);
const with8Decimals = (int) => bn(int).mul(tenToThe8);

const asBTC = with8Decimals;
const asETH = with18Decimals;

const asDollars = with8Decimals;
contract("OracleManager (Flippening V0)", (accounts) => {
  // Test users.
  const admin = accounts[0];
  const user = accounts[1];

  let flippening;
  let btcOracle;
  let ethOracle;

  let setupChainlinkOracle = async (decimals, initialPrice) => {
    let oracle = await AggregatorV3.new({ from: admin });
    await oracle.setup(admin, initialPrice, decimals);
    return oracle;
  };

  // openzeppelin time increase unreliably off by a second
  // sometimes. hacky workaround.
  let increaseTime = async (increase) => {
    let t = await time.latest();
    await time.increase(increase - 1);
    let t2 = await time.latest();

    if (bn(t2).toString() != t.add(bn(increase)).toString()) {
      await time.increase(1);
    }

    let t3 = await time.latest();
    assert.equal(bn(t3).toString(), t.add(bn(increase)).toString());
  };

  let setup = async ({
    btcSupply,
    ethSupply,
    btcBlocksPerDay,
    ethBlocksPerDay,
    ethUnclesPerDay,
    btcBlockReward,
    ethBlockReward,
    ethUncleReward,
    ethNephewReward,
    btcPrice,
    ethPrice,
  }) => {
    let defaultOne = (x) => x ?? oneBN;
    btcOracle = await setupChainlinkOracle(8, defaultOne(btcPrice));
    ethOracle = await setupChainlinkOracle(18, defaultOne(ethPrice));

    flippening = await Flippening.new(
      admin,
      btcOracle.address,
      ethOracle.address,
      defaultOne(ethSupply),
      defaultOne(btcSupply),
      defaultOne(btcBlocksPerDay),
      defaultOne(ethBlocksPerDay),
      defaultOne(ethUnclesPerDay),
      defaultOne(btcBlockReward),
      defaultOne(ethBlockReward),
      defaultOne(ethUncleReward),
      defaultOne(ethNephewReward),
      { from: admin }
    );
  };

  let testPropertyStatic = async (expectedVal, propertyCall) => {
    let val = await propertyCall();
    assert.equal(val.toString(), expectedVal.toString());
  };

  describe.skip("dominance calc = (eth market cap) / (btc market cap)", () => {
    let testDominanceStatic =
      ({ btcSupply, ethSupply, btcPrice, ethPrice, expectedDominance }) =>
      async () => {
        await setup({ btcSupply, ethSupply, btcPrice, ethPrice });

        await testPropertyStatic(
          expectedDominance,
          flippening.getLatestPrice.call
        );
      };

    it(
      "identical prices and supplies lead to 100% eth dominance",
      testDominanceStatic({
        btcSupply: oneBTC,
        ethSupply: oneEth, // one ETH
        btcPrice: oneDollar, // $1
        ethPrice: oneDollar, // $1
        expectedDominance: with18Decimals(100),
      })
    );

    it(
      "btc price increases eth dominance decreases",
      testDominanceStatic({
        btcSupply: oneBTC,
        ethSupply: oneEth,
        btcPrice: asDollars(4),
        ethPrice: oneDollar,
        expectedDominance: with18Decimals(25),
      })
    );

    it(
      "eth price increases eth dominance increases",
      testDominanceStatic({
        btcSupply: oneBTC,
        ethSupply: oneEth,
        btcPrice: oneDollar,
        ethPrice: asDollars(4),
        expectedDominance: with18Decimals(400),
      })
    );

    it(
      "btc supply increases eth dominance decreases",
      testDominanceStatic({
        btcSupply: asBTC(4),
        ethSupply: oneEth,
        btcPrice: oneDollar,
        ethPrice: oneDollar,
        expectedDominance: with18Decimals(25),
      })
    );

    it(
      "eth supply increases eth dominance increases",
      testDominanceStatic({
        btcSupply: oneBTC,
        ethSupply: asETH(4),
        btcPrice: oneDollar,
        ethPrice: oneDollar,
        expectedDominance: with18Decimals(400),
      })
    );
  });

  describe.skip("btc supply gain", () => {
    let testBtcSupplyGain =
      ({
        btcBlocksPerDay,
        btcBlockReward,
        timeIncrease,
        expectedSupplyIncrease,
      }) =>
      async () => {
        await setup({ btcBlocksPerDay, btcBlockReward, btcSupply: oneBN });
        await increaseTime(timeIncrease - time.duration.seconds(1)); // next tx increments seconds by 1
        await flippening.updatePrice();
        await testPropertyStatic(
          expectedSupplyIncrease.add(oneBN),
          flippening.btcSupply
        );
      };

    describe("increases by blockReward * blocksPerDay per day", () => {
      let twelvePointFiveBTC = tenToThe8.mul(bn(25)).div(twoBN);

      let sixPointTwoFiveBTC = twelvePointFiveBTC.div(twoBN);
      it(
        "sanity check",
        testBtcSupplyGain({
          btcBlocksPerDay: oneBN,
          btcBlockReward: twelvePointFiveBTC,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: twelvePointFiveBTC,
        })
      );

      it(
        "block reward decreases, supply change decreases",
        testBtcSupplyGain({
          btcBlocksPerDay: oneBN,
          btcBlockReward: sixPointTwoFiveBTC,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: sixPointTwoFiveBTC,
        })
      );

      it(
        "blocks per day increase, supply change increases",
        testBtcSupplyGain({
          btcBlocksPerDay: twoBN,
          btcBlockReward: twelvePointFiveBTC,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: asBTC(25),
        })
      );
    });

    // flakey test see: https://github.com/Float-Capital/monorepo/issues/810
    describe.skip("increases linearly over time", async () => {
      it(
        "case less than a day",
        testBtcSupplyGain({
          btcBlocksPerDay: twoBN,
          btcBlockReward: asBTC(8),
          timeIncrease: time.duration.hours(12),
          expectedSupplyIncrease: asBTC(8),
        })
      );

      it(
        "case more than a day",
        testBtcSupplyGain({
          btcBlocksPerDay: twoBN,
          btcBlockReward: asBTC(8),
          timeIncrease: time.duration.hours(36),
          expectedSupplyIncrease: asBTC(24),
        })
      );
    });
  });

  describe.skip("eth supply gain", () => {
    let testEthSupplyGain =
      ({
        ethBlocksPerDay,
        ethBlockReward,
        ethNephewReward,
        ethUncleReward,
        ethUnclesPerDay,
        timeIncrease,
        expectedSupplyIncrease,
      }) =>
      async () => {
        await setup({
          ethBlocksPerDay,
          ethBlockReward,
          ethNephewReward,
          ethUncleReward,
          ethUnclesPerDay,
          ethSupply: zeroBN,
        });
        await increaseTime(timeIncrease - time.duration.seconds(1));
        await flippening.updatePrice(); // each tx increments seconds by 1
        await testPropertyStatic(expectedSupplyIncrease, flippening.ethSupply);
      };

    describe("increases by blockReward * blocksPerDay + (uncleReward + nephewReward) * unclesPerDay per day", () => {
      let defaultUncleReward = oneEth.mul(bn(3)).div(bn(4)); // 0.75 ETH
      let halfUncleReward = defaultUncleReward.div(twoBN);
      let defaultNephewReward = oneEth.div(bn(32));
      let halfNephewReward = defaultNephewReward.div(twoBN);
      let pointFiveEth = oneEth.div(twoBN);
      it(
        "sanity check",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: oneEth, // 1 ETH
          ethUncleReward: defaultUncleReward,
          ethNephewReward: defaultNephewReward,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: oneEth
            .add(defaultUncleReward)
            .add(defaultNephewReward),
        })
      );

      it(
        "block reward decreases, supply change decreases",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: pointFiveEth, // 0.5 ETH
          ethUncleReward: defaultUncleReward, // 0.75 ETH
          ethNephewReward: defaultNephewReward, // 1/32 ETH,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: pointFiveEth
            .add(defaultUncleReward)
            .add(defaultNephewReward),
        })
      );

      it(
        "blocks per day increase, supply change increases",
        testEthSupplyGain({
          ethBlocksPerDay: twoBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: pointFiveEth,
          ethUncleReward: defaultUncleReward, // 0.75 ETH
          ethNephewReward: defaultNephewReward, // 1/32 ETH,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: oneEth
            .add(defaultUncleReward)
            .add(defaultNephewReward),
        })
      );

      it(
        "uncles per day increases, supply change increases",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: twoBN,
          ethBlockReward: oneEth,
          ethUncleReward: defaultUncleReward, // 0.75 ETH
          ethNephewReward: defaultNephewReward, // 1/32 ETH,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: oneEth.add(
            twoBN.mul(defaultUncleReward.add(defaultNephewReward))
          ),
        })
      );

      it(
        "nephew reward decreases, supply change decreases",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: oneEth,
          ethUncleReward: defaultUncleReward,
          ethNephewReward: halfNephewReward, // 1/64 ETH,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: oneEth
            .add(defaultUncleReward)
            .add(halfNephewReward),
        })
      );

      it(
        "nephew reward decreases, supply change decreases",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: oneEth,
          ethUncleReward: halfUncleReward, // 0.75 ETH
          ethNephewReward: defaultNephewReward, // 1/32 ETH,
          timeIncrease: time.duration.days(1),
          expectedSupplyIncrease: oneEth
            .add(halfUncleReward)
            .add(defaultNephewReward),
        })
      );
    });

    // flakey test see: https://github.com/Float-Capital/monorepo/issues/810
    describe.skip("increases linearly over time", () => {
      it(
        "case less than a day",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: asETH(2),
          ethUncleReward: oneEth,
          ethNephewReward: oneEth,
          timeIncrease: time.duration.hours(12),
          expectedSupplyIncrease: asETH(2), // (2 + (1 + 1))./2
        })
      );

      it(
        "case more than a day",
        testEthSupplyGain({
          ethBlocksPerDay: oneBN,
          ethUnclesPerDay: oneBN,
          ethBlockReward: asETH(2),
          ethUncleReward: oneEth,
          ethNephewReward: oneEth,
          timeIncrease: time.duration.hours(36),
          expectedSupplyIncrease: asETH(6), // (2 + (1 + 1)) * 3 / 2
        })
      );
    });
  });

  describe.skip("integration", () => {
    it("handles price changes and estimated supply increases over time", async () => {
      await setup({
        btcSupply: oneBTC,
        ethSupply: oneEth,
        btcBlocksPerDay: bn(5),
        ethBlocksPerDay: oneBN,
        ethUnclesPerDay: oneBN,
        btcBlockReward: oneBTC,
        ethBlockReward: oneEth,
        ethUncleReward: oneEth.div(twoBN),
        ethNephewReward: oneEth.div(twoBN),
        ethPrice: oneDollar,
        btcPrice: oneDollar,
      });

      await testPropertyStatic(
        with18Decimals(100),
        flippening.getLatestPrice.call
      );

      await increaseTime(time.duration.days(1) - time.duration.seconds(3)); // last seconds in next 3 txs

      await ethOracle.setPrice(asDollars(2));
      await btcOracle.setPrice(asDollars(1));
      await flippening.updatePrice();

      await testPropertyStatic(asETH(3), flippening.ethSupply);
      await testPropertyStatic(asBTC(6), flippening.btcSupply);

      await testPropertyStatic(
        with18Decimals(100),
        flippening.getLatestPrice.call
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
        adminCall: flippening.changeAdmin,
        propertyCall: flippening.admin,
        newValue: user,
      });
    });

    it("change ethSupply", async () => {
      await adminTest({
        adminCall: flippening.changeEthSupply,
        propertyCall: flippening.ethSupply,
        newValue: asETH(500),
      });
    });

    it("change btcSupply", async () => {
      await adminTest({
        adminCall: flippening.changeBtcSupply,
        propertyCall: flippening.btcSupply,
        newValue: asBTC(300),
      });
    });

    it("change btcBlocksPerDay", async () => {
      await adminTest({
        adminCall: flippening.changeBtcBlocksPerDay,
        propertyCall: flippening.btcBlocksPerDay,
        newValue: bn(20),
      });
    });

    it("change ethBlocksPerDay", async () => {
      await adminTest({
        adminCall: flippening.changeEthBlocksPerDay,
        propertyCall: flippening.ethBlocksPerDay,
        newValue: bn(40),
      });
    });

    it("change ethUnclesPerDay", async () => {
      await adminTest({
        adminCall: flippening.changeEthUnclesPerDay,
        propertyCall: flippening.ethUnclesPerDay,
        newValue: bn(30),
      });
    });

    it("change btcBlockReward", async () => {
      await adminTest({
        adminCall: flippening.changeBtcBlockReward,
        propertyCall: flippening.btcBlockReward,
        newValue: asBTC(5),
      });
    });

    it("change ethBlockReward", async () => {
      await adminTest({
        adminCall: flippening.changeEthBlockReward,
        propertyCall: flippening.ethBlockReward,
        newValue: asETH(4),
      });
    });

    it("change ethUncleReward", async () => {
      await adminTest({
        adminCall: flippening.changeEthUncleReward,
        propertyCall: flippening.ethUncleReward,
        newValue: asETH(2),
      });
    });

    it("change ethNephewReward", async () => {
      await adminTest({
        adminCall: flippening.changeEthNephewReward,
        propertyCall: flippening.ethNephewReward,
        newValue: asETH(3),
      });
    });
  });
});
