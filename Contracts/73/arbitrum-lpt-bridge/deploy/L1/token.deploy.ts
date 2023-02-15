import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/dist/types';
import {ethers} from 'hardhat';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, execute} = deployments;

  const {deployer} = await getNamedAccounts();

  const token = await deploy('LivepeerToken', {
    from: deployer,
    args: [],
    log: true,
  });
  await deployments.save('L1_LPT', token);

  await execute(
      'L1_LPT',
      {from: deployer, log: true},
      'grantRole',
      ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
      deployer,
  );

  await execute(
      'L1_LPT',
      {from: deployer, log: true},
      'mint',
      deployer,
      ethers.utils.parseEther('100000'),
  );
};

func.tags = ['L1_LPT'];
export default func;
