const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    await deploy("UnionToken", {
        from: deployer,
        args: [
            configs[chainId]["UnionToken"]["name"],
            configs[chainId]["UnionToken"]["symbol"],
            configs[chainId]["UnionToken"]["mintingAllowedAfter"]
        ],
        log: true
    });
};
module.exports.tags = ["UnionToken"];
