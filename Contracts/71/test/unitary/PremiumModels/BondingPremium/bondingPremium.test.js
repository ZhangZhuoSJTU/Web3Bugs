const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const {
  ZERO_ADDRESS,
  YEAR,
  ten_to_the_18,
  ten_to_the_6,
  ten_to_the_5,
  WEEK,
  DAY,
  ONE,
  TWO,
  ZERO,
} = require("../../constant-utils");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("test BondingPremium", () => {
  let BASE = 1000000;
  let BASE_big = BigNumber.from("1000000");
  let k = 200100000;
  let T_1 = 1000000;
  let c = 10000;
  let b = 1000;

  async function sqrt(value) {
    x = value;
    let z = x.add(ONE).div(TWO);
    let y = x;
    while (z.sub(y).isNegative()) {
      y = z;
      z = x.div(z).add(z).div(TWO);
    }
    return y;
  }

  const calcCurrentPremiumRate = async ({
    k,
    T_0,
    T_1,
    c,
    b,
    lockedAmount,
  }) => {
    let k_big = BigNumber.from(k.toString());
    let T_0_big = BigNumber.from(T_0.toString());
    let T_1_big = BigNumber.from(T_1.toString());

    let K = k_big.mul(T_0_big).div(T_1_big);

    let a = await sqrt(ten_to_the_6.mul(ten_to_the_6).add(K.mul("4")));
    a = (a.toNumber() - BASE) / 2;

    let _util = (lockedAmount / T_0) * BASE;

    let u0 = BASE - _util + a;

    let premiumRate =
      365 * ((k * T_0) / T_1 / u0 - a) + (c - b) * (1 - T_0 / T_1) + b;

    return BigNumber.from(Math.round(premiumRate).toString());
  };

  const calcPremiumRate = async ({
    k,
    T_0,
    T_1,
    c,
    b,
    lockedAmount,
    amount,
  }) => {
    let k_big = BigNumber.from(k.toString());
    let T_0_big = BigNumber.from(T_0.toString());
    let T_1_big = BigNumber.from(T_1.toString());

    let K = k_big.mul(T_0_big).div(T_1_big);

    let a = await sqrt(ten_to_the_6.mul(ten_to_the_6).add(K.mul("4")));
    a = (a.toNumber() - BASE) / 2;

    let u1 = BASE - (lockedAmount * BASE) / T_0;
    let u2 = BASE - ((lockedAmount + amount) * BASE) / T_0;

    let ln_u1 = Math.log(u1 + a);
    let ln_u2 = Math.log(u2 + a);

    let ln_res_u1 = ln_u1 * k;
    let ln_res_u2 = ln_u2 * k;

    let premium_u1 =
      ((365 * T_0) / T_1) * ln_res_u1 +
      u1 * ((1 - T_0 / T_1) * c + (T_0 / T_1) * b - 365 * a);
    let premium_u2 =
      ((365 * T_0) / T_1) * ln_res_u2 +
      u2 * ((1 - T_0 / T_1) * c + (T_0 / T_1) * b - 365 * a);

    let premiumRate = (premium_u1 - premium_u2) / (u1 - u2);

    return BigNumber.from(Math.round(premiumRate).toString());
  };

  before(async () => {
    [creator, alice] = await ethers.getSigners();

    const Ownership = await ethers.getContractFactory("Ownership");
    const BondignPremium = await ethers.getContractFactory("BondingPremium");
    ownership = await Ownership.deploy();
    premium = await BondignPremium.deploy(ownership.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      await expect(premium.address).to.exist;
    });
  });

  describe("test getCurrentPremiumRate", function () {
    it("getCurrentPremiumRate correctlly", async () => {
      let expectedRate = await calcCurrentPremiumRate({
        k: k,
        T_0: 800000,
        T_1: T_1,
        c: c,
        b: b,
        lockedAmount: 400000,
      });

      let actualRate = await premium.getCurrentPremiumRate(
        BASE_big.mul(800000),
        BASE_big.mul(400000)
      );
      expect(actualRate).to.closeTo(expectedRate, expectedRate.div(1000));
    });

    it("Graph change until goal TVL", async () => {
      //50% utilization rate
      let lockedAmount_1 = 400000;
      let totalLiquidity_1 = 800000;

      //50% utilization rate
      let lockedAmount_2 = 500000;
      let totalLiquidity_2 = 1000000;

      //not equal
      expect(
        await premium.getCurrentPremiumRate(
          BASE_big.mul(totalLiquidity_1),
          BASE_big.mul(lockedAmount_1)
        )
      ).to.not.equal(
        await premium.getCurrentPremiumRate(
          BASE_big.mul(totalLiquidity_2),
          BASE_big.mul(lockedAmount_2)
        )
      );
    });

    it("Graph doesn't change after goal TVL", async () => {
      //50% utilization rate
      let lockedAmount_1 = 500000;
      let totalLiquidity_1 = 1000000;

      //50% utilization rate
      let lockedAmount_2 = 600000;
      let totalLiquidity_2 = 1200000;

      //equal
      expect(
        await premium.getCurrentPremiumRate(
          BASE_big.mul(totalLiquidity_1),
          BASE_big.mul(lockedAmount_1)
        )
      ).to.equal(
        await premium.getCurrentPremiumRate(
          BASE_big.mul(totalLiquidity_2),
          BASE_big.mul(lockedAmount_2)
        )
      );
    });

    it("revert when lockedAmount exceed totalLiquidity", async () => {
      let lockedAmount_1 = 1000001;
      let totalLiquidity_1 = 1000000;

      await expect(
        premium.getCurrentPremiumRate(
          BASE_big.mul(totalLiquidity_1),
          BASE_big.mul(lockedAmount_1)
        )
      ).to.revertedWith("ERROR: _lockedAmount > _totalLiquidity");
    });
  });

  describe("test getPremiumRate", function () {
    it("get correctlly", async () => {
      let amount = 200000;
      let lockedAmount = 400000;
      let totalLiquidity = 800000;

      let premiumRate = await calcPremiumRate({
        k: k,
        T_0: totalLiquidity,
        T_1: T_1,
        c: c,
        b: b,
        lockedAmount: lockedAmount,
        amount: amount,
      });

      expect(
        await premium.getPremiumRate(
          BASE_big.mul(amount),
          BASE_big.mul(totalLiquidity),
          BASE_big.mul(lockedAmount)
        )
      ).to.closeTo(premiumRate, premiumRate.div(100));
    });

    it("revert when amount exceed available", async () => {
      let amount = 400001;
      let lockedAmount = 400000;
      let totalLiquidity = 800000;

      await expect(
        premium.getPremiumRate(
          BASE_big.mul(amount),
          BASE_big.mul(totalLiquidity),
          BASE_big.mul(lockedAmount)
        )
      ).to.revertedWith("exceed available balance");
    });

    it("return zero when totalLiquidity is zero", async () => {
      let amount = 0;
      let lockedAmount = 0;
      let totalLiquidity = 0;

      expect(
        await premium.getPremiumRate(
          BASE_big.mul(amount),
          BASE_big.mul(totalLiquidity),
          BASE_big.mul(lockedAmount)
        )
      ).to.equal(0);
    });

    it("return zero when amount is zero", async () => {
      let amount = 0;
      let lockedAmount = 0;
      let totalLiquidity = 1;

      expect(
        await premium.getPremiumRate(
          BASE_big.mul(amount),
          BASE_big.mul(totalLiquidity),
          BASE_big.mul(lockedAmount)
        )
      ).to.equal(0);
    });
  });

  describe("test getPremium", function () {
    it("getPremium correctlly", async () => {
      let amount = 200000;
      let lockedAmount = 400000;
      let totalLiquidity = 800000;
      let period = WEEK;

      let expectedPremiumRate = await calcPremiumRate({
        k: k,
        T_0: totalLiquidity,
        T_1: T_1,
        c: c,
        b: b,
        lockedAmount: lockedAmount,
        amount: amount,
      });

      let expectedPremium = expectedPremiumRate
        .mul(amount)
        .mul(BASE)
        .mul(WEEK)
        .div(YEAR)
        .div(BASE);

      let actualPremium = await premium.getPremium(
        BASE_big.mul(amount),
        period,
        BASE_big.mul(totalLiquidity),
        BASE_big.mul(lockedAmount)
      );

      expect(actualPremium).to.closeTo(
        expectedPremium,
        expectedPremium.div(1000)
      );
    });

    it("should return zero when amount is zero", async () => {
      let amount = 0;
      let lockedAmount = 400000;
      let totalLiquidity = 800000;
      let period = WEEK;

      let expectedPremium = ZERO;

      let actualPremium = await premium.getPremium(
        BASE_big.mul(amount),
        period,
        BASE_big.mul(totalLiquidity),
        BASE_big.mul(lockedAmount)
      );

      expect(actualPremium).to.equal(expectedPremium);
    });
  });

  describe("test setPremium", function () {
    it("setPremium correctlly", async () => {
      await premium.setPremiumParameters(10, 10, 10, 10);

      expect(await premium.k()).to.equal(10);
      expect(await premium.c()).to.equal(10);
      expect(await premium.b()).to.equal(10);
      expect(await premium.T_1()).to.equal(10);
    });

    it("revert when not owner", async () => {
      await expect(
        premium.connect(alice).setPremiumParameters(0, 0, 0, 0)
      ).to.revertedWith("Restricted: caller is not allowed to operate");
    });
  });
});
