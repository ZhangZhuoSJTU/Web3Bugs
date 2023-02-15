import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("epoch", "Fetches the current epoch")
  .setAction(async ({ recipient }, { ethers, network }) => {
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

    const dao = await ethers.getContractAt("MaltDAO", artifacts.dao.address);
    const bonding = await ethers.getContractAt("Bonding", artifacts.bonding.address);

    const epoch = await dao.epoch();
    const epochLength = await dao.epochLength();
    const [lastTotalBonded,  lastUpdateTime, cumulativeTotalBonded] = await bonding.epochData(epoch);

    console.log(`The current epoch is ${epoch}`);
    console.log(`The current epoch length is ${epochLength.toString()}`);
    console.log(`lastTotalBonded ${lastTotalBonded.toString()}`);
    console.log(`lastUpdateTime ${lastUpdateTime.toString()}`);
    console.log(`cumulativeTotalBonded ${cumulativeTotalBonded.toString()}`);
  });
