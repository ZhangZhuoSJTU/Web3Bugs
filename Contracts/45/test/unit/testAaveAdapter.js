const {ethers, upgrades} = require("hardhat");
const {expect} = require("chai");

require("chai").should();

describe("AaveAdapter Contract", async () => {
    let ADMIN, ASSET_MANAGER, ASSET_MANAGER_2;
    let erc20, aToken, marketMock, aaveAdapter;

    const RATE = ethers.utils.parseEther("0.01");
    before(async () => {
        [ADMIN, ASSET_MANAGER, ASSET_MANAGER_2] = await ethers.getSigners();

        erc20 = await upgrades.deployProxy(await ethers.getContractFactory("FaucetERC20"), ["Dai Stablecoin", "DAI"], {
            initializer: "__FaucetERC20_init(string,string)"
        });

        aToken = await upgrades.deployProxy(await ethers.getContractFactory("FaucetERC20"), ["AToken", "AToken"], {
            initializer: "__FaucetERC20_init(string,string)"
        });

        marketMock = await upgrades.deployProxy(await ethers.getContractFactory("AaveMock"), [RATE, aToken.address], {
            initializer: "__AaveMock_init(uint128,address)"
        });

        await erc20.mint(ADMIN.address, ethers.utils.parseEther("10000000"));
    });

    beforeEach(async () => {
        aaveAdapter = await upgrades.deployProxy(
            await ethers.getContractFactory("AaveAdapter"),
            [ASSET_MANAGER.address, marketMock.address],
            {initializer: "__AaveAdapter_init(address,address)"}
        );
        await aaveAdapter.mapTokenToAToken(erc20.address);
    });

    it("Get rate", async () => {
        const rate = await aaveAdapter.getRate(erc20.address);
        rate.toString().should.eq(RATE.toString());
    });

    it("Get supply", async () => {
        let supply;
        await aaveAdapter.getSupply(erc20.address);

        //balance <= 10
        await erc20.approve(marketMock.address, 10);
        await aToken.mint(aaveAdapter.address, 10);
        supply = await aaveAdapter.getSupply(erc20.address);
        supply.should.eq("0"); //because balance <= 10

        //balance >= 10
        await erc20.approve(marketMock.address, 100);
        await aToken.mint(aaveAdapter.address, 100);
        supply = await aaveAdapter.getSupply(erc20.address);
        supply.should.eq("110"); // 10 + 100
    });

    it("Get supply view", async () => {
        const supply = await aaveAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq("0");
    });

    it("Check is support", async () => {
        const isSupport = await aaveAdapter.supportsToken(erc20.address);
        isSupport.should.eq(true);
    });

    it("Deposit and withdraw", async () => {
        const amount = ethers.utils.parseEther("100");
        await aToken.mint(marketMock.address, amount);

        await erc20.transfer(aaveAdapter.address, amount);
        await aaveAdapter.connect(ASSET_MANAGER).deposit(erc20.address);

        let supply = await aaveAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq(amount.toString());

        await aaveAdapter.connect(ASSET_MANAGER).withdraw(erc20.address, ADMIN.address, amount);

        supply = await aaveAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq("0");
    });

    it("Withdraw all", async () => {
        const amount = ethers.utils.parseEther("100");
        await aToken.mint(aaveAdapter.address, amount);
        await erc20.transfer(marketMock.address, amount);

        let supply = await aaveAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq(amount.toString());
        await aaveAdapter.connect(ASSET_MANAGER).withdrawAll(erc20.address, ADMIN.address);
        supply = await aaveAdapter.getSupplyView(erc20.address);
        supply.toString().should.eq("0");
    });

    it("Claim tokens", async () => {
        const amount = ethers.utils.parseEther("1");
        await erc20.mint(aaveAdapter.address, amount);
        let res = await erc20.balanceOf(aaveAdapter.address);
        res.should.eq(amount);
        await aaveAdapter.connect(ASSET_MANAGER).claimTokens(erc20.address, ADMIN.address);
        res = await erc20.balanceOf(aaveAdapter.address);
        res.should.eq("0");
    });

    it("Claim tokens: recipient can not be zero", async () => {
        await expect(
            aaveAdapter.connect(ASSET_MANAGER).claimTokens(erc20.address, ethers.constants.AddressZero)
        ).to.be.revertedWith("AaveAdapter: Recipient can not be zero");
    });

    it("Token not supported", async () => {
        await expect(aaveAdapter.deposit(ethers.constants.AddressZero)).to.be.revertedWith(
            "AaveAdapter: Token not supported"
        );
    });

    it("Set new assetManager", async () => {
        await aaveAdapter.setAssetManager(ASSET_MANAGER_2.address);

        let res = await aaveAdapter.assetManager();
        res.should.eq(ASSET_MANAGER_2.address);
    });
});
