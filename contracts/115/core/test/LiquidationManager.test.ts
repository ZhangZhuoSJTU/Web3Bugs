import { LiquidationManagerInstance, MockWETHInstance } from "../types/truffle-contracts";
import { constants, basicSetup } from "./utils/helpers";

contract("Liquidation Manager", (accounts) => {
  const [,] = accounts;

  let c: {
    liquidator: LiquidationManagerInstance;
    weth: MockWETHInstance;
  };

  beforeEach(async () => {
    c = await basicSetup({});
  });

  it("should calculate the correct health factor & isHealthy", async () => {
    const tests = [
      {
        value: 100,
        debt: 100,
        ratio: constants.MIN_LIQUIDATION_RATIO,
        health: "666666666666666667",
        isHealthy: false,
      },
      {
        value: 150,
        debt: 100,
        ratio: constants.MIN_LIQUIDATION_RATIO,
        health: "1000000000000000000",
        isHealthy: true,
      },
      {
        value: 150,
        debt: 200,
        ratio: constants.MIN_LIQUIDATION_RATIO,
        health: "500000000000000000",
        isHealthy: false,
      },
      {
        value: 150,
        debt: 1,
        ratio: constants.MIN_LIQUIDATION_RATIO,
        health: "100000000000000000000",
        isHealthy: true,
      },
      {
        value: 1,
        debt: 0, // 0 debt should give a health of 1
        ratio: constants.MIN_LIQUIDATION_RATIO,
        health: "1000000000000000000",
        isHealthy: true,
      },
      {
        value: 150,
        debt: 1,
        ratio: 0,
        health: "1000000000000000000",
        isHealthy: true,
      },
      {
        value: 160,
        debt: 1,
        ratio: constants.MIN_COLLATERAL_RATIO,
        health: "100000000000000000000",
        isHealthy: true,
      },
      {
        value: 160,
        debt: 100,
        ratio: constants.MIN_COLLATERAL_RATIO,
        health: "1000000000000000000",
        isHealthy: true,
      },
    ];

    for (const test of tests) {
      const health = await c.liquidator.calculateHealthFactor(test.value, test.debt, test.ratio);
      assert.equal(health.toString(), test.health);

      const isHealthy = await c.liquidator.isHealthy(test.value, test.debt, test.ratio);
      assert.equal(isHealthy, test.isHealthy);
    }
  });

  it("calculate a correct liquidation bonus", async () => {
    const amount = 100;
    const liquidationBonus = await c.liquidator.liquidationBonus(c.weth.address, amount);

    assert.equal(liquidationBonus.toString(), "5");
  });

  it("calculate a correct applyLiquidationDiscount", async () => {
    const amount = 105;
    const liquidationBonus = await c.liquidator.applyLiquidationDiscount(c.weth.address, amount);

    assert.equal(liquidationBonus.toString(), "100");
  });
});
