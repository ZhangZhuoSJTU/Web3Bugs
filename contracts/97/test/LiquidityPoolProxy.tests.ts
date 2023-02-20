import { expect, use } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  ERC20Token,
  LiquidityPool,
  LiquidityPoolProxy,
  ExecutorManager,
  LPToken
  // eslint-disable-next-line node/no-missing-import
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("LiquidityPoolProxyTests", function () {
  let alice: SignerWithAddress, pauser: SignerWithAddress, bob: SignerWithAddress, charlie: SignerWithAddress, tf: SignerWithAddress;
  let proxyAdmin: SignerWithAddress;
  let tokenManager: SignerWithAddress, liquidityProviders: SignerWithAddress;
  let executorManager: ExecutorManager;
  let token: ERC20Token, liquidityPool: LiquidityPool, liquidityPoolImpl: LiquidityPool, liquidityPoolProxy: LiquidityPoolProxy;
  let trustedForwarder = "0xFD4973FeB2031D4409fB57afEE5dF2051b171104";
  let lpToken: LPToken;

  before(async function () {
    [alice, pauser, bob, charlie, tf, proxyAdmin, tokenManager, liquidityProviders] = await ethers.getSigners();

    const lpTokenFactory = await ethers.getContractFactory("LPToken");
    lpToken = (await upgrades.deployProxy(lpTokenFactory, ["Hyphen LP Token","HPT",trustedForwarder,pauser.address])) as LPToken;
    
    const executorManagerFactory = await ethers.getContractFactory("ExecutorManager");
    executorManager = await executorManagerFactory.deploy();
    await executorManager.deployed();

    const liquidtyPoolFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPoolImpl = await liquidtyPoolFactory.deploy();
    await liquidityPoolImpl.deployed();

    const liquidityPoolProxyFactory = await ethers.getContractFactory("LiquidityPoolProxy");
    liquidityPoolProxy = await liquidityPoolProxyFactory.deploy(liquidityPoolImpl.address, proxyAdmin.address);

    liquidityPool = await ethers.getContractAt("contracts/hyphen/LiquidityPool.sol:LiquidityPool", 
      liquidityPoolProxy.address) as LiquidityPool;

    await liquidityPool.initialize(executorManager.address, await pauser.getAddress(), 
    trustedForwarder, tokenManager.address, liquidityProviders.address);
    
  });

  async function checkStorage() {
    let isTrustedForwarderSet = await liquidityPool.isTrustedForwarder(trustedForwarder);
    let _executorManager = await liquidityPool.getExecutorManager();
    expect(isTrustedForwarderSet).to.equal(true);
    expect(_executorManager).to.equal(executorManager.address);
    expect(await liquidityPool.isPauser(await pauser.getAddress())).to.equals(true);
  }

  it("Liquidity Pool Should be initialized properly", async function () {
    checkStorage();
  });

  it("Liquidity Pool Should not be initialised twice", async function () {
    await expect(
      liquidityPool.initialize(executorManager.address, await pauser.getAddress(), trustedForwarder, 
        tokenManager.address, liquidityProviders.address)
    ).to.be.reverted;
  });

  it("Should be able to upgrade implementation without affecting existing storage", async function () {
    const liquidtyPoolFactory = await ethers.getContractFactory("LiquidityPool");
    let liquidityPoolImplV2 = await liquidtyPoolFactory.deploy();
    await liquidityPoolImplV2.deployed();
    await liquidityPoolProxy.connect(proxyAdmin).upgradeTo(liquidityPoolImplV2.address);
    checkStorage();
  });
});
