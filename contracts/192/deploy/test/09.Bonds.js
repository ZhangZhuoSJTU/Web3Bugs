module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, node } = await getNamedAccounts();

    const GovNFT = await deployments.get("GovNFT");
   
    const BondNFT = await deploy('BondNFT', {
        contract: 'BondNFT',
        from: deployer,
        log: true,
        args: ["", "", ""]
    });

    const Lock = await deploy('Lock', {
        contract: 'Lock',
        from: deployer,
        log: true,
        args: [BondNFT.address, GovNFT.address]
    });

    await execute(
        'BondNFT',
        { from: deployer, log: true },
        'setManager(address)',
        Lock.address
    );

};

module.exports.tags = ['test'];
