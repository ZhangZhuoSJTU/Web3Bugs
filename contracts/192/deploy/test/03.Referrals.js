module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, node } = await getNamedAccounts();
   
    await deploy('Referrals', {
        contract: 'Referrals',
        from: deployer,
        log: true,
    });
};

module.exports.tags = ['test'];
