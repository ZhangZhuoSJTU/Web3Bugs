const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    const unionToken = await deployments.get("UnionToken");

    const treasury = await deployments.get("Treasury");

    const params = configs[chainId]["TreasuryVester"];

    await deploy("TreasuryVester", {
        from: deployer,
        args: [
            unionToken.address,
            treasury.address,
            params.vestingAmount,
            params.vestingBegin,
            params.vestingCliff,
            params.vestingEnd
        ],
        log: true
    });
};
module.exports.tags = ["TreasuryVester"];
module.exports.dependencies = ["UnionToken", "Treasury"];
