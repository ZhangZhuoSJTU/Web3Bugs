import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  const token = await deploy('LivepeerToken', {
    from: deployer,
    args: [],
    log: true,
  });

  await deployments.save('L2_LPT', token);
};

func.tags = ['L2_LPT'];
export default func;
