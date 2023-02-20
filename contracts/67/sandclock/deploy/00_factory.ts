import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

import { logContract } from "../scripts/deployHelpers";

const func: DeployFunction = async function (env) {
  const { deployer } = await env.getNamedAccounts();
  const { deploy } = env.deployments;

  const factory = await deploy("SandclockFactory", {
    from: deployer,
    args: [],
  });

  logContract("SandclockFactory", factory.address);
};

func.id = "deploy_factory";
func.tags = ["SandclockFactory"];

export default func;
