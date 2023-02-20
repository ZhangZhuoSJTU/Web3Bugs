import { isAddress } from "@ethersproject/address";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { COLLATERALS, NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const collateralList = Object.keys(networkConfig.collaterals);
  const collateralConfigList = Object.keys(COLLATERALS);

  if (networkConfig.baseToken === "") {
    console.log("Error: base token not provided");
    process.exit();
  }

  if (!collateralList.includes(networkConfig.baseToken)) {
    if (!hre.network.live || networkConfig.isTestNet) {
      console.log(
        "Error: network baseToken must be listed as collateral, if there is no address available please input empty string",
      );
    } else {
      console.log("Error: network baseToken must be listed as collateral");
    }

    process.exit();
  }

  for (const element of collateralList) {
    if (!collateralConfigList.includes(element)) {
      console.log(`Error: Network collateral ${element} has no corresponding collateral config`);
      process.exit();
    }

    if (!networkConfig.isTestNet) {
      if (!isAddress(networkConfig.collaterals[element].address)) {
        console.log(`Error: collateral ${element} address is not valid`);
        process.exit();
      }
    } else if (
      networkConfig.collaterals[element].address !== "" &&
      !isAddress(networkConfig.collaterals[element].address)
    ) {
      console.log(`Error: collateral ${element} address is not valid`);
      process.exit();
    }

    if (
      networkConfig.collaterals[element].usdAggregator !== "" &&
      !isAddress(networkConfig.collaterals[element].usdAggregator)
    ) {
      console.log(`Error: usd aggregator ${element} address is not valid`);
      process.exit();
    }
  }

  if (!networkConfig.isTestNet && !isAddress(networkConfig.mimoToken)) {
    console.log(`Error: mimo token address is not valid`);
    process.exit();
  }

  if (!networkConfig.isTestNet && !isAddress(networkConfig.gnosisSafe)) {
    console.log("Error: GnosisSafe address is not valid");
  }
};

export default func;
func.id = "check_config";
func.tags = ["CheckConfig"];
