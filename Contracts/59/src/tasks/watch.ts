import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

const delay = (time: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time);
  });
}

task("watch", "Watches the contracts and calls advance and stabilize as required")
  .addPositionalParam("pollingInterval", "The amount of delay between polling")
  .setAction(async ({ pollingInterval }, { ethers, network }) => {
    let interval = parseInt(pollingInterval);

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

    const dao = await ethers.getContractAt("MaltDAO", artifacts.dao.address);
    const stabilizerNode = await ethers.getContractAt("StabilizerNode", artifacts.stabilizerNode.address);
    const maltDataLab = await ethers.getContractAt("MaltDataLab", artifacts.maltDataLab.address);
    const distributor = await ethers.getContractAt("RewardDistributor", artifacts.rewardDistributor.address);
    const malt = await ethers.getContractAt("Malt", artifacts.malt.address);
    const dai = await ethers.getContractAt("Malt", artifacts.rewardToken.address);
    const uniswapHandler = await ethers.getContractAt("UniswapHandler", artifacts.uniswapHandler.address);
    const auction = await ethers.getContractAt("Auction", artifacts.auction.address);


    const bonding = await ethers.getContractAt("Bonding", artifacts.bonding.address);

    const genesisTime = await dao.genesisTime();
    const startTimestamp = parseInt(genesisTime.toString());
    const epochLength = 60 * 30;

    let epoch: number = 0
    let currentStartTime: number = 0
    let nextStartTime: number = 0;

    const refreshProperties = async () => {
      epoch = await dao.epoch();
      currentStartTime = startTimestamp + (epoch * epochLength);
      nextStartTime = currentStartTime + epochLength;
    }

    await refreshProperties();

    const watchEpoch = async () => {
      await refreshProperties();
      const ts = Math.floor(new Date().getTime() / 1000);

      if (ts >= nextStartTime) {
        try {
          let tx = await dao.advance();
          await tx.wait();
          tx = await stabilizerNode.stabilize();
          await tx.wait();

          const gasCost = tx.gasLimit.mul(utils.parseUnits('100', 'gwei'));
          console.log(`Gas cost @ 100Gwei: ${utils.formatEther(gasCost)} @ ${tx.gasLimit}`);
          epoch = await dao.epoch();
          console.log(`Current epoch is now: ${epoch.toString()}`);
          currentStartTime = startTimestamp + (epoch * epochLength);
          nextStartTime = currentStartTime + epochLength;
        } catch (e) {
          console.error(e);
        }
      }
    }

    const watchStabilize = async () => {
      const price = await maltDataLab.smoothedMaltPrice();
      const [marketPrice, decimals] = await uniswapHandler.maltMarketPrice();

      const maltPrice = parseFloat(utils.formatEther(price));
      const maltMarketPrice = parseFloat(utils.formatEther(marketPrice));

      if ((maltPrice > 1.01 && maltMarketPrice > 1.01) || (maltPrice < 0.99 && maltMarketPrice < 0.99)) {
        let tx = await maltDataLab.trackPool();
        await tx.wait();

        if (maltMarketPrice < 0.99) {
          const auctionId = await auction.currentAuctionId();
          const active = await auction.auctionActive(auctionId);
          const finished = await auction.isAuctionFinished(auctionId);

          if (active && !finished) {
            console.log(`Skipping because auction ${auctionId.toString()} is active...`);
            return;
          }
        }

        try {
          tx = await stabilizerNode.stabilize({ gasPrice: ethers.utils.parseUnits('3', 'gwei') });
          await tx.wait();
          const gasCost = tx.gasLimit.mul(utils.parseUnits('100', 'gwei'));
          console.log(`Gas cost @ 100Gwei: ${utils.formatEther(gasCost)} @ ${tx.gasLimit}`);
          const [price, decimals] = await uniswapHandler.maltMarketPrice();
          console.log(`Current market price of malt is: ${utils.formatEther(price)}`);
        } catch(e) {
          console.error(e);
        }
      }
    }

    while (true) {
      try {
        console.log('tracking');
        let tx = await maltDataLab.trackMaltPrice({ gasLimit: 5000000 });
        let tx2 = await maltDataLab.trackPoolReserves({ gasLimit: 5000000 });
        let tx3 = await maltDataLab.trackReserveRatio({ gasLimit: 5000000 });
        let tx4 = await distributor.vest({ gasLimit: 5000000 });
        await tx.wait();
        await tx2.wait();
        await tx3.wait();
        await tx4.wait();
        console.log('done tracking');

        await watchEpoch();
        await watchStabilize();
      } catch(e) {
        console.log('Something went wrong...')
        console.log(e);
      }
      await delay(interval);
    }
  });
