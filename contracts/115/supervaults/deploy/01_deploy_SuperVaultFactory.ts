import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();
  const SuperVaultBase = await deployments.get("SuperVault");
  await deploy("SuperVaultFactory", {
    from: owner,
    args: [SuperVaultBase.address],
    log: true,
  });
};

export default func;
func.tags = ["SuperVaultFactory"];
func.dependencies = ["SuperVault"];
