import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

import { ethers } from "hardhat";

import { logContract } from "../scripts/deployHelpers";

const func: DeployFunction = async function (env) {
  await deployDevToken(env, "USDC");
  await deployDevToken(env, "DAI");
  await deployDevToken(env, "WETH");
  await deployDevToken(env, "WBTC");
};

async function deployDevToken(env: HardhatRuntimeEnvironment, name: string) {
  const { deployer, alice, bob, carol } = await env.getNamedAccounts();
  const { deploy, execute } = env.deployments;

  const token = await deploy(name, {
    from: deployer,
    contract: "MockERC20",
    args: [0],
  });

  for (let account of [deployer, alice, bob, carol]) {
    await execute(
      name,
      { from: account },
      "mint",
      account,
      ethers.utils.parseUnits("1000000")
    );
  }

  logContract(name, token.address);
}

func.id = "deploy_mock_tokens";
func.tags = ["MockTokens"];

// run this only on local networks
func.skip = (env: HardhatRuntimeEnvironment) =>
  Promise.resolve(env.network.live);

export default func;
