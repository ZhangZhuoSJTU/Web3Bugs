import type { DeployFunction } from "hardhat-deploy/types";

import { printLog } from "../scripts/deployHelpers";

const func: DeployFunction = async function (env) {
  printLog();
};

export default func;
