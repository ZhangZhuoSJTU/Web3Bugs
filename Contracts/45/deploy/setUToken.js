module.exports = async ({getNamedAccounts}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();

    const assetManager = await deployments.get("AssetManager");

    const fixedInterestRateModel = await deployments.get("FixedInterestRateModel");

    const userManager = await deployments.get("UserManager");

    console.log("setUToken start");
    if (!((await read("UToken", {from: deployer}, "assetManager")) === assetManager.address)) {
        tx = await execute("UToken", {from: deployer}, "setAssetManager", assetManager.address);
        console.log("setAssetManager tx is:", tx.transactionHash);
    }
    if (!((await read("UToken", {from: deployer}, "userManager")) === userManager.address)) {
        tx = await execute("UToken", {from: deployer}, "setUserManager", userManager.address);
        console.log("setUserManager tx is:", tx.transactionHash);
    }
    if (!((await read("UToken", {from: deployer}, "interestRateModel")) === fixedInterestRateModel.address)) {
        tx = await execute("UToken", {from: deployer}, "setInterestRateModel", fixedInterestRateModel.address);
        console.log("setInterestRateModel tx is:", tx.transactionHash);
    }
    console.log("setUToken end");
};
module.exports.tags = ["UTokenSetting"];
module.exports.dependencies = ["AssetManager", "FixedInterestRateModel", "UserManager"];
