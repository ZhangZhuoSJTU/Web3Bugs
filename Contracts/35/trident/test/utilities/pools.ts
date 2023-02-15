import { BigNumber, Contract, ContractFactory } from "ethers";
import * as sdk from "@sushiswap/sdk";
import { getIntegerRandomValueWithMin } from ".";
import seedrandom from "seedrandom";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

const testSeed = "7";
const rnd = seedrandom(testSeed);

export async function createHybridPool(
  tokenA: Contract,
  tokenB: Contract,
  swapFee: number,
  A: number,
  minLiquidity: number,
  reservesExponents: number[],
  PoolFactory: ContractFactory,
  masterDeployer: Contract,
  tridentPoolFactory: Contract,
  bento: Contract,
  alice: SignerWithAddress
): Promise<[Contract, sdk.RHybridPool]> {
  const [reserve0, reserve0BN] = getIntegerRandomValueWithMin(reservesExponents[0], minLiquidity, rnd);
  const [reserve1, reserve1BN] = getIntegerRandomValueWithMin(reservesExponents[1], minLiquidity, rnd);

  const fee = Math.round(swapFee * 10_000);
  const deployData = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint256", "uint256"],
    [tokenA.address, tokenB.address, fee, A]
  );

  const hybridPool: Contract = await PoolFactory.attach(
    (
      await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData)).wait()
    ).events[0].args[1]
  );

  await bento.transfer(tokenA.address, alice.address, hybridPool.address, reserve0BN);
  await bento.transfer(tokenB.address, alice.address, hybridPool.address, reserve1BN);

  await hybridPool.mint(ethers.utils.defaultAbiCoder.encode(["address"], [alice.address]));

  const hybridPoolInfo = new sdk.RHybridPool({
    A,
    reserve0: reserve0BN,
    reserve1: reserve1BN,
    address: hybridPool.address,
    token0: { address: tokenA.address, name: tokenA.address },
    token1: { address: tokenB.address, name: tokenB.address },
    fee: swapFee,
  });

  return [hybridPool, hybridPoolInfo];
}

export async function createConstantProductPool(
  tokenA: Contract,
  tokenB: Contract,
  swapFee: number,
  minLiquidity: number,
  reservesExponents: number[],
  PoolFactory: ContractFactory,
  masterDeployer: Contract,
  tridentPoolFactory: Contract,
  bento: Contract,
  alice: SignerWithAddress
): Promise<[Contract, sdk.RConstantProductPool]> {
  const [reserve0, reserve0BN] = getIntegerRandomValueWithMin(reservesExponents[0], minLiquidity, rnd);
  const [reserve1, reserve1BN] = getIntegerRandomValueWithMin(reservesExponents[1], minLiquidity, rnd);

  const fee = Math.round(swapFee * 10_000);
  const deployData = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint256", "bool"],
    [tokenA.address, tokenB.address, fee, true]
  );

  const constantProductPool: Contract = await PoolFactory.attach(
    (
      await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData)).wait()
    ).events[0].args[1]
  );

  await bento.transfer(tokenA.address, alice.address, constantProductPool.address, reserve0BN);
  await bento.transfer(tokenB.address, alice.address, constantProductPool.address, reserve1BN);

  await constantProductPool.mint(ethers.utils.defaultAbiCoder.encode(["address"], [alice.address]));

  const cpPoolInfo: sdk.RConstantProductPool = new sdk.RConstantProductPool({
    reserve0: reserve0BN,
    reserve1: reserve1BN,
    address: constantProductPool.address,
    token0: { address: tokenA.address, name: tokenA.address },
    token1: { address: tokenB.address, name: tokenB.address },
    fee: swapFee,
  });

  return [constantProductPool, cpPoolInfo];
}
