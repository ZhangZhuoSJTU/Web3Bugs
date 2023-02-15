import hre from "hardhat";
import addresses from "../addresses.json";
import { BigNumber } from "ethers";

const chainId: string = hre.network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

const newMaxHoldings = BigNumber.from(15);

async function main(): Promise<void> {
    const nestedRecordsFactory = await hre.ethers.getContractFactory("NestedRecords");
    const nestedRecords = await nestedRecordsFactory.attach(context[chainId].NestedRecords);
    await nestedRecords.setMaxHoldingsCount(newMaxHoldings);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
