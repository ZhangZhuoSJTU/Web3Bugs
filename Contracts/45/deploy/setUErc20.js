module.exports = async ({getNamedAccounts}) => {
    const {execute, read} = deployments;
    const {deployer} = await getNamedAccounts();

    const uToken = await deployments.get("UToken");

    console.log("setUErc20 start");
    if ((await read("UErc20", {from: deployer}, "owner")) === deployer) {
        tx = await execute("UErc20", {from: deployer}, "transferOwnership", uToken.address);
        console.log("transferOwnership tx is:", tx.transactionHash);
    }
    console.log("setUErc20 end");
};
module.exports.tags = ["UErc20Setting"];
module.exports.dependencies = ["UErc20", "UToken"];
