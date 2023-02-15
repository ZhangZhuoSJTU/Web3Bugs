const { parseUnits, id } = require('ethers/lib/utils');

async function main() {
  //
  // CONFIG
  //

  const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  const EOA_ONE = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const EOA_TWO = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const DELAY = 0; // FOR INITIAL TWO WEEKS

  const Sherlock = ''; // TBD
  const AaveV2Strategy = ''; // TBD
  const SherDistributionManager = ''; // TBD
  const SherlockProtocolManager = ''; // TBD
  const SherlockClaimManager = ''; // TBD

  //
  // END CONFIG
  //
  if (network.name != 'mainnet' && network.name != 'local') throw Error('Invalid network');

  const sherlock = await ethers.getContractAt('Sherlock', Sherlock);
  const aaveV2Strategy = await ethers.getContractAt('AaveV2Strategy', AaveV2Strategy);
  const sherDistributionManager = await ethers.getContractAt(
    'SherDistributionManager',
    SherDistributionManager,
  );
  const sherlockProtocolManager = await ethers.getContractAt(
    'SherlockProtocolManager',
    SherlockProtocolManager,
  );
  const sherlockClaimManager = await ethers.getContractAt(
    'SherlockClaimManager',
    SherlockClaimManager,
  );

  const timelock = await (
    await ethers.getContractFactory('TimelockController')
  ).deploy(DELAY, [MULTISIG], [MULTISIG, EOA_ONE, EOA_TWO]);
  await timelock.deployed();
  console.log('1 - Deployed timelockController @', timelock.address);

  await (await sherlock.transferOwnership(timelock.address)).wait();
  console.log('2 - Transferred sherlock ownership');

  await (await aaveV2Strategy.transferOwnership(timelock.address)).wait();
  console.log('3 - Transferred aaveV2Strategy ownership');

  await (await sherDistributionManager.transferOwnership(timelock.address)).wait();
  console.log('4 - Transferred sherDistributionManager ownership');

  await (await sherlockProtocolManager.transferOwnership(timelock.address)).wait();
  console.log('5 - Transferred sherlockProtocolManager ownership');

  await (await sherlockClaimManager.transferOwnership(timelock.address)).wait();
  console.log('6 - Transferred sherlockClaimManager ownership');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
