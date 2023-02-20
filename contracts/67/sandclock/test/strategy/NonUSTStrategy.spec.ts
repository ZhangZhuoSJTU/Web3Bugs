import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, BigNumber, utils } from "ethers";

import { generateNewAddress } from "../shared/";

describe("EthAnchorNonUSTStrategy", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let vault: Contract;
  let strategy: Contract;
  let mockEthAnchorRouter: Contract;
  let mockExchangeRateFeeder: Contract;
  let mockCurvePool: Contract;
  let ustToken: Contract;
  let aUstToken: Contract;
  let underlying: Contract;
  const treasury = generateNewAddress();
  const ustToUnderlyingRate = utils.parseUnits("1", 30);
  const underlyingToUstRate = utils.parseUnits("1", 6);
  const underlyingI = 2;
  const ustI = 0;
  const perfFeePct = BigNumber.from("200");

  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    ustToken = await MockERC20.deploy(utils.parseEther("1000000000"));
    aUstToken = await MockERC20.deploy(utils.parseEther("1000000000"));
    underlying = await MockERC20.deploy(utils.parseEther("1000000000"));

    const MockCurvePoolFactory = await ethers.getContractFactory(
      "MockCurvePool"
    );
    mockCurvePool = await MockCurvePoolFactory.deploy();
    await mockCurvePool.addToken(ustI, ustToken.address);
    await mockCurvePool.addToken(underlyingI, underlying.address);
    await ustToken.transfer(mockCurvePool.address, utils.parseEther("1000000"));
    await underlying.transfer(
      mockCurvePool.address,
      utils.parseEther("1000000")
    );
    await mockCurvePool.updateRate(ustI, underlyingI, ustToUnderlyingRate);
    await mockCurvePool.updateRate(underlyingI, ustI, underlyingToUstRate);

    const MockEthAnchorRouterFactory = await ethers.getContractFactory(
      "MockEthAnchorRouter"
    );
    mockEthAnchorRouter = await MockEthAnchorRouterFactory.deploy(
      ustToken.address,
      aUstToken.address
    );

    const MockExchangeRateFeederFactory = await ethers.getContractFactory(
      "MockExchangeRateFeeder"
    );
    mockExchangeRateFeeder = await MockExchangeRateFeederFactory.deploy();

    const MockVaultFactory = await ethers.getContractFactory("MockVault");
    vault = await MockVaultFactory.deploy(underlying.address, 0, 0);

    const NonUSTStrategyFactory = await ethers.getContractFactory(
      "NonUSTStrategy"
    );

    strategy = await NonUSTStrategyFactory.deploy(
      vault.address,
      treasury,
      mockEthAnchorRouter.address,
      mockExchangeRateFeeder.address,
      ustToken.address,
      aUstToken.address,
      perfFeePct,
      owner.address,
      mockCurvePool.address,
      underlyingI,
      ustI
    );

    await vault.setStrategy(strategy.address);
  });

  describe("#doHardWork function", () => {
    it("Revert if msg.sender is neither controller, owner, nor vault", async () => {
      await expect(strategy.connect(alice).doHardWork()).to.be.revertedWith(
        "restricted"
      );
    });

    it("Revert if underlying balance is zero", async () => {
      await expect(strategy.connect(owner).doHardWork()).to.be.revertedWith(
        "balance 0"
      );
    });

    it("Should swap underlying to UST and init deposit all UST", async () => {
      const operator = generateNewAddress();
      await mockEthAnchorRouter.addPendingOperator(operator);

      let underlyingBalance = utils.parseUnits("100", 6);
      await underlying
        .connect(owner)
        .transfer(strategy.address, underlyingBalance);
      expect(await strategy.investedAssets()).equal(underlyingBalance);
      let ustBalance = underlyingBalance
        .mul(utils.parseEther("1"))
        .div(underlyingToUstRate);
      await strategy.connect(owner).doHardWork();
      expect(await underlying.balanceOf(strategy.address)).equal(0);
      expect(await strategy.convertedUst()).equal(0);
      expect(await strategy.pendingDeposits()).equal(ustBalance);
      expect(await strategy.investedAssets()).equal(underlyingBalance);
      const operation = await strategy.depositOperations(0);
      expect(operation.operator).equal(operator);
      expect(operation.amount).equal(ustBalance);
      expect(await strategy.depositOperationLength()).equal(1);
    });
  });

  describe("#finishRedeemStable function", () => {
    let operator0: string;
    let amount0: BigNumber;
    let aUstAmount0: BigNumber;
    let redeemAmount0: BigNumber;

    beforeEach(async () => {
      operator0 = generateNewAddress();
      await mockEthAnchorRouter.addPendingOperator(operator0);

      amount0 = utils.parseUnits("100", 6);
      aUstAmount0 = utils.parseUnits("90", 18);
      await underlying.connect(owner).transfer(strategy.address, amount0);
      await strategy.connect(owner).doHardWork();

      await aUstToken
        .connect(owner)
        .approve(mockEthAnchorRouter.address, aUstAmount0);
      await mockEthAnchorRouter.notifyDepositResult(operator0, aUstAmount0);
      await strategy.connect(owner).finishDepositStable(0);

      operator0 = generateNewAddress();
      await mockEthAnchorRouter.addPendingOperator(operator0);

      redeemAmount0 = utils.parseUnits("50", 18);
      await strategy.connect(owner).initRedeemStable(redeemAmount0);
    });

    // it("Revert if msg.sender is neither controller, owner, nor vault", async () => {
    //   await expect(
    //     strategy.connect(alice).finishRedeemStable(0)
    //   ).to.be.revertedWith("no permission");
    // });

    it("Revert if idx is out of array", async () => {
      await expect(
        strategy.connect(owner).finishRedeemStable(1)
      ).to.be.revertedWith("not running");
    });

    it("Should finish redeem operation and swap UST to underlying", async () => {
      let exchangeRate = amount0.mul(utils.parseEther("1")).div(aUstAmount0);
      await mockExchangeRateFeeder.setExchangeRate(exchangeRate);

      let redeemedAmount0 = utils.parseUnits("40", 18);
      await ustToken
        .connect(owner)
        .approve(mockEthAnchorRouter.address, redeemedAmount0);
      await mockEthAnchorRouter.notifyRedeemResult(operator0, redeemedAmount0);

      let underlyingAmount = redeemedAmount0
        .mul(utils.parseEther("1"))
        .div(ustToUnderlyingRate);
      await strategy.connect(owner).finishRedeemStable(0);
      expect(await underlying.balanceOf(strategy.address)).equal(
        underlyingAmount
      );
      expect(await ustToken.balanceOf(strategy.address)).equal(0);
      expect(await aUstToken.balanceOf(strategy.address)).equal(
        aUstAmount0.sub(redeemAmount0)
      );
      expect(await strategy.pendingRedeems()).equal(0);
      expect(await strategy.investedAssets()).equal(
        aUstAmount0
          .sub(redeemAmount0)
          .mul(exchangeRate)
          .div(utils.parseEther("1"))
          .mul(utils.parseEther("1"))
          .div(ustToUnderlyingRate)
          .add(underlyingAmount)
      );

      expect(await strategy.redeemOperationLength()).equal(0);
    });
  });
});
