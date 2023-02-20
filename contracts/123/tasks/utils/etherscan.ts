import { HardhatRuntimeEnvironment } from "hardhat/types";

interface VerifyEtherscan {
    address: string;
    contract?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    constructorArguments?: any[];
    libraries?: {
        [libraryName: string]: string;
    };
}

export const verifyEtherscan = async (hre: HardhatRuntimeEnvironment, contract: VerifyEtherscan): Promise<void> => {
    if (
        hre.network.name == "mainnet" &&
        !["tasks-fork.config.ts", "hardhat-fork.config.ts"].includes(hre.hardhatArguments.config)
    ) {
        console.log(`About to verify ${contract.address} on Etherscan`);
        await hre.run("verify:verify", contract);
    }
};
