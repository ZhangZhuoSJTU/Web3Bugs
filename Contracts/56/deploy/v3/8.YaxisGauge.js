module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const YAXIS = await deployments.get('YaxisToken');
    const GaugeProxy = await deployments.get('GaugeProxy');
    const MinterWrapper = await deployments.get('Minter');

    const Gauge = await deploy('YAXISGauge', {
        contract: 'LiquidityGaugeV2',
        from: deployer,
        log: true,
        args: [YAXIS.address, MinterWrapper.address, GaugeProxy.address]
    });

    await execute(
        'GaugeController',
        { from: deployer, log: true },
        'add_gauge(address,int128,uint256)',
        Gauge.address,
        0,
        ethers.utils.parseEther('1')
    );
};

module.exports.tags = ['v3', 'gauges'];
