module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();
   
    const Nonce = await ethers.provider.getTransactionCount(deployer);
    await deploy('Referrals', {
        contract: 'Referrals',
        from: deployer,
        log: true,
        nonce: Nonce,
    });
};

module.exports.tags = ['main', 'refcontract'];
