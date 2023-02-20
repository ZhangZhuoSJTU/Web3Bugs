module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const namedAccounts = await getNamedAccounts();
  const { admin } = namedAccounts;

  const quoteToken = await deployments.get("QuoteToken");
  const baseToken = await deployments.get("BaseToken");
  const mathLib = await deployments.get("MathLib");
  const exchangeFactory = await deployments.get("ExchangeFactory");
  const name = "EGT LP Token";
  const symbol = "EGTLPS";
  const deployResult = await deploy("EGT Exchange", {
    from: admin,
    contract: "Exchange",
    args: [
      name,
      symbol,
      baseToken.address,
      quoteToken.address,
      exchangeFactory.address,
    ],
    libraries: {
      MathLib: mathLib.address,
    },
  });
  if (deployResult.newlyDeployed) {
    log(
      `contract EGT Exchange deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
    );
  }
};
module.exports.tags = ["EGT Exchange"];
module.exports.dependencies = [
  "BaseToken",
  "QuoteToken",
  "MathLib",
  "ExchangeFactory",
];
