import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("auction_info", "Checks infomation about auctions")
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

    const auction = await ethers.getContractAt("Auction", artifacts.auction.address);

    const auctionId = await auction.currentAuctionId();
    const replenishingAuctionId = await auction.replenishingAuctionId();
    const claimable = await auction.claimableArbitrageRewards();
    const unclaimedArb = await auction.unclaimedArbTokens();

    console.log(`Current auction ID: ${auctionId.toString()}`);
    console.log(`Replenishing auction ${replenishingAuctionId.toString()}`);
    console.log(`Claimable: ${utils.commify(utils.formatEther(claimable))}`);
    console.log(`Unclaimed Arb tokens: ${utils.commify(utils.formatEther(unclaimedArb))}`);
  });
