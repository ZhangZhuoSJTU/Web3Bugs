import { task } from "hardhat/config";

import { MATIC_HOLDER_ADDRESS_POLYGON, USDC_HOLDER_ADDRESS_POLYGON } from "../../Constants";

import { action, success } from "../../helpers";

export default task("fork:impersonate", "Impersonate accounts").setAction(
  async (taskArguments, hre) => {
    action("Impersonate accounts...");

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [MATIC_HOLDER_ADDRESS_POLYGON],
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_HOLDER_ADDRESS_POLYGON],
    });

    success("Done!");
  }
);
