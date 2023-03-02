module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const Stable = await deployments.get('StableToken');

    const StableVault = await deploy('StableVault', {
        contract: 'StableVault',
        from: deployer,
        log: true,
        args: [Stable.address]
    });

    if(StableVault.newlyDeployed) {
        await execute(
            'StableToken',
            { from: deployer, log: true },
            'setMinter(address,bool)',
            StableVault.address,
            true
        );
    }
};

module.exports.tags = ['main'];
