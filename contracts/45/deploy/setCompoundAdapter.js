const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, getChainId, network}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = await getChainId();

    if (configs[chainId]["CompoundAdapter"]) {
        const DAI =
            network.name === "hardhat" ? (await deployments.get("FaucetERC20")).address : configs[chainId]["DAI"];

        const cDAI =
            network.name === "hardhat" ? (await deployments.get("FaucetERC20")).address : configs[chainId]["cDAI"];

        console.log("setCompoundAdapter start");
        if (
            !(
                (await read("CompoundAdapter", {from: deployer}, "ceilingMap", DAI)) ===
                configs[chainId]["CompoundAdapter"]["compoundTokenCeiling"]
            )
        ) {
            tx = await execute(
                "CompoundAdapter",
                {from: deployer},
                "setCeiling",
                DAI,
                configs[chainId]["CompoundAdapter"]["compoundTokenCeiling"]
            );
            console.log("CompoundAdapter setCeiling, tx is:", tx.transactionHash);
        }
        if (
            !(
                (await read("CompoundAdapter", {from: deployer}, "floorMap", DAI)) ===
                configs[chainId]["CompoundAdapter"]["compoundTokenFloor"]
            )
        ) {
            tx = await execute(
                "CompoundAdapter",
                {from: deployer},
                "setFloor",
                DAI,
                configs[chainId]["CompoundAdapter"]["compoundTokenFloor"]
            );
            console.log("CompoundAdapter, setFloor, tx is:", tx.transactionHash);
        }
        if (!((await read("CompoundAdapter", {from: deployer}, "tokenToCToken", DAI)) === cDAI)) {
            tx = await execute("CompoundAdapter", {from: deployer}, "mapTokenToCToken", DAI, cDAI);
            console.log("CompoundAdapter mapTokenToCToken, tx is:", tx.transactionHash);
        }
        console.log("setCompoundAdapter end");
    }
};
module.exports.tags = ["CompoundAdapter"];
module.exports.runAtTheEnd = true;
