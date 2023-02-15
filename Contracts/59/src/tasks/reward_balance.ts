import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("reward_balance", "Returns how much an account has been allocated")
  .addPositionalParam("account", "The address to check")
  .setAction(async ({ account }, { ethers, network }) => {
    if (network.name === "hardhat") {
      console.warn(
        "You are running the faucet task with Hardhat network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }

    const artifactFile =
      __dirname + `/../deployments/contracts.${network.name}.json`;

    if (!fs.existsSync(artifactFile)) {
      console.error("You need to deploy your contract first");
      return;
    }

    const artifactJson = fs.readFileSync(artifactFile);
    const artifacts = JSON.parse(artifactJson.toString());

    if ((await ethers.provider.getCode(artifacts.malt.address)) === "0x") {
      console.error("You need to deploy your contract first");
      return;
    }

    const [sender] = await ethers.getSigners();
    const senderAddress = await sender.getAddress();

    const miningService = await ethers.getContractAt("MiningService", artifacts.miningService.address);
    const erc20VestedMine = await ethers.getContractAt("ERC20VestedMine", artifacts.daiVestedMine.address);
    const auctionPool = await ethers.getContractAt("AuctionPool", artifacts.auctionPool.address);

    const bal = await miningService.balanceOfRewards(account);
    const rewardMineAllocatedReward = await erc20VestedMine.balanceOfRewards(account);
    const auctionPoolAllocatedReward = await auctionPool.balanceOfRewards(account);

    console.log(`Total allocated rewards: ${utils.formatEther(bal)}`);
    console.log(`Reward mine allocated rewards: ${utils.formatEther(rewardMineAllocatedReward)}`);
    console.log(`Auction pool allocated rewards: ${utils.formatEther(auctionPoolAllocatedReward)}`);
  });
