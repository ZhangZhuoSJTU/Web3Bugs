module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const Manager = await deployments.get('Manager');
    const Controller = await deployments.get('Controller');
    const LegacyController = await deployments.get('LegacyController');

    const harvester = await deploy('Harvester', {
        from: deployer,
        log: true,
        args: [Manager.address, Controller.address, LegacyController.address]
    });

    if (harvester.newlyDeployed) {
        const manager = await ethers.getContractAt('Manager', Manager.address, deployer);
        if ((await manager.governance()) == deployer) {
            await execute(
                'Manager',
                { from: deployer, log: true },
                'setHarvester',
                harvester.address
            );

            await execute(
                'Harvester',
                { from: deployer, log: true },
                'setHarvester',
                deployer,
                true
            );
        }
    }
};

module.exports.tags = ['v3'];
