import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("supply", "Returns the total supply of Malt")
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

    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const impliedCollateralService = await ethers.getContractAt("ImpliedCollateralService", artifacts.impliedCollateralService.address);
  
    const supply = await malt.totalSupply();
    let collateral = await impliedCollateralService.totalUsefulCollateral();

    console.log(`Malt total supply: ${utils.commify(utils.formatEther(supply))}`);
    console.log(`Useful collateral: ${utils.commify(utils.formatEther(collateral))}`);
    console.log(`Collateral %: ${parseFloat(utils.formatEther(collateral.mul(utils.parseEther('1')).div(supply))) * 100}%`);
  });
