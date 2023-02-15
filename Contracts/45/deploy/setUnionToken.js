const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, getChainId}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    const comptroller = await deployments.get("Comptroller");

    const treasuryVester = await deployments.get("TreasuryVester");

    console.log("setUnionToken start");
    if (!(await read("UnionToken", {from: deployer}, "whitelistEnabled"))) {
        tx = await execute("UnionToken", {from: deployer}, "enableWhitelist");
        console.log("UnionToken enableWhitelist, tx is:", tx.transactionHash);
    }
    if (!(await read("UnionToken", {from: deployer}, "isWhitelisted", comptroller.address))) {
        tx = await execute("UnionToken", {from: deployer}, "whitelist", comptroller.address);
        console.log("UnionToken whitelist, tx is:", tx.transactionHash);
    }
    if ((await read("UnionToken", {from: deployer}, "balanceOf", comptroller.address)) == "0") {
        tx = await execute(
            "UnionToken",
            {from: deployer},
            "transfer",
            comptroller.address,
            configs[chainId]["UnionToken"]["comptrollerAmount"]
        );
        console.log("UnionToken transfer comptroller, tx is:", tx.transactionHash);
    }

    if ((await read("UnionToken", {from: deployer}, "balanceOf", treasuryVester.address)) == "0") {
        tx = await execute(
            "UnionToken",
            {from: deployer},
            "transfer",
            treasuryVester.address,
            configs[chainId]["UnionToken"]["amountForTreasuryVester"]
        );
        console.log("UnionToken transfer treasuryVester, tx is:", tx.transactionHash);
    }
    console.log("setUnionToken end");
};
module.exports.tags = ["UnionTokenSetting"];
module.exports.dependencies = ["UnionToken", "Comptroller", "TreasuryVester"];
