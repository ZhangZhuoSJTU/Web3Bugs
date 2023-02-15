import { usdc } from "@studydefi/money-legos/erc20";
import { subtask, task, types } from "hardhat/config";

import { POOL_TOKEN_ADDRESS_MAINNET, POOL_TOKEN_DECIMALS } from "../../Constants";

import { action, info, success } from "../../helpers";
import { increaseTime as increaseTimeUtil } from "../../test/utils/increaseTime";

export default task("fork:twab-rewards", "Run TWAB Rewards fork").setAction(
    async (taskArguments, hre) => {
        action("Run TWAB Rewards fork...");

        const { ethers, run } = hre;

        const { getContractAt, getSigners, provider } = ethers;
        const [deployer, attacker] = await getSigners();

        const increaseTime = (time: number) => increaseTimeUtil(provider, time);

        info(`Deployer is: ${deployer.address}`);

        const prizePoolAddress = await run("fork:create-pool");

        const prizePool = await getContractAt("YieldSourcePrizePool", prizePoolAddress);
        const ticketAddress = await prizePool.getTicket();

        const twabRewardsAddress = await run("deploy-twab-rewards", { ticketAddress });

        const firstPromotionId = (
            await run("create-promotion", {
                twabRewardsAddress,
                signer: deployer,
                tokensPerEpoch: "1000",
                epochDuration: 604800,
                numberOfEpochs: 12,
            })
        ).toNumber();

        const secondPromotionId = (
            await run("create-promotion", {
                twabRewardsAddress,
                signer: attacker,
                tokensPerEpoch: "12000",
                epochDuration: 60,
                numberOfEpochs: 1,
            })
        ).toNumber();

        await run("deposit-into-prize-pool", { prizePoolAddress });

        // Attacker ends promotion and receives back is initial deposit
        await run("end-promotion", {
            twabRewardsAddress,
            promotionId: secondPromotionId,
            signer: attacker,
        });

        // We move time 6 months forward
        await increaseTime(15778458);

        // Attacker should not be able to steal funds from first promotion
        await run("destroy-promotion", {
            twabRewardsAddress,
            promotionId: secondPromotionId,
            signer: attacker,
        });

        await run("claim-rewards", { twabRewardsAddress, promotionId: firstPromotionId });
        await run("destroy-promotion", {
            twabRewardsAddress,
            promotionId: firstPromotionId,
            signer: deployer,
        });
    }
);

subtask("deploy-twab-rewards", "Deploy TWAB Rewards")
    .addParam("ticketAddress", "Prize pool ticket address")
    .setAction(async ({ ticketAddress }, hre) => {
        action("Deploy TWAB Rewards...");

        const {
            deployments: { deploy },
            getNamedAccounts,
        } = hre;

        const { deployer } = await getNamedAccounts();

        const twabRewardsResult = await deploy("TwabRewards", {
            from: deployer,
            args: [ticketAddress],
        });

        success("TWAB Rewards deployed!");

        return twabRewardsResult.address;
    });

subtask("create-promotion", "Create TWAB Rewards promotion")
    .addParam("twabRewardsAddress", "TWAB Rewards address")
    .addParam("signer", "Transaction signer", null, types.any)
    .addParam("tokensPerEpoch", "Number of tokens per epoch")
    .addParam("epochDuration", "Duration of an epoch in seconds", null, types.float)
    .addParam("numberOfEpochs", "Number of epochs", null, types.float)
    .setAction(
        async (
            { twabRewardsAddress, signer, tokensPerEpoch, epochDuration, numberOfEpochs },
            { ethers }
        ) => {
            action("Create TWAB Rewards promotion...");

            const { getContractAt, provider, utils } = ethers;
            const { getTransactionReceipt } = provider;
            const { parseUnits } = utils;

            const twabRewards = await getContractAt("TwabRewards", twabRewardsAddress, signer);
            const poolContract = await getContractAt(usdc.abi, POOL_TOKEN_ADDRESS_MAINNET, signer);

            await poolContract.approve(
                twabRewardsAddress,
                parseUnits("12000", POOL_TOKEN_DECIMALS)
            );

            const createPromotionTx = await twabRewards.createPromotion(
                POOL_TOKEN_ADDRESS_MAINNET,
                (
                    await provider.getBlock("latest")
                ).timestamp,
                parseUnits(tokensPerEpoch, POOL_TOKEN_DECIMALS),
                epochDuration,
                numberOfEpochs
            );

            const createPromotionTxReceipt = await getTransactionReceipt(createPromotionTx.hash);

            const createPromotionTxEvents = createPromotionTxReceipt.logs.map((log) => {
                try {
                    return twabRewards.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            });

            const promotionCreatedEvent = createPromotionTxEvents.find(
                (event) => event && event.name === "PromotionCreated"
            );

            success("TWAB Rewards promotion created!");

            return promotionCreatedEvent?.args["promotionId"];
        }
    );

subtask("deposit-into-prize-pool", "Deposit into prize pool")
    .addParam("prizePoolAddress", "Prize pool address")
    .setAction(async ({ prizePoolAddress }, { ethers }) => {
        action("Deposit into prize pool...");

        const { getContractAt, getSigners, utils } = ethers;
        const { parseUnits } = utils;

        const [deployer, attacker] = await getSigners();
        const prizePool = await getContractAt("YieldSourcePrizePool", prizePoolAddress);
        const usdcContract = await getContractAt(usdc.abi, usdc.address);

        const depositAmountDeployer = parseUnits("750", usdc.decimals);
        await usdcContract.connect(deployer).approve(prizePoolAddress, depositAmountDeployer);

        const depositAmountWallet2 = parseUnits("250", usdc.decimals);
        await usdcContract.connect(attacker).approve(prizePoolAddress, depositAmountWallet2);

        await prizePool
            .connect(deployer)
            .depositToAndDelegate(deployer.address, depositAmountDeployer, deployer.address);

        await prizePool
            .connect(attacker)
            .depositToAndDelegate(attacker.address, depositAmountWallet2, attacker.address);

        success("Successfully deposited into the prize pool!");
    });

subtask("claim-rewards", "Claim rewards")
    .addParam("twabRewardsAddress", "TWAB Rewards address")
    .addParam("promotionId", "Id of the promotion", null, types.float)
    .setAction(async ({ twabRewardsAddress, promotionId }, { ethers }) => {
        action("Claim rewards...");

        const { getContractAt, getSigners, provider, utils } = ethers;
        const { getTransactionReceipt } = provider;
        const { formatEther } = utils;

        const [deployer] = await getSigners();
        const twabRewards = await getContractAt("TwabRewards", twabRewardsAddress, deployer);

        const claimRewardsTx = await twabRewards.claimRewards(
            deployer.address,
            promotionId,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        );

        const claimRewardsReceipt = await getTransactionReceipt(claimRewardsTx.hash);

        const claimRewardsEvents = claimRewardsReceipt.logs.map((log) => {
            try {
                return twabRewards.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        });

        const rewardsClaimedEvent = claimRewardsEvents.find(
            (event) => event && event.name === "RewardsClaimed"
        );

        const rewardsClaimedAmount = formatEther(rewardsClaimedEvent?.args["amount"]);

        success(`Successfully claimed ${rewardsClaimedAmount} POOL!`);
    });

subtask("destroy-promotion", "Destroy promotion")
    .addParam("twabRewardsAddress", "TWAB Rewards address")
    .addParam("promotionId", "Id of the promotion", null, types.float)
    .addParam("signer", "Transaction signer", null, types.any)
    .setAction(async ({ twabRewardsAddress, promotionId, signer }, { ethers }) => {
        action("Destroy promotion...");

        const { getContractAt, getSigners, provider, utils } = ethers;
        const { getTransactionReceipt } = provider;
        const { formatEther } = utils;

        const twabRewards = await getContractAt("TwabRewards", twabRewardsAddress, signer);

        const destroyPromotionTx = await twabRewards.destroyPromotion(promotionId, signer.address);

        const destroyPromotionReceipt = await getTransactionReceipt(destroyPromotionTx.hash);

        const destroyPromotionEvents = destroyPromotionReceipt.logs.map((log) => {
            try {
                return twabRewards.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        });

        const promotionDestroyedEvent = destroyPromotionEvents.find(
            (event) => event && event.name === "PromotionDestroyed"
        );

        const promotionDestroyedAmount = formatEther(promotionDestroyedEvent?.args["amount"]);

        success(
            `Successfully destroyed promotion and received ${promotionDestroyedAmount} POOL back!`
        );
    });

subtask("end-promotion", "End promotion")
    .addParam("twabRewardsAddress", "TWAB Rewards address")
    .addParam("promotionId", "Id of the promotion", null, types.float)
    .addParam("signer", "Transaction signer", null, types.any)
    .setAction(async ({ twabRewardsAddress, promotionId, signer }, { ethers }) => {
        action("End promotion...");

        const { getContractAt, provider, utils } = ethers;
        const { getTransactionReceipt } = provider;
        const { formatEther } = utils;

        const twabRewards = await getContractAt("TwabRewards", twabRewardsAddress, signer);

        const endPromotionTx = await twabRewards.endPromotion(promotionId, signer.address);
        const endPromotionReceipt = await getTransactionReceipt(endPromotionTx.hash);

        const endPromotionEvents = endPromotionReceipt.logs.map((log) => {
            try {
                return twabRewards.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        });

        const promotionEndedEvent = endPromotionEvents.find(
            (event) => event && event.name === "PromotionEnded"
        );

        const promotionEndedAmount = formatEther(promotionEndedEvent?.args["amount"]);

        success(`Successfully ended promotion and received ${promotionEndedAmount} POOL back!`);
    });
