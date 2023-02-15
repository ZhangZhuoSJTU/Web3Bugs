module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const unionToken = await deployments.get("UnionToken");
    const marketRegistry = await deployments.get("MarketRegistry");

    await deploy("Comptroller", {
        from: deployer,
        proxy: {
            proxyContract: "UUPSProxy",
            execute: {
                methodName: "__Comptroller_init",
                args: [unionToken.address, marketRegistry.address]
            }
        },
        log: true
    });
};
module.exports.tags = ["Comptroller"];
module.exports.dependencies = ["UnionToken", "MarketRegistry"];
