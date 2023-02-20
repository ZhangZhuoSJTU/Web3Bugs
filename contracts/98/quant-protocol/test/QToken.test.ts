import { ecsign } from "ethereumjs-util";
import { BigNumber, Signer, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { beforeEach, describe, it } from "mocha";
import QTokenJSON from "../artifacts/contracts/options/QToken.sol/QToken.json";
import { MockERC20 } from "../typechain/MockERC20";
import { QToken } from "../typechain/QToken";
import { QuantConfig } from "../typechain/QuantConfig";
import { expect, provider } from "./setup";
import {
  deployAssetsRegistry,
  deployQToken,
  deployQuantConfig,
  getApprovalDigest,
  mockERC20,
} from "./testUtils";

const { deployContract } = waffle;

const { keccak256, defaultAbiCoder, toUtf8Bytes, hexlify } = ethers.utils;
const TEST_AMOUNT = ethers.utils.parseEther("10");

describe("QToken", async () => {
  let quantConfig: QuantConfig;
  let qToken: QToken;
  let timelockController: Signer;
  let secondAccount: Wallet;
  let assetsRegistryManager: Signer;
  let optionsMinter: Signer;
  let optionsBurner: Signer;
  let otherAccount: Signer;
  let BUSD: MockERC20;
  let WETH: MockERC20;
  let userAddress: string;
  let otherUserAddress: string;
  let scaledStrikePrice: BigNumber;
  let qTokenParams: [string, string, string, BigNumber, BigNumber, boolean];
  const strikePrice = ethers.utils.parseUnits("1400", 18);
  const expiryTime = ethers.BigNumber.from("1618592400"); // April 16th, 2021
  const oracle = ethers.Wallet.createRandom().address;

  const mintOptionsToAccount = async (account: string, amount: number) => {
    await qToken
      .connect(optionsMinter)
      .mint(account, ethers.utils.parseEther(amount.toString()));
  };

  enum PriceStatus {
    ACTIVE,
    AWAITING_SETTLEMENT_PRICE,
    SETTLED,
  }

  beforeEach(async () => {
    [
      timelockController,
      secondAccount,
      assetsRegistryManager,
      optionsMinter,
      optionsBurner,
      otherAccount,
    ] = provider.getWallets();
    userAddress = await secondAccount.getAddress();
    otherUserAddress = await otherAccount.getAddress();

    quantConfig = await deployQuantConfig(timelockController, [
      {
        addresses: [await assetsRegistryManager.getAddress()],
        role: "ASSETS_REGISTRY_MANAGER_ROLE",
      },
      {
        addresses: [await optionsMinter.getAddress()],
        role: "OPTIONS_MINTER_ROLE",
      },
      {
        addresses: [await optionsBurner.getAddress()],
        role: "OPTIONS_BURNER_ROLE",
      },
    ]);

    WETH = await mockERC20(timelockController, "WETH", "Wrapped Ether");
    BUSD = await mockERC20(timelockController, "BUSD", "BUSD Token", 18);

    const assetsRegistry = await deployAssetsRegistry(
      timelockController,
      quantConfig
    );

    await assetsRegistry
      .connect(assetsRegistryManager)
      .addAssetWithOptionalERC20Methods(WETH.address);
    await assetsRegistry
      .connect(assetsRegistryManager)
      .addAssetWithOptionalERC20Methods(BUSD.address);

    scaledStrikePrice = ethers.utils.parseUnits("1400", await BUSD.decimals());

    qTokenParams = [
      WETH.address,
      BUSD.address,
      oracle,
      strikePrice,
      expiryTime,
      false,
    ];

    qToken = await deployQToken(
      timelockController,
      quantConfig,
      ...qTokenParams
    );
  });

  it("Should be able to create a new option", async () => {
    expect(await qToken.symbol()).to.equal("ROLLA-WETH-16APR21-1400-P");
    expect(await qToken.name()).to.equal("ROLLA WETH 16-April-2021 1400 Put");
    expect(await qToken.quantConfig()).to.equal(quantConfig.address);
    expect(await qToken.underlyingAsset()).to.equal(WETH.address);
    expect(await qToken.strikeAsset()).to.equal(BUSD.address);
    expect(await qToken.oracle()).to.equal(oracle);
    expect(await qToken.strikePrice()).to.equal(scaledStrikePrice);
    expect(await qToken.expiryTime()).to.equal(expiryTime);
    expect(await qToken.isCall()).to.be.false;
    expect(await qToken.decimals()).to.equal(ethers.BigNumber.from("18"));
  });

  it("Options minter should be able to mint options", async () => {
    // User balance should be zero before minting the options
    expect(await qToken.balanceOf(userAddress)).to.equal(
      ethers.BigNumber.from("0")
    );

    // Mint options to the user address
    await mintOptionsToAccount(userAddress, 2);

    // User balance should have increased
    expect(await qToken.balanceOf(userAddress)).to.equal(
      ethers.utils.parseEther("2")
    );
  });

  it("Opitons burner should be able to burn options", async () => {
    await mintOptionsToAccount(userAddress, 4);
    const previousBalance = await qToken.balanceOf(userAddress);

    // Burn options from the user address
    await qToken
      .connect(optionsBurner)
      .burn(userAddress, ethers.utils.parseEther("2"));

    const newBalance = await qToken.balanceOf(userAddress);

    expect(parseInt(newBalance.toString())).to.be.lessThan(
      parseInt(previousBalance.toString())
    );
  });

  it("Should revert when an unauthorized account tries to mint options", async () => {
    await expect(
      qToken
        .connect(secondAccount)
        .mint(userAddress, ethers.utils.parseEther("2"))
    ).to.be.revertedWith("QToken: Only an options minter can mint QTokens");
  });

  it("Should revert when an unauthorized account tries to burn options", async () => {
    await expect(
      qToken
        .connect(secondAccount)
        .burn(await timelockController.getAddress(), ethers.BigNumber.from("4"))
    ).to.be.revertedWith("QToken: Only an options burner can burn QTokens");
  });

  it("Should create CALL options with different parameters", async () => {
    qToken = <QToken>await deployContract(timelockController, QTokenJSON, [
      quantConfig.address,
      WETH.address,
      BUSD.address,
      oracle,
      ethers.BigNumber.from("1912340000000000000000"), // BUSD has 18 decimals
      ethers.BigNumber.from("1630768904"),
      true,
    ]);
    expect(await qToken.symbol()).to.equal("ROLLA-WETH-04SEP21-1912.44-C");
    expect(await qToken.name()).to.equal(
      "ROLLA WETH 04-September-2021 1912.44 Call"
    );
  });

  it("Should be able to create options expiring on any month", async () => {
    const months: { [month: string]: string } = {
      JAN: "January",
      FEB: "February",
      MAR: "March",
      APR: "April",
      MAY: "May",
      JUN: "June",
      JUL: "July",
      AUG: "August",
      SEP: "September",
      OCT: "October",
      NOV: "November",
      DEC: "December",
    };

    const getMonth = async (
      optionToken: QToken,
      optionMetadata: string,
      isMetadataAMonthName = true
    ): Promise<string> => {
      if (isMetadataAMonthName) {
        // e.g., January
        return (await optionToken.name()).split(" ")[2].split("-")[1];
      }
      // it's a string like JAN
      return (await optionToken.symbol()).split("-", 4)[2].slice(2, 5);
    };

    let optionexpiryTime = 1609773704;
    const aMonthInSeconds = 2629746;
    for (const month in months) {
      qToken = <QToken>(
        await deployContract(timelockController, QTokenJSON, [
          quantConfig.address,
          WETH.address,
          BUSD.address,
          oracle,
          strikePrice,
          ethers.BigNumber.from(optionexpiryTime.toString()),
          false,
        ])
      );

      expect(await getMonth(qToken, await qToken.name())).to.equal(
        months[month]
      );

      expect(await getMonth(qToken, await qToken.symbol(), false)).to.equal(
        month
      );

      optionexpiryTime += aMonthInSeconds;
    }
  });

  it("Should emit the QTokenMinted event", async () => {
    await expect(qToken.connect(optionsMinter).mint(userAddress, 4))
      .to.emit(qToken, "QTokenMinted")
      .withArgs(userAddress, 4);
  });

  it("Should emit the QTokenBurned event", async () => {
    await mintOptionsToAccount(userAddress, 6);
    await expect(qToken.connect(optionsBurner).burn(userAddress, 3))
      .to.emit(qToken, "QTokenBurned")
      .withArgs(userAddress, 3);
  });

  it("Should return an ACTIVE status for options that haven't expired yet", async () => {
    const nonExpiredQToken = await deployQToken(
      timelockController,
      quantConfig,
      WETH.address,
      BUSD.address,
      ethers.Wallet.createRandom().address,
      strikePrice,
      ethers.BigNumber.from(
        (Math.round(Date.now() / 1000) + 30 * 24 * 3600).toString()
      )
    );

    expect(await nonExpiredQToken.getOptionPriceStatus()).to.equal(
      PriceStatus.ACTIVE
    );
  });

  it("Should be created with the right EIP-2612 (permit) configuration", async () => {
    expect(await qToken.DOMAIN_SEPARATOR()).to.equal(
      keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            keccak256(
              toUtf8Bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
              )
            ),
            keccak256(toUtf8Bytes(await qToken.name())),
            keccak256(toUtf8Bytes("1")),
            provider.network.chainId,
            qToken.address,
          ]
        )
      )
    );
  });

  it("Should be able to set allowance and then transfer options through the permit functionality", async () => {
    const nonce = await qToken.nonces(userAddress);
    const deadline = ethers.constants.MaxUint256;
    const digest = await getApprovalDigest(
      qToken,
      { owner: userAddress, spender: otherUserAddress, value: TEST_AMOUNT },
      nonce,
      deadline
    );

    const { v, r, s } = ecsign(
      Buffer.from(digest.slice(2), "hex"),
      Buffer.from(secondAccount.privateKey.slice(2), "hex")
    );

    await expect(
      qToken.permit(
        userAddress,
        otherUserAddress,
        TEST_AMOUNT,
        deadline,
        v,
        hexlify(r),
        hexlify(s)
      )
    )
      .to.emit(qToken, "Approval")
      .withArgs(userAddress, otherUserAddress, TEST_AMOUNT);
    expect(await qToken.allowance(userAddress, otherUserAddress)).to.equal(
      TEST_AMOUNT
    );
    expect(await qToken.nonces(userAddress)).to.equal(
      ethers.BigNumber.from("1")
    );

    await qToken.connect(optionsMinter).mint(userAddress, TEST_AMOUNT);
    expect(await qToken.balanceOf(userAddress)).to.equal(TEST_AMOUNT);
    const recipient = await timelockController.getAddress();
    expect(await qToken.balanceOf(recipient)).to.equal(ethers.constants.Zero);

    await qToken
      .connect(otherAccount)
      .transferFrom(userAddress, recipient, TEST_AMOUNT);
    expect(await qToken.balanceOf(userAddress)).to.equal(ethers.constants.Zero);
    expect(await qToken.balanceOf(recipient)).to.equal(TEST_AMOUNT);
    expect(await qToken.allowance(userAddress, otherUserAddress)).to.equal(
      ethers.constants.Zero
    );
  });

  it("Should return the correct details of an option", async () => {
    expect(await qToken.getQTokenInfo()).to.eql(qTokenParams);
  });
});
