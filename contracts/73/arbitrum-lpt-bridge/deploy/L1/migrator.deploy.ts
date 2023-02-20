import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';
import {ARBITRUM_NETWORK} from '../constants';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const bondingManager = '0xf71b1fb1bd297ddb4e92c9ab89d5f57ffcc899f9';
  const ticketBroker = '0x940D5630bBc300cCCF4BEaBAFfC300F7787d5b1f';
  const l2Migrator = await hre.companionNetworks['l2'].deployments.get(
      'L2Migrator',
  );

  await deploy('L1Migrator', {
    from: deployer,
    args: [
      ARBITRUM_NETWORK.rinkeby.inbox,
      bondingManager,
      ticketBroker,
      l2Migrator.address,
    ],
    log: true,
  });
};

func.tags = ['L1_MIGRATOR'];
export default func;
