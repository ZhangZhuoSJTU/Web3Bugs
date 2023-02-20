import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {execute} = deployments;

  const {deployer} = await getNamedAccounts();

  const l1Gateway = await hre.companionNetworks['l1'].deployments.get(
      'L1LPTGateway',
  );

  const l1Migrator = await hre.companionNetworks['l1'].deployments.get(
      'L1Migrator',
  );

  await execute(
      'L2LPTGateway',
      {from: deployer, log: true},
      'setCounterpart',
      l1Gateway.address,
  );

  await execute(
      'L2Migrator',
      {from: deployer, log: true},
      'setL1Migrator',
      l1Migrator.address,
  );
};

func.tags = ['L2_GATEWAY_INIT'];
export default func;
