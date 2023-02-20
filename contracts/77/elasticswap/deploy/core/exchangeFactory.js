module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin, feeRecipient } = namedAccounts;

  const mathLib = await deployments.get("MathLib");
  const deployResult = await deploy("ExchangeFactory", {
    from: admin,
    contract: "ExchangeFactory",
    args: [feeRecipient],
    libraries: {
      MathLib: mathLib.address,
    },
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract ExchangeFactory deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["ExchangeFactory"];
module.exports.dependencies = ["MathLib"];
