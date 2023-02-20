import { task } from "hardhat/config";

import {
    ETH_HOLDER_ADDRESS_MAINNET,
    POOL_HOLDER_ADDRESS_MAINNET,
    USDC_HOLDER_ADDRESS_MAINNET,
} from "../../Constants";

import { action, success } from "../../helpers";

export default task("fork:impersonate", "Impersonate accounts").setAction(
    async (taskArguments, hre) => {
        action("Impersonate accounts...");

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [ETH_HOLDER_ADDRESS_MAINNET],
        });

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [POOL_HOLDER_ADDRESS_MAINNET],
        });

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [USDC_HOLDER_ADDRESS_MAINNET],
        });

        success("Done!");
    }
);
