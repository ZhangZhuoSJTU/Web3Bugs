import { task } from "hardhat/config";

import {
  USDC_TOKEN_DECIMALS,
  AUSDC_ADDRESS_POLYGON,
  REWARDS_CONTROLLER_ADDRESS_POLYGON,
  POOL_ADDRESSES_PROVIDER_REGISTRY_ADDRESS_POLYGON,
  DRAW_BUFFER_CARDINALITY,
  PRIZE_DISTRIBUTION_BUFFER_CARDINALITY,
} from "../../Constants";

import { action, info, success } from "../../helpers";

export default task("fork:create-pool", "Create pool").setAction(async (taskArguments, hre) => {
  action("Create pool...");

  const {
    deployments: { deploy },
    ethers: { getContractAt },
    getNamedAccounts,
  } = hre;

  const { deployer } = await getNamedAccounts();

  info(`Deployer is: ${deployer}`);

  const aaveUsdcYieldSourceResult = await deploy("AaveV3YieldSource", {
    from: deployer,
    args: [
      AUSDC_ADDRESS_POLYGON,
      REWARDS_CONTROLLER_ADDRESS_POLYGON,
      POOL_ADDRESSES_PROVIDER_REGISTRY_ADDRESS_POLYGON,
      "PoolTogether aUSDC Yield",
      "PTaUSDCY",
      USDC_TOKEN_DECIMALS,
      deployer,
    ],
  });

  const yieldSourcePrizePoolResult = await deploy("YieldSourcePrizePool", {
    from: deployer,
    args: [deployer, aaveUsdcYieldSourceResult.address],
  });

  const yieldSourcePrizePoolAddress = yieldSourcePrizePoolResult.address;

  const ticketResult = await deploy("Ticket", {
    from: deployer,
    args: [
      "PoolTogether aUSDC Ticket",
      "PTaUSDC",
      USDC_TOKEN_DECIMALS,
      yieldSourcePrizePoolAddress,
    ],
  });

  const prizeSplitStrategyResult = await deploy("PrizeSplitStrategy", {
    from: deployer,
    args: [deployer, yieldSourcePrizePoolAddress],
  });

  const yieldSourcePrizePool = await getContractAt(
    "YieldSourcePrizePool",
    yieldSourcePrizePoolAddress
  );

  if ((await yieldSourcePrizePool.getTicket()) != ticketResult.address) {
    await yieldSourcePrizePool.setTicket(ticketResult.address);
  }

  if ((await yieldSourcePrizePool.getPrizeStrategy()) != prizeSplitStrategyResult.address) {
    await yieldSourcePrizePool.setPrizeStrategy(prizeSplitStrategyResult.address);
  }

  const prizeSplitStrategy = await getContractAt(
    "PrizeSplitStrategy",
    prizeSplitStrategyResult.address
  );

  const reserveResult = await deploy("Reserve", {
    from: deployer,
    args: [deployer, ticketResult.address],
  });

  const reserveAddress = reserveResult.address;

  if ((await prizeSplitStrategy.getPrizeSplits()).length == 0) {
    await prizeSplitStrategy.setPrizeSplits([{ target: reserveAddress, percentage: 1000 }]);
  }

  const drawBufferResult = await deploy("DrawBuffer", {
    from: deployer,
    args: [deployer, DRAW_BUFFER_CARDINALITY],
  });

  const prizeDistributionBufferResult = await deploy("PrizeDistributionBuffer", {
    from: deployer,
    args: [deployer, PRIZE_DISTRIBUTION_BUFFER_CARDINALITY],
  });

  const drawCalculatorResult = await deploy("DrawCalculator", {
    from: deployer,
    args: [ticketResult.address, drawBufferResult.address, prizeDistributionBufferResult.address],
  });

  const drawCalculatorTimelockResult = await deploy("DrawCalculatorTimelock", {
    from: deployer,
    args: [deployer, drawCalculatorResult.address],
  });

  const prizeDistributorResult = await deploy("PrizeDistributor", {
    from: deployer,
    args: [deployer, ticketResult.address, drawCalculatorTimelockResult.address],
  });

  const prizeFlushResult = await deploy("PrizeFlush", {
    from: deployer,
    args: [
      deployer,
      prizeDistributorResult.address,
      prizeSplitStrategyResult.address,
      reserveAddress,
    ],
  });

  const reserve = await getContractAt("Reserve", reserveAddress);
  await reserve.setManager(prizeFlushResult.address);

  success("Pool created!");

  return [
    aaveUsdcYieldSourceResult.address,
    yieldSourcePrizePoolAddress,
    prizeFlushResult.address,
    prizeDistributorResult.address,
  ];
});
