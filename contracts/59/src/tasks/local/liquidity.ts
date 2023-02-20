import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("liquidity", "Adds owners malt into LP and transfers the LP Tokens to an address.")
  .addPositionalParam("recipient", "The address to send the LP tokens to.")
  .setAction(async ({ recipient }, { ethers, network }) => {
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

    const [sender] = await ethers.getSigners();
    const senderAddress = await sender.getAddress();

    const pair = new Contract(
      artifacts.maltPair.address,
      artifacts.maltPair.artifacts.abi,
      sender,
    );
    const router = new Contract(
      artifacts.router.address,
      artifacts.router.artifacts.abi,
      sender,
    );
    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);

    const maltBalance = await malt.balanceOf(senderAddress);

    await dai.mint(senderAddress, maltBalance);

    const daiBalance = await dai.balanceOf(senderAddress);

    await dai.approve(router.address, daiBalance);
    await malt.approve(router.address, maltBalance);

    await router.addLiquidity(
      malt.address,
      dai.address,
      maltBalance.mul(90).div(100),
      daiBalance.mul(90).div(100),
      maltBalance.mul(90).div(100),
      daiBalance.mul(90).div(100),
      senderAddress,
      Math.floor(new Date().getTime() / 1000) + 60
    );
    const liquidity = await pair.balanceOf(senderAddress);

    await pair.transfer(recipient, liquidity);

    const balance = await pair.balanceOf(recipient);

    const tx2 = await sender.sendTransaction({
      to: recipient,
      value: utils.parseEther('100'),
    });
    await tx2.wait();

    console.log(`Balance of LP Tokens: ${utils.formatEther(balance)}`);
    console.log(`Pair address: ${pair.address}`);

    const finalMaltBalance = await malt.balanceOf(senderAddress);
    const tx = await malt.transfer(recipient, finalMaltBalance);
  });
