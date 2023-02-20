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
  // eslint-disable-next-line node/no-missing-import
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ContractTransaction } from "ethers";

let { getLocaleString } = require("./utils");

describe("LiquidityProviderTests", function () {
  interface TransactionCall {
    (): Promise<void>;
  }

  interface NftMetadata {
    token: string;
    suppliedLiquidity: BigNumber | number;
    shares: BigNumber | number;
  }

  let owner: SignerWithAddress, pauser: SignerWithAddress, bob: SignerWithAddress;
  let charlie: SignerWithAddress, tf: SignerWithAddress, executor: SignerWithAddress;
  let token: ERC20Token, token2: ERC20Token;
  let lpToken: LPToken;
  let wlpm: WhitelistPeriodManager;
  let liquidityProviders: LiquidityProvidersTest;
  let liquidityPool: LiquidityPool;
  let executorManager: ExecutorManager;
  let tokenManager: TokenManager;
  let trustedForwarder = "0xFD4973FeB2031D4409fB57afEE5dF2051b171104";
  const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  let tag: string = "HyphenUI";
  let equilibriumFee = 10000000;
  let maxFee = 200000000;
  const minTokenCap = getLocaleString(1 * 1e18);
  const maxTokenCap = getLocaleString(100000000 * 1e18);
  const dummyDepositHash = "0xf408509b00caba5d37325ab33a92f6185c9b5f007a965dfbeff7b81ab1ec871a";

  let BASE: BigNumber = BigNumber.from(10).pow(18);

  const perWalletMaxCap = getLocaleString(1000 * 1e18);
  const tokenMaxCap = getLocaleString(1000000 * 1e18);

  const perWalletNativeMaxCap = getLocaleString(1 * 1e18);
  const tokenNativeMaxCap = getLocaleString(200 * 1e18);

  const expectLpTokenMintedWithMetadata = async (
    call: TransactionCall,
    account: SignerWithAddress,
    expectedTokenId: number,
    newMetadata: NftMetadata
  ) => {
    expect(await lpToken.exists(expectedTokenId)).to.be.false;
    const balanceBefore = await lpToken.balanceOf(account.address);
    await call();
    const balanceAfter = await lpToken.balanceOf(account.address);
    const actualChange = balanceAfter.sub(balanceBefore);
    expect(actualChange).to.equal(1);
    expect(await lpToken.ownerOf(expectedTokenId)).to.equal(account.address);
    const metadata = await lpToken.tokenMetadata(expectedTokenId);
    expect(metadata.token).to.equal(newMetadata.token);
    expect(metadata.suppliedLiquidity).to.equal(newMetadata.suppliedLiquidity);
    expect(metadata.shares).to.equal(newMetadata.shares);
  };

  const expectLpShareAndSlChangeToNftId = async (
    call: TransactionCall,
    account: SignerWithAddress,
    tokenId: number,
    lpShareDelta: string,
    totalSlDelta: string
  ) => {
    const metadataBefore = await lpToken.tokenMetadata(tokenId);
    const balanceBefore = await lpToken.balanceOf(account.address);
    await call();
    const balanceAfter = await lpToken.balanceOf(account.address);
    const actualChange = balanceAfter.sub(balanceBefore);
    expect(actualChange).to.equal(0);

    expect(await lpToken.exists(tokenId)).to.be.true;
    expect(await lpToken.ownerOf(tokenId)).to.equal(account.address);
    const newMetadata = await lpToken.tokenMetadata(tokenId);
    expect(metadataBefore.token).to.equal(newMetadata.token);
    expect(newMetadata.suppliedLiquidity.sub(metadataBefore.suppliedLiquidity)).to.equal(totalSlDelta);
    expect(newMetadata.shares.sub(metadataBefore.shares)).to.equal(lpShareDelta);
  };

  async function depositERC20Token(tokenAddress: string, tokenValue: string, receiver: string, toChainId: number) {
    await token.approve(liquidityPool.address, tokenValue);
    return await liquidityPool.connect(owner).depositErc20(
      toChainId,
      tokenAddress,
      receiver,
      tokenValue,
      tag
    );
  }

  async function sendFundsToUser(tokenAddress: string, amount: string, receiver: string, tokenGasPrice: string) {
    return await liquidityPool.connect(executor).sendFundsToUser(
        tokenAddress,
        amount,
        receiver,
        dummyDepositHash,
        tokenGasPrice,
        137
    );
}

  beforeEach(async function () {
    [owner, pauser, charlie, bob, tf, , executor] = await ethers.getSigners();

    const tokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = await tokenManagerFactory.deploy(tf.address);

    const erc20factory = await ethers.getContractFactory("ERC20Token");
    token = (await upgrades.deployProxy(erc20factory, ["USDT", "USDT"])) as ERC20Token;
    token2 = (await upgrades.deployProxy(erc20factory, ["USDC", "USDC"])) as ERC20Token;
    for (const signer of [owner, bob, charlie]) {
      await token.mint(signer.address, ethers.BigNumber.from(100000000).mul(ethers.BigNumber.from(10).pow(18)));
      await token2.mint(signer.address, ethers.BigNumber.from(100000000).mul(ethers.BigNumber.from(10).pow(18)));
    }
    await tokenManager.addSupportedToken(token.address, BigNumber.from(1), BigNumber.from(10).pow(30), equilibriumFee, maxFee);
    await tokenManager.addSupportedToken(token2.address, BigNumber.from(1), BigNumber.from(10).pow(30), equilibriumFee, maxFee);
    await tokenManager.addSupportedToken(NATIVE, BigNumber.from(1), BigNumber.from(10).pow(30), equilibriumFee, maxFee);


    let tokenDepositConfig = {
      min: minTokenCap,
      max: maxTokenCap
  }
  await tokenManager.connect(owner).setDepositConfig(
      [1],
      [token.address],
      [tokenDepositConfig]
  );

    const executorManagerFactory = await ethers.getContractFactory("ExecutorManager");
    executorManager = await executorManagerFactory.deploy();

    await executorManager.addExecutor(executor.address);

    const lpTokenFactory = await ethers.getContractFactory("LPToken");
    lpToken = (await upgrades.deployProxy(lpTokenFactory, ["LPToken", "LPToken", tf.address, pauser.address])) as LPToken;

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
      [token.address, NATIVE],
      [tokenMaxCap, tokenNativeMaxCap],
      [perWalletMaxCap, perWalletNativeMaxCap]
    );
    await wlpm.setAreWhiteListRestrictionsEnabled(false);

    const lpFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = (await upgrades.deployProxy(lpFactory, [
      executorManager.address,
      pauser.address,
      tf.address,
      tokenManager.address,
      liquidityProviders.address,
    ])) as LiquidityPool;
    await liquidityProviders.setLiquidityPool(liquidityPool.address);
  });

  this.afterEach(async function () {
    expect(await token.balanceOf(liquidityProviders.address)).to.equal(0);
    expect(await token2.balanceOf(liquidityProviders.address)).to.equal(0);
    expect(await ethers.provider.getBalance(liquidityProviders.address)).to.equal(0);
  });

  it("Should revert on re-entant calls to token minting", async function () {
    const attacker = await (
      await ethers.getContractFactory("TokenMintingReentrancy")
    ).deploy(liquidityProviders.address);
    await owner.sendTransaction({
      to: attacker.address,
      value: ethers.BigNumber.from(10).pow(20),
    });

    await expect(attacker.attack({ value: ethers.BigNumber.from(10).pow(18) })).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );
  });

  describe("Liquidity Addition", async function () {
    this.beforeEach(async () => {
      for (const tk of [token, token2]) {
        for (const signer of [owner, bob, charlie]) {
          await tk.connect(signer).approve(liquidityProviders.address, await tk.balanceOf(signer.address));
        }
      }
    });

    it("Should return proper share price when reserve is empty", async function () {
      expect(await liquidityProviders.getTokenPriceInLPShares(token.address)).to.equal(BASE);
      expect(await liquidityProviders.getTokenPriceInLPShares(NATIVE)).to.equal(BASE);
    });

    it("Should be able to add token liquidity", async function () {
      await expectLpTokenMintedWithMetadata(
        async () => {
          await expect(async () => liquidityProviders.addTokenLiquidity(token.address, 100)).to.changeTokenBalances(
            token,
            [owner, liquidityPool],
            [-100, 100]
          );
        },
        owner,
        1,
        {
          token: token.address,
          shares: BASE.mul(100),
          suppliedLiquidity: 100,
        }
      );
      await expectLpTokenMintedWithMetadata(
        async () => {
          await expect(
            async () => await liquidityProviders.addTokenLiquidity(token2.address, 200)
          ).to.changeTokenBalances(token2, [owner, liquidityPool], [-200, 200]);
        },
        owner,
        2,
        {
          token: token2.address,
          shares: BASE.mul(200),
          suppliedLiquidity: 200,
        }
      );
      await expectLpTokenMintedWithMetadata(
        async () => {
          await expect(
            async () => await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 200)
          ).to.changeTokenBalances(token2, [bob, liquidityPool], [-200, 200]);
        },
        bob,
        3,
        {
          token: token2.address,
          shares: BASE.mul(200),
          suppliedLiquidity: 200,
        }
      );
      await expectLpTokenMintedWithMetadata(
        async () => {
          await expect(
            async () => await liquidityProviders.connect(charlie).addTokenLiquidity(token2.address, 200)
          ).to.changeTokenBalances(token2, [charlie, liquidityPool], [-200, 200]);
        },
        charlie,
        4,
        {
          token: token2.address,
          shares: BASE.mul(200),
          suppliedLiquidity: 200,
        }
      );
      expect(await lpToken.getAllNftIdsByUser(owner.address)).to.deep.equal([1, 2].map(BigNumber.from));
      expect(await lpToken.getAllNftIdsByUser(bob.address)).to.deep.equal([3].map(BigNumber.from));
      expect(await lpToken.getAllNftIdsByUser(charlie.address)).to.deep.equal([4].map(BigNumber.from));
    });

    it("Should be able to add native liquidity", async function () {
      await expectLpTokenMintedWithMetadata(
        async () => {
          await expect(
            async () => await liquidityProviders.connect(charlie).addNativeLiquidity({ value: 100 })
          ).to.changeEtherBalances([charlie, liquidityPool], [-100, 100]);
        },
        charlie,
        1,
        {
          token: NATIVE,
          shares: BASE.mul(100),
          suppliedLiquidity: 100,
        }
      );
    });

    it("Should not be able to add native liquidity using addTokenLiquidity", async function () {
      await expect(liquidityProviders.addTokenLiquidity(NATIVE, 10)).to.be.revertedWith("ERR__WRONG_FUNCTION");
    });

    it("Added liquidity should be non zero", async function () {
      await expect(liquidityProviders.addTokenLiquidity(token.address, 0)).to.be.revertedWith("ERR__AMOUNT_IS_0");
    });

    it("Should not allow non owners to add liquidity to NFT", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 1000);
      await expect(liquidityProviders.connect(bob).increaseTokenLiquidity(1, 1000)).to.be.revertedWith(
        "ERR__TRANSACTOR_DOES_NOT_OWN_NFT"
      );
      await liquidityProviders.addNativeLiquidity({ value: 1000 });
      await expect(liquidityProviders.connect(bob).increaseNativeLiquidity(2, { value: 1000 })).to.be.revertedWith(
        "ERR__TRANSACTOR_DOES_NOT_OWN_NFT"
      );
    });
  });

  describe("Liquidity Removal", async function () {
    this.beforeEach(async () => {
      for (const tk of [token, token2]) {
        for (const signer of [owner, bob, charlie]) {
          await tk.connect(signer).approve(liquidityProviders.address, await tk.balanceOf(signer.address));
        }
      }
    });

    it("Should be able to remove liquidity just after addition", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, "100000000000000000000");
      await liquidityProviders.connect(charlie).addTokenLiquidity(token.address, "400000000000000000000");

      await depositERC20Token(token.address, "50000000000000000000", charlie.address, 1);

      await sendFundsToUser(token.address, "200000000000000000000", charlie.address, "5000");

      await expect(liquidityProviders.connect(bob).addTokenLiquidity(token.address, "909000000000000000000")).to.not.be.reverted;

      await expect(liquidityProviders.connect(bob).removeLiquidity(3, "909000000000000000000")).to.not.be.reverted;

    })
  })

  describe("Transfer Fee Addition and LP Share Price Increase", async function () {
    this.beforeEach(async () => {
      await token.connect(owner).approve(liquidityProviders.address, await token.balanceOf(owner.address));
      await token.connect(bob).approve(liquidityProviders.address, await token.balanceOf(bob.address));
      await liquidityProviders.addTokenLiquidity(token.address, 100);
      await liquidityProviders.addNativeLiquidity({ value: 100 });
    });

    it("Should be able to add lp rewards and update base token price in lp shares correctly for ERC20", async function () {
      await liquidityProviders.addLpFeeTesting(token.address, 20);
      expect(await liquidityProviders.getTokenPriceInLPShares(token.address)).to.equal(BASE.mul(100).div(120));
    });

    it("Should be able to add lp rewards and update lp token price correctly for Native", async function () {
      await liquidityProviders.addLpFeeTesting(NATIVE, 20, { value: 20 });
      expect(await liquidityProviders.getTokenPriceInLPShares(NATIVE)).to.equal(BASE.mul(100).div(120));
    });

    it("Should be able to mint correct lp shares amount after reward additon for ERC20", async function () {
      let currentTokenReserve = await liquidityProviders.totalReserve(token.address);
      let currentShareSupply = await liquidityProviders.totalSharesMinted(token.address);
      for (const [fee, liquidty] of [
        [20, 50],
        [30, 40],
        [1000, 9876],
        [1234, 5678],
        [1, 10],
      ]) {
        await liquidityProviders.addLpFeeTesting(token.address, fee);
        currentTokenReserve = currentTokenReserve.add(fee);
        // Calculate expected shares amount after adding liquidity
        const expectedLpSharesAmount = currentShareSupply.mul(liquidty).div(currentTokenReserve);
        await expectLpShareAndSlChangeToNftId(
          async () => {
            await expect(() => liquidityProviders.increaseTokenLiquidity(1, liquidty)).to.changeTokenBalances(
              token,
              [owner, liquidityPool],
              [-liquidty, liquidty]
            );
          },
          owner,
          1,
          expectedLpSharesAmount.toString(),
          liquidty.toString()
        );
        currentTokenReserve = currentTokenReserve.add(liquidty);
        currentShareSupply = currentShareSupply.add(expectedLpSharesAmount);
      }
    });

    it("Should be able to mint correct lp shares amount after reward additon for NATIVE", async function () {
      let currentTokenReserve = await liquidityProviders.totalReserve(NATIVE),
        currentShareSupply = await liquidityProviders.totalSharesMinted(NATIVE);
      for (const [fee, liquidty] of [
        [20, 50],
        [30, 40],
        [1000, 9876],
        [1234, 5678],
      ]) {
        await liquidityProviders.addLpFeeTesting(NATIVE, fee, { value: fee });
        currentTokenReserve = currentTokenReserve.add(fee);
        const expectedLpSharesAmount = currentShareSupply.mul(liquidty).div(currentTokenReserve);
        await expectLpShareAndSlChangeToNftId(
          async () => {
            await expect(() =>
              liquidityProviders.increaseNativeLiquidity(2, { value: liquidty })
            ).to.changeEtherBalances([owner, liquidityPool], [-liquidty, liquidty]);
          },
          owner,
          2,
          expectedLpSharesAmount.toString(),
          liquidty.toString()
        );
        currentTokenReserve = currentTokenReserve.add(liquidty);
        currentShareSupply = currentShareSupply.add(expectedLpSharesAmount);
      }
    });
  });

  describe("LP Share Burning for ERC20 base", async function () {
    let totalTokenSuppliedLiquidity: Record<string, number>;
    let nftId: Record<string, number>;
    let totalTokenFee = BigNumber.from(0);
    let totalTokenFeeClaimed = BigNumber.from(0);

    this.beforeEach(async () => {
      totalTokenSuppliedLiquidity = {
        [owner.address]: 0,
        [bob.address]: 0,
        [charlie.address]: 0,
      };

      nftId = {
        [owner.address]: 0,
        [bob.address]: 0,
        [charlie.address]: 0,
      };

      for (const signer of [owner, bob, charlie]) {
        await token.connect(signer).approve(liquidityProviders.address, ethers.BigNumber.from(10).pow(20));
      }

      let counter = 0;

      for (const [signer, fee, liquidty] of [
        [bob, 20, 50],
        [charlie, 30, 40],
        [bob, 1000, 9876],
        [charlie, 1234, 5678],
        [owner, 1000, 9000],
        [bob, 1000, 6000],
      ] as [SignerWithAddress, number, number][]) {
        if (nftId[signer.address] === 0) {
          await liquidityProviders.connect(signer).addTokenLiquidity(token.address, liquidty);
          nftId[signer.address] = ++counter;
        } else {
          await liquidityProviders.connect(signer).increaseTokenLiquidity(nftId[signer.address], liquidty);
        }
        await liquidityProviders.connect(signer).addLpFeeTesting(token.address, fee);
        totalTokenSuppliedLiquidity[signer.address] += liquidty;
        totalTokenFee = totalTokenFee.add(fee);
      }
    });

    it("Should allow extraction of ERC20 liquidity and rewards", async function () {
      const extractReward = async (signer: SignerWithAddress) => {
        const totalReserve = await liquidityProviders.totalReserve(token.address);
        const totalLpSharesMinted = await liquidityProviders.totalSharesMinted(token.address);
        const suppliedLiquidity = (await lpToken.tokenMetadata(nftId[signer.address])).suppliedLiquidity;
        const tokenBalanceBefore = await token.balanceOf(signer.address);
        let baseTokenPriceInLPShares = await liquidityProviders.getTokenPriceInLPShares(token.address);
        let sharedToBurnFromLiquidity = suppliedLiquidity.mul(baseTokenPriceInLPShares);

        let tokenMetaData = await lpToken.tokenMetadata(nftId[signer.address]);
        let eligibleLiquidity = tokenMetaData.shares.mul(totalReserve).div(totalLpSharesMinted);

        let rewards = eligibleLiquidity.sub(suppliedLiquidity);
        let sharesRepresentingRewards = rewards.mul(baseTokenPriceInLPShares);

        let expectedSharesToBurn = sharedToBurnFromLiquidity.add(sharesRepresentingRewards);

        if (tokenMetaData.shares.sub(expectedSharesToBurn).lt(BASE)) {
          expectedSharesToBurn = tokenMetaData.shares;
        }

        await liquidityProviders.connect(signer).removeLiquidity(nftId[signer.address], suppliedLiquidity);

        expect(totalLpSharesMinted.sub(await liquidityProviders.totalSharesMinted(token.address))).to.equal(
          expectedSharesToBurn
        );

        expect((await lpToken.tokenMetadata(nftId[signer.address])).shares.lt(BASE)).to.be.true;

        const claimedFee = (await token.balanceOf(signer.address)).sub(
          tokenBalanceBefore.add(totalTokenSuppliedLiquidity[signer.address])
        );
        totalTokenFeeClaimed = totalTokenFeeClaimed.add(claimedFee);
        expect(claimedFee.toNumber()).to.greaterThan(0);
      };

      for (const signer of [owner, bob, charlie]) {
        await extractReward(signer);
      }

      expect(totalTokenFeeClaimed.sub(totalTokenFee).toString()).to.eq("0");
    });

    it("Should revert if attempted to remove more liquidity than available", async function () {
      const suppliedLiquidity = (await lpToken.tokenMetadata(1)).suppliedLiquidity;
      await expect(liquidityProviders.connect(bob).removeLiquidity(1, suppliedLiquidity.add(1))).to.be.revertedWith(
        "ERR__INSUFFICIENT_LIQUIDITY"
      );
      await expect(liquidityProviders.connect(bob).removeLiquidity(1, suppliedLiquidity)).to.not.be.reverted;
    });

    it("Should revert if attempted to remove 0 liquidity", async function () {
      await expect(liquidityProviders.connect(bob).removeLiquidity(1, 0)).to.be.revertedWith("ERR__INVALID_AMOUNT");
    });
  });

  describe("LP Share Burning for Native base", async function () {
    let totalNativeSuppliedLiquidity: Record<string, BigNumber>;
    let nftId: Record<string, number>;
    let totalNativeFee = ethers.BigNumber.from(0);
    let totalNativeFeeClaimed = ethers.BigNumber.from(0);

    this.beforeEach(async () => {
      totalNativeSuppliedLiquidity = {
        [owner.address]: ethers.BigNumber.from(0),
        [bob.address]: ethers.BigNumber.from(0),
        [charlie.address]: ethers.BigNumber.from(0),
      };

      nftId = {
        [owner.address]: 0,
        [bob.address]: 0,
        [charlie.address]: 0,
      };

      let counter = 0;

      nftId = {
        [owner.address]: 0,
        [bob.address]: 0,
        [charlie.address]: 0,
      };

      for (const [signer, fee, liquidity] of [
        [bob, 20, 50],
        [charlie, 30, 40],
        [bob, 1000, 9876],
        [charlie, 1234, 5678],
        [owner, 1000, 9876],
        [bob, 1234, 5678],
      ] as [SignerWithAddress, number, number][]) {
        if (nftId[signer.address] === 0) {
          await liquidityProviders.connect(signer).addNativeLiquidity({ value: liquidity });
          nftId[signer.address] = ++counter;
        } else {
          await liquidityProviders.connect(signer).increaseNativeLiquidity(nftId[signer.address], { value: liquidity });
        }
        await liquidityProviders.connect(signer).addLpFeeTesting(NATIVE, fee, { value: fee });
        totalNativeSuppliedLiquidity[signer.address] = totalNativeSuppliedLiquidity[signer.address].add(liquidity);
        totalNativeFee = totalNativeFee.add(fee);
      }
    });

    it("Should allow extraction of NATIVE liquidity and rewards", async function () {
      const extractReward = async (signer: SignerWithAddress) => {
        const totalReserve = await liquidityProviders.totalReserve(NATIVE);
        const totalLpSharesMinted = await liquidityProviders.totalSharesMinted(NATIVE);
        const suppliedLiquidity = (await lpToken.tokenMetadata(nftId[signer.address])).suppliedLiquidity;
        const tokenBalanceBefore = await ethers.provider.getBalance(signer.address);
        let baseTokenPriceInLPShares = await liquidityProviders.getTokenPriceInLPShares(NATIVE);
        let sharedToBurnFromLiquidity = suppliedLiquidity.mul(baseTokenPriceInLPShares);

        let tokenMetaData = await lpToken.tokenMetadata(nftId[signer.address]);
        let eligibleLiquidity = tokenMetaData.shares.mul(totalReserve).div(totalLpSharesMinted);

        let rewards = eligibleLiquidity.sub(suppliedLiquidity);
        let sharesRepresentingRewards = rewards.mul(baseTokenPriceInLPShares);

        let expectedSharesToBurn = sharedToBurnFromLiquidity.add(sharesRepresentingRewards);

        if (tokenMetaData.shares.sub(expectedSharesToBurn).lt(BASE)) {
          expectedSharesToBurn = tokenMetaData.shares;
        }

        const { cumulativeGasUsed, effectiveGasPrice } = await (
          await liquidityProviders.connect(signer).removeLiquidity(nftId[signer.address], suppliedLiquidity)
        ).wait();

        expect(totalLpSharesMinted.sub(await liquidityProviders.totalSharesMinted(NATIVE))).to.equal(
          expectedSharesToBurn
        );

        expect((await lpToken.tokenMetadata(nftId[signer.address])).shares.lt(BASE)).to.be.true;

        const claimedFee = (await ethers.provider.getBalance(signer.address))
          .add(cumulativeGasUsed.mul(effectiveGasPrice))
          .sub(tokenBalanceBefore.add(totalNativeSuppliedLiquidity[signer.address]));
        totalNativeFeeClaimed = totalNativeFeeClaimed.add(claimedFee);

        expect(claimedFee.toNumber()).to.greaterThan(0);
      };

      for (const signer of [owner, bob, charlie]) {
        await extractReward(signer);
      }

      expect(totalNativeFeeClaimed.sub(totalNativeFee).toString()).to.eq("0");
    });

    it("Should revert if attempted to remove more liquidity than available", async function () {
      const suppliedLiquidity = (await lpToken.tokenMetadata(1)).suppliedLiquidity;
      await expect(liquidityProviders.connect(bob).removeLiquidity(1, suppliedLiquidity.add(1))).to.be.revertedWith(
        "ERR__INSUFFICIENT_LIQUIDITY"
      );
      await expect(liquidityProviders.connect(bob).removeLiquidity(1, suppliedLiquidity)).to.not.be.reverted;
    });

    it("Should revert if attempted to remove 0 liquidity", async function () {
      await expect(liquidityProviders.connect(bob).removeLiquidity(1, 0)).to.be.revertedWith("ERR__INVALID_AMOUNT");
    });
  });

  describe("Fee Calculation and Extraction", async function () {
    this.beforeEach(async () => {
      await token.connect(owner).approve(liquidityProviders.address, await token.balanceOf(owner.address));
      await liquidityProviders.addTokenLiquidity(token.address, 100);
      await liquidityProviders.addNativeLiquidity({ value: 100 });
    });

    it("Should allow extraction of fee in ERC20", async function () {
      await liquidityProviders.addLpFeeTesting(token.address, 10);
      await liquidityProviders.increaseTokenLiquidity(1, 100);
      await liquidityProviders.addLpFeeTesting(token.address, 10);

      const expectedRewards = await liquidityProviders.getFeeAccumulatedOnNft(1);
      expect(expectedRewards).to.equal(20);

      await expect(() => liquidityProviders.claimFee(1)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [-20, 20]
      );
    });

    it("Should allow extraction of fee in NATIVE", async function () {
      await liquidityProviders.addLpFeeTesting(NATIVE, 10, { value: 10 });
      await liquidityProviders.increaseNativeLiquidity(2, { value: 100 });
      await liquidityProviders.addLpFeeTesting(NATIVE, 10, { value: 10 });

      const expectedRewards = await liquidityProviders.getFeeAccumulatedOnNft(2);
      expect(expectedRewards).to.equal(20);

      await expect(() => liquidityProviders.claimFee(2)).to.changeEtherBalances([liquidityPool, owner], [-20, 20]);
    });

    it("Should revert if more shares are burnt than available for reward", async function () {
      await expect(liquidityProviders.claimFee(1)).to.be.revertedWith("ERR__NO_REWARDS_TO_CLAIM");
    });
  });

  describe("Real world flow tests", async function () {
    const mulBy10e18 = (num: number): BigNumber => BigNumber.from(10).pow(18).mul(num);

    this.beforeEach(async () => {
      await token.connect(owner).approve(liquidityProviders.address, await token.balanceOf(owner.address));
      await token.connect(bob).approve(liquidityProviders.address, await token.balanceOf(owner.address));
      await token.connect(charlie).approve(liquidityProviders.address, await token.balanceOf(owner.address));
    });

    it("Case #1: Single LP", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 100);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, 50);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(50);

      await expect(async () => liquidityProviders.removeLiquidity(1, 50)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [-100, 100]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(50);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, 50);

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(50);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(50);

      await expect(async () => liquidityProviders.claimFee(1)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [-50, 50]
      );
      await liquidityProviders.addLpFeeTesting(token.address, 50);
      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(50);

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(50);

      await expect(async () => liquidityProviders.removeLiquidity(1, 20)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [-70, 70]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(30);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, 90);

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(30);

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(90);

      await expect(async () => liquidityProviders.claimFee(1)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [-90, 90]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(30);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      // Error of 2 here, should be 30
      await expect(async () => liquidityProviders.removeLiquidity(1, 30)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [-30, 30]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(0);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.increaseTokenLiquidity(1, 100);

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(100);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, 10);

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(100);

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(10);

      await liquidityProviders.increaseTokenLiquidity(1, 100);

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(200);

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(10);

      await liquidityProviders.addLpFeeTesting(token.address, 10);

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(200);

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(20);
    });

    it("Case #1: Single LP, Large Token Values", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, mulBy10e18(100));
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, mulBy10e18(50));
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(mulBy10e18(50));

      await expect(async () => liquidityProviders.removeLiquidity(1, mulBy10e18(50))).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [mulBy10e18(-100), mulBy10e18(100)]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(mulBy10e18(50));
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, mulBy10e18(50));

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(mulBy10e18(50));
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(mulBy10e18(50));

      await expect(async () => liquidityProviders.claimFee(1)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [mulBy10e18(-50), mulBy10e18(50)]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(mulBy10e18(50));

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await expect(async () => liquidityProviders.removeLiquidity(1, mulBy10e18(20))).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [mulBy10e18(-20), mulBy10e18(20)]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(mulBy10e18(30));

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, mulBy10e18(90));

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(mulBy10e18(30));

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(mulBy10e18(90));

      await expect(async () => liquidityProviders.claimFee(1)).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [mulBy10e18(-90), mulBy10e18(90)]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(mulBy10e18(30));

      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);

      await liquidityProviders.addLpFeeTesting(token.address, mulBy10e18(90));
      await expect(async () => liquidityProviders.removeLiquidity(1, mulBy10e18(30))).to.changeTokenBalances(
        token,
        [liquidityPool, owner],
        [mulBy10e18(-120), mulBy10e18(120)]
      );

      expect((await lpToken.tokenMetadata(1)).suppliedLiquidity).equal(0);
      expect(await liquidityProviders.getFeeAccumulatedOnNft(1)).to.equal(0);
    });
  });
});
