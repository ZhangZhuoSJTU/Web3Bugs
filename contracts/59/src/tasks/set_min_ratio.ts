import { task  } from "hardhat/config";
import { utils, Contract, BigNumber } from "ethers";
import * as fs from "fs";

task("set_min_ratio", "Set the minimum reserve ratio")
  .addPositionalParam("ratio", "The new min ratio")
  .setAction(async ({ ratio }, { ethers, network }) => {
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

    const tx = await liquidityExtension.setMinReserveRatio(BigNumber.from(ratio));
    await tx.wait();

    const rRatio = await liquidityExtension.minReserveRatio();
    console.log(rRatio.toString());
  });
