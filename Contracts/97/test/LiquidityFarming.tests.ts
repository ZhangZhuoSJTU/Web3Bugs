import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  ERC20Token,
  LiquidityPool,
  LiquidityProvidersTest,
  WhitelistPeriodManager,
  LPToken,
  ExecutorManager,
  TokenManager,
  HyphenLiquidityFarming,
  // eslint-disable-next-line node/no-missing-import
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signer } from "ethers";

import { getLocaleString } from "./utils";

const advanceTime = async (secondsToAdvance: number) => {
  await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
  await ethers.provider.send("evm_mine", []);
};

const getElapsedTime = async (callable: any): Promise<number> => {
  const { timestamp: start } = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  await callable();
  const { timestamp: end } = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  return end - start;
};

describe("LiquidityFarmingTests", function () {
  let owner: SignerWithAddress, pauser: SignerWithAddress, bob: SignerWithAddress;
  let charlie: SignerWithAddress, tf: SignerWithAddress, executor: SignerWithAddress;
  let token: ERC20Token, token2: ERC20Token;
  let lpToken: LPToken;
  let wlpm: WhitelistPeriodManager;
  let liquidityProviders: LiquidityProvidersTest;
  let liquidityPool: LiquidityPool;
  let executorManager: ExecutorManager;
  let tokenManager: TokenManager;
  let farmingContract: HyphenLiquidityFarming;
  let trustedForwarder = "0xFD4973FeB2031D4409fB57afEE5dF2051b171104";
  const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  let BASE: BigNumber = BigNumber.from(10).pow(18);

  const perWalletMaxCap = 70;
  const tokenMaxCap = 70;

  const perWalletNativeMaxCap = getLocaleString(1 * 1e18);
  const tokenNativeMaxCap = getLocaleString(200 * 1e18);

  beforeEach(async function () {
    [owner, pauser, charlie, bob, tf, , executor] = await ethers.getSigners();

    const tokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = (await tokenManagerFactory.deploy(tf.address)) as TokenManager;

    const erc20factory = await ethers.getContractFactory("ERC20Token");
    token = (await upgrades.deployProxy(erc20factory, ["USDT", "USDT"])) as ERC20Token;
    token2 = (await upgrades.deployProxy(erc20factory, ["USDC", "USDC"])) as ERC20Token;
    for (const signer of [owner, bob, charlie]) {
      await token.mint(signer.address, ethers.BigNumber.from(100000000).mul(ethers.BigNumber.from(10).pow(18)));
      await token2.mint(signer.address, ethers.BigNumber.from(100000000).mul(ethers.BigNumber.from(10).pow(18)));
    }
    await tokenManager.addSupportedToken(token.address, BigNumber.from(1), BigNumber.from(10).pow(30), 0, 0);
    await tokenManager.addSupportedToken(token2.address, BigNumber.from(1), BigNumber.from(10).pow(30), 0, 0);
    await tokenManager.addSupportedToken(NATIVE, BigNumber.from(1), BigNumber.from(10).pow(30), 0, 0);

    const executorManagerFactory = await ethers.getContractFactory("ExecutorManager");
    executorManager = (await executorManagerFactory.deploy()) as ExecutorManager;

    const lpTokenFactory = await ethers.getContractFactory("LPToken");
    lpToken = (await upgrades.deployProxy(lpTokenFactory, [
      "LPToken",
      "LPToken",
      tf.address,
      pauser.address,
    ])) as LPToken;

    const liquidtyProvidersFactory = await ethers.getContractFactory("LiquidityProvidersTest");
    liquidityProviders = (await upgrades.deployProxy(liquidtyProvidersFactory, [
      trustedForwarder,
      lpToken.address,
      tokenManager.address,
      pauser.address,
    ])) as LiquidityProvidersTest;
    await liquidityProviders.deployed();
    await lpToken.setLiquidityProviders(liquidityProviders.address);
    await liquidityProviders.setLpToken(lpToken.address);

    const wlpmFactory = await ethers.getContractFactory("WhitelistPeriodManager");
    wlpm = (await upgrades.deployProxy(wlpmFactory, [
      tf.address,
      liquidityProviders.address,
      tokenManager.address,
      lpToken.address,
      pauser.address,
    ])) as WhitelistPeriodManager;
    await wlpm.setLiquidityProviders(liquidityProviders.address);
    await liquidityProviders.setWhiteListPeriodManager(wlpm.address);
    await lpToken.setWhiteListPeriodManager(wlpm.address);
    await wlpm.setCaps(
      [token.address, token2.address, NATIVE],
      [tokenMaxCap, tokenMaxCap, tokenNativeMaxCap],
      [perWalletMaxCap, perWalletMaxCap, perWalletNativeMaxCap]
    );
    await wlpm.setAreWhiteListRestrictionsEnabled(true);

    const lpFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = (await upgrades.deployProxy(lpFactory, [
      executorManager.address,
      pauser.address,
      tf.address,
      tokenManager.address,
      liquidityProviders.address,
    ])) as LiquidityPool;
    await liquidityProviders.setLiquidityPool(liquidityPool.address);

    const farmingFactory = await ethers.getContractFactory("HyphenLiquidityFarming");
    farmingContract = (await upgrades.deployProxy(farmingFactory, [
      tf.address,
      pauser.address,
      liquidityProviders.address,
      lpToken.address,
    ])) as HyphenLiquidityFarming;
    await wlpm.setIsExcludedAddressStatus([farmingContract.address], [true]);
  });

  it("Should be able to create reward pools", async function () {
    for (const signer of [owner, bob, charlie]) {
      await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
      for (const tk of [token, token2]) {
        await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
      }
    }

    await expect(farmingContract.initalizeRewardPool(token.address, token2.address, 10))
      .to.emit(farmingContract, "LogRewardPoolInitialized")
      .withArgs(token.address, token2.address, 10);
  });

  describe("Deposit", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, token2.address, 10);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }

      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
    });

    it("Should be able to deposit lp tokens", async function () {
      await farmingContract.deposit(1, owner.address);
      expect(await farmingContract.pendingToken(token.address)).to.equal(0);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([1].map(BigNumber.from));
    });

    it("Should be able to deposit lp tokens on behalf of another account", async function () {
      await farmingContract.deposit(1, bob.address);
      expect(await farmingContract.pendingToken(1)).to.equal(0);
      expect(await farmingContract.getNftIdsStaked(bob.address)).to.deep.equal([1].map(BigNumber.from));
      expect((await farmingContract.getNftIdsStaked(owner.address)).length).to.equal(0);
    });

    it("Should not be able to deposit LP token of un-initialized pools", async function () {
      await expect(farmingContract.deposit(2, owner.address)).to.be.revertedWith("ERR__POOL_NOT_INITIALIZED");
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([]);
    });

    it("Should be able to accrue token rewards", async function () {
      await farmingContract.deposit(1, owner.address);
      const time = await getElapsedTime(async () => {
        await advanceTime(100);
      });
      expect(await farmingContract.pendingToken(1)).to.equal(time * 10);
    });

    it("Should be able to create deposits in different tokens", async function () {
      await farmingContract.initalizeRewardPool(token2.address, token.address, 10);
      await farmingContract.deposit(1, owner.address);
      const time = await getElapsedTime(async () => {
        await advanceTime(100);
        await farmingContract.deposit(2, owner.address);
        await advanceTime(100);
      });
      expect(await farmingContract.pendingToken(1)).to.equal(time * 10);
      expect(await farmingContract.pendingToken(2)).to.equal(1000);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([1, 2].map(BigNumber.from));
    });
  });

  describe("Withdraw", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, token2.address, 10);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }

      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
    });

    it("Should be able to withdraw nft", async function () {
      await farmingContract.deposit(1, owner.address);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([1].map(BigNumber.from));
      await expect(farmingContract.withdraw(1, owner.address)).to.emit(farmingContract, "LogWithdraw");
      expect(await lpToken.ownerOf(1)).to.equal(owner.address);
    });

    it("Should prevent non owner from withdrawing nft", async function () {
      await farmingContract.deposit(1, bob.address);
      await expect(farmingContract.connect(owner).withdraw(1, owner.address)).to.be.revertedWith("ERR__NFT_NOT_STAKED");
      await expect(farmingContract.connect(bob).withdraw(2, bob.address)).to.be.revertedWith("ERR__NFT_NOT_STAKED");
    });
  });

  describe("Rewards", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, token2.address, 10);
      await farmingContract.initalizeRewardPool(token2.address, token.address, 15);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }
    });

    it("Should prevent others from claiming rewards", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      expect((await farmingContract.pendingToken(1)).toNumber()).to.be.greaterThan(0);
      await expect(farmingContract.connect(bob).extractRewards(1, bob.address)).to.be.revertedWith("ERR__NOT_OWNER");
    });

    it("Should be able to calculate correct rewards correctly", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 30);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 30);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      expect(await farmingContract.pendingToken(1)).to.equal(
        Math.floor(10 * (100 + time1 + 300 + time2 + 500 / 4 + time3 / 4 + 900 / 4))
      );
      expect(await farmingContract.pendingToken(2)).to.equal(Math.floor(15 * (300 + time2 + 500 + time3 + 900 / 4)));
      expect(await farmingContract.pendingToken(3)).to.equal(
        Math.floor(10 * ((500 * 3) / 4 + (time3 * 3) / 4 + (900 * 3) / 4))
      );
      expect(await farmingContract.pendingToken(4)).to.equal(Math.floor(15 * ((900 * 3) / 4)));
    });

    it("Should be able to calculate correct rewards correctly - 2", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 20);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 20);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      expect(await farmingContract.pendingToken(1)).to.equal(
        Math.floor(100 * 10 + time1 * 10 + 300 * 10 + time2 * 10 + (500 * 10) / 3 + (time3 * 10) / 3 + (900 * 10) / 3)
      );
      expect(await farmingContract.pendingToken(2)).to.equal(Math.floor(15 * (300 + time2 + 500 + time3 + 900 / 3)));
      expect(await farmingContract.pendingToken(3)).to.equal(
        Math.floor((500 * 2 * 10) / 3 + (time3 * 2 * 10) / 3 + (900 * 2 * 10) / 3)
      );
      expect(await farmingContract.pendingToken(4)).to.equal(Math.floor(15 * ((900 * 2) / 3)));
    });

    it("Should be able to calculate correct rewards correctly - 3", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      expect(await farmingContract.pendingToken(1)).to.equal(
        Math.floor(100 * 10 + time1 * 10 + 300 * 10 + time2 * 10 + (500 * 10) / 7 + (time3 * 10) / 7 + (900 * 10) / 7)
      );
      expect(await farmingContract.pendingToken(2)).to.equal(Math.floor(15 * (300 + time2 + 500 + time3 + 900 / 7)));
      expect(await farmingContract.pendingToken(3)).to.equal(
        Math.floor((500 * 6 * 10) / 7 + (time3 * 6 * 10) / 7 + (900 * 6 * 10) / 7)
      );
      expect(await farmingContract.pendingToken(4)).to.equal(Math.floor(15 * ((900 * 6) / 7)));
    });

    it("Should be able to send correct amount of rewards", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      const expectedRewards = [
        Math.floor(
          100 * 10 +
            time1 * 10 +
            300 * 10 +
            time2 * 10 +
            (500 * 10) / 7 +
            (time3 * 10) / 7 +
            (900 * 10) / 7 +
            (3 * 10) / 7
        ),
        Math.floor(15 * (300 + time2 + 500 + time3 + 900 / 7) + (4 * 15) / 7),
        Math.floor((500 * 6 * 10) / 7 + (time3 * 6 * 10) / 7 + (900 * 6 * 10) / 7 + (5 * 6 * 10) / 7),
        Math.floor(15 * ((900 * 6) / 7) + (6 * 15 * 6) / 7),
      ];

      await token.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));
      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await expect(() => farmingContract.extractRewards(1, owner.address)).to.changeTokenBalances(
        token2,
        [farmingContract, owner],
        [-expectedRewards[0], expectedRewards[0]]
      );
      await expect(() => farmingContract.extractRewards(2, owner.address)).to.changeTokenBalances(
        token,
        [farmingContract, owner],
        [-expectedRewards[1], expectedRewards[1]]
      );
      await expect(() => farmingContract.connect(bob).extractRewards(3, bob.address)).to.changeTokenBalances(
        token2,
        [farmingContract, bob],
        [-expectedRewards[2], expectedRewards[2]]
      );
      await expect(() => farmingContract.connect(bob).extractRewards(4, bob.address)).to.changeTokenBalances(
        token,
        [farmingContract, bob],
        [-expectedRewards[3], expectedRewards[3]]
      );

      expect((await farmingContract.pendingToken(1)).toNumber()).to.greaterThan(0);
      expect((await farmingContract.pendingToken(2)).toNumber()).to.greaterThan(0);
      expect((await farmingContract.pendingToken(3)).toNumber()).to.greaterThan(0);
      expect((await farmingContract.pendingToken(4)).toNumber()).to.equal(0);

      expect((await farmingContract.nftInfo(1)).isStaked).to.be.true;
      expect((await farmingContract.nftInfo(2)).isStaked).to.be.true;
      expect((await farmingContract.nftInfo(3)).isStaked).to.be.true;
      expect((await farmingContract.nftInfo(4)).isStaked).to.be.true;
    });

    it("Extraction of Rewards on 1 token should not affect the other", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token.address, 10);

      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await farmingContract.deposit(2, owner.address);
      await advanceTime(100);
      await farmingContract.withdraw(2, owner.address);

      expect(await farmingContract.pendingToken(1)).to.equal(
        Math.floor(100 * 10 + 1 * 10 + (100 * 10) / 2 + (1 * 10) / 2)
      );
      expect((await farmingContract.nftInfo(1)).isStaked).to.be.true;
    });

    it("Should be able to send correct amount of rewards to delegatee while withdrawing lp token immediately if available", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token.address, 10);

      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await expect(() => farmingContract.withdraw(1, bob.address)).to.changeTokenBalances(
        token2,
        [farmingContract, bob],
        [-1010, 1010]
      );
    });

    it("Should be able to send correct amount of rewards while withdrawing", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = 1;
      await farmingContract.deposit(2, owner.address);
      await advanceTime(300);
      const time2 = 1;
      await farmingContract.connect(bob).deposit(3, bob.address);

      await advanceTime(500);
      const time3 = 1;
      await farmingContract.connect(bob).deposit(4, bob.address);
      await advanceTime(900);

      const expectedRewards = [
        Math.floor(
          100 * 10 +
            time1 * 10 +
            300 * 10 +
            time2 * 10 +
            (500 * 10) / 7 +
            (time3 * 10) / 7 +
            (900 * 10) / 7 +
            (3 * 10) / 7
        ),
        Math.floor(15 * (300 + time2 + 500 + time3 + 900 / 7) + (4 * 15) / 7),
        Math.floor((500 * 6 * 10 + time3 * 6 * 10 + 900 * 6 * 10 + 3 * 6 * 10 + 2 * 7 * 10) / 7),
        Math.floor(15 * ((900 * 6) / 7) + (4 * 15 * 6) / 7 + 2 * 15),
      ];

      await token.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));
      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await expect(() => farmingContract.withdraw(1, owner.address)).to.changeTokenBalances(
        token2,
        [farmingContract, owner],
        [-expectedRewards[0], expectedRewards[0]]
      );
      await expect(() => farmingContract.withdraw(2, owner.address)).to.changeTokenBalances(
        token,
        [farmingContract, owner],
        [-expectedRewards[1], expectedRewards[1]]
      );
      await expect(() => farmingContract.connect(bob).withdraw(3, bob.address)).to.changeTokenBalances(
        token2,
        [farmingContract, bob],
        [-expectedRewards[2], expectedRewards[2]]
      );
      await expect(() => farmingContract.connect(bob).withdraw(4, bob.address)).to.changeTokenBalances(
        token,
        [farmingContract, bob],
        [-expectedRewards[3], expectedRewards[3]]
      );

      expect(await lpToken.ownerOf(1)).to.equal(owner.address);
      expect(await lpToken.ownerOf(2)).to.equal(owner.address);
      expect(await lpToken.ownerOf(3)).to.equal(bob.address);
      expect(await lpToken.ownerOf(4)).to.equal(bob.address);

      expect(await farmingContract.pendingToken(1)).to.equal(0);
      expect(await farmingContract.pendingToken(2)).to.equal(0);
      expect(await farmingContract.pendingToken(3)).to.equal(0);
      expect(await farmingContract.pendingToken(4)).to.equal(0);

      expect((await farmingContract.nftInfo(1)).isStaked).to.be.false;
      expect((await farmingContract.nftInfo(2)).isStaked).to.be.false;
      expect((await farmingContract.nftInfo(3)).isStaked).to.be.false;
      expect((await farmingContract.nftInfo(4)).isStaked).to.be.false;
    });

    it("Should be able to send correct amount of rewards while withdrawing lp token immediately if available", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);

      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await expect(() => farmingContract.withdraw(1, owner.address)).to.changeTokenBalances(
        token2,
        [farmingContract, owner],
        [-1010, 1010]
      );
    });

    it("Should be able to send correct amount to delegatee of rewards while withdrawing lp token immediately if available", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);

      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await expect(() => farmingContract.withdraw(1, bob.address)).to.changeTokenBalances(
        token2,
        [farmingContract, bob],
        [-1010, 1010]
      );

      expect(await lpToken.ownerOf(1)).to.equal(owner.address);
    });
  });

  describe("Rewards - NATIVE", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, NATIVE, 10);
      await farmingContract.initalizeRewardPool(token2.address, NATIVE, 15);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }
    });

    it("Should be able to send correct amount of rewards", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await farmingContract.deposit(2, owner.address);
      await advanceTime(300);
      await farmingContract.connect(bob).deposit(3, bob.address);
      await advanceTime(500);
      await farmingContract.connect(bob).deposit(4, bob.address);
      await advanceTime(900);

      const expectedRewards = [
        Math.floor(
          100 * 10 + 1 * 10 + 300 * 10 + 1 * 10 + (500 * 10) / 7 + (1 * 10) / 7 + (900 * 10) / 7 + (2 * 10) / 7
        ),
        Math.floor(15 * (300 + 1 + 500 + 1 + (900 + 3) / 7)),
        Math.floor((500 * 6 * 10 + 1 * 6 * 10 + 900 * 6 * 10 + 2 * 6 * 10 + 2 * 7 * 10) / 7),
        Math.floor(15 * ((900 * 6) / 7) + (3 * 15 * 6) / 7 + 2 * 15),
      ];

      await owner.sendTransaction({
        to: farmingContract.address,
        value: ethers.BigNumber.from(10).pow(18),
      });

      await expect(() => farmingContract.withdraw(1, owner.address)).to.changeEtherBalances(
        [farmingContract, owner],
        [-expectedRewards[0], expectedRewards[0]]
      );
      await expect(() => farmingContract.withdraw(2, owner.address)).to.changeEtherBalances(
        [farmingContract, owner],
        [-expectedRewards[1], expectedRewards[1]]
      );
      await expect(() => farmingContract.connect(bob).withdraw(3, bob.address)).to.changeEtherBalances(
        [farmingContract, bob],
        [-expectedRewards[2], expectedRewards[2]]
      );
      await expect(() => farmingContract.connect(bob).withdraw(4, bob.address)).to.changeEtherBalances(
        [farmingContract, bob],
        [-expectedRewards[3], expectedRewards[3]]
      );
    });
  });

  describe("Reward Rate updation", async () => {
    beforeEach(async () => {
      await farmingContract.initalizeRewardPool(token.address, NATIVE, 10);
      await farmingContract.initalizeRewardPool(token2.address, NATIVE, 15);

      for (const signer of [owner, bob, charlie]) {
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }
    });

    it("Should not invalidate pending rewards on reward rate updation", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 10);
      await liquidityProviders.connect(charlie).addTokenLiquidity(token.address, 20);

      await lpToken.approve(farmingContract.address, 1);
      await lpToken.connect(bob).approve(farmingContract.address, 2);
      await lpToken.connect(charlie).approve(farmingContract.address, 3);

      let rewardOwner = 0,
        rewardBob = 0,
        rewardCharlie = 0;

      await owner.sendTransaction({ to: farmingContract.address, value: ethers.BigNumber.from(10).pow(18) });

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 10 * 100));
      await farmingContract.setRewardPerSecond(token.address, 20);
      await advanceTime(100);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 10 * 1 + 20 * 100));
      await farmingContract.setRewardPerSecond(token.address, 16);
      await advanceTime(100);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 20 * 1 + 16 * 100));

      await farmingContract.connect(bob).deposit(2, bob.address);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 16));
      expect(await farmingContract.pendingToken(2)).to.equal(rewardBob);
      await advanceTime(150);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += (16 * 150) / 2));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += (16 * 150) / 2));
      await farmingContract.setRewardPerSecond(token.address, 0);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 16 / 2));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += 16 / 2));
      await advanceTime(1000);
      expect(await farmingContract.pendingToken(1)).to.equal(rewardOwner);
      expect(await farmingContract.pendingToken(2)).to.equal(rewardBob);
      await farmingContract.setRewardPerSecond(token.address, 100);
      expect(await farmingContract.pendingToken(1)).to.equal(rewardOwner);
      expect(await farmingContract.pendingToken(2)).to.equal(rewardBob);
      await advanceTime(500);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += (100 * 500) / 2));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += (100 * 500) / 2));

      await farmingContract.connect(charlie).deposit(3, charlie.address);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 100 / 2));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += 100 / 2));
      expect(await farmingContract.pendingToken(3)).to.equal(rewardCharlie);
      await advanceTime(500);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += (100 * 500) / 4));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += (100 * 500) / 4));
      expect(await farmingContract.pendingToken(3)).to.equal((rewardCharlie += (100 * 500) / 2));
      await farmingContract.setRewardPerSecond(token.address, 600);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += 100 / 4));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += 100 / 4));
      expect(await farmingContract.pendingToken(3)).to.equal((rewardCharlie += 100 / 2));
      await advanceTime(600);
      expect(await farmingContract.pendingToken(1)).to.equal((rewardOwner += (600 * 600) / 4));
      expect(await farmingContract.pendingToken(2)).to.equal((rewardBob += (600 * 600) / 4));
      expect(await farmingContract.pendingToken(3)).to.equal((rewardCharlie += (600 * 600) / 2));

      await expect(() => farmingContract.extractRewards(1, owner.address)).to.changeEtherBalances(
        [farmingContract, owner],
        [-(rewardOwner + 600 / 4), rewardOwner + 600 / 4]
      );
      rewardOwner = 0;
      rewardBob += 600 / 4;
      rewardCharlie += 600 / 2;
      await expect(() => farmingContract.connect(bob).withdraw(2, bob.address)).to.changeEtherBalances(
        [farmingContract, bob],
        [-(rewardBob + 600 / 4), rewardBob + 600 / 4]
      );
      rewardOwner += 600 / 4;
      rewardCharlie += (600 * 2) / 4;
      await expect(() => farmingContract.connect(charlie).withdraw(3, charlie.address)).to.changeEtherBalances(
        [farmingContract, charlie],
        [-(rewardCharlie + (600 * 2) / 3), rewardCharlie + (600 * 2) / 3]
      );
      rewardOwner += 600 / 3;
      await expect(() => farmingContract.extractRewards(1, owner.address)).to.changeEtherBalances(
        [farmingContract, owner],
        [-(rewardOwner + 600), rewardOwner + 600]
      );
    });
  });
});
