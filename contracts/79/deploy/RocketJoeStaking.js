module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const rJoeAddress = (await deployments.get("RocketJoeToken")).address;
  const rJoePerSec = ethers.utils.parseEther("100");

  const chainId = await getChainId();

  let joeAddress;
  if (chainId == 4) {
    // rinkeby contract addresses
    joeAddress = ethers.utils.getAddress(
      "0xce347E069B68C53A9ED5e7DA5952529cAF8ACCd4"
    );
  } else if (chainId == 43114 || chainId == 31337) {
    // avalanche mainnet or hardhat network addresses
    joeAddress = ethers.utils.getAddress(
      "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd"
    );
  }

  const staking = await deploy("RocketJoeStaking", {
    from: deployer,
    proxyContract: "OpenZeppelinTransparentProxy",
    init: {
      args: [joeAddress, rJoeAddress, rJoePerSec],
    },
    log: true,
  });
  if (staking.newlyDeployed) {
    const rJoeStakingAddress = (await deployments.get("RocketJoeStaking"))
      .address;
    const rJoe = await ethers.getContractAt("RocketJoeToken", rJoeAddress);
    await rJoe.transferOwnership(rJoeStakingAddress);
  }
};

module.exports.tags = ["RocketJoeStaking"];
module.exports.dependencies = ["RocketJoeToken"];
