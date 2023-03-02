module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();
   
    const Position = await deploy('Position', {
        contract: 'Position',
        from: deployer,
        log: true,
        args: ["", "Tigris Position NFT", "Tigris Position NFT"]
    });

};

module.exports.tags = ['main', 'position'];
