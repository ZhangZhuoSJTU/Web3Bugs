import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';
import {ethers} from 'hardhat';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  await deploy('L2Migrator', {
    from: deployer,
    args: [ethers.constants.AddressZero],
    log: true,
  });
};

func.tags = ['L2_MIGRATOR'];
export default func;
