const configs = require("../deployConfig.json");

module.exports = async ({ethers, getNamedAccounts, getChainId}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    const comptroller = await deployments.get("Comptroller");

    const params = configs[chainId]["Treasury"];

    console.log("setTreasury start");
    if (
        (await read("Treasury", {from: deployer}, "tokenSchedules", comptroller.address)).target ===
        ethers.constants.AddressZero
    ) {
        tx = await execute(
            "Treasury",
            {from: deployer},
            "addSchedule",
            params.dripStart,
            params.dripRate,
            comptroller.address,
            params.dripAmount
        );
        console.log("Treasury addSchedule, tx is:", tx.transactionHash);
    }
    console.log("setTreasury end");
};
module.exports.tags = ["TreasurySetting"];
module.exports.dependencies = ["Treasury", "Comptroller"];
