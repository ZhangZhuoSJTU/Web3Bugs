import { task  } from "hardhat/config";
import { utils } from "ethers";
import * as fs from "fs";


task("malt_balance", "Checks the balance of malt for a given account")
  .addPositionalParam("account", "The address to check the balance of")
  .setAction(async ({ account }, { ethers, network }) => {
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

    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const [sender] = await ethers.getSigners();

    const balance = await malt.balanceOf(account);

    console.log(`Balance of Malt: ${utils.formatEther(balance)}`);
  });
