module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, endpoint } = await getNamedAccounts();

    const chainId = await getChainId();

    if (chainId != '137') {
        const NFT = await deploy('GovNFT', {
            contract: 'GovNFTBridged',
            from: deployer,
            log: true,
            args: [endpoint, "", "Tigris Governance NFT", "Tigris Gov NFT"]
        });
        const StableToken = await deployments.get('StableToken');
        if (NFT.newlyDeployed) {
            await execute(
                'GovNFT',
                { from: deployer, log: true },
                'addAsset(address)',
                StableToken.address,
            );
        }
    } else {
        const StableToken = await deployments.get('StableToken');
        const NFT = await deploy('GovNFT', {
            contract: 'GovNFT',
            from: deployer,
            log: true,
            args: [endpoint, "", "Tigris Governance NFT", "Tigris Gov NFT"]
        });
        await execute(
            'GovNFT',
            { from: deployer, log: true },
            'addAsset(address)',
            StableToken.address,
        );        
    }
};

module.exports.tags = ['main', 'govnft'];
