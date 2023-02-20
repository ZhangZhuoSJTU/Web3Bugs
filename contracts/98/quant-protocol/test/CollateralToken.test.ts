import { BigNumber, Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach, describe, it } from "mocha";
import { CollateralToken } from "../typechain/CollateralToken";
import { MockERC20 } from "../typechain/MockERC20";
import { QToken } from "../typechain/QToken";
import { QuantConfig } from "../typechain/QuantConfig";
import { expect, provider } from "./setup";
import {
  deployAssetsRegistry,
  deployCollateralToken,
  deployQToken,
  deployQuantConfig,
  getApprovalForAllSignedData,
  mockERC20,
} from "./testUtils";

describe("CollateralToken", () => {
  let quantConfig: QuantConfig;
  let collateralToken: CollateralToken;
  let qToken: QToken;
  let secondQToken: QToken;
  let deployer: Wallet;
  let secondAccount: Wallet;
  let assetRegistryManager: Signer;
  let collateralCreator: Signer;
  let collateralMinter: Signer;
  let collateralBurner: Signer;
  let userAddress: string;
  let WETH: MockERC20;
  let BUSD: MockERC20;

  const createCollateralToken = async (
    account: Signer,
    qToken: QToken,
    qTokenAsCollateral: string
  ) => {
    await collateralToken
      .connect(account)
      .createCollateralToken(qToken.address, qTokenAsCollateral);
  };

  const createTwoCollateralTokens = async (): Promise<Array<BigNumber>> => {
    await createCollateralToken(
      collateralCreator,
      qToken,
      ethers.constants.AddressZero
    );
    const firstCollateralTokenId = await collateralToken.collateralTokenIds(
      ethers.BigNumber.from("0")
    );

    await createCollateralToken(
      collateralCreator,
      secondQToken,
      ethers.constants.AddressZero
    );
    const secondCollateralTokenId = await collateralToken.collateralTokenIds(
      ethers.BigNumber.from("1")
    );

    return [firstCollateralTokenId, secondCollateralTokenId];
  };

  beforeEach(async () => {
    [
      deployer,
      secondAccount,
      assetRegistryManager,
      collateralCreator,
      collateralMinter,
      collateralBurner,
    ] = provider.getWallets();
    userAddress = await secondAccount.getAddress();

    quantConfig = await deployQuantConfig(deployer, [
      {
        addresses: [await assetRegistryManager.getAddress()],
        role: "ASSETS_REGISTRY_MANAGER_ROLE",
      },
      {
        addresses: [await collateralCreator.getAddress()],
        role: "COLLATERAL_CREATOR_ROLE",
      },
      {
        addresses: [await collateralMinter.getAddress()],
        role: "COLLATERAL_MINTER_ROLE",
      },
      {
        addresses: [await collateralBurner.getAddress()],
        role: "COLLATERAL_BURNER_ROLE",
      },
    ]);

    WETH = await mockERC20(deployer, "WETH");
    BUSD = await mockERC20(deployer, "BUSD");

    const assetsRegistry = await deployAssetsRegistry(deployer, quantConfig);

    await assetsRegistry
      .connect(assetRegistryManager)
      .addAssetWithOptionalERC20Methods(WETH.address);
    await assetsRegistry
      .connect(assetRegistryManager)
      .addAssetWithOptionalERC20Methods(BUSD.address);

    qToken = await deployQToken(
      deployer,
      quantConfig,
      WETH.address,
      BUSD.address
    );

    secondQToken = await deployQToken(
      deployer,
      quantConfig,
      WETH.address,
      BUSD.address,
      ethers.Wallet.createRandom().address,
      ethers.utils.parseUnits("2000", await BUSD.decimals()),
      ethers.BigNumber.from("1618592400"),
      true
    );

    collateralToken = await deployCollateralToken(deployer, quantConfig);
  });

  describe("metaSetApprovalForAll", () => {
    const futureTimestamp = Math.round(Date.now() / 1000) + 3600 * 24;
    let nonce: number;

    beforeEach(async () => {
      nonce = parseInt(
        (await collateralToken.nonces(deployer.address)).toString()
      );
    });
    it("Should revert when passing an expired deadline", async () => {
      const pastTimestamp = Math.round(Date.now() / 1000) - 3600 * 24; // a day in the past

      await expect(
        collateralToken
          .connect(secondAccount)
          .metaSetApprovalForAll(
            deployer.address,
            secondAccount.address,
            true,
            nonce,
            pastTimestamp,
            0,
            ethers.constants.HashZero,
            ethers.constants.HashZero
          )
      ).to.be.revertedWith("CollateralToken: expired deadline");
    });

    it("Should revert when passing an invalid signature", async () => {
      await expect(
        collateralToken
          .connect(secondAccount)
          .metaSetApprovalForAll(
            deployer.address,
            secondAccount.address,
            true,
            nonce,
            futureTimestamp,
            0,
            ethers.constants.HashZero,
            ethers.constants.HashZero
          )
      ).to.be.revertedWith("CollateralToken: invalid signature");
    });

    it("Should revert when passing an invalid nonce", async () => {
      const { v, r, s } = getApprovalForAllSignedData(
        parseInt((await collateralToken.nonces(deployer.address)).toString()),
        deployer,
        secondAccount.address,
        true,
        futureTimestamp,
        collateralToken.address
      );

      await expect(
        collateralToken
          .connect(secondAccount)
          .metaSetApprovalForAll(
            deployer.address,
            secondAccount.address,
            true,
            nonce + 5,
            futureTimestamp,
            v,
            r,
            s
          )
      ).to.be.revertedWith("CollateralToken: invalid nonce");
    });

    it("Should be able to set approvals through meta transactions", async () => {
      expect(
        await collateralToken.isApprovedForAll(
          deployer.address,
          secondAccount.address
        )
      ).to.equal(false);

      const { v, r, s } = getApprovalForAllSignedData(
        parseInt((await collateralToken.nonces(deployer.address)).toString()),
        deployer,
        secondAccount.address,
        true,
        futureTimestamp,
        collateralToken.address
      );

      await expect(
        collateralToken
          .connect(secondAccount)
          .metaSetApprovalForAll(
            deployer.address,
            secondAccount.address,
            true,
            nonce,
            futureTimestamp,
            v,
            r,
            s
          )
      )
        .to.emit(collateralToken, "ApprovalForAll")
        .withArgs(deployer.address, secondAccount.address, true);

      expect(
        await collateralToken.isApprovedForAll(
          deployer.address,
          secondAccount.address
        )
      ).to.equal(true);
    });
  });

  describe("createCollateralToken", () => {
    it("Should be able to create a new CollateralToken", async () => {
      const firstIndex = ethers.BigNumber.from("0");

      // No CollateralToken has been created yet
      expect(await collateralToken.getCollateralTokensLength()).to.equal(
        ethers.BigNumber.from(0)
      );

      // Create a new CollateralToken
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        firstIndex
      );

      // Should have a non-zero token id for the first CollateralToken
      expect(collateralTokenId).to.not.be.equal(ethers.BigNumber.from("0"));

      // CollateralToken info should match what was passed when creating the token
      const collateralTokenInfo = await collateralToken.idToInfo(
        collateralTokenId
      );

      expect(collateralTokenInfo.qTokenAddress).to.equal(qToken.address);
      expect(collateralTokenInfo.qTokenAsCollateral).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Should revert when an unauthorized account tries to create a new CollateralToken", async () => {
      await expect(
        createCollateralToken(
          secondAccount,
          qToken,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(
        "CollateralToken: Only a collateral creator can create new CollateralTokens"
      );
    });

    it("Should revert when trying to create a collateral token with the qToken and qTokenAsCollateral being equal", async () => {
      await expect(
        createCollateralToken(collateralCreator, qToken, qToken.address)
      ).to.be.revertedWith(
        "CollateralToken: Can only create a collateral token with different tokens"
      );
    });

    it("Should revert when trying to create a duplicate CollateralToken", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      await expect(
        createCollateralToken(
          collateralCreator,
          qToken,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(
        "CollateralToken: this token has already been created"
      );
    });

    it("Should emit the CollateralTokenCreated event", async () => {
      await expect(
        await collateralToken
          .connect(collateralCreator)
          .createCollateralToken(qToken.address, ethers.constants.AddressZero)
      )
        .to.emit(collateralToken, "CollateralTokenCreated")
        .withArgs(
          qToken.address,
          ethers.constants.AddressZero,
          await collateralToken.collateralTokenIds(ethers.BigNumber.from("0")),
          "1"
        );
    });
  });

  describe("mintCollateralToken", () => {
    it("Admin should be able to mint CollateralTokens", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        ethers.BigNumber.from("0")
      );

      // Initial balance should be 0
      expect(
        await collateralToken.balanceOf(userAddress, collateralTokenId)
      ).to.equal(ethers.BigNumber.from("0"));

      // Mint some of the CollateralToken
      await collateralToken
        .connect(collateralMinter)
        .mintCollateralToken(
          userAddress,
          collateralTokenId,
          ethers.BigNumber.from("10")
        );

      // User's balance should have increased
      expect(
        await collateralToken.balanceOf(userAddress, collateralTokenId)
      ).to.equal(ethers.BigNumber.from("10"));
    });

    it("Should revert when an unauthorized account tries to mint CollateralTokens", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        ethers.BigNumber.from("0")
      );

      await expect(
        collateralToken
          .connect(secondAccount)
          .mintCollateralToken(
            userAddress,
            collateralTokenId,
            ethers.BigNumber.from("1000")
          )
      ).to.be.revertedWith(
        "CollateralToken: Only a collateral minter can mint CollateralTokens"
      );
    });

    it("Should emit the CollateralTokenMinted event", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        ethers.BigNumber.from("0")
      );

      await expect(
        await collateralToken
          .connect(collateralMinter)
          .mintCollateralToken(
            userAddress,
            collateralTokenId,
            ethers.BigNumber.from("10")
          )
      )
        .to.emit(collateralToken, "CollateralTokenMinted")
        .withArgs(userAddress, collateralTokenId, ethers.BigNumber.from("10"));
    });
  });

  describe("burnCollateralToken", () => {
    it("Admin should be able to burn CollateralTokens", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        ethers.BigNumber.from("0")
      );

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralToken(
          userAddress,
          collateralTokenId,
          ethers.BigNumber.from("10")
        );

      const balanceAfterMint = parseInt(
        (
          await collateralToken.balanceOf(userAddress, collateralTokenId)
        ).toString()
      );

      // Burn some of the CollateralToken from the user
      await collateralToken
        .connect(collateralBurner)
        .burnCollateralToken(
          userAddress,
          collateralTokenId,
          ethers.BigNumber.from("5")
        );

      expect(
        parseInt(
          (
            await collateralToken.balanceOf(userAddress, collateralTokenId)
          ).toString()
        )
      ).to.be.lessThan(balanceAfterMint);
    });

    it("Should revert when an unauthorized account tries to burn CollateralTokens", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        ethers.BigNumber.from("0")
      );

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralToken(
          await secondAccount.getAddress(),
          collateralTokenId,
          ethers.BigNumber.from("10")
        );

      await expect(
        collateralToken
          .connect(secondAccount)
          .burnCollateralToken(
            await secondAccount.getAddress(),
            collateralTokenId,
            ethers.BigNumber.from("10")
          )
      ).to.be.revertedWith(
        "CollateralToken: Only a collateral burner can burn CollateralTokens"
      );
    });

    it("Should emit the CollateralTokenBurned event", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const collateralTokenId = await collateralToken.collateralTokenIds(
        ethers.BigNumber.from("0")
      );

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralToken(
          userAddress,
          collateralTokenId,
          ethers.BigNumber.from("10")
        );

      await expect(
        collateralToken
          .connect(collateralBurner)
          .burnCollateralToken(
            userAddress,
            collateralTokenId,
            ethers.BigNumber.from("5")
          )
      )
        .to.emit(collateralToken, "CollateralTokenBurned")
        .withArgs(userAddress, collateralTokenId, ethers.BigNumber.from("5"));
    });
  });

  describe("mintCollateralTokenBatch", () => {
    it("Admin should be able to mint batches of CollateralTokens", async () => {
      const [firstCollateralTokenId, secondCollateralTokenId] =
        await createTwoCollateralTokens();

      expect(firstCollateralTokenId).to.not.be.equal(secondCollateralTokenId);

      const firstCollateralTokenAmount = ethers.BigNumber.from("10");
      const secondCollateralTokenAmount = ethers.BigNumber.from("20");

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralTokenBatch(
          userAddress,
          [firstCollateralTokenId, secondCollateralTokenId],
          [firstCollateralTokenAmount, secondCollateralTokenAmount]
        );

      expect(
        await collateralToken.balanceOfBatch(
          [userAddress, userAddress],
          [firstCollateralTokenId, secondCollateralTokenId]
        )
      ).to.eql([firstCollateralTokenAmount, secondCollateralTokenAmount]);
    });

    it("Should revert when an unauthorized account tries to mint a batch of CollateralTokens", async () => {
      const [firstCollateralTokenId, secondCollateralTokenId] =
        await createTwoCollateralTokens();

      await expect(
        collateralToken
          .connect(secondAccount)
          .mintCollateralTokenBatch(
            userAddress,
            [firstCollateralTokenId, secondCollateralTokenId],
            [ethers.BigNumber.from("1000"), ethers.BigNumber.from("2000")]
          )
      ).to.be.revertedWith(
        "CollateralToken: Only a collateral minter can mint CollateralTokens"
      );
    });

    it("Should emit the CollateralTokenMinted event", async () => {
      const [firstCollateralTokenId, secondCollateralTokenId] =
        await createTwoCollateralTokens();

      const firstCollateralTokenAmount = ethers.BigNumber.from("10");
      const secondCollateralTokenAmount = ethers.BigNumber.from("20");

      await expect(
        collateralToken
          .connect(collateralMinter)
          .mintCollateralTokenBatch(
            userAddress,
            [firstCollateralTokenId, secondCollateralTokenId],
            [firstCollateralTokenAmount, secondCollateralTokenAmount]
          )
      )
        .to.emit(collateralToken, "CollateralTokenMinted")
        .withArgs(
          userAddress,
          secondCollateralTokenId,
          secondCollateralTokenAmount
        );
    });
  });

  describe("burnCollateralTokenBatch", () => {
    it("Admin should be able to burn batches of CollateralTokens", async () => {
      const [firstCollateralTokenId, secondCollateralTokenId] =
        await createTwoCollateralTokens();

      const firstCollateralTokenAmount = ethers.BigNumber.from("10");
      const secondCollateralTokenAmount = ethers.BigNumber.from("20");

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralTokenBatch(
          userAddress,
          [firstCollateralTokenId, secondCollateralTokenId],
          [firstCollateralTokenAmount, secondCollateralTokenAmount]
        );

      const [firstPrevBalance, secondPrevBalance] =
        await collateralToken.balanceOfBatch(
          [userAddress, userAddress],
          [firstCollateralTokenId, secondCollateralTokenId]
        );

      await collateralToken
        .connect(collateralBurner)
        .burnCollateralTokenBatch(
          userAddress,
          [firstCollateralTokenId, secondCollateralTokenId],
          [ethers.BigNumber.from("5"), ethers.BigNumber.from("10")]
        );

      const [firstNewBalance, secondNewBalance] =
        await collateralToken.balanceOfBatch(
          [userAddress, userAddress],
          [firstCollateralTokenId, secondCollateralTokenId]
        );

      expect(parseInt(firstPrevBalance.toString())).to.be.greaterThan(
        parseInt(firstNewBalance.toString())
      );
      expect(parseInt(secondPrevBalance.toString())).to.be.greaterThan(
        parseInt(secondNewBalance.toString())
      );
    });

    it("Should revert when an unauthorized account tries to burn a batch of CollateralTokens", async () => {
      const [firstCollateralTokenId, secondCollateralTokenId] =
        await createTwoCollateralTokens();

      const firstCollateralTokenAmount = ethers.BigNumber.from("10");
      const secondCollateralTokenAmount = ethers.BigNumber.from("20");

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralTokenBatch(
          userAddress,
          [firstCollateralTokenId, secondCollateralTokenId],
          [firstCollateralTokenAmount, secondCollateralTokenAmount]
        );

      await expect(
        collateralToken
          .connect(secondAccount)
          .burnCollateralTokenBatch(
            userAddress,
            [firstCollateralTokenId, secondCollateralTokenId],
            [firstCollateralTokenAmount, secondCollateralTokenAmount]
          )
      ).to.be.revertedWith(
        "CollateralToken: Only a collateral burner can burn CollateralTokens"
      );
    });

    it("Should emit the CollateralTokenBurned event", async () => {
      const [firstCollateralTokenId, secondCollateralTokenId] =
        await createTwoCollateralTokens();

      const firstCollateralTokenAmount = ethers.BigNumber.from("10");
      const secondCollateralTokenAmount = ethers.BigNumber.from("20");

      await collateralToken
        .connect(collateralMinter)
        .mintCollateralTokenBatch(
          userAddress,
          [firstCollateralTokenId, secondCollateralTokenId],
          [firstCollateralTokenAmount, secondCollateralTokenAmount]
        );

      await expect(
        collateralToken
          .connect(collateralBurner)
          .burnCollateralTokenBatch(
            userAddress,
            [firstCollateralTokenId, secondCollateralTokenId],
            [ethers.BigNumber.from("5"), ethers.BigNumber.from("10")]
          )
      )
        .to.emit(collateralToken, "CollateralTokenBurned")
        .withArgs(
          userAddress,
          secondCollateralTokenId,
          ethers.BigNumber.from("10")
        );
    });
  });

  describe("getCollateralTokenIdsLength", async () => {
    it("Should return the correct amount when there are no CollateralTokens created yet", async () => {
      expect(await collateralToken.getCollateralTokensLength()).to.equal(
        ethers.BigNumber.from("0")
      );
    });

    it("Should return the right amount when a single CollateralToken is created", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      expect(await collateralToken.getCollateralTokensLength()).to.equal(
        ethers.BigNumber.from("1")
      );
    });

    it("Should return the correct amount when multiple CollateralTokens are created", async () => {
      await createTwoCollateralTokens();

      const otherQToken = await deployQToken(
        deployer,
        quantConfig,
        WETH.address,
        BUSD.address,
        ethers.Wallet.createRandom().address,
        ethers.utils.parseUnits("10000", await BUSD.decimals()),
        ethers.BigNumber.from("1653285356"),
        false
      );

      await createCollateralToken(
        collateralCreator,
        otherQToken,
        ethers.constants.AddressZero
      );

      expect(await collateralToken.getCollateralTokensLength()).to.equal(
        ethers.BigNumber.from("3")
      );
    });
  });

  describe("getCollateralTokenInfo", () => {
    it("Should revert when passing an invalid id", async () => {
      await expect(
        collateralToken.getCollateralTokenInfo(0)
      ).to.be.revertedWith("CollateralToken: Invalid id");
    });

    it("Should return the correct info for non-spreads", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        ethers.constants.AddressZero
      );

      const id = await collateralToken.collateralTokenIds(
        ethers.constants.Zero
      );

      expect(await collateralToken.getCollateralTokenInfo(id)).to.eql([
        await qToken.underlyingAsset(),
        await qToken.strikeAsset(),
        await qToken.oracle(),
        await qToken.strikePrice(),
        ethers.constants.Zero,
        await qToken.expiryTime(),
        await qToken.isCall(),
      ]);
    });

    it("Should return the correct info for spreads", async () => {
      await createCollateralToken(
        collateralCreator,
        qToken,
        secondQToken.address
      );

      const id = await collateralToken.collateralTokenIds(
        ethers.constants.Zero
      );

      expect(await collateralToken.getCollateralTokenInfo(id)).to.eql([
        await qToken.underlyingAsset(),
        await qToken.strikeAsset(),
        await qToken.oracle(),
        await qToken.strikePrice(),
        await secondQToken.strikePrice(),
        await qToken.expiryTime(),
        await qToken.isCall(),
      ]);
    });
  });
});
