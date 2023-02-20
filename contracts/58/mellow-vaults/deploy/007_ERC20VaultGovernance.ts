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
    const chiefTrader = await get("ChiefTrader");
    const { deployer } = await getNamedAccounts();
    await deploy("ERC20VaultGovernance", {
        from: deployer,
        args: [
            {
                protocolGovernance: protocolGovernance.address,
                registry: vaultRegistry.address,
            },
            { trader: chiefTrader.address },
        ],
        log: true,
        autoMine: true,
    });
    const governance = await get("ERC20VaultGovernance");
    await deploy("ERC20VaultFactory", {
        from: deployer,
        args: [governance.address],
        log: true,
        autoMine: true,
    });
    const initialized = await read("ERC20VaultGovernance", "initialized");
    if (!initialized) {
        log("Initializing factory...");

        const factory = await get("ERC20VaultFactory");
        await execute(
            "ERC20VaultGovernance",
            { from: deployer, log: true, autoMine: true },
            "initialize",
            factory.address
        );
    }
};
export default func;
func.tags = ["ERC20VaultGovernance", "Vaults"];
