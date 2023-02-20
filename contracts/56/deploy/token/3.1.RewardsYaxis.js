module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const { deployer, treasury } = await getNamedAccounts();
    const YAXIS = await deployments.get('YaxisToken');

    const Rewards = await deploy('RewardsYaxis', {
        contract: 'Rewards',
        from: deployer,
        log: true,
        args: [YAXIS.address, YAXIS.address, 7776000]
    });

    if (Rewards.newlyDeployed) {
        await execute(
            'RewardsYaxis',
            { from: deployer, log: true },
            'setRewardDistribution',
            treasury
        );
        await execute(
            'YaxisToken',
            { from: deployer, log: true },
            'transfer',
            Rewards.address,
            ethers.utils.parseEther('750000')
        );
    }
};

module.exports.tags = ['rewards'];
