import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { sendTx } from "./000_utils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get, log, execute, read } = deployments;
    const protocolGovernance = await get("ProtocolGovernance");
    const vaultRegistry = await get("VaultRegistry");
    const { deployer, uniswapV3PositionManager } = await getNamedAccounts();
    await deploy("UniV3VaultGovernance", {
        from: deployer,
        args: [
            {
                protocolGovernance: protocolGovernance.address,
                registry: vaultRegistry.address,
            },
            { positionManager: uniswapV3PositionManager },
        ],
        log: true,
        autoMine: true,
    });
    const governance = await get("UniV3VaultGovernance");
    await deploy("UniV3VaultFactory", {
        from: deployer,
        args: [governance.address],
        log: true,
        autoMine: true,
    });
    const initialized = await read("UniV3VaultGovernance", "initialized");
    if (!initialized) {
        log("Initializing factory...");

        const factory = await get("UniV3VaultFactory");
        await execute(
            "UniV3VaultGovernance",
            { from: deployer, log: true, autoMine: true },
            "initialize",
            factory.address
        );
    }
};
export default func;
func.tags = ["UniV3VaultGovernance", "Vaults"];
