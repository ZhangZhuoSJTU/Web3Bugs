import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("reserve_ratio", "Returns the reserve ratio for the stabilizer node")
  .setAction(async ({ }, { ethers, network }) => {
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

    const liquidityExtension = await ethers.getContractAt("LiquidityExtension", artifacts.liquidityExtension.address);
    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);

    const [ratio, decimals] = await liquidityExtension.reserveRatio();
    const daiBalance = await dai.balanceOf(liquidityExtension.address);

    console.log(`LE dai balance: ${utils.commify(utils.formatEther(daiBalance))}`);
    console.log(`Reserve ratio: ${utils.formatEther(ratio)}`);
  });
