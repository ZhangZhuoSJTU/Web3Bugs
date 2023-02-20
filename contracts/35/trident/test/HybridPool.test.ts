// @ts-nocheck

import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import { expect } from "chai";
import { getBigNumber } from "./utilities";

describe("Router", function () {
  let alice, aliceEncoded, feeTo, weth, usdc, bento, masterDeployer, tridentPoolFactory, router, dai, daiUsdcPool, pool;

  before(async function () {
    [alice, feeTo] = await ethers.getSigners();
    aliceEncoded = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address]);
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const Bento = await ethers.getContractFactory("BentoBoxV1");
    const Deployer = await ethers.getContractFactory("MasterDeployer");
    const PoolFactory = await ethers.getContractFactory("HybridPoolFactory");
    const SwapRouter = await ethers.getContractFactory("TridentRouter");
    const Pool = await ethers.getContractFactory("HybridPool");
    weth = await ERC20.deploy("WETH", "WETH", getBigNumber("10000000"));
    usdc = await ERC20.deploy("USDC", "USDC", getBigNumber("10000000"));
    dai = await ERC20.deploy("DAI", "DAI", getBigNumber("10000000"));

    bento = await Bento.deploy(weth.address);

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
    await weth.approve(bento.address, getBigNumber("10000000"));
    await usdc.approve(bento.address, getBigNumber("10000000"));
    await dai.approve(bento.address, getBigNumber("10000000"));

    // Make BentoBox token deposits
    await bento.deposit(weth.address, alice.address, alice.address, getBigNumber("1000000"), 0);
    await bento.deposit(usdc.address, alice.address, alice.address, getBigNumber("1000000"), 0);
    await bento.deposit(dai.address, alice.address, alice.address, getBigNumber("1000000"), 0);
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
    let addresses = [weth.address, usdc.address].sort();
    const deployData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256"],
      [addresses[0], addresses[1], 30, 200000]
    );

    pool = await Pool.attach((await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData)).wait()).events[0].args[1]);

    addresses = [dai.address, usdc.address].sort();
    const deployData2 = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256"],
      [addresses[0], addresses[1], 30, 200000]
    );
    daiUsdcPool = await Pool.attach(
      (
        await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData2)).wait()
      ).events[0].args[1]
    );
  });

  describe("HybridPool", function () {
    it("Should add liquidity directly to the pool", async function () {
      await bento.transfer(weth.address, alice.address, pool.address, BigNumber.from(10).pow(19));
      await bento.transfer(usdc.address, alice.address, pool.address, BigNumber.from(10).pow(19));
      await pool.mint(aliceEncoded);
      expect(await pool.totalSupply()).gt(1);
      await bento.transfer(dai.address, alice.address, daiUsdcPool.address, BigNumber.from(10).pow(19));
      await bento.transfer(usdc.address, alice.address, daiUsdcPool.address, BigNumber.from(10).pow(19));
      await daiUsdcPool.mint(aliceEncoded);
    });

    it("Should add liquidity", async function () {
      let initialTotalSupply = await pool.totalSupply();
      let initialPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let initialPoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);
      let liquidityInput = [
        {
          token: weth.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
        {
          token: usdc.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInput, pool.address, 1, aliceEncoded);
      let intermediateTotalSupply = await pool.totalSupply();
      let intermediatePoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let intermediatePoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);

      expect(intermediateTotalSupply).gt(initialTotalSupply);
      expect(intermediatePoolWethBalance).eq(initialPoolWethBalance.add(BigNumber.from(10).pow(18)));
      expect(intermediatePoolUsdcBalance).eq(initialPoolUsdcBalance.add(BigNumber.from(10).pow(18)));
      expect(intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)).eq(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(intermediatePoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)).eq(
        initialPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      liquidityInput = [
        {
          token: weth.address,
          native: false,
          amount: BigNumber.from(10).pow(17),
        },
        {
          token: usdc.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInput, pool.address, 1, aliceEncoded);

      let finalTotalSupply = await pool.totalSupply();
      let finalPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let finalPoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);

      expect(finalTotalSupply).gt(intermediateTotalSupply);
      expect(finalPoolWethBalance).eq(intermediatePoolWethBalance.add(BigNumber.from(10).pow(17)));
      expect(finalPoolUsdcBalance).eq(intermediatePoolUsdcBalance.add(BigNumber.from(10).pow(18)));
      expect(finalPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).lt(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(finalPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).lt(
        intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)
      );
      expect(finalPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).gt(
        initialPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(finalPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).gt(
        intermediatePoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)
      );
    });

    it("Should add one sided liquidity", async function () {
      let initialTotalSupply = await pool.totalSupply();
      let initialPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let initialPoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);

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
      let intermediatePoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);

      expect(intermediateTotalSupply).gt(initialTotalSupply);
      expect(intermediatePoolWethBalance).gt(initialPoolWethBalance);
      expect(intermediatePoolUsdcBalance).eq(initialPoolUsdcBalance);
      expect(intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)).gt(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );

      liquidityInputOptimal = [
        {
          token: usdc.address,
          native: false,
          amount: BigNumber.from(10).pow(18),
        },
      ];
      await router.addLiquidity(liquidityInputOptimal, pool.address, 1, aliceEncoded);

      let finalTotalSupply = await pool.totalSupply();
      let finalPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let finalPoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);

      expect(finalTotalSupply).gt(intermediateTotalSupply);
      expect(finalPoolWethBalance).eq(intermediatePoolWethBalance);
      expect(finalPoolUsdcBalance).gt(intermediatePoolUsdcBalance);
      expect(finalPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).gt(
        initialPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(finalPoolWethBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).lt(
        intermediatePoolWethBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)
      );
      expect(finalPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).lt(
        initialPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(initialTotalSupply)
      );
      expect(finalPoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(finalTotalSupply)).gt(
        intermediatePoolUsdcBalance.mul(BigNumber.from(10).pow(36)).div(intermediateTotalSupply)
      );
    });

    it("Should swap some tokens", async function () {
      let amountIn = BigNumber.from(10).pow(18);
      let expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(weth, amountIn));
      expect(expectedAmountOut).gt(1);
      let params = swapParams(weth.address, amountIn, pool.address, alice.address, 1, false);
      let oldAliceWethBalance = await bento.balanceOf(weth.address, alice.address);
      let oldAliceUsdcBalance = await bento.balanceOf(usdc.address, alice.address);
      let oldPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let oldPoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);
      await router.exactInputSingle(params);
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceWethBalance.sub(amountIn));
      expect(await bento.balanceOf(usdc.address, alice.address)).eq(oldAliceUsdcBalance.add(expectedAmountOut));
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance);
      expect(await bento.balanceOf(usdc.address, pool.address)).eq(oldPoolUsdcBalance.sub(expectedAmountOut));

      amountIn = expectedAmountOut;
      expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(usdc, amountIn));
      expect(expectedAmountOut).lt(BigNumber.from(10).pow(18));
      expect(expectedAmountOut).gt(1);

      params = swapParams(usdc.address, amountIn, pool.address, alice.address, 1, false);

      await router.exactInputSingle(params);
      expect(await bento.balanceOf(weth.address, alice.address)).lt(oldAliceWethBalance);
      expect(await bento.balanceOf(usdc.address, alice.address)).eq(oldAliceUsdcBalance);
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance);
      expect(await bento.balanceOf(usdc.address, pool.address)).eq(oldPoolUsdcBalance);
    });

    it("Should handle multi hop swaps", async function () {
      let amountIn = BigNumber.from(10).pow(18);
      let expectedAmountOutSingleHop = await pool.getAmountOut(encodedTokenAmount(weth, amountIn));
      expect(expectedAmountOutSingleHop).gt(1);
      let params = {
        tokenIn: weth.address,
        amountIn: amountIn,
        amountOutMinimum: 1,
        path: [
          {
            pool: pool.address,
            data: encodedSwapData(weth.address, daiUsdcPool.address, false),
          },
          {
            pool: daiUsdcPool.address,
            data: encodedSwapData(usdc.address, alice.address, false),
          },
        ],
      };

      let oldAliceWethBalance = await bento.balanceOf(weth.address, alice.address);
      let oldAliceUsdcBalance = await bento.balanceOf(usdc.address, alice.address);
      let oldAliceDaiBalance = await bento.balanceOf(dai.address, alice.address);
      await router.exactInput(params);
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceWethBalance.sub(amountIn));
      expect(await bento.balanceOf(usdc.address, alice.address)).eq(oldAliceUsdcBalance);
      expect(await bento.balanceOf(dai.address, alice.address)).gt(oldAliceDaiBalance);
    });

    it("Should swap some native tokens", async function () {
      let amountIn = BigNumber.from(10).pow(18);
      let expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(weth, amountIn));
      expect(expectedAmountOut).gt(1);
      let params = swapParams(weth.address, amountIn, pool.address, alice.address, 1, false);

      let oldAliceWethBalance = await weth.balanceOf(alice.address);
      let oldAliceUsdcBalance = await bento.balanceOf(usdc.address, alice.address);
      let oldPoolWethBalance = await bento.balanceOf(weth.address, pool.address);
      let oldPoolUsdcBalance = await bento.balanceOf(usdc.address, pool.address);
      let oldAliceBentoWethBalance = await bento.balanceOf(weth.address, alice.address);

      await router.exactInputSingleWithNativeToken(params);

      expect(await weth.balanceOf(alice.address)).eq(oldAliceWethBalance.sub(amountIn));
      expect(await bento.balanceOf(usdc.address, alice.address)).eq(oldAliceUsdcBalance.add(expectedAmountOut));
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance);
      expect(await bento.balanceOf(usdc.address, pool.address)).eq(oldPoolUsdcBalance.sub(expectedAmountOut));
      expect(await bento.balanceOf(weth.address, alice.address)).eq(oldAliceBentoWethBalance);

      amountIn = expectedAmountOut;
      expectedAmountOut = await pool.getAmountOut(encodedTokenAmount(usdc, amountIn));
      expect(expectedAmountOut).lt(BigNumber.from(10).pow(18));
      params = swapParams(usdc.address, amountIn, pool.address, alice.address, 1, true);

      await router.exactInputSingleWithNativeToken(params);
      expect(await bento.balanceOf(weth.address, pool.address)).gt(oldPoolWethBalance);
    });
  });
});

function encodedTokenAmount(token, amount) {
  return ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [token.address, amount]);
}

function swapParams(tokenIn, amountIn, pool, to, amountOutMinimum, unwrapBento) {
  return {
    amountIn: amountIn,
    amountOutMinimum: amountOutMinimum,
    pool: pool,
    tokenIn: tokenIn,
    data: encodedSwapData(tokenIn, to, unwrapBento),
  };
}

function encodedSwapData(tokenIn, to, unwrapBento) {
  return ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [tokenIn, to, unwrapBento]);
}
