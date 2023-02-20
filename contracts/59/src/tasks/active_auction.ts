import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("active_auction", "Checks infomation about auctions")
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
    const {
      commitments,
      maltPurchased,
      pegPrice,
      startingTime,
      endingTime,
      active
    } = await auction.getAuctionCore(auctionId);

    const {
      startingPrice,
      endingPrice,
      finalPrice,
    } = await auction.getAuctionPrices(auctionId);

    console.log('commitments', commitments.toString());
    console.log('maltPurchased', maltPurchased.toString());
    console.log('startingPrice', startingPrice.toString());
    console.log('endingPrice', endingPrice.toString());
    console.log('finalPrice', finalPrice.toString());
    console.log('pegPrice', pegPrice.toString());
    console.log('startingTime', startingTime.toString());
    console.log('endingTime', endingTime.toString());
    console.log('active', active);
  });
