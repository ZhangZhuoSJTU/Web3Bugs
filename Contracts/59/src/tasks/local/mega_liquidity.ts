import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("mega_liquidity", "Adds arbitrarily large liquidity")
  .addPositionalParam("amount", "The amount of malt to add to liquidity")
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

    const amountBN = utils.parseEther(amount.toString())

    await malt.mint(senderAddress, amountBN);
    await dai.mint(senderAddress, amountBN);

    await dai.approve(router.address, amountBN);
    await malt.approve(router.address, amountBN);

    await router.addLiquidity(
      malt.address,
      dai.address,
      amountBN,
      amountBN,
      amountBN.mul(90).div(100),
      amountBN.mul(90).div(100),
      senderAddress,
      Math.floor(new Date().getTime() / 1000) * 100
    );
    const liquidity = await pair.balanceOf(senderAddress);

    console.log(`Balance of LP Tokens: ${utils.formatEther(liquidity)}`);
  });
