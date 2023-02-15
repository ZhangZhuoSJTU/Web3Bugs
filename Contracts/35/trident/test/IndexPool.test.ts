//@ts-nocheck

import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { Contract, ContractFactory } from "ethers";
import { expect } from "chai";
import { getBigNumber } from "@sushiswap/sdk";

// ------------- PARAMETERS -------------

// alice's usdt/usdc balance
const aliceUSDTBalance: BigNumber = getBigNumber("100000000000000000");
const aliceUSDCBalance: BigNumber = getBigNumber("100000000000000000");

// what each ERC20 is deployed with
const ERCDeployAmount: BigNumber = getBigNumber("1000000000000000000");

// what gets minted for alice on the pool
const poolMintAmount: BigNumber = getBigNumber("1", 16);

// token weights passed into the pool
const tokenWeights: BigNumber[] = [getBigNumber("10"), getBigNumber("10")];

// pool swap fee
const poolSwapFee: number | BigNumber = getBigNumber("1", 13);

// -------------         -------------

function encodeSwapData(tokenIn: string, tokenOut: string, recipient: string, unwrapBento: boolean, amountIn: BigNumber | number): string {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "address", "bool", "uint256"],
    [tokenIn, tokenOut, recipient, unwrapBento, amountIn]
  );
}

describe("IndexPool test", function () {
  let alice: SignerWithAddress,
    feeTo: SignerWithAddress,
    usdt: Contract,
    usdc: Contract,
    weth: Contract,
    bento: Contract,
    masterDeployer: Contract,
    tridentPoolFactory: Contract,
    router: Contract,
    Pool: ContractFactory;

  async function deployPool(): Promise<Contract> {
    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const Bento = await ethers.getContractFactory("BentoBoxV1");
    const Deployer = await ethers.getContractFactory("MasterDeployer");
    const PoolFactory = await ethers.getContractFactory("IndexPoolFactory");
    const SwapRouter = await ethers.getContractFactory("TridentRouter");
    Pool = await ethers.getContractFactory("IndexPool");
    [alice, feeTo] = await ethers.getSigners();
    // deploy erc20's
    weth = await ERC20.deploy("WETH", "WETH", ERCDeployAmount);
    await weth.deployed();
    usdt = await ERC20.deploy("USDT", "USDT", ERCDeployAmount);
    await usdt.deployed();
    usdc = await ERC20.deploy("USDC", "USDC", ERCDeployAmount);
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
    await usdc.approve(bento.address, ERCDeployAmount);
    await usdt.approve(bento.address, ERCDeployAmount);
    // Make BentoBox token deposits
    await bento.deposit(usdc.address, alice.address, alice.address, ERCDeployAmount, 0);
    await bento.deposit(usdt.address, alice.address, alice.address, ERCDeployAmount, 0);
    // Approve Router to spend 'alice' BentoBox tokens
    await bento.setMasterContractApproval(
      alice.address,
      router.address,
      true,
      "0",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    const tokens: string[] =
      usdt.address.toUpperCase() < usdc.address.toUpperCase() ? [usdt.address, usdc.address] : [usdc.address, usdt.address];

    // address[], uint256[], uint256
    const deployData = ethers.utils.defaultAbiCoder.encode(["address[]", "uint256[]", "uint256"], [tokens, tokenWeights, poolSwapFee]);

    let tx = await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData)).wait();
    const pool: Contract = await Pool.attach(tx.events[1].args.pool);

    await bento.transfer(usdt.address, alice.address, pool.address, aliceUSDTBalance);
    await bento.transfer(usdc.address, alice.address, pool.address, aliceUSDCBalance);

    await pool.mint(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [alice.address, poolMintAmount]));

    return pool;
  }

  it.skip("pool balance should be equal to transferred value", async function () {
    const pool: Contract = await deployPool();

    interface PoolInfo {
      type: string;
      reserve0: BigNumber;
      reserve1: BigNumber;
      fee: number;
    }

    const poolInfo: PoolInfo = {
      type: "Weighted",
      reserve0: aliceUSDTBalance,
      reserve1: aliceUSDCBalance,
      fee: poolSwapFee,
    };

    const transferredToPoolLiquidity = poolMintAmount;
    const poolUSDTBalance = (await pool.records(usdt.address)).balance;
    const poolUSDCBalance = (await pool.records(usdc.address)).balance;

    expect(transferredToPoolLiquidity.eq(poolUSDTBalance)).to.be.true;
    expect(transferredToPoolLiquidity.eq(poolUSDCBalance)).to.be.true;

    // let tx = await pool
    //   .connect(alice)
    //   .swap(
    //     encodeSwapData(usdt.address, usdc.address, alice.address, false, 1)
    //   );

    // const out = calcOutByIn(poolInfo, 1, false);
    // console.log(out);
    // await expect(tx).to.eventually.be.rejectedWith(
    //   "VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"
    // );
  });
});
