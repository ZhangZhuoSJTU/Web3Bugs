// @ts-nocheck

import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { encodedSwapData, getBigNumber, randBetween, sqrt, printHumanReadable, ZERO, TWO, MAX_FEE } from "./helpers";

let accounts = [];
// First token is used as weth
let tokens = [];
let pools = [];
let bento, masterDeployer, router;
let aliceEncoded;

export async function initialize() {
  if (accounts.length > 0) {
    return;
  }
  accounts = await ethers.getSigners();
  aliceEncoded = utils.defaultAbiCoder.encode(["address"], [accounts[0].address]);

  const ERC20 = await ethers.getContractFactory("ERC20Mock");
  const Bento = await ethers.getContractFactory("BentoBoxV1");
  const Deployer = await ethers.getContractFactory("MasterDeployer");
  const PoolFactory = await ethers.getContractFactory("ConstantProductPoolFactory");
  const TridentRouter = await ethers.getContractFactory("TridentRouter");
  const Pool = await ethers.getContractFactory("ConstantProductPool");

  let promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(ERC20.deploy("Token" + i, "TOK" + i, getBigNumber(1000000)));
  }
  tokens = await Promise.all(promises);

  bento = await Bento.deploy(tokens[0].address);
  masterDeployer = await Deployer.deploy(randBetween(1, 9999), accounts[1].address, bento.address);
  router = await TridentRouter.deploy(bento.address, masterDeployer.address, tokens[0].address);
  const poolFactory = await PoolFactory.deploy(masterDeployer.address);

  await Promise.all([
    // Whitelist pool factory in master deployer
    masterDeployer.addToWhitelist(poolFactory.address),
    // Whitelist Router on BentoBox
    bento.whitelistMasterContract(router.address, true),
  ]);

  // Approve BentoBox token deposits and deposit tokens in bentobox
  promises = [];
  for (let i = 0; i < tokens.length; i++) {
    promises.push(
      tokens[i].approve(bento.address, getBigNumber(1000000)).then(() => {
        bento.deposit(tokens[i].address, accounts[0].address, accounts[0].address, getBigNumber(500000), 0);
      })
    );
  }
  await Promise.all(promises);

  // Approve Router to spend alice's BentoBox tokens
  await bento.setMasterContractApproval(
    accounts[0].address,
    router.address,
    true,
    "0",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );

  // Create pools
  promises = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    // Pool deploy data
    let token0, token1;
    if (tokens[i].address < tokens[i + 1].address) {
      token0 = tokens[i];
      token1 = tokens[i + 1];
    } else {
      token0 = tokens[i + 1];
      token1 = tokens[i];
    }
    const deployData = utils.defaultAbiCoder.encode(["address", "address", "uint256", "bool"], [token0.address, token1.address, 30, false]);
    const salt = utils.keccak256(deployData);
    const constructorParams = utils.defaultAbiCoder.encode(["bytes", "address"], [deployData, masterDeployer.address]).substring(2);
    const initCodeHash = utils.keccak256(Pool.bytecode + constructorParams);
    const poolAddress = utils.getCreate2Address(poolFactory.address, salt, initCodeHash);
    pools.push(Pool.attach(poolAddress));
    promises.push(masterDeployer.deployPool(poolFactory.address, deployData));
  }
  await Promise.all(promises);

  // Add initial liquidity of 1k tokens each to every pool
  for (let i = 0; i < pools.length; i++) {
    await addLiquidity(i, getBigNumber(1000), getBigNumber(1000));
  }
}

export async function addLiquidity(poolIndex, amount0, amount1, native0 = false, native1 = false) {
  const pool = pools[poolIndex];
  const token0 = tokens[poolIndex];
  const token1 = tokens[poolIndex + 1];

  // [
  //   Total supply,
  //   Pool's token0 bento balance,
  //   Pool's token1 bento balance,
  //   Alice's token0 bento balance,
  //   Alice's token1 bento balance,
  //   Alice's token0 native balance,
  //   Alice's token1 native balance,
  //   Alice's LP balance
  // ]
  const initialBalances = await getBalances(pool, accounts[0].address, token0, token1);

  let liquidityInput = [
    {
      token: token0.address,
      native: native0,
      amount: amount0,
    },
    {
      token: token1.address,
      native: native1,
      amount: amount1,
    },
  ];

  const [kLast, barFee, swapFee] = await Promise.all([pools[poolIndex].kLast(), masterDeployer.barFee(), pools[poolIndex].swapFee()]);

  const [computedLiquidity, expectedIncreaseInTotalSupply] = liquidityCalculations(
    initialBalances,
    amount0,
    amount1,
    kLast,
    barFee,
    swapFee
  );

  await router.addLiquidity(liquidityInput, pool.address, computedLiquidity, aliceEncoded);

  const finalBalances = await getBalances(pool, accounts[0].address, token0, token1);

  // Total supply increased
  expect(finalBalances[0]).eq(initialBalances[0].add(expectedIncreaseInTotalSupply));
  // Pool balances increased
  expect(finalBalances[1]).eq(initialBalances[1].add(amount0));
  expect(finalBalances[2]).eq(initialBalances[2].add(amount1));
  // Users' token balances decreased
  if (native0) {
    expect(finalBalances[3]).eq(initialBalances[3]);
    expect(finalBalances[5]).eq(initialBalances[5].sub(amount0));
  } else {
    expect(finalBalances[3]).eq(initialBalances[3].sub(amount0));
    expect(finalBalances[5]).eq(initialBalances[5]);
  }
  if (native1) {
    expect(finalBalances[4]).eq(initialBalances[4]);
    expect(finalBalances[6]).eq(initialBalances[6].sub(amount1));
  } else {
    expect(finalBalances[4]).eq(initialBalances[4].sub(amount1));
    expect(finalBalances[6]).eq(initialBalances[6]);
  }
  // Users' LP balance increased
  expect(finalBalances[7]).eq(initialBalances[7].add(computedLiquidity));
}

export async function swap(hops, amountIn, reverse = false, nativeIn = false, nativeOut = false) {
  if (hops <= 0) return;

  // [[pool0token0. pool0token1, pool1token0....], [userToken0Bento, userToken0Native, userTokenNNative, userTokenNBento]]
  const [initialPoolBalances, initialUserBalances] = await getSwapBalances(hops, accounts[0].address);
  const amountOuts = await getSwapAmounts(hops, amountIn, initialPoolBalances, reverse);

  const tokenIn = reverse ? tokens[hops].address : tokens[0].address;

  if (hops == 1) {
    const params = {
      amountIn: amountIn,
      amountOutMinimum: amountOuts[0],
      pool: pools[0].address,
      tokenIn: tokenIn,
      data: ethers.utils.defaultAbiCoder.encode(["address", "address", "bool"], [tokenIn, accounts[0].address, nativeOut]),
    };
    if (nativeIn) {
      await router.exactInputSingleWithNativeToken(params);
    } else {
      await router.exactInputSingle(params);
    }
  } else {
    const path = getPath(hops, reverse, nativeOut, accounts[0].address);
    const amountOutMinimum = reverse ? amountOuts[0] : amountOuts[amountOuts.length - 1];
    const params = {
      tokenIn: tokenIn,
      amountIn: amountIn,
      amountOutMinimum: amountOutMinimum,
      path: path,
    };
    if (nativeIn) {
      await router.exactInputWithNativeToken(params);
    } else {
      await router.exactInput(params);
    }
  }

  const [finalPoolBalances, finalUserBalances] = await getSwapBalances(hops, accounts[0].address);

  if (reverse) {
    initialPoolBalances.reverse();
    finalPoolBalances.reverse();
    initialUserBalances.reverse();
    finalUserBalances.reverse();
    amountOuts.reverse();
  }

  // Ensure pool balances changed as expected
  let poolAmountIn = amountIn;
  for (let i = 0; i < hops; i++) {
    // Pool in balance increased
    expect(finalPoolBalances[2 * i]).eq(initialPoolBalances[2 * i].add(poolAmountIn));
    // pool out balance decreased
    expect(finalPoolBalances[2 * i + 1]).eq(initialPoolBalances[2 * i + 1].sub(amountOuts[i]));
    poolAmountIn = amountOuts[i];
  }
  // Ensure users' balances changed as expected
  if (nativeIn) {
    expect(finalUserBalances[0]).eq(initialUserBalances[0]);
    expect(finalUserBalances[1]).eq(initialUserBalances[1].sub(amountIn));
  } else {
    expect(finalUserBalances[0]).eq(initialUserBalances[0].sub(amountIn));
    expect(finalUserBalances[1]).eq(initialUserBalances[1]);
  }
  if (nativeOut) {
    expect(finalUserBalances[3]).eq(initialUserBalances[3]);
    expect(finalUserBalances[2]).eq(initialUserBalances[2].add(amountOuts[amountOuts.length - 1]));
  } else {
    expect(finalUserBalances[3]).eq(initialUserBalances[3].add(amountOuts[amountOuts.length - 1]));
    expect(finalUserBalances[2]).eq(initialUserBalances[2]);
  }
}

export async function burnLiquidity(poolIndex, amount, withdrawType, unwrapBento) {
  const pool = pools[poolIndex];
  const token0 = tokens[poolIndex];
  const token1 = tokens[poolIndex + 1];

  await pool.approve(router.address, amount);

  // [
  //   Total supply,
  //   Pool's token0 bento balance,
  //   Pool's token1 bento balance,
  //   Alice's token0 bento balance,
  //   Alice's token1 bento balance,
  //   Alice's token0 native balance,
  //   Alice's token1 native balance,
  //   Alice's LP balance
  // ]
  const initialBalances = await getBalances(pool, accounts[0].address, token0, token1);

  const [kLast, barFee, swapFee] = await Promise.all([pools[poolIndex].kLast(), masterDeployer.barFee(), pools[poolIndex].swapFee()]);

  let [amount0, amount1, feeMint] = burnCalculations(initialBalances, amount, kLast, barFee);

  if (withdrawType == 0) {
    // Withdraw in token0 only
    amount0 = amount0.add(getAmountOut(amount1, initialBalances[2].sub(amount1), initialBalances[1].sub(amount0), swapFee));
    amount1 = ZERO;
    const burnData = utils.defaultAbiCoder.encode(["address", "address", "bool"], [token0.address, accounts[0].address, unwrapBento]);
    await router.burnLiquiditySingle(pool.address, amount, burnData, amount0);
  } else if (withdrawType == 1) {
    // Withdraw in token1 only
    amount1 = amount1.add(getAmountOut(amount0, initialBalances[1].sub(amount0), initialBalances[2].sub(amount1), swapFee));
    amount0 = ZERO;
    const burnData = utils.defaultAbiCoder.encode(["address", "address", "bool"], [token1.address, accounts[0].address, unwrapBento]);
    await router.burnLiquiditySingle(pool.address, amount, burnData, amount1);
  } else {
    // Withdraw evenly
    const minWithdrawals = [
      {
        token: token0.address,
        amount: amount0,
      },
      {
        token: token1.address,
        amount: amount1,
      },
    ];
    const burnData = utils.defaultAbiCoder.encode(["address", "bool"], [accounts[0].address, unwrapBento]);
    await router.burnLiquidity(pool.address, amount, burnData, minWithdrawals);
  }

  const finalBalances = await getBalances(pool, accounts[0].address, token0, token1);

  // Total supply decreased
  expect(finalBalances[0]).eq(initialBalances[0].sub(amount).add(feeMint));
  // Pool balances decreased
  expect(finalBalances[1]).eq(initialBalances[1].sub(amount0));
  expect(finalBalances[2]).eq(initialBalances[2].sub(amount1));
  // Users' token balances increased
  if (unwrapBento) {
    expect(finalBalances[3]).eq(initialBalances[3]);
    expect(finalBalances[5]).eq(initialBalances[5].add(amount0));
  } else {
    expect(finalBalances[3]).eq(initialBalances[3].add(amount0));
    expect(finalBalances[5]).eq(initialBalances[5]);
  }
  // Users' LP balance decreased
  expect(finalBalances[7]).eq(initialBalances[7].sub(amount));
}

async function getBalances(pool, user, token0, token1) {
  return Promise.all([
    pool.totalSupply(),
    bento.balanceOf(token0.address, pool.address),
    bento.balanceOf(token1.address, pool.address),
    bento.balanceOf(token0.address, user),
    bento.balanceOf(token1.address, user),
    token0.balanceOf(user),
    token1.balanceOf(user),
    pool.balanceOf(user),
  ]);
}

async function getSwapBalances(hops, user) {
  let promises = [];
  for (let i = 0; i < hops; i++) {
    promises.push(bento.balanceOf(tokens[i].address, pools[i].address));
    promises.push(bento.balanceOf(tokens[i + 1].address, pools[i].address));
  }
  const poolBalances = await Promise.all(promises);
  const userBalances = await Promise.all([
    bento.balanceOf(tokens[0].address, user),
    tokens[0].balanceOf(user),
    tokens[hops].balanceOf(user),
    bento.balanceOf(tokens[hops].address, user),
  ]);
  return [poolBalances, userBalances];
}

async function getSwapAmounts(hops, amountIn, poolBalances, reverse = false) {
  let promises = [];
  for (let i = 0; i < hops; i++) {
    promises.push(pools[i].swapFee());
  }
  const poolFees = await Promise.all(promises);
  let amountOuts = [];

  if (reverse) {
    for (let i = 0; i < hops; i++) {
      const poolIndex = hops - i - 1;
      amountOuts.push(getAmountOut(amountIn, poolBalances[2 * poolIndex + 1], poolBalances[2 * poolIndex], poolFees[poolIndex]));
      amountIn = amountOuts[i];
    }
    amountOuts.reverse();
    return amountOuts;
  }

  for (let i = 0; i < hops; i++) {
    amountOuts.push(getAmountOut(amountIn, poolBalances[2 * i], poolBalances[2 * i + 1], poolFees[i]));
    amountIn = amountOuts[i];
  }
  return amountOuts;
}

function getAmountOut(amountIn, reserveIn, reserveOut, swapFee) {
  const amountInWithFee = amountIn.mul(MAX_FEE.sub(swapFee));
  return amountInWithFee.mul(reserveOut).div(reserveIn.mul(MAX_FEE).add(amountInWithFee));
}

function getPath(hops, reverse, nativeOut, user) {
  let path = [];

  if (reverse) {
    for (let i = 0; i < hops; i++) {
      const poolIndex = hops - i - 1;
      path.push({
        pool: pools[poolIndex].address,
        data: encodedSwapData(
          tokens[poolIndex + 1].address,
          i == hops - 1 ? user : pools[poolIndex - 1].address,
          i == hops - 1 ? nativeOut : false
        ),
      });
    }
    return path;
  }

  for (let i = 0; i < hops; i++) {
    path.push({
      pool: pools[i].address,
      data: encodedSwapData(tokens[i].address, i == hops - 1 ? user : pools[i + 1].address, i == hops - 1 ? nativeOut : false),
    });
  }
  return path;
}

function unoptimalMintFee(amount0, amount1, reserve0, reserve1, swapFee) {
  if (reserve0.isZero() || reserve1.isZero()) return [ZERO, ZERO];

  const amount1Optimal = amount0.mul(reserve1).div(reserve0);
  if (amount1Optimal.lte(amount1)) {
    return [ZERO, swapFee.mul(amount1.sub(amount1Optimal)).div(MAX_FEE.mul(TWO))];
  } else {
    const amount0Optimal = amount1.mul(reserve0).div(reserve1);
    return [swapFee.mul(amount0.sub(amount0Optimal)).div(MAX_FEE.mul(TWO)), ZERO];
  }
}

function liquidityCalculations(initialBalances, amount0, amount1, kLast, barFee, swapFee) {
  const [fee0, fee1] = unoptimalMintFee(amount0, amount1, initialBalances[1], initialBalances[2], swapFee);
  const preMintComputed = sqrt(initialBalances[1].add(fee0).mul(initialBalances[2].add(fee1)));
  const feeMint = preMintComputed.isZero()
    ? ZERO
    : initialBalances[0].mul(preMintComputed.sub(kLast).mul(barFee)).div(preMintComputed.mul(MAX_FEE));
  const updatedTotalSupply = initialBalances[0].add(feeMint);
  const computed = sqrt(initialBalances[1].add(amount0).mul(initialBalances[2].add(amount1)));
  const computedLiquidity = preMintComputed.isZero()
    ? computed.sub(BigNumber.from(1000))
    : computed.sub(preMintComputed).mul(updatedTotalSupply).div(preMintComputed);
  const expectedIncreaseInTotalSupply = computedLiquidity.add(feeMint).add(preMintComputed.isZero() ? BigNumber.from(1000) : ZERO);
  return [computedLiquidity, expectedIncreaseInTotalSupply];
}

function burnCalculations(initialBalances, amount, kLast, barFee) {
  const preMintComputed = sqrt(initialBalances[1].mul(initialBalances[2]));
  const feeMint = preMintComputed.isZero()
    ? ZERO
    : initialBalances[0].mul(preMintComputed.sub(kLast).mul(barFee)).div(preMintComputed.mul(MAX_FEE));
  const updatedTotalSupply = feeMint.add(initialBalances[0]);

  const amount0 = amount.mul(initialBalances[1]).div(updatedTotalSupply);
  const amount1 = amount.mul(initialBalances[2]).div(updatedTotalSupply);
  return [amount0, amount1, feeMint];
}
