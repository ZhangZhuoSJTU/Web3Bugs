module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();
   
    const Nonce = await ethers.provider.getTransactionCount(deployer);
    const Position = await deploy('Position', {
        contract: 'Position',
        from: deployer,
        log: true,
        nonce: Nonce,
        args: ["", "Tigris Position NFT test", "Tigris Position NFT test"]
    });

};

module.exports.tags = ['test'];
