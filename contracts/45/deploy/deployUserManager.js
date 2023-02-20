const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId, network}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    const DAI = network.name === "hardhat" ? (await deployments.get("FaucetERC20")).address : configs[chainId]["DAI"];

    const assetManager = await deployments.get("AssetManager");
    const unionToken = await deployments.get("UnionToken");
    const creditLimitModel = await deployments.get("SumOfTrust");
    const comptroller = await deployments.get("Comptroller");

    await deploy("UserManager", {
        from: deployer,
        proxy: {
            proxyContract: "UUPSProxy",
            execute: {
                methodName: "__UserManager_init",
                args: [
                    assetManager.address,
                    unionToken.address,
                    DAI,
                    creditLimitModel.address,
                    comptroller.address,
                    deployer
                ]
            }
        },
        log: true
    });
};
module.exports.tags = ["UserManager"];
module.exports.dependencies = ["AssetManager", "UnionToken", "SumOfTrust", "Comptroller"];
