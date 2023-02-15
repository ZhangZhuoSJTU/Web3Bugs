module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const assetManager = await deployments.get("AssetManager");
    await deploy("PureTokenAdapter", {
        from: deployer,
        proxy: {
            proxyContract: "UUPSProxy",
            execute: {
                methodName: "__PureTokenAdapter_init",
                args: [assetManager.address]
            }
        },
        log: true
    });
};
module.exports.tags = ["PureTokenAdapter"];
module.exports.dependencies = ["AssetManager"];
