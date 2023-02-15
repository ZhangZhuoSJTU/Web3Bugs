import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;
    const protocolGovernance = await get("ProtocolGovernance");
    const { deployer } = await getNamedAccounts();
    await deploy("ChiefTrader", {
        from: deployer,
        args: [protocolGovernance.address],
        log: true,
        autoMine: true,
    });
};
export default func;
func.tags = ["ChiefTrader", "Vaults", "Traders"];
