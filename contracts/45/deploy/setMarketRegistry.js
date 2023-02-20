const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, getChainId, network}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = await getChainId();

    const DAI = network.name === "hardhat" ? (await deployments.get("FaucetERC20")).address : configs[chainId]["DAI"];

    const uToken = await deployments.get("UToken");

    const userManager = await deployments.get("UserManager");

    console.log("setMarketRegistry start");

    const uTokens = await read("MarketRegistry", {from: deployer}, "getUTokens");
    let uTokenIsExist;
    for (let i = 0; i < uTokens.length; i++) {
        if (uTokens[i] === uToken.address) {
            uTokenIsExist = true;
            break;
        }
    }
    if (!uTokenIsExist) {
        tx = await execute("MarketRegistry", {from: deployer}, "addUToken", DAI, uToken.address);
        console.log("MarketRegistry addUToken, tx is:", tx.transactionHash);
    }

    const userManagerList = await read("MarketRegistry", {from: deployer}, "getUserManagers");
    let userManagerIsExist;
    for (let i = 0; i < userManagerList.length; i++) {
        if (userManagerList[i] === userManager.address) {
            userManagerIsExist = true;
            break;
        }
    }
    if (!userManagerIsExist) {
        tx = await execute("MarketRegistry", {from: deployer}, "addUserManager", DAI, userManager.address);
        console.log("MarketRegistry addUserManager, tx is:", tx.transactionHash);
    }
    console.log("setMarketRegistry end");
};
module.exports.tags = ["MarketRegistrySetting"];
module.exports.dependencies = ["MarketRegistry", "UToken", "UserManager"];
