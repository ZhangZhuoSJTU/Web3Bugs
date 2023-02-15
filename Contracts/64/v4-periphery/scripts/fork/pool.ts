import { usdc } from "@studydefi/money-legos/erc20";
import { task } from "hardhat/config";

import {
    AUSDC_ADDRESS_MAINNET,
    INCENTIVES_CONTROLLER_ADDRESS_MAINNET,
    LENDING_POOL_ADDRESSES_PROVIDER_REGISTRY_ADDRESS_MAINNET,
    EXECUTIVE_TEAM_ADDRESS_MAINNET,
} from "../../Constants";

import { action, info, success } from "../../helpers";

export default task("fork:create-pool", "Create pool").setAction(
    async (taskArguments, hre: any) => {
        action("Create pool...");

        const {
            deployments: { deploy },
            ethers: { getContractAt },
            getNamedAccounts,
        } = hre;

        const { deployer } = await getNamedAccounts();

        info(`Deployer is: ${deployer}`);

        const aaveUsdcYieldSourceResult = await deploy("ATokenYieldSource", {
            from: deployer,
            args: [
                AUSDC_ADDRESS_MAINNET,
                INCENTIVES_CONTROLLER_ADDRESS_MAINNET,
                LENDING_POOL_ADDRESSES_PROVIDER_REGISTRY_ADDRESS_MAINNET,
                usdc.decimals,
                "PTaUSDCY",
                "PoolTogether aUSDC Yield",
                EXECUTIVE_TEAM_ADDRESS_MAINNET,
            ],
        });

        const yieldSourcePrizePoolResult = await deploy("YieldSourcePrizePool", {
            from: deployer,
            args: [deployer, aaveUsdcYieldSourceResult.address],
        });

        const yieldSourcePrizePoolAddress = yieldSourcePrizePoolResult.address;

        const ticketResult = await deploy("Ticket", {
            from: deployer,
            args: [
                "PoolTogether aUSDC Ticket",
                "PTaUSDC",
                usdc.decimals,
                yieldSourcePrizePoolAddress,
            ],
        });

        const yieldSourcePrizePool = await getContractAt(
            "YieldSourcePrizePool",
            yieldSourcePrizePoolAddress
        );

        if ((await yieldSourcePrizePool.getTicket()) != ticketResult.address) {
            await yieldSourcePrizePool.setTicket(ticketResult.address);
        }

        success("Pool created!");

        return yieldSourcePrizePoolAddress;
    }
);
