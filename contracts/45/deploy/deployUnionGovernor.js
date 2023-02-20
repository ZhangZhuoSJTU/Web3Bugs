module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const unionToken = await deployments.get("UnionToken");

    const timelockController = await deployments.get("TimelockController");

    await deploy("UnionGovernor", {
        from: deployer,
        args: [unionToken.address, timelockController.address],
        log: true
    });
};
module.exports.tags = ["UnionGovernor"];
module.exports.dependencies = ["UnionToken", "TimelockController"];
