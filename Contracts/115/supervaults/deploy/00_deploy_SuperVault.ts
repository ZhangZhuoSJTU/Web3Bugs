import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { owner } = await getNamedAccounts();

  await deploy("SuperVault", {
    from: owner,
    args: [],
    log: true,
    autoMine: true, // Speed up deployment on local network (ganache, hardhat), no effect on live networks
  });
};

export default func;
func.tags = ["SuperVault"];
