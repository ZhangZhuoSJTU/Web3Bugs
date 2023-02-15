import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("total_rewards", "Returns how much total reward has been given out")
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

    const vestedMind = await ethers.getContractAt("ERC20VestedMine", artifacts.daiVestedMine.address);

    const declaredBal = await vestedMind.totalDeclaredReward();
    const releasedBal = await vestedMind.totalReleasedReward();

    console.log(`Declared rewards: ${utils.formatEther(declaredBal)}`);
    console.log(`Released rewards: ${utils.formatEther(releasedBal)}`);
  });
