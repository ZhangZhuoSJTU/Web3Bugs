const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = await getChainId();
    const timelock = await deployments.get("TimelockController");

    console.log("changeAdmin start");
    if (
        configs[chainId]["AaveAdapter"] &&
        !(await read("AaveAdapter", {from: deployer}, "isAdmin", timelock.address))
    ) {
        tx = await execute("AaveAdapter", {from: deployer}, "addAdmin", timelock.address);
        console.log("AaveAdapter addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("CompoundAdapter", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("CompoundAdapter", {from: deployer}, "addAdmin", timelock.address);
        console.log("CompoundAdapter addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("PureTokenAdapter", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("PureTokenAdapter", {from: deployer}, "addAdmin", timelock.address);
        console.log("PureTokenAdapter addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("Comptroller", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("Comptroller", {from: deployer}, "addAdmin", timelock.address);
        console.log("Comptroller addAdmin, tx is:", tx.transactionHash);
    }
    if (!((await read("UnionToken", {from: deployer}, "owner")) === timelock.address)) {
        tx = await execute("UnionToken", {from: deployer}, "transferOwnership", timelock.address);
        console.log("UnionToken addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("AssetManager", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("AssetManager", {from: deployer}, "addAdmin", timelock.address);
        console.log("AssetManager addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("MarketRegistry", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("MarketRegistry", {from: deployer}, "addAdmin", timelock.address);
        console.log("MarketRegistry addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("UserManager", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("UserManager", {from: deployer}, "addAdmin", timelock.address);
        console.log("UserManager addAdmin, tx is:", tx.transactionHash);
    }
    if (!(await read("UToken", {from: deployer}, "isAdmin", timelock.address))) {
        tx = await execute("UToken", {from: deployer}, "addAdmin", timelock.address);
        console.log("UToken addAdmin, tx is:", tx.transactionHash);
    }
    //After running for a period of time, give up the admin permission of the deployer
    console.log("changeAdmin end");
};
module.exports.tags = ["ChangeAdmin"];
module.exports.dependencies = [
    "TimelockController",
    "AaveAdapter",
    "CompoundAdapter",
    "PureTokenAdapter",
    "Comptroller",
    "UnionTokenSetting",
    "AssetManager",
    "MarketRegistry",
    "UserManager",
    "UToken"
];
