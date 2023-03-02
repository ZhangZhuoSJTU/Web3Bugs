module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    await deployments.get("StableToken");
   
    const Nonce = await ethers.provider.getTransactionCount(deployer);
    const Forwarder = await deploy('Forwarder', {
        contract: 'Forwarder',
        from: deployer,
        log: true,
        nonce: Nonce,
        args: []
    });

    if(Forwarder.newlyDeployed) {
        await execute(
            'StableToken',
            { from: deployer, log: true },
            'setTrustedForwarder(address,bool)',
            Forwarder.address,
            true
        );
        await execute(
            'Position',
            { from: deployer, log: true },
            'setTrustedForwarder(address,bool)',
            Forwarder.address,
            true
        );
        await execute(
            'GovNFT',
            { from: deployer, log: true },
            'setTrustedForwarder(address,bool)',
            Forwarder.address,
            true
        );
        await execute(
            'Trading',
            { from: deployer, log: true },
            'setTrustedForwarder(address,bool)',
            Forwarder.address,
            true
        );
        await execute(
            'StableVault',
            { from: deployer, log: true },
            'setTrustedForwarder(address,bool)',
            Forwarder.address,
            true
        );
    }
};

module.exports.tags = ['test'];
