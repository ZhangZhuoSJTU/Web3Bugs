module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { YaxisEthUniswapV2Pair, deployer } = await getNamedAccounts();
    const chainId = await getChainId();
    const YAXIS = await deployments.get('YaxisToken');
    const RewardsYaxis = await deployments.get('RewardsYaxis');
    const RewardsYaxisEth = await deployments.get('RewardsYaxisEth');

    if (chainId != '1') {
        const Pair = await deployments.get('YaxisEthUniswapV2Pair');
        YaxisEthUniswapV2Pair = Pair.address;
        await deploy('YaxisVoteProxy', {
            from: deployer,
            log: true
        });
    }

    const votePower = await deploy('YaxisVotePower', {
        from: deployer,
        log: true,
        args: [
            YAXIS.address,
            RewardsYaxis.address,
            RewardsYaxisEth.address,
            YaxisEthUniswapV2Pair
        ]
    });

    if (chainId != '1') {
        await execute('YaxisVoteProxy', { from: deployer }, 'setVoteProxy', votePower.address);
    }
};

module.exports.tags = ['governance', 'snapshot'];
