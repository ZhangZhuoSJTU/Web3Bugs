module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy('VaultHelper', {
        from: deployer,
        log: true
    });
};

module.exports.tags = ['v3'];
