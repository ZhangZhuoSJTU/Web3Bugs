module.exports = async ({getNamedAccounts, deployments, network}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    if (network.name === "hardhat") {
        await deploy("FaucetERC20", {
            from: deployer,
            proxy: {
                proxyContract: "UUPSProxy",
                execute: {
                    methodName: "__FaucetERC20_init",
                    args: ["DAI", "DAI"]
                }
            },
            log: true
        });
    }
};
module.exports.tags = ["DAI"];
