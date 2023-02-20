module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const rocketFactoryaddress = (await deployments.get("RocketJoeFactory"))
    .address;

  const chainId = await getChainId();

  const token = await deploy("ERC20Token", {
    from: deployer,
    log: true,
  });
  if (token.newlyDeployed) {
    const tokenAddress = (await deployments.get("ERC20Token")).address;
    const token = await ethers.getContractAt("ERC20Token", tokenAddress);

    const factoryAddress = (await deployments.get("RocketJoeFactory")).address;
    const factory = await ethers.getContractAt(
      "RocketJoeFactory",
      factoryAddress
    );

    const tokenAmount = ethers.utils.parseEther("105");

    await token.mint(deployer, tokenAmount);
    await token.approve(factoryAddress, tokenAmount);

    await factory.createRJLaunchEvent(
      deployer,
      (await ethers.provider.getBlock()).timestamp + 60,
      tokenAddress,
      tokenAmount,
      ethers.utils.parseEther("0.05"), // incentive token
      ethers.utils.parseEther("0"), // floor price
      4e11, // withdraw penalty gradient
      4e11, // fixed withdraw penalty
      ethers.utils.parseEther("5"), // maxAllocation
      60 * 60 * 24, // user timelock
      60 * 60 * 24 + 1 // issuer timelock
    );
  }
};

module.exports.tags = ["ERC20Token"];
module.exports.dependencies = ["RocketJoeFactory"];
