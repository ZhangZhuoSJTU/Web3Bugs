const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    await deploy("UErc20", {
        from: deployer,
        args: [configs[chainId]["UErc20"]["name"], configs[chainId]["UErc20"]["symbol"]],
        log: true
    });
};
module.exports.tags = ["UErc20"];
