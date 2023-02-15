module.exports = async ({getNamedAccounts}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();

    const uToken = await deployments.get("UToken");

    console.log("setUserManager start");
    if (!((await read("UserManager", {from: deployer}, "uToken")) === uToken.address)) {
        tx = await execute("UserManager", {from: deployer}, "setUToken", uToken.address);
        console.log("setUToken tx is:", tx.transactionHash);
    }
    console.log("setUserManager end");
};
module.exports.tags = ["UserManagerSetting"];
module.exports.dependencies = ["UserManager", "UToken"];
