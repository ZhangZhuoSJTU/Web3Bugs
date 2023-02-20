import { task  } from "hardhat/config";
import { utils, Contract, BigNumber } from "ethers";
import * as fs from "fs";

task("apr", "Fetches APR")
  .addOptionalParam("epoch", "The epoch to check")
  .setAction(async ({ epoch = null }, { ethers, network }) => {
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

    const throttle = await ethers.getContractAt("RewardThrottle", artifacts.rewardThrottle.address);
    const dao = await ethers.getContractAt("MaltDAO", artifacts.dao.address);

    let previousEpoch = epoch;
    if (epoch == null) {
      epoch = await dao.epoch();

      if (epoch.gt(BigNumber.from(0))) {
        previousEpoch = epoch.sub(1);
      }
    } else {
      epoch = BigNumber.from(epoch);
      previousEpoch = epoch;
    }

    const apr = await throttle.epochAPR(previousEpoch);

    console.log(`Current APR: ${parseInt(apr.toString()) / 10000}%`);
  });
