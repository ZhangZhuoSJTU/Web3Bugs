const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    await deploy("SumOfTrust", {
        from: deployer,
        args: [configs[chainId]["SumOfTrust"]["effectiveNumber"]],
        log: true
    });
};
module.exports.tags = ["SumOfTrust"];
