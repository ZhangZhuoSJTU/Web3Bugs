// @ts-nocheck

import { deploy, getBigNumber, prepare } from "./utilities";

import { BigNumber } from "ethers";
import { Multicall } from "../typechain/Multicall";
import { ethers } from "hardhat";
import { expect } from "chai";

const E6 = BigNumber.from(10).pow(6);
const E8 = BigNumber.from(10).pow(8);

describe("Router", function () {
  let alice,
    aliceEncoded,
    weth,
    sushi,
    bento,
    masterDeployer,
    tridentPoolFactory,
    router,
    pool,
    dai,
    daiSushiPool,
    daiWethPool,
    sedona,
    sedonaWethPool;

  before(async function () {
    [alice] = await ethers.getSigners();
    aliceEncoded = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address]);

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const Bento = await ethers.getContractFactory("BentoBoxV1");
    const Deployer = await ethers.getContractFactory("MasterDeployer");
    const PoolFactory = await ethers.getContractFactory("ConstantProductPoolFactory");
    const TridentRouter = await ethers.getContractFactory("TridentRouter");
    const Pool = await ethers.getContractFactory("ConstantProductPool");

    weth = await ERC20.deploy("WETH", "ETH", getBigNumber("10000000"));
    sushi = await ERC20.deploy("SUSHI", "SUSHI", getBigNumber("10000000"));
    dai = await ERC20.deploy("SUSHI", "SUSHI", getBigNumber("10000000"));
    sedona = await ERC20.deploy("SED", "SED", getBigNumber("10000000"));
    bento = await Bento.deploy(weth.address);
    masterDeployer = await Deployer.deploy(17, alice.address, bento.address);
    tridentPoolFactory = await PoolFactory.deploy(masterDeployer.address);
    router = await TridentRouter.deploy(bento.address, masterDeployer.address, weth.address);

    // Whitelist pool factory in master deployer
    await masterDeployer.addToWhitelist(tridentPoolFactory.address);

    // Whitelist Router on BentoBox
    await bento.whitelistMasterContract(router.address, true);
    // Approve BentoBox token deposits
    await sushi.approve(bento.address, BigNumber.from(10).pow(30));
    await weth.approve(bento.address, BigNumber.from(10).pow(30));
    await dai.approve(bento.address, BigNumber.from(10).pow(30));
    await sedona.approve(bento.address, BigNumber.from(10).pow(30));
    // Make BentoBox token deposits
    await bento.deposit(sushi.address, alice.address, alice.address, BigNumber.from(10).pow(22), 0);
    await bento.deposit(weth.address, alice.address, alice.address, BigNumber.from(10).pow(22), 0);
    await bento.deposit(dai.address, alice.address, alice.address, BigNumber.from(10).pow(22), 0);
    await bento.deposit(sedona.address, alice.address, alice.address, BigNumber.from(10).pow(22), 0);
    // Approve Router to spend 'alice' BentoBox tokens
    await bento.setMasterContractApproval(
      alice.address,
      router.address,
      true,
      "0",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    // Pool deploy data
    let addresses = [weth.address, sushi.address].sort();
    const deployData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [addresses[0], addresses[1], 30, false]
    );
    pool = await Pool.attach((await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData)).wait()).events[0].args[1]);
    addresses = [dai.address, sushi.address].sort();
    const deployData2 = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [addresses[0], addresses[1], 30, false]
    );
    daiSushiPool = await Pool.attach(
      (
        await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData2)).wait()
      ).events[0].args[1]
    );
    addresses = [dai.address, weth.address].sort();
    const deployData3 = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [addresses[0], addresses[1], 30, false]
    );
    daiWethPool = await Pool.attach(
      (
        await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData3)).wait()
      ).events[0].args[1]
    );
    addresses = [sedona.address, weth.address].sort();
    const deployData4 = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [addresses[0], addresses[1], 30, false]
    );
    sedonaWethPool = await Pool.attach(
      (
        await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData4)).wait()
      ).events[0].args[1]
    );
  });

  describe("Pool", function () {
    it("Should add liquidity directly to the pool", async function () {
      await bento.transfer(sushi.address, alice.address, pool.address, BigNumber.from(10).pow(19));
      await bento.transfer(weth.address, alice.address, pool.address, BigNumber.from(10).pow(19));

      await pool.mint(aliceEncoded);

      expect(await pool.totalSupply()).gt(1);
      await bento.transfer(sushi.address, alice.address, daiSushiPool.address, BigNumber.from(10).pow(20));
      await bento.transfer(dai.address, alice.address, daiSushiPool.address, BigNumber.from(10).pow(20));
      await daiSushiPool.mint(aliceEncoded);
      expect(await daiSushiPool.totalSupply()).gt(1);
      await bento.transfer(weth.address, alice.address, daiWethPool.address, BigNumber.from(10).pow(20));
      await bento.transfer(dai.address, alice.address, daiWethPool.address, BigNumber.from(10).pow(20));
      await daiWethPool.mint(aliceEncoded);
      expect(await daiWethPool.totalSupply()).gt(1);
      await bento.transfer(weth.address, alice.address, sedonaWethPool.address, BigNumber.from(10).pow(20));
      await bento.transfer(sedona.address, alice.address, sedonaWethPool.address, BigNumber.from(10).pow(20));
      await sedonaWethPool.mint(aliceEncoded);
      expect(await sedonaWethPool.totalSupply()).gt(1);
    });

    it("Should add liquidity", async function () {
      let initialTotalSupply = await pool.totalSupply();
      let initialPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let initialPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);
      let liquidityInput = [
        {
          token: weth.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
        {
          token: sushi.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInput, pool.address, 1, aliceEncoded);
      let intermediateTotalSupply = await pool.totalSupply();
      let intermediatePoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let intermediatePoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);

      expect(intermediateTotalSupply).gt(initialTotalSupply);
      expect(intermediatePoolWethBalance).eq(initialPoolWethBalance.add(BigNumber.from(10).pow(18)));
      expect(intermediatePoolSushiBalance).eq(initialPoolSushiBalance.add(BigNumber.from(10).pow(18)));
      expect(intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)).eq(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(intermediatePoolSushiBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)).eq(
        initialPoolSushiBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      liquidityInput = [
        {
          token: weth.address,
          native: true,
          amount: BigNumber.from(10).pow(17),
        },
        {
          token: sushi.address,
          native: true,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInput, pool.address, 1, aliceEncoded);

      let finalTotalSupply = await pool.totalSupply();
      let finalPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let finalPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);

      expect(finalTotalSupply).gt(intermediateTotalSupply);
      expect(finalPoolWethBalance).eq(intermediatePoolWethBalance.add(BigNumber.from(10).pow(17)));
      expect(finalPoolSushiBalance).eq(intermediatePoolSushiBalance.add(BigNumber.from(10).pow(18)));
    });

    it("Should add one sided liquidity", async function () {
      let initialTotalSupply = await pool.totalSupply();
      let initialPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let initialPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);

      let liquidityInputOptimal = [
        {
          token: weth.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInputOptimal, pool.address, 1, aliceEncoded);

      let intermediateTotalSupply = await pool.totalSupply();
      let intermediatePoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let intermediatePoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);

      expect(intermediateTotalSupply).gt(initialTotalSupply);
      expect(intermediatePoolWethBalance).gt(initialPoolWethBalance);
      expect(intermediatePoolSushiBalance).eq(initialPoolSushiBalance);
      expect(intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)).gt(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );

      liquidityInputOptimal = [
        {
          token: sushi.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInputOptimal, pool.address, 1, aliceEncoded);

      let finalTotalSupply = await pool.totalSupply();
      let finalPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let finalPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);

      expect(finalTotalSupply).gt(intermediateTotalSupply);
      expect(finalPoolWethBalance).eq(intermediatePoolWethBalance);
      expect(finalPoolSushiBalance).gt(intermediatePoolSushiBalance);
      expect(finalPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).gt(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(finalPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).lt(
        intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)
      );
      expect(finalPoolSushiBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).lt(
        initialPoolSushiBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(finalPoolSushiBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).gt(
        intermediatePoolSushiBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)
      );
    });

    it("Should swap some tokens", async function () {
      let amountIn = BigNumber.from(10).pow(18);
      let expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(weth.address, amountIn));
      expect(expectedAmountOut).gt(1);
      let params = {
        amountIn: amountIn,
        amountOutMinimum: expectedAmountOut,
        pool: pool.address,
        tokenIn: weth.address,
        data: ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [weth.address, alice.address, false]),
      };
      let oldAliceWethBalance = await bento.balanceOf(weth.address, alice.address);
      let oldAliceSushiBalance = await bento.balanceOf(sushi.address, alice.address);
      let oldPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let oldPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);
      await router.exactInputSingle(params);
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceWethBalance.sub(amountIn));
      expect(await bento.balanceOf(sushi.address, alice.address)).gt(oldAliceSushiBalance);
      expect(await bento.balanceOf(weth.address, pool.address)).eq(oldPoolWethBalance.add(amountIn));
      expect(await bento.balanceOf(sushi.address, pool.address)).lt(oldPoolSushiBalance);

      amountIn = expectedAmountOut;
      expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(sushi.address, amountIn));
      expect(expectedAmountOut).lt(BigNumber.from(10).pow(18));
      params = {
        amountIn: amountIn,
        amountOutMinimum: expectedAmountOut,
        pool: pool.address,
        tokenIn: sushi.address,
        data: ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [sushi.address, alice.address, true]),
      };

      await router.exactInputSingle(params);
      expect(await bento.balanceOf(weth.address, alice.address)).lt(oldAliceWethBalance);
      expect(await bento.balanceOf(sushi.address, alice.address)).eq(oldAliceSushiBalance);
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance);
      expect(await bento.balanceOf(sushi.address, pool.address)).eq(oldPoolSushiBalance);

      amountIn = expectedAmountOut;
      expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(weth.address, amountIn));
      params = {
        amountIn: amountIn,
        amountOutMinimum: expectedAmountOut,
        pool: pool.address,
        tokenIn: weth.address,
        data: ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [weth.address, alice.address, false]),
      };

      oldAliceWethBalance = await bento.balanceOf(weth.address, alice.address);
      oldAliceSushiBalance = await bento.balanceOf(sushi.address, alice.address);
      oldPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      oldPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);

      await router.exactInputSingle(params);

      expect(await bento.balanceOf(weth.address, alice.address)).lt(oldAliceWethBalance);
      expect(await bento.balanceOf(sushi.address, alice.address)).gt(oldAliceSushiBalance);
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance);
      expect(await bento.balanceOf(sushi.address, pool.address)).lt(oldPoolSushiBalance);
    });

    it("Should handle multi hop swaps", async function () {
      let amountIn = BigNumber.from(10).pow(18);
      let expectedAmountOutSingleHop = await pool.getAmountOut(encodedTokenAmount(weth.address, amountIn));
      expect(expectedAmountOutSingleHop).gt(1);
      let params = {
        tokenIn: weth.address,
        amountIn: amountIn,
        amountOutMinimum: 1,
        path: [
          {
            pool: pool.address,
            data: encodedSwapData(weth.address, daiSushiPool.address, false),
          },
          {
            pool: daiSushiPool.address,
            data: encodedSwapData(sushi.address, daiWethPool.address, false),
          },
          {
            pool: daiWethPool.address,
            data: encodedSwapData(dai.address, pool.address, false),
          },
          {
            pool: pool.address,
            data: encodedSwapData(weth.address, alice.address, false),
          },
        ],
      };

      let oldAliceWethBalance = await bento.balanceOf(weth.address, alice.address);
      let oldAliceSushiBalance = await bento.balanceOf(sushi.address, alice.address);
      let oldPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let oldPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);
      await router.exactInput(params);
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceWethBalance.sub(amountIn));
      expect(await bento.balanceOf(sushi.address, alice.address)).lt(oldAliceSushiBalance.add(expectedAmountOutSingleHop));
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance.add(amountIn));
      expect(await bento.balanceOf(sushi.address, pool.address)).gt(
        oldPoolSushiBalance.sub(BigNumber.from(2).mul(expectedAmountOutSingleHop))
      );
    });

    it("Should swap some native tokens", async function () {
      let amountIn = BigNumber.from(10).pow(18);
      let expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(weth.address, amountIn));
      expect(expectedAmountOut).gt(1);
      let params = {
        amountIn: amountIn,
        amountOutMinimum: expectedAmountOut,
        pool: pool.address,
        tokenIn: weth.address,
        data: encodedSwapData(weth.address, alice.address, true),
      };

      let oldAliceWethBalance = await weth.balanceOf(alice.address);
      let oldAliceSushiBalance = await sushi.balanceOf(alice.address);
      let oldPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let oldPoolSushiBalance = await bento.balanceOf(sushi.address, pool.address);
      let oldAliceBentoWethBalance = await bento.balanceOf(weth.address, alice.address);
      let oldAliceBentoSushiBalance = await bento.balanceOf(sushi.address, alice.address);

      await router.exactInputSingleWithNativeToken(params);

      expect(await weth.balanceOf(alice.address)).eq(oldAliceWethBalance.sub(amountIn));
      expect(await sushi.balanceOf(alice.address)).eq(oldAliceSushiBalance.add(expectedAmountOut));
      expect(await bento.balanceOf(sushi.address, alice.address)).eq(oldAliceBentoSushiBalance);
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceBentoWethBalance);
      expect(await bento.balanceOf(weth.address, pool.address)).eq(oldPoolWethBalance.add(amountIn));
      expect(await bento.balanceOf(sushi.address, pool.address)).eq(oldPoolSushiBalance.sub(expectedAmountOut));

      amountIn = expectedAmountOut;
      expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(sushi.address, amountIn));
      expect(expectedAmountOut).lt(BigNumber.from(10).pow(18));
      params = {
        amountIn: amountIn,
        amountOutMinimum: expectedAmountOut,
        pool: pool.address,
        tokenIn: sushi.address,
        data: encodedSwapData(sushi.address, alice.address, false),
      };

      oldAliceWethBalance = await weth.balanceOf(alice.address);
      oldAliceSushiBalance = await sushi.balanceOf(alice.address);
      oldAliceBentoWethBalance = await bento.balanceOf(weth.address, alice.address);
      oldAliceBentoSushiBalance = await bento.balanceOf(sushi.address, alice.address);

      await router.exactInputSingleWithNativeToken(params);
      expect(await weth.balanceOf(alice.address)).eq(oldAliceWethBalance);
      expect(await sushi.balanceOf(alice.address)).eq(oldAliceSushiBalance.sub(amountIn));
      expect(await bento.balanceOf(sushi.address, alice.address)).eq(oldAliceBentoSushiBalance);
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceBentoWethBalance.add(expectedAmountOut));
    });

    it("Should do complex swap", async function () {
      // sedona -> weth -> 40% dai
      //                -> 60% sushi -> dai

      let amountIn = BigNumber.from(10).pow(18);
      let i = 0;
      const wethAmountOut = await sedonaWethPool.getAmountOut(encodedTokenAmount(sedona.address, amountIn));
      const daiWethAmountIn = wethAmountOut.mul(BigNumber.from(40).mul(E6)).div(E8);
      const sushiWethAmountIn = wethAmountOut.sub(daiWethAmountIn);
      const sushiAmountOut = await pool.getAmountOut(encodedTokenAmount(weth.address, sushiWethAmountIn));
      const daiAmountOut = (await daiWethPool.getAmountOut(encodedTokenAmount(weth.address, daiWethAmountIn))).add(
        await daiSushiPool.getAmountOut(encodedTokenAmount(sushi.address, sushiAmountOut))
      );
      let complexPathParams = {
        initialPath: [
          {
            tokenIn: sedona.address,
            pool: sedonaWethPool.address,
            native: true,
            amount: amountIn,
            data: encodedSwapData(sedona.address, router.address, false), // Receiver for all complex path swaps must be the router
          },
        ],
        percentagePath: [
          {
            tokenIn: weth.address,
            pool: daiWethPool.address,
            balancePercentage: BigNumber.from(40).mul(E6),
            data: encodedSwapData(weth.address, router.address, false),
          },
          {
            tokenIn: weth.address,
            pool: pool.address,
            // Since 40% of weth has already been spent, we need to spend 100% of the remaining weth here.
            balancePercentage: BigNumber.from(100).mul(E6),
            data: encodedSwapData(weth.address, router.address, false),
          },
          {
            tokenIn: sushi.address,
            pool: daiSushiPool.address,
            balancePercentage: BigNumber.from(100).mul(E6),
            data: encodedSwapData(sushi.address, router.address, false),
          },
        ],
        output: [
          {
            token: dai.address,
            to: alice.address,
            unwrapBento: true,
            minAmount: daiAmountOut,
          },
        ],
      };
      await router.complexPath(complexPathParams);
    });
  });
});

function encodedTokenAmount(token, amount) {
  return ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [token, amount]);
}

function encodedSwapData(tokenIn, to, unwrapBento) {
  return ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [tokenIn, to, unwrapBento]);
}
