import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("epoch_data", "Fetches the data for a given epoch")
  .addPositionalParam("epoch", "The epoch to fetch data for")
  .setAction(async ({ epoch }, { ethers, network }) => {
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

    const rewardThrottle = await ethers.getContractAt("RewardThrottle", artifacts.rewardThrottle.address);
    const bonding = await ethers.getContractAt("Bonding", artifacts.bonding.address);

    const {
      profit,
      rewarded,
      bondedValue,
      throttleAmount,
    } = await rewardThrottle.epochData(parseInt(epoch));
    const [lastTotalBonded, lastUpdateTime, cumulativeTotalBonded] = await bonding.epochData(parseInt(epoch));

    console.log(`Epoch profit: ${utils.formatEther(profit)}`);
    console.log(`Epoch rewarded: ${utils.formatEther(rewarded)}`);
    console.log(`Epoch last total bonded: ${utils.formatEther(lastTotalBonded)}`);
    console.log(`Epoch bonded value: ${utils.formatEther(bondedValue)}`);
    console.log(`Epoch throttleAmount: ${parseInt(throttleAmount.toString()) / 10}%`);
  });
