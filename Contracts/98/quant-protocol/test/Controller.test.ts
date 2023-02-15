import BN from "bignumber.js";
import { MockContract } from "ethereum-waffle";
import { ecsign } from "ethereumjs-util";
import {
  BigNumber,
  constants,
  ContractInterface,
  Signer,
  Wallet,
} from "ethers";
import { ethers, upgrades, waffle } from "hardhat";
import { beforeEach, describe } from "mocha";
import Web3 from "web3";
import ORACLE_MANAGER from "../artifacts/contracts/pricing/oracle/ChainlinkOracleManager.sol/ChainlinkOracleManager.json";
import PriceRegistry from "../artifacts/contracts/pricing/PriceRegistry.sol/PriceRegistry.json";
import {
  AssetsRegistry,
  OptionsFactory,
  OracleRegistry,
  QuantCalculator,
} from "../typechain";
import { CollateralToken } from "../typechain/CollateralToken";
import { Controller } from "../typechain/Controller";
import { ControllerV2 } from "../typechain/ControllerV2";
import { ExternalQToken } from "../typechain/ExternalQToken";
import { MockERC20 } from "../typechain/MockERC20";
import { QToken } from "../typechain/QToken";
import { QuantConfig } from "../typechain/QuantConfig";
import {
  encodeCallArgs,
  encodeClaimCollateralArgs,
  encodeCollateralTokenApprovalArgs,
  encodeExerciseArgs,
  encodeMintOptionArgs,
  encodeMintSpreadArgs,
  encodeNeutralizeArgs,
  encodeQTokenPermitArgs,
} from "./actionsUtils";
import { expect, provider } from "./setup";
import {
  deployAssetsRegistry,
  deployCollateralToken,
  deployOptionsFactory,
  deployOracleRegistry,
  deployQuantCalculator,
  deployQuantConfig,
  getApprovalDigest,
  getApprovalForAllSignedData,
  getSignedTransactionData,
  mockERC20,
  name,
  revertToSnapshot,
  takeSnapshot,
  version,
} from "./testUtils";

const { deployMockContract } = waffle;
const { AddressZero, Zero } = constants;

BN.config({ EXPONENTIAL_AT: 30 });

type optionParameters = [string, string, BigNumber, BigNumber, boolean];

type CollateralTokenParameters = [
  string,
  string,
  string,
  BigNumber,
  BigNumber,
  boolean
];

describe("Controller", async () => {
  let controller: Controller;
  let quantConfig: QuantConfig;
  let collateralToken: CollateralToken;
  let deployer: Wallet;
  let secondAccount: Wallet;
  let thirdAccount: Wallet;
  let assetsRegistryManager: Signer;
  let collateralMinter: Signer;
  let optionsMinter: Signer;
  let collateralCreator: Signer;
  let oracleManagerAccount: Signer;
  let WETH: MockERC20;
  let BUSD: MockERC20;
  let optionsFactory: OptionsFactory;
  let assetsRegistry: AssetsRegistry;
  let oracleRegistry: OracleRegistry;
  let mockOracleManager: MockContract;
  let mockOracleManagerTwo: MockContract;
  let futureTimestamp: number;
  let samplePutOptionParameters: optionParameters;
  let sampleCallOptionParameters: optionParameters;
  let qTokenPut1400: QToken;
  let qTokenPut400: QToken;
  let qTokenCall2000: QToken;
  let QTokenInterface: ContractInterface;
  let mockERC20Interface: ContractInterface;
  let qTokenCall2880: QToken;
  let qTokenCall3520: QToken;
  let mockPriceRegistry: MockContract;
  let nullQToken: QToken;
  let quantCalculator: QuantCalculator;

  const web3 = new Web3();

  const aMonth = 30 * 24 * 3600; // in seconds

  const getCollateralRequirement = async (
    qTokenToMint: QToken,
    qTokenForCollateral: QToken,
    optionsAmount: BigNumber,
    roundMode: BN.RoundingMode = BN.ROUND_CEIL
  ): Promise<[string, BigNumber]> => {
    let collateralPerOption;

    const qTokenToMintStrikePrice = new BN(
      await (await qTokenToMint.strikePrice()).toString()
    );
    let qTokenForCollateralStrikePrice = new BN(0);
    if (qTokenForCollateral.address !== AddressZero) {
      qTokenForCollateralStrikePrice = new BN(
        (await qTokenForCollateral.strikePrice()).toString()
      );
    }

    const underlying = <MockERC20>(
      new ethers.Contract(
        await qTokenToMint.underlyingAsset(),
        mockERC20Interface,
        provider
      )
    );

    if (await qTokenToMint.isCall()) {
      collateralPerOption = new BN(10).pow(await underlying.decimals());

      if (qTokenForCollateral.address !== AddressZero) {
        collateralPerOption = qTokenToMintStrikePrice.gt(
          qTokenForCollateralStrikePrice
        )
          ? new BN(0)
          : qTokenForCollateralStrikePrice
              .minus(qTokenToMintStrikePrice)
              .times(new BN(10).pow(18))
              .div(qTokenForCollateralStrikePrice);
      }
    } else {
      collateralPerOption = qTokenToMintStrikePrice;

      if (qTokenForCollateral.address !== AddressZero) {
        collateralPerOption = qTokenToMintStrikePrice.gt(
          qTokenForCollateralStrikePrice
        )
          ? qTokenToMintStrikePrice.minus(qTokenForCollateralStrikePrice) // PUT Credit Spread
          : new BN(0); // Put Debit Spread
      }
    }
    const collateralAmount = new BN(optionsAmount.toString())
      .times(collateralPerOption)
      .div(new BN(10).pow(18))
      .integerValue(roundMode);

    return [
      (await qTokenToMint.isCall())
        ? underlying.address
        : await qTokenToMint.strikeAsset(),
      BigNumber.from(collateralAmount.toString()),
    ];
  };

  const testMintingOptions = async (
    qTokenToMintAddress: string,
    optionsAmount: BigNumber,
    qTokenForCollateralAddress: string = AddressZero,
    accountToMintTo: string = secondAccount.address
  ) => {
    const qTokenToMint = <QToken>(
      new ethers.Contract(qTokenToMintAddress, QTokenInterface, provider)
    );

    const qTokenForCollateral = <QToken>(
      new ethers.Contract(qTokenForCollateralAddress, QTokenInterface, provider)
    );

    const [collateralAddress, collateralAmount] =
      await getCollateralRequirement(
        qTokenToMint,
        qTokenForCollateral,
        optionsAmount
      );

    expect(
      await quantCalculator.getCollateralRequirement(
        qTokenToMint.address,
        qTokenForCollateral.address,
        optionsAmount
      )
    ).to.eql([collateralAddress, collateralAmount]);

    // mint required collateral to the user account
    const collateral = collateralAddress === WETH.address ? WETH : BUSD;

    expect(await collateral.balanceOf(secondAccount.address)).to.equal(0);

    await collateral
      .connect(assetsRegistryManager)
      .mint(secondAccount.address, collateralAmount);

    expect(await collateral.balanceOf(secondAccount.address)).to.equal(
      collateralAmount
    );

    // Approve the Controller to use the user's funds
    await collateral
      .connect(secondAccount)
      .approve(controller.address, collateralAmount);

    // Check if it's a spread or a single option
    if (qTokenForCollateralAddress === AddressZero) {
      await expect(
        controller.connect(secondAccount).operate([
          encodeMintOptionArgs({
            to: accountToMintTo,
            qToken: qTokenToMintAddress,
            amount: optionsAmount,
          }),
        ])
      )
        .to.emit(controller, "OptionsPositionMinted")
        .withArgs(
          accountToMintTo,
          secondAccount.address,
          qTokenToMintAddress,
          optionsAmount,
          collateralAddress,
          collateralAmount
        );

      // Check that the user received the CollateralToken
      const collateralTokenId =
        await optionsFactory.qTokenAddressToCollateralTokenId(
          qTokenToMintAddress
        );

      expect(
        await collateralToken.balanceOf(accountToMintTo, collateralTokenId)
      ).to.equal(optionsAmount);
    } else {
      // Mint the qTokenForCollateral to the user address
      expect(
        await qTokenForCollateral.balanceOf(secondAccount.address)
      ).to.equal(ethers.BigNumber.from("0"));

      await qTokenForCollateral
        .connect(optionsMinter)
        .mint(secondAccount.address, optionsAmount);

      expect(
        await qTokenForCollateral.balanceOf(secondAccount.address)
      ).to.equal(optionsAmount);

      await expect(
        controller.connect(secondAccount).operate([
          encodeMintSpreadArgs({
            qTokenToMint: qTokenToMintAddress,
            qTokenForCollateral: qTokenForCollateralAddress,
            amount: optionsAmount,
          }),
        ])
      )
        .to.emit(controller, "SpreadMinted")
        .withArgs(
          secondAccount.address,
          qTokenToMintAddress,
          qTokenForCollateralAddress,
          optionsAmount,
          collateralAddress,
          collateralAmount
        );

      expect(
        await qTokenForCollateral.balanceOf(secondAccount.address)
      ).to.equal(ethers.BigNumber.from("0"));

      const collateralTokenId = await collateralToken.getCollateralTokenId(
        qTokenToMintAddress,
        qTokenForCollateral.address
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenId
        )
      ).to.equal(optionsAmount);
    }

    expect(await collateral.balanceOf(secondAccount.address)).to.equal(
      ethers.BigNumber.from("0")
    );

    expect(await collateral.balanceOf(controller.address)).to.equal(
      collateralAmount
    );

    // Check that the user received the QToken
    expect(await qTokenToMint.balanceOf(accountToMintTo)).to.equal(
      optionsAmount
    );
  };

  const testClaimCollateral = async (
    qTokenShort: QToken,
    amountToClaim: BigNumber,
    expiryPrice: BigNumber,
    qTokenLong: QToken = <QToken>(
      new ethers.Contract(AddressZero, QTokenInterface, provider)
    )
  ): Promise<string> => {
    await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

    //Note: Converts to the chainlink 8 decimal format
    await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
      expiryPrice.div((10 ** ((await BUSD.decimals()) - 8)).toString()),
      BigNumber.from(8),
    ]);

    const [collateralAddress, collateralRequirement] =
      await getCollateralRequirement(
        qTokenShort,
        qTokenLong,
        amountToClaim,
        BN.ROUND_CEIL
      );

    const collateral = collateralAddress === WETH.address ? WETH : BUSD;

    await collateral
      .connect(assetsRegistryManager)
      .mint(secondAccount.address, collateralRequirement);

    let qTokenAsCollateral;
    let collateralRequiredForLong = ethers.BigNumber.from("0");

    if (qTokenLong.address === AddressZero) {
      qTokenAsCollateral = AddressZero;

      await collateral
        .connect(secondAccount)
        .approve(controller.address, collateralRequirement);

      await controller.connect(secondAccount).operate([
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenShort.address,
          amount: amountToClaim,
        }),
      ]);
    } else {
      qTokenAsCollateral = qTokenLong.address;

      collateralRequiredForLong = (
        await getCollateralRequirement(
          qTokenLong,
          nullQToken,
          amountToClaim,
          BN.ROUND_CEIL
        )
      )[1];

      await collateral
        .connect(assetsRegistryManager)
        .mint(secondAccount.address, collateralRequiredForLong);

      await collateral
        .connect(secondAccount)
        .approve(
          controller.address,
          collateralRequirement.add(collateralRequiredForLong)
        );

      await controller.connect(secondAccount).operate([
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenLong.address,
          amount: amountToClaim,
        }),
      ]);

      await controller.connect(secondAccount).operate([
        encodeMintSpreadArgs({
          qTokenToMint: qTokenShort.address,
          qTokenForCollateral: qTokenLong.address,
          amount: amountToClaim,
        }),
      ]);
    }

    const collateralTokenId = await collateralToken.getCollateralTokenId(
      qTokenShort.address,
      qTokenAsCollateral
    );

    // Take a snapshot of the Hardhat Network
    const snapshotId = await takeSnapshot();

    // Increase time to one hour past the expiry
    await provider.send("evm_mine", [futureTimestamp + 3600]);

    const [payoutFromShort, payoutAsset] = await getPayout(
      qTokenShort,
      amountToClaim,
      expiryPrice,
      BN.ROUND_UP
    );

    const payoutFromLong =
      qTokenLong.address !== AddressZero
        ? (await getPayout(qTokenLong, amountToClaim, expiryPrice))[0]
        : ethers.BigNumber.from("0");

    const claimableCollateral = payoutFromLong
      .add(collateralRequirement)
      .sub(payoutFromShort);

    await controller.connect(secondAccount).operate([
      encodeClaimCollateralArgs({
        collateralTokenId,
        amount: amountToClaim,
      }),
    ]);

    const secondAccountCollateralClaimed = await payoutAsset.balanceOf(
      secondAccount.address
    );

    const secondAccountClaimedFundsLostRounding = claimableCollateral.sub(
      secondAccountCollateralClaimed
    );

    //some funds may be lost rounding. check its only 1 wei.
    expect(
      parseInt(secondAccountClaimedFundsLostRounding.toString())
    ).to.be.greaterThanOrEqual(0);

    expect(
      parseInt(secondAccountClaimedFundsLostRounding.toString())
    ).to.be.lessThanOrEqual(1);

    const controllerBalanceAfterClaim = await payoutAsset.balanceOf(
      controller.address
    );
    const intendedControllerBalanceAfterClaim = collateralRequirement
      .add(collateralRequiredForLong)
      .sub(claimableCollateral);

    //should ideally be 0, but can also be extra wei due to rounding
    const controllerExtraFunds = controllerBalanceAfterClaim.sub(
      intendedControllerBalanceAfterClaim
    );

    expect(parseInt(controllerExtraFunds.toString())).to.be.greaterThanOrEqual(
      0
    );
    expect(parseInt(controllerExtraFunds.toString())).to.be.lessThanOrEqual(1); //check the rounding is within 1 wei

    const strikePriceString = (await qTokenShort.strikePrice()).div(
      ethers.BigNumber.from("10").pow(await BUSD.decimals())
    );
    const qTokenShortString = `${strikePriceString}${
      (await qTokenShort.isCall()) ? "CALL" : "PUT"
    }`;

    const collateralRequirementString =
      parseInt(collateralRequirement.toString()) /
      10 ** (await collateral.decimals());

    const expiryPriceString = expiryPrice.div(
      ethers.BigNumber.from("10").pow(await BUSD.decimals())
    );

    const payoutFromShortString =
      parseInt(payoutFromShort.toString()) /
      10 ** (await payoutAsset.decimals());

    const claimableCollateralString = `${
      parseInt(
        new BN(claimableCollateral.toString())
          .integerValue(BN.ROUND_DOWN)
          .toString()
      ) /
      10 ** (await collateral.decimals())
    } ${payoutAsset.address === BUSD.address ? "BUSD" : "WETH"}`;

    const qTokenLongStrikePriceString =
      qTokenLong.address !== AddressZero
        ? (await qTokenLong.strikePrice())
            .div(ethers.BigNumber.from("10").pow(await BUSD.decimals()))
            .toString()
        : "0";

    console.log(
      `${qTokenShortString} -> CollateralToken(${qTokenShortString}, ${qTokenLongStrikePriceString}) costing ${collateralRequirementString} ${
        collateral.address === BUSD.address ? "BUSD" : "WETH"
      }`
    );
    console.log(
      `Expired at $${expiryPriceString}. Exercised for ${payoutFromShortString} ${
        payoutAsset.address === BUSD.address ? "BUSD" : "WETH"
      } so the user is entitled to ~ ${claimableCollateralString}`
    );

    return snapshotId;
  };

  const getPayout = async (
    qToken: QToken,
    amount: BigNumber,
    expiryPrice: BigNumber,
    roundMode: BN.RoundingMode = BN.ROUND_DOWN
  ): Promise<[BigNumber, MockERC20]> => {
    const strikePrice = await qToken.strikePrice();
    const payoutDecimals = await WETH.decimals();
    const optionsDecimals = 18;

    let payoutAmount: BN;
    let payoutToken: MockERC20;

    if (await qToken.isCall()) {
      payoutAmount = expiryPrice.gt(strikePrice)
        ? new BN(expiryPrice.toString())
            .minus(new BN(strikePrice.toString()))
            .times(new BN(amount.toString()))
            .div(new BN(expiryPrice.toString()))
            .times(new BN(10).pow(payoutDecimals))
            .div(new BN(10).pow(optionsDecimals))
        : new BN(0);

      payoutToken = WETH;
    } else {
      payoutAmount = strikePrice.gt(expiryPrice)
        ? new BN(strikePrice.toString())
            .minus(new BN(expiryPrice.toString()))
            .times(new BN(amount.toString()))
            .div(new BN(10).pow(optionsDecimals))
        : new BN(0);

      payoutToken = BUSD;
    }

    payoutAmount = payoutAmount.integerValue(roundMode);

    return [BigNumber.from(payoutAmount.toString()), payoutToken];
  };

  const testSetup = async (busdDecimals = 18) => {
    [
      deployer,
      secondAccount,
      thirdAccount,
      assetsRegistryManager,
      collateralMinter,
      optionsMinter,
      collateralCreator,
      oracleManagerAccount,
    ] = provider.getWallets();

    quantConfig = await deployQuantConfig(deployer, [
      {
        addresses: [await assetsRegistryManager.getAddress()],
        role: "ASSETS_REGISTRY_MANAGER_ROLE",
      },
      {
        addresses: [
          await collateralMinter.getAddress(),
          await assetsRegistryManager.getAddress(),
        ],
        role: "COLLATERAL_MINTER_ROLE",
      },
      {
        addresses: [await optionsMinter.getAddress()],
        role: "OPTIONS_MINTER_ROLE",
      },
      {
        addresses: [await collateralCreator.getAddress()],
        role: "COLLATERAL_CREATOR_ROLE",
      },
      {
        addresses: [await oracleManagerAccount.getAddress()],
        role: "ORACLE_MANAGER_ROLE",
      },
    ]);

    WETH = await mockERC20(assetsRegistryManager, "WETH", "Wrapped Ether");
    BUSD = await mockERC20(
      assetsRegistryManager,
      "BUSD",
      "BUSD Token",
      busdDecimals
    );
    collateralToken = await deployCollateralToken(deployer, quantConfig);

    assetsRegistry = await deployAssetsRegistry(deployer, quantConfig);

    oracleRegistry = await deployOracleRegistry(deployer, quantConfig);

    mockOracleManager = await deployMockContract(deployer, ORACLE_MANAGER.abi);

    mockOracleManagerTwo = await deployMockContract(
      deployer,
      ORACLE_MANAGER.abi
    );

    await assetsRegistry
      .connect(assetsRegistryManager)
      .addAsset(
        WETH.address,
        await WETH.name(),
        await WETH.symbol(),
        await WETH.decimals()
      );

    await assetsRegistry
      .connect(assetsRegistryManager)
      .addAsset(
        BUSD.address,
        await BUSD.name(),
        await BUSD.symbol(),
        busdDecimals
      );

    QTokenInterface = (await ethers.getContractFactory("QToken")).interface;

    mockERC20Interface = (await ethers.getContractFactory("MockERC20"))
      .interface;

    optionsFactory = await deployOptionsFactory(
      deployer,
      BUSD.address,
      quantConfig,
      collateralToken
    );

    // 30 days from now
    futureTimestamp = Math.floor(Date.now() / 1000) + aMonth;

    samplePutOptionParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.utils.parseUnits("1400", busdDecimals),
      ethers.BigNumber.from(futureTimestamp),
      false,
    ];
    const qTokenPut1400Address = await optionsFactory.getTargetQTokenAddress(
      ...samplePutOptionParameters
    );

    await quantConfig
      .connect(deployer)
      .setProtocolRole("COLLATERAL_CREATOR_ROLE", optionsFactory.address);

    await quantConfig
      .connect(deployer)
      .setProtocolRole("PRICE_SUBMITTER_ROLE", oracleRegistry.address);

    await quantConfig
      .connect(deployer)
      .setProtocolRole("PRICE_SUBMITTER_ROLE_ADMIN", oracleRegistry.address);

    await quantConfig
      .connect(deployer)
      .setRoleAdmin(
        ethers.utils.id("PRICE_SUBMITTER_ROLE"),
        ethers.utils.id("PRICE_SUBMITTER_ROLE_ADMIN")
      );

    await oracleRegistry
      .connect(oracleManagerAccount)
      .addOracle(mockOracleManager.address);

    await oracleRegistry
      .connect(oracleManagerAccount)
      .addOracle(mockOracleManagerTwo.address);

    await oracleRegistry
      .connect(oracleManagerAccount)
      .activateOracle(mockOracleManager.address);

    await oracleRegistry
      .connect(oracleManagerAccount)
      .activateOracle(mockOracleManagerTwo.address);

    //Note: returning any address here to show existence of the oracle
    await mockOracleManager.mock.getAssetOracle.returns(
      mockOracleManager.address
    );

    await mockOracleManager.mock.isValidOption.returns(true);

    //Note: returning any address here to show existence of the oracle
    await mockOracleManagerTwo.mock.getAssetOracle.returns(
      mockOracleManagerTwo.address
    );

    await mockOracleManagerTwo.mock.isValidOption.returns(true);

    await optionsFactory
      .connect(secondAccount)
      .createOption(...samplePutOptionParameters);

    qTokenPut1400 = <QToken>(
      new ethers.Contract(qTokenPut1400Address, QTokenInterface, provider)
    );

    sampleCallOptionParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.utils.parseUnits("2000", busdDecimals),
      ethers.BigNumber.from(futureTimestamp),
      true,
    ];

    const qTokenCall2000Address = await optionsFactory.getTargetQTokenAddress(
      ...sampleCallOptionParameters
    );

    await optionsFactory
      .connect(secondAccount)
      .createOption(...sampleCallOptionParameters);

    qTokenCall2000 = <QToken>(
      new ethers.Contract(qTokenCall2000Address, QTokenInterface, provider)
    );

    const qTokenCall2880Parameters: optionParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.utils.parseUnits("2880", busdDecimals),
      ethers.BigNumber.from(futureTimestamp),
      true,
    ];

    await optionsFactory
      .connect(secondAccount)
      .createOption(...qTokenCall2880Parameters);

    qTokenCall2880 = <QToken>(
      new ethers.Contract(
        await optionsFactory.getTargetQTokenAddress(
          ...qTokenCall2880Parameters
        ),
        QTokenInterface,
        provider
      )
    );

    const qTokenCall3520Parameters: optionParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.utils.parseUnits("3520", busdDecimals),
      ethers.BigNumber.from(futureTimestamp),
      true,
    ];

    await optionsFactory
      .connect(secondAccount)
      .createOption(...qTokenCall3520Parameters);

    qTokenCall3520 = <QToken>(
      new ethers.Contract(
        await optionsFactory.getTargetQTokenAddress(
          ...qTokenCall3520Parameters
        ),
        QTokenInterface,
        provider
      )
    );

    const qTokenPut400Parameters: optionParameters = [
      WETH.address,
      mockOracleManager.address,
      ethers.utils.parseUnits("400", busdDecimals),
      ethers.BigNumber.from(futureTimestamp),
      false,
    ];

    await optionsFactory
      .connect(secondAccount)
      .createOption(...qTokenPut400Parameters);

    qTokenPut400 = <QToken>(
      new ethers.Contract(
        await optionsFactory.getTargetQTokenAddress(...qTokenPut400Parameters),
        QTokenInterface,
        provider
      )
    );

    nullQToken = <QToken>(
      new ethers.Contract(AddressZero, QTokenInterface, provider)
    );

    const Controller = await ethers.getContractFactory("Controller");

    quantCalculator = await deployQuantCalculator(
      deployer,
      busdDecimals,
      optionsFactory.address
    );

    controller = <Controller>(
      await upgrades.deployProxy(Controller, [
        name,
        version,
        optionsFactory.address,
        quantCalculator.address,
      ])
    );

    await quantConfig
      .connect(deployer)
      .setProtocolRole("OPTIONS_MINTER_ROLE", controller.address);

    await quantConfig
      .connect(deployer)
      .setProtocolRole("OPTIONS_BURNER_ROLE", controller.address);

    await quantConfig
      .connect(deployer)
      .setProtocolRole("COLLATERAL_CREATOR_ROLE", controller.address);

    await quantConfig
      .connect(deployer)
      .setProtocolRole("COLLATERAL_MINTER_ROLE", controller.address);

    await quantConfig
      .connect(deployer)
      .setProtocolRole("COLLATERAL_BURNER_ROLE", controller.address);

    await quantConfig
      .connect(deployer)
      .setProtocolAddress(
        ethers.utils.id("assetsRegistry"),
        assetsRegistry.address
      );

    mockPriceRegistry = await deployMockContract(deployer, PriceRegistry.abi);

    await quantConfig
      .connect(deployer)
      .setProtocolAddress(
        ethers.utils.id("priceRegistry"),
        mockPriceRegistry.address
      );
  };

  beforeEach(testSetup);

  describe("neutralizePosition", () => {
    it("Should revert when users try to neutralize more options than they have", async () => {
      await expect(
        controller.connect(secondAccount).operate([
          encodeNeutralizeArgs({
            collateralTokenId: await collateralToken.getCollateralTokenId(
              qTokenCall3520.address,
              AddressZero
            ),
            amount: ethers.utils.parseEther("4"),
          }),
        ])
      ).to.be.revertedWith("Controller: Tried to neutralize more than balance");
    });

    it("Users should be able to neutralize some of their position", async () => {
      const optionsAmount = ethers.utils.parseEther("5");

      const [, collateralRequirement] = await getCollateralRequirement(
        qTokenPut1400,
        nullQToken,
        optionsAmount,
        BN.ROUND_DOWN
      );

      expect(collateralRequirement).to.equal(
        ethers.utils.parseUnits("7000", await BUSD.decimals())
      );

      await BUSD.connect(assetsRegistryManager).mint(
        secondAccount.address,
        collateralRequirement
      );

      await BUSD.connect(secondAccount).approve(
        controller.address,
        collateralRequirement
      );

      await controller.connect(secondAccount).operate([
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenPut1400.address,
          amount: optionsAmount,
        }),
      ]);

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(Zero);

      const collateralTokenId = await collateralToken.getCollateralTokenId(
        qTokenPut1400.address,
        AddressZero
      );

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        optionsAmount
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenId
        )
      ).to.equal(optionsAmount);

      const amountToNeutralize = ethers.utils.parseEther("3");

      await controller.connect(secondAccount).operate([
        encodeNeutralizeArgs({
          collateralTokenId,
          amount: amountToNeutralize,
        }),
      ]);

      const remainingAmount = optionsAmount.sub(amountToNeutralize);
      expect(remainingAmount).to.equal(ethers.utils.parseEther("2"));

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        remainingAmount
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenId
        )
      ).to.equal(remainingAmount);

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        ethers.utils.parseUnits("4200", await BUSD.decimals())
      );

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        ethers.utils.parseUnits("2800", await BUSD.decimals())
      );
    });

    it("Users should be able to neutralize all of their position, and get the long QToken back from a spread", async () => {
      const optionsAmount = ethers.utils.parseEther("5");

      const [, spreadCollateralRequirement] = await getCollateralRequirement(
        qTokenPut1400,
        qTokenPut400,
        optionsAmount
      );

      expect(spreadCollateralRequirement).to.equal(
        ethers.utils.parseUnits("5000", await BUSD.decimals())
      );

      const [, longCollateralRequirement] = await getCollateralRequirement(
        qTokenPut400,
        nullQToken,
        optionsAmount
      );

      expect(longCollateralRequirement).to.equal(
        ethers.utils.parseUnits("2000", await BUSD.decimals())
      );

      await BUSD.connect(assetsRegistryManager).mint(
        secondAccount.address,
        spreadCollateralRequirement.add(longCollateralRequirement)
      );

      await BUSD.connect(secondAccount).approve(
        controller.address,
        spreadCollateralRequirement.add(longCollateralRequirement)
      );

      await controller.connect(secondAccount).operate([
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenPut400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenForLong = await collateralToken.getCollateralTokenId(
        qTokenPut400.address,
        AddressZero
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForLong
        )
      ).to.equal(optionsAmount);

      expect(await qTokenPut400.balanceOf(secondAccount.address)).to.equal(
        optionsAmount
      );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        spreadCollateralRequirement
      );

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        longCollateralRequirement
      );

      await controller.connect(secondAccount).operate([
        encodeMintSpreadArgs({
          qTokenToMint: qTokenPut1400.address,
          qTokenForCollateral: qTokenPut400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenForSpread =
        await collateralToken.getCollateralTokenId(
          qTokenPut1400.address,
          qTokenPut400.address
        );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForLong
        )
      ).to.equal(optionsAmount);

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForSpread
        )
      ).to.equal(optionsAmount);

      expect(await qTokenPut400.balanceOf(secondAccount.address)).to.equal(
        Zero
      );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(Zero);

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        longCollateralRequirement.add(spreadCollateralRequirement)
      );

      const [collateralAsset, collateralOwed] = await getCollateralRequirement(
        qTokenPut1400,
        qTokenPut400,
        optionsAmount,
        BN.ROUND_DOWN
      );

      expect(collateralOwed).to.equal(spreadCollateralRequirement);

      await expect(
        controller.connect(secondAccount).operate([
          encodeNeutralizeArgs({
            collateralTokenId: collateralTokenForSpread,
            amount: Zero,
          }),
        ])
      )
        .to.emit(controller, "NeutralizePosition")
        .withArgs(
          secondAccount.address,
          qTokenPut1400.address,
          optionsAmount,
          collateralOwed,
          collateralAsset,
          qTokenPut400.address
        );

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        Zero
      );

      expect(await qTokenPut400.balanceOf(secondAccount.address)).to.equal(
        optionsAmount
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForSpread
        )
      ).to.equal(Zero);

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForLong
        )
      ).to.equal(optionsAmount);

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        collateralOwed
      );

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        longCollateralRequirement
      );
    });

    it("Users should be able to neutralize some of their position, and get the long QToken back from a spread when the collateral requirement is 0", async () => {
      const optionsAmount = ethers.utils.parseEther("5");
      const amountToNeutralize = ethers.utils.parseEther("3");

      const [, spreadCollateralRequirement] = await getCollateralRequirement(
        qTokenPut400,
        qTokenPut1400,
        optionsAmount
      );

      expect(spreadCollateralRequirement).to.equal(
        ethers.utils.parseUnits("0", await BUSD.decimals())
      );

      const [, longCollateralRequirement] = await getCollateralRequirement(
        qTokenPut1400,
        nullQToken,
        optionsAmount
      );

      expect(longCollateralRequirement).to.equal(
        ethers.utils.parseUnits("7000", await BUSD.decimals())
      );

      await BUSD.connect(assetsRegistryManager).mint(
        secondAccount.address,
        spreadCollateralRequirement.add(longCollateralRequirement)
      );

      await BUSD.connect(secondAccount).approve(
        controller.address,
        spreadCollateralRequirement.add(longCollateralRequirement)
      );

      await controller.connect(secondAccount).operate([
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenPut1400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenForLong = await collateralToken.getCollateralTokenId(
        qTokenPut1400.address,
        AddressZero
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForLong
        )
      ).to.equal(optionsAmount);

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        optionsAmount
      );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        spreadCollateralRequirement
      );

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        longCollateralRequirement
      );

      await controller.connect(secondAccount).operate([
        encodeMintSpreadArgs({
          qTokenToMint: qTokenPut400.address,
          qTokenForCollateral: qTokenPut1400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenForSpread =
        await collateralToken.getCollateralTokenId(
          qTokenPut400.address,
          qTokenPut1400.address
        );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForLong
        )
      ).to.equal(optionsAmount);

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForSpread
        )
      ).to.equal(optionsAmount);

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        Zero
      );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(Zero);

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        longCollateralRequirement.add(spreadCollateralRequirement)
      );

      const [collateralAsset, collateralOwed] = await getCollateralRequirement(
        qTokenPut400,
        qTokenPut1400,
        amountToNeutralize,
        BN.ROUND_DOWN
      );

      expect(collateralOwed).to.equal(Zero);

      await expect(
        controller.connect(secondAccount).operate([
          encodeNeutralizeArgs({
            collateralTokenId: collateralTokenForSpread,
            amount: amountToNeutralize,
          }),
        ])
      )
        .to.emit(controller, "NeutralizePosition")
        .withArgs(
          secondAccount.address,
          qTokenPut400.address,
          amountToNeutralize,
          collateralOwed,
          collateralAsset,
          qTokenPut1400.address
        );

      expect(await qTokenPut400.balanceOf(secondAccount.address)).to.equal(
        optionsAmount.sub(amountToNeutralize)
      );

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        amountToNeutralize
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForSpread
        )
      ).to.equal(optionsAmount.sub(amountToNeutralize));

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenForLong
        )
      ).to.equal(optionsAmount);

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        collateralOwed
      );

      expect(collateralOwed).to.equal(Zero);

      expect(await BUSD.balanceOf(controller.address)).to.equal(
        longCollateralRequirement
      );
    });

    it("Should round in favour of the protocol when neutralizing positions", async () => {
      await testSetup(6);

      //1400 USD strike -> 1400 * 10^6 = 10^9
      //1 OPTION REQUIRES 1.4 * 10^9
      //10^18 OPTION REQUIRES 1.4 * 10^9
      //1.4 WEI OF BUSD NEEDED PER 10^9 options
      //3.5 WEI of BUSD NEEDED FOR 2.5 * 10^9
      //4 WEI WHEN ROUNDED UP (MINT) FOR 2.5 * 10^9 OPTIONS
      //3 WEI WHEN ROUNDED DOWN (NEUTRALIZE) FOR 2.5 * 10^9 OPTIONS

      const optionsAmount = ethers.utils.parseUnits("2.5", 9);

      const [, collateralRequirement] = await getCollateralRequirement(
        qTokenPut1400,
        nullQToken,
        optionsAmount,
        BN.ROUND_UP
      );

      expect(collateralRequirement).to.equal(4);

      await BUSD.connect(assetsRegistryManager).mint(
        secondAccount.address,
        collateralRequirement
      );

      await BUSD.connect(secondAccount).approve(
        controller.address,
        collateralRequirement
      );

      await controller.connect(secondAccount).operate([
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenPut1400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenId = await collateralToken.getCollateralTokenId(
        qTokenPut1400.address,
        AddressZero
      );

      await controller.connect(secondAccount).operate([
        encodeNeutralizeArgs({
          collateralTokenId,
          amount: optionsAmount,
        }),
      ]);

      expect(await qTokenPut1400.balanceOf(secondAccount.address)).to.equal(
        Zero
      );

      expect(
        await collateralToken.balanceOf(
          secondAccount.address,
          collateralTokenId
        )
      ).to.equal(Zero);

      const [, collateralOwed] = await getCollateralRequirement(
        qTokenPut1400,
        nullQToken,
        optionsAmount,
        BN.ROUND_DOWN
      );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        collateralOwed
      );
      expect(await BUSD.balanceOf(controller.address)).to.equal(
        collateralRequirement.sub(collateralOwed)
      );
      expect(collateralOwed).to.equal(3);
    });
  });

  describe("mintOptionsPosition", () => {
    it("Should revert when trying to mint an option which has an oracle which is deactivated", async () => {
      await oracleRegistry
        .connect(oracleManagerAccount)
        .deactivateOracle(mockOracleManager.address);

      await expect(
        controller.connect(secondAccount).operate([
          encodeMintOptionArgs({
            to: secondAccount.address,
            qToken: qTokenCall2000.address,
            amount: ethers.BigNumber.from("10"),
          }),
        ])
      ).to.be.revertedWith(
        "Controller: Can't mint an options position as the oracle is inactive"
      );
    });

    it("Should revert when trying to mint a non-existent option", async () => {
      await expect(
        controller.connect(secondAccount).operate([
          encodeMintOptionArgs({
            to: secondAccount.address,
            qToken: AddressZero,
            amount: ethers.BigNumber.from("10"),
          }),
        ])
      ).to.be.revertedWith("QuantCalculator: Invalid QToken address");
    });

    it("Should revert when trying to mint an already expired option", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await expect(
        controller.connect(secondAccount).operate([
          encodeMintOptionArgs({
            to: secondAccount.address,
            qToken: qTokenPut1400.address,
            amount: ethers.BigNumber.from("10"),
          }),
        ])
      ).to.be.revertedWith("Controller: Cannot mint expired options");

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to mint CALL options positions to their own address", async () => {
      await testMintingOptions(
        qTokenCall2000.address,
        ethers.utils.parseEther("2")
      );
    });

    it("Users should be able to mint PUT options positions to their own address", async () => {
      await testMintingOptions(
        qTokenPut1400.address,
        ethers.utils.parseEther("2")
      );
    });

    it("Users should be able to mint CALL options positions to another address", async () => {
      await testMintingOptions(
        qTokenCall2000.address,
        ethers.utils.parseEther("2"),
        AddressZero,
        thirdAccount.address
      );
    });

    it("Users should be able to mint PUT options positions to another address", async () => {
      await testMintingOptions(
        qTokenPut1400.address,
        ethers.utils.parseEther("2"),
        AddressZero,
        thirdAccount.address
      );
    });
  });

  describe("mintSpread", () => {
    it("Should revert when trying to create spreads from options with different oracles", async () => {
      const qTokenParams: optionParameters = [
        WETH.address,
        mockOracleManager.address,
        ethers.utils.parseUnits("1400", await BUSD.decimals()),
        ethers.BigNumber.from(futureTimestamp + 3600 * 24 * 30),
        false,
      ];

      const qTokenParamsDifferentOracle: optionParameters = [...qTokenParams];

      qTokenParamsDifferentOracle[1] = mockOracleManagerTwo.address;

      const qTokenOracleOne = await optionsFactory.getTargetQTokenAddress(
        ...qTokenParams
      );

      const qTokenOracleTwo = await optionsFactory.getTargetQTokenAddress(
        ...qTokenParamsDifferentOracle
      );

      await optionsFactory.connect(secondAccount).createOption(...qTokenParams);

      await optionsFactory
        .connect(secondAccount)
        .createOption(...qTokenParamsDifferentOracle);

      await expect(
        controller.connect(secondAccount).operate([
          encodeMintSpreadArgs({
            qTokenToMint: qTokenOracleOne,
            qTokenForCollateral: qTokenOracleTwo,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith(
        "Controller: Can't create spreads from options with different oracles"
      );
    });

    it("Should revert when trying to create spreads from options with different expiries", async () => {
      const qTokenParams: optionParameters = [
        WETH.address,
        mockOracleManager.address,
        ethers.utils.parseUnits("1400", await BUSD.decimals()),
        ethers.BigNumber.from(futureTimestamp + 3600 * 24 * 30),
        false,
      ];
      const qTokenPutDifferentExpiry =
        await optionsFactory.getTargetQTokenAddress(...qTokenParams);

      await optionsFactory.connect(secondAccount).createOption(...qTokenParams);

      await expect(
        controller.connect(secondAccount).operate([
          encodeMintSpreadArgs({
            qTokenToMint: qTokenPutDifferentExpiry,
            qTokenForCollateral: qTokenPut1400.address,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith(
        "Controller: Can't create spreads from options with different expiries"
      );
    });

    it("Should revert when trying to create spreads from options with different underlying assets", async () => {
      const qTokenParams: optionParameters = [
        BUSD.address,
        mockOracleManager.address,
        ethers.utils.parseUnits("5000", await BUSD.decimals()),
        ethers.BigNumber.from(futureTimestamp),
        true,
      ];
      const qTokenCallDifferentUnderlying =
        await optionsFactory.getTargetQTokenAddress(...qTokenParams);

      await optionsFactory.createOption(...qTokenParams);

      await expect(
        controller.connect(secondAccount).operate([
          encodeMintSpreadArgs({
            qTokenToMint: qTokenCallDifferentUnderlying,
            qTokenForCollateral: qTokenCall3520.address,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith(
        "Controller: Can't create spreads from options with different underlying assets"
      );
    });

    it("Should revert when trying to create spreads with the same short and long qTokens", async () => {
      await expect(
        controller.connect(secondAccount).operate([
          encodeMintSpreadArgs({
            qTokenToMint: qTokenCall2000.address,
            qTokenForCollateral: qTokenCall2000.address,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith(
        "Controller: Can only create a spread with different tokens"
      );
    });

    it("Users should be able to create a PUT Credit spread", async () => {
      await testMintingOptions(
        qTokenPut1400.address,
        ethers.utils.parseEther("1"),
        qTokenPut400.address
      );
    });

    it("Users should be able to create a PUT Debit spread", async () => {
      await testMintingOptions(
        qTokenPut400.address,
        ethers.utils.parseEther("2"),
        qTokenPut1400.address
      );
    });

    it("Users should be able to create a CALL Credit Spread", async () => {
      await testMintingOptions(
        qTokenCall2880.address,
        ethers.utils.parseEther("1"),
        qTokenCall3520.address
      );
    });

    it("Users should be able to create a CALL Debit Spread", async () => {
      await testMintingOptions(
        qTokenCall3520.address,
        ethers.utils.parseEther("1"),
        qTokenCall2880.address
      );
    });

    it("Spreads should be created correctly when the CollateralToken had already been created before", async () => {
      await collateralToken
        .connect(collateralCreator)
        .createCollateralToken(qTokenCall2000.address, qTokenCall2880.address);

      await testMintingOptions(
        qTokenCall2000.address,
        ethers.utils.parseEther("1"),
        qTokenCall2880.address
      );
    });
  });

  describe("exercise", () => {
    it("Should revert when trying to exercise a non-expired option", async () => {
      await expect(
        controller.connect(secondAccount).operate([
          encodeExerciseArgs({
            qToken: qTokenPut1400.address,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith(
        "Controller: Can not exercise options before their expiry"
      );
    });

    it("Should revert when trying to exercise unsettled options", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(false);

      await expect(
        controller.connect(secondAccount).operate([
          encodeExerciseArgs({
            qToken: qTokenPut1400.address,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith("Controller: Cannot exercise unsettled options");

      await revertToSnapshot(snapshotId);
    });

    it("Users should be able to exercise PUT options", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

      //Note: Converts to the chainlink 8 decimal format
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        ethers.utils.parseUnits("1200", 8),
        BigNumber.from(8),
      ]);

      // Mint options to the user
      const optionsAmount = ethers.utils.parseEther("1");
      const qTokenToExercise = qTokenPut1400;
      await qTokenToExercise
        .connect(optionsMinter)
        .mint(secondAccount.address, optionsAmount);

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      expect(await qTokenToExercise.balanceOf(secondAccount.address)).to.equal(
        optionsAmount
      );

      const payoutAmount = (
        await quantCalculator.getExercisePayout(
          qTokenToExercise.address,
          optionsAmount
        )
      ).payoutAmount;

      // Mint BUSD to the Controller so it can pay the user
      await BUSD.connect(deployer).mint(controller.address, payoutAmount);
      expect(await BUSD.balanceOf(controller.address)).to.equal(payoutAmount);

      await expect(
        controller.connect(secondAccount).operate([
          encodeExerciseArgs({
            qToken: qTokenToExercise.address,
            amount: optionsAmount,
          }),
        ])
      )
        .to.emit(controller, "OptionsExercised")
        .withArgs(
          secondAccount.address,
          qTokenToExercise.address,
          optionsAmount,
          payoutAmount,
          BUSD.address
        );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        payoutAmount
      );
      expect(await BUSD.balanceOf(controller.address)).to.equal(
        ethers.BigNumber.from("0")
      );
      expect(await qTokenToExercise.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to exercise CALL options", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

      //Note: Converts to the chainlink 8 decimal format
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        ethers.utils.parseUnits("2500", 8),
        BigNumber.from(8),
      ]);

      // Mint options to the user
      const optionsAmount = ethers.utils.parseEther("2");
      const qTokenToExercise = qTokenCall2000;
      await qTokenToExercise
        .connect(optionsMinter)
        .mint(secondAccount.address, optionsAmount);

      expect(await WETH.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      expect(await qTokenToExercise.balanceOf(secondAccount.address)).to.equal(
        optionsAmount
      );

      const payoutAmount = (
        await quantCalculator.getExercisePayout(
          qTokenToExercise.address,
          optionsAmount
        )
      ).payoutAmount;

      // Mint WETH to the Controller so it can pay the user
      await WETH.connect(assetsRegistryManager).mint(
        controller.address,
        payoutAmount
      );
      expect(await WETH.balanceOf(controller.address)).to.equal(payoutAmount);

      await expect(
        controller.connect(secondAccount).operate([
          encodeExerciseArgs({
            qToken: qTokenToExercise.address,
            amount: Zero,
          }),
        ])
      )
        .to.emit(controller, "OptionsExercised")
        .withArgs(
          secondAccount.address,
          qTokenToExercise.address,
          optionsAmount,
          payoutAmount,
          WETH.address
        );

      expect(await WETH.balanceOf(secondAccount.address)).to.equal(
        payoutAmount
      );
      expect(await WETH.balanceOf(controller.address)).to.equal(
        ethers.BigNumber.from("0")
      );
      expect(await qTokenToExercise.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      revertToSnapshot(snapshotId);
    });

    it("Should revert when a user tries to exercise an amount of options that exceeds his balance", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

      //Note: Converts to the chainlink 8 decimal format
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        ethers.utils.parseUnits("200", 8),
        8,
      ]);

      await expect(
        controller.connect(secondAccount).operate([
          encodeExerciseArgs({
            qToken: qTokenPut1400.address,
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");

      revertToSnapshot(snapshotId);
    });

    it("Burns the QTokens but don't transfer anything when options expire OTM", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

      //Note: Converts to the chainlink 8 decimal format
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        ethers.utils.parseUnits("1800", 8),
        8,
      ]);

      // Mint options to the user
      const optionsAmount = ethers.utils.parseEther("3");
      const qTokenToExercise = qTokenCall2000;
      await qTokenToExercise
        .connect(optionsMinter)
        .mint(secondAccount.address, optionsAmount);

      await controller.connect(secondAccount).operate([
        encodeExerciseArgs({
          qToken: qTokenToExercise.address,
          amount: optionsAmount,
        }),
      ]);

      expect(await qTokenToExercise.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      expect(await WETH.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      revertToSnapshot(snapshotId);
    });

    it("QTokens that are not created through the OptionsFactory should not be able to be exercised", async () => {
      const optionsAmount = ethers.utils.parseEther("15");

      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Simulate some user minting real options through the Controller
      // (i.e., QTokens that were created with the OptionsFactory createOption method)
      const mintActions = [
        encodeMintOptionArgs({
          to: deployer.address,
          qToken: qTokenPut1400.address,
          amount: optionsAmount.toString(),
        }),
        encodeMintOptionArgs({
          to: deployer.address,
          qToken: qTokenPut400.address,
          amount: optionsAmount.toString(),
        }),
      ];
      const [, firstCollateralAmount] = await getCollateralRequirement(
        qTokenPut1400,
        nullQToken,
        optionsAmount
      );
      const [, secondCollateralRequirement] = await getCollateralRequirement(
        qTokenPut400,
        nullQToken,
        optionsAmount
      );
      const totalCollateralRequirement = firstCollateralAmount.add(
        secondCollateralRequirement
      );
      const collateral = BUSD;
      await collateral
        .connect(assetsRegistryManager)
        .mint(deployer.address, totalCollateralRequirement);
      await collateral
        .connect(deployer)
        .approve(controller.address, totalCollateralRequirement);
      await controller.connect(deployer).operate(mintActions);
      expect(await BUSD.balanceOf(controller.address)).to.equal(
        totalCollateralRequirement
      );
      expect(await qTokenPut1400.balanceOf(deployer.address)).to.equal(
        optionsAmount
      );

      expect(await qTokenPut400.balanceOf(deployer.address)).to.equal(
        optionsAmount
      );

      // Now we simulate the first option (PUT 1400) expiring ITM
      await provider.send("evm_mine", [futureTimestamp + 3600]);
      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        ethers.utils.parseUnits("800", 8), // Chainlink ETH/USD oracle has 8 decimals
        BigNumber.from(8),
      ]);

      // A user now comes and deploy a contract that adheres to the IQToken interface,
      // or that simply inherits from the QToken contrac
      const ExternalQToken = await ethers.getContractFactory("ExternalQToken");
      const externalStrikePrice = ethers.utils.parseUnits(
        "2600",
        await BUSD.decimals()
      );
      const externalQToken = <ExternalQToken>(
        await ExternalQToken.connect(secondAccount).deploy(
          await qTokenPut1400.quantConfig(),
          await qTokenPut1400.underlyingAsset(),
          await qTokenPut400.strikeAsset(),
          await qTokenPut1400.oracle(),
          externalStrikePrice,
          await qTokenPut1400.expiryTime(),
          await qTokenPut400.isCall()
        )
      );

      // He then mints some of his new, malicious QToken
      await externalQToken
        .connect(secondAccount)
        .permissionlessMint(secondAccount.address, optionsAmount);

      // The malicious user should not be able to exercise his external QToken
      const exerciseAction = encodeExerciseArgs({
        qToken: externalQToken.address,
        amount: optionsAmount.toString(),
      });
      await expect(
        controller.connect(secondAccount).operate([exerciseAction])
      ).to.be.revertedWith("QuantCalculator: Invalid QToken address");

      revertToSnapshot(snapshotId);
    });
  });

  describe("claimCollateral", () => {
    it("Should revert when trying to claim collateral from an invalid CollateralToken", async () => {
      await expect(
        controller.connect(secondAccount).operate([
          encodeClaimCollateralArgs({
            collateralTokenId: ethers.BigNumber.from("123"),
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith("Can not claim collateral from non-existing option");
    });

    it("Should revert when trying to claim collateral from options before their expiry", async () => {
      await expect(
        controller.connect(secondAccount).operate([
          encodeClaimCollateralArgs({
            collateralTokenId: await collateralToken.getCollateralTokenId(
              qTokenPut400.address,
              AddressZero
            ),
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith(
        "Can not claim collateral from options before their expiry"
      );
    });

    it("Should revert when trying to claim collateral from options before their expiry price is settled", async () => {
      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(false);

      await expect(
        controller.connect(secondAccount).operate([
          encodeClaimCollateralArgs({
            collateralTokenId: await collateralToken.getCollateralTokenId(
              qTokenPut400.address,
              AddressZero
            ),
            amount: ethers.utils.parseEther("1"),
          }),
        ])
      ).to.be.revertedWith("Can not claim collateral before option is settled");

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT options that expired ITM", async () => {
      const expiryPrice = ethers.utils.parseUnits("300", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut400,
        ethers.utils.parseEther("1"),
        expiryPrice
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT options that expired OTM", async () => {
      const expiryPrice = ethers.utils.parseUnits("500", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut400,
        ethers.utils.parseEther("1"),
        expiryPrice
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT options that expired ATM", async () => {
      const expiryPrice = ethers.utils.parseUnits("400", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut400,
        ethers.utils.parseEther("1"),
        expiryPrice
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL options that expired ITM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "2500",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2000,
        ethers.utils.parseEther("1"),
        expiryPrice
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL options that expired OTM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "1800",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2000,
        ethers.utils.parseEther("1"),
        expiryPrice
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL options that expired ATM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "2000",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2000,
        ethers.utils.parseEther("1"),
        expiryPrice
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT Credit Spreads that expired ITM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "1100",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenPut1400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut400
      );

      revertToSnapshot(snapshotId);
    });

    it("PUT Credit Spreads that expired ITM and below the coverage of the spread CollateralToken", async () => {
      const expiryPrice = ethers.utils.parseUnits("300", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut1400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut400
      );

      expect(await BUSD.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT Credit Spreads that expired OTM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "1800",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenPut1400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut400
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT Credit Spreads that expired ATM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "1400",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenPut1400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut400
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT Debit Spreads that expired ITM", async () => {
      const expiryPrice = ethers.utils.parseUnits("200", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut1400
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT Debit Spreads that expired OTM", async () => {
      const expiryPrice = ethers.utils.parseUnits("600", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut1400
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from PUT Debit Spreads that expired ATM", async () => {
      const expiryPrice = ethers.utils.parseUnits("400", await BUSD.decimals());

      const snapshotId = await testClaimCollateral(
        qTokenPut400,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenPut1400
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL Credit Spreads that expired ITM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "3200",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2880,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall3520
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL Credit Spreads that expired OTM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "2600",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2880,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall3520
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL Credit Spreads that expired ATM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "2880",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2880,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall3520
      );

      revertToSnapshot(snapshotId);
    });

    it("CALL Credit Spreads that expired ITM, at the strike price of the long option", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "3520",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall2880,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall3520
      );

      expect(await WETH.balanceOf(secondAccount.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL Debit Spreads that expired ITM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "4000",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall3520,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall2880
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL Debit Spreads that expired OTM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "3000",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall3520,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall2880
      );

      revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral from CALL Debit Spreads that expired ATM", async () => {
      const expiryPrice = ethers.utils.parseUnits(
        "3520",
        await BUSD.decimals()
      );

      const snapshotId = await testClaimCollateral(
        qTokenCall3520,
        ethers.utils.parseEther("1"),
        expiryPrice,
        qTokenCall2880
      );

      revertToSnapshot(snapshotId);
    });
  });

  describe("qTokenPermit", () => {
    it("Users should be able to call the permit method on QTokens through Controller actions", async () => {
      const deadline = Math.floor(Date.now() / 1000) + aMonth + 3600 * 24;
      const value = ethers.utils.parseEther("1");
      const qToken = qTokenCall3520;
      const owner = deployer.address;
      const spender = secondAccount.address;

      const digest = await getApprovalDigest(
        qToken,
        { owner, spender, value },
        await qToken.nonces(owner),
        ethers.BigNumber.from(deadline)
      );

      const { v, r, s } = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(deployer.privateKey.slice(2), "hex")
      );

      const actions = [
        encodeQTokenPermitArgs({
          qToken: qToken.address,
          owner,
          spender,
          value: value.toString(),
          deadline: deadline.toString(),
          v,
          r: ethers.utils.hexlify(r),
          s: ethers.utils.hexlify(s),
        }),
      ];

      expect(await qToken.allowance(owner, spender)).to.equal(Zero);

      await expect(controller.connect(deployer).operate(actions))
        .to.emit(qToken, "Approval")
        .withArgs(owner, spender, value);

      expect(await qToken.allowance(owner, spender)).to.equal(value);
    });
  });

  describe("collateralTokenApproval", () => {
    it("Users should be able to set the approval on the CollateralToken through Controller actions", async () => {
      const deadline = Math.floor(Date.now() / 1000) + aMonth + 3600 * 24;
      const owner = deployer.address;
      const operator = secondAccount.address;
      const approved = true;
      const collateralTokenNonce = (
        await collateralToken.nonces(owner)
      ).toString();

      const { v, r, s } = getApprovalForAllSignedData(
        parseInt(collateralTokenNonce),
        deployer,
        operator,
        approved,
        deadline,
        collateralToken.address
      );

      const actions = [
        encodeCollateralTokenApprovalArgs({
          owner,
          operator,
          approved,
          nonce: collateralTokenNonce,
          deadline: deadline.toString(),
          v,
          r,
          s,
        }),
      ];

      expect(await collateralToken.isApprovedForAll(owner, operator)).to.equal(
        false
      );

      await expect(controller.connect(deployer).operate(actions))
        .to.emit(collateralToken, "ApprovalForAll")
        .withArgs(owner, operator, true);

      expect(await collateralToken.isApprovedForAll(owner, operator)).to.equal(
        true
      );
    });
  });

  describe("Meta transactions", () => {
    const deadline = Math.floor(Date.now() / 1000) + aMonth + 3600 * 24;
    let nonce: number;

    beforeEach(async () => {
      nonce = parseInt(
        (await controller.getNonce(deployer.address)).toString()
      );
    });

    it("Should revert when signer and signature don't match", async () => {
      const amount = ethers.utils.parseEther("1");

      const actions = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: amount.toString(),
        }),
      ];

      const txData = await getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller
          .connect(deployer)
          .executeMetaTransaction(
            { nonce, deadline, from: secondAccount.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      ).to.be.revertedWith("signer and signature don't match");
    });

    it("Should revert when v is neither 27 nor 28", async () => {
      const amount = ethers.utils.parseEther("1");

      const actions = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: amount.toString(),
        }),
      ];

      const txData = await getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      const invalidV = 21;

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            invalidV
          )
      ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("Should revert when an invalid signature is provided", async () => {
      const amount = ethers.utils.parseEther("1");

      const actions = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: amount.toString(),
        }),
      ];

      await expect(
        controller
          .connect(deployer)
          .executeMetaTransaction(
            { nonce, deadline, from: secondAccount.address, actions },
            ethers.constants.HashZero,
            ethers.constants.HashZero,
            0
          )
      ).to.be.revertedWith("ECDSA: invalid signature");
    });

    it("Should revert when an invalid nonce is provided", async () => {
      const amount = ethers.utils.parseEther("1");

      const actions = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: amount.toString(),
        }),
      ];

      const txData = await getSignedTransactionData(
        nonce + 5,
        deadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce: nonce + 5, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      ).to.be.revertedWith("invalid nonce");
    });

    it("Should revert when a expired deadline is provided", async () => {
      const amount = ethers.utils.parseEther("1");
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600 * 24;

      const actions = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: amount.toString(),
        }),
      ];

      const txData = await getSignedTransactionData(
        nonce,
        expiredDeadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller.connect(secondAccount).executeMetaTransaction(
          {
            nonce,
            deadline: expiredDeadline,
            from: deployer.address,
            actions,
          },
          txData.r,
          txData.s,
          txData.v
        )
      ).to.be.revertedWith("expired deadline");
    });

    it("Users should be able to mint options through meta transactions", async () => {
      const amount = ethers.utils.parseEther("1");

      const actions = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: amount.toString(),
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      const [collateralAddress, collateralAmount] =
        await getCollateralRequirement(qTokenCall2000, nullQToken, amount);
      // mint required collateral to the user account
      const collateral = collateralAddress === WETH.address ? WETH : BUSD;
      await collateral
        .connect(assetsRegistryManager)
        .mint(await deployer.address, collateralAmount);
      // Approve the Controller to use the user's funds
      await collateral
        .connect(deployer)
        .approve(controller.address, collateralAmount);

      expect(await qTokenCall2000.balanceOf(secondAccount.address)).to.equal(
        Zero
      );
      expect(await collateral.balanceOf(deployer.address)).to.equal(
        collateralAmount
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(controller, "MetaTransactionExecuted")
        .withArgs(
          deployer.address,
          secondAccount.address,
          await controller.getNonce(deployer.address)
        );

      expect(await qTokenCall2000.balanceOf(secondAccount.address)).to.equal(
        amount
      );
      expect(await collateral.balanceOf(deployer.address)).to.equal(Zero);
    });
    it("Users should be able to create spreads through meta transactions", async () => {
      const amount = ethers.utils.parseEther("1");

      const actions = [
        encodeMintSpreadArgs({
          qTokenToMint: qTokenCall2880.address,
          qTokenForCollateral: qTokenCall3520.address,
          amount: amount.toString(),
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      const [collateralAddress, collateralAmount] =
        await getCollateralRequirement(qTokenCall2880, qTokenCall3520, amount);

      const collateral = collateralAddress === WETH.address ? WETH : BUSD;

      await collateral
        .connect(assetsRegistryManager)
        .mint(deployer.address, collateralAmount);

      await collateral
        .connect(deployer)
        .approve(controller.address, collateralAmount);

      await qTokenCall3520
        .connect(optionsMinter)
        .mint(deployer.address, amount);

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(controller, "MetaTransactionExecuted")
        .withArgs(
          deployer.address,
          secondAccount.address,
          await controller.getNonce(deployer.address)
        );

      expect(await qTokenCall3520.balanceOf(deployer.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      const collateralTokenId = await collateralToken.getCollateralTokenId(
        qTokenCall2880.address,
        qTokenCall3520.address
      );

      expect(
        await collateralToken.balanceOf(deployer.address, collateralTokenId)
      ).to.equal(amount);

      expect(await collateral.balanceOf(deployer.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      expect(await collateral.balanceOf(controller.address)).to.equal(
        collateralAmount
      );
    });

    it("Users should be able to exercise options through meta transactions", async () => {
      //Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

      //Note: Converts to the chainlink 8 decimal format
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        ethers.utils.parseUnits("1200", 8),
        BigNumber.from(8),
      ]);

      // Mint options to the user
      const optionsAmount = ethers.utils.parseEther("1");
      const qTokenToExercise = qTokenPut1400;
      await qTokenToExercise
        .connect(optionsMinter)
        .mint(deployer.address, optionsAmount);

      const payoutAmount = (
        await quantCalculator.getExercisePayout(
          qTokenToExercise.address,
          optionsAmount
        )
      ).payoutAmount;

      // Mint BUSD to the Controller so it can pay the user
      await BUSD.connect(deployer).mint(controller.address, payoutAmount);
      expect(await BUSD.balanceOf(controller.address)).to.equal(payoutAmount);

      const actions = [
        encodeExerciseArgs({
          qToken: qTokenToExercise.address,
          amount: optionsAmount.toString(),
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(controller, "MetaTransactionExecuted")
        .withArgs(
          deployer.address,
          secondAccount.address,
          await controller.getNonce(deployer.address)
        );

      expect(await BUSD.balanceOf(deployer.address)).to.equal(payoutAmount);
      expect(await BUSD.balanceOf(controller.address)).to.equal(
        ethers.BigNumber.from("0")
      );
      expect(await qTokenToExercise.balanceOf(deployer.address)).to.equal(
        ethers.BigNumber.from("0")
      );

      await revertToSnapshot(snapshotId);
    });

    it("Users should be able to claim collateral through meta transactions", async () => {
      const expiryPrice = ethers.utils.parseUnits("300", await BUSD.decimals());

      await mockPriceRegistry.mock.hasSettlementPrice.returns(true);

      //Note: Converts to the chainlink 8 decimal format
      await mockPriceRegistry.mock.getSettlementPriceWithDecimals.returns([
        expiryPrice.div((10 ** ((await BUSD.decimals()) - 8)).toString()),
        BigNumber.from(8),
      ]);

      const optionsAmount = ethers.utils.parseEther("1");

      const [collateralAddress, collateralRequirement] =
        await getCollateralRequirement(
          qTokenPut400,
          nullQToken,
          optionsAmount,
          BN.ROUND_CEIL
        );

      const collateral = collateralAddress === WETH.address ? WETH : BUSD;

      await collateral
        .connect(assetsRegistryManager)
        .mint(deployer.address, collateralRequirement);

      await collateral
        .connect(deployer)
        .approve(controller.address, collateralRequirement);

      await controller.connect(deployer).operate([
        encodeMintOptionArgs({
          to: deployer.address,
          qToken: qTokenPut400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenId = await collateralToken.getCollateralTokenId(
        qTokenPut400.address,
        AddressZero
      );

      // Take a snapshot of the Hardhat Network
      const snapshotId = await takeSnapshot();

      // Increase time to one hour past the expiry
      await provider.send("evm_mine", [futureTimestamp + 3600]);

      const [payoutFromShort, payoutAsset] = await getPayout(
        qTokenPut400,
        optionsAmount,
        expiryPrice,
        BN.ROUND_UP
      );

      const claimableCollateral = collateralRequirement.sub(payoutFromShort);

      const actions = [
        encodeClaimCollateralArgs({
          collateralTokenId: collateralTokenId.toString(),
          amount: optionsAmount.toString(),
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(controller, "MetaTransactionExecuted")
        .withArgs(
          deployer.address,
          secondAccount.address,
          await controller.getNonce(deployer.address)
        );

      const collateralClaimed = await payoutAsset.balanceOf(deployer.address);

      expect(collateralClaimed).to.equal(claimableCollateral);

      const controllerBalanceAfterClaim = await payoutAsset.balanceOf(
        controller.address
      );

      const intendedControllerBalanceAfterClaim =
        collateralRequirement.sub(claimableCollateral);

      //should ideally be 0, but can also be extra wei due to rounding
      const controllerExtraFunds = controllerBalanceAfterClaim.sub(
        intendedControllerBalanceAfterClaim
      );

      expect(
        parseInt(controllerExtraFunds.toString())
      ).to.be.greaterThanOrEqual(0);
      expect(parseInt(controllerExtraFunds.toString())).to.be.lessThanOrEqual(
        1
      ); //check the rounding is within 1 wei

      await revertToSnapshot(snapshotId);
    });

    it("Users should be able to neutralize positions through meta transactions", async () => {
      const optionsAmount = ethers.utils.parseEther("5");

      const [, collateralRequirement] = await getCollateralRequirement(
        qTokenPut1400,
        nullQToken,
        optionsAmount,
        BN.ROUND_DOWN
      );

      await BUSD.connect(assetsRegistryManager).mint(
        deployer.address,
        collateralRequirement
      );

      await BUSD.connect(deployer).approve(
        controller.address,
        collateralRequirement
      );

      await controller.connect(deployer).operate([
        encodeMintOptionArgs({
          to: deployer.address,
          qToken: qTokenPut1400.address,
          amount: optionsAmount,
        }),
      ]);

      const collateralTokenId = await collateralToken.getCollateralTokenId(
        qTokenPut1400.address,
        AddressZero
      );

      const amountToNeutralize = ethers.utils.parseEther("3");

      const actions = [
        encodeNeutralizeArgs({
          collateralTokenId: collateralTokenId.toString(),
          amount: amountToNeutralize.toString(),
        }),
      ];

      const txData = getSignedTransactionData(
        parseInt((await controller.getNonce(deployer.address)).toString()),
        deadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(controller, "MetaTransactionExecuted")
        .withArgs(
          deployer.address,
          secondAccount.address,
          await controller.getNonce(deployer.address)
        );

      expect(await qTokenPut1400.balanceOf(deployer.address)).to.equal(
        optionsAmount.sub(amountToNeutralize)
      );

      expect(
        await collateralToken.balanceOf(deployer.address, collateralTokenId)
      ).to.equal(optionsAmount.sub(amountToNeutralize));
    });

    it("Users should be able to call the permit method on QTokens through actions in meta transactions", async () => {
      const value = ethers.utils.parseEther("1");
      const qToken = qTokenPut1400;
      const owner = deployer.address;
      const spender = secondAccount.address;

      const digest = await getApprovalDigest(
        qToken,
        { owner, spender, value },
        await qToken.nonces(owner),
        ethers.BigNumber.from(deadline)
      );

      const { v, r, s } = ecsign(
        Buffer.from(digest.slice(2), "hex"),
        Buffer.from(deployer.privateKey.slice(2), "hex")
      );

      const actions = [
        encodeQTokenPermitArgs({
          qToken: qTokenPut1400.address,
          owner,
          spender,
          value: value.toString(),
          deadline: deadline.toString(),
          v,
          r: ethers.utils.hexlify(r),
          s: ethers.utils.hexlify(s),
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      expect(await qToken.allowance(owner, spender)).to.equal(Zero);

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(qToken, "Approval")
        .withArgs(owner, spender, value);

      expect(await qToken.allowance(owner, spender)).to.equal(value);
    });

    it("Users should be able to set the approval on the CollateralToken through actions in meta transactions", async () => {
      const owner = deployer.address;
      const operator = secondAccount.address;
      const approved = true;
      const collateralTokenNonce = (
        await collateralToken.nonces(owner)
      ).toString();

      const { v, r, s } = getApprovalForAllSignedData(
        parseInt(collateralTokenNonce),
        deployer,
        operator,
        approved,
        deadline,
        collateralToken.address
      );

      const actions = [
        encodeCollateralTokenApprovalArgs({
          owner,
          operator,
          approved,
          nonce: collateralTokenNonce,
          deadline: deadline.toString(),
          v,
          r,
          s,
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        actions,
        controller.address
      );

      expect(await collateralToken.isApprovedForAll(owner, operator)).to.equal(
        false
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(collateralToken, "ApprovalForAll")
        .withArgs(owner, operator, true);

      expect(await collateralToken.isApprovedForAll(owner, operator)).to.equal(
        true
      );
    });

    it("Users should be able to call external functions through meta transactions", async () => {
      const newQTokenParams: optionParameters = [
        WETH.address,
        mockOracleManager.address,
        ethers.utils.parseUnits("1000", await BUSD.decimals()),
        ethers.BigNumber.from(futureTimestamp),
        false,
      ];

      const createOptionCallData = optionsFactory.interface.encodeFunctionData(
        "createOption",
        newQTokenParams
      );

      const actions = [
        encodeCallArgs({
          callee: optionsFactory.address,
          data: createOptionCallData,
        }),
      ];

      const txData = getSignedTransactionData(
        parseInt((await controller.getNonce(deployer.address)).toString()),
        deadline,
        deployer,
        actions,
        controller.address
      );

      const optionsLength = await optionsFactory.getOptionsLength();
      const targetQTokenAddress = await optionsFactory.getTargetQTokenAddress(
        ...newQTokenParams
      );
      expect(await optionsFactory.getQToken(...newQTokenParams)).to.equal(
        AddressZero
      );
      expect(await optionsFactory.isQToken(targetQTokenAddress)).to.be.false;

      const OperateProxy = await ethers.getContractFactory(
        "OperateProxy",
        deployer
      );
      const operateProxy = OperateProxy.attach(await controller.operateProxy());

      const newQTokenAddress = await optionsFactory.getTargetQTokenAddress(
        ...newQTokenParams
      );

      const collateralTokenParams = [...newQTokenParams];

      collateralTokenParams.splice(2, 0, AddressZero);

      const newCollateralTokenId =
        await optionsFactory.getTargetCollateralTokenId(
          ...(collateralTokenParams as CollateralTokenParameters)
        );

      const createOptionReturnData =
        optionsFactory.interface.encodeFunctionResult("createOption", [
          newQTokenAddress,
          newCollateralTokenId,
        ]);

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      )
        .to.emit(operateProxy, "FunctionCallExecuted")
        .withArgs(secondAccount.address, createOptionReturnData);

      expect(await optionsFactory.getOptionsLength()).to.equal(
        optionsLength.add(1)
      );
      expect(await optionsFactory.getQToken(...newQTokenParams)).to.equal(
        targetQTokenAddress
      );
      expect(await optionsFactory.isQToken(targetQTokenAddress)).to.be.true;
    });

    it("Should revert when trying to make reentrant operate calls through meta transactions", async () => {
      const mintOptionsAction = [
        encodeMintOptionArgs({
          to: secondAccount.address,
          qToken: qTokenCall2000.address,
          amount: ethers.utils.parseEther("10").toString(),
        }),
      ];

      const encodedOperateCallData = controller.interface.encodeFunctionData(
        "operate",
        [mintOptionsAction]
      );

      const reentrantOperateAction = [
        encodeCallArgs({
          callee: controller.address,
          data: encodedOperateCallData,
        }),
      ];

      const txData = getSignedTransactionData(
        nonce,
        deadline,
        deployer,
        reentrantOperateAction,
        controller.address
      );

      await expect(
        controller.connect(secondAccount).executeMetaTransaction(
          {
            nonce,
            deadline,
            from: deployer.address,
            actions: reentrantOperateAction,
          },
          txData.r,
          txData.s,
          txData.v
        )
      ).to.be.revertedWith("unsuccessful function call");
    });

    it("Should revert when trying to call internal methods through meta transactions", async () => {
      const mintOptionsPositionCallData = `${web3.eth.abi.encodeFunctionSignature(
        "_mintOptionsPosition((address,address,uint256))"
      )}${web3.eth.abi
        .encodeParameter("tuple(address,address,uint256)", [
          secondAccount.address,
          qTokenCall2000.address,
          ethers.utils.parseEther("1"),
        ])
        .slice(2)}`;

      const actions = [
        encodeCallArgs({
          callee: controller.address,
          data: mintOptionsPositionCallData,
        }),
      ];

      const txData = getSignedTransactionData(
        parseInt((await controller.getNonce(deployer.address)).toString()),
        deadline,
        deployer,
        actions,
        controller.address
      );

      await expect(
        controller
          .connect(secondAccount)
          .executeMetaTransaction(
            { nonce, deadline, from: deployer.address, actions },
            txData.r,
            txData.s,
            txData.v
          )
      ).to.be.revertedWith("unsuccessful function call");
    });
  });

  describe("Upgradeability", () => {
    const upgradeController = async (
      controller: Controller
    ): Promise<ControllerV2> => {
      const ControllerV2 = await ethers.getContractFactory("ControllerV2");
      const controllerV2 = <ControllerV2>(
        await upgrades.upgradeProxy(controller.address, ControllerV2)
      );
      return controllerV2;
    };
    it("Should maintain state after upgrades", async () => {
      const configuredOptionsFactory = await controller.optionsFactory();

      const controllerV2 = await upgradeController(controller);

      expect(await controllerV2.optionsFactory()).to.equal(
        configuredOptionsFactory
      );
    });

    it("Should be able to add new state variables through upgrades", async () => {
      const controllerV2 = await upgradeController(controller);

      expect(await controllerV2.newV2StateVariable()).to.equal(Zero);
    });

    it("Should be able to add new functions through upgrades", async () => {
      const controllerV2 = await upgradeController(controller);

      expect(await controllerV2.newV2StateVariable()).to.equal(Zero);

      await controllerV2.connect(deployer).setNewV2StateVariable(42);

      expect(await controllerV2.newV2StateVariable()).to.equal(
        ethers.BigNumber.from("42")
      );
    });
  });
});
