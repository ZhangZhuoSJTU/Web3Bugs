module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const GaugeController = await deployments.get('GaugeController');

    let yaxis;
    try {
        yaxis = await deployments.get('YaxisToken');
    } catch {
        yaxis = await deploy('YaxisToken', {
            from: deployer
        });
    }

    const MinterWrapper = await deployments.deploy('MinterWrapper', {
        from: deployer,
        log: true,
        args: [yaxis.address]
    });

    const Minter = await deployments.deploy('Minter', {
        from: deployer,
        log: true,
        args: [MinterWrapper.address, GaugeController.address]
    });

    if (MinterWrapper.newlyDeployed) {
        await execute(
            'MinterWrapper',
            { from: deployer, log: true },
            'setMinter',
            Minter.address
        );
    }
};

module.exports.tags = ['v3', 'gauges'];
