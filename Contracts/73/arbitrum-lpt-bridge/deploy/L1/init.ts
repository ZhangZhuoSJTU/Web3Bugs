import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {execute} = deployments;

  const {deployer} = await getNamedAccounts();

  const l2Gateway = await hre.companionNetworks['l2'].deployments.get(
      'L2LPTGateway',
  );

  await execute(
      'L1LPTGateway',
      {from: deployer, log: true},
      'setCounterpart',
      l2Gateway.address,
  );
};

func.tags = ['L1_GATEWAY_INIT'];
export default func;
