const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, getChainId, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = await getChainId();
    const assetManager = await deployments.get("AssetManager");
    if (configs[chainId]["CompoundAdapter"]) {
        await deploy("CompoundAdapter", {
            from: deployer,
            proxy: {
                proxyContract: "UUPSProxy",
                execute: {
                    methodName: "__CompoundAdapter_init",
                    args: [assetManager.address]
                }
            },
            log: true
        });
    }
};
module.exports.tags = ["CompoundAdapter"];
module.exports.dependencies = ["AssetManager"];
