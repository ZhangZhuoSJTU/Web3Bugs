module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, SALETOKEN } = await getNamedAccounts();

    const GovNFT = await deployments.get("GovNFT");
    const NFTSale = await deploy('NFTSale', {
        contract: 'NFTSale',
        from: deployer,
        log: true,
        args: [GovNFT.address, SALETOKEN]
    });

    if(NFTSale.newlyDeployed) {
        await execute(
            'NFTSale',
            { from: deployer, log: true },
            'setPrice(uint256)',
            600000000
        );
    }
};

module.exports.tags = ['nftsale'];
