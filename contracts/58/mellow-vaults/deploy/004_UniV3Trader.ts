import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get, read, execute } = deployments;
    const { deployer, uniswapV3Router } = await getNamedAccounts();
    await deploy("UniV3Trader", {
        from: deployer,
        args: [uniswapV3Router],
        log: true,
        autoMine: true,
    });
    const tradersCount = await read("ChiefTrader", "tradersCount");
    if (tradersCount === 0) {
        const uniV3Trader = await get("UniV3Trader");
        await execute(
            "ChiefTrader",
            { from: deployer, log: true, autoMine: true },
            "addTrader",
            uniV3Trader.address
        );
    }
};
export default func;
func.tags = ["UniV3Trader", "Vaults", "Traders"];
