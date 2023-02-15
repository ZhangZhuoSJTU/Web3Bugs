import hre from "hardhat";
import addresses from "../addresses.json";

const chainId: string = hre.network.config.chainId.toString();
const context = JSON.parse(JSON.stringify(addresses));
const timelockMinDelay = 7 * 24 * 60 * 60;

async function main(): Promise<void> {
    const TimelockFactory = await hre.ethers.getContractFactory("TimelockController");
    const feeSplitterFactory = await hre.ethers.getContractFactory("FeeSplitter");
    const nestedAssetFactory = await hre.ethers.getContractFactory("NestedAsset");
    const nestedRecordsFactory = await hre.ethers.getContractFactory("NestedRecords");
    const operatorResolverFactory = await hre.ethers.getContractFactory("OperatorResolver");
    const zeroExOperatorFactory = await hre.ethers.getContractFactory("ZeroExOperator");
    const zeroExStorageFactory = await hre.ethers.getContractFactory("ZeroExStorage");
    const nestedFactoryFactory = await hre.ethers.getContractFactory("NestedFactory");
    const nestedReserveFactory = await hre.ethers.getContractFactory("NestedReserve");

    const feeSplitter = await feeSplitterFactory.attach(context[chainId].FeeSplitter);
    const nestedAsset = await nestedAssetFactory.attach(context[chainId].NestedAsset);
    const nestedRecords = await nestedRecordsFactory.attach(context[chainId].NestedRecords);
    const operatorResolver = await operatorResolverFactory.attach(context[chainId].OperatorResolver);
    const zeroExOperator = await zeroExOperatorFactory.attach(context[chainId].ZeroExOperator);
    const storageAddress = await zeroExOperator.storageAddress(zeroExOperator.address);
    const zeroExStorage = await zeroExStorageFactory.attach(storageAddress);
    const nestedFactory = await nestedFactoryFactory.attach(context[chainId].NestedFactory);
    const nestedReserve = await nestedReserveFactory.attach(context[chainId].NestedReserve);

    // add dev team multisig wallet here
    const multisig = context[chainId].config.multisig;
    const timelock = await TimelockFactory.deploy(timelockMinDelay, [multisig], [multisig]);

    // Transfer (all) ownerships to timelock
    await feeSplitter.transferOwnership(timelock.address);
    await nestedAsset.transferOwnership(timelock.address);
    await nestedRecords.transferOwnership(timelock.address);
    await operatorResolver.transferOwnership(timelock.address);
    await zeroExStorage.transferOwnership(timelock.address);
    await nestedFactory.transferOwnership(timelock.address);
    await nestedReserve.transferOwnership(timelock.address);
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
