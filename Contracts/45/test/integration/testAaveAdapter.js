const {ethers, upgrades, network} = require("hardhat");
const {parseEther} = require("ethers").utils;
require("chai").should();

const {waitNBlocks} = require("../../utils");

describe("Test aave adapter on forking mainnet", () => {
    const lendingPool = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"; //aave lendingPool contract on mainnet
    const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const account = "0x07f0eb0c571B6cFd90d17b5de2cc51112Fb95915"; //An address with eth and dai on the mainnet is used for testing

    const deployAndInitContracts = async () => {
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [account]
        });
        signer = await ethers.provider.getSigner(account);

        dai = await ethers.getContractAt("FaucetERC20", daiAddress);

        aAdapter = await upgrades.deployProxy(await ethers.getContractFactory("AaveAdapter"), [account, lendingPool], {
            initializer: "__AaveAdapter_init(address,address)"
        });

        await aAdapter.mapTokenToAToken(daiAddress);
    };

    before(deployAndInitContracts);

    it("deposit to aave and generate interest", async () => {
        const depositAmount = parseEther("100");
        await dai.connect(signer).transfer(aAdapter.address, depositAmount);
        await aAdapter.connect(signer).deposit(daiAddress);

        let bal = await aAdapter.getSupplyView(daiAddress);
        console.log("start balance:", bal.toString());
        bal.should.eq(depositAmount);

        await waitNBlocks(10);

        bal = await aAdapter.getSupplyView(daiAddress);
        console.log("after 10 blocks:", bal.toString());
        bal.should.be.above(depositAmount);

        await aAdapter.connect(signer).withdrawAll(daiAddress, account);
        bal = await aAdapter.getSupplyView(daiAddress);
        console.log("after withdraw all:", bal.toString());
        bal.should.eq("0");
    });
});
