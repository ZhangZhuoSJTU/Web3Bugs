import hre, { ethers, network } from "hardhat";
import { Contract } from "ethers";
import * as fs from "fs";
import { toBytes32 } from "../test/helpers";
import addresses from "../addresses.json";

interface Deployment {
    name: string;
    address: string;
}

// Used to add delay between deployment and etherscan verification
const delay = async (ms: number) => new Promise(res => setTimeout(res, ms));

const chainId: string = network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));

// True if you want to enable the etherscan verification
const etherscan = false;

// Configuration variables
const maxHoldingsCount = context[chainId].config.maxHoldingsCount;
const zeroExSwapTarget = context[chainId].config.zeroExSwapTarget;
const WETH = context[chainId].config.WETH;
const nestedTreasury = context[chainId].config.nestedTreasury;

let deployments: Deployment[];

async function main(): Promise<void> {
    console.log("Deploy All : ");

    // Get Factories
    const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
    const nestedAssetFactory = await ethers.getContractFactory("NestedAsset");
    const nestedRecordsFactory = await ethers.getContractFactory("NestedRecords");
    const operatorResolverFactory = await ethers.getContractFactory("OperatorResolver");
    const flatOperatorFactory = await ethers.getContractFactory("FlatOperator");
    const zeroExOperatorFactory = await ethers.getContractFactory("ZeroExOperator");
    const nestedFactoryFactory = await ethers.getContractFactory("NestedFactory");
    const nestedReserveFactory = await ethers.getContractFactory("NestedReserve");

    // Deploy FeeSplitter
    const feeSplitter = await feeSplitterFactory.deploy([nestedTreasury], [80], 20, WETH);
    await verify("FeeSplitter", feeSplitter, [[nestedTreasury], [80], 20, WETH]);

    // Deploy NestedAsset
    const nestedAsset = await nestedAssetFactory.deploy();
    await verify("NestedAsset", nestedAsset, []);

    // Deploy NestedRecords
    const nestedRecords = await nestedRecordsFactory.deploy(maxHoldingsCount);
    await verify("NestedRecords", nestedRecords, [maxHoldingsCount]);

    // Deploy OperatorResolver
    const operatorResolver = await operatorResolverFactory.deploy();
    await verify("OperatorResolver", operatorResolver, []);

    // Deploy ZeroExOperator
    const zeroExOperator = await zeroExOperatorFactory.deploy(zeroExSwapTarget);
    await verify("ZeroExOperator", zeroExOperator, [zeroExSwapTarget]);

    // Deploy FlatOperator
    const flatOperator = await flatOperatorFactory.deploy();
    await verify("FlatOperator", flatOperator, []);

    // Deploy NestedFactory
    const nestedFactory = await nestedFactoryFactory
        .deploy(
            nestedAsset.address,
            nestedRecords.address,
            feeSplitter.address,
            WETH,
            operatorResolver.address,
        );
    await verify("NestedFactory", nestedFactory, [nestedAsset.address,
        nestedRecords.address,
        feeSplitter.address,
        WETH,
        operatorResolver.address]);

    // Deploy NestedReserve
    const nestedReserve = await nestedReserveFactory.deploy(nestedFactory.address);
    await verify("NestedReserve", nestedReserve, [nestedFactory.address]);

    // Set factory to asset and records
    await nestedAsset.setFactory(nestedFactory.address);
    await nestedRecords.setFactory(nestedFactory.address);

    // Add operators to OperatorResolver
    const zeroExOperatorNameBytes32 = toBytes32("ZeroEx");
    const flatOperatorNameBytes32 = toBytes32("Flat");
    await operatorResolver
        .importOperators(
            [zeroExOperatorNameBytes32, flatOperatorNameBytes32],
            [zeroExOperator.address, flatOperator.address],
        );

    // Add operators to factory and rebuild cache
    await nestedFactory.addOperator(zeroExOperatorNameBytes32);
    await nestedFactory.addOperator(flatOperatorNameBytes32);
    await nestedFactory.rebuildCache();

    // Convert JSON object to string
    const data = JSON.stringify(deployments);

    // write JSON string to a file
    fs.writeFile('deploy' + Date.now() + '.json', data, (err) => {
        if (err) {
            throw err;
        }
    });
}

async function verify(name: string, contract: Contract, params: any[]) {
    await contract.deployed();
    if (etherscan) {
        // wait 1 minute (recommended)
        await delay(60000);
        await hre.run("verify:verify", {
            address: contract.address,
            constructorArguments: params,
        });
    }
    deployments.push({name: name, address: contract.address})
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
