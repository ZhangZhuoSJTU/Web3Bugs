module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    let { deployer } = await getNamedAccounts();

    let yaxis;
    try {
        yaxis = await deployments.get('YaxisToken');
    } catch {
        yaxis = await deploy('YaxisToken', {
            from: deployer
        });
    }

    await deploy('Manager', {
        from: deployer,
        log: true,
        args: [yaxis.address]
    });
};

module.exports.tags = ['v3'];
