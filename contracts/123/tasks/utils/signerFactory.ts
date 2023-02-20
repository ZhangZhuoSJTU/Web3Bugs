import { Signer, Wallet } from "ethers";
import { ethereumAddress, privateKey } from "../../test-utils/regex";
import { impersonate } from "../../test-utils/fork";
import { Account } from "types";
import { getChain, getChainAddress, HardhatRuntime, resolveAddress } from "./networkAddressFactory";

let signerInstance: Signer;

export const getSigner = async (hre: HardhatRuntime = {}, useCache = true, key?: string): Promise<Signer> => {
    // If already initiated a signer, just return the singleton instance
    if (useCache && signerInstance) return signerInstance;

    const pk = key || process.env.PRIVATE_KEY;
    if (pk) {
        if (!pk.match(privateKey)) {
            throw Error(`Invalid format of private key`);
        }
        const wallet = new Wallet(pk, hre.ethers.provider);
        console.log(`Using signer ${await wallet.getAddress()} from private key`);
        return wallet;
    }

    // If connecting to a forked chain
    if (["tasks-fork.config.ts", "hardhat-fork.config.ts"].includes(hre?.hardhatArguments.config)) {
        const chain = getChain(hre);
        // If IMPERSONATE environment variable has been set
        if (process.env.IMPERSONATE) {
            let address = process.env.IMPERSONATE;
            if (!address.match(ethereumAddress)) {
                address = resolveAddress(process.env.IMPERSONATE, chain);
                if (!address)
                    throw Error(`Environment variable IMPERSONATE is an invalid Ethereum address or contract name`);
            }
            console.log(`Impersonating account ${address} from IMPERSONATE environment variable`);
            signerInstance = await impersonate(address);
            return signerInstance;
        }
        const address = getChainAddress("Deployer", chain);
        if (address) {
            console.log(`Impersonating account ${address} resolved from "Deployer"`);
            signerInstance = await impersonate(address);
            return signerInstance;
        }
        // Return a random account with no Ether
        signerInstance = Wallet.createRandom().connect(hre.ethers.provider);
        console.log(`Impersonating random account ${await signerInstance.getAddress()}`);
        return signerInstance;
    }

    // Return a random account with no Ether.
    // This is typically used for readonly tasks. eg reports
    signerInstance = Wallet.createRandom().connect(hre.ethers.provider);
    return signerInstance;
};

export const getSignerAccount = async (hre: HardhatRuntime = {}): Promise<Account> => {
    const signer = await getSigner(hre);
    return {
        signer,
        address: await signer.getAddress(),
    };
};
