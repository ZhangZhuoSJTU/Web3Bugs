import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Contract, ContractFactory, ContractReceipt, ContractTransaction, Overrides } from "ethers";
import { formatUnits } from "@ethersproject/units";
import { ExtSystemConfig } from "../../scripts/deploySystem";

export const deployContract = async <T extends Contract>(
    hre: HardhatRuntimeEnvironment,
    contractFactory: ContractFactory,
    contractName = "Contract",
    constructorArgs: Array<unknown> = [],
    overrides: Overrides = {},
    debug = true,
    waitForBlocks = undefined,
): Promise<T> => {
    const contract = (await contractFactory.deploy(...constructorArgs, overrides)) as T;
    if (debug) {
        console.log(
            `\nDeploying ${contractName} contract with hash ${contract.deployTransaction.hash} from ${
                contract.deployTransaction.from
            } with gas price ${contract.deployTransaction.gasPrice?.toNumber() || 0 / 1e9} Gwei`,
        );
    }
    const receipt = await contract.deployTransaction.wait(waitForBlocks);
    const txCost = receipt.gasUsed.mul(contract.deployTransaction.gasPrice || 0);
    const abiEncodedConstructorArgs = contract.interface.encodeDeploy(constructorArgs);

    if (debug) {
        console.log(
            `\nDeployed ${contractName} to ${contract.address} in block ${receipt.blockNumber}, using ${
                receipt.gasUsed
            } gas costing ${formatUnits(txCost)} ETH`,
        );
        console.log(`ABI encoded args: ${abiEncodedConstructorArgs.slice(2)}`);
    }

    // await verifyEtherscan(hre, {
    //     address: contract.address,
    //     constructorArguments: constructorArgs,
    // });

    return contract;
};

export const logTxDetails = async (tx: ContractTransaction, method: string): Promise<ContractReceipt> => {
    console.log(
        `Sent ${method} transaction with hash ${tx.hash} from ${tx.from} with gas price ${
            tx.gasPrice?.toNumber() || 0 / 1e9
        } Gwei`,
    );
    const receipt = await tx.wait();

    // Calculate tx cost in Wei
    const txCost = receipt.gasUsed.mul(tx.gasPrice ?? 0);
    console.log(
        `Processed ${method} tx in block ${receipt.blockNumber}, using ${receipt.gasUsed} gas costing ${formatUnits(
            txCost,
        )} ETH`,
    );

    return receipt;
};

export function logExtSystem(system: ExtSystemConfig) {
    const keys = Object.keys(system);
    console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    console.log(`~~~~~~~ EXT  SYSTEM ~~~~~~~`);
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`);
    keys.map(k => {
        console.log(`${k}:\t${system[k]}`);
    });
}

export function logContracts(contracts: { [key: string]: { address: string } }) {
    const keys = Object.keys(contracts);
    console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    console.log(`~~~~ SYSTEM DEPLOYMENT ~~~~`);
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~\n`);
    keys.map(k => {
        if (Array.isArray(contracts[k])) {
            console.log(`${k}:\t[${(contracts[k] as any as [{ address: string }]).map(i => i.address)}]`);
        } else {
            console.log(`${k}:\t${contracts[k].address}`);
        }
    });
}

export async function waitForTx(
    tx: ContractTransaction,
    debug = false,
    waitForBlocks = undefined,
): Promise<ContractReceipt> {
    const receipt = await tx.wait(waitForBlocks);
    if (debug) {
        console.log(`\nTRANSACTION: ${receipt.transactionHash}`);
        console.log(`to:: ${tx.to}`);
        console.log(`txData:: ${tx.data}`);
    }
    return receipt;
}
