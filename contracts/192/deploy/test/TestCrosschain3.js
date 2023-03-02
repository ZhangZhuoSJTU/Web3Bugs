module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { node, deployer, endpoint } = await getNamedAccounts();

    const GovNFT = await deployments.get('GovNFT');
    const govnft = await ethers.getContractAt("GovNFT", GovNFT.address);    

    await execute(
        'GovNFT',
        { from: deployer, log: true, value: ethers.utils.parseEther("3") },
        'crossChain(uint16,bytes,address,uint256[])',
        10006,
        "", // set to deployment on fuji
        node,
        [1,2]
    );

    console.log("Your Gov NFT balance: " + await govnft.balanceOf(deployer));

};
module.exports.tags = ['nft3'];