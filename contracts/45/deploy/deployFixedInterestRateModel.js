const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    await deploy("FixedInterestRateModel", {
        from: deployer,
        args: [configs[chainId]["FixedInterestRateModel"]["interestRatePerBlock"]],
        log: true
    });
};
module.exports.tags = ["FixedInterestRateModel"];
