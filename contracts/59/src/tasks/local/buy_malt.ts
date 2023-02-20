import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("buy_malt", "Market buys malt")
  .addPositionalParam("amount", "The amount of dai to use to purchase malt")
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
    const senderAddress = await sender.getAddress();

    const router = new Contract(
      artifacts.router.address,
      artifacts.router.artifacts.abi,
      senderMisc,
    );
    const uniswapHandler = await ethers.getContractAt("UniswapHandler", artifacts.uniswapHandler.address);
    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);
    const faucet = await ethers.getContractAt("TestFaucetTwo", artifacts.faucetTwo.address);

    const daiAmount = utils.parseEther(amount);
    let tx = await faucet.faucet(daiAmount);
    await tx.wait();
    tx = await dai.transfer(senderMiscAddress, daiAmount);
    await tx.wait();

    const path = [dai.address, malt.address];

    tx = await dai.connect(senderMisc).approve(router.address, daiAmount);
    await tx.wait()

    tx = await router.connect(senderMisc).swapExactTokensForTokens(
      daiAmount,
      0,
      path,
      senderMiscAddress,
      new Date().getTime() * 100
    );
    await tx.wait()

    const [price, decimals] = await uniswapHandler.maltMarketPrice();

    console.log(`Malt market price: ${utils.formatEther(price)}`);
  });
