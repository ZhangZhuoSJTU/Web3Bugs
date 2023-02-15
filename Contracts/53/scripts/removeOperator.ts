import hre, { ethers, network } from "hardhat";
import addresses from "../addresses.json";
import { toBytes32 } from "../test/helpers";

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

async function main(): Promise<void> {
    // Name of the operator to remove
    const operatorNameBytes32 = toBytes32("Flat");

    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");

    const operatorResolver = await operatorResolverFactory.attach(context[chainId].OperatorResolver);
    const nestedFactory = await nestedFactoryFactory.attach(context[chainId].NestedFactory);

    await operatorResolver
        .importOperators(
            [operatorNameBytes32],
            [hre.ethers.constants.AddressZero],
        );
    await nestedFactory.rebuildCache();
    await nestedFactory.removeOperator(operatorNameBytes32);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
