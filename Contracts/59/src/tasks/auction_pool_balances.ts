import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("auction_pool_balances", "Returns balances of the auction pool")
  .setAction(async ({}, { ethers, network }) => {
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

    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);
    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const auctionPool = await ethers.getContractAt("AuctionPool", artifacts.auctionPool.address);

    const balance = await dai.balanceOf(auctionPool.address);
    const usable = await auctionPool.usableBalance();
    const released = await auctionPool.totalReleasedReward();
    const declared = await auctionPool.totalDeclaredReward();
    const index = await auctionPool.replenishingIndex();

    console.log(`DAI balance: ${utils.formatEther(balance)}`);
    console.log(`Usable balance: ${utils.formatEther(usable)}`);
    console.log(`Total released: ${utils.formatEther(released)}`);
    console.log(`Total declared: ${utils.formatEther(declared)}`);
    console.log(`Index: ${index.toString()}`);
  });
