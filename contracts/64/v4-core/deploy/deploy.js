const { deploy1820 } = require('deploy-eip-1820');
const chalk = require('chalk');

function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments));
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments));
  }
}

function yellow() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments));
  }
}

function green() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments));
  }
}

function displayResult(name, result) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`);
  } else {
    green(`${name} deployed at ${result.address}`);
  }
}

const chainName = (chainId) => {
  switch (chainId) {
    case 1:
      return 'Mainnet';
    case 3:
      return 'Ropsten';
    case 4:
      return 'Rinkeby';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 56:
      return 'Binance Smart Chain';
    case 77:
      return 'POA Sokol';
    case 97:
      return 'Binance Smart Chain (testnet)';
    case 99:
      return 'POA';
    case 100:
      return 'xDai';
    case 137:
      return 'Matic';
    case 31337:
      return 'HardhatEVM';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
};

module.exports = async (hardhat) => {
  const { getNamedAccounts, deployments, getChainId, ethers } = hardhat;
  const { deploy } = deployments;

  let { deployer } = await getNamedAccounts();
  const chainId = parseInt(await getChainId(), 10);

  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337;

  const signer = await ethers.provider.getSigner(deployer);

  dim('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  dim('PoolTogether Pool Contracts - Deploy Script');
  dim('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  dim(`Network: ${chainName(chainId)} (${isTestEnvironment ? 'local' : 'remote'})`);
  dim(`Deployer: ${deployer}`);

  await deploy1820(signer);

  cyan(`\nDeploying RNGServiceStub...`);
  const rngServiceResult = await deploy('RNGServiceStub', {
    from: deployer,
  });

  displayResult('RNGServiceStub', rngServiceResult);

  yellow('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  yellow('CAUTION: Deploying Prize Pool in a front-runnable way!');

  cyan('\nDeploying MockYieldSource...');
  const mockYieldSourceResult = await deploy('MockYieldSource', {
    from: deployer,
    args: ['Token', 'TOK', 18],
  });

  displayResult('MockYieldSource', mockYieldSourceResult);

  cyan('\nDeploying YieldSourcePrizePool...');
  const yieldSourcePrizePoolResult = await deploy('YieldSourcePrizePool', {
    from: deployer,
    args: [deployer, mockYieldSourceResult.address],
  });

  displayResult('YieldSourcePrizePool', yieldSourcePrizePoolResult);

  cyan('\nDeploying Ticket...');
  const ticketResult = await deploy('Ticket', {
    from: deployer,
    args: ['Ticket', 'TICK', 18, yieldSourcePrizePoolResult.address],
  });

  displayResult('Ticket', ticketResult);

  cyan('\nsetTicket for YieldSourcePrizePool...');

  const yieldSourcePrizePool = await ethers.getContract('YieldSourcePrizePool');

  const setTicketResult = await yieldSourcePrizePool.setTicket(ticketResult.address);

  displayResult('setTicket', setTicketResult);

  yellow('\nPrize Pool Setup Complete');
  yellow('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');

  const cardinality = 8;

  cyan('\nDeploying DrawBuffer...');
  const drawBufferResult = await deploy('DrawBuffer', {
    from: deployer,
    args: [deployer, cardinality],
  });
  displayResult('DrawBuffer', drawBufferResult);

  cyan('\nDeploying PrizeDistributionBuffer...');
  const tsunamiDrawSettindsHistoryResult = await deploy('PrizeDistributionBuffer', {
    from: deployer,
    args: [deployer, cardinality],
  });
  displayResult('PrizeDistributionBuffer', tsunamiDrawSettindsHistoryResult);

  const rngTimeout = 3600

  cyan('\nDeploying DrawBeacon...');
  const drawBeaconResult = await deploy('DrawBeacon', {
    from: deployer,
    args: [
      deployer,
      drawBufferResult.address,
      rngServiceResult.address,
      1,
      parseInt('' + new Date().getTime() / 1000),
      120, // 2 minute intervals
      rngTimeout
    ],
  });

  displayResult('DrawBeacon', drawBeaconResult);

  cyan('\nSet DrawBeacon as manager for DrawBuffer...');
  const drawBuffer = await ethers.getContract('DrawBuffer');
  await drawBuffer.setManager(drawBeaconResult.address);
  green('DrawBeacon manager set!');

  cyan('\nDeploying DrawCalculator...');
  const drawCalculatorResult = await deploy('DrawCalculator', {
    from: deployer,
    args: [
      ticketResult.address,
      drawBufferResult.address,
      tsunamiDrawSettindsHistoryResult.address,
    ],
  });
  displayResult('DrawCalculator', drawCalculatorResult);

  cyan('\nDeploying PrizeDistributor...');
  const prizeDistributorResult = await deploy('PrizeDistributor', {
    from: deployer,
    args: [deployer, ticketResult.address, drawCalculatorResult.address],
  });
  displayResult('PrizeDistributor', prizeDistributorResult);

  cyan('\nDeploying PrizeSplitStrategy...');
  const prizeSplitStrategyResult = await deploy('PrizeSplitStrategy', {
    from: deployer,
    args: [deployer, yieldSourcePrizePoolResult.address],
  });
  displayResult('PrizeSplitStrategy', prizeSplitStrategyResult);

  cyan('\nConfiguring PrizeSplitStrategy...');
  const prizeSplitStrategy = await ethers.getContract('PrizeSplitStrategy');
  await prizeSplitStrategy.setPrizeSplits([
    {
      target: deployer,
      percentage: 1000, // 100%
    },
  ]);
  green(
    'PrizeSplitStrategy Configured',
    `\nPrizeReserve: ${deployer} receives 100% of captured interest`,
  );

  cyan('\nConfiguring PrizeSplitStrategy to be YieldSource strategy...');
  await yieldSourcePrizePool.setPrizeStrategy(prizeSplitStrategyResult.address);

  dim('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  green('Contract Deployments Complete!');
  dim('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};
