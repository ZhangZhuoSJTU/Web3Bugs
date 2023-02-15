// TODO: add `configureVault` function to avoid code duplication
// TODO: fix: use camel case for variables
import { ethers, getNamedAccounts } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";

import {
    sleep,
    sortContractsByAddresses,
    encodeToBytes,
    withSigner,
} from "./Helpers";
import {
    ERC20,
    ERC20Vault,
    AaveVault,
    UniV3Vault,
    ProtocolGovernance,
    VaultGovernance,
    LpIssuerGovernance,
    VaultRegistry,
    ProtocolGovernance_constructor,
    VaultGovernance_constructor,
    LpIssuerGovernance_constructor,
    ProtocolGovernance_Params,
    ERC20Test_constructorArgs,
    VaultFactory,
    VaultType,
    VaultGovernance_InternalParams,
    IVaultGovernance,
    Vault,
    IGatewayVault,
} from "./Types";
import { BigNumber } from "@ethersproject/bignumber";
import { Address } from "hardhat-deploy/dist/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";

export async function deployTraders(options: {
    protocolGovernance: ProtocolGovernance;
    adminSigner: SignerWithAddress | Signer;
}): Promise<{
    chiefTrader: Contract;
    uniV3Trader: Contract;
}> {
    const { uniswapV3Router } = await getNamedAccounts();
    const chiefTrader: Contract = await (
        await ethers.getContractFactory("ChiefTrader")
    ).deploy(options.protocolGovernance.address);
    const uniV3Trader: Contract = await (
        await ethers.getContractFactory("UniV3Trader")
    ).deploy(uniswapV3Router);
    await chiefTrader
        .connect(options.adminSigner)
        .addTrader(uniV3Trader.address);
    return {
        chiefTrader,
        uniV3Trader,
    };
}

export async function deployERC20Tokens(length: number): Promise<ERC20[]> {
    let tokens: ERC20[] = [];
    let token_constructorArgs: ERC20Test_constructorArgs[] = [];
    const Contract: ContractFactory = await ethers.getContractFactory(
        "ERC20Test"
    );

    for (let i = 0; i < length; ++i) {
        token_constructorArgs.push({
            name: "Test Token",
            symbol: `TEST_${i}`,
        });
    }

    for (let i: number = 0; i < length; ++i) {
        const contract: ERC20 = await Contract.deploy(
            token_constructorArgs[i].name + `_${i.toString()}`,
            token_constructorArgs[i].symbol
        );
        await contract.deployed();
        tokens.push(contract);
    }
    return tokens;
}

export const deployProtocolGovernance = async (options: {
    constructorArgs?: ProtocolGovernance_constructor;
    initializerArgs?: {
        params: ProtocolGovernance_Params;
    };
    adminSigner: Signer;
}) => {
    // defaults<
    const constructorArgs: ProtocolGovernance_constructor =
        options.constructorArgs ?? {
            admin: await options.adminSigner.getAddress(),
        };
    // />
    const contractFactory: ContractFactory = await ethers.getContractFactory(
        "ProtocolGovernance"
    );
    const contract: ProtocolGovernance = await contractFactory.deploy(
        constructorArgs.admin
    );

    if (options?.initializerArgs) {
        await contract
            .connect(options!.adminSigner)
            .setPendingParams(options.initializerArgs.params);
        await sleep(Number(options.initializerArgs.params.governanceDelay));
        await contract.connect(options!.adminSigner).commitParams();
    }
    return contract;
};

export const deployVaultRegistryAndProtocolGovernance = async (options: {
    name?: string;
    symbol?: string;
    adminSigner: Signer;
    treasury: Address;
}) => {
    const protocolGovernance = await deployProtocolGovernance({
        adminSigner: options.adminSigner,
    });
    const VaultRegistryFactory: ContractFactory =
        await ethers.getContractFactory("VaultRegistry");
    let contract: VaultRegistry = await VaultRegistryFactory.deploy(
        options.name ?? "Test Vault Registry",
        options.symbol ?? "TVR",
        protocolGovernance.address
    );
    await contract.deployed();
    await protocolGovernance.connect(options.adminSigner).setPendingParams({
        permissionless: true,
        maxTokensPerVault: BigNumber.from(10),
        governanceDelay: BigNumber.from(60 * 60 * 24), // 1 day
        strategyPerformanceFee: BigNumber.from(10 * 10 ** 9),
        protocolPerformanceFee: BigNumber.from(2 * 10 ** 9),
        protocolExitFee: BigNumber.from(10 ** 9),
        protocolTreasury: options.treasury,
        vaultRegistry: contract.address,
    });
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await protocolGovernance.connect(options.adminSigner).commitParams();
    return {
        vaultRegistry: contract,
        protocolGovernance: protocolGovernance,
    };
};

export async function deployVaultFactory(options: {
    VaultGovernance: IVaultGovernance;
    vaultType: VaultType;
}): Promise<VaultFactory> {
    const Contract = await ethers.getContractFactory(
        `${options.vaultType}Factory`
    );
    const contract = await Contract.deploy(options.VaultGovernance);
    return contract;
}

export const deployVaultGovernance = async (options: {
    constructorArgs: VaultGovernance_constructor;
    adminSigner: Signer;
    treasury: Address;
    vaultType: VaultType;
}) => {
    let contract: Contract;
    const Contract = await ethers.getContractFactory(
        `${options.vaultType}Governance`
    );
    contract = await Contract.deploy(options.constructorArgs.params);
    await contract.deployed();
    return contract;
};

export async function deployVaultGovernanceSystem(options: {
    adminSigner: Signer;
    treasury: Address;
    dontUseTestSetup?: boolean;
}): Promise<{
    ERC20VaultFactory: VaultFactory;
    AaveVaultFactory: VaultFactory;
    UniV3VaultFactory: VaultFactory;
    LpIssuerFactory: VaultFactory;
    vaultRegistry: VaultRegistry;
    protocolGovernance: ProtocolGovernance;
    ERC20VaultGovernance: VaultGovernance;
    AaveVaultGovernance: VaultGovernance;
    UniV3VaultGovernance: VaultGovernance;
    LpIssuerGovernance: LpIssuerGovernance;
    chiefTrader: Contract;
    uniV3Trader: Contract;
}> {
    const { vaultRegistry, protocolGovernance } =
        await deployVaultRegistryAndProtocolGovernance({
            name: "VaultRegistry",
            symbol: "MVR",
            adminSigner: options.adminSigner,
            treasury: options.treasury,
        });

    const { chiefTrader, uniV3Trader } = await deployTraders({
        protocolGovernance: protocolGovernance,
        adminSigner: options.adminSigner,
    });

    let params: VaultGovernance_InternalParams = {
        protocolGovernance: protocolGovernance.address,
        registry: vaultRegistry.address,
    };
    const contractFactoryERC20: ContractFactory =
        await ethers.getContractFactory("ERC20VaultGovernance");
    const contractFactoryAave: ContractFactory =
        await ethers.getContractFactory("AaveVaultGovernance");
    const contractFactoryUniV3: ContractFactory =
        await ethers.getContractFactory("UniV3VaultGovernance");
    const contractFactoryLpIssuer: ContractFactory =
        await ethers.getContractFactory("LpIssuerGovernance");
    let ERC20VaultGovernance: VaultGovernance;
    let AaveVaultGovernance: VaultGovernance;
    let UniV3VaultGovernance: VaultGovernance;
    let LpIssuerGovernance: VaultGovernance;
    const { aaveLendingPool } = await getNamedAccounts();
    const additionalParamsForAave = {
        lendingPool: aaveLendingPool,
    };
    const { uniswapV3PositionManager } = await getNamedAccounts();
    const additionalParamsForUniV3 = {
        positionManager: uniswapV3PositionManager,
    };
    const additionalParamsForERC20 = {
        trader: chiefTrader.address,
    };
    ERC20VaultGovernance = await contractFactoryERC20.deploy(
        params,
        additionalParamsForERC20
    );
    AaveVaultGovernance = await contractFactoryAave.deploy(
        params,
        additionalParamsForAave
    );
    UniV3VaultGovernance = await contractFactoryUniV3.deploy(
        params,
        additionalParamsForUniV3
    );
    LpIssuerGovernance = await contractFactoryLpIssuer.deploy(params, {
        managementFeeChargeDelay: 86400,
    });
    await ERC20VaultGovernance.deployed();
    await AaveVaultGovernance.deployed();
    await UniV3VaultGovernance.deployed();
    await LpIssuerGovernance.deployed();
    const ERC20VaultFactory = await deployVaultFactory({
        vaultType: `ERC20Vault${options?.dontUseTestSetup ? "" : "Test"}`,
        VaultGovernance: ERC20VaultGovernance.address,
    });
    const AaveVaultFactory = await deployVaultFactory({
        vaultType: `AaveVault${options?.dontUseTestSetup ? "" : "Test"}`,
        VaultGovernance: AaveVaultGovernance.address,
    });
    const UniV3VaultFactory = await deployVaultFactory({
        vaultType: `UniV3Vault${options?.dontUseTestSetup ? "" : "Test"}`,
        VaultGovernance: UniV3VaultGovernance.address,
    });
    const LpIssuerFactory = await deployVaultFactory({
        vaultType: `LpIssuer`,
        VaultGovernance: LpIssuerGovernance.address,
    });
    await ERC20VaultGovernance.initialize(ERC20VaultFactory.address);
    await AaveVaultGovernance.initialize(AaveVaultFactory.address);
    await UniV3VaultGovernance.initialize(UniV3VaultFactory.address);
    await LpIssuerGovernance.initialize(LpIssuerFactory.address);
    await ERC20VaultGovernance.connect(options.adminSigner).stageInternalParams(
        params
    );
    await AaveVaultGovernance.connect(options.adminSigner).stageInternalParams(
        params
    );
    await UniV3VaultGovernance.connect(options.adminSigner).stageInternalParams(
        params
    );
    await LpIssuerGovernance.connect(options.adminSigner).stageInternalParams(
        params
    );
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await ERC20VaultGovernance.connect(
        options.adminSigner
    ).commitInternalParams();
    await AaveVaultGovernance.connect(
        options.adminSigner
    ).commitInternalParams();
    await UniV3VaultGovernance.connect(
        options.adminSigner
    ).commitInternalParams();
    await LpIssuerGovernance.connect(
        options.adminSigner
    ).commitInternalParams();
    return {
        ERC20VaultFactory,
        AaveVaultFactory,
        UniV3VaultFactory,
        LpIssuerFactory,
        vaultRegistry,
        protocolGovernance,
        ERC20VaultGovernance,
        AaveVaultGovernance,
        UniV3VaultGovernance,
        LpIssuerGovernance,
        chiefTrader,
        uniV3Trader,
    };
}

export async function deployTestVaultGovernanceSystem(options: {
    adminSigner: Signer;
    treasury: Address;
}): Promise<{
    vaultFactory: VaultFactory;
    vaultRegistry: VaultRegistry;
    protocolGovernance: ProtocolGovernance;
    vaultGovernance: VaultGovernance;
}> {
    const { vaultRegistry, protocolGovernance } =
        await deployVaultRegistryAndProtocolGovernance({
            name: "VaultRegistry",
            symbol: "MVR",
            adminSigner: options.adminSigner,
            treasury: options.treasury,
        });

    let params: VaultGovernance_InternalParams = {
        protocolGovernance: protocolGovernance.address,
        registry: vaultRegistry.address,
    };
    const contractFactory: ContractFactory = await ethers.getContractFactory(
        `TestVaultGovernance`
    );

    let vaultGovernance: VaultGovernance;

    vaultGovernance = await contractFactory.deploy(params, []);
    await vaultGovernance.deployed();

    const ERC20VaultFactory = await deployVaultFactory({
        vaultType: "ERC20Vault",
        VaultGovernance: vaultGovernance.address,
    });

    await vaultGovernance
        .connect(options.adminSigner)
        .stageInternalParams(params);

    await sleep(Number(await protocolGovernance.governanceDelay()));
    await vaultGovernance.connect(options.adminSigner).commitInternalParams();
    return {
        vaultFactory: ERC20VaultFactory,
        vaultRegistry,
        protocolGovernance,
        vaultGovernance,
    };
}

export async function deployVaultRegistry(options: {
    name: string;
    symbol: string;
    protocolGovernance: ProtocolGovernance;
}): Promise<Contract> {
    let Contract = await ethers.getContractFactory("VaultRegistry");
    let contract = await Contract.deploy(
        options.name,
        options.symbol,
        options.protocolGovernance.address
    );
    await contract.deployed();
    return contract;
}

export async function deployCommonLibrary(): Promise<Contract> {
    const Library: ContractFactory = await ethers.getContractFactory("Common");
    const library: Contract = await Library.deploy();
    await library.deployed();
    return library;
}

export async function deployCommonLibraryTest(): Promise<Contract> {
    const CommonTest: ContractFactory = await ethers.getContractFactory(
        "CommonTest"
    );
    const commonTest: Contract = await CommonTest.deploy();
    await commonTest.deployed();
    return commonTest;
}

export const deployLpIssuerGovernance = async (options: {
    constructorArgs?: LpIssuerGovernance_constructor;
    adminSigner?: Signer;
    treasury?: Address;
}) => {
    // defaults<

    let deployer: Signer;
    let treasury: Signer;

    [deployer, treasury] = await ethers.getSigners();

    const {
        ERC20VaultFactory: ERC20VaultFactory,
        vaultRegistry: vaultRegistry,
        protocolGovernance: protocolGovernance,
        ERC20VaultGovernance: ERC20VaultGovernance,
    } = await deployVaultGovernanceSystem({
        adminSigner: deployer,
        treasury: await treasury.getAddress(),
    });

    const constructorArgs: LpIssuerGovernance_constructor =
        options.constructorArgs ?? [
            {
                registry: vaultRegistry.address,
                protocolGovernance: protocolGovernance.address,
                factory: ERC20VaultFactory.address,
            },
            { managementFeeChargeDelay: 86400 },
        ];
    // />
    const Contract: ContractFactory = await ethers.getContractFactory(
        "LpIssuerGovernance"
    );

    let contract: LpIssuerGovernance = await Contract.deploy(
        ...constructorArgs
    );
    await contract.deployed();
    return {
        LpIssuerGovernance: contract,
        protocolGovernance: protocolGovernance,
        vaultRegistry: vaultRegistry,
        ERC20VaultFactory: ERC20VaultFactory,
    };
};

export async function deploySubVaultSystem(options: {
    tokensCount: number;
    adminSigner: Signer;
    treasury: Address;
    vaultOwner: Address;
    dontUseTestSetup?: boolean;
}): Promise<{
    ERC20VaultFactory: VaultFactory;
    AaveVaultFactory: VaultFactory;
    UniV3VaultFactory: VaultFactory;
    LpIssuerFactory: VaultFactory;
    vaultRegistry: VaultRegistry;
    protocolGovernance: ProtocolGovernance;
    ERC20VaultGovernance: VaultGovernance;
    AaveVaultGovernance: VaultGovernance;
    UniV3VaultGovernance: VaultGovernance;
    LpIssuerGovernance: VaultGovernance;
    tokens: ERC20[];
    ERC20Vault: Vault;
    nftERC20: number;
    AnotherERC20Vault: Vault;
    anotherNftERC20: number;
    AaveVault: Vault;
    nftAave: number;
    UniV3Vault: Vault;
    nftUniV3: number;
    aTokens: ERC20[];
    chiefTrader: Contract;
    uniV3Trader: Contract;
}> {
    const {
        vaultRegistry,
        protocolGovernance,
        ERC20VaultFactory,
        AaveVaultFactory,
        UniV3VaultFactory,
        LpIssuerFactory,
        ERC20VaultGovernance,
        AaveVaultGovernance,
        UniV3VaultGovernance,
        LpIssuerGovernance,
        chiefTrader,
        uniV3Trader,
    } = await deployVaultGovernanceSystem({
        adminSigner: options.adminSigner,
        treasury: options.treasury,
        dontUseTestSetup: options.dontUseTestSetup,
    });
    const { wbtc, usdc, weth, test, deployer } = await getNamedAccounts();
    const contracts = [];
    for (const token of [wbtc, usdc, weth]) {
        const contract = await ethers.getContractAt("LpIssuer", token);
        contracts.push(contract);
        const balance = await contract.balanceOf(test);
        await withSigner(test, async (s) => {
            await contract.connect(s).transfer(deployer, balance.div(10));
        });
    }
    const vaultTokens: ERC20[] = sortContractsByAddresses(contracts).slice(
        0,
        options.tokensCount
    );
    let allowedTokens: Address[] = new Array<Address>(options.tokensCount);
    for (var i = 0; i < options.tokensCount; ++i) {
        allowedTokens[i] = vaultTokens[i].address;
    }
    await protocolGovernance
        .connect(options.adminSigner)
        .setPendingTokenWhitelistAdd(allowedTokens);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await protocolGovernance
        .connect(options.adminSigner)
        .commitTokenWhitelistAdd();
    await protocolGovernance
        .connect(options.adminSigner)
        .setPendingVaultGovernancesAdd([
            ERC20VaultGovernance.address,
            AaveVaultGovernance.address,
            UniV3VaultGovernance.address,
        ]);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await protocolGovernance
        .connect(options.adminSigner)
        .commitVaultGovernancesAdd();
    let optionsBytes: any = [];
    const vaultDeployArgsERC20 = [
        vaultTokens.map((token) => token.address),
        [],
        options.vaultOwner,
    ];
    const vaultDeployArgsAave = [
        vaultTokens.map((token) => token.address),
        optionsBytes,
        options.vaultOwner,
    ];
    optionsBytes = encodeToBytes(["uint24"], [3000]);
    const vaultDeployArgsUniV3 = [
        vaultTokens.map((token) => token.address),
        optionsBytes,
        options.vaultOwner,
    ];
    const ERC20VaultResult = await ERC20VaultGovernance.callStatic.deployVault(
        ...vaultDeployArgsERC20
    );
    const ERC20VaultInstance = ERC20VaultResult.vault;
    const nftERC20 = ERC20VaultResult.nft;
    await ERC20VaultGovernance.deployVault(...vaultDeployArgsERC20);

    const AnotherERC20VaultResult =
        await ERC20VaultGovernance.callStatic.deployVault(
            ...vaultDeployArgsERC20
        );
    const AnotherERC20VaultInstance = AnotherERC20VaultResult.vault;
    const anotherNftERC20 = AnotherERC20VaultResult.nft;
    await ERC20VaultGovernance.deployVault(...vaultDeployArgsERC20);

    const AaveVaultResult = await AaveVaultGovernance.callStatic.deployVault(
        ...vaultDeployArgsAave
    );
    const AaveVaultInstance = AaveVaultResult.vault;
    const nftAave = AaveVaultResult.nft;
    await AaveVaultGovernance.deployVault(...vaultDeployArgsAave);

    const UniV3VaultResult = await UniV3VaultGovernance.callStatic.deployVault(
        ...vaultDeployArgsUniV3
    );
    const UniV3VaultInstance = UniV3VaultResult.vault;
    const nftUniV3 = UniV3VaultResult.nft;
    await UniV3VaultGovernance.deployVault(...vaultDeployArgsUniV3);

    const ERC20VaultContract: Vault = await ethers.getContractAt(
        `ERC20Vault${options?.dontUseTestSetup ? "" : "Test"}`,
        ERC20VaultInstance
    );
    const AnotherERC20VaultContract: Vault = await ethers.getContractAt(
        `ERC20Vault${options?.dontUseTestSetup ? "" : "Test"}`,
        AnotherERC20VaultInstance
    );
    const AaveVaultContract: Vault = await ethers.getContractAt(
        `AaveVault${options?.dontUseTestSetup ? "" : "Test"}`,
        AaveVaultInstance
    );
    const UniV3VaultContract: Vault = await ethers.getContractAt(
        `UniV3Vault${options?.dontUseTestSetup ? "" : "Test"}`,
        UniV3VaultInstance
    );

    let aTokens: ERC20[] = [];
    if (!options?.dontUseTestSetup) {
        aTokens = sortContractsByAddresses(
            await deployERC20Tokens(options.tokensCount)
        );
        await AaveVaultContract.setATokens(
            aTokens.map((token) => token.address)
        );
    }

    await sleep(Number(await protocolGovernance.governanceDelay()));
    // FIXME: remove this hack <
    await withSigner(ERC20VaultGovernance.address, async (signer) => {
        const [deployer] = await ethers.getSigners();
        await vaultRegistry
            .connect(signer)
            .registerVault(options.vaultOwner, options.vaultOwner);
    });
    // />
    return {
        ERC20VaultFactory: ERC20VaultFactory,
        AaveVaultFactory: AaveVaultFactory,
        UniV3VaultFactory: UniV3VaultFactory,
        vaultRegistry: vaultRegistry,
        protocolGovernance: protocolGovernance,
        ERC20VaultGovernance: ERC20VaultGovernance,
        AaveVaultGovernance: AaveVaultGovernance,
        UniV3VaultGovernance: UniV3VaultGovernance,
        tokens: vaultTokens,
        ERC20Vault: ERC20VaultContract,
        AnotherERC20Vault: AnotherERC20VaultContract,
        AaveVault: AaveVaultContract,
        UniV3Vault: UniV3VaultContract,
        nftERC20: nftERC20,
        nftAave: nftAave,
        nftUniV3: nftUniV3,
        anotherNftERC20: anotherNftERC20,
        aTokens: aTokens,
        LpIssuerFactory: LpIssuerFactory,
        LpIssuerGovernance: LpIssuerGovernance,
        chiefTrader: chiefTrader,
        uniV3Trader: uniV3Trader,
    };
}

export async function deploySubVaultsXGatewayVaultSystem(options: {
    adminSigner: Signer;
    vaultOwnerSigner: Signer;
    treasury: Address;
    strategy: Address;
    enableAaveVault?: boolean;
    enableUniV3Vault?: boolean;
    dontUseTestSetup?: boolean;
}): Promise<{
    ERC20VaultFactory: VaultFactory;
    AaveVaultFactory: VaultFactory;
    UniV3VaultFactory: VaultFactory;
    vaultRegistry: VaultRegistry;
    protocolGovernance: ProtocolGovernance;
    ERC20VaultGovernance: VaultGovernance;
    AaveVaultGovernance: VaultGovernance;
    UniV3VaultGovernance: VaultGovernance;
    tokens: ERC20[];
    ERC20Vault: ERC20Vault;
    nftERC20: number;
    AnotherERC20Vault: ERC20Vault;
    anotherNftERC20: number;
    AaveVault: AaveVault;
    nftAave: number;
    UniV3Vault: UniV3Vault;
    nftUniV3: number;
    gatewayVaultGovernance: VaultGovernance;
    gatewayVaultFactory: VaultFactory;
    gatewayVault: Vault;
    gatewayNft: number;
    LpIssuerFactory: VaultFactory;
    LpIssuerGovernance: VaultGovernance;
    chiefTrader: Contract;
    uniV3Trader: Contract;
}> {
    const {
        ERC20VaultFactory,
        AaveVaultFactory,
        UniV3VaultFactory,
        vaultRegistry,
        protocolGovernance,
        ERC20VaultGovernance,
        AnotherERC20Vault,
        AaveVaultGovernance,
        UniV3VaultGovernance,
        tokens,
        ERC20Vault,
        AaveVault,
        UniV3Vault,
        nftERC20,
        nftAave,
        nftUniV3,
        anotherNftERC20,
        LpIssuerGovernance,
        LpIssuerFactory,
        chiefTrader,
        uniV3Trader,
    } = await deploySubVaultSystem({
        tokensCount: 2,
        adminSigner: options.adminSigner,
        treasury: options.treasury,
        vaultOwner: await options.vaultOwnerSigner.getAddress(),
        dontUseTestSetup: options.dontUseTestSetup,
    });
    let args: VaultGovernance_constructor = {
        params: {
            protocolGovernance: protocolGovernance.address,
            registry: vaultRegistry.address,
        },
    };
    const gatewayVaultGovernance = await deployVaultGovernance({
        constructorArgs: args,
        adminSigner: options.adminSigner,
        treasury: options.treasury,
        vaultType: "GatewayVault",
    });
    await protocolGovernance
        .connect(options.adminSigner)
        .setPendingVaultGovernancesAdd([gatewayVaultGovernance.address]);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await protocolGovernance
        .connect(options.adminSigner)
        .commitVaultGovernancesAdd();
    const gatewayVaultFactory = await deployVaultFactory({
        VaultGovernance: gatewayVaultGovernance.address,
        vaultType: `GatewayVault${options?.dontUseTestSetup ? "" : "Test"}`,
    });
    await gatewayVaultGovernance
        .connect(options.adminSigner)
        .stageInternalParams(args.params);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await gatewayVaultGovernance
        .connect(options.adminSigner)
        .commitInternalParams();
    await gatewayVaultGovernance.initialize(gatewayVaultFactory.address);
    await vaultRegistry.approve(
        gatewayVaultGovernance.address,
        BigNumber.from(nftERC20)
    );
    await vaultRegistry.approve(
        gatewayVaultGovernance.address,
        BigNumber.from(anotherNftERC20)
    );
    await vaultRegistry.approve(
        gatewayVaultGovernance.address,
        BigNumber.from(nftAave)
    );
    await vaultRegistry.approve(
        gatewayVaultGovernance.address,
        BigNumber.from(nftUniV3)
    );
    let gatewayVaultAddress: IGatewayVault;
    let gatewayNft: number = 0;
    let nfts: number[] = [nftERC20, anotherNftERC20];
    if (options?.enableAaveVault) {
        nfts.push(nftAave);
    }
    if (options?.enableUniV3Vault) {
        nfts.push(nftUniV3);
    }
    const deployArgs = [
        tokens.map((token) => token.address),
        encodeToBytes(["uint256[]"], [nfts]),
        options.strategy,
    ];
    let response = await gatewayVaultGovernance.callStatic.deployVault(
        ...deployArgs
    );
    gatewayVaultAddress = response.vault;
    gatewayNft = response.nft;
    await gatewayVaultGovernance.deployVault(...deployArgs);
    const gatewayVault: Vault = await ethers.getContractAt(
        `GatewayVault${options?.dontUseTestSetup ? "" : "Test"}`,
        gatewayVaultAddress
    );
    await gatewayVaultGovernance
        .connect(options.adminSigner)
        .stageDelayedStrategyParams(gatewayNft, [nfts]);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await gatewayVaultGovernance
        .connect(options.adminSigner)
        .commitDelayedStrategyParams(gatewayNft);
    await gatewayVaultGovernance
        .connect(options.adminSigner)
        .setStrategyParams(gatewayNft, [
            [BigNumber.from(10 ** 4), BigNumber.from(10 ** 4)],
        ]);
    return {
        ERC20VaultFactory,
        AaveVaultFactory,
        UniV3VaultFactory,
        vaultRegistry,
        protocolGovernance,
        ERC20VaultGovernance,
        AaveVaultGovernance,
        UniV3VaultGovernance,
        tokens,
        ERC20Vault,
        AnotherERC20Vault,
        AaveVault,
        UniV3Vault,
        nftERC20,
        nftAave,
        nftUniV3,
        anotherNftERC20,
        gatewayVaultGovernance,
        gatewayVaultFactory,
        gatewayVault,
        gatewayNft,
        LpIssuerGovernance,
        LpIssuerFactory,
        chiefTrader,
        uniV3Trader,
    };
}

export async function deploySystem(options: {
    adminSigner: Signer;
    vaultOwnerSigner: SignerWithAddress;
    treasury: Address;
    strategy: Address;
    enableAaveVault?: boolean;
    enableUniV3Vault?: boolean;
    dontUseTestSetup?: boolean;
}): Promise<{
    ERC20VaultFactory: VaultFactory;
    AaveVaultFactory: VaultFactory;
    UniV3VaultFactory: VaultFactory;
    vaultRegistry: VaultRegistry;
    protocolGovernance: ProtocolGovernance;
    ERC20VaultGovernance: VaultGovernance;
    AaveVaultGovernance: VaultGovernance;
    UniV3VaultGovernance: VaultGovernance;
    tokens: ERC20[];
    ERC20Vault: ERC20Vault;
    nftERC20: number;
    AnotherERC20Vault: ERC20Vault;
    anotherNftERC20: number;
    AaveVault: AaveVault;
    nftAave: number;
    UniV3Vault: UniV3Vault;
    nftUniV3: number;
    gatewayVaultGovernance: VaultGovernance;
    gatewayVaultFactory: VaultFactory;
    gatewayVault: Vault;
    gatewayNft: number;
    LpIssuerFactory: VaultFactory;
    LpIssuerGovernance: VaultGovernance;
    LpIssuer: Vault;
    lpIssuerNft: number;
}> {
    const {
        ERC20VaultFactory,
        AaveVaultFactory,
        UniV3VaultFactory,
        vaultRegistry,
        protocolGovernance,
        ERC20VaultGovernance,
        AaveVaultGovernance,
        UniV3VaultGovernance,
        AaveVault,
        UniV3Vault,
        tokens,
        ERC20Vault,
        AnotherERC20Vault,
        nftERC20,
        nftAave,
        nftUniV3,
        anotherNftERC20,
        gatewayVaultGovernance,
        gatewayVaultFactory,
        gatewayVault,
        gatewayNft,
        LpIssuerGovernance,
        LpIssuerFactory,
    } = await deploySubVaultsXGatewayVaultSystem(options);

    const lpIssuerDeployArgs = [
        tokens.map((token) => token.address),
        encodeToBytes(
            ["uint256", "string", "string"],
            [gatewayNft, "MellowProtocol", "MELLOW"]
        ),
        options.vaultOwnerSigner.address,
    ];
    await protocolGovernance
        .connect(options.adminSigner)
        .setPendingVaultGovernancesAdd([
            ERC20VaultGovernance.address,
            AaveVaultGovernance.address,
            UniV3VaultGovernance.address,
            gatewayVaultGovernance.address,
            LpIssuerGovernance.address,
        ]);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await protocolGovernance
        .connect(options.adminSigner)
        .commitVaultGovernancesAdd();
    await vaultRegistry.approve(
        LpIssuerGovernance.address,
        BigNumber.from(gatewayNft)
    );
    const response = await LpIssuerGovernance.callStatic.deployVault(
        ...lpIssuerDeployArgs
    );
    const lpIssuerAddress = response.vault;
    const lpIssuerNft = response.nft;
    await LpIssuerGovernance.deployVault(...lpIssuerDeployArgs);
    await vaultRegistry
        .connect(options.vaultOwnerSigner)
        .functions["safeTransferFrom(address,address,uint256)"](
            options.vaultOwnerSigner.address,
            lpIssuerAddress,
            lpIssuerNft
        );
    const LpIssuer: Vault = await ethers.getContractAt(
        `LpIssuer`,
        lpIssuerAddress
    );
    await LpIssuerGovernance.connect(
        options.adminSigner
    ).stageDelayedProtocolPerVaultParams(lpIssuerNft, [1 * 10 ** 9]);
    await sleep(Number(await protocolGovernance.governanceDelay()));
    await LpIssuerGovernance.connect(
        options.adminSigner
    ).commitDelayedProtocolPerVaultParams(lpIssuerNft);
    await LpIssuerGovernance.connect(options.adminSigner).setStrategyParams(
        lpIssuerNft,
        [BigNumber.from(10 ** 9).mul(BigNumber.from(10 ** 9))]
    );

    return {
        ERC20VaultFactory,
        AaveVaultFactory,
        UniV3VaultFactory,
        vaultRegistry,
        protocolGovernance,
        ERC20VaultGovernance,
        AaveVaultGovernance,
        UniV3VaultGovernance,
        tokens,
        ERC20Vault,
        AnotherERC20Vault,
        AaveVault,
        UniV3Vault,
        nftERC20,
        nftAave,
        nftUniV3,
        anotherNftERC20,
        gatewayVaultGovernance,
        gatewayVaultFactory,
        gatewayVault,
        gatewayNft,
        LpIssuerGovernance,
        LpIssuer,
        lpIssuerNft,
        LpIssuerFactory,
    };
}
