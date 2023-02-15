import { task  } from "hardhat/config";
import { utils, Contract } from "ethers";
import * as fs from "fs";

task("account_state", "Fetches the state of an account")
  .addPositionalParam("account", "The account to look up")
  .setAction(async ({ account }, { ethers, network }) => {
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

    const erc20VestedMine = await ethers.getContractAt("ERC20VestedMine", artifacts.daiVestedMine.address);
    const auctionPool = await ethers.getContractAt("AuctionPool", artifacts.auctionPool.address);
    const bonding = await ethers.getContractAt("Bonding", artifacts.bonding.address);

    const bondedBalance = await erc20VestedMine.balanceOfBonded(account);
    const vestedReward = await erc20VestedMine.balanceOfRewards(account);
    const vestedEarned = await erc20VestedMine.earned(account);
    const totalBonded = await erc20VestedMine.totalBonded();
    const bondingEpoch = await bonding.bondedEpoch(account);
    // const bondedEpoch = await erc20VestedMine.bondedEpoch(account);
    const vestedWithdrawn = await erc20VestedMine.withdrawnBalance(account);
    const auctionPoolReward = await auctionPool.balanceOfRewards(account);
    const auctionPoolEarned = await auctionPool.earned(account);
    const auctionPoolWithdrawn = await auctionPool.withdrawnBalance(account);
    const vestedStakePadding = await erc20VestedMine.balanceOfStakePadding(account);
    const auctionPoolStakePadding = await auctionPool.balanceOfStakePadding(account);
    const totalStakePadding = await auctionPool.totalStakePadding();

    const vestedGlobalWithdrawn = await erc20VestedMine.totalWithdrawn();
    const auctionPoolGlobalWithdrawn = await auctionPool.totalWithdrawn();

    const vestedGlobalDeclared = await erc20VestedMine.totalDeclaredReward();
    const auctionPoolGlobalDeclared = await auctionPool.totalDeclaredReward();
    const vestedGlobalReleased = await erc20VestedMine.totalReleasedReward();
    const auctionPoolGlobalReleased = await auctionPool.totalReleasedReward();

    console.log('\nerc20 Vested Mine', erc20VestedMine.address);
    console.log('auction pool', auctionPool.address);
    console.log(`\nVested mine global declared: ${utils.formatEther(vestedGlobalDeclared)}`);
    console.log(`Auction pool global declared: ${utils.formatEther(auctionPoolGlobalDeclared)}`);
    console.log(`Vested mine global released: ${utils.formatEther(vestedGlobalReleased)}`);
    console.log(`Auction pool global released: ${utils.formatEther(auctionPoolGlobalReleased)}`);

    console.log(`Vested mine global withdrawn: ${utils.formatEther(vestedGlobalWithdrawn)}`);
    console.log(`Auction pool global withdrawn: ${utils.formatEther(auctionPoolGlobalWithdrawn)}`);
    console.log('\n');
    console.log(`Total stake padding: ${utils.formatEther(totalStakePadding)}`);
    console.log(`Total bonded: ${utils.formatEther(totalBonded)}`);
    console.log('\n');

    console.log(`Bonded balance: ${utils.formatEther(bondedBalance)}`);
    console.log(`Vested mine stake padding: ${utils.formatEther(vestedStakePadding)}`);
    console.log(`Auction pool stake padding: ${utils.formatEther(auctionPoolStakePadding)}`);
    console.log(`Bonded epoch: ${bondingEpoch.toString()}`);
    console.log(`Vested mine withdrawn: ${utils.formatEther(vestedWithdrawn)}`);
    console.log(`Auction pool withdrawn: ${utils.formatEther(auctionPoolWithdrawn)}`);
    console.log(`\nVested mine reward: ${utils.formatEther(vestedReward)}`);
    console.log(`Vested mine earned: ${utils.formatEther(vestedEarned)}`);
    console.log(`Auction pool reward: ${utils.formatEther(auctionPoolReward)}`);
    console.log(`Auction pool earned: ${utils.formatEther(auctionPoolEarned)}`);
  });
