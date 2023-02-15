import { task  } from "hardhat/config";
import { utils, Contract, BigNumber } from "ethers";
import * as fs from "fs";

task("get_auction", "Fetches info for a specific auction")
  .addPositionalParam("auctionId", "The auction ID to fetch")
  .setAction(async ({ auctionId }, { ethers, network }) => {
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

    const {
      fullRequirement,
      maxCommitments,
      commitments,
      startingPrice,
      endingPrice,
      finalPrice,
      pegPrice,
      startingTime,
      endingTime,
      finalBurnBudget,
      finalPurchased
    } = await auction.getAuction(BigNumber.from(auctionId));

    const {
      maltPurchased,
      active,
      preAuctionReserveRatio
    } = await auction.getAuctionCore(auctionId);

    console.log(`
      fullRequirement: ${utils.formatEther(fullRequirement)},
      maxCommitments: ${utils.formatEther(maxCommitments)},
      commitments: ${utils.formatEther(commitments)},
      startingPrice: ${utils.formatEther(startingPrice)},
      endingPrice: ${utils.formatEther(endingPrice)},
      finalPrice: ${utils.formatEther(finalPrice)},
      pegPrice: ${utils.formatEther(pegPrice)},
      startingTime: ${startingTime.toString()},
      endingTime: ${endingTime.toString()},
      finalBurnBudget: ${utils.formatEther(finalBurnBudget)},
      finalPurchased: ${utils.formatEther(finalPurchased)},
      maltPurchased: ${utils.formatEther(maltPurchased)},
      active: ${active},
      preAuctionReserveRatio: ${utils.formatEther(preAuctionReserveRatio)},
    `);
  });
