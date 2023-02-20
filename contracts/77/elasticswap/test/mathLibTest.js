const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

const WAD = ethers.BigNumber.from(10).pow(18);

describe("MathLib", () => {
  let mathLib;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    await deployments.fixture();
    const MathLib = await deployments.get("MathLib");
    mathLib = new ethers.Contract(MathLib.address, MathLib.abi, accounts[0]);
  });

  describe("wDiv", () => {
    it("Should return expected results", async () => {
      const a = 25;
      const b = 100;
      expect(await mathLib.wDiv(a, b)).to.equal(WAD.mul(a).div(b));

      const c = 100;
      const d = 25;
      expect(await mathLib.wDiv(c, d)).to.equal(WAD.mul(c).div(d));

      const e = 0;
      const f = 2;
      expect(await mathLib.wDiv(e, f)).to.equal(WAD.mul(e).div(f));
    });

    it("Should revert when dividing by zero", async () => {
      const a = 25;
      const b = 0;
      await expect(mathLib.wDiv(a, b)).to.be.reverted;
    });

    it("Should round to nearest integer", async () => {
      const a = 20;
      const b = 33333;
      // should round up, we add 1 to simulate
      expect(await mathLib.wDiv(a, b)).to.equal(
        ethers.BigNumber.from(10).pow(18).mul(a).div(b).add(1)
      );

      const c = 1;
      const d = ethers.BigNumber.from("333333333333333333");
      // 3.3333 rounds down to 3
      expect(await mathLib.wDiv(c, d)).to.equal(3);

      const e = 1;
      const f = ethers.BigNumber.from("600000000000000000");
      // 1.51 rounds up to 2.
      expect(await mathLib.wDiv(e, f)).to.equal(2);
    });
  });

  describe("wMul", () => {
    it("Should return expected results", async () => {
      const a = 25;
      const b = 100;
      const wadAB = WAD.mul(a).div(b);
      const c = 333;
      const d = 10;
      const wadCD = WAD.mul(c).div(d);
      expect(await mathLib.wMul(wadAB, wadCD)).to.equal(
        wadAB.mul(wadCD).div(WAD)
      );
    });

    it("Should return expected results when zero", async () => {
      const a = 25;
      const b = 100;
      const wadAB = WAD.mul(a).div(b);
      expect(await mathLib.wMul(wadAB, 0)).to.equal(wadAB.mul(0).div(WAD));
    });

    it("Should round to nearest integer", async () => {
      const a = 1;
      const b = 3;
      const wadAB = WAD.mul(a).div(b);
      const c = 9;
      const d = 10;
      const wadCD = WAD.mul(c).div(d);
      // we add 1 to simulate the roundup here that occurs.
      expect(await mathLib.wMul(wadAB, wadCD)).to.equal(
        wadAB.mul(wadCD).div(WAD).add(1)
      );
    });
  });

  describe("calculateQty", () => {
    it("Should return the correct calculateQty", async () => {
      expect(await mathLib.calculateQty(500, 100, 5000)).to.equal(25000);
      expect(await mathLib.calculateQty(100, 500, 5000)).to.equal(1000);
    });

    it("Should revert if any value is 0", async () => {
      await expect(mathLib.calculateQty(0, 100, 500)).to.be.reverted;
      await expect(mathLib.calculateQty(500, 0, 1000)).to.be.reverted;
      await expect(mathLib.calculateQty(500, 100, 0)).to.be.reverted;
    });
  });

  describe("calculateQtyToReturnAfterFees", () => {
    it("Should return the correct values", async () => {
      const tokenSwapQty = 50;
      const feeInBasisPoints = 30;
      const expectedFeeAmount = (tokenSwapQty * 30) / 10000;
      const tokenAReserveQtyBeforeTrade = 100;
      const tokenAReserveQtyAfterTrade =
        tokenAReserveQtyBeforeTrade + tokenSwapQty - expectedFeeAmount;
      const tokenBReserveQtyBeforeTrade = 5000;
      const pricingConstantK =
        tokenAReserveQtyBeforeTrade * tokenBReserveQtyBeforeTrade;

      const tokenBReserveQtyBeforeTradeAfterTrade =
        pricingConstantK / tokenAReserveQtyAfterTrade;
      const tokenBQtyExpected = Math.floor(
        tokenBReserveQtyBeforeTrade - tokenBReserveQtyBeforeTradeAfterTrade
      );

      expect(
        await mathLib.calculateQtyToReturnAfterFees(
          tokenSwapQty,
          tokenAReserveQtyBeforeTrade,
          tokenBReserveQtyBeforeTrade,
          feeInBasisPoints
        )
      ).to.equal(tokenBQtyExpected);
    });

    it("Should return the correct value when fees are zero", async () => {
      const tokenSwapQty = 15;
      const tokenAReserveQtyBeforeTrade = 2000;
      const tokenAReserveQtyAfterTrade =
        tokenAReserveQtyBeforeTrade + tokenSwapQty;
      const tokenBReserveQtyBeforeTrade = 3000;
      const pricingConstantK =
        tokenAReserveQtyBeforeTrade * tokenBReserveQtyBeforeTrade;

      const tokenBReserveQtyBeforeTradeAfterTrade =
        pricingConstantK / tokenAReserveQtyAfterTrade;
      const tokenBQtyExpected = Math.floor(
        tokenBReserveQtyBeforeTrade - tokenBReserveQtyBeforeTradeAfterTrade
      );

      expect(
        await mathLib.calculateQtyToReturnAfterFees(
          tokenSwapQty,
          tokenAReserveQtyBeforeTrade,
          tokenBReserveQtyBeforeTrade,
          0
        )
      ).to.equal(tokenBQtyExpected);
    });
  });
  describe("calculateLiquidityTokenQtyForDoubleAssetEntry", () => {
    it("Should return the correct qty of liquidity tokens", async () => {
      const totalSupplyOfLiquidityTokens = 50;
      const quoteTokenBalance = 50;
      const quoteTokenQtyToAdd = 15;

      expect(
        await mathLib.calculateLiquidityTokenQtyForDoubleAssetEntry(
          totalSupplyOfLiquidityTokens,
          quoteTokenQtyToAdd,
          quoteTokenBalance
        )
      ).to.equal(15);
    });
  });

  describe("calculateLiquidityTokenQtyForSingleAssetEntry", () => {
    it("Should return the correct qty of liquidity tokens with a rebase down", async () => {
      // Scenario: We have 1000:5000 A:B or X:Y, a rebase down occurs (of 50 tokens)
      // and a user needs to 50 tokens in order to remove the decay
      const totalSupplyOfLiquidityTokens = 5000;
      const tokenAQtyToAdd = 50;
      const tokenAInternalReserveQtyAfterTransaction = 1000; // 950 + 50 brining us back to original state.
      const tokenBDecayChange = 250;
      const tokenBDecay = 250;

      const gamma =
        (tokenAQtyToAdd / tokenAInternalReserveQtyAfterTransaction / 2) *
        (tokenBDecayChange / tokenBDecay);
      const expectLiquidityTokens = Math.floor(
        (totalSupplyOfLiquidityTokens * gamma) / (1 - gamma)
      );
      expect(
        await mathLib.calculateLiquidityTokenQtyForSingleAssetEntry(
          totalSupplyOfLiquidityTokens,
          tokenAQtyToAdd,
          tokenAInternalReserveQtyAfterTransaction,
          tokenBDecayChange,
          tokenBDecay
        )
      ).to.equal(expectLiquidityTokens);

      // if we supply half, and remove half the decay, we should get roughly 1/2 the tokens
      const tokenAQtyToAdd2 = 25;
      const tokenAInternalReserveQtyAfterTransaction2 = 975; // 950 + 25 brining us back to original state.
      const tokenBDecayChange2 = 125;
      const gamma2 =
        (tokenAQtyToAdd2 / tokenAInternalReserveQtyAfterTransaction2 / 2) *
        (tokenBDecayChange2 / tokenBDecay);
      const expectLiquidityTokens2 = Math.floor(
        (totalSupplyOfLiquidityTokens * gamma2) / (1 - gamma2)
      );

      expect(
        await mathLib.calculateLiquidityTokenQtyForSingleAssetEntry(
          totalSupplyOfLiquidityTokens,
          tokenAQtyToAdd2,
          tokenAInternalReserveQtyAfterTransaction2,
          tokenBDecayChange2,
          tokenBDecay
        )
      ).to.equal(expectLiquidityTokens2);
    });

    it("Should return the correct qty of liquidity tokens with a rebase up", async () => {
      // Scenario: We have 1000:5000 A:B or X:Y, a rebase up occurs (of 500 tokens)
      // and a user needs to add 2500 quote tokens to remove the base decay
      const totalSupplyOfLiquidityTokens = 5000;
      const tokenAQtyToAdd = 2500;
      const tokenAInternalReserveQtyAfterTransaction = 7500; // 5000 + 2500 to offset rebase up
      const tokenBDecayChange = 500;
      const tokenBDecay = 500;

      const gamma =
        (tokenAQtyToAdd / tokenAInternalReserveQtyAfterTransaction / 2) *
        (tokenBDecayChange / tokenBDecay);
      const expectLiquidityTokens = Math.floor(
        (totalSupplyOfLiquidityTokens * gamma) / (1 - gamma)
      );
      expect(
        await mathLib.calculateLiquidityTokenQtyForSingleAssetEntry(
          totalSupplyOfLiquidityTokens,
          tokenAQtyToAdd,
          tokenAInternalReserveQtyAfterTransaction,
          tokenBDecayChange,
          tokenBDecay
        )
      ).to.equal(expectLiquidityTokens);

      // if we supply half, and remove half the decay, we should get roughly 1/2 the tokens
      const tokenAQtyToAdd2 = 2500;
      const tokenAInternalReserveQtyAfterTransaction2 = 6250;
      const tokenBDecayChange2 = 250;
      const gamma2 =
        (tokenAQtyToAdd2 / tokenAInternalReserveQtyAfterTransaction2 / 2) *
        (tokenBDecayChange2 / tokenBDecay);
      const expectLiquidityTokens2 = Math.floor(
        (totalSupplyOfLiquidityTokens * gamma2) / (1 - gamma2)
      );

      expect(
        await mathLib.calculateLiquidityTokenQtyForSingleAssetEntry(
          totalSupplyOfLiquidityTokens,
          tokenAQtyToAdd2,
          tokenAInternalReserveQtyAfterTransaction2,
          tokenBDecayChange2,
          tokenBDecay
        )
      ).to.equal(expectLiquidityTokens2);
    });
  });

  describe("roundToNearest", () => {
    it("Should round up correctly", async () => {
      expect(await mathLib.roundToNearest(10000005, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000006, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000007, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000008, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000009, 10)).to.equal(10000010);
      expect(await mathLib.roundToNearest(10000010, 10)).to.equal(10000010);

      expect(await mathLib.roundToNearest(333335000, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333335001, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333335999, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333336999, 10000)).to.equal(
        333340000
      );
      expect(await mathLib.roundToNearest(333339999, 10000)).to.equal(
        333340000
      );
    });

    it("Should round down correctly", async () => {
      expect(await mathLib.roundToNearest(10000000, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000001, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000002, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000003, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000004, 10)).to.equal(10000000);
      expect(await mathLib.roundToNearest(10000499, 1000)).to.equal(10000000);

      expect(await mathLib.roundToNearest(333330000, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333330001, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333331999, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333332999, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333332999, 10000)).to.equal(
        333330000
      );
      expect(await mathLib.roundToNearest(333334999, 10000)).to.equal(
        333330000
      );
    });

    it("Should handle 0 correctly", async () => {
      expect(await mathLib.roundToNearest(0, 10)).to.equal(0);
    });
  });

  describe("diff", () => {
    it("Should handle a > b correctly", async () => {
      expect(await mathLib.diff(2000, 200)).to.equal(2000 - 200);
      expect(await mathLib.diff(5555, 333)).to.equal(5555 - 333);
    });

    it("Should handle a < b correctly", async () => {
      expect(await mathLib.diff(200, 2000)).to.equal(2000 - 200);
      expect(await mathLib.diff(333, 5555)).to.equal(5555 - 333);
    });

    it("Should handle a == b correctly", async () => {
      expect(await mathLib.diff(100, 100)).to.equal(0);
    });

    it("Should handle 0's correctly", async () => {
      expect(await mathLib.diff(0, 10)).to.equal(10);
      expect(await mathLib.diff(10, 0)).to.equal(10);
    });
  });
});
