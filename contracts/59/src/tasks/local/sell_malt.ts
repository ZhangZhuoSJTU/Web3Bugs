import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("sell_malt", "Market sells malt")
  .addPositionalParam("amount", "The amount of malt to sell")
  .setAction(async ({ amount }, { ethers, network }) => {
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

    const artifactJson = fs.readFileSync(artifactFile);
    const artifacts = JSON.parse(artifactJson.toString());

    if ((await ethers.provider.getCode(artifacts.malt.address)) === "0x") {
      console.error("You need to deploy your contract first");
      return;
    }

    const [sender, senderMisc] = await ethers.getSigners();
    const senderMiscAddress = await senderMisc.getAddress();

    const router = new Contract(
      artifacts.router.address,
      artifacts.router.artifacts.abi,
      senderMisc,
    );

    const uniswapHandler = await ethers.getContractAt("UniswapHandler", artifacts.uniswapHandler.address);

    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);

    const maltAmount = utils.parseEther(amount);
    let tx = await malt.mint(senderMiscAddress, maltAmount);
    await tx.wait()

    const path = [malt.address, dai.address];

    tx = await malt.connect(senderMisc).approve(router.address, maltAmount.mul(10));
    await tx.wait()

    await router.connect(senderMisc).swapExactTokensForTokens(
      maltAmount,
      0,
      path,
      senderMiscAddress,
      new Date().getTime() * 100
    );
    await tx.wait()

    const [price, decimals] = await uniswapHandler.maltMarketPrice();

    console.log(`Malt market price: ${utils.formatEther(price)}`);
  });
