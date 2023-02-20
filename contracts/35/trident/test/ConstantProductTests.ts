// @ts-nocheck

import { initialize, addLiquidity, swap, burnLiquidity } from "./harness/ConstantProduct";
import { getBigNumber, randBetween, ZERO } from "./harness/helpers";

describe("Constant Product Pool", function () {
  before(async function () {
    await initialize();
  });

  describe("Add liquidity", function () {
    it("Balanced liquidity to a balanced pool", async function () {
      const amount = getBigNumber(randBetween(10, 100));
      await addLiquidity(0, amount, amount);
    });
    it("Add liquidity in 16 different ways before swap fees", async function () {
      await addLiquidityInMultipleWays();
    });
    it("Add liquidity in 16 different ways after swap fees", async function () {
      await swap(2, getBigNumber(randBetween(100, 200)));
      await addLiquidityInMultipleWays();
    });
  });

  describe("Swaps", function () {
    const maxHops = 3;
    it(`Should do ${maxHops * 8} types of swaps`, async function () {
      for (let i = 1; i <= maxHops; i++) {
        // We need to generate all permutations of [bool, bool, bool]. This loop goes from 0 to 7 and then
        // we use the binary representation of `j` to get the actual values. 0 in binary = false, 1 = true.
        // 000 -> false, false, false.
        // 010 -> false, true, false.
        for (let j = 0; j < 8; j++) {
          const binaryJ = j.toString(2).padStart(3, "0");
          await swap(i, getBigNumber(randBetween(1, 100)), binaryJ[0] == 1, binaryJ[1] == 1, binaryJ[2] == 1);
        }
      }
    });
  });

  describe("Burn Liquidity", function () {
    it(`Remove liquidity in 12 different ways`, async function () {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          // when fee is pending
          await burnLiquidity(0, getBigNumber(randBetween(5, 10)), i, j == 0);
          // when no fee is pending
          await burnLiquidity(0, getBigNumber(randBetween(5, 10)), i, j == 0);
          // generate fee
          await swap(2, getBigNumber(randBetween(100, 200)));
        }
      }
    });
  });
});

async function addLiquidityInMultipleWays() {
  // The first loop selects the liquidity amounts to add - [0, x], [x, 0], [x, x], [x, y]
  for (let i = 0; i < 4; i++) {
    const amount0 = i == 0 ? ZERO : getBigNumber(randBetween(10, 100));
    const amount1 = i == 1 ? ZERO : i == 2 ? amount0 : getBigNumber(randBetween(10, 100));

    // We need to generate all permutations of [bool, bool]. This loop goes from 0 to 3 and then
    // we use the binary representation of `j` to get the actual values. 0 in binary = false, 1 = true.
    // 00 -> false, false
    // 01 -> false, true
    for (let j = 0; j < 4; j++) {
      const binaryJ = j.toString(2).padStart(2, "0");
      await addLiquidity(0, amount0, amount1, binaryJ[0] == 1, binaryJ[1] == 1);
    }
  }
}
