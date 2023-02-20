const {ethers, upgrades} = require("hardhat");
const {expect} = require("chai");
require("chai").should();

describe("PureTokenAdapter Contract", async () => {
    let ADMIN, ASSET_MANAGER, ASSET_MANAGER_2;
    let erc20, adapter;

    const RATE = ethers.utils.parseEther("0");
    before(async () => {
        [ADMIN, ASSET_MANAGER, ASSET_MANAGER_2] = await ethers.getSigners();

        erc20 = await upgrades.deployProxy(await ethers.getContractFactory("FaucetERC20"), ["Dai Stablecoin", "DAI"], {
            initializer: "__FaucetERC20_init(string,string)"
        });

        await erc20.mint(ADMIN.address, ethers.utils.parseEther("10000000"));
    });

    beforeEach(async () => {
        adapter = await upgrades.deployProxy(
            await ethers.getContractFactory("PureTokenAdapter"),
            [ASSET_MANAGER.address],
            {initializer: "__PureTokenAdapter_init(address)"}
        );
    });

    it("Get rate", async () => {
        const rate = await adapter.getRate(erc20.address);
        rate.should.eq(RATE);
    });

    it("Get supply", async () => {
        await adapter.getSupply(erc20.address);

        //balance <= 10
        await erc20.transfer(adapter.address, ethers.utils.parseEther("10"));
        await adapter.getSupply(erc20.address);

        //balance >= 10
        await erc20.transfer(adapter.address, ethers.utils.parseEther("100"));
        await adapter.getSupply(erc20.address);
    });

    it("Get supply view", async () => {
        let supply = await adapter.getSupplyView(erc20.address);
        supply.should.eq("0");

        await erc20.transfer(adapter.address, ethers.utils.parseEther("10"));
        supply = await adapter.getSupplyView(erc20.address);
        supply.should.eq(ethers.utils.parseEther("10"));

        await erc20.transfer(adapter.address, ethers.utils.parseEther("100"));
        supply = await adapter.getSupplyView(erc20.address);
        supply.should.eq(ethers.utils.parseEther("110"));
    });

    it("Check is support", async () => {
        const isSupport = await adapter.supportsToken(erc20.address);
        isSupport.should.eq(true);
    });

    it("Deposit and withdraw", async () => {
        await erc20.transfer(adapter.address, ethers.utils.parseEther("100"));
        await adapter.connect(ASSET_MANAGER).deposit(erc20.address);

        let supply = await adapter.getSupplyView(erc20.address);
        supply.should.eq(ethers.utils.parseEther("100"));

        await adapter.connect(ASSET_MANAGER).withdraw(erc20.address, ADMIN.address, ethers.utils.parseEther("100"));

        supply = await adapter.getSupplyView(erc20.address);
        supply.should.eq("0");
    });

    it("Claim tokens", async () => {
        await adapter.connect(ASSET_MANAGER).claimTokens(erc20.address, ADMIN.address);
    });

    it("Claim tokens: recipient can not be zero", async () => {
        await expect(
            adapter.connect(ASSET_MANAGER).claimTokens(erc20.address, ethers.constants.AddressZero)
        ).to.be.revertedWith("ERC20: transfer to the zero address");
    });

    it("Withdraw all", async () => {
        await adapter.connect(ASSET_MANAGER).withdrawAll(erc20.address, ADMIN.address);
    });

    it("Token not supported", async () => {
        await expect(adapter.deposit(ethers.constants.AddressZero)).to.be.revertedWith(
            "PureTokenAdapter: token not supported"
        );
    });

    it("Set new assetManager", async () => {
        await adapter.setAssetManager(ASSET_MANAGER_2.address);

        let res = await adapter.assetManager();
        res.should.eq(ASSET_MANAGER_2.address);
    });
});
