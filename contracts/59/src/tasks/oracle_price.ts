import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("oracle_price", "Returns the oracle price of Malt")
  .setAction(async ({ amount }, { ethers, network }) => {
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

    const maltDataLab = await ethers.getContractAt("MaltDataLab", artifacts.maltDataLab.address);
    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);

    const price = await maltDataLab.smoothedMaltPrice();

    console.log(`Malt oracle price: ${utils.formatEther(price)}.`);
  });
