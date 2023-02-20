import hre, { ethers, network } from "hardhat";
import addresses from "../addresses.json";
import { toBytes32 } from "../test/helpers";

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

// True if you want to enable the etherscan verification
const etherscan = false;

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

async function main(): Promise<void> {
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");

    const operatorResolver = await operatorResolverFactory.attach(context[chainId].OperatorResolver);
    const nestedFactory = await nestedFactoryFactory.attach(context[chainId].NestedFactory);

    // Deploy FlatOperator
    const flatOperator = await flatOperatorFactory.deploy();
    await flatOperator.deployed();
    if (etherscan) {
        // wait 1 minute (recommended)
        await delay(60000);
        await hre.run("verify:verify", {
            address: flatOperator.address,
        });
    }

    const flatOperatorNameBytes32 = toBytes32("Flat");
    await operatorResolver
        .importOperators(
            [flatOperatorNameBytes32],
            [flatOperator.address],
        );

    await nestedFactory.addOperator(flatOperatorNameBytes32);
    await nestedFactory.rebuildCache();
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
