module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin } = namedAccounts;
  const initialSupply = "1000000000000000000000000000";
  const deployResult = await deploy("BaseToken", {
    from: admin,
    contract: "ElasticMock",
    args: ["ElasticTokenMock", "ETM", initialSupply, admin],
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract BaseToken deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["BaseToken"];
