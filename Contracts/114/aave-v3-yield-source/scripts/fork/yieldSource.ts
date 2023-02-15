import ERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { subtask, task } from "hardhat/config";

import { USDC_ADDRESS_POLYGON, USDC_TOKEN_DECIMALS } from "../../Constants";

import { action, info, success } from "../../helpers";

import { increaseTime as increaseTimeUtil } from "../../test/utils/increaseTime";

export default task("fork:yield-source", "Run AaveV3YieldSource fork").setAction(
  async (taskArguments, hre) => {
    action("Run AaveV3YieldSource fork...");

    const { ethers, run } = hre;

    const { getContractAt, getSigners, provider, utils } = ethers;

    const [deployer, wallet2] = await getSigners();
    const { formatUnits } = utils;

    const increaseTime = (time: number) => increaseTimeUtil(provider, time);

    info(`Deployer is: ${deployer.address}`);

    const [
      aaveUsdcYieldSourceAddress,
      prizePoolAddress,
      prizeFlushAddress,
      prizeDistributorAddress,
    ] = await run("fork:create-pool");

    const aaveUsdcYieldSource = await getContractAt(
      "AaveV3YieldSource",
      aaveUsdcYieldSourceAddress
    );

    const prizePool = await getContractAt("YieldSourcePrizePool", prizePoolAddress);
    const ticketAddress = await prizePool.getTicket();
    const ticket = await getContractAt("Ticket", ticketAddress);

    await run("deposit-into-prize-pool", { prizePoolAddress });

    const aUSDCYieldSourceBalanceBefore = await aaveUsdcYieldSource.callStatic.balanceOfToken(
      prizePoolAddress
    );

    info(
      `AaveV3YieldSource aUSDC balance after deposit: ${formatUnits(
        aUSDCYieldSourceBalanceBefore,
        USDC_TOKEN_DECIMALS
      )} aUSDC`
    );

    const deployerTicketBalance = await ticket.balanceOf(deployer.address);
    const wallet2TicketBalance = await ticket.balanceOf(wallet2.address);

    info(
      `Deployer ticket balance after deposit: ${formatUnits(
        deployerTicketBalance,
        USDC_TOKEN_DECIMALS
      )} PTaUSDC`
    );

    info(
      `Wallet2 ticket balance after deposit: ${formatUnits(
        wallet2TicketBalance,
        USDC_TOKEN_DECIMALS
      )} PTaUSDC`
    );

    info("Increase time by 3 months");
    await increaseTime(7889229);

    const prizePoolAccountedBalance = await prizePool.getAccountedBalance();

    info(
      `prizePoolAccountedBalance 3 months later: ${formatUnits(
        prizePoolAccountedBalance,
        USDC_TOKEN_DECIMALS
      )} PTaUSDC`
    );

    const prizePoolBalance = await prizePool.callStatic.balance();

    info(
      `prizePoolBalance 3 months later: ${formatUnits(
        prizePoolBalance,
        USDC_TOKEN_DECIMALS
      )} PTaUSDC`
    );

    const aUSDCYieldSourceBalanceAfter = await aaveUsdcYieldSource.callStatic.balanceOfToken(
      prizePoolAddress
    );

    info(
      `AaveV3YieldSource aUSDC balance 3 months later: ${formatUnits(
        aUSDCYieldSourceBalanceAfter,
        USDC_TOKEN_DECIMALS
      )} aUSDC`
    );

    await run("withdraw-from-prize-pool", {
      prizePoolAddress,
      deployerTicketBalance,
      wallet2TicketBalance,
    });

    const usdc = await getContractAt(ERC20.abi, USDC_ADDRESS_POLYGON);
    const deployerUSDCBalance = await usdc.balanceOf(deployer.address);
    const wallet2USDCBalance = await usdc.balanceOf(wallet2.address);

    info(
      `Deployer USDC balance after withdrawing: ${formatUnits(
        deployerUSDCBalance,
        USDC_TOKEN_DECIMALS
      )} USDC`
    );

    info(
      `Wallet2 USDC balance after withdrawing: ${formatUnits(
        wallet2USDCBalance,
        USDC_TOKEN_DECIMALS
      )} USDC`
    );

    await run("flush-reserve", { prizeFlushAddress });

    const prizeDistributorTicketBalance = await ticket.balanceOf(prizeDistributorAddress);

    info(
      `PrizeDistributor ticket balance after flush: ${formatUnits(
        prizeDistributorTicketBalance,
        USDC_TOKEN_DECIMALS
      )} PTaUSDC`
    );

    const aUSDCYieldSourceBalanceAfterFlush = await aaveUsdcYieldSource.callStatic.balanceOfToken(
      prizePoolAddress
    );

    info(
      `AaveV3YieldSource aUSDC balance after flush: ${formatUnits(
        aUSDCYieldSourceBalanceAfterFlush,
        USDC_TOKEN_DECIMALS
      )} aUSDC`
    );
  }
);

subtask("deposit-into-prize-pool", "Deposit into prize pool")
  .addParam("prizePoolAddress", "Prize pool address")
  .setAction(async ({ prizePoolAddress }, { ethers }) => {
    action("Deposit into prize pool...");

    const { getContractAt, getSigners, utils } = ethers;
    const { parseUnits } = utils;

    const [deployer, wallet2] = await getSigners();
    const prizePool = await getContractAt("YieldSourcePrizePool", prizePoolAddress);
    const usdcContract = await getContractAt(ERC20.abi, USDC_ADDRESS_POLYGON);

    const depositAmountDeployer = parseUnits("750", USDC_TOKEN_DECIMALS);
    await usdcContract.connect(deployer).approve(prizePoolAddress, depositAmountDeployer);

    const depositAmountWallet2 = parseUnits("250", USDC_TOKEN_DECIMALS);
    await usdcContract.connect(wallet2).approve(prizePoolAddress, depositAmountWallet2);

    await prizePool
      .connect(deployer)
      .depositToAndDelegate(deployer.address, depositAmountDeployer, deployer.address);

    await prizePool
      .connect(wallet2)
      .depositToAndDelegate(wallet2.address, depositAmountWallet2, wallet2.address);

    success("Successfully deposited into the prize pool!");
  });

subtask("withdraw-from-prize-pool", "Withdraw from prize pool")
  .addParam("prizePoolAddress", "Prize pool address")
  .setAction(
    async ({ prizePoolAddress, deployerTicketBalance, wallet2TicketBalance }, { ethers }) => {
      action("Withdraw from prize pool...");

      const { getContractAt, getSigners, utils } = ethers;
      const { formatUnits } = utils;

      const [deployer, wallet2] = await getSigners();
      const prizePool = await getContractAt("YieldSourcePrizePool", prizePoolAddress);

      await prizePool.connect(deployer).withdrawFrom(deployer.address, deployerTicketBalance);
      await prizePool.connect(wallet2).withdrawFrom(wallet2.address, wallet2TicketBalance);

      success("Successfully withdrawn from the prize pool!");
    }
  );

subtask("flush-reserve", "Flush reserve")
  .addParam("prizeFlushAddress", "Prize flush address")
  .setAction(async ({ prizeFlushAddress }, { ethers }) => {
    action("Flush reserve...");

    const { getContractAt } = ethers;

    const prizeFlush = await getContractAt("PrizeFlush", prizeFlushAddress);
    await prizeFlush.flush();

    success("Successfully flushed prize reserve!");
  });
