const configs = require("../deployConfig.json");

module.exports = async ({getNamedAccounts, deployments, getChainId, network}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const chainId = await getChainId();

    const uErc20 = await deployments.get("UErc20");

    const params = configs[chainId]["UToken"];

    const DAI = network.name === "hardhat" ? (await deployments.get("FaucetERC20")).address : configs[chainId]["DAI"];

    await deploy("UToken", {
        from: deployer,
        proxy: {
            proxyContract: "UUPSProxy",
            execute: {
                methodName: "__UToken_init",
                args: [
                    uErc20.address,
                    DAI,
                    params.initialExchangeRateMantissa,
                    params.reserveFactorMantissa,
                    params.originationFee,
                    params.debtCeiling,
                    params.maxBorrow,
                    params.minBorrow,
                    params.overdueBlocks,
                    deployer
                ]
            }
        },
        log: true
    });
};
module.exports.tags = ["UToken"];
module.exports.dependencies = ["UErc20"];
