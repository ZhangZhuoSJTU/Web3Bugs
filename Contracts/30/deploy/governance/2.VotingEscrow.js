module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const { deployer, treasury } = await getNamedAccounts();
    const name = 'Vote-escrowed YAXIS';
    const symbol = 'veYAXIS';
    const version = 'veYAXIS_1.0.0';

    let yaxis;
    try {
        yaxis = await deployments.get('YaxisToken');
    } catch {
        yaxis = await deploy('YaxisToken', {
            from: deployer
        });
    }

    const VotingEscrow = await deploy('VotingEscrow', {
        from: deployer,
        log: true,
        args: [yaxis.address, name, symbol, version]
    });

    if (VotingEscrow.newlyDeployed) {
        await execute(
            'VotingEscrow',
            { from: deployer, log: true },
            'commit_transfer_ownership',
            treasury
        );
    }
};

module.exports.tags = ['v3', 'gauges'];
