module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, endpoint } = await getNamedAccounts();

    const StableToken = await deployments.get('StableToken');

    await deploy('GovNFT', {
        contract: 'GovNFT',
        from: deployer,
        log: true,
        args: [endpoint, "", "Tigris Governance NFT Test", "Tigris Gov NFT Test"]
    });

    await execute(
        'GovNFT',
        { from: deployer, log: true },
        'addAsset(address)',
        StableToken.address,
    );
};

module.exports.tags = ['test'];
