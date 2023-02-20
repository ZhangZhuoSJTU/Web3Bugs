import { task  } from "hardhat/config";
import { utils } from "ethers";
import * as fs from "fs";


task("send_malt", "Transfers Malt from the first signer to an address")
  .addPositionalParam("receiver", "The address that will receive them")
  .addPositionalParam("amount", "The amount of malt to send")
  .setAction(async ({ receiver, amount }, { ethers, network }) => {
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

    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const [sender] = await ethers.getSigners();

    const tx = await malt.transfer(receiver, utils.parseEther(amount));
    await tx.wait();

    const tx2 = await sender.sendTransaction({
      to: receiver,
      value: utils.parseEther('100'),
    });
    await tx2.wait();

    console.log(`Transferred ${amount} malt tokens to ${receiver}`);
  });
