import { task  } from "hardhat/config";
import { utils } from "ethers";
import * as fs from "fs";


task("get_eth", "Transfers ETH from the first signer to an address")
  .addPositionalParam("receiver", "The address that will receive them")
  .setAction(async ({ receiver }, { ethers, network }) => {
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

    const artifactsJson = fs.readFileSync(artifactFile);
    const artifacts = JSON.parse(artifactsJson.toString());

    if ((await ethers.provider.getCode(artifacts.malt.address)) === "0x") {
      console.error("You need to deploy your contract first");
      return;
    }

    const [sender] = await ethers.getSigners();

    const tx2 = await sender.sendTransaction({
      to: receiver,
      value: utils.parseEther('10'),
    });
    await tx2.wait();

    console.log(`Transferred 10 eth to ${receiver}`);
  });
