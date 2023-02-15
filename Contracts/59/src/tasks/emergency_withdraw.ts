import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("emergency_withdraw", "Withdraws token from contract")
  .addPositionalParam("token", "The token to withdraw")
  .addPositionalParam("contractName", "The contract to withdraw from")
  .addPositionalParam("artifactName", "The contract artifact name to withdraw from")
  .setAction(async ({ token, contractName, artifactName }, { ethers, network }) => {
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

    const contract = await ethers.getContractAt(contractName, artifacts[artifactName].address);

    await contract.emergencyWithdraw(token, senderAddress)
  });
