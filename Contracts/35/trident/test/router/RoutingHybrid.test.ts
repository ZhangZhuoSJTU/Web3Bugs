// @ts-nocheck

import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import seedrandom from "seedrandom";
import { calcOutByIn, calcInByOut } from "@sushiswap/sdk";
import { getBigNumber } from "../utilities";

const testSeed = "7"; // Change it to change random generator values
const rnd = seedrandom(testSeed); // random [0, 1)

const MINIMUM_LIQUIDITY = 1000;

interface ExactInputSingleParams {
  amountIn: BigNumber;
  amountOutMinimum: BigNumber;
  pool: string;
  tokenIn: string;
  data: string;
}

function getIntegerRandomValue(exp): [number, BigNumber] {
  if (exp <= 15) {
    const value = Math.floor(rnd() * Math.pow(10, exp)) + 1;
    return [value, BigNumber.from(value)];
  } else {
    const random = Math.floor(rnd() * 1e15) + 1;
    const value = random * Math.pow(10, exp - 15);
    const bnValue = BigNumber.from(10)
      .pow(exp - 15)
      .mul(random);
    return [value, bnValue];
  }
}

function getIntegerRandomValueWithMin(exp, min = 0) {
  let res;
  do {
    res = getIntegerRandomValue(exp);
  } while (res[0] < min);
  return res;
}

function areCloseValues(v1, v2, threshould) {
  if (threshould == 0) return v1 == v2;
  if (v1 < 1 / threshould) return Math.abs(v1 - v2) <= 1.1;
  return Math.abs(v1 / v2 - 1) < threshould;
}

describe("HybridPool Typescript == Solidity check", function () {
  let alice, feeTo, usdt, usdc, weth, bento, masterDeployer, tridentPoolFactory, router, Pool;

  async function createHybridPool(A, fee, res0exp, res1exp) {
    [alice, feeTo] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const Bento = await ethers.getContractFactory("BentoBoxV1");
    const Deployer = await ethers.getContractFactory("MasterDeployer");
    const PoolFactory = await ethers.getContractFactory("HybridPoolFactory");
    const SwapRouter = await ethers.getContractFactory("TridentRouter");
    Pool = await ethers.getContractFactory("HybridPool");

    weth = await ERC20.deploy("WETH", "WETH", getBigNumber("1000000000000000000"));
    await weth.deployed();
    usdt = await ERC20.deploy("USDT", "USDT", getBigNumber("1000000000000000000"));
    await usdt.deployed();
    usdc = await ERC20.deploy("USDC", "USDC", getBigNumber("1000000000000000000"));
    await usdc.deployed();

    bento = await Bento.deploy(weth.address);
    await bento.deployed();

    masterDeployer = await Deployer.deploy(17, feeTo.address, bento.address);
    await masterDeployer.deployed();

    tridentPoolFactory = await PoolFactory.deploy(masterDeployer.address);
    await tridentPoolFactory.deployed();
    router = await SwapRouter.deploy(bento.address, masterDeployer.address, weth.address);
    await router.deployed();

    // Whitelist pool factory in master deployer
    await masterDeployer.addToWhitelist(tridentPoolFactory.address);

    // Whitelist Router on BentoBox
    await bento.whitelistMasterContract(router.address, true);
    // Approve BentoBox token deposits
    await usdc.approve(bento.address, getBigNumber("1000000000000000000"));
    await usdt.approve(bento.address, getBigNumber("1000000000000000000"));
    // Make BentoBox token deposits
    await bento.deposit(usdc.address, alice.address, alice.address, getBigNumber("1000000000000000000"), 0);
    await bento.deposit(usdt.address, alice.address, alice.address, getBigNumber("1000000000000000000"), 0);
    // Approve Router to spend 'alice' BentoBox tokens
    await bento.setMasterContractApproval(
      alice.address,
      router.address,
      true,
      "0",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    const [address0, address1] =
      usdt.address.toUpperCase() < usdc.address.toUpperCase() ? [usdt.address, usdc.address] : [usdc.address, usdt.address];
    const deployData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256"],
      [address0, address1, Math.round(fee * 10_000), A]
    );
    const pool = await Pool.attach(
      (
        await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData)).wait()
      ).events[0].args[1]
    );

    const [jsVal0, bnVal0] = getIntegerRandomValueWithMin(res0exp, MINIMUM_LIQUIDITY);
    const [jsVal1, bnVal1] = res1exp == undefined ? [jsVal0, bnVal0] : getIntegerRandomValueWithMin(res1exp, MINIMUM_LIQUIDITY);
    await bento.transfer(usdt.address, alice.address, pool.address, bnVal0);
    await bento.transfer(usdc.address, alice.address, pool.address, bnVal1);
    await pool.mint(ethers.utils.defaultAbiCoder.encode(["address"], [alice.address]));

    const poolInfo = {
      type: "Hybrid",
      reserve0: bnVal0,
      reserve1: bnVal1,
      fee,
      A,
      deployData,
    };

    return [poolInfo, pool];
  }

  let swapDirection = true;
  async function checkSwap(pool, poolRouterInfo0, swapAmountExp) {
    const [jsValue, bnValue] = getIntegerRandomValue(swapAmountExp);
    const [t0, t1]: string[] = swapDirection ? [usdt.address, usdc.address] : [usdc.address, usdt.address];

    const poolRouterInfo = { ...poolRouterInfo0 };
    poolRouterInfo.reserve0 = await bento.balanceOf(usdt.address, pool.address);
    poolRouterInfo.reserve1 = await bento.balanceOf(usdc.address, pool.address);
    if (poolRouterInfo.reserve0 < MINIMUM_LIQUIDITY || poolRouterInfo.reserve1 < MINIMUM_LIQUIDITY) {
      console.log("Low liquidity - skip test");
      return; // Too low liquidity
    }

    let balanceBefore: BigNumber = await bento.balanceOf(t1, alice.address);
    let params: ExactInputSingleParams = {
      amountIn: bnValue,
      amountOutMinimum: 0,
      pool: pool.address,
      tokenIn: t0,
      data: ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [t0, alice.address, false]),
    };
    const tx = await router.connect(alice).exactInputSingle(params);
    let balanceAfter: BigNumber = await bento.balanceOf(t1, alice.address);

    const amountOutPoolBN = balanceAfter.sub(balanceBefore);
    const amountOutPool = amountOutPoolBN.toString();

    const amountOutPrediction = calcOutByIn(poolRouterInfo, jsValue, swapDirection);

    //console.log('prediction', Math.abs(amountOutPrediction/amountOutPool-1), amountOutPrediction, amountOutPool);
    expect(areCloseValues(amountOutPrediction, amountOutPoolBN, 1e-9)).equals(true, "swap amount not close enough to predicted amount");
    const reserveOut = swapDirection ? poolRouterInfo.reserve1 : poolRouterInfo.reserve0;
    if (reserveOut.sub(amountOutPoolBN).lt(MINIMUM_LIQUIDITY)) {
      swapDirection = !swapDirection;
      return;
    }

    const amounInExpected = calcInByOut(poolRouterInfo, amountOutPrediction, swapDirection);
    const amountOutPrediction2 = calcOutByIn(poolRouterInfo, amounInExpected, swapDirection);

    // console.log('back1', Math.abs(amounInExpected/jsValue-1), amounInExpected, jsValue);
    // console.log('back2', Math.abs(amountOutPrediction/amountOutPrediction2-1), amountOutPrediction, amountOutPrediction2);
    expect(areCloseValues(amounInExpected, jsValue, 1e-12) || areCloseValues(amountOutPrediction, amountOutPrediction2, 1e-12)).equals(
      true,
      "values not close enough"
    );
    swapDirection = !swapDirection;
  }

  describe("Check regular liquidity values", function () {
    for (let mintNum = 0; mintNum < 3; ++mintNum) {
      it(`Test ${mintNum + 1}`, async function () {
        const [poolRouterInfo, pool] = await createHybridPool(200_000, 0.003, 19, 19);

        // test regular values
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 17);
        }
        // test small values
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 2);
        }
        //test big values 2^112 = 10^33.7153
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 23);
        }
        await checkSwap(pool, poolRouterInfo, 33);
      });
    }
  });

  describe("Check supersmall liquidity values", function () {
    for (let mintNum = 0; mintNum < 3; ++mintNum) {
      it(`Test ${mintNum + 1}`, async function () {
        const [poolRouterInfo, pool] = await createHybridPool(200_000, 0.003, 4, 4);

        // test small values
        for (let swapNum = 0; swapNum < 5; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 3);
        }
        await checkSwap(pool, poolRouterInfo, 7);
      });
    }
  });

  describe("Check superbig liquidity values", function () {
    for (let mintNum = 0; mintNum < 3; ++mintNum) {
      it(`Test ${mintNum + 1}`, async function () {
        const [poolRouterInfo, pool] = await createHybridPool(200_000, 0.003, 33, 33);

        // test regular values
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 17);
        }
        // test small values
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 2);
        }
        //test extremely big values 2^112 = 10^33.7153
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 33);
        }
      });
    }
  });

  describe("Check different fees", function () {
    for (let mintNum = 0; mintNum < 3; ++mintNum) {
      const fee = (mintNum + 1) / 1000;
      it(`fee = ${fee}`, async function () {
        const [poolRouterInfo, pool] = await createHybridPool(200_000, fee, 19, 19);

        // test regular values
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 17);
        }
        // test small values
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 2);
        }
        //test extremely big values 2^112 = 10^33.7153
        for (let swapNum = 0; swapNum < 3; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 25);
        }
        await checkSwap(pool, poolRouterInfo, 33);
      });
    }
  });

  describe("Check different A", function () {
    const Avariants = [100, 450, 1000, 6000, 30_000, 100_000, 1000_000];
    for (let i = 0; i < Avariants.length; ++i) {
      const A = Avariants[i];
      it(`A = ${A}`, async function () {
        const [poolRouterInfo, pool] = await createHybridPool(A, 0.003, 19, 19);

        // test regular values
        for (let swapNum = 0; swapNum < 2; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 17);
        }
        // test small values
        for (let swapNum = 0; swapNum < 2; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 2);
        }
        //test extremely big values 2^112 = 10^33.7153
        for (let swapNum = 0; swapNum < 2; ++swapNum) {
          await checkSwap(pool, poolRouterInfo, 24);
        }
        await checkSwap(pool, poolRouterInfo, 33);
      });
    }
  });
});
