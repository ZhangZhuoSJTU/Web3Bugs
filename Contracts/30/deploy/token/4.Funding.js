module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { execute, read } = deployments;
    const { deployer, developFund, teamFund, treasury } = await getNamedAccounts();

    await execute(
        'YaxisToken',
        { from: deployer, log: true },
        'transfer',
        developFund,
        ethers.utils.parseEther('400000')
    );

    await execute(
        'YaxisToken',
        { from: deployer, log: true },
        'transfer',
        teamFund,
        ethers.utils.parseEther('300000')
    );

    const remaining = await read('YaxisToken', { from: deployer }, 'balanceOf', deployer);
    await execute(
        'YaxisToken',
        { from: deployer, log: true },
        'transfer',
        treasury,
        remaining
    );
};

module.exports.tags = ['funding'];
