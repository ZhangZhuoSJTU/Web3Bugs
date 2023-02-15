module.exports = async ({getNamedAccounts, deployments, network}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    if (network.name === "hardhat") {
        const DAI = (await deployments.get("FaucetERC20")).address;

        await deploy("AaveMock", {
            from: deployer,
            proxy: {
                proxyContract: "UUPSProxy",
                execute: {
                    methodName: "__AaveMock_init",
                    args: ["10000000000000000", DAI]
                }
            },
            log: true
        });
    }
};
module.exports.tags = ["Aave"];
module.exports.dependencies = ["DAI"];
