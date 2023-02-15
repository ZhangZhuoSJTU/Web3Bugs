const {ethers, upgrades} = require("hardhat");
const {expect} = require("chai");
require("chai").should();
const {parseEther} = require("ethers").utils;

const {waitNBlocks, increaseTime} = require("../../utils");

describe("Treasury Contract", () => {
    before(async function () {
        [ADMIN, BOB] = await ethers.getSigners();

        const ERC20 = await ethers.getContractFactory("FaucetERC20");
        Treasury = await ethers.getContractFactory("Treasury");
        TreasuryVester = await ethers.getContractFactory("TreasuryVester");
        testToken = await upgrades.deployProxy(ERC20, ["Mock DAI", "DAI"], {
            initializer: "__FaucetERC20_init(string,string)"
        });

        await testToken.mint(ADMIN.address, parseEther("10000000"));
    });

    beforeEach(async () => {
        treasury = await Treasury.deploy(testToken.address);

        const latestBlock = await ethers.provider.getBlock("latest");
        const latest = latestBlock.timestamp;
        treasuryVester = await TreasuryVester.deploy(
            testToken.address,
            treasury.address,
            parseEther("10"),
            latest + 10,
            latest + 100,
            latest + 10000
        );
    });

    it("treasuryVester claim", async () => {
        await testToken.transfer(treasuryVester.address, parseEther("1"));
        await expect(treasuryVester.connect(BOB).claim()).to.be.revertedWith("not time yet");
        await increaseTime(100);
        await treasuryVester.connect(BOB).claim();
    });

    it("treasury grantToken", async () => {
        await testToken.transfer(treasury.address, parseEther("100"));
        res = await testToken.balanceOf(treasury.address);
        res.toString().should.eq(parseEther("100").toString());
        res = await testToken.balanceOf(BOB.address);
        res.toString().should.eq(parseEther("0").toString());
        await treasury.grantToken(BOB.address, parseEther("100"));
        res = await testToken.balanceOf(treasury.address);
        res.toString().should.eq(parseEther("0").toString());
        res = await testToken.balanceOf(BOB.address);
        res.toString().should.eq(parseEther("100").toString());
    });

    it("add and edit schedule", async () => {
        const dripStart = (await ethers.provider.getBlock("latest")).number;
        const dripRate = parseEther("1").toString();

        await treasury.addSchedule(dripStart, dripRate, BOB.address, 0);
        schedules = await treasury.tokenSchedules(BOB.address);
        schedules.target.should.eq(BOB.address);
        schedules.dripStart.toString().should.eq(dripStart.toString());
        schedules.dripRate.toString().should.eq(dripRate.toString());

        const newDripStart = (await ethers.provider.getBlock("latest")).number;
        const newDripRate = parseEther("0.01");
        await treasury.editSchedule(newDripStart, newDripRate, BOB.address, 0);
        schedules = await treasury.tokenSchedules(BOB.address);
        schedules.dripStart.toString().should.eq(newDripStart.toString());
        schedules.dripRate.toString().should.eq(newDripRate.toString());
    });

    it("claim drip amount", async () => {
        await testToken.transfer(treasuryVester.address, parseEther("1000"));
        const dripStart = (await ethers.provider.getBlock("latest")).number;
        const dripRate = parseEther("0.01");
        const amount = parseEther("100");
        startBalance = await testToken.balanceOf(BOB.address);
        await treasury.addSchedule(dripStart, dripRate, BOB.address, amount);
        await waitNBlocks(2);
        await increaseTime(100);
        await treasuryVester.connect(BOB).claim();
        await treasury.connect(BOB).drip(BOB.address);
        endBalance = await testToken.balanceOf(BOB.address);
        console.log(startBalance.toString(), endBalance.toString());
    });
});
