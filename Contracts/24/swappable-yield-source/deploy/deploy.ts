import { Contract } from 'ethers';
import { getChainByChainId } from 'evm-chains';
import { writeFileSync } from 'fs';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, DeploymentSubmission, DeployResult } from 'hardhat-deploy/types';

import {
  action,
  alert,
  info,
  success,
  isTestEnvironment as isTestEnvironmentHelper,
} from '../helpers';
import { AAVE_DAI_YIELD_SOURCE_KOVAN } from '../Constant';

const displayResult = (name: string, result: DeployResult) => {
  if (!result.newlyDeployed) {
    alert(`Re-used existing ${name} at ${result.address}`);
  } else {
    success(`${name} deployed at ${result.address}`);
  }
};

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  info('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  info('PoolTogether Swappable Yield Source - Deploy Script');
  info('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  const { artifacts, deployments, ethers, getChainId, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { getContractAt, provider } = ethers;

  const outputDirectory = `./deployments/${network.name}`;

  let { deployer, multisig } = await getNamedAccounts();

  const chainId = parseInt(await getChainId());

  // 31337 is unit testing, 1337 is for coverage
  const isNotTestChainId = chainId !== 31337 && chainId !== 1337;
  const networkName = isNotTestChainId ? getChainByChainId(chainId)?.network : 'Test';
  const isTestEnvironment = isTestEnvironmentHelper(network);

  info(`Network: ${networkName} (${isTestEnvironment ? 'local' : 'remote'})`);
  info(`Deployer: ${deployer}`);

  if (!multisig) {
    alert(
      `Multisig address not defined for network ${networkName}, falling back to deployer: ${deployer}`,
    );
    multisig = deployer;
  } else {
    info(`Multisig: ${multisig}`);
  }

  action(`Deploying SwappableYieldSource...`);
  const swappableYieldSourceResult: DeployResult = await deploy('SwappableYieldSource', {
    from: deployer,
    skipIfAlreadyDeployed: true,
  });

  displayResult('SwappableYieldSource', swappableYieldSourceResult);

  const swappableYieldSourceContract = await getContractAt(
    'SwappableYieldSource',
    swappableYieldSourceResult.address,
  );

  if (swappableYieldSourceContract.newlyDeployed) {
    action('Calling mockInitialize()');
    await swappableYieldSourceContract.freeze();
    success('mockInitialize called successfully');
  }

  let proxyFactoryContract: Contract;

  if (isTestEnvironment) {
    action(`TestEnvironment detected, deploying a local GenericProxyFactory`);

    const genericProxyFactoryResult: DeployResult = await deploy('GenericProxyFactory', {
      from: deployer,
      skipIfAlreadyDeployed: true,
    });

    proxyFactoryContract = await getContractAt(
      'GenericProxyFactory',
      genericProxyFactoryResult.address,
    );

    success(`Deployed a local GenericProxyFactory at ${proxyFactoryContract.address}`);
  } else {
    let { genericProxyFactory } = await getNamedAccounts();
    proxyFactoryContract = await getContractAt('GenericProxyFactory', genericProxyFactory);
    success(`GenericProxyFactory deployed at ${proxyFactoryContract.address}`);

    action(`Deploying AaveDAISwappableYieldSource...`);
    const swappableYieldSourceArtifact = await artifacts.readArtifact('SwappableYieldSource');
    const swappableYieldSourceABI = swappableYieldSourceArtifact.abi;

    const swappableYieldSourceInterface = new ethers.utils.Interface(swappableYieldSourceABI);

    const constructorArgs = swappableYieldSourceInterface.encodeFunctionData(
      swappableYieldSourceInterface.getFunction('initialize'),
      [
        AAVE_DAI_YIELD_SOURCE_KOVAN,
        18,
        'sysDAI',
        'PoolTogether Swappable Yield Source DAI',
        multisig,
      ],
    );

    const aaveDAISwappableYieldSourceResult = await proxyFactoryContract.create(
      swappableYieldSourceContract.address,
      constructorArgs,
    );

    const aaveDAISwappableYieldSourceReceipt = await provider.getTransactionReceipt(
      aaveDAISwappableYieldSourceResult.hash,
    );

    const aaveDAISwappableYieldSourceEvent = proxyFactoryContract.interface.parseLog(
      aaveDAISwappableYieldSourceReceipt.logs[0],
    );

    const aaveDAISwappableYieldSourceAddress = aaveDAISwappableYieldSourceEvent.args.created;

    success(`AaveDAISwappableYieldSource deployed at ${aaveDAISwappableYieldSourceAddress}`);

    action('Saving deployments file for Aave DAI');

    const deploymentSubmission: DeploymentSubmission = {
      address: aaveDAISwappableYieldSourceAddress,
      abi: swappableYieldSourceABI,
      receipt: aaveDAISwappableYieldSourceReceipt,
      transactionHash: aaveDAISwappableYieldSourceReceipt.transactionHash,
      args: [constructorArgs],
      bytecode: `${await provider.getCode(aaveDAISwappableYieldSourceAddress)}`,
    };

    const outputFile = `${outputDirectory}/AaveDAISwappableYieldSource.json`;

    action(`Writing to ${outputFile}...`);
    writeFileSync(outputFile, JSON.stringify(deploymentSubmission, null, 2), {
      encoding: 'utf8',
      flag: 'w',
    });

    await deployments.save('AaveDAISwappableYieldSource', deploymentSubmission);
  }
};

export default deployFunction;
