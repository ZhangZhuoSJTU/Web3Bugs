const {ethers, upgrades} = require("hardhat");
const {expect} = require("chai");

require("chai").should();

describe("CompoundAdapter Contract", async () => {
    let ADMIN, ASSET_MANAGER, ASSET_MANAGER_2;
    let erc20, marketMock, compoundAdapter;

    const RATE = ethers.utils.parseEther("0.01");
    before(async () => {
        [ADMIN, ASSET_MANAGER, ASSET_MANAGER_2] = await ethers.getSigners();

        erc20 = await upgrades.deployProxy(await ethers.getContractFactory("FaucetERC20"), ["Dai Stablecoin", "DAI"], {
            initializer: "__FaucetERC20_init(string,string)"
        });

        marketMock = await upgrades.deployProxy(
            await ethers.getContractFactory("CompoundMock"),
            [RATE, erc20.address],
            {initializer: "__CompoundMock_init(uint256,address)"}
        );

        await erc20.mint(ADMIN.address, ethers.utils.parseEther("10000000"));
    });

    beforeEach(async () => {
        compoundAdapter = await upgrades.deployProxy(
            await ethers.getContractFactory("CompoundAdapter"),
            [ASSET_MANAGER.address],
            {initializer: "__CompoundAdapter_init(address)"}
        );

        await compoundAdapter.mapTokenToCToken(erc20.address, marketMock.address);
    });

    it("Get rate", async () => {
        const rate = await compoundAdapter.getRate(erc20.address);
        rate.toString().should.eq(RATE.toString());
    });

    it("Get supply", async () => {
        await compoundAdapter.getSupply(erc20.address);

        //balance <= 10
        await erc20.approve(marketMock.address, 10);
        await marketMock.mintOther(compoundAdapter.address, 10);
        await compoundAdapter.getSupply(erc20.address);

        //balance >= 10
        await erc20.approve(marketMock.address, 100);
        await marketMock.mintOther(compoundAdapter.address, 100);
        await compoundAdapter.getSupply(erc20.address);
    });

    it("Get supply view", async () => {
        const supply = await compoundAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq("0");
    });

    it("Check is support", async () => {
        const isSupport = await compoundAdapter.supportsToken(erc20.address);
        isSupport.should.eq(true);
    });

    it("Deposit and withdraw", async () => {
        await erc20.transfer(compoundAdapter.address, ethers.utils.parseEther("100"));
        await compoundAdapter.connect(ASSET_MANAGER).deposit(erc20.address);

        let supply = await compoundAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq(ethers.utils.parseEther("100").toString());

        await compoundAdapter
            .connect(ASSET_MANAGER)
            .withdraw(erc20.address, ADMIN.address, ethers.utils.parseEther("100"));

        supply = await compoundAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq("0");
    });

    it("Claim tokens", async () => {
        await compoundAdapter.connect(ASSET_MANAGER).claimTokens(erc20.address, ADMIN.address);
    });

    it("Claim tokens: recipient can not be zero", async () => {
        await expect(
            compoundAdapter.connect(ASSET_MANAGER).claimTokens(erc20.address, ethers.constants.AddressZero)
        ).to.be.revertedWith("Recipient can not be zero");
    });

    it("Withdraw all", async () => {
        await compoundAdapter.connect(ASSET_MANAGER).withdrawAll(erc20.address, ADMIN.address);
    });

    it("Token not supported", async () => {
        await expect(compoundAdapter.deposit(ethers.constants.AddressZero)).to.be.revertedWith("Token not supported");
    });

    it("Set new assetManager", async () => {
        await compoundAdapter.setAssetManager(ASSET_MANAGER_2.address);

        let res = await compoundAdapter.assetManager();
        res.should.eq(ASSET_MANAGER_2.address);
    });
});
