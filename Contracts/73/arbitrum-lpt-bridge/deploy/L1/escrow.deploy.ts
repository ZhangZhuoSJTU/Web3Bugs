import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer} = await getNamedAccounts();

  await deploy('L1Escrow', {
    from: deployer,
    args: [],
    log: true,
  });
};

func.tags = ['L1_ESCROW'];
func.dependencies = ['L1_LPT'];
export default func;
