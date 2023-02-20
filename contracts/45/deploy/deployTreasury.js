module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const unionToken = await deployments.get("UnionToken");

    await deploy("Treasury", {
        from: deployer,
        args: [unionToken.address],
        log: true
    });
};
module.exports.tags = ["Treasury"];
module.exports.dependencies = ["UnionToken"];
