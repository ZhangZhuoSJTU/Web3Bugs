const Migrations = artifacts.require("Migrations");
const utils = require("./util");


module.exports = async function (deployer, network, accounts) {
  console.log("Deploying in network =", network);
  process.env.NETWORK = network;
  if (utils.isSkip(network)) {
    return;
  }
   await deployer.deploy(Migrations, utils.deployOption(accounts));

};
