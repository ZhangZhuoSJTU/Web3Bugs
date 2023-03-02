module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    await deploy('Timelock', {
        contract: 'Timelock',
        from: deployer,
        log: true,
        args: [[deployer], [deployer], 86400]
    });
};

module.exports.tags = ['timelock', 'main', 'x'];
