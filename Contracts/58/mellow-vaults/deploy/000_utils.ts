import { PopulatedTransaction } from "@ethersproject/contracts";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { filter, fromPairs, keys, KeyValuePair, map, pipe } from "ramda";

export async function sendTx(
    hre: HardhatRuntimeEnvironment,
    tx: PopulatedTransaction
): Promise<TransactionReceipt> {
    console.log("Sending transaction to the pool...");
    tx.type = 2;
    const [operator] = await hre.ethers.getSigners();
    const txResp = await operator.sendTransaction(tx);
    console.log(
        `Sent transaction with hash \`${txResp.hash}\`. Waiting confirmation`
    );
    const wait =
        hre.network.name == "hardhat" || hre.network.name == "localhost"
            ? undefined
            : 2;
    const receipt = await txResp.wait(wait);
    console.log("Transaction confirmed");
    return receipt;
}

export const toObject = (obj: any) =>
    pipe(
        keys,
        filter((x: string) => isNaN(parseInt(x))),
        map((x) => [x, obj[x]] as KeyValuePair<string, any>),
        fromPairs
    )(obj);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {};
export default func;
