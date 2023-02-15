import { Fixture } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { ActorFixture } from "./actors";

import {
    DummyRouter,
    FeeSplitter,
    FlatOperator,
    MockERC20,
    NestedAsset,
    NestedFactory,
    NestedRecords,
    NestedReserve,
    OperatorResolver,
    TestableOperatorCaller,
    WETH9,
    ZeroExOperator,
} from "../../typechain";
import { BigNumber, Wallet } from "ethers";
import { Interface } from "ethers/lib/utils";
import { appendDecimals, toBytes32 } from "../helpers";

export type OperatorResolverFixture = { operatorResolver: OperatorResolver };

export const operatorResolverFixture: Fixture<OperatorResolverFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).addressResolverOwner();

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(signer).deploy();

    return { operatorResolver };
};

export type ZeroExOperatorFixture = {
    zeroExOperator: ZeroExOperator;
    dummyRouter: DummyRouter;
    dummyRouterInterface: Interface;
    mockUNI: MockERC20;
    mockDAI: MockERC20;
    testableOperatorCaller: TestableOperatorCaller;
};

export const zeroExOperatorFixture: Fixture<ZeroExOperatorFixture> = async (wallets, provider) => {
    const signer = new ActorFixture(wallets as Wallet[], provider).zeroExOperatorOwner();

    const dummyRouterFactory = await ethers.getContractFactory("DummyRouter");
    const dummyRouter = await dummyRouterFactory.connect(signer).deploy();

    const dummyRouterInterface = dummyRouter.interface;

    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const zeroExOperator = await zeroExOperatorFactory.connect(signer).deploy(dummyRouter.address);

    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    await mockUNI.deployed();
    const mockDAI = await mockERC20Factory.deploy("Mocked DAI", "DAI", appendDecimals(3000000));
    await mockDAI.deployed();

    await mockUNI.transfer(dummyRouter.address, appendDecimals(1000));
    await mockDAI.transfer(dummyRouter.address, appendDecimals(1000));

    const testableOperatorCallerFactory = await ethers.getContractFactory("TestableOperatorCaller");
    const testableOperatorCaller = await testableOperatorCallerFactory.connect(signer).deploy(zeroExOperator.address);

    await mockUNI.transfer(testableOperatorCaller.address, appendDecimals(1000));
    await mockDAI.transfer(testableOperatorCaller.address, appendDecimals(1000));

    return { zeroExOperator, dummyRouter, dummyRouterInterface, mockUNI, mockDAI, testableOperatorCaller };
};

export type FactoryAndOperatorsFixture = {
    WETH: WETH9;
    mockUNI: MockERC20;
    mockKNC: MockERC20;
    mockDAI: MockERC20;
    mockUSDC: MockERC20;
    shareholder1: Wallet;
    shareholder2: Wallet;
    feeSplitter: FeeSplitter;
    royaltieWeigth: BigNumber;
    nestedAsset: NestedAsset;
    nestedRecords: NestedRecords;
    maxHoldingsCount: BigNumber;
    operatorResolver: OperatorResolver;
    dummyRouter: DummyRouter;
    zeroExOperator: ZeroExOperator;
    zeroExOperatorNameBytes32: string;
    flatOperator: FlatOperator;
    flatOperatorNameBytes32: string;
    nestedFactory: NestedFactory;
    nestedReserve: NestedReserve;
    masterDeployer: Wallet;
    user1: Wallet;
    baseAmount: BigNumber;
};

export const factoryAndOperatorsFixture: Fixture<FactoryAndOperatorsFixture> = async (wallets, provider) => {
    const masterDeployer = new ActorFixture(wallets as Wallet[], provider).masterDeployer();

    // Deploy WETH
    const WETHFactory = await ethers.getContractFactory("WETH9");
    const WETH = await WETHFactory.connect(masterDeployer).deploy();
    await WETH.deployed();

    // Deploy ERC20 mocks
    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockUNI = await mockERC20Factory.connect(masterDeployer).deploy("Mocked UNI", "UNI", appendDecimals(3000000));
    await mockUNI.deployed();
    const mockKNC = await mockERC20Factory.connect(masterDeployer).deploy("Mocked KNC", "KNC", appendDecimals(3000000));
    await mockKNC.deployed();
    const mockDAI = await mockERC20Factory.connect(masterDeployer).deploy("Mocked DAI", "DAI", appendDecimals(3000000));
    await mockDAI.deployed();
    const mockUSDC = await mockERC20Factory
        .connect(masterDeployer)
        .deploy("Mocked USDC", "USDC", appendDecimals(3000000));
    await mockUSDC.deployed();

    // Get the Fee shareholders (two actors)
    const shareholder1 = new ActorFixture(wallets as Wallet[], provider).shareHolder1();
    const shareholder2 = new ActorFixture(wallets as Wallet[], provider).shareHolder2();

    // Define the royaltie weight value (used in FeeSplitter)
    const royaltieWeigth = BigNumber.from(300);

    // Deploy the FeeSplitter
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const feeSplitter = await feeSplitterFactory
        .connect(masterDeployer)
        .deploy([shareholder1.address, shareholder2.address], [1000, 1700], royaltieWeigth, WETH.address);
    await feeSplitter.deployed();

    // Deploy NestedAsset
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedAsset = await nestedAssetFactory.connect(masterDeployer).deploy();
    await nestedAsset.deployed();

    // Define maxHoldingsCount value (used in NestedRecords)
    const maxHoldingsCount = BigNumber.from(15);

    // Deploy NestedRecords
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const nestedRecords = await nestedRecordsFactory.connect(masterDeployer).deploy(maxHoldingsCount);
    await nestedRecords.deployed();

    // Deploy OperatorResolver
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const operatorResolver = await operatorResolverFactory.connect(masterDeployer).deploy();
    await operatorResolver.deployed();

    // Deploy DummyRouter (fake 0x)
    const dummyRouterFactory = await ethers.getContractFactory("DummyRouter");
    const dummyRouter = await dummyRouterFactory.connect(masterDeployer).deploy();
    await dummyRouter.deployed();

    // Deploy ZeroExOperator
    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const zeroExOperator = await zeroExOperatorFactory.connect(masterDeployer).deploy(dummyRouter.address);
    await zeroExOperator.deployed();

    // Deploy FlatOperator
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const flatOperator = await flatOperatorFactory.connect(masterDeployer).deploy();
    await flatOperator.deployed();

    // Deploy NestedFactory
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedFactory = await nestedFactoryFactory
        .connect(masterDeployer)
        .deploy(
            nestedAsset.address,
            nestedRecords.address,
            feeSplitter.address,
            WETH.address,
            operatorResolver.address,
        );
    await nestedFactory.deployed();

    // Deploy Reserve
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");
    const nestedReserve = await nestedReserveFactory.connect(masterDeployer).deploy(nestedFactory.address);
    await nestedReserve.deployed();

    // Get the user1 actor
    const user1 = new ActorFixture(wallets as Wallet[], provider).user1();

    // Set factory to asset and records
    await nestedAsset.connect(masterDeployer).setFactory(nestedFactory.address);
    await nestedRecords.connect(masterDeployer).setFactory(nestedFactory.address);

    // Add operators to OperatorResolver
    const zeroExOperatorNameBytes32 = toBytes32("ZeroEx");
    const flatOperatorNameBytes32 = toBytes32("Flat");
    await operatorResolver
        .connect(masterDeployer)
        .importOperators(
            [zeroExOperatorNameBytes32, flatOperatorNameBytes32],
            [zeroExOperator.address, flatOperator.address],
        );

    // Add operators to factory and rebuild cache
    await nestedFactory.connect(masterDeployer).addOperator(zeroExOperatorNameBytes32);
    await nestedFactory.connect(masterDeployer).addOperator(flatOperatorNameBytes32);
    await nestedFactory.connect(masterDeployer).rebuildCache();

    // Define the base amount
    const baseAmount = appendDecimals(1000);

    // Send funds to User and router
    await network.provider.send("hardhat_setBalance", [user1.address, baseAmount.toHexString()]);
    await mockUNI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(dummyRouter.address, baseAmount);
    await mockUNI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockKNC.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockDAI.connect(masterDeployer).transfer(user1.address, baseAmount);
    await mockUSDC.connect(masterDeployer).transfer(user1.address, baseAmount);

    // User1 approves factory to spend all his tokens (UNI, KNC, and DAI)
    await mockUNI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockKNC.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockDAI.connect(user1).approve(nestedFactory.address, baseAmount);
    await mockUSDC.connect(user1).approve(nestedFactory.address, baseAmount);

    // Wrap some ETH and send them to the dummy router
    await WETH.connect(masterDeployer).deposit({ value: appendDecimals(100) });
    await WETH.connect(masterDeployer).transfer(dummyRouter.address, appendDecimals(100));

    return {
        WETH,
        mockUNI,
        mockKNC,
        mockDAI,
        mockUSDC,
        shareholder1,
        shareholder2,
        feeSplitter,
        royaltieWeigth,
        nestedAsset,
        nestedRecords,
        maxHoldingsCount,
        operatorResolver,
        zeroExOperatorNameBytes32,
        flatOperator,
        flatOperatorNameBytes32,
        dummyRouter,
        zeroExOperator,
        nestedFactory,
        nestedReserve,
        masterDeployer,
        user1,
        baseAmount,
    };
};
