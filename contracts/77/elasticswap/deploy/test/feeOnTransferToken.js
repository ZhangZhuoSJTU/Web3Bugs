module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin } = namedAccounts;
  const initialSupply = 1000000000000;
  const mathLib = await deployments.get("MathLib");
  const deployResult = await deploy("FeeOnTransferMock", {
    from: admin,
    contract: "FeeOnTransferMock",
    args: ["FeeOnTransferMock", "FOT", initialSupply, admin],
    libraries: {
      MathLib: mathLib.address,
    },
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract FeeOnTransferMock deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["FeeOnTransferMock"];
module.exports.dependencies = ["MathLib"];
