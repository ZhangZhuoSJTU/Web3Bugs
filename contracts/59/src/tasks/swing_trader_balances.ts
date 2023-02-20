import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("swing_trader_balances", "Returns balances of the swing trader")
  .setAction(async ({}, { ethers, network }) => {
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

    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);
    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const swingTrader = await ethers.getContractAt("SwingTrader", artifacts.swingTrader.address);

    const daiBalance = await dai.balanceOf(swingTrader.address);
    const maltBalance = await malt.balanceOf(swingTrader.address);

    console.log(`Malt balance: ${utils.formatEther(maltBalance)}`);
    console.log(`DAI balance: ${utils.formatEther(daiBalance)}`);
  });
