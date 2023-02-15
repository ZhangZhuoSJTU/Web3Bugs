const { parseUnits, id } = require('ethers/lib/utils');

const MONTH = parseInt((60 * 60 * 24 * 365.25) / 12);

async function main() {
  //
  // CONFIG
  //

  const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const aUSDC = '0xbcca60bb61934080951369a648fb03df4f96263c';

  const UMAHO = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const SPCC = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const SHER = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const NON_STAKER = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const NFT_NAME = 'Sherlock Position'; // TBD
  const NFT_SYMBOL = 'SP'; // TBD

  const STAKING_PERIODS = [MONTH * 3, MONTH * 6, MONTH * 12]; // TBD

  const MILLION_USDC = parseUnits('1000000', 6);
  // If you stake 1 USDC for a year, you'll get 0.1 SHER token
  const SHER_PER_USDC_PER_YEAR = parseUnits('0.1', 18); // TBD
  const SHER_RATE_CODE = SHER_PER_USDC_PER_YEAR.div(MONTH * 12);

  //
  // END CONFIG
  //
  if (network.name != 'mainnet' && network.name != 'local') throw Error('Invalid network');

  this.Sherlock = await ethers.getContractFactory('Sherlock');
  this.AaveV2Strategy = await ethers.getContractFactory('AaveV2Strategy');
  this.SherDistributionManager = await ethers.getContractFactory('SherDistributionManager');
  this.SherlockProtocolManager = await ethers.getContractFactory('SherlockProtocolManager');
  this.SherlockClaimManager = await ethers.getContractFactory('SherlockClaimManager');

  console.log('0 - Start');

  const aaveV2Strategy = await this.AaveV2Strategy.deploy(aUSDC, MULTISIG);
  await aaveV2Strategy.deployed();
  console.log('1 - Deployed aaveV2Strategy @', aaveV2Strategy.address);

  const sherDistributionManager = await this.SherDistributionManager.deploy(
    MILLION_USDC.mul(100),
    MILLION_USDC.mul(600),
    SHER_RATE_CODE,
    SHER,
  );
  await sherDistributionManager.deployed();
  console.log('2 - Deployed sherDistributionManager @', sherDistributionManager.address);

  const sherlockProtocolManager = await this.SherlockProtocolManager.deploy(USDC);
  await sherlockProtocolManager.deployed();
  console.log('3 - Deployed sherlockProtocolManager @', sherlockProtocolManager.address);

  const sherlockClaimManager = await this.SherlockClaimManager.deploy(UMAHO, SPCC);
  await sherlockClaimManager.deployed();
  console.log('4 - Deployed sherlockClaimManager @', sherlockClaimManager.address);

  const sherlock = await this.Sherlock.deploy(
    USDC,
    SHER,
    NFT_NAME,
    NFT_SYMBOL,
    aaveV2Strategy.address,
    sherDistributionManager.address,
    NON_STAKER,
    sherlockProtocolManager.address,
    sherlockClaimManager.address,
    STAKING_PERIODS,
  );
  await sherlock.deployed();
  console.log('5 - Deployed sherlock @', sherlock.address);

  await (await aaveV2Strategy.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('6 - Set aaveV2Strategy core');
  await (await sherDistributionManager.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('7 - Set sherDistributionManager core');
  await (await sherlockProtocolManager.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('8 - Set sherlockProtocolManager core');
  await (await sherlockClaimManager.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('9 - Set sherlockClaimManager core');

  console.log("const Sherlock = '" + sherlock.address + "';");
  console.log("const AaveV2Strategy = '" + aaveV2Strategy.address + "';");
  console.log("const SherDistributionManager = '" + sherDistributionManager.address + "';");
  console.log("const SherlockProtocolManager = '" + sherlockProtocolManager.address + "';");
  console.log("const SherlockClaimManager = '" + sherlockClaimManager.address + "';");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
