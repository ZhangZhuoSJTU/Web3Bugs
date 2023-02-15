const { ethers } = require("hardhat");

async function getJoeFactory() {
  return await ethers.getContractAt(
    "IJoeFactory",
    "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10"
  );
}

async function getWavax() {
  return await ethers.getContractAt(
    "IWAVAX",
    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
  );
}

async function deployRocketFactory(dev, rJoe, penaltyCollector) {
  const wavax = await getWavax();
  const router = await ethers.getContractAt(
    "IJoeRouter02",
    "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
  );
  const factory = await getJoeFactory();

  // Factories for deploying our contracts.
  const RocketJoeFactoryCF = await ethers.getContractFactory(
    "RocketJoeFactory"
  );
  const LaunchEventCF = await ethers.getContractFactory("LaunchEvent");

  // Deploy the rocket joe contracts.
  const LaunchEventPrototype = await LaunchEventCF.deploy();

  const RocketFactory = await RocketJoeFactoryCF.deploy(
    LaunchEventPrototype.address,
    rJoe.address,
    wavax.address,
    penaltyCollector.address,
    router.address,
    factory.address
  );
  await LaunchEventPrototype.connect(dev).transferOwnership(
    RocketFactory.address
  );
  return RocketFactory;
}

// Return a newly created LaunchEvent with default parameters.
async function createLaunchEvent(
  RocketFactory,
  issuer,
  block,
  token,
  amount = "105",
  percent = "0.05",
  floor = "1",
  maxAllocation = "5.0"
) {
  await RocketFactory.createRJLaunchEvent(
    issuer.address, // Issuer
    block.timestamp + 60, // Start time (60 seconds from now)
    token.address, // Address of the token being auctioned
    ethers.utils.parseEther(amount), // Amount of tokens for auction
    ethers.utils.parseEther(percent), // Percent of tokens incentives
    ethers.utils.parseEther(floor), // Floor price (1 avax)
    ethers.utils.parseEther("0.5"), // Max withdraw penalty
    ethers.utils.parseEther("0.4"), // Fixed withdraw penalty
    ethers.utils.parseEther(maxAllocation), // max allocation
    60 * 60 * 24 * 7, // User timelock
    60 * 60 * 24 * 8 // Issuer timelock
  );

  // Get a reference to the acutal launch event contract.
  LaunchEvent = await ethers.getContractAt(
    "LaunchEvent",
    RocketFactory.getRJLaunchEvent(token.address)
  );
  return LaunchEvent;
}

module.exports = {
  createLaunchEvent,
  deployRocketFactory,
  getJoeFactory,
  getWavax,
};
