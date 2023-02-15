import { ethereumAddress } from "../../test-utils/regex";
import { AssetAddressTypes, Chain, Token, tokens } from "./tokens";

export const contractNames = ["Deployer"] as const;
export type ContractNames = typeof contractNames[number];

export interface HardhatRuntime {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethers?: any;
    hardhatArguments?: {
        config?: string;
    };
    network?: {
        name: string;
    };
}

export const getChainAddress = (contractName: ContractNames, chain: Chain): string | undefined => {
    if (chain === Chain.mainnet) {
        switch (contractName) {
            case "Deployer":
                return "0xbE126Fd179822c5Cb72b0e6E584a6F7afeb9eaBE";
            default:
        }
    } else if (chain === Chain.rinkeby) {
        switch (contractName) {
            case "Deployer":
                return "0xbE126Fd179822c5Cb72b0e6E584a6F7afeb9eaBE";
            default:
        }
    }
    return undefined;
};

export const getChain = (hre: HardhatRuntime = {}): Chain => {
    if (
        hre?.network?.name === "mainnet" ||
        ["tasks-fork.config.ts", "hardhat-fork.config.ts"].includes(hre?.hardhatArguments.config)
    ) {
        return Chain.mainnet;
    }
    if (hre?.network?.name === "rinkeby") {
        return Chain.rinkeby;
    }
    if (hre?.network?.name === "kovan") {
        return Chain.kovan;
    }
    return Chain.local;
};

export const getNetworkAddress = (contractName: ContractNames, hre: HardhatRuntime = {}): string | undefined => {
    const chain = getChain(hre);
    return getChainAddress(contractName, chain);
};

// Singleton instances of different contract names and token symbols
const resolvedAddressesInstances: { [contractNameSymbol: string]: { [contractType: string]: string } } = {};

// Update the singleton instance so we don't need to resolve this next time
const updateResolvedAddresses = (
    addressContractNameSymbol: string,
    contractType: AssetAddressTypes,
    address: string,
) => {
    if (resolvedAddressesInstances[addressContractNameSymbol]) {
        resolvedAddressesInstances[addressContractNameSymbol][contractType] = address;
    } else {
        resolvedAddressesInstances[addressContractNameSymbol] = { [contractType]: address };
    }
};

// Resolves a contract name or token symbol to an ethereum address
export const resolveAddress = (
    addressContractNameSymbol: string,
    chain = Chain.mainnet,
    tokenType: AssetAddressTypes = "address",
): string => {
    let address = addressContractNameSymbol;
    // If not an Ethereum address
    if (!addressContractNameSymbol.match(ethereumAddress)) {
        // If previously resolved then return from singleton instances
        if (resolvedAddressesInstances[addressContractNameSymbol]?.[tokenType])
            return resolvedAddressesInstances[addressContractNameSymbol][tokenType];

        address = getChainAddress(addressContractNameSymbol as ContractNames, chain) || address;

        if (!address) {
            // If a token Symbol
            const token = tokens.find(t => t.symbol === addressContractNameSymbol && t.chain === chain);
            if (!token)
                throw Error(
                    `Invalid approve address, token symbol or contract name "${addressContractNameSymbol}" for chain ${chain}`,
                );
            if (!token[tokenType])
                throw Error(
                    `Can not find token type "${tokenType}" for "${addressContractNameSymbol}" on chain ${chain}`,
                );

            address = token[tokenType];
            console.log(
                `Resolved asset with symbol "${addressContractNameSymbol}" and type "${tokenType}" to address ${address}`,
            );

            // Update the singleton instance so we don't need to resolve this next time
            updateResolvedAddresses(addressContractNameSymbol, tokenType, address);
            return address;
        }

        console.log(`Resolved contract name "${addressContractNameSymbol}" to address ${address}`);

        // Update the singleton instance so we don't need to resolve this next time
        updateResolvedAddresses(addressContractNameSymbol, tokenType, address);

        return address;
    }
    return address;
};

// Singleton instances of different contract names and token symbols
const resolvedTokenInstances: { [address: string]: { [tokenType: string]: Token } } = {};

export const resolveToken = (
    symbol: string,
    chain = Chain.mainnet,
    tokenType: AssetAddressTypes = "address",
): Token => {
    // If previously resolved then return from singleton instances
    if (resolvedTokenInstances[symbol]?.[tokenType]) return resolvedTokenInstances[symbol][tokenType];

    // If a token Symbol
    const token = tokens.find(t => t.symbol === symbol && t.chain === chain);
    if (!token) throw Error(`Can not find token symbol ${symbol} on chain ${chain}`);
    if (!token[tokenType]) throw Error(`Can not find token type "${tokenType}" for ${symbol} on chain ${chain}`);

    console.log(`Resolved token symbol ${symbol} and type "${tokenType}" to address ${token[tokenType]}`);

    if (resolvedTokenInstances[symbol]) {
        resolvedTokenInstances[symbol][tokenType] = token;
    } else {
        resolvedTokenInstances[symbol] = { [tokenType]: token };
    }

    return token;
};
