module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { node, deployer, endpoint } = await getNamedAccounts();

    const NFT = await deploy('GovNFT', {
        contract: 'GovNFT',
        from: deployer,
        log: true,
        args: [endpoint, "", "test", "test"]
    });

    const GovNFT = await deployments.get('GovNFT');
    const govnft = await ethers.getContractAt("GovNFT", GovNFT.address);    

    console.log("Your Gov NFT balance: " + await govnft.balanceOf(deployer));

};
module.exports.tags = ['nft2'];