module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    await deploy("MarketRegistry", {
        from: deployer,
        proxy: {
            proxyContract: "UUPSProxy",
            execute: {
                methodName: "__MarketRegistry_init",
                args: []
            }
        },
        log: true
    });
};
module.exports.tags = ["MarketRegistry"];
