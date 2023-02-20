module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let { deployer, treasury, YaxisEthUniswapV2Pair } = await getNamedAccounts();
    const chainId = await getChainId();
    const YAXIS = await deployments.get('YaxisToken');

    if (chainId != '1') {
        const WETH = await deployments.get('WETH');
        const Pair = await deploy('YaxisEthUniswapV2Pair', {
            contract: 'MockUniswapPair',
            from: deployer,
            log: true,
            args: [YAXIS.address, WETH.address]
        });
        YaxisEthUniswapV2Pair = Pair.address;
    }

    const Rewards = await deploy('RewardsYaxisEth', {
        contract: 'Rewards',
        from: deployer,
        log: true,
        args: [YAXIS.address, YaxisEthUniswapV2Pair, 6480000]
    });

    if (Rewards.newlyDeployed) {
        await execute(
            'RewardsYaxisEth',
            { from: deployer, log: true },
            'setRewardDistribution',
            treasury
        );
        await execute(
            'YaxisToken',
            { from: deployer, log: true },
            'transfer',
            Rewards.address,
            ethers.utils.parseEther('250000')
        );
    }
};

module.exports.tags = ['rewards'];
module.exports.dependencies = ['token'];
