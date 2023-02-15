import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("stabilize", "Calls the stabilizer method on a StabilizerNode")
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

    const uniswapHandler = await ethers.getContractAt("UniswapHandler", artifacts.uniswapHandler.address);
    const stabilizerNode = await ethers.getContractAt("StabilizerNode", artifacts.stabilizerNode.address);

    console.log('sending the stabilize transaction...');

    let tx = await stabilizerNode.stabilize({ gasPrice: utils.parseUnits('3', 'gwei') });

    console.log('waiting on transaction...');
    console.log(tx.hash);

    await tx.wait();

    const [price, decimals] = await uniswapHandler.maltMarketPrice();

    console.log(`Malt market price: ${utils.formatEther(price)}`);
  });
