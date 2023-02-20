module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, treasury } = await getNamedAccounts();

    await deploy('GaugeProxy', {
        from: deployer,
        log: true,
        args: [treasury, deployer]
    });
};

module.exports.tags = ['v3', 'gauges'];
