import { Contract } from "ethers";
import { ethers } from "hardhat";
import { HybridRPool, ConstantProductRPool, getBigNumber, RToken } from "@sushiswap/tines";

import { PoolDeploymentContracts } from "./helperInterfaces";
import { choice, getRandom } from "./randomHelper";
import { MAX_POOL_IMBALANCE, MAX_POOL_RESERVE, MIN_POOL_IMBALANCE, MIN_POOL_RESERVE } from "./constants";
 
export async function getCPPool(t0: RToken, t1: RToken, price: number, deploymentContracts: PoolDeploymentContracts, rnd: () => number, reserve: number = 0) {

  const fee = getPoolFee(rnd) * 10_000;  
  const imbalance = getPoolImbalance(rnd);

  let reserve1;
  let reserve0;  

  if(reserve === 0){
    reserve1 = getPoolReserve(rnd);
    reserve0 = reserve1 * price * imbalance; 
  }
  else{
    reserve0 = reserve;
    reserve1 = Math.round(reserve / price);
  }

  const deployData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [t0.address, t1.address, fee, true]);

  const constantProductPool: Contract = await deploymentContracts.constPoolFactory.attach(
  (
    await (await deploymentContracts.masterDeployerContract.deployPool(deploymentContracts.constantPoolContract.address, deployData)).wait()
  ).events[0].args[1]);

  await deploymentContracts.bentoContract.transfer(t0.address, deploymentContracts.account.address, constantProductPool.address, getBigNumber(reserve0));
  await deploymentContracts.bentoContract.transfer(t1.address, deploymentContracts.account.address, constantProductPool.address, getBigNumber(reserve1));

  await constantProductPool.mint(ethers.utils.defaultAbiCoder.encode(["address"], [deploymentContracts.account.address]));

  return new ConstantProductRPool(
    constantProductPool.address,
    t0,
    t1,
    fee / 10_000,
    getBigNumber(reserve0),
    getBigNumber(reserve1),
  )
} 

export async function getHybridPool(t0: RToken, t1: RToken, price: number, deploymentContracts: PoolDeploymentContracts, rnd: () => number, reserve: number = 0) {

  const fee = getPoolFee(rnd) * 10_000;
  const A = 7000;  
  const imbalance = getPoolImbalance(rnd); 

  let reserve1; 
  let reserve0;

  if(reserve === 0){
    reserve1 = getPoolReserve(rnd);
    reserve0 = reserve1 * price * imbalance; 
  }
  else{
    reserve0 = reserve;
    reserve1 = Math.round(reserve / price);
  }
 
  const deployData = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint256", "uint256"],
    [t0.address, t1.address, fee, A]);

  const hybridPool: Contract = await deploymentContracts.hybridPoolFactory.attach(
    (
      await (await deploymentContracts.masterDeployerContract.deployPool(deploymentContracts.hybridPoolContract.address, deployData)).wait()
    ).events[0].args[1]
  );

    await deploymentContracts.bentoContract.transfer(t0.address, deploymentContracts.account.address, hybridPool.address, getBigNumber(reserve0));
    await deploymentContracts.bentoContract.transfer(t1.address, deploymentContracts.account.address, hybridPool.address, getBigNumber(reserve1));

    await hybridPool.mint(ethers.utils.defaultAbiCoder.encode(["address"], [deploymentContracts.account.address]));

  return new HybridRPool(
    hybridPool.address,
    t0,
    t1,
    fee / 10_000,
    A,
    getBigNumber(reserve0),
    getBigNumber(reserve1),
  )
}

function getPoolFee(rnd: () => number) {
  const fees = [0.003, 0.001, 0.0005]
  const cmd = choice(rnd, {
    0: 1,
    1: 1,
    2: 1
  })
  return fees[parseInt(cmd)]
}

function getPoolImbalance(rnd: () => number) {
  return getRandom(rnd, MIN_POOL_IMBALANCE, MAX_POOL_IMBALANCE)
}

function getPoolReserve(rnd: () => number) {
  return getRandom(rnd, MIN_POOL_RESERVE, MAX_POOL_RESERVE)
}