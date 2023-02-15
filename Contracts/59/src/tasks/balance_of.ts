import { task  } from "hardhat/config";
import { utils } from "ethers";
import * as fs from "fs";


task("balance_of", "Checks the balance of a token for a given account")
  .addPositionalParam("token", "The address of token to check")
  .addPositionalParam("account", "The address to check the balance of")
  .setAction(async ({ token, account }, { ethers, network }) => {
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

    const tokenContract = await ethers.getContractAt("Malt", token);

    const balance = await tokenContract.balanceOf(account);

    console.log(`Balance of ${token}: ${utils.formatEther(balance)}`);
  });
