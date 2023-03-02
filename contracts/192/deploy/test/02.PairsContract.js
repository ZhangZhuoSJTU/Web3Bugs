module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const StableToken = await deployments.get('StableToken');
   
    const Nonce = await ethers.provider.getTransactionCount(deployer);
    await deploy('PairsContract', {
        contract: 'PairsContract',
        from: deployer,
        log: true,
        nonce: Nonce,
        args: []
    });

    await execute(
        'PairsContract',
        { from: deployer, log: true, nonce: Nonce+1 },
        'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
        0,
        "BTC/USD",
        "0x0000000000000000000000000000000000000000",
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("150"),
        1e10,
        3e9
    );

    await execute(
        'PairsContract',
        { from: deployer, log: true, nonce: Nonce+2 },
        'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
        1,
        "ETH/USD",
        "0x0000000000000000000000000000000000000000",
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("150"),
        1e10,
        3e9
    );

    await execute(
        'PairsContract',
        { from: deployer, log: true, nonce: Nonce+3 },
        'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
        2,
        "XAU/USD",
        "0x0000000000000000000000000000000000000000",
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("150"),
        1e10,
        3e9
    );

};

module.exports.tags = ['test'];
