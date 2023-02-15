module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer, dev } = await getNamedAccounts();

  const launchEventAddress = (await deployments.get("LaunchEvent")).address;
  const rJoeAddress = (await deployments.get("RocketJoeToken")).address;

  const chainId = await getChainId();

  let wavaxAddress, routerAddress, factoryAddress;
  if (chainId == 4) {
    // rinkeby contract addresses
    wavaxAddress = ethers.utils.getAddress(
      "0xc778417e063141139fce010982780140aa0cd5ab"
    ); // wrapped ETH ethers.utils.getAddress
    routerAddress = ethers.utils.getAddress(
      "0x7E2528476b14507f003aE9D123334977F5Ad7B14"
    );
    factoryAddress = ethers.utils.getAddress(
      "0x86f83be9770894d8e46301b12E88e14AdC6cdb5F"
    );
  } else if (chainId == 43114 || chainId == 31337) {
    // avalanche mainnet or hardhat network ethers.utils.getAddresses
    wavaxAddress = ethers.utils.getAddress(
      "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
    );
    routerAddress = ethers.utils.getAddress(
      "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
    );
    factoryAddress = ethers.utils.getAddress(
      "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10"
    );
  }

  const factory = await deploy("RocketJoeFactory", {
    from: deployer,
    args: [
      launchEventAddress,
      rJoeAddress,
      wavaxAddress,
      deployer,
      routerAddress,
      factoryAddress,
    ],
    log: true,
  });
  if (factory.newlyDeployed) {
    const rocketJoeFactoryAddress = (await deployments.get("RocketJoeFactory"))
      .address;
    const launchEvent = await ethers.getContractAt(
      "LaunchEvent",
      launchEventAddress
    );
    await launchEvent.transferOwnership(rocketJoeFactoryAddress);
  }
};

module.exports.tags = ["RocketJoeFactory"];
module.exports.dependencies = ["LaunchEvent", "RocketJoeToken"];
