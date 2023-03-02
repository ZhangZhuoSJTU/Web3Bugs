module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;

    const Stable = await deployments.get('StableToken');
    const Trading = await deployments.get('Trading');
    const PositionContract = await deployments.get('Position');
    const PairsContract = await deployments.get('PairsContract');
    const Referrals = await deployments.get('Referrals');
    const GovNFT = await deployments.get('GovNFT');
    const StableVault = await deployments.get('StableVault');
    const TradingLibrary = await deployments.get('TradingLibrary');
    const Forwarder = await deployments.get('Forwarder');
    const Timelock = await deployments.get('Timelock');


    console.log("Stable: " + Stable.address);
    console.log("Positions: " + PositionContract.address);
    console.log("GovNFT: " + GovNFT.address);
    console.log("PairsContract: " + PairsContract.address);
    console.log("StableVault: " + StableVault.address);
    console.log("Referrals: " + Referrals.address);
    console.log("Trading: " + Trading.address);
    console.log("TradingLibrary: " + TradingLibrary.address);
    console.log("Forwarder: " + Forwarder.address);
    console.log("Timelock: " + Timelock.address);
};

module.exports.tags = ['print'];