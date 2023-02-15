import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("mint_malt", "Mint malt and send it to an address")
  .addPositionalParam("recipient", "The address to send the malt tokens to.")
  .addPositionalParam("amount", "The amount of malt to send")
  .setAction(async ({ amount, recipient }, { ethers, network }) => {
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

    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);

    const maltAmount = utils.parseEther(amount);
    await malt.mint(recipient, maltAmount);
  });
