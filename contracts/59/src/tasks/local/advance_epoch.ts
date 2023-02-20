import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("advance_epoch", "Moves time forward and advances the epoch")
  .addOptionalParam("epochs", "The number of epochs to move forward")
  .setAction(async ({ epochs = 1 }, { ethers, network }) => {
    if (network.name === "hardhat") {
      console.warn(
        "You are running the faucet task with Hardhat network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }

    const artifactFile =
      __dirname + `/../../deployments/contracts.${network.name}.json`;

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

    for (let i = 0; i < epochs; ++i) {
      await ethers.provider.send('evm_increaseTime', [60 * 30]);
      await ethers.provider.send('evm_mine', []);
      await dao.advance();
    }
  });
