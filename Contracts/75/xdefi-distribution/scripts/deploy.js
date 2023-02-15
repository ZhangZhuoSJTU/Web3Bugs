const hre = require('hardhat');

async function main() {
    const { xdefi, baseURI, zeroDurationPointBase } = require('../.secrets.json')[hre.network.name];
    const [deployer] = await ethers.getSigners();
    const balance = BigInt((await deployer.getBalance()).toString());

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", balance);
    console.log("Token address:", xdefi);

    if (!balance) return;

    const XDEFIDistribution = await (await (await ethers.getContractFactory("XDEFIDistribution")).deploy(xdefi, baseURI, zeroDurationPointBase)).deployed();

    console.log("XDEFIDistribution address:", XDEFIDistribution.address);

    const XDEFIDistributionHelper = await (await (await ethers.getContractFactory("XDEFIDistributionHelper")).deploy()).deployed();

    console.log("XDEFIDistributionHelper address:", XDEFIDistributionHelper.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
