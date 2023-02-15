import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';
import {ARBITRUM_NETWORK} from '../constants';
import {ethers} from 'hardhat';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, execute} = deployments;

  const {deployer} = await getNamedAccounts();

  const l1LPT = await hre.companionNetworks['l1'].deployments.get('L1_LPT');
  const l2LPT = await deployments.get('L2_LPT');

  const l2Gateway = await deploy('L2LPTGateway', {
    from: deployer,
    args: [
      ARBITRUM_NETWORK.rinkeby.l2GatewayRouter,
      l1LPT.address,
      l2LPT.address,
    ],
    log: true,
  });

  await execute(
      'L2_LPT',
      {from: deployer, log: true},
      'grantRole',
      ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
      l2Gateway.address,
  );

  await execute(
      'L2LPTGateway',
      {from: deployer, log: true},
      'grantRole',
      ethers.utils.solidityKeccak256(['string'], ['GOVERNOR_ROLE']),
      deployer,
  );
};

func.tags = ['L2_GATEWAY'];
export default func;
