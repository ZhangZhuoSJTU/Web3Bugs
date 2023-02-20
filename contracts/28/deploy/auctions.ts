import contracts from "../scripts/contracts";

module.exports = async ({ getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts();

  // const crowdsale = await contracts.deployContract("Crowdsale", deployer);
  // console.log("Deployed Crowdsale " + crowdsale);
  // const dutchAuction = await contracts.deployContract("DutchAuction", deployer);
  // console.log("Deployed Dutch Auction " + dutchAuction);
  // const batchAuction = await contracts.deployContract("BatchAuction", deployer);
  // console.log("Deployed Batch Auction " + batchAuction);
  const hyperbolicAuction = await contracts.deployContract(
    "HyperbolicAuction",
    deployer
  );
  console.log("Deployed Hyperbolic Auction " + hyperbolicAuction);

  console.log("Deployed actions");
};

module.exports.tags = ["Auctions"];
