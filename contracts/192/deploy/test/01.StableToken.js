module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const Nonce = await ethers.provider.getTransactionCount(deployer);
    const StableToken = await deploy('StableToken', {
        contract: 'StableToken',
        from: deployer,
        log: true,
        nonce: Nonce,
        args: ["Tigris USD Stablecoin", "tigUSD"]
    });
};

module.exports.tags = ['test'];
